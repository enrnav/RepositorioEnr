from fastapi import APIRouter, Depends, HTTPException, status, Request, Response
from fastapi.responses import FileResponse
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session, lazyload
from jose import JWTError, jwt
from database import get_db
import models
import schemas
import auth
from typing import List, Optional
from datetime import datetime, timedelta
import os
import uuid
from services import facturacion
from services.whatsapp import send_whatsapp_message, format_ticket_message

router = APIRouter()

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")

def get_current_user(request: Request, token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, auth.SECRET_KEY, algorithms=[auth.ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
        token_data = schemas.TokenData(username=username)
    except JWTError:
        raise credentials_exception
        
    user = db.query(models.User).filter(models.User.username == token_data.username).first()
    if user is None:
        raise credentials_exception
        
    # Verificar estado del Tenant si tiene uno
    if user.tenant_id:
        tenant = db.query(models.Tenant).filter(models.Tenant.id == user.tenant_id).first()
        if not tenant:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Tienda no encontrada."
            )
        
        # Check if subscription has expired
        if tenant.plan_tier == 'premium' and tenant.subscription_end:
            try:
                now_str = datetime.utcnow().isoformat()
                if now_str > tenant.subscription_end and tenant.subscription_status == 'active':
                    tenant.subscription_status = 'suspended'
                    db.commit()
            except Exception as e:
                print("Error checking subscription expiration:", e)
                
        # If suspended, block all endpoints EXCEPT billing, superadmin, and basic auth information
        path = request.url.path
        if tenant.subscription_status not in ["active", "trialing"]:
            is_billing_route = "/billing" in path or "/superadmin" in path or "/auth/tenant" in path or "/auth/users" in path
            if not is_billing_route:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Suscripción inactiva. Por favor verifique sus pagos."
                )
            
    return user

@router.get("/auth/tenant-branding/{subdomain}")
def get_tenant_branding(subdomain: str, db: Session = Depends(get_db)):
    tenant = db.query(models.Tenant).filter(models.Tenant.subdomain == subdomain).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tienda no encontrada")
    
    settings = db.query(models.StoreSettings).filter(models.StoreSettings.tenant_id == tenant.id).first()
    if not settings:
        return {
            "store_name": tenant.name,
            "logo_url": None,
            "primary_color": "#064E3B",
            "accent_color": "#DC2626"
        }
    
    return {
        "store_name": settings.store_name,
        "logo_url": settings.logo_url,
        "primary_color": settings.primary_color,
        "accent_color": settings.accent_color
    }

@router.post("/auth/register-tenant")
def register_tenant(req: schemas.TenantRegisterRequest, db: Session = Depends(get_db)):
    # 1. Validar si usuario admin ya existe
    existing_user = db.query(models.User).filter(models.User.username == req.admin_username).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="El usuario administrador ya existe")

    # 2. Validar subdominio único si se provee
    if req.subdomain:
        existing_tenant = db.query(models.Tenant).filter(models.Tenant.subdomain == req.subdomain).first()
        if existing_tenant:
            raise HTTPException(status_code=400, detail="El subdominio ya está registrado")

    try:
        # 3. Crear el Tenant
        db_tenant = models.Tenant(
            name=req.store_name,
            subdomain=req.subdomain or str(uuid.uuid4())[:8],
            subscription_status="active",
            plan_tier="free",  # Default to free plan
            created_at=datetime.utcnow().isoformat()
        )
        db.add(db_tenant)
        db.commit()
        db.refresh(db_tenant)

        # 4. Crear el usuario Administrador para el Tenant
        hashed_password = auth.get_password_hash(req.admin_password)
        db_user = models.User(
            tenant_id=db_tenant.id,
            username=req.admin_username,
            full_name=req.admin_name,
            hashed_password=hashed_password,
            role="admin"
        )
        db.add(db_user)

        # 5. Crear StoreSettings por defecto para este Tenant
        db_settings = models.StoreSettings(
            tenant_id=db_tenant.id,
            store_name=req.store_name,
            ticket_footer="¡Gracias por su compra!",
            logo_url=req.logo_url,
            primary_color=req.primary_color or "#064E3B",
            accent_color=req.accent_color or "#064E3B"
        )
        db.add(db_settings)

        db.commit()
        return {
            "message": "Tenant and Admin created successfully", 
            "tenant_id": db_tenant.id,
            "subdomain": db_tenant.subdomain
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/auth/register")
def register(user: schemas.UserCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    existing_user = db.query(models.User).filter(models.User.username == user.username).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="El usuario ya existe")

    # Validar permisos
    if current_user.role not in ['admin', 'supervisor']:
        raise HTTPException(status_code=403, detail="No tienes permisos suficientes para registrar usuarios")
        
    # Hash the password
    hashed_password = auth.get_password_hash(user.password)
    
    db_user = models.User(
        tenant_id=current_user.tenant_id,
        username=user.username, 
        full_name=user.full_name, 
        hashed_password=hashed_password,
        role=user.role
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return {"message": "User created successfully"}

@router.post("/auth/login", response_model=schemas.Token)
def login(user: schemas.UserLogin, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.username == user.username).first()
    if not db_user or not auth.verify_password(user.password, db_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario o contraseña incorrectos",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Verificar estado del Tenant si tiene uno
    sub_status = "active"
    if db_user.tenant_id:
        tenant = db.query(models.Tenant).filter(models.Tenant.id == db_user.tenant_id).first()
        if not tenant:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Tienda no encontrada")
        
        # Check if subscription has expired
        if tenant.plan_tier == 'premium' and tenant.subscription_end:
            try:
                now_str = datetime.utcnow().isoformat()
                if now_str > tenant.subscription_end and tenant.subscription_status == 'active':
                    tenant.subscription_status = 'suspended'
                    db.commit()
            except Exception:
                pass
        sub_status = tenant.subscription_status
        
    access_token = auth.create_access_token(data={
        "sub": db_user.username, 
        "role": db_user.role,
        "tenant_id": db_user.tenant_id
    })
    
    return {
        "access_token": access_token, 
        "token_type": "bearer",
        "user": {
            "id": db_user.id, 
            "tenant_id": db_user.tenant_id,
            "username": db_user.username, 
            "full_name": db_user.full_name,
            "role": db_user.role,
            "subscription_status": sub_status
        }
    }

@router.get("/auth/tenant", response_model=schemas.TenantResponse)
def get_current_tenant(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if not current_user.tenant_id:
        raise HTTPException(status_code=404, detail="No se encontró tienda vinculada a tu usuario")
    tenant = db.query(models.Tenant).filter(models.Tenant.id == current_user.tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tienda no encontrada")
    return tenant

@router.post("/auth/tenant/change-plan", response_model=schemas.TenantResponse)
def change_tenant_plan(req: schemas.TenantPlanChangeRequest, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role != 'admin':
        raise HTTPException(status_code=403, detail="Solo el administrador de la tienda puede cambiar de plan")
    if not current_user.tenant_id:
        raise HTTPException(status_code=404, detail="No se encontró tienda vinculada a tu usuario")
    tenant = db.query(models.Tenant).filter(models.Tenant.id == current_user.tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tienda no encontrada")
    
    tenant.plan_tier = req.plan_tier
    db.commit()
    db.refresh(tenant)
    return tenant

@router.get("/auth/users", response_model=List[schemas.UserResponse])
def get_users(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role != 'admin':
        raise HTTPException(status_code=403, detail="No tienes permisos suficientes")
    return db.query(models.User).filter(models.User.tenant_id == current_user.tenant_id).all()

@router.put("/auth/users/{user_id}", response_model=schemas.UserResponse)
def update_user(user_id: int, user_data: schemas.UserUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role != 'admin' and current_user.id != user_id:
        raise HTTPException(status_code=403, detail="No tienes permisos suficientes")
        
    db_user = db.query(models.User).filter(
        models.User.id == user_id,
        models.User.tenant_id == current_user.tenant_id
    ).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    update_data = user_data.dict(exclude_unset=True)
    if "password" in update_data and update_data["password"]:
        db_user.hashed_password = auth.get_password_hash(update_data["password"])
        del update_data["password"]
        
    for key, value in update_data.items():
        setattr(db_user, key, value)
        
    db.commit()
    db.refresh(db_user)
    return db_user

@router.delete("/auth/users/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role != 'admin':
        raise HTTPException(status_code=403, detail="No tienes permisos suficientes")
        
    db_user = db.query(models.User).filter(
        models.User.id == user_id,
        models.User.tenant_id == current_user.tenant_id
    ).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
        
    db.delete(db_user)
    db.commit()
    return {"message": "Usuario eliminado exitosamente"}

def search_product_image(query: str) -> Optional[str]:
    import urllib.request
    import urllib.parse
    import re
    import json
    
    query_clean = query.strip()
    if not query_clean:
        return None
        
    # 1. Try global OpenFoodFacts CGI search first (most accurate for grocery products)
    try:
        url = "https://world.openfoodfacts.org/cgi/search.pl?search_terms=" + urllib.parse.quote(query_clean) + "&search_simple=1&action=process&json=1"
        req = urllib.request.Request(
            url, 
            headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'}
        )
        with urllib.request.urlopen(req, timeout=2.0) as response:
            data = json.loads(response.read().decode('utf-8'))
        products = data.get("products", [])
        if products:
            for p in products:
                img_url = p.get("image_front_url") or p.get("image_url") or p.get("image_front_small_url")
                if img_url and img_url.startswith("http"):
                    return img_url
    except Exception:
        pass
        
    # 2. Fall back to Bing Images search with strict filters to retrieve real retail packaging
    try:
        search_query = query_clean
        # Auto-tune query for generic terms to get actual bottles/packaging
        if any(w in query_clean.lower() for w in ["salsa", "aceite", "leche", "crema", "agua", "refresco"]):
            search_query += " botella"
            
        url = "https://www.bing.com/images/search?q=" + urllib.parse.quote(search_query)
        req = urllib.request.Request(
            url, 
            headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'}
        )
        with urllib.request.urlopen(req, timeout=3.0) as response:
            html = response.read().decode('utf-8', errors='ignore')
            
        murls = re.findall(r'murl&quot;:&quot;(http[^&]+)&quot;', html)
        
        BLOCKED_DOMAINS = [
            "freepik.com", "shutterstock.com", "pinterest.com", "pinimg.com",
            "lovepik.com", "pngtree.com", "vecteezy.com", "depositphotos.com",
            "dreamstime.com", "123rf.com", "alamy.com", "canva.com",
            "vectorportal.com", "pixabay.com", "vectorstock.com", "istockphoto.com",
            "flaticon.com", "pngwing.com", "klipartz.com", "kindpng.com",
            "pngfind.com", "cleanpng.com", "pngegg.com", "favpng.com",
            "subpng.com", "pngsucai.com", "mksucai.com", "699pic.com",
            "freeimages.com", "pixy.org", "clipart", "gograph.com",
            "canstockphoto.com", "vector.me", "tnaflix.com", "xvideos.com",
            "pornhub.com", "redtube.com", "youporn.com", "xnxx.com", "spankbang.com",
            "eporner.com", "tube8.com", "porn.com"
        ]
        
        BLOCKED_KEYWORDS = [
            "logo", "icon", "vector", "dibujo", "clipart", "iluminacion", 
            "background", "fondo", "ilustration", "ilustracion", "banner", 
            "mockup", "silueta", "silhouette", "esquema", "porn", "tnaflix",
            "xxx", "adult", "sexy", "naked", "nude", "erotic"
        ]
        
        MOTOR_KEYWORDS = ["motor", "transmision", "transmission", "atf", "mobil", "lubricante", "refaccionaria", "mirefaccion"]
        
        for u in murls:
            u_lower = u.lower()
            blocked_domain = any(d in u_lower for d in BLOCKED_DOMAINS)
            blocked_kw = any(kw in u_lower for kw in BLOCKED_KEYWORDS)
            blocked_motor = any(mk in u_lower for mk in MOTOR_KEYWORDS)
            if not blocked_domain and not blocked_kw and not blocked_motor:
                return u
                
        img_srcs = re.findall(r'src="(http[^"]+)"', html)
        for src in img_srcs:
            src_lower = src.lower()
            if not any(x in src_lower for x in ["logo", "icon", "bing", "gstatic"]) and not any(d in src_lower for d in BLOCKED_DOMAINS) and not any(mk in src_lower for mk in MOTOR_KEYWORDS):
                return src
    except Exception:
        pass
        
    return None

@router.get("/inventory/search-image")
def get_product_image_search(q: str, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if not q or not q.strip():
        return {"image_url": None}
    img_url = search_product_image(q.strip())
    return {"image_url": img_url}

@router.get("/inventory/", response_model=List[schemas.ProductResponse])
def get_inventory(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    products = db.query(models.Product).filter(models.Product.tenant_id == current_user.tenant_id).all()
    return products

@router.post("/inventory/", response_model=schemas.ProductResponse)
def create_product(product: schemas.ProductCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role not in ['admin', 'supervisor']:
        raise HTTPException(status_code=403, detail="No tienes permisos suficientes")
    
    # Validar límite de plan gratis
    tenant = db.query(models.Tenant).filter(models.Tenant.id == current_user.tenant_id).first()
    if tenant and tenant.plan_tier == 'free':
        prod_count = db.query(models.Product).filter(models.Product.tenant_id == current_user.tenant_id).count()
        if prod_count >= 50:
            raise HTTPException(
                status_code=400,
                detail="Límite del plan gratuito alcanzado (máximo 50 productos). Por favor, actualiza tu cuenta a Premium."
            )

    prod_data = product.dict()
    variants_data = prod_data.pop("variants", [])
    
    db_product = models.Product(**prod_data, tenant_id=current_user.tenant_id)
    db.add(db_product)
    db.commit()
    db.refresh(db_product)
    
    if variants_data:
        for v in variants_data:
            db_var = models.ProductVariant(
                tenant_id=current_user.tenant_id,
                product_id=db_product.id,
                name=v["name"],
                barcode=v.get("barcode"),
                cost_price=v.get("cost_price") if v.get("cost_price") is not None else db_product.cost_price,
                price=v.get("price") if v.get("price") is not None else db_product.price,
                quantity=v["quantity"]
            )
            db.add(db_var)
        db.commit()
        db.refresh(db_product)
    return db_product

@router.put("/inventory/{product_id}", response_model=schemas.ProductResponse)
def update_product(product_id: int, product: schemas.ProductCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role not in ['admin', 'supervisor']:
        raise HTTPException(status_code=403, detail="No tienes permisos suficientes")
    db_product = db.query(models.Product).filter(
        models.Product.id == product_id,
        models.Product.tenant_id == current_user.tenant_id
    ).first()
    if not db_product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    prod_data = product.dict()
    variants_data = prod_data.pop("variants", [])
    
    for key, value in prod_data.items():
        setattr(db_product, key, value)
    
    # Sync variants (simple delete and recreate)
    db.query(models.ProductVariant).filter(
        models.ProductVariant.product_id == product_id,
        models.ProductVariant.tenant_id == current_user.tenant_id
    ).delete()
    if variants_data:
        for v in variants_data:
            db_var = models.ProductVariant(
                tenant_id=current_user.tenant_id,
                product_id=db_product.id,
                name=v["name"],
                barcode=v.get("barcode"),
                cost_price=v.get("cost_price") if v.get("cost_price") is not None else db_product.cost_price,
                price=v.get("price") if v.get("price") is not None else db_product.price,
                quantity=v["quantity"]
            )
            db.add(db_var)
            
    db.commit()
    db.refresh(db_product)
    return db_product

@router.delete("/inventory/{product_id}")
def delete_product(product_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role not in ['admin', 'supervisor']:
        raise HTTPException(status_code=403, detail="No tienes permisos suficientes")
    db_product = db.query(models.Product).filter(
        models.Product.id == product_id,
        models.Product.tenant_id == current_user.tenant_id
    ).first()
    if not db_product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    db.delete(db_product)
    db.commit()
    return {"message": "Product deleted successfully"}

@router.post("/inventory/{product_id}/sell", response_model=schemas.ProductResponse)
def sell_product(product_id: int, sell_data: schemas.ProductSell, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    db_product = db.query(models.Product).filter(
        models.Product.id == product_id,
        models.Product.tenant_id == current_user.tenant_id
    ).first()
    if not db_product:
        raise HTTPException(status_code=404, detail="Product not found")
        
    from sqlalchemy import text
    try:
        db.execute(
            text("SELECT vender_producto(:product_id, :quantity, :created_at)"),
            {
                "product_id": product_id,
                "quantity": sell_data.quantity,
                "created_at": datetime.utcnow().isoformat()
            }
        )
        db.commit()
        
        # Actualizar tenant_id en el registro de venta recién creado por el SP vender_producto
        latest_sale = db.query(models.SaleHistory).filter(
            models.SaleHistory.product_id == product_id,
            models.SaleHistory.tenant_id == None
        ).order_by(models.SaleHistory.id.desc()).first()
        if latest_sale:
            latest_sale.tenant_id = current_user.tenant_id
            latest_sale.user_id = current_user.id
            db.commit()
            
    except Exception as e:
        db.rollback()
        # Parse error message to show a clean response
        error_msg = str(e)
        if hasattr(e, 'orig') and e.orig:
            orig_msg = str(e.orig)
            if "ERROR:" in orig_msg:
                parts = orig_msg.split("ERROR:")
                if len(parts) > 1:
                    error_msg = parts[1].split("\n")[0].strip()
            else:
                error_msg = orig_msg.split("\n")[0].strip()
        raise HTTPException(status_code=400, detail=error_msg)
        
    db_product = db.query(models.Product).filter(
        models.Product.id == product_id,
        models.Product.tenant_id == current_user.tenant_id
    ).first()
    return db_product

@router.get("/inventory/sales_report")
def get_sales_report(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role not in ['admin', 'supervisor']:
        raise HTTPException(status_code=403, detail="No tienes permisos suficientes")
    products = db.query(models.Product).filter(models.Product.tenant_id == current_user.tenant_id).all()
    sales = db.query(models.SaleHistory).filter(
        models.SaleHistory.tenant_id == current_user.tenant_id,
        models.SaleHistory.is_cancelled == False
    ).all()
    
    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=now.weekday()) # Monday of current week
    month_start = today_start.replace(day=1)
    
    report = []
    for p in products:
        p_sales = [s for s in sales if s.product_id == p.id]
        
        sales_today = sum(s.quantity for s in p_sales if datetime.fromisoformat(s.created_at) >= today_start)
        sales_week = sum(s.quantity for s in p_sales if datetime.fromisoformat(s.created_at) >= week_start)
        sales_month = sum(s.quantity for s in p_sales if datetime.fromisoformat(s.created_at) >= month_start)
        
        def get_sale_revenue(s):
            price = s.price_sold if s.price_sold is not None else p.price
            return (price * s.quantity) - s.discount
 
        revenue_today = sum(get_sale_revenue(s) for s in p_sales if datetime.fromisoformat(s.created_at) >= today_start)
        revenue_week = sum(get_sale_revenue(s) for s in p_sales if datetime.fromisoformat(s.created_at) >= week_start)
        revenue_month = sum(get_sale_revenue(s) for s in p_sales if datetime.fromisoformat(s.created_at) >= month_start)
        revenue_total = sum(get_sale_revenue(s) for s in p_sales)
        
        report.append({
            "id": p.id,
            "name": p.name,
            "price": p.price,
            "quantity": p.quantity,
            "sold_total": p.sold,
            "sales_today": sales_today,
            "revenue_today": revenue_today,
            "sales_week": sales_week,
            "revenue_week": revenue_week,
            "sales_month": sales_month,
            "revenue_month": revenue_month,
            "revenue_total": revenue_total
        })
        
    return report

@router.get("/dashboard/stats")
def get_stats(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role != 'admin':
        raise HTTPException(status_code=403, detail="No tienes permisos suficientes")
    products = db.query(models.Product).filter(models.Product.tenant_id == current_user.tenant_id).all()
    total_stock = sum(p.quantity for p in products)
    total_sold = sum(p.sold for p in products)
    low_stock = sum(1 for p in products if p.quantity < 20)
    
    return {
        "total_stock": total_stock,
        "total_sold": total_sold,
        "low_stock_alerts": low_stock
    }

@router.get("/sales/recent")
def get_recent_sales(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    results = db.query(
        models.SaleHistory.id,
        models.SaleHistory.product_id,
        models.SaleHistory.quantity,
        models.SaleHistory.created_at,
        models.SaleHistory.is_cancelled,
        models.SaleHistory.cancel_reason,
        models.SaleHistory.authorized_by,
        models.Product.name.label("product_name"),
        models.Product.price.label("product_price"),
        models.User.full_name.label("cashier_name")
    ).join(
        models.Product, models.Product.id == models.SaleHistory.product_id
    ).outerjoin(
        models.User, models.User.id == models.SaleHistory.user_id
    ).filter(
        models.SaleHistory.tenant_id == current_user.tenant_id
    ).order_by(
        models.SaleHistory.id.desc()
    ).limit(50).all()
    
    return [
        {
            "id": r.id,
            "product_id": r.product_id,
            "product_name": r.product_name,
            "product_price": r.product_price,
            "quantity": r.quantity,
            "created_at": r.created_at,
            "is_cancelled": r.is_cancelled,
            "cancel_reason": r.cancel_reason,
            "authorized_by": r.authorized_by,
            "cashier_name": r.cashier_name or "Desconocido"
        }
        for r in results
    ]

@router.post("/sales/{sale_id}/cancel")
def cancel_sale_endpoint(sale_id: int, cancel_data: schemas.CancelSaleRequest, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    authorized_by_username = current_user.username
    if current_user.role == "cajero" or current_user.role == "user":
        # Requiere credenciales de admin o supervisor
        if not cancel_data.auth_username or not cancel_data.auth_password:
            raise HTTPException(status_code=403, detail="Las cancelaciones están restringidas para cajeros. Se requieren credenciales de Supervisor o Administrador.")
        
        supervisor_user = db.query(models.User).filter(
            models.User.username == cancel_data.auth_username,
            models.User.tenant_id == current_user.tenant_id
        ).first()
        if not supervisor_user or not auth.verify_password(cancel_data.auth_password, supervisor_user.hashed_password):
            raise HTTPException(status_code=403, detail="Usuario o contraseña del supervisor incorrectos.")
        
        if supervisor_user.role not in ["admin", "supervisor"]:
            raise HTTPException(status_code=403, detail="El usuario autorizador no tiene permisos de Supervisor o Administrador.")
        authorized_by_username = supervisor_user.username

    # Cancelar venta transaccional en python
    try:
        sale = db.query(models.SaleHistory).filter(
            models.SaleHistory.id == sale_id,
            models.SaleHistory.tenant_id == current_user.tenant_id
        ).with_for_update().first()
        
        if not sale:
            raise HTTPException(status_code=404, detail="La venta no existe.")
            
        if sale.is_cancelled:
            raise HTTPException(status_code=400, detail="Esta venta ya fue cancelada o devuelta por completo.")
            
        # Determinar cantidad a cancelar/devolver
        qty_to_cancel = cancel_data.quantity
        if qty_to_cancel is None:
            qty_to_cancel = sale.quantity
            
        if qty_to_cancel <= 0 or qty_to_cancel > sale.quantity:
            raise HTTPException(status_code=400, detail=f"Cantidad inválida a cancelar. Disponible: {sale.quantity}, Solicitado: {qty_to_cancel}")
            
        # Devolver stock
        if sale.variant_id:
            var = db.query(models.ProductVariant).filter(
                models.ProductVariant.id == sale.variant_id,
                models.ProductVariant.tenant_id == current_user.tenant_id
            ).with_for_update().first()
            if var:
                var.quantity += qty_to_cancel
                var.sold -= qty_to_cancel
            prod = db.query(models.Product).filter(
                models.Product.id == sale.product_id,
                models.Product.tenant_id == current_user.tenant_id
            ).options(lazyload(models.Product.variants)).with_for_update().first()
            if prod:
                prod.quantity += qty_to_cancel
                prod.sold -= qty_to_cancel
        else:
            prod = db.query(models.Product).filter(
                models.Product.id == sale.product_id,
                models.Product.tenant_id == current_user.tenant_id
            ).options(lazyload(models.Product.variants)).with_for_update().first()
            if prod:
                prod.quantity += qty_to_cancel
                prod.sold -= qty_to_cancel
                
        # Calcular reembolsos proporcionales y deducir del turno de caja activo
        ratio = qty_to_cancel / sale.quantity
        discount_refund = sale.discount * ratio
        cash_refund = (sale.cash_amount or 0.0) * ratio
        card_refund = (sale.card_amount or 0.0) * ratio
        
        if sale.shift_id:
            shift = db.query(models.Shift).filter(
                models.Shift.id == sale.shift_id,
                models.Shift.tenant_id == current_user.tenant_id,
                models.Shift.status == "open"
            ).first()
            if shift:
                cash_to_deduct = 0.0
                if sale.payment_method == "efectivo":
                    cash_to_deduct = (sale.price_sold * qty_to_cancel) - discount_refund
                elif sale.payment_method == "mixto":
                    cash_to_deduct = cash_refund
                    
                shift.final_cash_expected -= cash_to_deduct
                
        price_val = sale.price_sold if sale.price_sold is not None else 0.0
        
        # Guardar registro en product_returns
        prod_return = models.ProductReturn(
            tenant_id=current_user.tenant_id,
            sale_id=sale.id,
            product_id=sale.product_id,
            quantity=qty_to_cancel,
            price=price_val,
            reason=cancel_data.reason,
            authorized_by=authorized_by_username,
            created_at=datetime.utcnow().isoformat()
        )
        db.add(prod_return)
        
        # Actualizar el registro original de la venta
        sale.authorized_by = authorized_by_username
        if qty_to_cancel == sale.quantity:
            sale.is_cancelled = True
            sale.cancel_reason = cancel_data.reason
        else:
            sale.quantity -= qty_to_cancel
            sale.discount -= discount_refund
            if sale.cash_amount:
                sale.cash_amount -= cash_refund
            if sale.card_amount:
                sale.card_amount -= card_refund
            
            partial_reason = f"Devolución parcial de {qty_to_cancel} pzs: {cancel_data.reason}"
            if sale.cancel_reason:
                sale.cancel_reason += f" | {partial_reason}"
            else:
                sale.cancel_reason = partial_reason
        
        db.commit()
        return {"message": f"Devolución de {qty_to_cancel} piezas procesada exitosamente."}
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/inventory/returns_report", response_model=List[schemas.ReturnResponse])
def get_returns_report(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role not in ['admin', 'supervisor']:
        raise HTTPException(status_code=403, detail="No tienes permisos suficientes")
    
    results = db.query(
        models.ProductReturn.id,
        models.ProductReturn.sale_id,
        models.ProductReturn.product_id,
        models.ProductReturn.quantity,
        models.ProductReturn.price,
        models.ProductReturn.reason,
        models.ProductReturn.authorized_by,
        models.ProductReturn.created_at,
        models.Product.name.label("product_name")
    ).join(
        models.Product, models.Product.id == models.ProductReturn.product_id
    ).filter(
        models.ProductReturn.tenant_id == current_user.tenant_id
    ).order_by(
        models.ProductReturn.id.desc()
    ).all()
    
    return [
        {
            "id": r.id,
            "sale_id": r.sale_id,
            "product_id": r.product_id,
            "product_name": r.product_name,
            "quantity": r.quantity,
            "price": r.price,
            "reason": r.reason,
            "authorized_by": r.authorized_by,
            "created_at": r.created_at
        }
        for r in results
    ]

# --- NUEVOS ENDPOINTS MEJORAS POS ---

@router.post("/sales/checkout")
def checkout(checkout_data: schemas.CheckoutRequest, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    shift = None
    if checkout_data.shift_id is not None:
        shift = db.query(models.Shift).filter(
            models.Shift.id == checkout_data.shift_id,
            models.Shift.tenant_id == current_user.tenant_id,
            models.Shift.status == "open"
        ).first()
        if not shift and current_user.role != 'admin':
            raise HTTPException(status_code=400, detail="No hay un turno de caja activo o el ID del turno es incorrecto.")
    elif current_user.role != 'admin':
        raise HTTPException(status_code=400, detail="Se requiere un turno de caja activo para procesar la venta.")
        
    # Validar cliente si es pago a crédito
    customer = None
    if checkout_data.payment_method == "credito":
        if not checkout_data.customer_id:
            raise HTTPException(status_code=400, detail="Debe seleccionar un cliente para realizar una venta a crédito.")
        customer = db.query(models.Customer).filter(
            models.Customer.id == checkout_data.customer_id,
            models.Customer.tenant_id == current_user.tenant_id
        ).with_for_update().first()
        if not customer:
            raise HTTPException(status_code=404, detail="El cliente seleccionado no existe.")
    elif checkout_data.customer_id:
        customer = db.query(models.Customer).filter(
            models.Customer.id == checkout_data.customer_id,
            models.Customer.tenant_id == current_user.tenant_id
        ).first()

    try:
        now_str = datetime.utcnow().isoformat()
        subtotal = 0.0
        items_to_process = []
        
        for item in checkout_data.items:
            if item.variant_id:
                var = db.query(models.ProductVariant).filter(
                    models.ProductVariant.id == item.variant_id,
                    models.ProductVariant.tenant_id == current_user.tenant_id
                ).with_for_update().first()
                if not var:
                    raise HTTPException(status_code=404, detail=f"La variante con ID {item.variant_id} no existe.")
                if var.quantity < item.quantity:
                    raise HTTPException(status_code=400, detail=f"Stock insuficiente para la variante {var.name}. Disponible: {var.quantity}, Solicitado: {item.quantity}")
                
                prod = db.query(models.Product).filter(
                    models.Product.id == var.product_id,
                    models.Product.tenant_id == current_user.tenant_id
                ).first()
                price = var.price if var.price is not None else prod.price
                cost = var.cost_price if var.cost_price is not None else prod.cost_price
                subtotal += price * item.quantity
                items_to_process.append((item, var, prod, price, cost))
            else:
                prod = db.query(models.Product).filter(
                    models.Product.id == item.product_id,
                    models.Product.tenant_id == current_user.tenant_id
                ).options(lazyload(models.Product.variants)).with_for_update().first()
                if not prod:
                    raise HTTPException(status_code=404, detail=f"El producto con ID {item.product_id} no existe.")
                if prod.quantity < item.quantity:
                    raise HTTPException(status_code=400, detail=f"Stock insuficiente para el producto {prod.name}. Disponible: {prod.quantity}, Solicitado: {item.quantity}")
                
                price = prod.price
                cost = prod.cost_price
                subtotal += price * item.quantity
                items_to_process.append((item, None, prod, price, cost))
                
        if subtotal <= 0:
            raise HTTPException(status_code=400, detail="El total de la venta debe ser mayor a 0.")

        sale_total = subtotal - checkout_data.discount

        # Validar límite de crédito del cliente si aplica
        if checkout_data.payment_method == "credito" and customer:
            if customer.current_balance + sale_total > customer.credit_limit:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Límite de crédito excedido. Disponible: ${customer.credit_limit - customer.current_balance:.2f}, Total venta: ${sale_total:.2f}"
                )
            customer.current_balance += sale_total

        discount_ratio = checkout_data.discount / subtotal if checkout_data.discount > 0 else 0.0
        
        for item_data in items_to_process:
            item, var, prod, price, cost = item_data
            qty = item.quantity
            
            item_subtotal = price * qty
            item_discount = item_subtotal * discount_ratio
            
            if var:
                var.quantity -= qty
                var.sold += qty
                prod.quantity -= qty
                prod.sold += qty
            else:
                prod.quantity -= qty
                prod.sold += qty
                
            sale_record = models.SaleHistory(
                tenant_id=current_user.tenant_id,
                product_id=prod.id,
                variant_id=var.id if var else None,
                shift_id=shift.id if shift else None,
                user_id=current_user.id,
                quantity=qty,
                price_sold=price,
                cost_price_sold=cost,
                discount=item_discount,
                payment_method=checkout_data.payment_method,
                cash_amount=checkout_data.cash_amount * (item_subtotal / subtotal) if checkout_data.payment_method == "mixto" else (sale_total if checkout_data.payment_method == "efectivo" else 0.0),
                card_amount=checkout_data.card_amount * (item_subtotal / subtotal) if checkout_data.payment_method == "mixto" else (sale_total if checkout_data.payment_method == "tarjeta" else 0.0),
                created_at=now_str,
                customer_id=checkout_data.customer_id
            )
            db.add(sale_record)
            
        if shift:
            cash_sale_total = 0.0
            if checkout_data.payment_method == "efectivo":
                cash_sale_total = sale_total
            elif checkout_data.payment_method == "mixto":
                cash_sale_total = checkout_data.cash_amount
                
            shift.final_cash_expected += cash_sale_total
        
        db.commit()
        db.refresh(sale_record)
        return {"message": "Venta procesada exitosamente", "sale_id": sale_record.id}

        
    except Exception as e:
        db.rollback()
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/shifts/active", response_model=Optional[schemas.ShiftResponse])
def get_active_shift(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    shift = db.query(models.Shift).filter(
        models.Shift.user_id == current_user.id,
        models.Shift.tenant_id == current_user.tenant_id,
        models.Shift.status == "open"
    ).first()
    return shift

@router.post("/shifts/open", response_model=schemas.ShiftResponse)
def open_shift(shift_data: schemas.ShiftCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    existing = db.query(models.Shift).filter(
        models.Shift.user_id == current_user.id,
        models.Shift.tenant_id == current_user.tenant_id,
        models.Shift.status == "open"
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Ya tienes un turno de caja abierto.")
        
    new_shift = models.Shift(
        tenant_id=current_user.tenant_id,
        user_id=current_user.id,
        start_time=datetime.utcnow().isoformat(),
        initial_cash=shift_data.initial_cash,
        final_cash_expected=shift_data.initial_cash,
        status="open"
    )
    db.add(new_shift)
    db.commit()
    db.refresh(new_shift)
    return new_shift

@router.post("/shifts/close", response_model=schemas.ShiftResponse)
def close_shift(close_data: schemas.ShiftClose, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    shift = db.query(models.Shift).filter(
        models.Shift.user_id == current_user.id,
        models.Shift.tenant_id == current_user.tenant_id,
        models.Shift.status == "open"
    ).first()
    if not shift:
        raise HTTPException(status_code=404, detail="No tienes ningún turno de caja activo.")
        
    shift.end_time = datetime.utcnow().isoformat()
    shift.final_cash_real = close_data.final_cash_real
    shift.difference = close_data.final_cash_real - shift.final_cash_expected
    shift.status = "closed"
    
    db.commit()
    db.refresh(shift)
    return shift

@router.post("/shifts/movement", response_model=schemas.CashMovementResponse)
def add_cash_movement(movement: schemas.CashMovementCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    shift = db.query(models.Shift).filter(
        models.Shift.user_id == current_user.id,
        models.Shift.tenant_id == current_user.tenant_id,
        models.Shift.status == "open"
    ).first()
    if not shift:
        raise HTTPException(status_code=400, detail="No tienes un turno de caja abierto para registrar movimientos.")
        
    db_mov = models.CashMovement(
        tenant_id=current_user.tenant_id,
        shift_id=shift.id,
        type=movement.type,
        amount=movement.amount,
        reason=movement.reason,
        created_at=datetime.utcnow().isoformat()
    )
    
    if movement.type == "entrada":
        shift.final_cash_expected += movement.amount
    elif movement.type in ["salida", "retiro_parcial"]:
        if shift.final_cash_expected < movement.amount:
            raise HTTPException(status_code=400, detail="No puedes retirar una cantidad mayor a la que hay en caja actualmente.")
        shift.final_cash_expected -= movement.amount
        
    db.add(db_mov)
    db.commit()
    db.refresh(db_mov)
    return db_mov

@router.get("/shifts/active-all")
def get_all_active_shifts(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role != 'admin':
        raise HTTPException(status_code=403, detail="No tienes permisos suficientes.")
        
    active_shifts = db.query(models.Shift).filter(
        models.Shift.status == "open",
        models.Shift.tenant_id == current_user.tenant_id
    ).all()
    
    result = []
    for s in active_shifts:
        user = db.query(models.User).filter(
            models.User.id == s.user_id,
            models.User.tenant_id == current_user.tenant_id
        ).first()
        result.append({
            "id": s.id,
            "user_id": s.user_id,
            "username": user.username if user else "Desconocido",
            "full_name": user.full_name if user else "Desconocido",
            "start_time": s.start_time,
            "initial_cash": s.initial_cash,
            "final_cash_expected": s.final_cash_expected,
            "status": s.status
        })
    return result

@router.post("/shifts/{shift_id}/close", response_model=schemas.ShiftResponse)
def close_any_shift(shift_id: int, close_data: schemas.ShiftClose, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role != 'admin':
        raise HTTPException(status_code=403, detail="No tienes permisos suficientes.")
        
    shift = db.query(models.Shift).filter(
        models.Shift.id == shift_id,
        models.Shift.tenant_id == current_user.tenant_id,
        models.Shift.status == "open"
    ).first()
    if not shift:
        raise HTTPException(status_code=404, detail="Turno no encontrado o ya está cerrado.")
        
    shift.end_time = datetime.utcnow().isoformat()
    shift.final_cash_real = close_data.final_cash_real
    shift.difference = close_data.final_cash_real - shift.final_cash_expected
    shift.status = "closed"
    db.commit()
    db.refresh(shift)
    return shift

@router.get("/shifts/{shift_id}/report")
def get_shift_report(shift_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    shift = db.query(models.Shift).filter(
        models.Shift.id == shift_id,
        models.Shift.tenant_id == current_user.tenant_id
    ).first()
    if not shift:
        raise HTTPException(status_code=404, detail="Turno no encontrado.")
        
    if current_user.role == "cajero" and shift.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="No tienes permisos para ver el reporte de otros turnos.")
        
    movements = db.query(models.CashMovement).filter(
        models.CashMovement.shift_id == shift.id,
        models.CashMovement.tenant_id == current_user.tenant_id
    ).all()
    
    sales = db.query(
        models.SaleHistory.id,
        models.SaleHistory.quantity,
        models.SaleHistory.price_sold,
        models.SaleHistory.discount,
        models.SaleHistory.payment_method,
        models.SaleHistory.cash_amount,
        models.SaleHistory.card_amount,
        models.SaleHistory.is_cancelled,
        models.Product.name.label("product_name")
    ).join(
        models.Product, models.Product.id == models.SaleHistory.product_id
    ).filter(
        models.SaleHistory.shift_id == shift.id,
        models.SaleHistory.tenant_id == current_user.tenant_id
    ).all()
    
    cash_sales = 0.0
    card_sales = 0.0
    credit_sales = 0.0
    cancelled_sales_total = 0.0
    
    sales_list = []
    for s in sales:
        total = (s.price_sold * s.quantity) - s.discount
        if s.is_cancelled:
            cancelled_sales_total += total
        else:
            if s.payment_method == "efectivo":
                cash_sales += total
            elif s.payment_method == "tarjeta":
                card_sales += total
            elif s.payment_method == "credito":
                credit_sales += total
            elif s.payment_method == "mixto":
                cash_sales += s.cash_amount
                card_sales += s.card_amount
                
        sales_list.append({
            "id": s.id,
            "product_name": s.product_name,
            "quantity": s.quantity,
            "total": total,
            "payment_method": s.payment_method,
            "is_cancelled": s.is_cancelled
        })
        
    entries = sum(m.amount for m in movements if m.type == "entrada")
    withdrawals = sum(m.amount for m in movements if m.type in ["salida", "retiro_parcial"])
    
    cajero = db.query(models.User).filter(
        models.User.id == shift.user_id,
        models.User.tenant_id == current_user.tenant_id
    ).first()
    
    return {
        "shift": {
            "id": shift.id,
            "cashier_name": cajero.full_name if cajero else "Desconocido",
            "start_time": shift.start_time,
            "end_time": shift.end_time,
            "initial_cash": shift.initial_cash,
            "final_cash_real": shift.final_cash_real,
            "final_cash_expected": shift.final_cash_expected,
            "difference": shift.difference,
            "status": shift.status
        },
        "totals": {
            "cash_sales": cash_sales,
            "card_sales": card_sales,
            "credit_sales": credit_sales,
            "total_sales": cash_sales + card_sales + credit_sales,
            "cash_entries": entries,
            "cash_withdrawals": withdrawals,
            "cancelled_sales_total": cancelled_sales_total
        },
        "movements": [
            {
                "id": m.id,
                "type": m.type,
                "amount": m.amount,
                "reason": m.reason,
                "created_at": m.created_at
            }
            for m in movements
        ],
        "sales": sales_list
    }

@router.get("/reports/profit-margin")
def get_profit_margin_report(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role not in ["admin", "supervisor"]:
        raise HTTPException(status_code=403, detail="No tienes permisos suficientes.")
        
    products = db.query(models.Product).filter(models.Product.tenant_id == current_user.tenant_id).all()
    sales = db.query(models.SaleHistory).filter(
        models.SaleHistory.tenant_id == current_user.tenant_id,
        models.SaleHistory.is_cancelled == False
    ).all()
    
    report = []
    total_revenue = 0.0
    total_cost = 0.0
    
    for p in products:
        p_sales = [s for s in sales if s.product_id == p.id]
        qty_sold = sum(s.quantity for s in p_sales)
        
        def get_sale_revenue(s):
            price = s.price_sold if s.price_sold is not None else p.price
            return (price * s.quantity) - s.discount
            
        def get_sale_cost(s):
            cost = s.cost_price_sold if s.cost_price_sold is not None else p.cost_price
            return cost * s.quantity

        revenue = sum(get_sale_revenue(s) for s in p_sales)
        cost = sum(get_sale_cost(s) for s in p_sales)
        
        profit = revenue - cost
        margin_pct = (profit / revenue * 100) if revenue > 0 else 0.0
        
        total_revenue += revenue
        total_cost += cost
        
        report.append({
            "product_id": p.id,
            "product_name": p.name,
            "quantity_sold": qty_sold,
            "revenue": revenue,
            "cost": cost,
            "profit": profit,
            "margin_percentage": margin_pct
        })
        
    report = sorted(report, key=lambda x: x["quantity_sold"], reverse=True)
    
    return {
        "summary": {
            "total_revenue": total_revenue,
            "total_cost": total_cost,
            "total_profit": total_revenue - total_cost,
            "average_margin_percentage": ((total_revenue - total_cost) / total_revenue * 100) if total_revenue > 0 else 0.0
        },
        "products": report
    }

# --- FACTURACIÓN ELECTRÓNICA ENDPOINTS ---

@router.get("/billing/profiles", response_model=List[schemas.BillingProfileResponse])
def get_billing_profiles(q: Optional[str] = None, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    query = db.query(models.BillingProfile).filter(models.BillingProfile.tenant_id == current_user.tenant_id)
    if q:
        query = query.filter(
            (models.BillingProfile.rfc.ilike(f"%{q}%")) |
            (models.BillingProfile.razon_social.ilike(f"%{q}%"))
        )
    return query.all()

@router.post("/billing/profiles", response_model=schemas.BillingProfileResponse)
def create_billing_profile(profile: schemas.BillingProfileCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    existing = db.query(models.BillingProfile).filter(
        models.BillingProfile.rfc == profile.rfc.upper().strip(),
        models.BillingProfile.tenant_id == current_user.tenant_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Ya existe un perfil de facturación con este RFC")
        
    db_profile = models.BillingProfile(
        tenant_id=current_user.tenant_id,
        rfc=profile.rfc.upper().strip(),
        razon_social=profile.razon_social.upper().strip(),
        regimen_fiscal=profile.regimen_fiscal,
        codigo_postal=profile.codigo_postal,
        correo=profile.correo.lower().strip()
    )
    db.add(db_profile)
    db.commit()
    db.refresh(db_profile)
    return db_profile

@router.put("/billing/profiles/{profile_id}", response_model=schemas.BillingProfileResponse)
def update_billing_profile(profile_id: int, profile: schemas.BillingProfileCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    db_profile = db.query(models.BillingProfile).filter(
        models.BillingProfile.id == profile_id,
        models.BillingProfile.tenant_id == current_user.tenant_id
    ).first()
    if not db_profile:
        raise HTTPException(status_code=404, detail="Perfil de facturación no encontrado")
        
    db_profile.rfc = profile.rfc.upper().strip()
    db_profile.razon_social = profile.razon_social.upper().strip()
    db_profile.regimen_fiscal = profile.regimen_fiscal
    db_profile.codigo_postal = profile.codigo_postal
    db_profile.correo = profile.correo.lower().strip()
    
    db.commit()
    db.refresh(db_profile)
    return db_profile

@router.get("/billing/tickets/{ticket_id}")
def get_ticket_details(ticket_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    # Buscamos la línea de venta de referencia
    ref_sale = db.query(models.SaleHistory).filter(
        models.SaleHistory.id == ticket_id,
        models.SaleHistory.tenant_id == current_user.tenant_id
    ).first()
    if not ref_sale:
        raise HTTPException(status_code=404, detail="Ticket de venta no encontrado")
        
    # Agrupamos todas las ventas que comparten la misma fecha (created_at) y cajero
    sales = db.query(
        models.SaleHistory.id,
        models.SaleHistory.product_id,
        models.SaleHistory.variant_id,
        models.SaleHistory.quantity,
        models.SaleHistory.price_sold,
        models.SaleHistory.discount,
        models.SaleHistory.created_at,
        models.SaleHistory.payment_method,
        models.SaleHistory.invoice_id,
        models.SaleHistory.is_cancelled,
        models.Product.name.label("product_name"),
        models.Product.sat_key.label("product_sat_key"),
        models.Product.sat_unit_key.label("product_sat_unit_key")
    ).join(
        models.Product, models.Product.id == models.SaleHistory.product_id
    ).filter(
        models.SaleHistory.created_at == ref_sale.created_at,
        models.SaleHistory.tenant_id == current_user.tenant_id
    ).all()
    
    if not sales:
        raise HTTPException(status_code=404, detail="No se encontraron artículos para este ticket")
        
    items = []
    subtotal = 0.0
    discount_total = 0.0
    
    for s in sales:
        price = s.price_sold or 0.0
        item_subtotal = price * s.quantity
        subtotal += item_subtotal
        discount_total += s.discount or 0.0
        
        items.append({
            "sale_id": s.id,
            "product_id": s.product_id,
            "product_name": s.product_name,
            "quantity": s.quantity,
            "price": price,
            "discount": s.discount,
            "total": item_subtotal - s.discount,
            "sat_key": s.product_sat_key,
            "sat_unit_key": s.product_sat_unit_key,
            "is_cancelled": s.is_cancelled
        })
        
    settings = db.query(models.StoreSettings).filter(models.StoreSettings.id == 1).first()
    if not settings:
        settings = models.StoreSettings(
            id=1,
            store_name="ABARROTES ED & E",
            rfc="AED180425EE3",
            phone="8112345678",
            email="ventas@abarrotesede.com",
            address="Av. Constitución #450, Monterrey, N.L. C.P. 64000",
            tax_rate=16.0,
            ticket_footer="¡Gracias por su compra!"
        )
        db.add(settings)
        db.commit()
        db.refresh(settings)

    tax_factor = 1 + (settings.tax_rate / 100)
        
    taxes_total = round((subtotal - discount_total) - ((subtotal - discount_total) / tax_factor), 2)
    total = round(subtotal - discount_total, 2)
    
    # Comprobar si ya está facturada
    invoice_id = sales[0].invoice_id
    invoice = None
    if invoice_id:
        inv_record = db.query(models.Invoice).filter(models.Invoice.id == invoice_id).first()
        if inv_record:
            invoice = {
                "id": inv_record.id,
                "uuid": inv_record.uuid,
                "created_at": inv_record.created_at,
                "status": inv_record.status
            }
            
    return {
        "ticket_id": ticket_id,
        "created_at": ref_sale.created_at,
        "payment_method": ref_sale.payment_method,
        "items": items,
        "subtotal": round((subtotal - discount_total) / tax_factor, 2),
        "discount": discount_total,
        "taxes": taxes_total,
        "total": total,
        "invoice": invoice,
        "is_cancelled": any(s.is_cancelled for s in sales)
    }

@router.post("/billing/invoice", response_model=schemas.InvoiceResponse)
def create_invoice(req: schemas.InvoiceCreateRequest, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    # 1. Obtener los registros de venta (sale_history) que se van a facturar
    sale_ids = []
    if req.sale_id:
        sale_ids.append(req.sale_id)
    if req.sale_ids:
        sale_ids.extend(req.sale_ids)
        
    if not sale_ids:
        raise HTTPException(status_code=400, detail="Debe especificar al menos un ID de venta para facturar")
        
    # Obtener las ventas físicas de la BD
    sales = db.query(models.SaleHistory).filter(models.SaleHistory.id.in_(sale_ids)).all()
    if not sales:
        raise HTTPException(status_code=404, detail="No se encontraron registros de venta para facturar")
        
    # Validar que ninguna venta esté ya facturada
    for s in sales:
        if s.invoice_id:
            raise HTTPException(status_code=400, detail=f"La venta con ID {s.id} ya se encuentra asociada a una factura activa.")
        if s.is_cancelled:
            raise HTTPException(status_code=400, detail=f"La venta con ID {s.id} está cancelada y no se puede facturar.")
            
    # 2. Resolver Perfil Fiscal
    billing_profile = None
    if req.billing_profile_id:
        profile_record = db.query(models.BillingProfile).filter(models.BillingProfile.id == req.billing_profile_id).first()
        if not profile_record:
            raise HTTPException(status_code=404, detail="Perfil de facturación no encontrado")
        billing_profile = {
            "rfc": profile_record.rfc,
            "razon_social": profile_record.razon_social,
            "regimen_fiscal": profile_record.regimen_fiscal,
            "codigo_postal": profile_record.codigo_postal,
            "correo": profile_record.correo
        }
    elif req.new_billing_profile:
        # Registrar perfil al vuelo
        profile_data = req.new_billing_profile
        existing = db.query(models.BillingProfile).filter(models.BillingProfile.rfc == profile_data.rfc.upper().strip()).first()
        if existing:
            # Reutilizar existente
            profile_record = existing
        else:
            profile_record = models.BillingProfile(
                rfc=profile_data.rfc.upper().strip(),
                razon_social=profile_data.razon_social.upper().strip(),
                regimen_fiscal=profile_data.regimen_fiscal,
                codigo_postal=profile_data.codigo_postal,
                correo=profile_data.correo.lower().strip()
            )
            db.add(profile_record)
            db.commit()
            db.refresh(profile_record)
            
        billing_profile = {
            "rfc": profile_record.rfc,
            "razon_social": profile_record.razon_social,
            "regimen_fiscal": profile_record.regimen_fiscal,
            "codigo_postal": profile_record.codigo_postal,
            "correo": profile_record.correo
        }
    else:
        # Asumir Público en General
        billing_profile = {
            "rfc": "XAXX010101000",
            "razon_social": "PÚBLICO EN GENERAL",
            "regimen_fiscal": "616",  # Sin obligaciones fiscales
            "codigo_postal": "64000",
            "correo": "ventas@abarrotesede.com"
        }
        
    # 3. Preparar lista de conceptos para el generador
    items = []
    subtotal = 0.0
    discount_total = 0.0
    
    for s in sales:
        prod = db.query(models.Product).filter(models.Product.id == s.product_id).first()
        name = prod.name if prod else "PRODUCTO DESCONOCIDO"
        sat_key = (prod.sat_key if prod else "01010101") or "01010101"
        sat_unit_key = (prod.sat_unit_key if prod else "H87") or "H87"
        
        price = s.price_sold or 0.0
        subtotal += price * s.quantity
        discount_total += s.discount or 0.0
        
        items.append({
            "name": name,
            "quantity": s.quantity,
            "price": price,
            "sat_key": sat_key,
            "sat_unit_key": sat_unit_key
        })
        
    total = round(subtotal - discount_total, 2)
    
    # 4. Generar metadatos del Timbre
    invoice_uuid = str(uuid.uuid4()).upper()
    timestamp_str = datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%S')
    
    # Directorio para almacenar los archivos locales
    invoices_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static", "invoices")
    os.makedirs(invoices_dir, exist_ok=True)
    
    xml_path = os.path.join(invoices_dir, f"{invoice_uuid}.xml")
    pdf_path = os.path.join(invoices_dir, f"{invoice_uuid}.pdf")
    
    # Generar archivos físicos con configuración dinámica
    settings = db.query(models.StoreSettings).filter(models.StoreSettings.id == 1).first()
    store_settings_dict = None
    if settings:
        store_settings_dict = {
            "store_name": settings.store_name,
            "rfc": settings.rfc,
            "phone": settings.phone,
            "email": settings.email,
            "address": settings.address,
            "tax_rate": settings.tax_rate,
            "ticket_footer": settings.ticket_footer
        }

    try:
        # Generar XML
        xml_content = facturacion.generate_cfdi_xml(
            sale_info={"payment_method": sales[0].payment_method, "discount": discount_total},
            billing_profile=billing_profile,
            items=items,
            invoice_uuid=invoice_uuid,
            timestamp_str=timestamp_str,
            store_settings=store_settings_dict
        )
        with open(xml_path, "w", encoding="utf-8") as f:
            f.write(xml_content)
            
        # Generar PDF
        facturacion.generate_cfdi_pdf(
            pdf_path=pdf_path,
            sale_info={"payment_method": sales[0].payment_method, "discount": discount_total},
            billing_profile=billing_profile,
            items=items,
            invoice_uuid=invoice_uuid,
            timestamp_str=timestamp_str,
            store_settings=store_settings_dict
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al generar los documentos fiscales: {str(e)}")
        
    # 5. Guardar en Base de Datos
    db_invoice = models.Invoice(
        tenant_id=current_user.tenant_id,
        uuid=invoice_uuid,
        monto_total=total,
        xml_url=f"/api/billing/invoices/{invoice_uuid}/xml",
        pdf_url=f"/api/billing/invoices/{invoice_uuid}/pdf",
        created_at=timestamp_str,
        status="active"
    )
    db.add(db_invoice)
    db.commit()
    db.refresh(db_invoice)
    
    # Vincular los SaleHistory
    for s in sales:
        s.invoice_id = db_invoice.id
    db.commit()
    
    return db_invoice

@router.get("/billing/invoices", response_model=List[schemas.InvoiceResponse])
def get_invoices(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    return db.query(models.Invoice).filter(models.Invoice.tenant_id == current_user.tenant_id).order_by(models.Invoice.id.desc()).all()

@router.get("/billing/invoices/{invoice_uuid}/xml")
def download_invoice_xml(invoice_uuid: str, db: Session = Depends(get_db)):
    invoice = db.query(models.Invoice).filter(models.Invoice.uuid == invoice_uuid).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Factura no encontrada")
        
    invoices_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static", "invoices")
    file_path = os.path.join(invoices_dir, f"{invoice_uuid}.xml")
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="El archivo XML de la factura no existe en el servidor")
        
    return FileResponse(file_path, media_type="application/xml", filename=f"CFDI_{invoice_uuid}.xml")

@router.get("/billing/invoices/{invoice_uuid}/pdf")
def download_invoice_pdf(invoice_uuid: str, db: Session = Depends(get_db)):
    invoice = db.query(models.Invoice).filter(models.Invoice.uuid == invoice_uuid).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Factura no encontrada")
        
    invoices_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static", "invoices")
    file_path = os.path.join(invoices_dir, f"{invoice_uuid}.pdf")
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="El archivo PDF de la factura no existe en el servidor")
        
    return FileResponse(file_path, media_type="application/pdf", filename=f"Factura_{invoice_uuid}.pdf")

@router.post("/billing/invoices/{invoice_id}/cancel", response_model=schemas.InvoiceResponse)
def cancel_invoice(invoice_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role not in ["admin", "supervisor"]:
        raise HTTPException(status_code=403, detail="No tienes permisos suficientes para cancelar facturas")
        
    invoice = db.query(models.Invoice).filter(
        models.Invoice.id == invoice_id,
        models.Invoice.tenant_id == current_user.tenant_id
    ).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Factura no encontrada")
        
    if invoice.status == "cancelled":
        raise HTTPException(status_code=400, detail="Esta factura ya se encuentra cancelada")
        
    # Cambiar estatus de la factura
    invoice.status = "cancelled"
    
    # Desvincular ventas asociadas (o dejarlas marcadas, pero para permitir volver a facturarlas, ponemos su invoice_id en NULL!)
    db.query(models.SaleHistory).filter(
        models.SaleHistory.invoice_id == invoice.id,
        models.SaleHistory.tenant_id == current_user.tenant_id
    ).update({models.SaleHistory.invoice_id: None})
    
    db.commit()
    db.refresh(invoice)
    return invoice


# --- PROVEEDORES (SUPPLIERS) ENDPOINTS ---

@router.get("/suppliers/", response_model=List[schemas.SupplierResponse])
def get_suppliers(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role not in ['admin', 'supervisor']:
        raise HTTPException(status_code=403, detail="No tienes permisos suficientes")
    return db.query(models.Supplier).filter(models.Supplier.tenant_id == current_user.tenant_id).order_by(models.Supplier.name).all()

@router.post("/suppliers/", response_model=schemas.SupplierResponse)
def create_supplier(supplier: schemas.SupplierCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role not in ['admin', 'supervisor']:
        raise HTTPException(status_code=403, detail="No tienes permisos suficientes")
    
    if supplier.rfc and supplier.rfc.strip():
        existing = db.query(models.Supplier).filter(
            models.Supplier.rfc == supplier.rfc.upper().strip(),
            models.Supplier.tenant_id == current_user.tenant_id
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Ya existe un proveedor con ese RFC")

    db_supplier = models.Supplier(
        tenant_id=current_user.tenant_id,
        name=supplier.name.strip(),
        rfc=supplier.rfc.upper().strip() if supplier.rfc else None,
        phone=supplier.phone.strip() if supplier.phone else None,
        email=supplier.email.lower().strip() if supplier.email else None,
        address=supplier.address.strip() if supplier.address else None,
        notes=supplier.notes.strip() if supplier.notes else None
    )
    db.add(db_supplier)
    db.commit()
    db.refresh(db_supplier)
    return db_supplier

@router.put("/suppliers/{supplier_id}", response_model=schemas.SupplierResponse)
def update_supplier(supplier_id: int, supplier: schemas.SupplierCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role not in ['admin', 'supervisor']:
        raise HTTPException(status_code=403, detail="No tienes permisos suficientes")
    
    db_supplier = db.query(models.Supplier).filter(
        models.Supplier.id == supplier_id,
        models.Supplier.tenant_id == current_user.tenant_id
    ).first()
    if not db_supplier:
        raise HTTPException(status_code=404, detail="Proveedor no encontrado")

    if supplier.rfc and supplier.rfc.strip():
        existing = db.query(models.Supplier).filter(
            models.Supplier.rfc == supplier.rfc.upper().strip(), 
            models.Supplier.id != supplier_id,
            models.Supplier.tenant_id == current_user.tenant_id
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Ya existe otro proveedor con ese RFC")

    db_supplier.name = supplier.name.strip()
    db_supplier.rfc = supplier.rfc.upper().strip() if supplier.rfc else None
    db_supplier.phone = supplier.phone.strip() if supplier.phone else None
    db_supplier.email = supplier.email.lower().strip() if supplier.email else None
    db_supplier.address = supplier.address.strip() if supplier.address else None
    db_supplier.notes = supplier.notes.strip() if supplier.notes else None

    db.commit()
    db.refresh(db_supplier)
    return db_supplier

@router.delete("/suppliers/{supplier_id}")
def delete_supplier(supplier_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role not in ['admin', 'supervisor']:
        raise HTTPException(status_code=403, detail="No tienes permisos suficientes")
    
    db_supplier = db.query(models.Supplier).filter(
        models.Supplier.id == supplier_id,
        models.Supplier.tenant_id == current_user.tenant_id
    ).first()
    if not db_supplier:
        raise HTTPException(status_code=404, detail="Proveedor no encontrado")
    
    associated_purchases = db.query(models.Purchase).filter(
        models.Purchase.supplier_id == supplier_id,
        models.Purchase.tenant_id == current_user.tenant_id
    ).first()
    if associated_purchases:
        raise HTTPException(
            status_code=400, 
            detail="No se puede eliminar el proveedor porque tiene compras/entradas asociadas. Considere editarlo o dejarlo inactivo."
        )

    db.delete(db_supplier)
    db.commit()
    return {"message": "Proveedor eliminado exitosamente"}


# --- COMPRAS / ENTRADAS (PURCHASES) ENDPOINTS ---

@router.get("/purchases/", response_model=List[schemas.PurchaseResponse])
def get_purchases(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role not in ['admin', 'supervisor']:
        raise HTTPException(status_code=403, detail="No tienes permisos suficientes")
        
    purchases = db.query(models.Purchase).filter(models.Purchase.tenant_id == current_user.tenant_id).order_by(models.Purchase.id.desc()).all()
    
    result = []
    for p in purchases:
        supplier_name = "Compra Directa / Sin Proveedor"
        if p.supplier_id:
            supplier = db.query(models.Supplier).filter(
                models.Supplier.id == p.supplier_id,
                models.Supplier.tenant_id == current_user.tenant_id
            ).first()
            if supplier:
                supplier_name = supplier.name
                
        user_name = "Desconocido"
        if p.user_id:
            user = db.query(models.User).filter(
                models.User.id == p.user_id,
                models.User.tenant_id == current_user.tenant_id
            ).first()
            if user:
                user_name = user.full_name
                
        items_res = []
        for item in p.items:
            prod = db.query(models.Product).filter(
                models.Product.id == item.product_id,
                models.Product.tenant_id == current_user.tenant_id
            ).first()
            prod_name = prod.name if prod else f"Producto ID {item.product_id}"
            if item.variant_id:
                var = db.query(models.ProductVariant).filter(
                    models.ProductVariant.id == item.variant_id,
                    models.ProductVariant.tenant_id == current_user.tenant_id
                ).first()
                if var:
                    prod_name += f" ({var.name})"
            
            items_res.append(
                schemas.PurchaseItemResponse(
                    id=item.id,
                    purchase_id=item.purchase_id,
                    product_id=item.product_id,
                    variant_id=item.variant_id,
                    quantity=item.quantity,
                    cost_price=item.cost_price,
                    price=item.price,
                    product_name=prod_name
                )
            )
            
        result.append(
            schemas.PurchaseResponse(
                id=p.id,
                supplier_id=p.supplier_id,
                invoice_number=p.invoice_number,
                total_cost=p.total_cost,
                created_at=p.created_at,
                notes=p.notes,
                user_id=p.user_id,
                items=items_res,
                supplier_name=supplier_name,
                user_name=user_name
            )
        )
    return result

@router.get("/purchases/{purchase_id}", response_model=schemas.PurchaseResponse)
def get_purchase_details(purchase_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role not in ['admin', 'supervisor']:
        raise HTTPException(status_code=403, detail="No tienes permisos suficientes")
        
    p = db.query(models.Purchase).filter(
        models.Purchase.id == purchase_id,
        models.Purchase.tenant_id == current_user.tenant_id
    ).first()
    if not p:
        raise HTTPException(status_code=404, detail="Compra no encontrada")
        
    supplier_name = "Compra Directa / Sin Proveedor"
    if p.supplier_id:
        supplier = db.query(models.Supplier).filter(
            models.Supplier.id == p.supplier_id,
            models.Supplier.tenant_id == current_user.tenant_id
        ).first()
        if supplier:
            supplier_name = supplier.name
            
    user_name = "Desconocido"
    if p.user_id:
        user = db.query(models.User).filter(
            models.User.id == p.user_id,
            models.User.tenant_id == current_user.tenant_id
        ).first()
        if user:
            user_name = user.full_name
            
    items_res = []
    for item in p.items:
        prod = db.query(models.Product).filter(
            models.Product.id == item.product_id,
            models.Product.tenant_id == current_user.tenant_id
        ).first()
        prod_name = prod.name if prod else f"Producto ID {item.product_id}"
        if item.variant_id:
            var = db.query(models.ProductVariant).filter(
                models.ProductVariant.id == item.variant_id,
                models.ProductVariant.tenant_id == current_user.tenant_id
            ).first()
            if var:
                prod_name += f" ({var.name})"
        
        items_res.append(
            schemas.PurchaseItemResponse(
                id=item.id,
                purchase_id=item.purchase_id,
                product_id=item.product_id,
                variant_id=item.variant_id,
                quantity=item.quantity,
                cost_price=item.cost_price,
                price=item.price,
                product_name=prod_name
            )
        )
        
    return schemas.PurchaseResponse(
        id=p.id,
        supplier_id=p.supplier_id,
        invoice_number=p.invoice_number,
        total_cost=p.total_cost,
        created_at=p.created_at,
        notes=p.notes,
        user_id=p.user_id,
        items=items_res,
        supplier_name=supplier_name,
        user_name=user_name
    )

@router.post("/purchases/", response_model=schemas.PurchaseResponse)
def create_purchase(purchase_data: schemas.PurchaseCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role not in ['admin', 'supervisor']:
        raise HTTPException(status_code=403, detail="No tienes permisos suficientes")
        
    if not purchase_data.items:
        raise HTTPException(status_code=400, detail="Debe añadir al menos un artículo a la compra.")

    try:
        now_str = datetime.utcnow().isoformat()
        
        db_purchase = models.Purchase(
            tenant_id=current_user.tenant_id,
            supplier_id=purchase_data.supplier_id,
            invoice_number=purchase_data.invoice_number.strip() if purchase_data.invoice_number else None,
            total_cost=0.0,
            created_at=now_str,
            notes=purchase_data.notes.strip() if purchase_data.notes else None,
            user_id=current_user.id
        )
        db.add(db_purchase)
        db.commit()
        db.refresh(db_purchase)
        
        total_cost = 0.0
        
        for item in purchase_data.items:
            product = db.query(models.Product).filter(
                models.Product.id == item.product_id,
                models.Product.tenant_id == current_user.tenant_id
            ).with_for_update().first()
            if not product:
                raise HTTPException(status_code=404, detail=f"El producto con ID {item.product_id} no existe.")
            
            if item.variant_id:
                variant = db.query(models.ProductVariant).filter(
                    models.ProductVariant.id == item.variant_id,
                    models.ProductVariant.product_id == item.product_id,
                    models.ProductVariant.tenant_id == current_user.tenant_id
                ).with_for_update().first()
                if not variant:
                    raise HTTPException(
                        status_code=404, 
                        detail=f"La variante ID {item.variant_id} para el producto ID {item.product_id} no existe."
                    )
                
                variant.quantity += item.quantity
                variant.cost_price = item.cost_price
                if item.price is not None and item.price > 0:
                    variant.price = item.price
                
                product.quantity += item.quantity
            else:
                product.quantity += item.quantity
                product.cost_price = item.cost_price
                if item.price is not None and item.price > 0:
                    product.price = item.price
                    
            item_cost = item.cost_price * item.quantity
            total_cost += item_cost
            
            db_item = models.PurchaseItem(
                purchase_id=db_purchase.id,
                product_id=item.product_id,
                variant_id=item.variant_id,
                quantity=item.quantity,
                cost_price=item.cost_price,
                price=item.price
            )
            db.add(db_item)
            
        db_purchase.total_cost = total_cost
        db.commit()
        db.refresh(db_purchase)
        
        return get_purchase_details(purchase_id=db_purchase.id, db=db, current_user=current_user)
        
    except Exception as e:
        db.rollback()
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=400, detail=f"Error al procesar la compra: {str(e)}")


# --- AJUSTES DE TIENDA (STORE SETTINGS) ENDPOINTS ---

@router.get("/settings", response_model=schemas.StoreSettingsResponse)
def get_store_settings(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    settings = db.query(models.StoreSettings).filter(models.StoreSettings.tenant_id == current_user.tenant_id).first()
    if not settings:
        settings = models.StoreSettings(
            tenant_id=current_user.tenant_id,
            store_name="ABARROTES ED & E",
            rfc="AED180425EE3",
            phone="8112345678",
            email="ventas@abarrotesede.com",
            address="Av. Constitución #450, Monterrey, N.L. C.P. 64000",
            tax_rate=16.0,
            ticket_footer="¡Gracias por su compra!"
        )
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings

@router.put("/settings", response_model=schemas.StoreSettingsResponse)
def update_store_settings(settings_data: schemas.StoreSettingsCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role not in ['admin', 'supervisor']:
        raise HTTPException(status_code=403, detail="No tienes permisos suficientes para cambiar la configuración.")
    
    settings = db.query(models.StoreSettings).filter(models.StoreSettings.tenant_id == current_user.tenant_id).first()
    if not settings:
        settings = models.StoreSettings(tenant_id=current_user.tenant_id)
        db.add(settings)
        
    for key, value in settings_data.dict().items():
        setattr(settings, key, value)
        
    db.commit()
    db.refresh(settings)
    return settings


# --- CLIENTES Y CRÉDITOS (CUSTOMERS & CREDIT) ENDPOINTS ---

@router.get("/customers", response_model=List[schemas.CustomerResponse])
def get_customers(q: Optional[str] = None, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    query = db.query(models.Customer).filter(models.Customer.tenant_id == current_user.tenant_id)
    if q:
        query = query.filter(
            (models.Customer.name.ilike(f"%{q}%")) |
            (models.Customer.phone.ilike(f"%{q}%"))
        )
    return query.order_by(models.Customer.name).all()

@router.post("/customers", response_model=schemas.CustomerResponse)
def create_customer(customer_data: schemas.CustomerCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    existing = db.query(models.Customer).filter(
        models.Customer.name.ilike(customer_data.name.strip()),
        models.Customer.tenant_id == current_user.tenant_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Ya existe un cliente con ese nombre.")
        
    db_customer = models.Customer(
        tenant_id=current_user.tenant_id,
        name=customer_data.name.strip(),
        phone=customer_data.phone.strip() if customer_data.phone else None,
        email=customer_data.email.lower().strip() if customer_data.email else None,
        credit_limit=customer_data.credit_limit,
        current_balance=0.0
    )
    db.add(db_customer)
    db.commit()
    db.refresh(db_customer)
    return db_customer

@router.put("/customers/{customer_id}", response_model=schemas.CustomerResponse)
def update_customer(customer_id: int, customer_data: schemas.CustomerCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    db_customer = db.query(models.Customer).filter(
        models.Customer.id == customer_id,
        models.Customer.tenant_id == current_user.tenant_id
    ).first()
    if not db_customer:
        raise HTTPException(status_code=404, detail="Cliente no encontrado.")
        
    existing = db.query(models.Customer).filter(
        models.Customer.name.ilike(customer_data.name.strip()), 
        models.Customer.id != customer_id,
        models.Customer.tenant_id == current_user.tenant_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Ya existe otro cliente con ese nombre.")
        
    db_customer.name = customer_data.name.strip()
    db_customer.phone = customer_data.phone.strip() if customer_data.phone else None
    db_customer.email = customer_data.email.lower().strip() if customer_data.email else None
    db_customer.credit_limit = customer_data.credit_limit
    
    db.commit()
    db.refresh(db_customer)
    return db_customer

@router.delete("/customers/{customer_id}")
def delete_customer(customer_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role not in ['admin', 'supervisor']:
        raise HTTPException(status_code=403, detail="No tienes permisos suficientes para eliminar clientes.")
        
    db_customer = db.query(models.Customer).filter(
        models.Customer.id == customer_id,
        models.Customer.tenant_id == current_user.tenant_id
    ).first()
    if not db_customer:
        raise HTTPException(status_code=404, detail="Cliente no encontrado.")
        
    if db_customer.current_balance > 0:
        raise HTTPException(status_code=400, detail="No se puede eliminar el cliente porque tiene un saldo deudor pendiente.")
        
    db.delete(db_customer)
    db.commit()
    return {"message": "Cliente eliminado exitosamente"}

@router.post("/customers/{customer_id}/pay", response_model=schemas.CustomerPaymentResponse)
def register_customer_payment(customer_id: int, payment_data: schemas.CustomerPaymentCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    shift = db.query(models.Shift).filter(
        models.Shift.user_id == current_user.id,
        models.Shift.tenant_id == current_user.tenant_id,
        models.Shift.status == "open"
    ).first()
    if not shift and current_user.role != 'admin':
        raise HTTPException(status_code=400, detail="Debe tener un turno de caja abierto para registrar un abono.")
        
    customer = db.query(models.Customer).filter(
        models.Customer.id == customer_id,
        models.Customer.tenant_id == current_user.tenant_id
    ).with_for_update().first()
    if not customer:
        raise HTTPException(status_code=404, detail="Cliente no encontrado.")
        
    if payment_data.amount <= 0:
        raise HTTPException(status_code=400, detail="El monto del abono debe ser mayor a 0.")
        
    db_payment = models.CustomerPayment(
        tenant_id=current_user.tenant_id,
        customer_id=customer_id,
        shift_id=shift.id if shift else None,
        user_id=current_user.id,
        amount=payment_data.amount,
        created_at=datetime.utcnow().isoformat(),
        notes=payment_data.notes.strip() if payment_data.notes else None
    )
    
    customer.current_balance -= payment_data.amount
    
    if shift:
        db_mov = models.CashMovement(
            shift_id=shift.id,
            type="entrada",
            amount=payment_data.amount,
            reason=f"Abono de cliente: {customer.name}",
            created_at=datetime.utcnow().isoformat()
        )
        shift.final_cash_expected += payment_data.amount
        db.add(db_mov)
        
    db.add(db_payment)
    db.commit()
    db.refresh(db_payment)
    return db_payment

@router.get("/customers/{customer_id}/history")
def get_customer_history(customer_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    customer = db.query(models.Customer).filter(
        models.Customer.id == customer_id,
        models.Customer.tenant_id == current_user.tenant_id
    ).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Cliente no encontrado.")
        
    sales = db.query(
        models.SaleHistory.id,
        models.SaleHistory.created_at,
        models.SaleHistory.payment_method,
        models.SaleHistory.price_sold,
        models.SaleHistory.quantity,
        models.SaleHistory.discount,
        models.Product.name.label("product_name")
    ).join(
        models.Product, models.Product.id == models.SaleHistory.product_id
    ).filter(
        models.SaleHistory.customer_id == customer_id,
        models.SaleHistory.tenant_id == current_user.tenant_id
    ).all()
    
    payments = db.query(models.CustomerPayment).filter(
        models.CustomerPayment.customer_id == customer_id,
        models.CustomerPayment.tenant_id == current_user.tenant_id
    ).all()
    
    history = []
    sales_by_ticket = {}
    for s in sales:
        total_item = (s.price_sold * s.quantity) - s.discount
        date_key = s.created_at
        if date_key not in sales_by_ticket:
            sales_by_ticket[date_key] = {
                "id": s.id,
                "type": "compra",
                "payment_method": s.payment_method,
                "created_at": s.created_at,
                "amount": 0.0,
                "details": []
            }
        sales_by_ticket[date_key]["amount"] += total_item
        sales_by_ticket[date_key]["details"].append(f"{s.quantity}x {s.product_name}")
        
    for ticket in sales_by_ticket.values():
        history.append({
            "id": ticket["id"],
            "type": "compra_credito" if ticket["payment_method"] == "credito" else "compra_asociada",
            "description": ", ".join(ticket["details"]),
            "amount": round(ticket["amount"], 2),
            "created_at": ticket["created_at"]
        })
        
    for p in payments:
        history.append({
            "id": p.id,
            "type": "abono",
            "description": p.notes or "Abono a cuenta",
            "amount": p.amount,
            "created_at": p.created_at
        })
        
    history = sorted(history, key=lambda x: x["created_at"], reverse=True)
    return {
        "customer": {
            "id": customer.id,
            "name": customer.name,
            "current_balance": customer.current_balance,
            "credit_limit": customer.credit_limit
        },
        "history": history
    }


# --- BACKUP & SECURITY ENDPOINTS ---
import json
import io
from fastapi.responses import StreamingResponse
from fastapi import UploadFile, File
from sqlalchemy import text

@router.get("/backup/export")
def export_backup_database(format: str = "json", db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="No tienes permisos para exportar respaldos.")
        
    def serialize_table(model):
        if hasattr(model, "tenant_id"):
            rows = db.query(model).filter(model.tenant_id == current_user.tenant_id).all()
        elif model.__tablename__ == "purchase_items":
            rows = db.query(models.PurchaseItem).join(models.Purchase).filter(models.Purchase.tenant_id == current_user.tenant_id).all()
        else:
            rows = db.query(model).all()
            
        result = []
        for row in rows:
            row_dict = {}
            for key in row.__mapper__.columns.keys():
                val = getattr(row, key)
                if val is not None and hasattr(val, "isoformat"):
                    val = val.isoformat()
                row_dict[key] = val
            result.append(row_dict)
        return result

    if format == "json":
        backup_data = {
            "store_settings": serialize_table(models.StoreSettings),
            "users": serialize_table(models.User),
            "suppliers": serialize_table(models.Supplier),
            "billing_profiles": serialize_table(models.BillingProfile),
            "customers": serialize_table(models.Customer),
            "products": serialize_table(models.Product),
            "product_variants": serialize_table(models.ProductVariant),
            "invoices": serialize_table(models.Invoice),
            "shifts": serialize_table(models.Shift),
            "customer_payments": serialize_table(models.CustomerPayment),
            "purchases": serialize_table(models.Purchase),
            "purchase_items": serialize_table(models.PurchaseItem),
            "cash_movements": serialize_table(models.CashMovement),
            "sales_history": serialize_table(models.SaleHistory),
            "product_returns": serialize_table(models.ProductReturn),
            "notifications": serialize_table(models.Notification)
        }
        json_str = json.dumps(backup_data, indent=2, ensure_ascii=False)
        stream = io.BytesIO(json_str.encode('utf-8'))
        
        headers = {
            'Content-Disposition': f'attachment; filename="tienda_backup_{datetime.now().strftime("%Y-%m-%d")}.json"'
        }
        return StreamingResponse(stream, media_type="application/json", headers=headers)
        
    elif format == "sql":
        sql_lines = []
        sql_lines.append("-- TIENDA DATABASE BACKUP SQL DUMP")
        sql_lines.append(f"-- Generated: {datetime.now().isoformat()}")
        sql_lines.append(f"-- Tenant: {current_user.tenant_id}")
        sql_lines.append("")
        
        tables = [
            ("store_settings", models.StoreSettings),
            ("users", models.User),
            ("suppliers", models.Supplier),
            ("billing_profiles", models.BillingProfile),
            ("customers", models.Customer),
            ("products", models.Product),
            ("product_variants", models.ProductVariant),
            ("invoices", models.Invoice),
            ("shifts", models.Shift),
            ("customer_payments", models.CustomerPayment),
            ("purchases", models.Purchase),
            ("purchase_items", models.PurchaseItem),
            ("cash_movements", models.CashMovement),
            ("sales_history", models.SaleHistory),
            ("product_returns", models.ProductReturn),
            ("notifications", models.Notification)
        ]
        
        for table_name, model in tables:
            if hasattr(model, "tenant_id"):
                rows = db.query(model).filter(model.tenant_id == current_user.tenant_id).all()
            elif model.__tablename__ == "purchase_items":
                rows = db.query(models.PurchaseItem).join(models.Purchase).filter(models.Purchase.tenant_id == current_user.tenant_id).all()
            else:
                rows = db.query(model).all()
                
            if not rows:
                continue
            sql_lines.append(f"\n-- Data for table {table_name}")
            
            columns = model.__mapper__.columns.keys()
            cols_str = ", ".join(columns)
            
            for row in rows:
                vals = []
                for col in columns:
                    val = getattr(row, col)
                    if val is None:
                        vals.append("NULL")
                    elif isinstance(val, (int, float)):
                        vals.append(str(val))
                    elif isinstance(val, bool):
                        vals.append("TRUE" if val else "FALSE")
                    else:
                        escaped_str = str(val).replace("'", "''")
                        vals.append(f"'{escaped_str}'")
                vals_str = ", ".join(vals)
                sql_lines.append(f"INSERT INTO {table_name} ({cols_str}) VALUES ({vals_str});")
            
        sql_str = "\n".join(sql_lines)
        stream = io.BytesIO(sql_str.encode('utf-8'))
        headers = {
            'Content-Disposition': f'attachment; filename="tienda_backup_{datetime.now().strftime("%Y-%m-%d")}.sql"'
        }
        return StreamingResponse(stream, media_type="application/sql", headers=headers)
        
    elif format == "excel":
        import openpyxl
        from openpyxl.styles import Font, Alignment, PatternFill, Border, Side
        
        wb = openpyxl.Workbook()
        default_sheet = wb.active
        wb.remove(default_sheet)
        
        tables = [
            ("Ajustes", models.StoreSettings),
            ("Usuarios", models.User),
            ("Proveedores", models.Supplier),
            ("Perfiles_Facturacion", models.BillingProfile),
            ("Clientes", models.Customer),
            ("Productos", models.Product),
            ("Variantes_Producto", models.ProductVariant),
            ("Facturas", models.Invoice),
            ("Turnos_Caja", models.Shift),
            ("Abonos_Clientes", models.CustomerPayment),
            ("Compras", models.Purchase),
            ("Items_Compra", models.PurchaseItem),
            ("Movimientos_Caja", models.CashMovement),
            ("Historial_Ventas", models.SaleHistory),
            ("Devoluciones", models.ProductReturn)
        ]
        
        title_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
        cell_font = Font(name="Calibri", size=10)
        header_fill = PatternFill(start_color="064E3B", end_color="064E3B", fill_type="solid")
        align_center = Alignment(horizontal="center", vertical="center")
        align_left = Alignment(horizontal="left", vertical="center")
        
        thin_side = Side(border_style="thin", color="D1D5DB")
        thin_border = Border(left=thin_side, right=thin_side, top=thin_side, bottom=thin_side)
        
        for sheet_name, model in tables:
            ws = wb.create_sheet(title=sheet_name)
            if hasattr(model, "tenant_id"):
                rows = db.query(model).filter(model.tenant_id == current_user.tenant_id).all()
            elif model.__tablename__ == "purchase_items":
                rows = db.query(models.PurchaseItem).join(models.Purchase).filter(models.Purchase.tenant_id == current_user.tenant_id).all()
            else:
                rows = db.query(model).all()
                
            columns = model.__mapper__.columns.keys()
            
            for col_idx, col_name in enumerate(columns, 1):
                cell = ws.cell(row=1, column=col_idx, value=col_name.upper())
                cell.font = title_font
                cell.fill = header_fill
                cell.alignment = align_center
                cell.border = thin_border
                
            for row_idx, row in enumerate(rows, 2):
                for col_idx, col_name in enumerate(columns, 1):
                    val = getattr(row, col_name)
                    if isinstance(val, bool):
                        val = "SÍ" if val else "NO"
                    cell = ws.cell(row=row_idx, column=col_idx, value=val)
                    cell.font = cell_font
                    cell.border = thin_border
                    if isinstance(val, (int, float)):
                        cell.alignment = Alignment(horizontal="right", vertical="center")
                    else:
                        cell.alignment = align_left
                        
            for col in ws.columns:
                max_len = max(len(str(cell.value or '')) for cell in col)
                col_letter = openpyxl.utils.get_column_letter(col[0].column)
                ws.column_dimensions[col_letter].width = max(max_len + 3, 10)
                
        output = io.BytesIO()
        wb.save(output)
        output.seek(0)
        
        headers = {
            'Content-Disposition': f'attachment; filename="tienda_backup_{datetime.now().strftime("%Y-%m-%d")}.xlsx"'
        }
        return StreamingResponse(output, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", headers=headers)
        
    else:
        raise HTTPException(status_code=400, detail="Formato de respaldo no soportado.")


@router.post("/backup/import")
def import_backup_database(file: UploadFile = File(...), db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="No tienes permisos para restaurar respaldos.")
        
    try:
        content = file.file.read()
        data = json.loads(content.decode('utf-8'))
    except Exception as e:
        raise HTTPException(status_code=400, detail="El archivo no es un JSON válido o tiene codificación incorrecta.")
        
    tables = [
        ("product_returns", models.ProductReturn),
        ("sales_history", models.SaleHistory),
        ("cash_movements", models.CashMovement),
        ("customer_payments", models.CustomerPayment),
        ("purchase_items", models.PurchaseItem),
        ("purchases", models.Purchase),
        ("invoices", models.Invoice),
        ("shifts", models.Shift),
        ("product_variants", models.ProductVariant),
        ("products", models.Product),
        ("billing_profiles", models.BillingProfile),
        ("customers", models.Customer),
        ("suppliers", models.Supplier),
        ("users", models.User),
        ("store_settings", models.StoreSettings),
        ("notifications", models.Notification)
    ]
    
    try:
        # Delete rows scoped to current tenant
        for name, model in tables:
            if hasattr(model, "tenant_id"):
                db.query(model).filter(model.tenant_id == current_user.tenant_id).delete()
            elif model.__tablename__ == "purchase_items":
                # Eliminar items de compras asociadas al tenant
                purchases_subquery = db.query(models.Purchase.id).filter(models.Purchase.tenant_id == current_user.tenant_id).subquery()
                db.query(models.PurchaseItem).filter(models.PurchaseItem.purchase_id.in_(purchases_subquery)).delete(synchronize_session=False)
        db.commit()
        
        # Insert rows, overriding tenant_id to prevent hijacking
        for name, model in reversed(tables):
            rows = data.get(name, [])
            valid_keys = model.__mapper__.columns.keys()
            for row_dict in rows:
                filtered_dict = {k: v for k, v in row_dict.items() if k in valid_keys}
                if "tenant_id" in valid_keys:
                    filtered_dict["tenant_id"] = current_user.tenant_id
                instance = model(**filtered_dict)
                db.add(instance)
            db.commit()
            
            # Sincronizar secuencias
            try:
                db.execute(text(f"SELECT setval(pg_get_serial_sequence('{model.__tablename__}', 'id'), COALESCE((SELECT MAX(id)+1 FROM {model.__tablename__}), 1), false);"))
                db.commit()
            except Exception as seq_err:
                db.rollback()
                
        return {"status": "success", "message": "Base de datos restaurada correctamente."}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error durante la restauración: {str(e)}")


@router.get("/reports/dashboard-details")
def get_dashboard_details(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role not in ["admin", "supervisor"]:
        raise HTTPException(status_code=403, detail="No tienes permisos suficientes.")
        
    from datetime import datetime as dt, timedelta
    from sqlalchemy import func
    
    # 1. Active credit balance (total owed by customers)
    total_owed = db.query(func.coalesce(func.sum(models.Customer.current_balance), 0.0)).filter(models.Customer.tenant_id == current_user.tenant_id).scalar()
    
    # 2. Setup dates
    local_now = dt.now()
    
    today_start = local_now.replace(hour=0, minute=0, second=0, microsecond=0)
    yesterday_start = today_start - timedelta(days=1)
    
    # Month boundaries
    this_month_start = local_now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    last_month_end = this_month_start - timedelta(seconds=1)
    last_month_start = last_month_end.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    
    # Query non-cancelled sales
    sales_query = db.query(models.SaleHistory).filter(
        models.SaleHistory.is_cancelled == False,
        models.SaleHistory.tenant_id == current_user.tenant_id
    )
    
    def calculate_sales_metrics(query_obj, start_dt, end_dt):
        sales_in_range = query_obj.filter(
            models.SaleHistory.created_at >= start_dt.isoformat(),
            models.SaleHistory.created_at <= end_dt.isoformat()
        ).all()
        
        revenue = 0.0
        cost = 0.0
        for s in sales_in_range:
            price = s.price_sold
            cost_val = s.cost_price_sold if s.cost_price_sold is not None else 0.0
            revenue += (price * s.quantity) - s.discount
            cost += cost_val * s.quantity
            
        profit = revenue - cost
        return revenue, profit
        
    # Sales/Profit for Today
    today_revenue, today_profit = calculate_sales_metrics(sales_query, today_start, local_now)
    # Sales/Profit for Yesterday
    yesterday_revenue, yesterday_profit = calculate_sales_metrics(sales_query, yesterday_start, today_start - timedelta(seconds=1))
    
    # Sales/Profit for This Month
    this_month_revenue, this_month_profit = calculate_sales_metrics(sales_query, this_month_start, local_now)
    # Sales/Profit for Last Month
    last_month_revenue, last_month_profit = calculate_sales_metrics(sales_query, last_month_start, last_month_end)
    
    # 3. 30-day time-series
    time_series = []
    for i in range(29, -1, -1):
        day_start = today_start - timedelta(days=i)
        day_end = day_start + timedelta(hours=23, minutes=59, seconds=59)
        
        day_rev, day_prof = calculate_sales_metrics(sales_query, day_start, day_end)
        time_series.append({
            "date": day_start.strftime("%Y-%m-%d"),
            "display_date": day_start.strftime("%d/%m"),
            "Ventas": round(day_rev, 2),
            "Utilidad": round(day_prof, 2)
        })
        
    # 4. Payment method breakdown (last 30 days)
    last_30_days_start = today_start - timedelta(days=30)
    sales_30_days = sales_query.filter(
        models.SaleHistory.created_at >= last_30_days_start.isoformat()
    ).all()
    
    pm_cash = 0.0
    pm_card = 0.0
    pm_credit = 0.0
    
    for s in sales_30_days:
        total = (s.price_sold * s.quantity) - s.discount
        if s.payment_method == "efectivo":
            pm_cash += total
        elif s.payment_method == "tarjeta":
            pm_card += total
        elif s.payment_method == "credito":
            pm_credit += total
        elif s.payment_method == "mixto":
            pm_cash += s.cash_amount
            pm_card += s.card_amount
            
    pm_total = pm_cash + pm_card + pm_credit
    
    return {
        "today": {
            "revenue": round(today_revenue, 2),
            "profit": round(today_profit, 2),
            "yesterday_revenue": round(yesterday_revenue, 2),
            "yesterday_profit": round(yesterday_profit, 2)
        },
        "month": {
            "revenue": round(this_month_revenue, 2),
            "profit": round(this_month_profit, 2),
            "last_month_revenue": round(last_month_revenue, 2),
            "last_month_profit": round(last_month_profit, 2)
        },
        "credit": {
            "total_owed": round(total_owed, 2)
        },
        "time_series": time_series,
        "payment_methods": {
            "cash": round(pm_cash, 2),
            "card": round(pm_card, 2),
            "credit": round(pm_credit, 2),
            "total": round(pm_total, 2)
        }
    }


# ==========================================
# WEBHOOK DE WHATSAPP
# ==========================================

@router.get("/webhook/whatsapp")
def verificar_webhook(request: Request):
    """
    Meta llama a esta ruta GET para validar que tu servidor está en línea
    y que tienes el token secreto correcto.
    """
    params = request.query_params
    token_verificacion = "MiTokenSecretoDeWhatsApp123"  # Este token lo defines tú en el portal de Meta
    
    hub_mode = params.get("hub.mode")
    hub_verify_token = params.get("hub.verify_token")
    hub_challenge = params.get("hub.challenge")
    
    if hub_mode == "subscribe" and hub_verify_token == token_verificacion:
        # Debemos responder con el challenge en texto plano
        return Response(content=hub_challenge, media_type="text/plain")
        
    return Response(content="Token de verificación incorrecto", status_code=403)


@router.post("/webhook/whatsapp")
async def recibir_mensaje_whatsapp(request: Request, db: Session = Depends(get_db)):
    """
    Aquí llegarán los mensajes reales de WhatsApp enviados por los usuarios.
    Soporta tanto la API oficial de Meta (Cloud API) como el Easy API de OpenWA.
    Detecta el patrón 'agregar producto: NOMBRE, precio: X, cantidad: Y'
    y lo registra en la base de datos.
    """
    try:
        payload = await request.json()
        print("Mensaje de WhatsApp recibido:", payload)
        
        message_text = None
        sender = None
        is_openwa = False
        
        # 1. Detectar si el payload es de OpenWA Easy API
        if "event" in payload and payload["event"] == "message" and "data" in payload:
            data = payload["data"]
            message_text = data.get("body")
            sender = data.get("from")
            is_openwa = True
            print(f"Mensaje de OpenWA de {sender}: {message_text}")
            
        # 2. Detectar si es de la API oficial de Meta (Cloud API)
        elif "entry" in payload:
            for entry in payload["entry"]:
                for change in entry.get("changes", []):
                    value = change.get("value", {})
                    if "messages" in value:
                        for message in value["messages"]:
                            if "text" in message:
                                message_text = message["text"]["body"]
                                sender = message.get("from")
                                print(f"Mensaje de Meta de {sender}: {message_text}")
                                
        if message_text:
            text_lower = message_text.lower().strip()
            
            if text_lower.startswith("agregar producto:"):
                # Extraer los datos del producto
                # Formato esperado: "agregar producto: Nombre, precio: X, cantidad: Y"
                datos_str = message_text[len("agregar producto:"):].strip()
                
                # Separar por comas
                partes = [p.strip() for p in datos_str.split(",")]
                if len(partes) >= 1:
                    nombre = partes[0]
                    precio = 0.0
                    cantidad = 0
                    
                    # Buscar precio y cantidad en las partes restantes
                    for parte in partes[1:]:
                        parte_lower = parte.lower()
                        if parte_lower.startswith("precio:"):
                            try:
                                precio = float(parte_lower.replace("precio:", "").strip())
                            except ValueError:
                                pass
                        elif parte_lower.startswith("cantidad:") or parte_lower.startswith("stock:"):
                            try:
                                cantidad = int(parte_lower.replace("cantidad:", "").replace("stock:", "").strip())
                            except ValueError:
                                pass
                    
                    # Registrar en la base de datos
                    nuevo_prod = models.Product(
                        name=nombre,
                        price=precio,
                        quantity=cantidad,
                        sat_key="01010101",
                        sat_unit_key="H87"
                    )
                    db.add(nuevo_prod)
                    db.commit()
                    db.refresh(nuevo_prod)
                    
                    success_msg = f"Producto '{nombre}' agregado exitosamente via WhatsApp con precio={precio} y cantidad={cantidad}."
                    print(success_msg)
                    
                    # Si viene de OpenWA, enviamos confirmación automática
                    if is_openwa and sender:
                        send_whatsapp_message(
                            sender, 
                            f"✅ *Producto registrado con éxito*\n\n"
                            f"📦 *Nombre:* {nombre}\n"
                            f"💵 *Precio:* ${precio:,.2f}\n"
                            f"🔢 *Stock inicial:* {cantidad}"
                        )
                        
    except Exception as e:
        print(f"Error procesando el Webhook de WhatsApp: {e}")
        
    return {"status": "recibido"}


# ==========================================
# ENVÍO DE TICKETS Y FACTURAS POR WHATSAPP
# ==========================================

@router.post("/sales/{sale_id}/whatsapp")
def send_sale_ticket_whatsapp(
    sale_id: int,
    req_body: schemas.WhatsAppSendRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Formatea el ticket de compra y lo envía al número de WhatsApp especificado usando OpenWA.
    """
    ref_sale = db.query(models.SaleHistory).filter(models.SaleHistory.id == sale_id).first()
    if not ref_sale:
        raise HTTPException(status_code=404, detail="Venta no encontrada")
        
    sales = db.query(
        models.SaleHistory.id,
        models.SaleHistory.product_id,
        models.SaleHistory.variant_id,
        models.SaleHistory.quantity,
        models.SaleHistory.price_sold,
        models.SaleHistory.discount,
        models.SaleHistory.created_at,
        models.SaleHistory.payment_method,
        models.SaleHistory.cash_amount,
        models.SaleHistory.card_amount,
        models.Product.name.label("product_name")
    ).join(
        models.Product, models.Product.id == models.SaleHistory.product_id
    ).filter(
        models.SaleHistory.created_at == ref_sale.created_at
    ).all()

    if not sales:
        raise HTTPException(status_code=404, detail="No se encontraron artículos para esta venta")

    settings = db.query(models.StoreSettings).filter(models.StoreSettings.id == 1).first()
    store_settings_dict = {
        "store_name": settings.store_name if settings else "ABARROTES ED & E",
        "address": settings.address if settings else "",
        "phone": settings.phone if settings else "",
        "ticket_footer": settings.ticket_footer if settings else "¡Gracias por su compra!"
    }

    customer_name = None
    if ref_sale.customer_id:
        cust = db.query(models.Customer).filter(models.Customer.id == ref_sale.customer_id).first()
        if cust:
            customer_name = cust.name

    cashier_name = "N/A"
    if ref_sale.user_id:
        cashier = db.query(models.User).filter(models.User.id == ref_sale.user_id).first()
        if cashier:
            cashier_name = cashier.full_name

    items = []
    subtotal = 0.0
    discount_total = 0.0

    for s in sales:
        price = s.price_sold or 0.0
        item_subtotal = price * s.quantity
        subtotal += item_subtotal
        discount_total += s.discount or 0.0
        items.append({
            "product_name": s.product_name,
            "quantity": s.quantity,
            "price": price,
            "discount": s.discount
        })

    tax_rate = settings.tax_rate if settings else 16.0
    tax_factor = 1 + (tax_rate / 100)
    total = round(subtotal - discount_total, 2)
    subtotal_no_tax = round((subtotal - discount_total) / tax_factor, 2)

    cash_paid = sum(s.cash_amount for s in sales)
    card_paid = sum(s.card_amount for s in sales)

    sale_data = {
        "id": sale_id,
        "created_at": ref_sale.created_at,
        "cashier": cashier_name,
        "customer_name": customer_name,
        "items": items,
        "subtotal": subtotal_no_tax,
        "discount": discount_total,
        "total": total,
        "payment_method": ref_sale.payment_method,
        "cash_amount": cash_paid,
        "card_amount": card_paid
    }

    msg = format_ticket_message(sale_data, store_settings_dict)
    success = send_whatsapp_message(req_body.phone_number, msg)
    if not success:
        raise HTTPException(status_code=500, detail="No se pudo enviar el ticket por WhatsApp. Verifique la conexión con OpenWA.")
        
    return {"status": "success", "message": "Ticket enviado exitosamente por WhatsApp."}


@router.post("/billing/invoices/{invoice_id}/whatsapp")
def send_invoice_whatsapp(
    invoice_id: int,
    req_body: schemas.WhatsAppSendRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Envía los detalles de la factura y los enlaces de descarga PDF/XML vía WhatsApp usando OpenWA.
    """
    inv = db.query(models.Invoice).filter(models.Invoice.id == invoice_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Factura no encontrada")

    settings = db.query(models.StoreSettings).filter(models.StoreSettings.id == 1).first()
    store_name = settings.store_name if settings else "ABARROTES ED & E"

    base_url = str(request.base_url).rstrip("/")
    # Construir enlaces de descarga basados en el host actual
    xml_link = f"{base_url}/api/billing/invoices/{inv.uuid}/xml"
    pdf_link = f"{base_url}/api/billing/invoices/{inv.uuid}/pdf"

    msg_lines = [
        "🧾 *FACTURA ELECTRÓNICA CFDI 4.0*",
        f"🏢 *{store_name}*",
        "-----------------------------------------",
        f"🆔 *Folio Fiscal (UUID):*",
        f"_{inv.uuid}_",
        f"📅 *Fecha Certificación:* {inv.created_at}",
        f"💵 *Monto Total:* ${inv.monto_total:,.2f} MXN",
        f"📊 *Estado:* {'Vigente' if inv.status == 'active' else 'Cancelado'}",
        "-----------------------------------------",
        "📄 *Descargar PDF:*",
        pdf_link,
        "",
        "🔗 *Descargar XML:*",
        xml_link,
        "-----------------------------------------",
        "¡Gracias por su preferencia!"
    ]

    msg = "\n".join(msg_lines)
    success = send_whatsapp_message(req_body.phone_number, msg)
    if not success:
        raise HTTPException(status_code=500, detail="No se pudo enviar la factura por WhatsApp.")
        
    return {"status": "success", "message": "Factura enviada exitosamente por WhatsApp."}

# --- SUPERADMIN SAAS CONTROL PANEL ENDPOINTS ---

def check_superadmin_privilege(current_user: models.User):
    # Verify current_user belongs to tenant_id 1 (creator store) and has admin role
    if current_user.tenant_id != 1 or current_user.role != 'admin':
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acceso denegado. Se requieren privilegios de Superadministrador del SaaS."
        )

@router.get("/superadmin/tenants", response_model=List[schemas.SuperAdminTenantResponse])
def superadmin_get_tenants(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    check_superadmin_privilege(current_user)
    
    tenants = db.query(models.Tenant).all()
    results = []
    
    for t in tenants:
        # Get admin user info for this tenant
        admin_user = db.query(models.User).filter(
            models.User.tenant_id == t.id,
            models.User.role == 'admin'
        ).first()
        
        # Calculate counts
        product_count = db.query(models.Product).filter(models.Product.tenant_id == t.id).count()
        sale_count = db.query(models.SaleHistory).filter(models.SaleHistory.tenant_id == t.id).count()
        
        results.append({
            "id": t.id,
            "name": t.name,
            "subdomain": t.subdomain,
            "subscription_status": t.subscription_status,
            "plan_tier": t.plan_tier,
            "created_at": t.created_at or datetime.utcnow().isoformat(),
            "admin_username": admin_user.username if admin_user else "N/A",
            "admin_name": admin_user.full_name if admin_user else "N/A",
            "product_count": product_count,
            "sale_count": sale_count,
            "last_payment_date": t.last_payment_date,
            "subscription_end": t.subscription_end
        })
        
    return results

@router.put("/superadmin/tenants/{tenant_id}/plan", response_model=schemas.TenantResponse)
def superadmin_update_tenant_plan(tenant_id: int, req: schemas.SuperAdminTenantUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    check_superadmin_privilege(current_user)
    
    if tenant_id == 1:
        raise HTTPException(status_code=400, detail="No se puede modificar la suscripción del tenant principal.")
        
    tenant = db.query(models.Tenant).filter(models.Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tienda no encontrada.")
        
    tenant.plan_tier = req.plan_tier
    tenant.subscription_status = req.subscription_status
    db.commit()
    db.refresh(tenant)
    return tenant

@router.delete("/superadmin/tenants/{tenant_id}")
def superadmin_delete_tenant(tenant_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    check_superadmin_privilege(current_user)
    
    if tenant_id == 1:
        raise HTTPException(status_code=400, detail="No se puede eliminar el tenant principal.")
        
    tenant = db.query(models.Tenant).filter(models.Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tienda no encontrada.")
        
    # We clean up child tables first
    tables_to_clean = [
        ("purchase_items", "purchase_id IN (SELECT id FROM purchases WHERE tenant_id = :tid)"),
        ("purchases", "tenant_id = :tid"),
        ("cash_movements", "tenant_id = :tid"),
        ("customer_payments", "tenant_id = :tid"),
        ("sales_history", "tenant_id = :tid"),
        ("product_returns", "tenant_id = :tid"),
        ("product_variants", "tenant_id = :tid"),
        ("products", "tenant_id = :tid"),
        ("billing_profiles", "tenant_id = :tid"),
        ("invoices", "tenant_id = :tid"),
        ("suppliers", "tenant_id = :tid"),
        ("customers", "tenant_id = :tid"),
        ("notifications", "tenant_id = :tid"),
        ("shifts", "tenant_id = :tid"),
        ("store_settings", "tenant_id = :tid"),
        ("users", "tenant_id = :tid"),
    ]
    
    try:
        from sqlalchemy import text
        for table, condition in tables_to_clean:
            db.execute(text(f"DELETE FROM {table} WHERE {condition}"), {"tid": tenant_id})
            
        db.delete(tenant)
        db.commit()
        return {"status": "success", "message": f"Inquilino {tenant_id} y todos sus datos relacionados fueron eliminados."}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error al eliminar inquilino: {str(e)}")

# --- STRIPE BILLING & AUTO SUBSCRIPTION AUTOMATION ---

import stripe

@router.post("/billing/create-checkout-session")
def create_checkout_session(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if not current_user.tenant_id:
        raise HTTPException(status_code=400, detail="El usuario no pertenece a ninguna tienda.")
        
    tenant = db.query(models.Tenant).filter(models.Tenant.id == current_user.tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tienda no encontrada.")

    stripe_key = os.getenv("STRIPE_SECRET_KEY")
    if not stripe_key:
        # Fallback to simulation mode for testing out of the box!
        simulation_url = f"/payment-simulation?tenant_id={tenant.id}&store_name={tenant.name}"
        return {"url": simulation_url, "simulated": True}

    # Real Stripe session setup
    stripe.api_key = stripe_key
    try:
        # Create or retrieve customer
        customer_id = tenant.stripe_customer_id
        if not customer_id:
            customer = stripe.Customer.create(
                name=tenant.name,
                metadata={"tenant_id": tenant.id}
            )
            customer_id = customer.id
            tenant.stripe_customer_id = customer_id
            db.commit()

        # Build callback URLs
        origin = os.getenv("FRONTEND_URL", "http://localhost:5173")
        
        # Stripe Checkout Session
        session = stripe.checkout.Session.create(
            customer=customer_id,
            payment_method_types=['card'],
            line_items=[{
                'price_data': {
                    'currency': 'mxn',
                    'product_data': {
                        'name': f"Suscripción Mensual - {tenant.name}",
                        'description': 'Acceso completo e ilimitado al sistema de Punto de Venta.',
                    },
                    'unit_amount': 49900, # $499.00 MXN in cents
                    'recurring': {
                        'interval': 'month',
                    },
                },
                'quantity': 1,
            }],
            mode='subscription',
            success_url=f"{origin}/dashboard?payment=success",
            cancel_url=f"{origin}/dashboard?payment=cancel",
            metadata={"tenant_id": tenant.id}
        )
        return {"url": session.url, "simulated": False}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al crear sesión de Stripe: {str(e)}")


@router.post("/billing/webhook")
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")
    endpoint_secret = os.getenv("STRIPE_WEBHOOK_SECRET")
    stripe_key = os.getenv("STRIPE_SECRET_KEY")

    if not sig_header or not endpoint_secret or not stripe_key:
        raise HTTPException(status_code=400, detail="Configuración de webhook inválida o incompleta.")

    stripe.api_key = stripe_key
    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, endpoint_secret
        )
    except ValueError:
        raise HTTPException(status_code=400, detail="Payload inválido")
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Firma de webhook inválida")

    event_type = event['type']
    
    if event_type in ["checkout.session.completed", "invoice.payment_succeeded"]:
        session = event['data']['object']
        
        # Extract tenant_id
        tenant_id = None
        if 'metadata' in session and 'tenant_id' in session['metadata']:
            tenant_id = int(session['metadata']['tenant_id'])
        elif 'customer' in session:
            # Look up customer in tenants
            cust = db.query(models.Tenant).filter(models.Tenant.stripe_customer_id == session['customer']).first()
            if cust:
                tenant_id = cust.id

        if tenant_id:
            tenant = db.query(models.Tenant).filter(models.Tenant.id == tenant_id).first()
            if tenant:
                tenant.subscription_status = "active"
                tenant.plan_tier = "premium"
                tenant.last_payment_date = datetime.utcnow().isoformat()
                # Set subscription end to 30 days from now
                tenant.subscription_end = (datetime.utcnow() + timedelta(days=30)).isoformat()
                
                # Update stripe subscription id if present
                if 'subscription' in session:
                    tenant.stripe_subscription_id = session['subscription']
                    
                db.commit()
                print(f"Suscripción automatizada con éxito para Tenant {tenant_id} a través de Stripe.")
                
    elif event_type in ["invoice.payment_failed", "customer.subscription.deleted"]:
        obj = event['data']['object']
        customer_id = obj.get("customer")
        if customer_id:
            tenant = db.query(models.Tenant).filter(models.Tenant.stripe_customer_id == customer_id).first()
            if tenant:
                tenant.subscription_status = "suspended"
                db.commit()
                print(f"Suscripción del Tenant {tenant.id} suspendida por fallo en pago de Stripe.")

    return {"status": "success"}


@router.post("/billing/simulate-success")
def simulate_payment_success(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    # Anyone can simulate for their own tenant
    if not current_user.tenant_id:
        raise HTTPException(status_code=400, detail="El usuario no tiene tienda vinculada.")

    tenant = db.query(models.Tenant).filter(models.Tenant.id == current_user.tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tienda no encontrada.")

    tenant.subscription_status = "active"
    tenant.plan_tier = "premium"
    tenant.last_payment_date = datetime.utcnow().isoformat()
    # Expire in 30 days
    tenant.subscription_end = (datetime.utcnow() + timedelta(days=30)).isoformat()
    db.commit()
    db.refresh(tenant)
    return {
        "status": "success",
        "message": "Pago simulado con éxito. Tu cuenta ahora es Premium y está activa.",
        "subscription_end": tenant.subscription_end
    }









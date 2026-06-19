from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session, lazyload
from jose import JWTError, jwt
from database import get_db
import models
import schemas
import auth
from typing import List, Optional
from datetime import datetime, timedelta

router = APIRouter()

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
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
    return user

@router.post("/auth/register")
def register(user: schemas.UserCreate, db: Session = Depends(get_db)):
    existing_user = db.query(models.User).filter(models.User.username == user.username).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="El usuario ya existe")
        
    # Hash the password
    hashed_password = auth.get_password_hash(user.password)
    
    db_user = models.User(
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
        
    access_token = auth.create_access_token(data={"sub": db_user.username, "role": db_user.role})
    
    return {
        "access_token": access_token, 
        "token_type": "bearer",
        "user": {
            "id": db_user.id, 
            "username": db_user.username, 
            "full_name": db_user.full_name,
            "role": db_user.role
        }
    }

@router.get("/auth/users", response_model=List[schemas.UserResponse])
def get_users(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role != 'admin':
        raise HTTPException(status_code=403, detail="No tienes permisos suficientes")
    return db.query(models.User).all()

@router.put("/auth/users/{user_id}", response_model=schemas.UserResponse)
def update_user(user_id: int, user_data: schemas.UserUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role != 'admin' and current_user.id != user_id:
        raise HTTPException(status_code=403, detail="No tienes permisos suficientes")
        
    db_user = db.query(models.User).filter(models.User.id == user_id).first()
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
        
    db_user = db.query(models.User).filter(models.User.id == user_id).first()
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
    products = db.query(models.Product).all()
    return products

@router.post("/inventory/", response_model=schemas.ProductResponse)
def create_product(product: schemas.ProductCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role not in ['admin', 'supervisor']:
        raise HTTPException(status_code=403, detail="No tienes permisos suficientes")
    
    prod_data = product.dict()
    variants_data = prod_data.pop("variants", [])
    
    db_product = models.Product(**prod_data)
    db.add(db_product)
    db.commit()
    db.refresh(db_product)
    
    if variants_data:
        for v in variants_data:
            db_var = models.ProductVariant(
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
    db_product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not db_product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    prod_data = product.dict()
    variants_data = prod_data.pop("variants", [])
    
    for key, value in prod_data.items():
        setattr(db_product, key, value)
    
    # Sync variants (simple delete and recreate)
    db.query(models.ProductVariant).filter(models.ProductVariant.product_id == product_id).delete()
    if variants_data:
        for v in variants_data:
            db_var = models.ProductVariant(
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
    db_product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not db_product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    db.delete(db_product)
    db.commit()
    return {"message": "Product deleted successfully"}

@router.post("/inventory/{product_id}/sell", response_model=schemas.ProductResponse)
def sell_product(product_id: int, sell_data: schemas.ProductSell, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
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
        
    db_product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not db_product:
        raise HTTPException(status_code=404, detail="Product not found")
    return db_product

@router.get("/inventory/sales_report")
def get_sales_report(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role not in ['admin', 'supervisor']:
        raise HTTPException(status_code=403, detail="No tienes permisos suficientes")
    products = db.query(models.Product).all()
    sales = db.query(models.SaleHistory).filter(models.SaleHistory.is_cancelled == False).all()
    
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
    products = db.query(models.Product).all()
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
        
        supervisor_user = db.query(models.User).filter(models.User.username == cancel_data.auth_username).first()
        if not supervisor_user or not auth.verify_password(cancel_data.auth_password, supervisor_user.hashed_password):
            raise HTTPException(status_code=403, detail="Usuario o contraseña del supervisor incorrectos.")
        
        if supervisor_user.role not in ["admin", "supervisor"]:
            raise HTTPException(status_code=403, detail="El usuario autorizador no tiene permisos de Supervisor o Administrador.")
        authorized_by_username = supervisor_user.username

    # Cancelar venta transaccional en python
    try:
        sale = db.query(models.SaleHistory).filter(
            models.SaleHistory.id == sale_id
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
            var = db.query(models.ProductVariant).filter(models.ProductVariant.id == sale.variant_id).with_for_update().first()
            if var:
                var.quantity += qty_to_cancel
                var.sold -= qty_to_cancel
            prod = db.query(models.Product).filter(models.Product.id == sale.product_id).options(lazyload(models.Product.variants)).with_for_update().first()
            if prod:
                prod.quantity += qty_to_cancel
                prod.sold -= qty_to_cancel
        else:
            prod = db.query(models.Product).filter(models.Product.id == sale.product_id).options(lazyload(models.Product.variants)).with_for_update().first()
            if prod:
                prod.quantity += qty_to_cancel
                prod.sold -= qty_to_cancel
                
        # Calcular reembolsos proporcionales y deducir del turno de caja activo
        ratio = qty_to_cancel / sale.quantity
        discount_refund = sale.discount * ratio
        cash_refund = (sale.cash_amount or 0.0) * ratio
        card_refund = (sale.card_amount or 0.0) * ratio
        
        if sale.shift_id:
            shift = db.query(models.Shift).filter(models.Shift.id == sale.shift_id, models.Shift.status == "open").first()
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
            models.Shift.status == "open"
        ).first()
        if not shift and current_user.role != 'admin':
            raise HTTPException(status_code=400, detail="No hay un turno de caja activo o el ID del turno es incorrecto.")
    elif current_user.role != 'admin':
        raise HTTPException(status_code=400, detail="Se requiere un turno de caja activo para procesar la venta.")
        
    try:
        now_str = datetime.utcnow().isoformat()
        subtotal = 0.0
        items_to_process = []
        
        for item in checkout_data.items:
            if item.variant_id:
                var = db.query(models.ProductVariant).filter(
                    models.ProductVariant.id == item.variant_id
                ).with_for_update().first()
                if not var:
                    raise HTTPException(status_code=404, detail=f"La variante con ID {item.variant_id} no existe.")
                if var.quantity < item.quantity:
                    raise HTTPException(status_code=400, detail=f"Stock insuficiente para la variante {var.name}. Disponible: {var.quantity}, Solicitado: {item.quantity}")
                
                prod = db.query(models.Product).filter(models.Product.id == var.product_id).first()
                price = var.price if var.price is not None else prod.price
                cost = var.cost_price if var.cost_price is not None else prod.cost_price
                subtotal += price * item.quantity
                items_to_process.append((item, var, prod, price, cost))
            else:
                prod = db.query(models.Product).filter(
                    models.Product.id == item.product_id
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
                product_id=prod.id,
                variant_id=var.id if var else None,
                shift_id=shift.id if shift else None,
                user_id=current_user.id,
                quantity=qty,
                price_sold=price,
                cost_price_sold=cost,
                discount=item_discount,
                payment_method=checkout_data.payment_method,
                cash_amount=checkout_data.cash_amount * (item_subtotal / subtotal),
                card_amount=checkout_data.card_amount * (item_subtotal / subtotal),
                created_at=now_str
            )
            db.add(sale_record)
            
        if shift:
            cash_sale_total = 0.0
            if checkout_data.payment_method == "efectivo":
                cash_sale_total = subtotal - checkout_data.discount
            elif checkout_data.payment_method == "mixto":
                cash_sale_total = checkout_data.cash_amount
                
            shift.final_cash_expected += cash_sale_total
        
        db.commit()
        return {"message": "Venta procesada exitosamente"}
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/shifts/active", response_model=Optional[schemas.ShiftResponse])
def get_active_shift(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    shift = db.query(models.Shift).filter(
        models.Shift.user_id == current_user.id,
        models.Shift.status == "open"
    ).first()
    return shift

@router.post("/shifts/open", response_model=schemas.ShiftResponse)
def open_shift(shift_data: schemas.ShiftCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    existing = db.query(models.Shift).filter(
        models.Shift.user_id == current_user.id,
        models.Shift.status == "open"
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Ya tienes un turno de caja abierto.")
        
    new_shift = models.Shift(
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
        models.Shift.status == "open"
    ).first()
    if not shift:
        raise HTTPException(status_code=400, detail="No tienes un turno de caja abierto para registrar movimientos.")
        
    db_mov = models.CashMovement(
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

@router.get("/shifts/{shift_id}/report")
def get_shift_report(shift_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    shift = db.query(models.Shift).filter(models.Shift.id == shift_id).first()
    if not shift:
        raise HTTPException(status_code=404, detail="Turno no encontrado.")
        
    if current_user.role == "cajero" and shift.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="No tienes permisos para ver el reporte de otros turnos.")
        
    movements = db.query(models.CashMovement).filter(models.CashMovement.shift_id == shift.id).all()
    
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
        models.SaleHistory.shift_id == shift.id
    ).all()
    
    cash_sales = 0.0
    card_sales = 0.0
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
    
    cajero = db.query(models.User).filter(models.User.id == shift.user_id).first()
    
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
            "total_sales": cash_sales + card_sales,
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
        
    products = db.query(models.Product).all()
    sales = db.query(models.SaleHistory).filter(models.SaleHistory.is_cancelled == False).all()
    
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



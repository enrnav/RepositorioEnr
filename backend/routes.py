from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from jose import JWTError, jwt
from database import get_db
import models
import schemas
import auth
from typing import List
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

@router.get("/inventory/", response_model=List[schemas.ProductResponse])
def get_inventory(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    products = db.query(models.Product).all()
    return products

@router.post("/inventory/", response_model=schemas.ProductResponse)
def create_product(product: schemas.ProductCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role != 'admin':
        raise HTTPException(status_code=403, detail="No tienes permisos suficientes")
    db_product = models.Product(**product.dict())
    db.add(db_product)
    db.commit()
    db.refresh(db_product)
    return db_product

@router.put("/inventory/{product_id}", response_model=schemas.ProductResponse)
def update_product(product_id: int, product: schemas.ProductCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role != 'admin':
        raise HTTPException(status_code=403, detail="No tienes permisos suficientes")
    db_product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not db_product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    for key, value in product.dict().items():
        setattr(db_product, key, value)
    
    db.commit()
    db.refresh(db_product)
    return db_product

@router.delete("/inventory/{product_id}")
def delete_product(product_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role != 'admin':
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
    if current_user.role != 'admin':
        raise HTTPException(status_code=403, detail="No tienes permisos suficientes")
    products = db.query(models.Product).all()
    sales = db.query(models.SaleHistory).all()
    
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
        
        report.append({
            "id": p.id,
            "name": p.name,
            "price": p.price,
            "quantity": p.quantity,
            "sold_total": p.sold,
            "sales_today": sales_today,
            "revenue_today": sales_today * p.price,
            "sales_week": sales_week,
            "revenue_week": sales_week * p.price,
            "sales_month": sales_month,
            "revenue_month": sales_month * p.price,
            "revenue_total": p.sold * p.price
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

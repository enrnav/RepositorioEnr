from pydantic import BaseModel
from typing import Optional, List

# User Schemas
class UserCreate(BaseModel):
    username: str
    password: str
    full_name: str
    role: Optional[str] = "cajero" # cajero, supervisor, admin

class UserUpdate(BaseModel):
    username: Optional[str] = None
    full_name: Optional[str] = None
    password: Optional[str] = None
    role: Optional[str] = None

class UserLogin(BaseModel):
    username: str
    password: str

class UserResponse(BaseModel):
    id: int
    username: str
    full_name: str
    role: str

    class Config:
        from_attributes = True

# Variant Schemas
class ProductVariantBase(BaseModel):
    name: str
    barcode: Optional[str] = None
    cost_price: Optional[float] = None
    price: Optional[float] = None
    quantity: int

class ProductVariantCreate(ProductVariantBase):
    pass

class ProductVariantResponse(ProductVariantBase):
    id: int
    product_id: int
    sold: int

    class Config:
        from_attributes = True

# Product Schemas
class ProductBase(BaseModel):
    name: str
    barcode: Optional[str] = None
    price: float
    cost_price: float = 0.0
    quantity: int
    min_stock: int = 3
    entry_date: Optional[str] = None
    image: Optional[str] = None

class ProductCreate(ProductBase):
    variants: Optional[List[ProductVariantCreate]] = []

class ProductSell(BaseModel):
    quantity: int = 1

class ProductResponse(ProductBase):
    id: int
    sold: int
    variants: List[ProductVariantResponse] = []

    class Config:
        from_attributes = True

# Token Schemas
class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse

class TokenData(BaseModel):
    username: Optional[str] = None

# Cancel/Return Schemas
class CancelSaleRequest(BaseModel):
    reason: str
    auth_username: Optional[str] = None
    auth_password: Optional[str] = None
    quantity: Optional[int] = None

class ReturnResponse(BaseModel):
    id: int
    sale_id: int
    product_id: int
    product_name: str
    quantity: int
    price: float
    reason: str
    authorized_by: Optional[str] = None
    created_at: str

    class Config:
        from_attributes = True

# Shift Schemas
class ShiftCreate(BaseModel):
    initial_cash: float

class ShiftClose(BaseModel):
    final_cash_real: float

class ShiftResponse(BaseModel):
    id: int
    user_id: int
    start_time: str
    end_time: Optional[str] = None
    initial_cash: float
    final_cash_real: Optional[float] = None
    final_cash_expected: float
    difference: Optional[float] = None
    status: str

    class Config:
        from_attributes = True

# Cash Movement Schemas
class CashMovementCreate(BaseModel):
    type: str # 'entrada', 'salida', 'retiro_parcial'
    amount: float
    reason: str

class CashMovementResponse(BaseModel):
    id: int
    shift_id: int
    type: str
    amount: float
    reason: str
    created_at: str

    class Config:
        from_attributes = True

# Checkout Schemas
class CheckoutItem(BaseModel):
    product_id: int
    variant_id: Optional[int] = None
    quantity: int

class CheckoutRequest(BaseModel):
    items: List[CheckoutItem]
    payment_method: str # 'efectivo', 'tarjeta', 'mixto'
    cash_amount: float = 0.0
    card_amount: float = 0.0
    discount: float = 0.0
    shift_id: Optional[int] = None




from pydantic import BaseModel
from typing import Optional

class UserCreate(BaseModel):
    username: str
    password: str
    full_name: str
    role: Optional[str] = "user"

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

class ProductBase(BaseModel):
    name: str
    barcode: Optional[str] = None
    price: float
    quantity: int
    entry_date: Optional[str] = None

class ProductCreate(ProductBase):
    pass

class ProductSell(BaseModel):
    quantity: int = 1

class ProductResponse(ProductBase):
    id: int
    sold: int

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse

class TokenData(BaseModel):
    username: Optional[str] = None

class CancelSaleRequest(BaseModel):
    reason: str

class ReturnResponse(BaseModel):
    id: int
    sale_id: int
    product_id: int
    product_name: str
    quantity: int
    price: float
    reason: str
    created_at: str

    class Config:
        from_attributes = True



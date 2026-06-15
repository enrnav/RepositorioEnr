from sqlalchemy import Column, Integer, String, Float, Boolean
from database import Base

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    full_name = Column(String)
    hashed_password = Column(String)
    role = Column(String, default="user")

class Product(Base):
    __tablename__ = "products"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    barcode = Column(String, index=True, nullable=True)
    price = Column(Float)
    quantity = Column(Integer)
    sold = Column(Integer, default=0)
    entry_date = Column(String, nullable=True)

class Notification(Base):
    __tablename__ = "notifications"
    id = Column(Integer, primary_key=True, index=True)
    message = Column(String)
    is_read = Column(Boolean, default=False)

class SaleHistory(Base):
    __tablename__ = "sales_history"
    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, index=True)
    quantity = Column(Integer)
    created_at = Column(String) # We will use ISO format string for simplicity with SQLite/Postgres compatibility
    is_cancelled = Column(Boolean, default=False)
    cancel_reason = Column(String, nullable=True)

class ProductReturn(Base):
    __tablename__ = "product_returns"
    id = Column(Integer, primary_key=True, index=True)
    sale_id = Column(Integer, index=True)
    product_id = Column(Integer, index=True)
    quantity = Column(Integer)
    price = Column(Float)
    reason = Column(String)
    created_at = Column(String)




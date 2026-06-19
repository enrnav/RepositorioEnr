from sqlalchemy import Column, Integer, String, Float, Boolean, ForeignKey
from sqlalchemy.orm import relationship
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
    cost_price = Column(Float, default=0.0)
    quantity = Column(Integer)
    min_stock = Column(Integer, default=3)
    sold = Column(Integer, default=0)
    entry_date = Column(String, nullable=True)
    image = Column(String, nullable=True)
    sat_key = Column(String, default="01010101")
    sat_unit_key = Column(String, default="H87")
    
    variants = relationship("ProductVariant", back_populates="product", cascade="all, delete-orphan", lazy="joined")

class ProductVariant(Base):
    __tablename__ = "product_variants"
    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), index=True)
    name = Column(String, index=True)
    barcode = Column(String, index=True, nullable=True)
    cost_price = Column(Float, nullable=True)
    price = Column(Float, nullable=True)
    quantity = Column(Integer)
    sold = Column(Integer, default=0)
    sat_key = Column(String, default="01010101")
    sat_unit_key = Column(String, default="H87")

    product = relationship("Product", back_populates="variants")

class Notification(Base):
    __tablename__ = "notifications"
    id = Column(Integer, primary_key=True, index=True)
    message = Column(String)
    is_read = Column(Boolean, default=False)

class Shift(Base):
    __tablename__ = "shifts"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, index=True)
    start_time = Column(String)
    end_time = Column(String, nullable=True)
    initial_cash = Column(Float)
    final_cash_real = Column(Float, nullable=True)
    final_cash_expected = Column(Float, default=0.0)
    difference = Column(Float, nullable=True)
    status = Column(String, default="open") # "open", "closed"

class CashMovement(Base):
    __tablename__ = "cash_movements"
    id = Column(Integer, primary_key=True, index=True)
    shift_id = Column(Integer, index=True)
    type = Column(String) # "entrada", "salida", "retiro_parcial"
    amount = Column(Float)
    reason = Column(String)
    created_at = Column(String)

class SaleHistory(Base):
    __tablename__ = "sales_history"
    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, index=True)
    variant_id = Column(Integer, index=True, nullable=True)
    shift_id = Column(Integer, index=True, nullable=True)
    user_id = Column(Integer, index=True, nullable=True)
    quantity = Column(Integer)
    price_sold = Column(Float, nullable=True) # Actual selling price
    cost_price_sold = Column(Float, default=0.0) # Cost price at transaction time
    discount = Column(Float, default=0.0) # Discount applied
    payment_method = Column(String, default="efectivo") # "efectivo", "tarjeta", "mixto"
    cash_amount = Column(Float, default=0.0)
    card_amount = Column(Float, default=0.0)
    created_at = Column(String) # We will use ISO format string for simplicity with SQLite/Postgres compatibility
    is_cancelled = Column(Boolean, default=False)
    cancel_reason = Column(String, nullable=True)
    authorized_by = Column(String, nullable=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id"), index=True, nullable=True)

class ProductReturn(Base):
    __tablename__ = "product_returns"
    id = Column(Integer, primary_key=True, index=True)
    sale_id = Column(Integer, index=True)
    product_id = Column(Integer, index=True)
    quantity = Column(Integer)
    price = Column(Float)
    reason = Column(String)
    authorized_by = Column(String, nullable=True)
    created_at = Column(String)


class BillingProfile(Base):
    __tablename__ = "billing_profiles"
    id = Column(Integer, primary_key=True, index=True)
    rfc = Column(String, unique=True, index=True)
    razon_social = Column(String, index=True)
    regimen_fiscal = Column(String)
    codigo_postal = Column(String)
    correo = Column(String)


class Invoice(Base):
    __tablename__ = "invoices"
    id = Column(Integer, primary_key=True, index=True)
    uuid = Column(String, unique=True, index=True)
    monto_total = Column(Float)
    xml_url = Column(String, nullable=True)
    pdf_url = Column(String, nullable=True)
    created_at = Column(String)
    status = Column(String, default="active") # "active", "cancelled"





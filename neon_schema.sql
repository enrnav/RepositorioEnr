-- ==============================================================================
-- SCRIPT DE CREACIÓN DE BASE DE DATOS Y TABLAS PARA NEON POSTGRESQL (MICRO-SAAS)
-- ==============================================================================

-- 1. Tabla: tenants (Inquilinos/Tiendas)
CREATE TABLE IF NOT EXISTS tenants (
    id SERIAL PRIMARY KEY,
    name VARCHAR NOT NULL,
    subdomain VARCHAR UNIQUE,
    subscription_status VARCHAR DEFAULT 'active', -- active, trialing, past_due, canceled, suspended
    plan_tier VARCHAR DEFAULT 'free',             -- free, premium
    created_at VARCHAR,
    stripe_customer_id VARCHAR NULL,
    stripe_subscription_id VARCHAR NULL,
    subscription_end VARCHAR NULL,
    last_payment_date VARCHAR NULL
);
-- Migración segura para columnas nuevas si la tabla ya existía
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR NULL;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR NULL;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS subscription_end VARCHAR NULL;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS last_payment_date VARCHAR NULL;

CREATE INDEX IF NOT EXISTS ix_tenants_id ON tenants (id);
CREATE INDEX IF NOT EXISTS ix_tenants_subdomain ON tenants (subdomain);

-- Insertar Tenant por defecto si no existe
INSERT INTO tenants (name, subdomain, subscription_status, plan_tier, created_at)
VALUES ('Principal', 'principal', 'active', 'premium', TO_CHAR(NOW(), 'YYYY-MM-DD"T"HH24:MI:SS'))
ON CONFLICT (subdomain) DO NOTHING;


-- 2. Tabla: users (Usuarios de la plataforma)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER REFERENCES tenants(id) ON DELETE SET NULL,
    username VARCHAR UNIQUE NOT NULL,
    full_name VARCHAR NOT NULL,
    hashed_password VARCHAR NOT NULL,
    role VARCHAR DEFAULT 'user' -- admin, supervisor, cajero, user
);
-- Migración segura para columnas nuevas si la tabla ya existía
ALTER TABLE users ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR DEFAULT 'user';

CREATE INDEX IF NOT EXISTS ix_users_id ON users (id);
CREATE INDEX IF NOT EXISTS ix_users_tenant_id ON users (tenant_id);
CREATE INDEX IF NOT EXISTS ix_users_username ON users (username);


-- 3. Tabla: products (Productos en inventario)
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER REFERENCES tenants(id) ON DELETE SET NULL,
    name VARCHAR NOT NULL,
    barcode VARCHAR NULL,
    price DOUBLE PRECISION NOT NULL,
    cost_price DOUBLE PRECISION DEFAULT 0.0,
    quantity INTEGER NOT NULL,
    min_stock INTEGER DEFAULT 3,
    sold INTEGER DEFAULT 0,
    entry_date VARCHAR NULL,
    image VARCHAR NULL,
    sat_key VARCHAR DEFAULT '01010101',
    sat_unit_key VARCHAR DEFAULT 'H87'
);
-- Migración segura para columnas nuevas si la tabla ya existía
ALTER TABLE products ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id) ON DELETE SET NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS barcode VARCHAR NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS cost_price DOUBLE PRECISION DEFAULT 0.0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS min_stock INTEGER DEFAULT 3;
ALTER TABLE products ADD COLUMN IF NOT EXISTS sold INTEGER DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS entry_date VARCHAR NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS image VARCHAR NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS sat_key VARCHAR DEFAULT '01010101';
ALTER TABLE products ADD COLUMN IF NOT EXISTS sat_unit_key VARCHAR DEFAULT 'H87';

CREATE INDEX IF NOT EXISTS ix_products_id ON products (id);
CREATE INDEX IF NOT EXISTS ix_products_tenant_id ON products (tenant_id);
CREATE INDEX IF NOT EXISTS ix_products_name ON products (name);
CREATE INDEX IF NOT EXISTS ix_products_barcode ON products (barcode);


-- 4. Tabla: product_variants (Variantes de productos)
CREATE TABLE IF NOT EXISTS product_variants (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER REFERENCES tenants(id) ON DELETE SET NULL,
    product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
    name VARCHAR NOT NULL,
    barcode VARCHAR NULL,
    cost_price DOUBLE PRECISION NULL,
    price DOUBLE PRECISION NULL,
    quantity INTEGER NOT NULL,
    sold INTEGER DEFAULT 0,
    sat_key VARCHAR DEFAULT '01010101',
    sat_unit_key VARCHAR DEFAULT 'H87'
);
-- Migración segura para columnas nuevas si la tabla ya existía
ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id) ON DELETE SET NULL;
ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS sat_key VARCHAR DEFAULT '01010101';
ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS sat_unit_key VARCHAR DEFAULT 'H87';

CREATE INDEX IF NOT EXISTS ix_product_variants_id ON product_variants (id);
CREATE INDEX IF NOT EXISTS ix_product_variants_tenant_id ON product_variants (tenant_id);
CREATE INDEX IF NOT EXISTS ix_product_variants_product_id ON product_variants (product_id);
CREATE INDEX IF NOT EXISTS ix_product_variants_barcode ON product_variants (barcode);


-- 5. Tabla: notifications (Alertas del sistema)
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER REFERENCES tenants(id) ON DELETE SET NULL,
    message VARCHAR NOT NULL,
    is_read BOOLEAN DEFAULT FALSE
);
-- Migración segura para columnas nuevas si la tabla ya existía
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ix_notifications_id ON notifications (id);
CREATE INDEX IF NOT EXISTS ix_notifications_tenant_id ON notifications (tenant_id);


-- 6. Tabla: shifts (Turnos/Cortes de caja)
CREATE TABLE IF NOT EXISTS shifts (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER REFERENCES tenants(id) ON DELETE SET NULL,
    user_id INTEGER NOT NULL,
    start_time VARCHAR NOT NULL,
    end_time VARCHAR NULL,
    initial_cash DOUBLE PRECISION NOT NULL,
    final_cash_real DOUBLE PRECISION NULL,
    final_cash_expected DOUBLE PRECISION DEFAULT 0.0,
    difference DOUBLE PRECISION NULL,
    status VARCHAR DEFAULT 'open' -- open, closed
);
-- Migración segura para columnas nuevas si la tabla ya existía
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ix_shifts_id ON shifts (id);
CREATE INDEX IF NOT EXISTS ix_shifts_tenant_id ON shifts (tenant_id);
CREATE INDEX IF NOT EXISTS ix_shifts_user_id ON shifts (user_id);


-- 7. Tabla: cash_movements (Entradas/Salidas de caja en el turno)
CREATE TABLE IF NOT EXISTS cash_movements (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER REFERENCES tenants(id) ON DELETE SET NULL,
    shift_id INTEGER NOT NULL,
    type VARCHAR NOT NULL, -- entrada, salida, retiro_parcial
    amount DOUBLE PRECISION NOT NULL,
    reason VARCHAR NOT NULL,
    created_at VARCHAR NOT NULL
);
-- Migración segura para columnas nuevas si la tabla ya existía
ALTER TABLE cash_movements ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ix_cash_movements_id ON cash_movements (id);
CREATE INDEX IF NOT EXISTS ix_cash_movements_tenant_id ON cash_movements (tenant_id);
CREATE INDEX IF NOT EXISTS ix_cash_movements_shift_id ON cash_movements (shift_id);


-- 8. Tabla: invoices (Facturas CFDI)
CREATE TABLE IF NOT EXISTS invoices (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER REFERENCES tenants(id) ON DELETE SET NULL,
    uuid VARCHAR UNIQUE NOT NULL,
    monto_total DOUBLE PRECISION NOT NULL,
    xml_url VARCHAR NULL,
    pdf_url VARCHAR NULL,
    created_at VARCHAR NOT NULL,
    status VARCHAR DEFAULT 'active' -- active, cancelled
);
-- Migración segura para columnas nuevas si la tabla ya existía
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ix_invoices_id ON invoices (id);
CREATE INDEX IF NOT EXISTS ix_invoices_tenant_id ON invoices (tenant_id);
CREATE INDEX IF NOT EXISTS ix_invoices_uuid ON invoices (uuid);


-- 9. Tabla: customers (Clientes - Cuentas/Crédito)
CREATE TABLE IF NOT EXISTS customers (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER REFERENCES tenants(id) ON DELETE SET NULL,
    name VARCHAR NOT NULL,
    phone VARCHAR NULL,
    email VARCHAR NULL,
    credit_limit DOUBLE PRECISION DEFAULT 0.0,
    current_balance DOUBLE PRECISION DEFAULT 0.0
);
-- Migración segura para columnas nuevas si la tabla ya existía
ALTER TABLE customers ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ix_customers_id ON customers (id);
CREATE INDEX IF NOT EXISTS ix_customers_tenant_id ON customers (tenant_id);
CREATE INDEX IF NOT EXISTS ix_customers_name ON customers (name);


-- 10. Tabla: sales_history (Historial de transacciones de ventas)
CREATE TABLE IF NOT EXISTS sales_history (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER REFERENCES tenants(id) ON DELETE SET NULL,
    product_id INTEGER NOT NULL,
    variant_id INTEGER NULL,
    shift_id INTEGER NULL,
    user_id INTEGER NULL,
    quantity INTEGER NOT NULL,
    price_sold DOUBLE PRECISION NULL,
    cost_price_sold DOUBLE PRECISION DEFAULT 0.0,
    discount DOUBLE PRECISION DEFAULT 0.0,
    payment_method VARCHAR(50) DEFAULT 'efectivo', -- efectivo, tarjeta, mixto
    cash_amount DOUBLE PRECISION DEFAULT 0.0,
    card_amount DOUBLE PRECISION DEFAULT 0.0,
    created_at VARCHAR NOT NULL,
    is_cancelled BOOLEAN DEFAULT FALSE,
    cancel_reason VARCHAR NULL,
    authorized_by VARCHAR NULL,
    invoice_id INTEGER REFERENCES invoices(id) ON DELETE SET NULL,
    customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL
);
-- Migración segura para columnas nuevas si la tabla ya existía
ALTER TABLE sales_history ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id) ON DELETE SET NULL;
ALTER TABLE sales_history ADD COLUMN IF NOT EXISTS is_cancelled BOOLEAN DEFAULT FALSE;
ALTER TABLE sales_history ADD COLUMN IF NOT EXISTS cancel_reason VARCHAR NULL;
ALTER TABLE sales_history ADD COLUMN IF NOT EXISTS variant_id INTEGER NULL;
ALTER TABLE sales_history ADD COLUMN IF NOT EXISTS shift_id INTEGER NULL;
ALTER TABLE sales_history ADD COLUMN IF NOT EXISTS user_id INTEGER NULL;
ALTER TABLE sales_history ADD COLUMN IF NOT EXISTS price_sold DOUBLE PRECISION NULL;
ALTER TABLE sales_history ADD COLUMN IF NOT EXISTS cost_price_sold DOUBLE PRECISION DEFAULT 0.0;
ALTER TABLE sales_history ADD COLUMN IF NOT EXISTS discount DOUBLE PRECISION DEFAULT 0.0;
ALTER TABLE sales_history ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50) DEFAULT 'efectivo';
ALTER TABLE sales_history ADD COLUMN IF NOT EXISTS cash_amount DOUBLE PRECISION DEFAULT 0.0;
ALTER TABLE sales_history ADD COLUMN IF NOT EXISTS card_amount DOUBLE PRECISION DEFAULT 0.0;
ALTER TABLE sales_history ADD COLUMN IF NOT EXISTS authorized_by VARCHAR NULL;
ALTER TABLE sales_history ADD COLUMN IF NOT EXISTS invoice_id INTEGER REFERENCES invoices(id) ON DELETE SET NULL;
ALTER TABLE sales_history ADD COLUMN IF NOT EXISTS customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ix_sales_history_id ON sales_history (id);
CREATE INDEX IF NOT EXISTS ix_sales_history_tenant_id ON sales_history (tenant_id);
CREATE INDEX IF NOT EXISTS ix_sales_history_product_id ON sales_history (product_id);
CREATE INDEX IF NOT EXISTS ix_sales_history_variant_id ON sales_history (variant_id);
CREATE INDEX IF NOT EXISTS ix_sales_history_shift_id ON sales_history (shift_id);
CREATE INDEX IF NOT EXISTS ix_sales_history_user_id ON sales_history (user_id);
CREATE INDEX IF NOT EXISTS ix_sales_history_invoice_id ON sales_history (invoice_id);
CREATE INDEX IF NOT EXISTS ix_sales_history_customer_id ON sales_history (customer_id);


-- 11. Tabla: product_returns (Devoluciones de mercancía)
CREATE TABLE IF NOT EXISTS product_returns (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER REFERENCES tenants(id) ON DELETE SET NULL,
    sale_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    price DOUBLE PRECISION NOT NULL,
    reason VARCHAR NOT NULL,
    authorized_by VARCHAR NULL,
    created_at VARCHAR NOT NULL
);
-- Migración segura para columnas nuevas si la tabla ya existía
ALTER TABLE product_returns ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ix_product_returns_id ON product_returns (id);
CREATE INDEX IF NOT EXISTS ix_product_returns_tenant_id ON product_returns (tenant_id);
CREATE INDEX IF NOT EXISTS ix_product_returns_sale_id ON product_returns (sale_id);
CREATE INDEX IF NOT EXISTS ix_product_returns_product_id ON product_returns (product_id);


-- 12. Tabla: billing_profiles (Perfiles de Facturación de Clientes)
CREATE TABLE IF NOT EXISTS billing_profiles (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER REFERENCES tenants(id) ON DELETE SET NULL,
    rfc VARCHAR UNIQUE NOT NULL,
    razon_social VARCHAR NOT NULL,
    regimen_fiscal VARCHAR NOT NULL,
    codigo_postal VARCHAR NOT NULL,
    correo VARCHAR NOT NULL
);
-- Migración segura para columnas nuevas si la tabla ya existía
ALTER TABLE billing_profiles ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ix_billing_profiles_id ON billing_profiles (id);
CREATE INDEX IF NOT EXISTS ix_billing_profiles_tenant_id ON billing_profiles (tenant_id);
CREATE INDEX IF NOT EXISTS ix_billing_profiles_rfc ON billing_profiles (rfc);
CREATE INDEX IF NOT EXISTS ix_billing_profiles_razon_social ON billing_profiles (razon_social);


-- 13. Tabla: suppliers (Proveedores)
CREATE TABLE IF NOT EXISTS suppliers (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER REFERENCES tenants(id) ON DELETE SET NULL,
    name VARCHAR NOT NULL,
    rfc VARCHAR NULL,
    phone VARCHAR NULL,
    email VARCHAR NULL,
    address VARCHAR NULL,
    notes VARCHAR NULL
);
-- Migración segura para columnas nuevas si la tabla ya existía
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ix_suppliers_id ON suppliers (id);
CREATE INDEX IF NOT EXISTS ix_suppliers_tenant_id ON suppliers (tenant_id);
CREATE INDEX IF NOT EXISTS ix_suppliers_name ON suppliers (name);


-- 14. Tabla: purchases (Notas de compra a proveedores)
CREATE TABLE IF NOT EXISTS purchases (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER REFERENCES tenants(id) ON DELETE SET NULL,
    supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
    invoice_number VARCHAR NULL,
    total_cost DOUBLE PRECISION DEFAULT 0.0,
    created_at VARCHAR NOT NULL,
    notes VARCHAR NULL,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL
);
-- Migración segura para columnas nuevas si la tabla ya existía
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ix_purchases_id ON purchases (id);
CREATE INDEX IF NOT EXISTS ix_purchases_tenant_id ON purchases (tenant_id);


-- 15. Tabla: purchase_items (Detalle de artículos en compras)
CREATE TABLE IF NOT EXISTS purchase_items (
    id SERIAL PRIMARY KEY,
    purchase_id INTEGER REFERENCES purchases(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
    variant_id INTEGER REFERENCES product_variants(id) ON DELETE SET NULL,
    quantity INTEGER NOT NULL,
    cost_price DOUBLE PRECISION NOT NULL,
    price DOUBLE PRECISION NULL
);
CREATE INDEX IF NOT EXISTS ix_purchase_items_id ON purchase_items (id);


-- 16. Tabla: store_settings (Configuración de marca e identidad visual por inquilino)
CREATE TABLE IF NOT EXISTS store_settings (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER REFERENCES tenants(id) ON DELETE SET NULL,
    store_name VARCHAR DEFAULT 'ABARROTES ED & E',
    rfc VARCHAR NULL,
    phone VARCHAR NULL,
    email VARCHAR NULL,
    address VARCHAR NULL,
    tax_rate DOUBLE PRECISION DEFAULT 16.0,
    ticket_footer VARCHAR DEFAULT '¡Gracias por su compra!',
    logo_url VARCHAR NULL,
    primary_color VARCHAR DEFAULT '#064E3B',
    accent_color VARCHAR DEFAULT '#DC2626'
);
-- Migración segura para columnas nuevas si la tabla ya existía
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id) ON DELETE SET NULL;
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS logo_url VARCHAR NULL;
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS primary_color VARCHAR DEFAULT '#064E3B';
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS accent_color VARCHAR DEFAULT '#DC2626';

CREATE INDEX IF NOT EXISTS ix_store_settings_id ON store_settings (id);
CREATE INDEX IF NOT EXISTS ix_store_settings_tenant_id ON store_settings (tenant_id);


-- 17. Tabla: customer_payments (Abonos a crédito de clientes)
CREATE TABLE IF NOT EXISTS customer_payments (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER REFERENCES tenants(id) ON DELETE SET NULL,
    customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
    shift_id INTEGER NULL,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    amount DOUBLE PRECISION NOT NULL,
    created_at VARCHAR NOT NULL,
    notes VARCHAR NULL
);
-- Migración segura para columnas nuevas si la tabla ya existía
ALTER TABLE customer_payments ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ix_customer_payments_id ON customer_payments (id);
CREATE INDEX IF NOT EXISTS ix_customer_payments_tenant_id ON customer_payments (tenant_id);


-- ==============================================================================
-- FUNCIONES ALMACENADAS PL/pgSQL (TRANSACCIONALIDAD EN CAJA)
-- ==============================================================================

-- Función: vender_producto (Venta y descuento automático de inventario)
CREATE OR REPLACE FUNCTION vender_producto(
    p_producto_id INT,
    p_cantidad INT,
    p_fecha_venta VARCHAR
) RETURNS VOID AS $$
DECLARE
    v_stock_actual INT;
BEGIN
    -- 1. Bloqueamos la fila del producto para evitar lecturas sucias
    SELECT quantity INTO v_stock_actual
    FROM products
    WHERE id = p_producto_id
    FOR UPDATE;

    -- 2. Validamos existencia
    IF v_stock_actual IS NULL THEN
        RAISE EXCEPTION 'El producto con ID % no existe.', p_producto_id;
    END IF;

    -- 3. Validamos stock suficiente
    IF v_stock_actual < p_cantidad THEN
        RAISE EXCEPTION 'Stock insuficiente para el producto ID %. Disponible: %, Solicitado: %', 
            p_producto_id, v_stock_actual, p_cantidad;
    END IF;

    -- 4. Actualizamos inventario
    UPDATE products
    SET quantity = quantity - p_cantidad,
        sold = sold + p_cantidad
    WHERE id = p_producto_id;

    -- 5. Insertamos en historial
    INSERT INTO sales_history (product_id, quantity, created_at)
    VALUES (p_producto_id, p_cantidad, p_fecha_venta);
END;
$$ LANGUAGE plpgsql;

-- Función: cancelar_venta (Devolución e incremento automático de stock)
CREATE OR REPLACE FUNCTION cancelar_venta(
    p_sale_id INT,
    p_cancel_reason VARCHAR
) RETURNS VOID AS $$
DECLARE
    v_product_id INT;
    v_quantity INT;
    v_is_cancelled BOOLEAN;
BEGIN
    -- 1. Obtener detalles de la venta y bloquear la fila
    SELECT product_id, quantity, is_cancelled INTO v_product_id, v_quantity, v_is_cancelled
    FROM sales_history
    WHERE id = p_sale_id
    FOR UPDATE;

    -- 2. Validar que la venta exista
    IF v_product_id IS NULL THEN
        RAISE EXCEPTION 'La venta con ID % no existe.', p_sale_id;
    END IF;

    -- 3. Validar que no esté ya cancelada
    IF v_is_cancelled = TRUE THEN
        RAISE EXCEPTION 'La venta con ID % ya fue cancelada.', p_sale_id;
    END IF;

    -- 4. Marcar como cancelada y registrar motivo
    UPDATE sales_history
    SET is_cancelled = TRUE,
        cancel_reason = p_cancel_reason
    WHERE id = p_sale_id;

    -- 5. Devolver stock al producto
    UPDATE products
    SET quantity = quantity + v_quantity,
        sold = sold - v_quantity
    WHERE id = v_product_id;

    -- 6. Insertar registro en product_returns
    INSERT INTO product_returns (sale_id, product_id, quantity, price, reason, created_at)
    SELECT p_sale_id, v_product_id, v_quantity, price, p_cancel_reason, TO_CHAR(NOW(), 'YYYY-MM-DD"T"HH24:MI:SS')
    FROM products
    WHERE id = v_product_id;
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- SINCRONIZACIÓN DE SECUENCIAS SERIAL (EVITA ERRORES UNIQUE VIOLATION AL INSERTAR NUEVOS)
-- ==============================================================================
SELECT setval(pg_get_serial_sequence('tenants', 'id'), COALESCE((SELECT MAX(id) FROM tenants), 1), true);
SELECT setval(pg_get_serial_sequence('users', 'id'), COALESCE((SELECT MAX(id) FROM users), 1), true);
SELECT setval(pg_get_serial_sequence('products', 'id'), COALESCE((SELECT MAX(id) FROM products), 1), true);
SELECT setval(pg_get_serial_sequence('product_variants', 'id'), COALESCE((SELECT MAX(id) FROM product_variants), 1), true);
SELECT setval(pg_get_serial_sequence('notifications', 'id'), COALESCE((SELECT MAX(id) FROM notifications), 1), true);
SELECT setval(pg_get_serial_sequence('shifts', 'id'), COALESCE((SELECT MAX(id) FROM shifts), 1), true);
SELECT setval(pg_get_serial_sequence('cash_movements', 'id'), COALESCE((SELECT MAX(id) FROM cash_movements), 1), true);
SELECT setval(pg_get_serial_sequence('invoices', 'id'), COALESCE((SELECT MAX(id) FROM invoices), 1), true);
SELECT setval(pg_get_serial_sequence('customers', 'id'), COALESCE((SELECT MAX(id) FROM customers), 1), true);
SELECT setval(pg_get_serial_sequence('sales_history', 'id'), COALESCE((SELECT MAX(id) FROM sales_history), 1), true);
SELECT setval(pg_get_serial_sequence('product_returns', 'id'), COALESCE((SELECT MAX(id) FROM product_returns), 1), true);
SELECT setval(pg_get_serial_sequence('billing_profiles', 'id'), COALESCE((SELECT MAX(id) FROM billing_profiles), 1), true);
SELECT setval(pg_get_serial_sequence('suppliers', 'id'), COALESCE((SELECT MAX(id) FROM suppliers), 1), true);
SELECT setval(pg_get_serial_sequence('purchases', 'id'), COALESCE((SELECT MAX(id) FROM purchases), 1), true);
SELECT setval(pg_get_serial_sequence('purchase_items', 'id'), COALESCE((SELECT MAX(id) FROM purchase_items), 1), true);
SELECT setval(pg_get_serial_sequence('store_settings', 'id'), COALESCE((SELECT MAX(id) FROM store_settings), 1), true);
SELECT setval(pg_get_serial_sequence('customer_payments', 'id'), COALESCE((SELECT MAX(id) FROM customer_payments), 1), true);

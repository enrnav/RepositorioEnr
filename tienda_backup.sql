-- ========================================================
-- TIENDA DATABASE BACKUP (SCHEMA & DATA) DUMP
-- Generated: 2026-06-28T15:25:33.879428
-- Compatible with PostgreSQL
-- ========================================================

BEGIN;

-- ========================================================
-- 1. ESTRUCTURA DE LAS TABLAS (SCHEMA)
-- ========================================================

-- Schema for table billing_profiles
CREATE TABLE IF NOT EXISTS billing_profiles (
	id SERIAL NOT NULL, 
	rfc VARCHAR, 
	razon_social VARCHAR, 
	regimen_fiscal VARCHAR, 
	codigo_postal VARCHAR, 
	correo VARCHAR, 
	PRIMARY KEY (id)
);


-- Schema for table cash_movements
CREATE TABLE IF NOT EXISTS cash_movements (
	id SERIAL NOT NULL, 
	shift_id INTEGER, 
	type VARCHAR, 
	amount FLOAT, 
	reason VARCHAR, 
	created_at VARCHAR, 
	PRIMARY KEY (id)
);


-- Schema for table customers
CREATE TABLE IF NOT EXISTS customers (
	id SERIAL NOT NULL, 
	name VARCHAR, 
	phone VARCHAR, 
	email VARCHAR, 
	credit_limit FLOAT, 
	current_balance FLOAT, 
	PRIMARY KEY (id)
);


-- Schema for table invoices
CREATE TABLE IF NOT EXISTS invoices (
	id SERIAL NOT NULL, 
	uuid VARCHAR, 
	monto_total FLOAT, 
	xml_url VARCHAR, 
	pdf_url VARCHAR, 
	created_at VARCHAR, 
	status VARCHAR, 
	PRIMARY KEY (id)
);


-- Schema for table notifications
CREATE TABLE IF NOT EXISTS notifications (
	id SERIAL NOT NULL, 
	message VARCHAR, 
	is_read BOOLEAN, 
	PRIMARY KEY (id)
);


-- Schema for table product_returns
CREATE TABLE IF NOT EXISTS product_returns (
	id SERIAL NOT NULL, 
	sale_id INTEGER, 
	product_id INTEGER, 
	quantity INTEGER, 
	price FLOAT, 
	reason VARCHAR, 
	authorized_by VARCHAR, 
	created_at VARCHAR, 
	PRIMARY KEY (id)
);


-- Schema for table products
CREATE TABLE IF NOT EXISTS products (
	id SERIAL NOT NULL, 
	name VARCHAR, 
	barcode VARCHAR, 
	price FLOAT, 
	cost_price FLOAT, 
	quantity INTEGER, 
	min_stock INTEGER, 
	sold INTEGER, 
	entry_date VARCHAR, 
	image VARCHAR, 
	sat_key VARCHAR, 
	sat_unit_key VARCHAR, 
	PRIMARY KEY (id)
);


-- Schema for table shifts
CREATE TABLE IF NOT EXISTS shifts (
	id SERIAL NOT NULL, 
	user_id INTEGER, 
	start_time VARCHAR, 
	end_time VARCHAR, 
	initial_cash FLOAT, 
	final_cash_real FLOAT, 
	final_cash_expected FLOAT, 
	difference FLOAT, 
	status VARCHAR, 
	PRIMARY KEY (id)
);


-- Schema for table store_settings
CREATE TABLE IF NOT EXISTS store_settings (
	id SERIAL NOT NULL, 
	store_name VARCHAR, 
	rfc VARCHAR, 
	phone VARCHAR, 
	email VARCHAR, 
	address VARCHAR, 
	tax_rate FLOAT, 
	ticket_footer VARCHAR, 
	PRIMARY KEY (id)
);


-- Schema for table suppliers
CREATE TABLE IF NOT EXISTS suppliers (
	id SERIAL NOT NULL, 
	name VARCHAR, 
	rfc VARCHAR, 
	phone VARCHAR, 
	email VARCHAR, 
	address VARCHAR, 
	notes VARCHAR, 
	PRIMARY KEY (id)
);


-- Schema for table users
CREATE TABLE IF NOT EXISTS users (
	id SERIAL NOT NULL, 
	username VARCHAR, 
	full_name VARCHAR, 
	hashed_password VARCHAR, 
	role VARCHAR, 
	PRIMARY KEY (id)
);


-- Schema for table customer_payments
CREATE TABLE IF NOT EXISTS customer_payments (
	id SERIAL NOT NULL, 
	customer_id INTEGER, 
	shift_id INTEGER, 
	user_id INTEGER, 
	amount FLOAT, 
	created_at VARCHAR, 
	notes VARCHAR, 
	PRIMARY KEY (id), 
	FOREIGN KEY(customer_id) REFERENCES customers (id), 
	FOREIGN KEY(user_id) REFERENCES users (id)
);


-- Schema for table product_variants
CREATE TABLE IF NOT EXISTS product_variants (
	id SERIAL NOT NULL, 
	product_id INTEGER, 
	name VARCHAR, 
	barcode VARCHAR, 
	cost_price FLOAT, 
	price FLOAT, 
	quantity INTEGER, 
	sold INTEGER, 
	sat_key VARCHAR, 
	sat_unit_key VARCHAR, 
	PRIMARY KEY (id), 
	FOREIGN KEY(product_id) REFERENCES products (id)
);


-- Schema for table purchases
CREATE TABLE IF NOT EXISTS purchases (
	id SERIAL NOT NULL, 
	supplier_id INTEGER, 
	invoice_number VARCHAR, 
	total_cost FLOAT, 
	created_at VARCHAR, 
	notes VARCHAR, 
	user_id INTEGER, 
	PRIMARY KEY (id), 
	FOREIGN KEY(supplier_id) REFERENCES suppliers (id), 
	FOREIGN KEY(user_id) REFERENCES users (id)
);


-- Schema for table sales_history
CREATE TABLE IF NOT EXISTS sales_history (
	id SERIAL NOT NULL, 
	product_id INTEGER, 
	variant_id INTEGER, 
	shift_id INTEGER, 
	user_id INTEGER, 
	quantity INTEGER, 
	price_sold FLOAT, 
	cost_price_sold FLOAT, 
	discount FLOAT, 
	payment_method VARCHAR, 
	cash_amount FLOAT, 
	card_amount FLOAT, 
	created_at VARCHAR, 
	is_cancelled BOOLEAN, 
	cancel_reason VARCHAR, 
	authorized_by VARCHAR, 
	invoice_id INTEGER, 
	customer_id INTEGER, 
	PRIMARY KEY (id), 
	FOREIGN KEY(invoice_id) REFERENCES invoices (id), 
	FOREIGN KEY(customer_id) REFERENCES customers (id)
);


-- Schema for table purchase_items
CREATE TABLE IF NOT EXISTS purchase_items (
	id SERIAL NOT NULL, 
	purchase_id INTEGER, 
	product_id INTEGER, 
	variant_id INTEGER, 
	quantity INTEGER, 
	cost_price FLOAT, 
	price FLOAT, 
	PRIMARY KEY (id), 
	FOREIGN KEY(purchase_id) REFERENCES purchases (id), 
	FOREIGN KEY(product_id) REFERENCES products (id), 
	FOREIGN KEY(variant_id) REFERENCES product_variants (id)
);

-- ========================================================
-- FUNCTIONS & PROCEDURES
-- ========================================================

CREATE OR REPLACE FUNCTION vender_producto(
    p_producto_id INT,
    p_cantidad INT,
    p_fecha_venta VARCHAR
) RETURNS VOID AS $$
DECLARE
    v_stock_actual INT;
BEGIN
    -- 1. Bloqueamos la fila del producto
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

CREATE OR REPLACE FUNCTION cancelar_venta(
    p_sale_id INT,
    p_cancel_reason VARCHAR
) RETURNS VOID AS $$
DECLARE
    v_product_id INT;
    v_quantity INT;
    v_is_cancelled BOOLEAN;
BEGIN
    -- 1. Obtener detalles de la venta y bloquear
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


-- ========================================================
-- 2. DATOS DE LAS TABLAS (INSERT INSERTS)
-- ========================================================

-- Data for table store_settings
TRUNCATE TABLE store_settings CASCADE;
INSERT INTO store_settings (id, store_name, rfc, phone, email, address, tax_rate, ticket_footer) VALUES (1, 'ABARROTES ED & E', 'AED180425EE3', '8112345678', 'ventas@abarrotesede.com', 'Av. Constitución #450, Monterrey, N.L. C.P. 64000', 16.0, '¡Gracias por su compra!');
SELECT setval(pg_get_serial_sequence('store_settings', 'id'), COALESCE((SELECT MAX(id)+1 FROM store_settings), 1), false);

-- Data for table users
TRUNCATE TABLE users CASCADE;
INSERT INTO users (id, username, full_name, hashed_password, role) VALUES (13, 'admin', 'Administrador', '$2b$12$rKRLblNf7H/RK03QVMeRT.3QV1UvDehA8q/Zk8uZ/6asDsZoA0buq', 'admin');
INSERT INTO users (id, username, full_name, hashed_password, role) VALUES (14, 'supervisor', 'Supervisor', '$2b$12$pdFhf.VskIwUSGAXe/YG.OoVw2kntPifbZxSJbh226PuiSaOU1yl6', 'supervisor');
INSERT INTO users (id, username, full_name, hashed_password, role) VALUES (15, 'wenseslao', 'Wenseslao', '$2b$12$f8Y85lbcXMvbOFDl2BrpM.VWSCRbjRk/6Yx8YveYmXaAhDlYL10XG', 'cajero');
SELECT setval(pg_get_serial_sequence('users', 'id'), COALESCE((SELECT MAX(id)+1 FROM users), 1), false);

-- Data for table suppliers
TRUNCATE TABLE suppliers CASCADE;
INSERT INTO suppliers (id, name, rfc, phone, email, address, notes) VALUES (1, 'BIMBO S.A de C.V', NULL, '55667733', 'bimbo.1@net.com', 'cualquier sucursal', 'El proveedor siempre viene a las 10 am.');
SELECT setval(pg_get_serial_sequence('suppliers', 'id'), COALESCE((SELECT MAX(id)+1 FROM suppliers), 1), false);

-- Data for table customers
TRUNCATE TABLE customers CASCADE;
INSERT INTO customers (id, name, phone, email, credit_limit, current_balance) VALUES (1, 'Martin Perez', '5562883600', 'martin@gmail.com', 1000.0, -100.0);
SELECT setval(pg_get_serial_sequence('customers', 'id'), COALESCE((SELECT MAX(id)+1 FROM customers), 1), false);

-- Data for table products
TRUNCATE TABLE products CASCADE;
INSERT INTO products (id, name, barcode, price, cost_price, quantity, min_stock, sold, entry_date, image, sat_key, sat_unit_key) VALUES (2, 'CHIPS SAL CH', NULL, 20.0, 0.0, 10, 3, 3, NULL, NULL, '01010101', 'H87');
INSERT INTO products (id, name, barcode, price, cost_price, quantity, min_stock, sold, entry_date, image, sat_key, sat_unit_key) VALUES (5, 'BUBALOOO', NULL, 2.5, 0.0, 29, 3, 26, NULL, NULL, '01010101', 'H87');
INSERT INTO products (id, name, barcode, price, cost_price, quantity, min_stock, sold, entry_date, image, sat_key, sat_unit_key) VALUES (8, 'SHAMPO DE SOBRE', NULL, 3.5, 0.0, 32, 3, 0, NULL, NULL, '01010101', 'H87');
INSERT INTO products (id, name, barcode, price, cost_price, quantity, min_stock, sold, entry_date, image, sat_key, sat_unit_key) VALUES (6, 'MANZANITA SOL 3lt', NULL, 40.0, 0.0, 12, 3, 0, NULL, NULL, '01010101', 'H87');
INSERT INTO products (id, name, barcode, price, cost_price, quantity, min_stock, sold, entry_date, image, sat_key, sat_unit_key) VALUES (1, 'COCA-COLA 600ml', NULL, 22.0, 0.0, 3, 3, 2, NULL, NULL, '01010101', 'H87');
INSERT INTO products (id, name, barcode, price, cost_price, quantity, min_stock, sold, entry_date, image, sat_key, sat_unit_key) VALUES (3, 'BUÑUELOS', NULL, 26.5, 0.0, 50, 3, 4, NULL, NULL, '01010101', 'H87');
INSERT INTO products (id, name, barcode, price, cost_price, quantity, min_stock, sold, entry_date, image, sat_key, sat_unit_key) VALUES (9, 'SALSA VALENTINA 350 ml', '097339000214', 22.0, 0.0, 16, 3, 7, '2026-05-29', NULL, '01010101', 'H87');
INSERT INTO products (id, name, barcode, price, cost_price, quantity, min_stock, sold, entry_date, image, sat_key, sat_unit_key) VALUES (7, 'LECHE LALA 1 lt', NULL, 23.5, 0.0, 13, 3, 0, NULL, NULL, '01010101', 'H87');
SELECT setval(pg_get_serial_sequence('products', 'id'), COALESCE((SELECT MAX(id)+1 FROM products), 1), false);

-- Data for table customer_payments
TRUNCATE TABLE customer_payments CASCADE;
INSERT INTO customer_payments (id, customer_id, shift_id, user_id, amount, created_at, notes) VALUES (1, 1, NULL, 13, 100.0, '2026-06-28T20:19:02.412884', 'compro café,leche,huevo,tortillas');
SELECT setval(pg_get_serial_sequence('customer_payments', 'id'), COALESCE((SELECT MAX(id)+1 FROM customer_payments), 1), false);

-- Data for table sales_history
TRUNCATE TABLE sales_history CASCADE;
INSERT INTO sales_history (id, product_id, variant_id, shift_id, user_id, quantity, price_sold, cost_price_sold, discount, payment_method, cash_amount, card_amount, created_at, is_cancelled, cancel_reason, authorized_by, invoice_id, customer_id) VALUES (1, 1, NULL, NULL, NULL, 1, 22.0, 0.0, 0.0, 'efectivo', 0.0, 0.0, '2026-05-19T16:58:45.282614', False, NULL, NULL, NULL, NULL);
INSERT INTO sales_history (id, product_id, variant_id, shift_id, user_id, quantity, price_sold, cost_price_sold, discount, payment_method, cash_amount, card_amount, created_at, is_cancelled, cancel_reason, authorized_by, invoice_id, customer_id) VALUES (2, 2, NULL, NULL, NULL, 1, 20.0, 0.0, 0.0, 'efectivo', 0.0, 0.0, '2026-05-19T16:58:47.550392', False, NULL, NULL, NULL, NULL);
INSERT INTO sales_history (id, product_id, variant_id, shift_id, user_id, quantity, price_sold, cost_price_sold, discount, payment_method, cash_amount, card_amount, created_at, is_cancelled, cancel_reason, authorized_by, invoice_id, customer_id) VALUES (3, 2, NULL, NULL, NULL, 1, 20.0, 0.0, 0.0, 'efectivo', 0.0, 0.0, '2026-05-19T16:58:49.387948', False, NULL, NULL, NULL, NULL);
INSERT INTO sales_history (id, product_id, variant_id, shift_id, user_id, quantity, price_sold, cost_price_sold, discount, payment_method, cash_amount, card_amount, created_at, is_cancelled, cancel_reason, authorized_by, invoice_id, customer_id) VALUES (4, 5, NULL, NULL, NULL, 1, 2.5, 0.0, 0.0, 'efectivo', 0.0, 0.0, '2026-05-27T14:09:47.429392', False, NULL, NULL, NULL, NULL);
INSERT INTO sales_history (id, product_id, variant_id, shift_id, user_id, quantity, price_sold, cost_price_sold, discount, payment_method, cash_amount, card_amount, created_at, is_cancelled, cancel_reason, authorized_by, invoice_id, customer_id) VALUES (5, 1, NULL, NULL, NULL, 1, 22.0, 0.0, 0.0, 'efectivo', 0.0, 0.0, '2026-05-27T14:09:47.465657', False, NULL, NULL, NULL, NULL);
INSERT INTO sales_history (id, product_id, variant_id, shift_id, user_id, quantity, price_sold, cost_price_sold, discount, payment_method, cash_amount, card_amount, created_at, is_cancelled, cancel_reason, authorized_by, invoice_id, customer_id) VALUES (6, 5, NULL, NULL, NULL, 5, 2.5, 0.0, 0.0, 'efectivo', 0.0, 0.0, '2026-05-27T14:13:22.323204', False, NULL, NULL, NULL, NULL);
INSERT INTO sales_history (id, product_id, variant_id, shift_id, user_id, quantity, price_sold, cost_price_sold, discount, payment_method, cash_amount, card_amount, created_at, is_cancelled, cancel_reason, authorized_by, invoice_id, customer_id) VALUES (7, 5, NULL, NULL, NULL, 2, 2.5, 0.0, 0.0, 'efectivo', 0.0, 0.0, '2026-05-27T17:42:06.959643', False, NULL, NULL, NULL, NULL);
INSERT INTO sales_history (id, product_id, variant_id, shift_id, user_id, quantity, price_sold, cost_price_sold, discount, payment_method, cash_amount, card_amount, created_at, is_cancelled, cancel_reason, authorized_by, invoice_id, customer_id) VALUES (8, 3, NULL, NULL, NULL, 1, 26.5, 0.0, 0.0, 'efectivo', 0.0, 0.0, '2026-05-27T17:43:59.400598', False, NULL, NULL, NULL, NULL);
INSERT INTO sales_history (id, product_id, variant_id, shift_id, user_id, quantity, price_sold, cost_price_sold, discount, payment_method, cash_amount, card_amount, created_at, is_cancelled, cancel_reason, authorized_by, invoice_id, customer_id) VALUES (9, 9, NULL, NULL, NULL, 1, 22.0, 0.0, 0.0, 'efectivo', 0.0, 0.0, '2026-05-29T15:52:41.375032', False, NULL, NULL, NULL, NULL);
INSERT INTO sales_history (id, product_id, variant_id, shift_id, user_id, quantity, price_sold, cost_price_sold, discount, payment_method, cash_amount, card_amount, created_at, is_cancelled, cancel_reason, authorized_by, invoice_id, customer_id) VALUES (10, 9, NULL, NULL, NULL, 1, 22.0, 0.0, 0.0, 'efectivo', 0.0, 0.0, '2026-05-29T15:53:43.718369', False, NULL, NULL, NULL, NULL);
INSERT INTO sales_history (id, product_id, variant_id, shift_id, user_id, quantity, price_sold, cost_price_sold, discount, payment_method, cash_amount, card_amount, created_at, is_cancelled, cancel_reason, authorized_by, invoice_id, customer_id) VALUES (11, 9, NULL, NULL, NULL, 1, 22.0, 0.0, 0.0, 'efectivo', 0.0, 0.0, '2026-05-29T15:54:03.634140', False, NULL, NULL, NULL, NULL);
INSERT INTO sales_history (id, product_id, variant_id, shift_id, user_id, quantity, price_sold, cost_price_sold, discount, payment_method, cash_amount, card_amount, created_at, is_cancelled, cancel_reason, authorized_by, invoice_id, customer_id) VALUES (12, 9, NULL, NULL, NULL, 1, 22.0, 0.0, 0.0, 'efectivo', 0.0, 0.0, '2026-05-29T15:54:25.203627', False, NULL, NULL, NULL, NULL);
INSERT INTO sales_history (id, product_id, variant_id, shift_id, user_id, quantity, price_sold, cost_price_sold, discount, payment_method, cash_amount, card_amount, created_at, is_cancelled, cancel_reason, authorized_by, invoice_id, customer_id) VALUES (13, 9, NULL, NULL, NULL, 1, 22.0, 0.0, 0.0, 'efectivo', 0.0, 0.0, '2026-05-29T21:14:41.526374', False, NULL, NULL, NULL, NULL);
INSERT INTO sales_history (id, product_id, variant_id, shift_id, user_id, quantity, price_sold, cost_price_sold, discount, payment_method, cash_amount, card_amount, created_at, is_cancelled, cancel_reason, authorized_by, invoice_id, customer_id) VALUES (14, 9, NULL, NULL, NULL, 1, 22.0, 0.0, 0.0, 'efectivo', 0.0, 0.0, '2026-05-30T20:45:09.410604', False, NULL, NULL, NULL, NULL);
INSERT INTO sales_history (id, product_id, variant_id, shift_id, user_id, quantity, price_sold, cost_price_sold, discount, payment_method, cash_amount, card_amount, created_at, is_cancelled, cancel_reason, authorized_by, invoice_id, customer_id) VALUES (15, 9, NULL, NULL, NULL, 1, 22.0, 0.0, 0.0, 'efectivo', 0.0, 0.0, '2026-05-30T21:49:36.986190', False, NULL, NULL, NULL, NULL);
SELECT setval(pg_get_serial_sequence('sales_history', 'id'), COALESCE((SELECT MAX(id)+1 FROM sales_history), 1), false);

COMMIT;
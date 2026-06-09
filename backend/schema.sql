CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR UNIQUE,
    full_name VARCHAR,
    hashed_password VARCHAR
);
CREATE INDEX IF NOT EXISTS ix_users_id ON users (id);
CREATE INDEX IF NOT EXISTS ix_users_username ON users (username);

CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    name VARCHAR,
    price FLOAT,
    quantity INTEGER,
    sold INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS ix_products_id ON products (id);
CREATE INDEX IF NOT EXISTS ix_products_name ON products (name);

CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    message VARCHAR,
    is_read BOOLEAN DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS ix_notifications_id ON notifications (id);

CREATE TABLE IF NOT EXISTS sales_history (
    id SERIAL PRIMARY KEY,
    product_id INTEGER,
    quantity INTEGER,
    created_at VARCHAR
);
CREATE INDEX IF NOT EXISTS ix_sales_history_id ON sales_history (id);
CREATE INDEX IF NOT EXISTS ix_sales_history_product_id ON sales_history (product_id);

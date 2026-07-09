from database import engine
from sqlalchemy import text
import models

def run_migration():
    try:
        models.Base.metadata.create_all(bind=engine)
        print("Tablas creadas/verificadas desde modelos con Base.metadata.create_all.")
    except Exception as e:
        print("Advertencia o error al crear tablas base (puede que ya existan):", e)

    with engine.connect() as conn:
        # Multi-tenancy Migrations
        # 1. Asegurar tabla tenants (aunque Base.metadata.create_all lo hace, por seguridad lo corremos)
        try:
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS tenants (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR NOT NULL,
                    subdomain VARCHAR UNIQUE,
                    subscription_status VARCHAR DEFAULT 'active',
                    plan_tier VARCHAR DEFAULT 'free',
                    created_at VARCHAR
                );
                CREATE INDEX IF NOT EXISTS ix_tenants_id ON tenants (id);
                CREATE INDEX IF NOT EXISTS ix_tenants_subdomain ON tenants (subdomain);
            """))
            conn.commit()
            print("Tabla 'tenants' creada/verificada.")
        except Exception as e:
            conn.rollback()
            print("Error creando tabla tenants:", e)

        # 2. Agregar columna tenant_id a todas las tablas existentes
        tenant_tables = [
            "users", "products", "product_variants", "notifications", "shifts", 
            "cash_movements", "sales_history", "product_returns", "billing_profiles", 
            "invoices", "suppliers", "purchases", "store_settings", "customers", 
            "customer_payments"
        ]
        for tbl in tenant_tables:
            try:
                conn.execute(text(f"ALTER TABLE {tbl} ADD COLUMN tenant_id INTEGER REFERENCES tenants(id)"))
                conn.commit()
                print(f"Columna 'tenant_id' agregada a {tbl}.")
            except Exception as e:
                conn.rollback()
                print(f"Columna 'tenant_id' en {tbl} ya existe o falló:", e)

        # 3. Crear tenant por defecto si no existe
        default_tenant_id = None
        try:
            res = conn.execute(text("SELECT id FROM tenants WHERE subdomain = 'principal' LIMIT 1")).fetchone()
            if not res:
                from datetime import datetime
                now_iso = datetime.utcnow().isoformat()
                conn.execute(text("""
                    INSERT INTO tenants (name, subdomain, subscription_status, plan_tier, created_at)
                    VALUES ('Principal', 'principal', 'active', 'premium', :created_at)
                """), {"created_at": now_iso})
                conn.commit()
                res = conn.execute(text("SELECT id FROM tenants WHERE subdomain = 'principal' LIMIT 1")).fetchone()
                print("Tenant por defecto 'Principal' creado.")
            default_tenant_id = res[0]
        except Exception as e:
            conn.rollback()
            print("Error obteniendo/creando tenant por defecto:", e)

        # 4. Asignar todos los registros existentes al tenant por defecto si es NULL
        if default_tenant_id:
            for tbl in tenant_tables:
                try:
                    conn.execute(text(f"UPDATE {tbl} SET tenant_id = :tenant_id WHERE tenant_id IS NULL"), {"tenant_id": default_tenant_id})
                    conn.commit()
                    print(f"Registros de {tbl} migrados al tenant por defecto.")
                except Exception as e:
                    conn.rollback()
                    print(f"Error migrando registros de {tbl}:", e)

        try:
            conn.execute(text("ALTER TABLE users ADD COLUMN role VARCHAR DEFAULT 'user'"))
            conn.commit()
            print("Columna 'role' agregada.")
        except Exception as e:
            conn.rollback()
            print("Error agregando columna (tal vez ya existe):", e)
        
        try:
            conn.execute(text("ALTER TABLE products ADD COLUMN barcode VARCHAR"))
            conn.commit()
            print("Columna 'barcode' agregada a products.")
        except Exception as e:
            conn.rollback()
            print("Error agregando columna barcode (tal vez ya existe):", e)
        
        try:
            conn.execute(text("UPDATE users SET role = 'admin' WHERE username = 'enr'"))
            conn.commit()
            print("Usuario 'enr' actualizado a admin.")
        except Exception as e:
            conn.rollback()
            print("Error actualizando usuario:", e)

        # Columnas adicionales para products
        products_cols = [
            ("cost_price", "FLOAT DEFAULT 0.0"),
            ("min_stock", "INTEGER DEFAULT 3"),
            ("image", "VARCHAR"),
            ("entry_date", "VARCHAR"),
            ("sat_key", "VARCHAR DEFAULT '01010101'"),
            ("sat_unit_key", "VARCHAR DEFAULT 'H87'")
        ]
        for col, col_type in products_cols:
            try:
                conn.execute(text(f"ALTER TABLE products ADD COLUMN {col} {col_type}"))
                conn.commit()
                print(f"Columna '{col}' agregada a products.")
            except Exception as e:
                conn.rollback()
                print(f"Error agregando '{col}' a products (tal vez ya existe):", e)

        # Columnas adicionales para product_variants
        variants_cols = [
            ("sat_key", "VARCHAR DEFAULT '01010101'"),
            ("sat_unit_key", "VARCHAR DEFAULT 'H87'")
        ]
        for col, col_type in variants_cols:
            try:
                conn.execute(text(f"ALTER TABLE product_variants ADD COLUMN {col} {col_type}"))
                conn.commit()
                print(f"Columna '{col}' agregada a product_variants.")
            except Exception as e:
                conn.rollback()
                print(f"Error agregando '{col}' a product_variants (tal vez ya existe):", e)

        # Columnas adicionales para sales_history
        sales_history_cols = [
            ("is_cancelled", "BOOLEAN DEFAULT FALSE"),
            ("cancel_reason", "VARCHAR"),
            ("variant_id", "INTEGER"),
            ("shift_id", "INTEGER"),
            ("user_id", "INTEGER"),
            ("price_sold", "FLOAT"),
            ("cost_price_sold", "FLOAT DEFAULT 0.0"),
            ("discount", "FLOAT DEFAULT 0.0"),
            ("payment_method", "VARCHAR(50) DEFAULT 'efectivo'"),
            ("cash_amount", "FLOAT DEFAULT 0.0"),
            ("card_amount", "FLOAT DEFAULT 0.0"),
            ("authorized_by", "VARCHAR"),
            ("invoice_id", "INTEGER"),
            ("customer_id", "INTEGER")
        ]
        for col, col_type in sales_history_cols:
            try:
                conn.execute(text(f"ALTER TABLE sales_history ADD COLUMN {col} {col_type}"))
                conn.commit()
                print(f"Columna '{col}' agregada a sales_history.")
            except Exception as e:
                conn.rollback()
                print(f"Error agregando '{col}' a sales_history (tal vez ya existe):", e)

        # Backfill de datos antiguos de ventas
        try:
            conn.execute(text("""
                UPDATE sales_history 
                SET price_sold = (SELECT price FROM products WHERE products.id = sales_history.product_id)
                WHERE price_sold IS NULL;
            """))
            conn.execute(text("""
                UPDATE sales_history 
                SET cost_price_sold = (SELECT cost_price FROM products WHERE products.id = sales_history.product_id)
                WHERE cost_price_sold IS NULL;
            """))
            conn.commit()
            print("Backfill de precios históricos completado.")
        except Exception as e:
            conn.rollback()
            print("Error durante backfill de ventas:", e)

        # Crear tabla product_returns si no existe
        try:
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS product_returns (
                    id SERIAL PRIMARY KEY,
                    sale_id INTEGER,
                    product_id INTEGER,
                    quantity INTEGER,
                    price FLOAT,
                    reason VARCHAR,
                    authorized_by VARCHAR,
                    created_at VARCHAR
                );
                CREATE INDEX IF NOT EXISTS ix_product_returns_id ON product_returns (id);
                CREATE INDEX IF NOT EXISTS ix_product_returns_sale_id ON product_returns (sale_id);
            """))
            conn.commit()
            print("Tabla 'product_returns' creada/verificada.")
        except Exception as e:
            conn.rollback()
            print("Error creando la tabla product_returns:", e)

        # Columna authorized_by en product_returns si la tabla ya existía sin ella
        try:
            conn.execute(text("ALTER TABLE product_returns ADD COLUMN authorized_by VARCHAR"))
            conn.commit()
            print("Columna 'authorized_by' agregada a product_returns.")
        except Exception as e:
            conn.rollback()
            print("Error agregando 'authorized_by' a product_returns (tal vez ya existe):", e)

        try:
            stored_proc_sql = """
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
            """
            conn.execute(text(stored_proc_sql))
            conn.commit()
            print("Función de base de datos 'vender_producto' creada/actualizada exitosamente.")
        except Exception as e:
            conn.rollback()
            print("Error creando la función 'vender_producto':", e)

        try:
            cancel_proc_sql = """
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
            """
            conn.execute(text(cancel_proc_sql))
            conn.commit()
            print("Función de base de datos 'cancelar_venta' creada/actualizada exitosamente.")
        except Exception as e:
            conn.rollback()
            print("Error creando la función 'cancelar_venta':", e)

        # Columnas adicionales para store_settings
        settings_cols = [
            ("logo_url", "VARCHAR"),
            ("primary_color", "VARCHAR DEFAULT '#064E3B'"),
            ("accent_color", "VARCHAR DEFAULT '#DC2626'")
        ]
        for col, col_type in settings_cols:
            try:
                conn.execute(text(f"ALTER TABLE store_settings ADD COLUMN {col} {col_type}"))
                conn.commit()
                print(f"Columna '{col}' agregada a store_settings.")
            except Exception as e:
                conn.rollback()
                print(f"Columna '{col}' en store_settings ya existe o falló:", e)

        # Columnas adicionales para tenants
        tenant_cols = [
            ("stripe_customer_id", "VARCHAR"),
            ("stripe_subscription_id", "VARCHAR"),
            ("subscription_end", "VARCHAR"),
            ("last_payment_date", "VARCHAR")
        ]
        for col, col_type in tenant_cols:
            try:
                conn.execute(text(f"ALTER TABLE tenants ADD COLUMN {col} {col_type}"))
                conn.commit()
                print(f"Columna '{col}' agregada a tenants.")
            except Exception as e:
                conn.rollback()
                print(f"Columna '{col}' en tenants ya existe o falló:", e)



        # 5. Sincronizar secuencias seriales de clave primaria (evita UniqueViolation al registrar datos nuevos)
        print("Sincronizando secuencias de clave primaria...")
        for tbl in tenant_tables + ["tenants"]:
            try:
                seq_res = conn.execute(text(f"SELECT pg_get_serial_sequence('{tbl}', 'id')")).fetchone()
                if seq_res and seq_res[0]:
                    seq_name = seq_res[0]
                    conn.execute(text(f"SELECT setval('{seq_name}', COALESCE((SELECT MAX(id) FROM {tbl}), 1))"))
                    conn.commit()
            except Exception as e:
                conn.rollback()
                print(f"Error al sincronizar secuencia para {tbl}:", e)
        print("Secuencias de clave primaria sincronizadas correctamente.")

if __name__ == "__main__":
    run_migration()


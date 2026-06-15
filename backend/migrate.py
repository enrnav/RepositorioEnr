from database import engine
from sqlalchemy import text

def run_migration():
    with engine.connect() as conn:
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
            conn.execute(text("ALTER TABLE sales_history ADD COLUMN is_cancelled BOOLEAN DEFAULT FALSE"))
            conn.commit()
            print("Columna 'is_cancelled' agregada a sales_history.")
        except Exception as e:
            conn.rollback()
            print("Error agregando columna is_cancelled (tal vez ya existe):", e)

        try:
            conn.execute(text("ALTER TABLE sales_history ADD COLUMN cancel_reason VARCHAR"))
            conn.commit()
            print("Columna 'cancel_reason' agregada a sales_history.")
        except Exception as e:
            conn.rollback()
            print("Error agregando columna cancel_reason (tal vez ya existe):", e)

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



if __name__ == "__main__":
    run_migration()


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


if __name__ == "__main__":
    run_migration()

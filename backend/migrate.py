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
        # Add card columns if they don't exist
        for col_name, col_type in [
            ("metodo_pago_guardado", "VARCHAR"),
            ("tarjeta_marca", "VARCHAR"),
            ("tarjeta_ultimos4", "VARCHAR"),
            ("tarjeta_titular", "VARCHAR"),
            ("tarjeta_vencimiento", "VARCHAR")
        ]:
            try:
                conn.execute(text(f"ALTER TABLE inquilinos ADD COLUMN IF NOT EXISTS {col_name} {col_type}"))
                conn.commit()
                print(f"Columna {col_name} verificada/añadida a inquilinos.")
            except Exception as e:
                conn.rollback()
                print(f"Error al verificar/añadir columna {col_name}:", e)

        # 1. Crear inquilino por defecto si no existe
        default_tenant_id = None
        try:
            res = conn.execute(text("SELECT id FROM inquilinos WHERE subdominio = 'principal' LIMIT 1")).fetchone()
            if not res:
                from datetime import datetime
                now_iso = datetime.utcnow().isoformat()
                conn.execute(text("""
                    INSERT INTO inquilinos (nombre, subdominio, estado_suscripcion, nivel_plan, creado_en)
                    VALUES ('Principal', 'principal', 'active', 'premium', :creado_en)
                """), {"creado_en": now_iso})
                conn.commit()
                res = conn.execute(text("SELECT id FROM inquilinos WHERE subdominio = 'principal' LIMIT 1")).fetchone()
                print("Inquilino por defecto 'Principal' creado.")
            default_tenant_id = res[0]
        except Exception as e:
            conn.rollback()
            print("Error obteniendo/creando inquilino por defecto:", e)

        # 2. Asegurar que el usuario 'enr' sea admin en la tabla de usuarios
        try:
            conn.execute(text("UPDATE usuarios SET rol = 'admin' WHERE nombre_usuario = 'enr'"))
            conn.commit()
            print("Usuario 'enr' actualizado a admin.")
        except Exception as e:
            conn.rollback()
            print("Error actualizando usuario admin 'enr':", e)

        # 3. Procedimiento almacenado vender_producto en español
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
                SELECT cantidad INTO v_stock_actual
                FROM productos
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
                UPDATE productos
                SET cantidad = cantidad - p_cantidad,
                    vendido = vendido + p_cantidad
                WHERE id = p_producto_id;

                -- 5. Insertamos en historial
                INSERT INTO historial_ventas (producto_id, cantidad, creado_en)
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

        # 4. Procedimiento almacenado cancelar_venta en español
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
                SELECT producto_id, cantidad, cancelado INTO v_product_id, v_quantity, v_is_cancelled
                FROM historial_ventas
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
                UPDATE historial_ventas
                SET cancelado = TRUE,
                    motivo_cancelacion = p_cancel_reason
                WHERE id = p_sale_id;

                -- 5. Devolver stock al producto
                UPDATE productos
                SET cantidad = cantidad + v_quantity,
                    vendido = vendido - v_quantity
                WHERE id = v_product_id;

                -- 6. Insertar registro en devoluciones_producto
                INSERT INTO devoluciones_producto (venta_id, producto_id, cantidad, precio, motivo, creado_en)
                SELECT p_sale_id, v_product_id, v_quantity, precio, p_cancel_reason, TO_CHAR(NOW(), 'YYYY-MM-DD"T"HH24:MI:SS')
                FROM productos
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

        # 5. Sincronizar secuencias seriales de clave primaria (evita UniqueViolation)
        print("Sincronizando secuencias de clave primaria...")
        tablas_sistema = [
            "inquilinos", "usuarios", "productos", "variantes_producto", "notificaciones", 
            "turnos", "movimientos_caja", "historial_ventas", "devoluciones_producto", 
            "perfiles_facturacion", "facturas", "proveedores", "compras", "elementos_compra", 
            "configuraciones_tienda", "clientes", "pagos_cliente", "bitacora_usuarios"
        ]
        for tbl in tablas_sistema:
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

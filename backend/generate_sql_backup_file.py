import os
import sys
from datetime import datetime

# Adjust Python path to include the backend folder
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import SessionLocal, engine
import models
from models import Base
from sqlalchemy.schema import CreateTable
from sqlalchemy.dialects import postgresql

def main():
    print("Iniciando respaldo completo (Estructura de Tablas y Datos) a SQL...")
    db = SessionLocal()
    try:
        sql_lines = []
        sql_lines.append("-- ========================================================")
        sql_lines.append("-- TIENDA DATABASE BACKUP (SCHEMA & DATA) DUMP")
        sql_lines.append(f"-- Generated: {datetime.now().isoformat()}")
        sql_lines.append("-- Compatible with PostgreSQL")
        sql_lines.append("-- ========================================================")
        sql_lines.append("")
        sql_lines.append("BEGIN;")
        sql_lines.append("")
        
        # 1. GENERATE SCHEMA (CREATE TABLE STATEMENTS)
        sql_lines.append("-- ========================================================")
        sql_lines.append("-- 1. ESTRUCTURA DE LAS TABLAS (SCHEMA)")
        sql_lines.append("-- ========================================================")
        
        for table in Base.metadata.sorted_tables:
            table_name = table.name
            sql_lines.append(f"\n-- Schema for table {table_name}")
            # Compile CreateTable DDL for PostgreSQL dialect
            ddl_stmt = str(CreateTable(table).compile(dialect=postgresql.dialect())).strip()
            # Make it rerunnable by converting to IF NOT EXISTS
            if ddl_stmt.startswith("CREATE TABLE "):
                ddl_stmt = ddl_stmt.replace("CREATE TABLE ", "CREATE TABLE IF NOT EXISTS ", 1)
            sql_lines.append(ddl_stmt + ";")
            sql_lines.append("")

        # Functions & Procedures
        sql_lines.append("-- ========================================================")
        sql_lines.append("-- FUNCTIONS & PROCEDURES")
        sql_lines.append("-- ========================================================")
        sql_lines.append("")
        sql_lines.append("""CREATE OR REPLACE FUNCTION vender_producto(
    p_producto_id INT,
    p_cantidad INT,
    p_fecha_venta VARCHAR
) RETURNS VOID AS $$
DECLARE
    v_stock_actual INT;
END;
$$ LANGUAGE plpgsql;""")  # Placeholder or empty function body, since migrate.py creates the correct one! Or let's write the correct Spanish one:
        sql_lines.append("""CREATE OR REPLACE FUNCTION vender_producto(
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
$$ LANGUAGE plpgsql;""")
        sql_lines.append("")
        sql_lines.append("""CREATE OR REPLACE FUNCTION cancelar_venta(
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
$$ LANGUAGE plpgsql;""")
        sql_lines.append("")

        # 2. GENERATE DATA INSERTS
        sql_lines.append("\n-- ========================================================")
        sql_lines.append("-- 2. DATOS DE LAS TABLAS (INSERT INSERTS)")
        sql_lines.append("-- ========================================================")
        
        tables = [
            ("configuraciones_tienda", models.ConfiguracionesTienda),
            ("usuarios", models.Usuario),
            ("proveedores", models.Proveedor),
            ("perfiles_facturacion", models.PerfilFacturacion),
            ("clientes", models.Cliente),
            ("productos", models.Producto),
            ("variantes_producto", models.VarianteProducto),
            ("facturas", models.Factura),
            ("turnos", models.Turno),
            ("pagos_cliente", models.PagoCliente),
            ("compras", models.Compra),
            ("elementos_compra", models.ElementoCompra),
            ("movimientos_caja", models.MovimientoCaja),
            ("historial_ventas", models.HistorialVenta),
            ("devoluciones_producto", models.DevolucionProducto),
            ("notificaciones", models.Notificacion)
        ]
        
        for table_name, model in tables:
            rows = db.query(model).all()
            if not rows:
                continue
            sql_lines.append(f"\n-- Data for table {table_name}")
            sql_lines.append(f"TRUNCATE TABLE {table_name} CASCADE;")
            
            columns = model.__mapper__.columns.keys()
            cols_str = ", ".join(columns)
            
            for row in rows:
                vals = []
                for col in columns:
                    val = getattr(row, col)
                    if val is None:
                        vals.append("NULL")
                    elif isinstance(val, (int, float)):
                        vals.append(str(val))
                    elif isinstance(val, bool):
                        vals.append("TRUE" if val else "FALSE")
                    else:
                        escaped_str = str(val).replace("'", "''")
                        vals.append(f"'{escaped_str}'")
                vals_str = ", ".join(vals)
                sql_lines.append(f"INSERT INTO {table_name} ({cols_str}) VALUES ({vals_str});")
                
            try:
                # Reset sequences
                sql_lines.append(f"SELECT setval(pg_get_serial_sequence('{table_name}', 'id'), COALESCE((SELECT MAX(id)+1 FROM {table_name}), 1), false);")
            except Exception:
                pass
            
        sql_lines.append("\nCOMMIT;")
        
        # Determine target file path
        target_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "tienda_backup.sql")
        
        with open(target_path, "w", encoding="utf-8") as f:
            f.write("\n".join(sql_lines))
            
        print(f"Respaldo SQL (Schema + Datos) creado con éxito en: {target_path}")
        
    except Exception as e:
        print(f"Error generando el respaldo: {e}")
        sys.exit(1)
    finally:
        db.close()

if __name__ == "__main__":
    main()

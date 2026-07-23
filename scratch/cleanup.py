import sys
import os
sys.path.append(os.getcwd())
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from backend.database import SessionLocal
from backend import models

db = SessionLocal()

try:
    extra_tenants = db.query(models.Inquilino).filter(models.Inquilino.id != 1).all()
    extra_ids = [t.id for t in extra_tenants]
    print("Inquilinos a eliminar:", extra_ids)

    if extra_ids:
        # Delete from child tables in order of dependencies
        db.query(models.DevolucionProducto).filter(models.DevolucionProducto.inquilino_id.in_(extra_ids)).delete(synchronize_session=False)
        db.query(models.ElementoCompra).filter(models.ElementoCompra.compra_id.in_(
            db.query(models.Compra.id).filter(models.Compra.inquilino_id.in_(extra_ids))
        )).delete(synchronize_session=False)
        db.query(models.Compra).filter(models.Compra.inquilino_id.in_(extra_ids)).delete(synchronize_session=False)
        db.query(models.HistorialVenta).filter(models.HistorialVenta.inquilino_id.in_(extra_ids)).delete(synchronize_session=False)
        db.query(models.Factura).filter(models.Factura.inquilino_id.in_(extra_ids)).delete(synchronize_session=False)
        db.query(models.PerfilFacturacion).filter(models.PerfilFacturacion.inquilino_id.in_(extra_ids)).delete(synchronize_session=False)
        db.query(models.PagoCliente).filter(models.PagoCliente.inquilino_id.in_(extra_ids)).delete(synchronize_session=False)
        db.query(models.Cliente).filter(models.Cliente.inquilino_id.in_(extra_ids)).delete(synchronize_session=False)
        db.query(models.Proveedor).filter(models.Proveedor.inquilino_id.in_(extra_ids)).delete(synchronize_session=False)
        db.query(models.MovimientoCaja).filter(models.MovimientoCaja.inquilino_id.in_(extra_ids)).delete(synchronize_session=False)
        db.query(models.Turno).filter(models.Turno.inquilino_id.in_(extra_ids)).delete(synchronize_session=False)
        db.query(models.Notificacion).filter(models.Notificacion.inquilino_id.in_(extra_ids)).delete(synchronize_session=False)
        db.query(models.VarianteProducto).filter(models.VarianteProducto.inquilino_id.in_(extra_ids)).delete(synchronize_session=False)
        db.query(models.Producto).filter(models.Producto.inquilino_id.in_(extra_ids)).delete(synchronize_session=False)
        db.query(models.BitacoraUsuario).filter(models.BitacoraUsuario.inquilino_id.in_(extra_ids)).delete(synchronize_session=False)
        db.query(models.ConfiguracionesTienda).filter(models.ConfiguracionesTienda.inquilino_id.in_(extra_ids)).delete(synchronize_session=False)
        db.query(models.Usuario).filter(models.Usuario.inquilino_id.in_(extra_ids)).delete(synchronize_session=False)
        
        # Delete inquilinos
        db.query(models.Inquilino).filter(models.Inquilino.id != 1).delete(synchronize_session=False)
        db.commit()
        print("Eliminación completada con éxito.")

    remaining_tenants = db.query(models.Inquilino).all()
    remaining_users = db.query(models.Usuario).all()
    print("TIENDAS RESTANTES:", [(t.id, t.nombre, t.subdominio) for t in remaining_tenants])
    print("USUARIOS RESTANTES:", [(u.id, u.nombre_usuario, u.rol, u.inquilino_id) for u in remaining_users])
except Exception as e:
    db.rollback()
    print("Error durante limpieza:", e)
finally:
    db.close()

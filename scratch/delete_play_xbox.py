import sys
import os
sys.path.append(os.getcwd())
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from backend.database import SessionLocal
from backend import models

db = SessionLocal()

try:
    # Find matching tenants by subdomain or name (case-insensitive)
    matching_tenants = db.query(models.Inquilino).filter(
        (models.Inquilino.subdominio.ilike('%play%')) |
        (models.Inquilino.subdominio.ilike('%xbox%')) |
        (models.Inquilino.nombre.ilike('%play%')) |
        (models.Inquilino.nombre.ilike('%xbox%'))
    ).all()
    
    tenant_ids = [t.id for t in matching_tenants]
    print("Found matching tenants to delete:", [(t.id, t.nombre, t.subdominio) for t in matching_tenants])
    
    # Also find any users with 'play' or 'xbox' in their username
    matching_users = db.query(models.Usuario).filter(
        (models.Usuario.nombre_usuario.ilike('%play%')) |
        (models.Usuario.nombre_usuario.ilike('%xbox%'))
    ).all()
    user_ids = [u.id for u in matching_users]
    print("Found matching users to delete:", [(u.id, u.nombre_usuario, u.inquilino_id) for u in matching_users])

    if tenant_ids or user_ids:
        # Delete from dependent tables
        if tenant_ids:
            print("Deleting records associated with tenant IDs:", tenant_ids)
            db.query(models.DevolucionProducto).filter(models.DevolucionProducto.inquilino_id.in_(tenant_ids)).delete(synchronize_session=False)
            
            db.query(models.ElementoCompra).filter(models.ElementoCompra.compra_id.in_(
                db.query(models.Compra.id).filter(models.Compra.inquilino_id.in_(tenant_ids))
            )).delete(synchronize_session=False)
            db.query(models.Compra).filter(models.Compra.inquilino_id.in_(tenant_ids)).delete(synchronize_session=False)
            
            db.query(models.HistorialVenta).filter(models.HistorialVenta.inquilino_id.in_(tenant_ids)).delete(synchronize_session=False)
            db.query(models.Factura).filter(models.Factura.inquilino_id.in_(tenant_ids)).delete(synchronize_session=False)
            db.query(models.PerfilFacturacion).filter(models.PerfilFacturacion.inquilino_id.in_(tenant_ids)).delete(synchronize_session=False)
            db.query(models.PagoCliente).filter(models.PagoCliente.inquilino_id.in_(tenant_ids)).delete(synchronize_session=False)
            db.query(models.Cliente).filter(models.Cliente.inquilino_id.in_(tenant_ids)).delete(synchronize_session=False)
            db.query(models.Proveedor).filter(models.Proveedor.inquilino_id.in_(tenant_ids)).delete(synchronize_session=False)
            db.query(models.MovimientoCaja).filter(models.MovimientoCaja.inquilino_id.in_(tenant_ids)).delete(synchronize_session=False)
            db.query(models.Turno).filter(models.Turno.inquilino_id.in_(tenant_ids)).delete(synchronize_session=False)
            db.query(models.Notificacion).filter(models.Notificacion.inquilino_id.in_(tenant_ids)).delete(synchronize_session=False)
            db.query(models.VarianteProducto).filter(models.VarianteProducto.inquilino_id.in_(tenant_ids)).delete(synchronize_session=False)
            db.query(models.Producto).filter(models.Producto.inquilino_id.in_(tenant_ids)).delete(synchronize_session=False)
            db.query(models.BitacoraUsuario).filter(models.BitacoraUsuario.inquilino_id.in_(tenant_ids)).delete(synchronize_session=False)
            db.query(models.ConfiguracionesTienda).filter(models.ConfiguracionesTienda.inquilino_id.in_(tenant_ids)).delete(synchronize_session=False)
            db.query(models.Usuario).filter(models.Usuario.inquilino_id.in_(tenant_ids)).delete(synchronize_session=False)
            
            # Delete tenants themselves
            db.query(models.Inquilino).filter(models.Inquilino.id.in_(tenant_ids)).delete(synchronize_session=False)

        if user_ids:
            print("Deleting specific users by ID:", user_ids)
            db.query(models.Usuario).filter(models.Usuario.id.in_(user_ids)).delete(synchronize_session=False)

        db.commit()
        print("Cleanup completed successfully.")
    else:
        print("No matching tenants or users found.")

except Exception as e:
    db.rollback()
    print("Error during cleanup:", e)
finally:
    db.close()

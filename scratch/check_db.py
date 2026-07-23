import sys
import os
sys.path.append(os.getcwd())
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from backend.database import SessionLocal
from backend import models

db = SessionLocal()

try:
    tenants = db.query(models.Inquilino).all()
    print("--- INQUILINOS (TENANTS) ---")
    for t in tenants:
        print(f"ID: {t.id} | Nombre: {t.nombre} | Subdominio/Slug: {t.subdominio} | Suscripción: {t.estado_suscripcion}")
        
    users = db.query(models.Usuario).all()
    print("\n--- USUARIOS (USERS) ---")
    for u in users:
        # Find user's tenant subdominio
        t_sub = "Ninguno"
        if u.inquilino_id:
            tenant = db.query(models.Inquilino).filter(models.Inquilino.id == u.inquilino_id).first()
            if tenant:
                t_sub = tenant.subdominio
        print(f"ID: {u.id} | Usuario: {u.nombre_usuario} | Rol: {u.rol} | Inquilino ID: {u.inquilino_id} ({t_sub}) | Nombre Completo: {u.nombre_completo}")

except Exception as e:
    print("Error querying database:", e)
finally:
    db.close()

from sqlalchemy.orm import Session
from database import SessionLocal
import models

db = SessionLocal()
try:
    users = db.query(models.Usuario).all()
    for u in users:
        print(f"ID: {u.id}, User: {u.nombre_usuario}, Rol: {u.rol}, Inquilino: {u.inquilino_id}")
finally:
    db.close()

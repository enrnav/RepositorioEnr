import sys
import os
sys.path.append(os.getcwd())
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from backend.database import SessionLocal
from backend import models
from backend import auth

db = SessionLocal()
try:
    user = db.query(models.Usuario).filter(models.Usuario.nombre_usuario == 'admin1').first()
    if user:
        new_pass = 'Tadmin_12345'
        user.contrasena_encriptada = auth.get_password_hash(new_pass)
        db.commit()
        print(f"Successfully reset password for '{user.nombre_usuario}' to '{new_pass}'")
    else:
        print("User admin1 not found.")
except Exception as e:
    db.rollback()
    print("Error resetting password:", e)
finally:
    db.close()

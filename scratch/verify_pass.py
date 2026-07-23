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
        test_passwords = ['Tadmin_12345', 'tadmin_12345', 'Tadmin12345', 'Tadmin_1234']
        print(f"User: {user.nombre_usuario}")
        print(f"Hashed Password: {user.contrasena_encriptada}")
        for tp in test_passwords:
            is_match = auth.verify_password(tp, user.contrasena_encriptada)
            print(f"Checking '{tp}': {'MATCH' if is_match else 'NO MATCH'}")
    else:
        print("User admin1 not found.")
finally:
    db.close()

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

if __name__ == "__main__":
    run_migration()

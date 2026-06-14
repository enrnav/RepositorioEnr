import os
import sys

try:
    import psycopg2
except ImportError:
    print("Error: psycopg2 is not installed. Installing it now...")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "psycopg2-binary"])
    import psycopg2

def test_connection():
    # Allow passing URL as command line argument or prompt the user
    if len(sys.argv) > 1:
        url = sys.argv[1]
    else:
        url = input("Pega tu DATABASE_URL aquí para probarla: ").strip()

    if not url:
        print("URL vacía. Saliendo.")
        return

    # Normalize url just like in database.py
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)

    print(f"Probando conexión a: {url.split('@')[-1] if '@' in url else url}")
    try:
        conn = psycopg2.connect(url)
        print("¡CONEXIÓN EXITOSA! El usuario y la contraseña son correctos.")
        
        # Check current schema and tables
        cursor = conn.cursor()
        cursor.execute("SELECT current_database(), current_user;")
        db, user = cursor.fetchone()
        print(f"Conectado a la base de datos: {db} como el usuario: {user}")
        cursor.close()
        conn.close()
    except Exception as e:
        print("\n--- ERROR DE CONEXIÓN ---")
        print(e)
        print("-------------------------\n")

if __name__ == "__main__":
    test_connection()

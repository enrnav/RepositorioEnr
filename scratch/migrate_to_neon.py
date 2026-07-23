import sys
import os
import argparse
from sqlalchemy import create_engine

# Adjust paths to load backend modules
sys.path.append(os.getcwd())
sys.path.append(os.path.join(os.getcwd(), 'backend'))

def run_migration(neon_url):
    print("Step 1: Generating local SQL backup file...")
    try:
        from backend.generate_sql_backup_file import main as generate_backup
        generate_backup()
    except Exception as e:
        print("Error generating backup:", e)
        return

    backup_path = os.path.join(os.getcwd(), "tienda_backup.sql")
    if not os.path.exists(backup_path):
        print(f"Error: Backup file not found at {backup_path}")
        return

    print(f"Step 2: Reading backup SQL content from {backup_path}...")
    with open(backup_path, "r", encoding="utf-8") as f:
        sql_content = f.read()

    print("Step 3: Connecting to target Neon database...")
    try:
        # Enforce sslmode=require if not present in the URL
        if "sslmode=" not in neon_url:
            if "?" in neon_url:
                neon_url += "&sslmode=require"
            else:
                neon_url += "?sslmode=require"
        
        # Replace postgres:// with postgresql:// if needed
        if neon_url.startswith("postgres://"):
            neon_url = neon_url.replace("postgres://", "postgresql://", 1)

        engine = create_engine(neon_url)
        raw_conn = engine.raw_connection()
        cursor = raw_conn.cursor()
        
        print("Step 4: Executing backup SQL script on Neon...")
        # Execute the entire SQL script containing tables, data, and stored procedures
        cursor.execute(sql_content)
        raw_conn.commit()
        
        cursor.close()
        raw_conn.close()
        print("Step 5: Database successfully uploaded to Neon!")
        print("\nTo use this database in your app, please update your .env file or host environment variables with:")
        print(f"DATABASE_URL={neon_url}")

    except Exception as e:
        print("\nError uploading database to Neon:", e)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Migrate local database schema and data to Neon PostgreSQL.")
    parser.add_argument("neon_url", nargs="?", help="The connection string for your Neon PostgreSQL database.")
    args = parser.parse_args()

    target_url = args.neon_url
    if not target_url:
        print("--- DATABASE MIGRATION TO NEON ---")
        target_url = input("Please enter your Neon connection URL: ").strip()

    if not target_url:
        print("Error: Neon connection URL is required.")
        sys.exit(1)

    run_migration(target_url)

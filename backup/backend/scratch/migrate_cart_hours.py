"""
Migration: Add hours_purchased to cart_items table in PostgreSQL.
Also ensures all other missing columns in related tables are present.
"""
import os
import sys
os.chdir(r'd:\IITM ASTRA\cyberrange-main\cyberrange\backup\backend')
sys.path.insert(0, r'd:\IITM ASTRA\cyberrange-main\cyberrange\backup\backend')

from dotenv import load_dotenv
load_dotenv(r'd:\IITM ASTRA\cyberrange-main\cyberrange\backup\.env')

from app.core.config import settings
import psycopg2
import re

url = settings.DATABASE_URL
m = re.match(r'postgresql://(\w+):([^@]+)@([^:/]+):(\d+)/(\w+)', url)
if not m:
    print("Could not parse DB URL")
    sys.exit(1)

user, password, host, port, dbname = m.groups()
print(f"Connecting to {host}:{port}/{dbname}...")

conn = psycopg2.connect(host=host, port=int(port), dbname=dbname, user=user, password=password, connect_timeout=15)
conn.autocommit = True
cur = conn.cursor()

def col_exists(table, col):
    cur.execute(
        "SELECT COUNT(*) FROM information_schema.columns WHERE table_name=%s AND column_name=%s",
        (table, col)
    )
    return cur.fetchone()[0] > 0

def add_col(table, col, dtype, default=None):
    if col_exists(table, col):
        print(f"  [SKIP] {table}.{col} already exists")
    else:
        if default is not None:
            sql = f"ALTER TABLE {table} ADD COLUMN {col} {dtype} DEFAULT {default}"
        else:
            sql = f"ALTER TABLE {table} ADD COLUMN {col} {dtype}"
        cur.execute(sql)
        print(f"  [ADD]  {table}.{col} {dtype}")

print("\n=== cart_items ===")
add_col("cart_items", "hours_purchased", "INTEGER", 40)

print("\n=== order_items ===")
add_col("order_items", "hours_purchased", "INTEGER", 40)

print("\n=== orders ===")
add_col("orders", "payment_status", "VARCHAR(50) DEFAULT 'PENDING'", None)

print("\nChecking cart_items columns now:")
cur.execute("SELECT column_name, data_type FROM information_schema.columns WHERE table_name='cart_items' ORDER BY ordinal_position")
for row in cur.fetchall():
    print(" ", row)

cur.close()
conn.close()
print("\nMigration complete!")

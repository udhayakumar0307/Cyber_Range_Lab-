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

# Alter purchased_labs columns to float/double precision
try:
    cur.execute("ALTER TABLE purchased_labs ALTER COLUMN hours_purchased TYPE double precision;")
    cur.execute("ALTER TABLE purchased_labs ALTER COLUMN hours_remaining TYPE double precision;")
    cur.execute("ALTER TABLE purchased_labs ALTER COLUMN hours_used TYPE double precision;")
    print("Altered purchased_labs hours columns to double precision.")
except Exception as e:
    print("Error altering purchased_labs:", e)

# Alter licenses columns to float/double precision
try:
    cur.execute("ALTER TABLE licenses ALTER COLUMN hours_allocated TYPE double precision;")
    cur.execute("ALTER TABLE licenses ALTER COLUMN hours_used TYPE double precision;")
    print("Altered licenses hours columns to double precision.")
except Exception as e:
    print("Error altering licenses:", e)

# Alter cart_items columns to float/double precision
try:
    cur.execute("ALTER TABLE cart_items ALTER COLUMN hours_purchased TYPE double precision;")
    print("Altered cart_items hours columns to double precision.")
except Exception as e:
    print("Error altering cart_items:", e)

# Alter order_items columns to float/double precision
try:
    cur.execute("ALTER TABLE order_items ALTER COLUMN hours_purchased TYPE double precision;")
    print("Altered order_items hours columns to double precision.")
except Exception as e:
    print("Error altering order_items:", e)

cur.close()
conn.close()
print("Alteration complete!")

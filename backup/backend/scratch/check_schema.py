import os
import sys
os.chdir(r'd:\IITM ASTRA\cyberrange-main\cyberrange\backup\backend')
sys.path.insert(0, r'd:\IITM ASTRA\cyberrange-main\cyberrange\backup\backend')

from dotenv import load_dotenv
load_dotenv(r'd:\IITM ASTRA\cyberrange-main\cyberrange\backup\.env')

from app.core.config import settings

try:
    import psycopg2
except ImportError:
    print("psycopg2 not installed, trying psycopg2-binary...")
    import subprocess
    subprocess.run([sys.executable, "-m", "pip", "install", "psycopg2-binary", "-q"])
    import psycopg2

import re
url = settings.DATABASE_URL
m = re.match(r'postgresql://(\w+):([^@]+)@([^:/]+):(\d+)/(\w+)', url)
if not m:
    print("Could not parse DB URL:", url[:60])
    sys.exit(1)

user, password, host, port, dbname = m.groups()
print(f"Connecting to {host}:{port}/{dbname} as {user}...")

conn = psycopg2.connect(host=host, port=int(port), dbname=dbname, user=user, password=password, connect_timeout=15)
cur = conn.cursor()

# Check cart_items columns
cur.execute("SELECT column_name, data_type FROM information_schema.columns WHERE table_name='cart_items' ORDER BY ordinal_position")
rows = cur.fetchall()
print("cart_items columns:")
for row in rows:
    print(" ", row)

# Check what hour-related columns exist in purchased_labs
cur.execute("SELECT column_name, data_type FROM information_schema.columns WHERE table_name='purchased_labs' AND column_name LIKE '%hour%'")
rows = cur.fetchall()
print("purchased_labs hour columns:", rows)

cur.close()
conn.close()
print("Done.")

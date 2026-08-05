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
user, password, host, port, dbname = m.groups()
conn = psycopg2.connect(host=host, port=int(port), dbname=dbname, user=user, password=password)
cur = conn.cursor()
cur.execute("SELECT column_name, data_type FROM information_schema.columns WHERE table_name='licenses'")
print("licenses table columns:")
for row in cur.fetchall():
    print(" ", row)
cur.close()
conn.close()

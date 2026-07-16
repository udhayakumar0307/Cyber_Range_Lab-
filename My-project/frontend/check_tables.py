import asyncio
import asyncpg
import os

async def main():
    db_url = os.environ.get("DATABASE_URL")
    if db_url.startswith("postgresql+asyncpg://"):
        db_url = db_url.replace("postgresql+asyncpg://", "postgresql://", 1)
    conn = await asyncpg.connect(db_url)
    try:
        tables = await conn.fetch("SELECT table_name FROM information_schema.tables WHERE table_schema='public'")
        print("=== Tables in DB ===")
        for t in tables:
            print(t['table_name'])
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(main())

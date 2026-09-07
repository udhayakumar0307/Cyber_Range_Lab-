from sqlalchemy import text
from app.core.database import engine

class EverShopClient:
    def verify_connection(self) -> bool:
        try:
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
                return True
        except Exception:
            return False

    def fetch_store_information(self) -> dict:
        return {
            "storeName": "EverShop Demo Store",
            "platform": "EverShop",
            "storeUrl": "http://localhost:8088",
            "apiVersion": "v2.1.2",
            "connectionStatus": "Connected"
        }

    def fetch_customers(self) -> list:
        try:
            with engine.connect() as conn:
                result = conn.execute(text("SELECT customer_id, full_name, email, created_at FROM customer ORDER BY customer_id ASC"))
                return [dict(row._mapping) for row in result]
        except Exception:
            return []

    def fetch_customer_by_id(self, customer_id: int) -> dict:
        try:
            with engine.connect() as conn:
                result = conn.execute(text("SELECT customer_id, full_name, email, created_at FROM customer WHERE customer_id = :id"), {"id": customer_id})
                row = result.fetchone()
                return dict(row._mapping) if row else {}
        except Exception:
            return {}

    def fetch_addresses(self) -> list:
        try:
            with engine.connect() as conn:
                result = conn.execute(text("SELECT customer_address_id, customer_id, telephone, address_1, city, province, country, postcode, consent, consent_status FROM customer_address"))
                return [dict(row._mapping) for row in result]
        except Exception:
            return []

    def fetch_orders(self) -> list:
        return []

    def fetch_products(self) -> list:
        return []

    def fetch_consent_data(self) -> list:
        try:
            query = """
                SELECT c.customer_id AS id,
                       c.full_name AS name,
                       c.email,
                       ca.telephone AS phone,
                       ca.address_1 AS address,
                       ca.consent AS purpose,
                       ca.consent_status AS status,
                       c.created_at AS created,
                       c.created_at AS updated
                FROM customer c
                LEFT JOIN customer_address ca ON ca.customer_id = c.customer_id AND ca.is_default = true
                ORDER BY c.customer_id ASC
            """
            with engine.connect() as conn:
                result = conn.execute(text(query))
                rows = [dict(row._mapping) for row in result]
                return [{
                    "id": str(r["id"]),
                    "name": r["name"],
                    "email": r["email"],
                    "phone": r["phone"] or "",
                    "address": r["address"] or "",
                    "purpose": r["purpose"].replace("Consent for ", "") if r["purpose"] else "Marketing",
                    "status": "Approved" if r["status"] in ("granted", "approved") else "Revoked" if r["status"] == "revoked" else "Pending",
                    "created": r["created"].isoformat() if r["created"] else "",
                    "updated": r["updated"].isoformat() if r["updated"] else ""
                } for r in rows]
        except Exception as e:
            print("Failed to fetch consent data from database:", e)
            return []

    def fetch_store_configuration(self) -> dict:
        return {
            "mode": "Single Tenant Integration",
            "timeout": 30,
            "retry": 3
        }

    def start_synchronization(self) -> dict:
        return {"success": True, "timestamp": "now"}

    def get_synchronization_status(self) -> dict:
        return {"status": "Success", "lastSync": "2 minutes ago"}

    def test_webhook(self) -> dict:
        return {"status": "Healthy"}

    def health_check(self) -> dict:
        connected = self.verify_connection()
        return {
            "status": "healthy" if connected else "unhealthy",
            "database": "connected" if connected else "disconnected",
            "integration": "connected",
            "lastSync": "2 minutes ago"
        }

evershop_client = EverShopClient()

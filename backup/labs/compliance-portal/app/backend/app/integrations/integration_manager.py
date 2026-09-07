import json
from app.core.database import SessionLocal
from app.core.security import decrypt_credential
from app.integrations.adapter_factory import adapter_factory
from app.integrations.normalizers.customer_normalizer import customer_normalizer
from sqlalchemy import text

class IntegrationManager:
    async def get_active_adapter(self):
        db = SessionLocal()
        try:
            row = db.execute(text("SELECT platform, store_url, encrypted_api_key, connection_status FROM cms_integration_config LIMIT 1")).fetchone()
            if not row:
                return None
            
            plat = row[0]
            url = row[1]
            enc_key = row[2]
            conn_status = row[3]
            
            if conn_status != "Connected" or not url or not enc_key:
                print(f"[IntegrationManager] Platform not actively connected or missing credentials. connection_status: '{conn_status}'")
                return None
            
            api_key = decrypt_credential(enc_key) if enc_key else None
            if not api_key:
                print("[IntegrationManager] Decrypted API key is empty.")
                return None
                
            # Log exact configuration and key details
            print(f"[IntegrationManager] Instantiating active adapter. Platform: '{plat}', URL: '{url}', Key Prefix: '{api_key[:6]}...' (len={len(api_key)})")
            
            return adapter_factory.get_adapter(plat, url, api_key)
        finally:
            db.close()

    async def fetch_and_normalize_customers(self) -> list:
        adapter = await self.get_active_adapter()
        if not adapter:
            print("[IntegrationManager] No active adapter connected. Loading consents from local SQLite store.")
            return self.load_consents_from_db()
        
        try:
            print(f"[IntegrationManager] Initiating external API sync using URL: '{adapter.base_url}' and Key Prefix: '{adapter.api_key[:6]}...' (len={len(adapter.api_key)})")
            raw_list = await adapter.fetch_customers()
            print(f"[IntegrationManager] Fetched {len(raw_list)} raw records from external API.")
            
            normalized = [customer_normalizer.normalize(raw) for raw in raw_list]
            if normalized:
                self.store_consents_in_db(normalized)
                return normalized
        except Exception as e:
            print(f"[IntegrationManager] External API fetch failed, falling back to local database store. Error: {e}")
            
        return self.load_consents_from_db()

    def store_consents_in_db(self, normalized_consents: list):
        db = SessionLocal()
        try:
            db.execute(text("DELETE FROM cms_consent_records"))
            
            for c in normalized_consents:
                db.execute(text("""
                    INSERT INTO cms_consent_records (
                        customer_id, name, email, phone, address, consent_purpose, consent_status,
                        is_minor, age_category, data_principal_type, guardian_consent, parent_contact,
                        raw_data
                    ) VALUES (
                        :cid, :name, :email, :phone, :address, :purpose, :status,
                        :is_minor, :age_category, :dpt, :gc, :pc, :raw
                    )
                """), {
                    "cid": c["id"],
                    "name": c["name"],
                    "email": c["email"],
                    "phone": c["phone"],
                    "address": c["address"],
                    "purpose": c["purpose"],
                    "status": c["status"],
                    "is_minor": 1 if c["is_minor"] else 0,
                    "age_category": c["age_category"],
                    "dpt": c["data_principal_type"],
                    "gc": c["guardian_consent"],
                    "pc": c["parent_contact"],
                    "raw": json.dumps(c)
                })
            db.commit()
            print(f"[IntegrationManager] Successfully stored {len(normalized_consents)} customer records in SQLite database table 'cms_consent_records'.")
        except Exception as e:
            db.rollback()
            print(f"[IntegrationManager] Failed to store customer records in SQLite: {e}")
        finally:
            db.close()

    def load_consents_from_db(self) -> list:
        db = SessionLocal()
        try:
            rows = db.execute(text("""
                SELECT customer_id, name, email, phone, address, consent_purpose, consent_status, 
                       is_minor, age_category, data_principal_type, guardian_consent, parent_contact, 
                       raw_data, timestamp 
                FROM cms_consent_records
            """)).fetchall()
            
            consents = []
            for r in rows:
                c = {
                    "id": r[0],
                    "user_id": r[0],
                    "name": r[1] or "Unknown",
                    "email": r[2] or "",
                    "phone": r[3] or "",
                    "address": r[4] or "",
                    "purpose": r[5] or "Marketing",
                    "status": r[6] or "Pending",
                    "consent_status": r[6] or "Pending",
                    "is_minor": bool(r[7]),
                    "age_category": r[8],
                    "data_principal_type": r[9],
                    "guardian_consent": r[10],
                    "parent_contact": r[11],
                    "timestamp": r[13].isoformat() if hasattr(r[13], "isoformat") else str(r[13])
                }
                consents.append(c)
            return consents
        except Exception as e:
            print(f"[IntegrationManager] Failed to load customer records from SQLite: {e}")
            return []
        finally:
            db.close()

    async def verify_active_connection(self) -> bool:
        adapter = await self.get_active_adapter()
        if not adapter:
            return False
        return await adapter.verify_connection()

integration_manager = IntegrationManager()

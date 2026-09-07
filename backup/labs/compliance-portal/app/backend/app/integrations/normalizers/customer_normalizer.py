class CustomerNormalizer:
    def normalize(self, raw_customer: dict) -> dict:
        # Standardize parameters across Shopify/WooCommerce/EverShop/Custom REST raw JSON models
        cust_id = str(
            raw_customer.get("id") or 
            raw_customer.get("user_id") or 
            raw_customer.get("customer_id") or 
            raw_customer.get("userId") or 
            ""
        )
        name = raw_customer.get("name") or raw_customer.get("full_name") or raw_customer.get("first_name") or "Unknown"
        email = raw_customer.get("email") or ""
        phone = raw_customer.get("phone") or raw_customer.get("telephone") or ""
        address = raw_customer.get("address") or ""
        
        # Normalize consent details
        raw_purpose = raw_customer.get("consent") or raw_customer.get("purpose") or "Marketing"
        purpose = raw_purpose.replace("Consent for ", "") if raw_purpose else "Marketing"
        
        raw_status = raw_customer.get("consent_status") or raw_customer.get("status") or "Pending"
        status = "Approved" if raw_status in ("granted", "approved", "Approved") else "Revoked" if raw_status in ("revoked", "Revoked") else "Pending"

        return {
            "id": cust_id,
            "user_id": cust_id,
            "name": name,
            "email": email,
            "phone": phone,
            "address": address,
            "purpose": purpose,
            "status": status,
            "consent_status": raw_status,
            "created": raw_customer.get("created_at") or raw_customer.get("created") or "",
            "updated": raw_customer.get("updated_at") or raw_customer.get("updated") or "",
            "timestamp": raw_customer.get("timestamp") or raw_customer.get("created_at") or raw_customer.get("created") or "",
            
            # Minor and children details for statutory calculations
            "is_minor": raw_customer.get("is_minor"),
            "age_category": raw_customer.get("age_category"),
            "data_principal_type": raw_customer.get("data_principal_type"),
            "guardian_consent": raw_customer.get("guardian_consent"),
            "parent_contact": raw_customer.get("parent_contact")
        }

customer_normalizer = CustomerNormalizer()

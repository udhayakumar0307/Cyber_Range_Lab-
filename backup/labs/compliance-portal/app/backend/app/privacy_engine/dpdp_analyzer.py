class DpdpAnalyzer:
    def analyze(self, consents: list = None, consent_stats: dict = None) -> dict:
        consents = consents or []
        consent_stats = consent_stats or {}
        total = len(consents)
        
        if total == 0:
            return {
                "compliancePercent": 0,
                "stats": {
                    "satisfiedControls": 0,
                    "remaining": 10,
                    "highRisk": 0
                },
                "checklist": [],
                "nonCompliantControls": [],
                "trend": [
                    {"month": "Current", "compliance": 0}
                ]
            }

        # Retrieve connection config to verify API access using standard library sqlite3
        import sqlite3
        apiKeyConnected = False
        try:
            conn = sqlite3.connect("./privacy_platform.db")
            cursor = conn.cursor()
            cursor.execute("SELECT connection_status FROM cms_integration_config LIMIT 1")
            row = cursor.fetchone()
            if row and row[0] == "Connected":
                apiKeyConnected = True
            conn.close()
        except Exception:
            pass

        # Operational metrics derived from actual database records
        complete_records = len([c for c in consents if c.get("user_id") and c.get("name") and c.get("purpose") and c.get("status") and c.get("timestamp")])
        records_with_purpose = len([c for c in consents if c.get("purpose")])
        records_with_timestamp = len([c for c in consents if c.get("timestamp")])
        records_with_contact = len([c for c in consents if c.get("email") or c.get("phone")])
        
        revoked_records = [c for c in consents if c.get("status") == "Revoked"]
        revoked_with_timestamp = len([c for c in revoked_records if c.get("timestamp")])
        
        records_with_location = [c for c in consents if c.get("address")]
        domestic_records = len([c for c in records_with_location if "india" in str(c.get("address")).lower()])
        
        records_with_extra = len([c for c in consents if c.get("email") and c.get("phone") and c.get("address")])
        
        minor_records = [
            c for c in consents 
            if c.get("is_minor") is True 
            or str(c.get("age_category") or "").lower() == "minor" 
            or str(c.get("data_principal_type") or "").lower() == "child"
        ]
        minor_with_guardian = len([c for c in minor_records if c.get("guardian_consent") or c.get("parent_contact")])

        # Percent calculations
        completeness = (complete_records / total) * 100
        purpose_coverage = (records_with_purpose / total) * 100
        timestamp_coverage = (records_with_timestamp / total) * 100
        contact_coverage = (records_with_contact / total) * 100
        
        revocation_traceability = (revoked_with_timestamp / len(revoked_records)) * 100 if revoked_records else 100
        domestic_processing_coverage = (domestic_records / len(records_with_location)) * 100 if records_with_location else 0
        minimization_score = max(0, 100 - (records_with_extra / total) * 100 * 0.35)
        
        security_safeguards = sum([100 if apiKeyConnected else 50, timestamp_coverage, completeness, contact_coverage]) / 4
        breach_notification_readiness = sum([contact_coverage, timestamp_coverage, revocation_traceability]) / 3
        children_consent_readiness = (minor_with_guardian / len(minor_records)) * 100 if minor_records else 100

        # Define 10 DPDP Rules and evaluate scores
        rules = [
            {"id": "1", "name": "Consent Management", "weight": 18, "score": completeness},
            {"id": "2", "name": "Notice and Transparency", "weight": 12, "score": purpose_coverage},
            {"id": "3", "name": "Rights of Data Principals", "weight": 12, "score": revocation_traceability},
            {"id": "4", "name": "Time Period for Erasure", "weight": 10, "score": timestamp_coverage},
            {"id": "5", "name": "Reasonable Security Safeguards", "weight": 12, "score": security_safeguards},
            {"id": "6", "name": "Contact Information for Queries", "weight": 8, "score": contact_coverage},
            {"id": "7", "name": "Data Minimization", "weight": 10, "score": minimization_score},
            {"id": "8", "name": "Intimation of Personal Data Breach", "weight": 8, "score": breach_notification_readiness},
            {"id": "9", "name": "Processing Personal Data Outside India", "weight": 5, "score": domestic_processing_coverage},
            {"id": "10", "name": "Verifiable Consent for Children", "weight": 5, "score": children_consent_readiness}
        ]

        satisfied_count = 0
        total_weight = 0
        weighted_score_sum = 0
        non_compliant = []

        for r in rules:
            score = round(r["score"])
            r["score"] = score
            total_weight += r["weight"]
            
            # Map status score values to satisfied check
            if score >= 85:
                status_val = 1.0
                satisfied_count += 1
                r["satisfied"] = True
            elif score >= 70:
                status_val = 0.5
                r["satisfied"] = False
                non_compliant.append({
                    "control": r["name"],
                    "risk": "Medium",
                    "remediation": f"Improve {r['name']} performance threshold (currently {score}%)."
                })
            elif score < 40:
                status_val = -0.5
                r["satisfied"] = False
                non_compliant.append({
                    "control": r["name"],
                    "risk": "High",
                    "remediation": f"Remediate critical gap in {r['name']} configuration."
                })
            else:
                status_val = 0.0
                r["satisfied"] = False
                non_compliant.append({
                    "control": r["name"],
                    "risk": "Medium",
                    "remediation": f"Implement required control workflows for {r['name']}."
                })
                
            weighted_score_sum += r["weight"] * status_val

        compliance_percent = round(max(0, min(100, weighted_score_sum / total_weight * 100)))

        return {
            "compliancePercent": compliance_percent,
            "stats": {
                "satisfiedControls": satisfied_count,
                "remaining": len(rules) - satisfied_count,
                "highRisk": len([n for n in non_compliant if n["risk"] == "High"])
            },
            "checklist": rules,
            "nonCompliantControls": non_compliant,
            "trend": [
                {"month": "Current", "compliance": compliance_percent}
            ]
        }

dpdp_analyzer = DpdpAnalyzer()

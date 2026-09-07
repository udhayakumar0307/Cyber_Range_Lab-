from sqlalchemy import text
from app.core.database import engine as db_engine
from app.integrations.integration_manager import integration_manager
from app.privacy_engine.consent_analyzer import consent_analyzer
from app.privacy_engine.dpdp_analyzer import dpdp_analyzer
from app.privacy_engine.pii_analyzer import pii_analyzer
from app.privacy_engine.anonymization_analyzer import anonymization_analyzer
from app.privacy_engine.summary_builder import summary_builder
from app.cache.cache_manager import cache_manager

class PrivacyEngine:
    def __init__(self):
        self.current_status = "READY"
        self.current_task = "Idle"
        self.progress = 100

    async def run_analysis(self) -> dict:
        self.current_status = "SYNCING"
        self.current_task = "Synchronizing platform customers..."
        self.progress = 15

        # 1. Fetch normalized data from integration manager
        live_consents = await integration_manager.fetch_and_normalize_customers()
        
        self.progress = 30
        self.current_status = "ANALYZING"
        self.current_task = "Consent Analysis: evaluating statuses..."
        consent_stats = consent_analyzer.analyze(live_consents)

        self.progress = 50
        self.current_task = "PII Discovery: detecting sensitive fields..."
        pii_stats = pii_analyzer.analyze(live_consents)

        self.progress = 70
        self.current_task = "DPDP Compliance: checking user rights..."
        dpdp_stats = dpdp_analyzer.analyze(live_consents, consent_stats)

        self.progress = 85
        self.current_task = "Anonymization: loading hash audit logs..."
        anonymization_stats = anonymization_analyzer.analyze()

        self.progress = 95
        self.current_task = "Privacy Summary Generation: building dashboards..."
        dashboard_summary = summary_builder.build_summary(
            consent_stats, pii_stats, dpdp_stats, anonymization_stats
        )

        # Log synchronization history
        try:
            with db_engine.begin() as conn:
                conn.execute(
                    text("INSERT INTO cms_sync_history (event, status) VALUES (:ev, 'Success')"),
                    {"ev": f"Scheduled sync: {len(live_consents)} customers processed"}
                )
        except Exception as e:
            print("Failed to save sync log:", e)

        # Store calculations in cache manager
        cache_manager.set("dashboard", dashboard_summary)
        cache_manager.set("consents", live_consents)
        cache_manager.set("pii", pii_stats)
        cache_manager.set("dpdp", dpdp_stats)
        cache_manager.set("anonymization", anonymization_stats)

        self.current_status = "READY"
        self.current_task = "Idle"
        self.progress = 100

        return dashboard_summary

    def get_engine_status(self) -> dict:
        return {
            "status": self.current_status,
            "current_task": self.current_task,
            "progress": self.progress,
            "scheduler_running": True,
            "cache_version": "v1.1",
            "analysis_version": "1.0.0"
        }

privacy_engine = PrivacyEngine()

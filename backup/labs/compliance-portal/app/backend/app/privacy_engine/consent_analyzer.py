class ConsentAnalyzer:
    def analyze(self, consents: list = None) -> dict:
        consents = consents or []
        total = len(consents) or 1
        approved = len([c for c in consents if c["status"] == "Approved"])
        pending = len([c for c in consents if c["status"] == "Pending"])
        revoked = len([c for c in consents if c["status"] == "Revoked"])

        coverage = round((approved / total) * 100)

        return {
            "active": approved,
            "pending": pending,
            "revoked": revoked,
            "total": len(consents),
            "consentCoverage": coverage
        }

consent_analyzer = ConsentAnalyzer()

import uuid
import logging
from datetime import datetime
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.certificate import Certificate
from app.models.user import User
from app.models.lab import Lab
from app.services.certificate_service import certificate_service
from app.services.storage_provider import storage_provider
from app.core.config import settings

logger = logging.getLogger("certificate_manager")

class CertificateManager:
    """
    Internal service for certificate orchestration.
    Checks existence, ensures idempotency, invokes rendering, and manages metadata.
    """

    def get_or_issue_certificate(
        self,
        db: Session,
        user_id: int,
        lab_id: str,
        score: int = 100,
        percentage: int = 100,
        points: int = 100,
        duration_seconds: int = 0,
        completed_at: Optional[datetime] = None
    ) -> Certificate:
        # 1. Idempotency Check: Return existing certificate if already generated
        existing = (
            db.query(Certificate)
            .filter(Certificate.user_id == user_id, Certificate.lab_id == lab_id)
            .first()
        )
        if existing:
            logger.info(f"Certificate reused for user_id={user_id}, lab_id={lab_id}: {existing.display_certificate_id}")
            return existing

        # 2. Fetch User & Lab Metadata dynamically
        user = db.query(User).filter(User.id == user_id).first()
        lab = db.query(Lab).filter(Lab.id == lab_id).first()

        recipient_name = user.name or user.email if user else f"Student #{user_id}"
        lab_title = (lab.name if getattr(lab, 'name', None) else getattr(lab, 'title', None)) if lab else lab_id.replace("-", " ").title()
        category = lab.category if (lab and lab.category) else "Cyber Security"

        # 3. Generate Display ID & UUID
        cert_uuid = str(uuid.uuid4())
        count = db.query(func.count(Certificate.uuid)).scalar() or 0
        year = datetime.utcnow().year
        display_id = f"CYR-{year}-{count + 1:06d}"

        date_str = (completed_at or datetime.utcnow()).strftime("%d %b %Y")
        hours = max(0.5, round(duration_seconds / 3600.0, 1))
        duration_str = f"{hours} Hours"

        frontend_base = getattr(settings, "FRONTEND_URL", "http://localhost:5173")
        verify_url = f"{frontend_base}/certificate/verify/{display_id}"

        # 4. Render Files via CertificateService
        pdf_path = ""
        png_path = ""
        try:
            pdf_path, png_path = certificate_service.generate_and_save_certificate(
                lab_id=lab_id,
                display_id=display_id,
                recipient_name=recipient_name,
                lab_title=lab_title,
                category=category,
                score=score,
                percentage=percentage,
                points=points,
                date_str=date_str,
                duration_str=duration_str,
                verify_url=verify_url
            )
        except Exception as e:
            logger.error(f"Rendering failed for certificate {display_id}: {e}", exc_info=True)

        # 5. Persist record in database
        cert_record = Certificate(
            uuid=cert_uuid,
            display_certificate_id=display_id,
            user_id=user_id,
            lab_id=lab_id,
            pdf_path=pdf_path,
            png_path=png_path,
            created_at=completed_at or datetime.utcnow()
        )

        try:
            db.add(cert_record)
            db.commit()
            db.refresh(cert_record)
            logger.info(f"Certificate successfully generated & stored: {display_id}")
            return cert_record
        except Exception as db_err:
            db.rollback()
            logger.error(f"Database insertion failed for certificate {display_id}, cleaning up files: {db_err}")
            if pdf_path:
                storage_provider.delete(f"pdf/{display_id}.pdf")
            if png_path:
                storage_provider.delete(f"png/{display_id}.png")
            raise db_err

certificate_manager = CertificateManager()

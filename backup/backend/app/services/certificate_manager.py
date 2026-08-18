import uuid
import logging
from datetime import datetime
from typing import Optional
from sqlalchemy.orm import Session

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
        # AND its file actually exists on disk — a row with an empty png_path
        # means a previous render attempt failed, and a row with a png_path
        # but a missing file means the file was deleted/lost out from under a
        # DB row that still thinks it's issued (e.g. clearing the uploads dir
        # without also clearing this column). Neither should be treated as
        # "already issued", or the download link 404s forever with nothing
        # re-rendering it. Retry rendering instead of creating a duplicate row.
        existing = (
            db.query(Certificate)
            .filter(Certificate.user_id == user_id, Certificate.lab_id == lab_id)
            .first()
        )
        if existing and existing.png_path and storage_provider.exists(f"png/{existing.display_certificate_id}.png"):
            logger.info(f"Certificate reused for user_id={user_id}, lab_id={lab_id}: {existing.display_certificate_id}")
            return existing

        # 2. Fetch User & Lab Metadata dynamically
        user = db.query(User).filter(User.id == user_id).first()
        lab = db.query(Lab).filter(Lab.id == lab_id).first()

        recipient_name = user.name or user.email if user else f"Student #{user_id}"
        lab_title = (lab.name if getattr(lab, 'name', None) else getattr(lab, 'title', None)) if lab else lab_id.replace("-", " ").title()
        category = lab.category if (lab and lab.category) else "Cyber Security"

        # 3. Generate Display ID & UUID (reuse the existing broken row's ID on retry
        # so we don't burn a new display sequence number for the same completion)
        cert_uuid = existing.uuid if existing else str(uuid.uuid4())
        if existing:
            display_id = existing.display_certificate_id
        else:
            # Derived from the highest existing number for this year, not a row
            # COUNT — COUNT drifts from the true max the moment any row is
            # missing from the sequence (a failed/rolled-back insert, a
            # manually seeded row, a deletion), and once it does, every future
            # issuance recomputes the same already-taken ID and fails on the
            # unique constraint forever, since a failed insert never
            # increments the count either.
            year = datetime.utcnow().year
            prefix = f"CYR-{year}-"
            last = (
                db.query(Certificate.display_certificate_id)
                .filter(Certificate.display_certificate_id.like(f"{prefix}%"))
                .order_by(Certificate.display_certificate_id.desc())
                .first()
            )
            next_num = 1
            if last and last[0]:
                try:
                    next_num = int(last[0].rsplit("-", 1)[-1]) + 1
                except ValueError:
                    next_num = 1
            display_id = f"{prefix}{next_num:06d}"

        date_str = (completed_at or datetime.utcnow()).strftime("%d %b %Y")
        hours = max(0.5, round(duration_seconds / 3600.0, 1))
        duration_str = f"{hours} Hours"

        frontend_base = getattr(settings, "FRONTEND_URL", "http://localhost:5173")
        verify_url = f"{frontend_base}/certificate/verify/{display_id}"

        # 4. Render the PNG via CertificateService
        png_path = ""
        try:
            png_path = certificate_service.generate_and_save_certificate(
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

        if not png_path:
            # Rendering failed again — do not persist a broken/empty record.
            # Return an existing (still-broken) row if there is one so callers
            # don't crash, but this cert will be retried on the next request
            # instead of being permanently stuck with no download link.
            if existing:
                return existing
            logger.error(f"Certificate rendering failed for user_id={user_id}, lab_id={lab_id}; not persisting an empty record.")
            raise RuntimeError(f"Certificate rendering failed for lab_id={lab_id}")

        # 5. Persist record in database — update the existing (previously broken)
        # row in place if there is one, otherwise insert a new one.
        try:
            if existing:
                existing.png_path = png_path
                db.commit()
                db.refresh(existing)
                logger.info(f"Certificate repaired & stored: {display_id}")
                return existing

            cert_record = Certificate(
                uuid=cert_uuid,
                display_certificate_id=display_id,
                user_id=user_id,
                lab_id=lab_id,
                png_path=png_path,
                created_at=completed_at or datetime.utcnow()
            )
            db.add(cert_record)
            db.commit()
            db.refresh(cert_record)
            logger.info(f"Certificate successfully generated & stored: {display_id}")
            return cert_record
        except Exception as db_err:
            db.rollback()
            logger.error(f"Database insertion failed for certificate {display_id}, cleaning up files: {db_err}")
            if png_path:
                storage_provider.delete(f"png/{display_id}.png")
            raise db_err

certificate_manager = CertificateManager()

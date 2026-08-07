import secrets
import logging
from datetime import datetime
from typing import Dict, Any, Optional
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from google.oauth2 import id_token
from google.auth.transport import requests

from app.core.config import settings
from app.core.security import get_password_hash
from app.models.user import User
from app.security.domain_validator import (
    is_admin_domain,
    is_student_domain_allowed,
    INTERNAL_ADMIN_ROLES,
    STUDENT_ROLES
)

logger = logging.getLogger(__name__)


class GoogleAuthService:
    """
    Enterprise Google OAuth Service.
    Handles Google ID Token verification via official Google Identity Services,
    account linking, auto-creation, domain & portal isolation, and logging.
    """

    def verify_google_id_token(self, credential: str) -> Dict[str, Any]:
        """
        Verifies Google ID Token server-side using official google-auth library.
        Never trusts frontend claims. Validates iss, aud, exp, and email_verified.
        """
        if not credential:
            logger.warning("Google Login Failed: Empty credential provided.")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid Google authentication token."
            )

        client_id = settings.GOOGLE_CLIENT_ID
        try:
            # Enforce Google ID Token Verification against Google Public Keys
            request = requests.Request()
            
            # If client_id is set in settings, enforce audience verification
            if client_id and not client_id.startswith("your-") and not "example" in client_id:
                id_info = id_token.verify_oauth2_token(credential, request, client_id)
            else:
                # In development fallback mode, verify token signature & structure
                id_info = id_token.verify_oauth2_token(credential, request)

            # Validate Issuer
            issuer = id_info.get("iss", "")
            if issuer not in ["accounts.google.com", "https://accounts.google.com"]:
                logger.warning(f"Google Login Failure: Invalid token issuer '{issuer}'")
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid token issuer."
                )

            # Validate Email Verification Flag
            email_verified = id_info.get("email_verified", False)
            if not email_verified:
                logger.warning(f"Google Login Failure: Email not verified for sub {id_info.get('sub')}")
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Google account email is not verified."
                )

            email = id_info.get("email", "").strip().lower()
            if not email:
                logger.warning("Google Login Failure: No email found in Google token claims.")
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Google token missing email claim."
                )

            return {
                "google_id": id_info.get("sub"),
                "email": email,
                "name": id_info.get("name") or email.split("@")[0].capitalize(),
                "picture": id_info.get("picture"),
                "email_verified": True
            }

        except ValueError as ve:
            logger.warning(f"Google Login Failure: Token validation error: {ve}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired Google authentication token."
            )
        except Exception as e:
            logger.error(f"Google Login Failure: Unexpected error during ID token verification: {e}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid Google authentication credential."
            )

    def authenticate_or_create_google_user(
        self,
        db: Session,
        google_info: Dict[str, Any],
        portal: str = "student"
    ) -> User:
        """
        Authenticates an existing user (linking Google account) or creates a new user.
        Enforces Portal & Domain Isolation rules.
        """
        email = google_info["email"]
        google_id = google_info.get("google_id") or google_info.get("sub") or ""
        portal_clean = (portal or "student").lower()

        logger.info(f"Processing Google OAuth authentication for email: {email} on portal: {portal_clean}")

        # Lookup existing user by email or google_id
        existing_user = db.query(User).filter(
            (User.email == email) | (User.google_id == google_id)
        ).first()

        # ----------------------------------------------------
        # 1. DOMAIN & PORTAL SECURITY RULES
        # ----------------------------------------------------
        if portal_clean == "student":
            # Student Portal Rules:
            # Block @cyberrange.in accounts or internal admin accounts
            if is_admin_domain(email):
                logger.warning(f"Rejected Domain: Internal account {email} attempted login at Student Portal.")
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="This account belongs to the Enterprise Portal."
                )
            
            if existing_user is not None:
                is_internal = getattr(existing_user, "is_internal", False)
                account_type = str(getattr(existing_user, "account_type", "")).lower()
                role = str(getattr(existing_user, "role", "")).lower()
                if is_internal or account_type == "internal" or role in INTERNAL_ADMIN_ROLES:
                    logger.warning(f"Rejected Domain: Internal user record {email} attempted login at Student Portal.")
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="This account belongs to the Enterprise Portal."
                    )

            if not is_student_domain_allowed(email):
                logger.warning(f"Rejected Domain: Disallowed domain {email} attempted login at Student Portal.")
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="This account belongs to the Enterprise Portal."
                )

        elif portal_clean == "admin":
            # Admin Portal Rules:
            # Allowed: Only configured admin domains
            if not is_admin_domain(email):
                logger.warning(f"Rejected Domain: Non-admin account {email} attempted login at Admin Portal.")
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="This portal is only for CyberRange administrators."
                )

            if existing_user is not None:
                role = str(getattr(existing_user, "role", "")).lower()
                if role in STUDENT_ROLES:
                    logger.warning(f"Rejected Domain: Non-admin user record {email} attempted login at Admin Portal.")
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="This portal is only for CyberRange administrators."
                    )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid portal target specified."
            )

        # ----------------------------------------------------
        # 2. ACCOUNT LINKING OR AUTO-CREATION
        # ----------------------------------------------------
        if existing_user:
            # Existing User Found -> Link Google Account
            if not existing_user.google_id:
                existing_user.google_id = google_id
                logger.info(f"Google Login: Existing User Linked for email: {email} with google_id: {google_id}")
            else:
                logger.info(f"Google Login Success: Authenticated existing user for email: {email}")

            if existing_user.provider != "google":
                existing_user.provider = "google"

            if google_info.get("picture") and not existing_user.profile_photo:
                existing_user.profile_photo = google_info["picture"]

            if portal_clean == "admin" or is_admin_domain(email):
                existing_user.role = "admin"
                existing_user.account_type = "academic"
                existing_user.is_internal = True
                existing_user.tenant_id = "cyberrange"
                existing_user.profile_completed = True

            user = existing_user
        else:
            # First Login -> Auto Create Account
            dummy_password = get_password_hash(secrets.token_urlsafe(32))
            
            is_admin = (portal_clean == "admin" or is_admin_domain(email))
            if is_admin:
                role = "admin"
                account_type = "academic"
                is_internal = True
                tenant_id = "cyberrange"
            else:
                role = "student"
                account_type = "student"
                is_internal = False
                tenant_id = "default"

            user = User(
                name=google_info["name"],
                email=email,
                password_hash=dummy_password,
                role=role,
                account_type=account_type,
                account_status="active",
                email_verified=True,
                profile_completed=True if is_admin else False,
                tenant_id=tenant_id,
                is_internal=is_internal,
                google_id=google_id,
                provider="google",
                profile_photo=google_info.get("picture"),
                is_active=True,
                created_at=datetime.utcnow()
            )
            db.add(user)
            logger.info(f"New User Created via Google OAuth for email: {email} | Role: {role} | Internal: {is_internal}")

        # Enforce Account Status & Inactive Guard
        if not getattr(user, "is_active", True) or getattr(user, "account_status", "active") != "active":
            logger.warning(f"Google Login Failure: Account {email} is inactive or suspended.")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account is deactivated or suspended."
            )

        # Determine student auth_type: SSO if institutional domain, otherwise INDIVIDUAL
        from app.security.domain_validator import extract_domain, match_domain_pattern
        domain = extract_domain(email)
        is_sso = False
        if domain:
            sso_patterns = ["*.edu", "*.ac.in", "*.edu.in", "*college*", "*univ*"]
            is_sso = match_domain_pattern(domain, sso_patterns) or user.provider == "google"
        
        user.auth_type = "SSO" if is_sso else "INDIVIDUAL"
        user.last_login = datetime.utcnow()
        db.commit()
        db.refresh(user)

        logger.info(f"Google Login Success for email: {email} on portal: {portal_clean}")
        return user


google_auth_service = GoogleAuthService()

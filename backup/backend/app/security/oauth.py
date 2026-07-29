import logging
import secrets
import urllib.parse
from typing import Optional, Dict
import requests
from fastapi import HTTPException, status
from app.security.config import security_settings

logger = logging.getLogger(__name__)

# State storage for CSRF validation: {state_token: {"role": role, "timestamp": timestamp}}
oauth_states: Dict[str, dict] = {}

class OAuthManager:
    @staticmethod
    def generate_state(role: str = "student") -> str:
        state = secrets.token_urlsafe(32)
        oauth_states[state] = {"role": role}
        return state

    @staticmethod
    def verify_state(state: str) -> Optional[dict]:
        state_data = oauth_states.pop(state, None)
        if not state_data:
            logger.warning("OAuth CSRF state invalid or expired")
            return None
        return state_data

    @staticmethod
    def get_google_auth_url(role: str = "student") -> str:
        if not security_settings.GOOGLE_CLIENT_ID:
            raise HTTPException(
                status_code=status.HTTP_501_NOT_IMPLEMENTED,
                detail="Google OAuth is not configured on this server."
            )
        state = OAuthManager.generate_state(role=role)
        params = {
            "client_id": security_settings.GOOGLE_CLIENT_ID,
            "redirect_uri": security_settings.GOOGLE_REDIRECT_URI,
            "response_type": "code",
            "scope": "openid email profile",
            "state": state,
            "access_type": "offline",
            "prompt": "select_account"
        }
        return f"https://accounts.google.com/o/oauth2/v2/auth?{urllib.parse.urlencode(params)}"

    @staticmethod
    def get_github_auth_url(role: str = "student") -> str:
        if not security_settings.GITHUB_CLIENT_ID:
            raise HTTPException(
                status_code=status.HTTP_501_NOT_IMPLEMENTED,
                detail="GitHub OAuth is not configured on this server."
            )
        state = OAuthManager.generate_state(role=role)
        params = {
            "client_id": security_settings.GITHUB_CLIENT_ID,
            "redirect_uri": security_settings.GITHUB_REDIRECT_URI,
            "scope": "user:email read:user",
            "state": state
        }
        return f"https://github.com/login/oauth/authorize?{urllib.parse.urlencode(params)}"

    @staticmethod
    def exchange_google_code(code: str) -> dict:
        token_url = "https://oauth2.googleapis.com/token"
        data = {
            "code": code,
            "client_id": security_settings.GOOGLE_CLIENT_ID,
            "client_secret": security_settings.GOOGLE_CLIENT_SECRET,
            "redirect_uri": security_settings.GOOGLE_REDIRECT_URI,
            "grant_type": "authorization_code"
        }
        res = requests.post(token_url, data=data)
        if res.status_code != 200:
            logger.error(f"Google token exchange failed: {res.text}")
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to exchange Google OAuth code.")
        
        tokens = res.json()
        access_token = tokens.get("access_token")
        
        # Get user info
        user_info_res = requests.get(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            headers={"Authorization": f"Bearer {access_token}"}
        )
        if user_info_res.status_code != 200:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to fetch Google user profile.")
        
        info = user_info_res.json()
        return {
            "email": info.get("email"),
            "name": info.get("name", "Google User"),
            "verified": info.get("verified_email", False),
            "provider": "google",
            "picture": info.get("picture")
        }

    @staticmethod
    def exchange_github_code(code: str) -> dict:
        token_url = "https://github.com/login/oauth/access_token"
        headers = {"Accept": "application/json"}
        data = {
            "client_id": security_settings.GITHUB_CLIENT_ID,
            "client_secret": security_settings.GITHUB_CLIENT_SECRET,
            "code": code,
            "redirect_uri": security_settings.GITHUB_REDIRECT_URI
        }
        res = requests.post(token_url, headers=headers, data=data)
        if res.status_code != 200:
            logger.error(f"GitHub token exchange failed: {res.text}")
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to exchange GitHub OAuth code.")
        
        tokens = res.json()
        access_token = tokens.get("access_token")
        if not access_token:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No access token returned by GitHub.")

        # Get profile
        user_res = requests.get("https://api.github.com/user", headers={"Authorization": f"token {access_token}"})
        if user_res.status_code != 200:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to fetch GitHub user profile.")
        user_info = user_res.json()

        # Get emails to find primary/verified email
        email_res = requests.get("https://api.github.com/user/emails", headers={"Authorization": f"token {access_token}"})
        primary_email = user_info.get("email")
        if email_res.status_code == 200:
            emails = email_res.json()
            for em in emails:
                if em.get("primary") and em.get("verified"):
                    primary_email = em.get("email")
                    break

        if not primary_email:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Verified GitHub email required.")

        return {
            "email": primary_email,
            "name": user_info.get("name") or user_info.get("login") or "GitHub User",
            "verified": True,
            "provider": "github",
            "picture": user_info.get("avatar_url")
        }

oauth_manager = OAuthManager()

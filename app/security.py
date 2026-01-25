import logging
from typing import Optional
from fastapi import HTTPException, Security, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from google.oauth2 import id_token
from google.auth.transport import requests

from app.config import get_settings

logger = logging.getLogger(__name__)
security = HTTPBearer()
settings = get_settings()

def verify_user(credentials: HTTPAuthorizationCredentials = Security(security)) -> dict:
    """
    Verify the Google ID token and check if the user is allowed.
    Returns the user info dictionary if valid.
    """
    token = credentials.credentials

    try:
        # Verify the token
        # If google_client_id is not set (e.g. dev), verify_oauth2_token might fail or be skipped depending on policy.
        # Here we strictly require it for security.
        id_info = id_token.verify_oauth2_token(
            token, 
            requests.Request(), 
            settings.google_client_id
        )

        email = id_info.get("email")
        if not email:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token does not contain email"
            )

        # Check allowlist
        allowed_users = [u.strip().lower() for u in settings.allowed_users.split(",") if u.strip()]
        if allowed_users and email.lower() not in allowed_users:
            logger.warning(f"⛔️ access denied for user: {email}")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User not authorized"
            )
            
        return id_info

    except ValueError as e:
        logger.error(f"❌ Invalid token: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token"
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Auth error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication failed"
        )

from fastapi import HTTPException, status
from app.security.password_policy import password_policy

class PasswordValidator:
    @staticmethod
    def validate_or_raise(password: str, email: str = "", username: str = ""):
        """
        Validates password against centralized policy.
        Raises HTTP 400 Bad Request with detail list if invalid.
        """
        is_valid, errors, _, _ = password_policy.evaluate(password, email=email, username=username)
        if not is_valid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"message": "Password does not satisfy security policy.", "errors": errors}
            )

password_validator = PasswordValidator()

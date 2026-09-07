import base64
from cryptography.fernet import Fernet
from app.core.config import settings

# Deriving a valid Fernet key from the SECRET_KEY string
hashed_key = base64.urlsafe_b64encode(settings.SECRET_KEY.ljust(32)[:32].encode())
cipher_suite = Fernet(hashed_key)

def encrypt_credential(plain_text: str) -> str:
    if not plain_text:
        return ""
    return cipher_suite.encrypt(plain_text.encode()).decode()

def decrypt_credential(cipher_text: str) -> str:
    if not cipher_text:
        return ""
    return cipher_suite.decrypt(cipher_text.encode()).decode()

import os
import logging
from typing import Optional

logger = logging.getLogger("storage_provider")

class StorageProvider:
    """
    Storage abstraction for certificate PDF and PNG preview files.
    Supports local filesystem currently and is cloud-ready (S3/Azure Blob).
    """
    def __init__(self, base_dir: Optional[str] = None):
        if not base_dir:
            backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
            base_dir = os.path.join(backend_dir, "uploads", "certificates")
        self.base_dir = base_dir
        self.pdf_dir = os.path.join(self.base_dir, "pdf")
        self.png_dir = os.path.join(self.base_dir, "png")
        os.makedirs(self.pdf_dir, exist_ok=True)
        os.makedirs(self.png_dir, exist_ok=True)

    def save(self, file_content: bytes, relative_path: str) -> str:
        full_path = os.path.join(self.base_dir, relative_path)
        os.makedirs(os.path.dirname(full_path), exist_ok=True)
        with open(full_path, "wb") as f:
            f.write(file_content)
        logger.info(f"Saved file to storage: {full_path}")
        clean_rel = relative_path.replace("\\", "/")
        return f"/uploads/certificates/{clean_rel}"

    def exists(self, relative_path: str) -> bool:
        full_path = os.path.join(self.base_dir, relative_path)
        return os.path.exists(full_path)

    def delete(self, relative_path: str) -> bool:
        full_path = os.path.join(self.base_dir, relative_path)
        if os.path.exists(full_path):
            os.remove(full_path)
            logger.info(f"Deleted file from storage: {full_path}")
            return True
        return False

    def get_url(self, relative_path: str) -> str:
        clean_rel = relative_path.replace("\\", "/")
        return f"/uploads/certificates/{clean_rel}"

storage_provider = StorageProvider()

"""
Storage service for managing receipt files.
Supports both Google Cloud Storage and local filesystem.
"""
import os
import uuid
import logging
from datetime import datetime, timedelta
from typing import Optional, Tuple
from pathlib import Path
from google.cloud import storage
from google.cloud.exceptions import GoogleCloudError

from app.config import get_settings

logger = logging.getLogger(__name__)


class StorageService:
    """
    Abstracted storage service supporting Local and GCS backends.
    """
    
    def __init__(self):
        self.settings = get_settings()
        self.mode = self.settings.storage_mode.lower()
        
        # GCS setup
        self._gcs_client: Optional[storage.Client] = None
        self._bucket: Optional[storage.Bucket] = None
        
        # Local setup
        if self.mode == "local":
            self.upload_dir = Path(self.settings.upload_dir)
            self.upload_dir.mkdir(parents=True, exist_ok=True)
            logger.info(f"📂 Local storage enabled. Saving files to: {self.upload_dir.absolute()}")
    
    @property
    def gcs_client(self) -> storage.Client:
        if self._gcs_client is None and self.mode == "gcs":
            self._gcs_client = storage.Client(project=self.settings.gcp_project_id)
        return self._gcs_client
    
    @property
    def bucket(self) -> storage.Bucket:
        if self._bucket is None and self.mode == "gcs":
            self._bucket = self.gcs_client.bucket(self.settings.gcs_bucket_name)
        return self._bucket
    
    def upload_file(
        self, 
        file_content: bytes, 
        original_filename: str,
        content_type: str,
        base_url: str = ""
    ) -> Tuple[str, str]:
        """
        Upload a file to storage.
        
        Args:
            file_content: Raw file bytes
            original_filename: Original filename
            content_type: MIME type
            base_url: Base URL for constructing local file URLs (only for local mode)
            
        Returns:
            Tuple of (file_identifier, public_url)
        """
        # Generate unique filename
        file_ext = os.path.splitext(original_filename)[1].lower()
        unique_id = uuid.uuid4().hex[:12]
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        filename = f"{timestamp}_{unique_id}{file_ext}"
        
        if self.mode == "gcs":
            return self._upload_to_gcs(filename, file_content, content_type)
        else:
            return self._upload_to_local(filename, file_content, base_url)
            
    def _upload_to_local(self, filename: str, content: bytes, base_url: str) -> Tuple[str, str]:
        """Save file to local disk."""
        file_path = self.upload_dir / filename
        
        with open(file_path, "wb") as f:
            f.write(content)
            
        # Construct URL pointing to the static mount
        # We assume the app mounts upload_dir at '/static/uploads'
        # base_url should be like 'http://localhost:8080'
        url = f"{base_url}/uploads/{filename}"
        
        return filename, url

    def _upload_to_gcs(self, filename: str, content: bytes, content_type: str) -> Tuple[str, str]:
        """Upload file to GCS."""
        blob_name = f"receipts/{filename}"
        blob = self.bucket.blob(blob_name)
        blob.upload_from_string(content, content_type=content_type)
        
        try:
            blob.make_public()
            url = blob.public_url
        except GoogleCloudError:
            url = blob.generate_signed_url(
                version="v4",
                expiration=timedelta(days=7),
                method="GET"
            )
            
        return blob_name, url
    
    def delete_file(self, file_id: str) -> bool:
        """Delete a file from storage."""
        if self.mode == "gcs":
            try:
                blob = self.bucket.blob(file_id)
                blob.delete()
                return True
            except GoogleCloudError:
                return False
        else:
            # Local mode
            file_path = self.upload_dir / file_id
            if file_path.exists():
                file_path.unlink()
                return True
            return False


# Global instance
storage_service = StorageService()

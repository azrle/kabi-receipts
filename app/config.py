"""
Application configuration management.
"""
import os
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    # Storage Configuration
    storage_mode: str = "local"  # 'local' or 'gcs'
    upload_dir: str = "uploads"  # directory for local file storage
    
    # GCP Configuration (Required if storage_mode='gcs')
    gcp_project_id: str = ""
    gcs_bucket_name: str = ""
    
    # Google AI API Key (Gemini)
    google_api_key: str = ""
    gemini_model: str = "gemini-3-flash-preview"  # Default model
    
    # Optional: Service account credentials path
    google_application_credentials: str = ""
    
    # App settings
    max_file_size_mb: int = 10
    allowed_extensions: str = "jpg,jpeg,png,gif,pdf"
    
    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=False,
        extra="ignore"
    )


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()

"""
Script to backup the Kabi Receipts database.
Supports both Local (JSON) and Firestore (GCP) modes.
"""
import os
import shutil
import logging
import argparse
from datetime import datetime
from pathlib import Path
import sys

# Add project root to python path to allow importing 'app' modules
# This assumes the script is located at /scripts/backup_db.py
sys.path.append(str(Path(__file__).resolve().parent.parent))

from app.config import get_settings

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

def backup_local_db(config, output_dir: Path):
    """Backup local JSON database file."""
    db_file = Path("receipts.json")
    if not db_file.exists():
        logger.warning(f"Local database file {db_file} not found. Skipping backup.")
        return

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_file = output_dir / f"receipts_backup_{timestamp}.json"
    
    logger.info(f"Backing up local DB to {backup_file}...")
    shutil.copy2(db_file, backup_file)
    logger.info("Backup completed successfully.")

def backup_firestore_db(config, output_dir: Path):
    """
    Backup Firestore database.
    
    Note: A full Firestore backup typically requires GCS bucket permissions and 
    usage of 'gcloud firestore export'. This function serves as a wrapper 
    or basic JSON dump if using the python client to iterate all docs 
    (which might be slow for large DBs but fine for smaller ones).
    
    For a robust production backup, we should trigger a managed export.
    Here we will implement a collection dump to JSON for portability.
    """
    try:
        from google.cloud import firestore
        client = firestore.Client(project=config.gcp_project_id)
        collection_ref = client.collection("receipts")
        
        logger.info(f"Backing up Firestore collection 'receipts' for project {config.gcp_project_id}...")
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_file = output_dir / f"firestore_receipts_backup_{timestamp}.json"
        
        docs = collection_ref.stream()
        all_data = []
        for doc in docs:
            data = doc.to_dict()
            # Convert datetime objects to string for JSON serialization
            for key, value in data.items():
                if isinstance(value, datetime):
                    data[key] = value.isoformat()
            all_data.append(data)
            
        import json
        with open(backup_file, "w") as f:
            json.dump(all_data, f, indent=2)
            
        logger.info(f"Backup saved to {backup_file}. Total documents: {len(all_data)}")
        
    except ImportError:
        logger.error("google-cloud-firestore not installed.")
    except Exception as e:
        logger.error(f"Firestore backup failed: {e}")

def main():
    parser = argparse.ArgumentParser(description="Backup Kabi Receipts Database")
    parser.add_argument("--output", type=str, default="backups", help="Output directory for backups")
    args = parser.parse_args()

    settings = get_settings()
    output_dir = Path(args.output)
    output_dir.mkdir(exist_ok=True)

    logger.info(f"Starting backup in {settings.storage_mode} mode...")

    if settings.storage_mode.lower() == "local":
        backup_local_db(settings, output_dir)
    elif settings.storage_mode.lower() == "gcs":
        backup_firestore_db(settings, output_dir)
    else:
        logger.error(f"Unknown storage mode: {settings.storage_mode}")

if __name__ == "__main__":
    main()

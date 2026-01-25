"""
Database service for storing receipt data.
Supports both Firestore (Cloud) and JSON file (Local).
"""
import json
import os
from datetime import datetime
from typing import Optional, List, Dict, Any
from pathlib import Path

from app.config import get_settings
from app.models import Receipt, ReceiptData, LineItem, ProcessingStatus


class DatabaseService:
    """
    Abstracted database service supporting Local (JSON) and Firestore backends.
    """
    
    COLLECTION_NAME = "receipts"
    LOCAL_DB_FILE = "receipts.json"
    
    def __init__(self):
        self.settings = get_settings()
        self.mode = self.settings.storage_mode.lower()
        self._firestore_client = None
        self._local_db_path = Path(self.LOCAL_DB_FILE)
    
    @property
    def firestore(self):
        if self._firestore_client is None and self.mode == "gcs":
            from google.cloud import firestore
            self._firestore_client = firestore.Client(project=self.settings.gcp_project_id)
        return self._firestore_client

    # ==================== PUBLIC API ====================

    def create_receipt(
        self,
        file_name: str,
        file_url: str,
        file_type: str,
        blob_name: str
    ) -> Receipt:
        now = datetime.utcnow()
        receipt_id = self._generate_id()
        
        data = {
            "id": receipt_id,
            "file_name": file_name,
            "file_url": file_url,
            "file_type": file_type,
            "blob_name": blob_name,
            "extracted_data": None,
            "processing_status": ProcessingStatus.PENDING.value,
            "error_message": None,
            "created_at": now.isoformat(),
            "updated_at": now.isoformat()
        }
        
        if self.mode == "gcs":
            self.firestore.collection(self.COLLECTION_NAME).document(receipt_id).set(data)
        else:
            self._save_to_local(data)
            
        return self._dict_to_receipt(data)

    def update_receipt_processing(
        self,
        receipt_id: str,
        extracted_data: Optional[ReceiptData],
        status: ProcessingStatus,
        error_message: Optional[str] = None
    ) -> bool:
        if self.mode == "gcs":
            return self._update_firestore(receipt_id, extracted_data, status, error_message)
        else:
            return self._update_local(receipt_id, extracted_data, status, error_message)

    def get_receipt(self, receipt_id: str) -> Optional[Receipt]:
        if self.mode == "gcs":
            doc = self.firestore.collection(self.COLLECTION_NAME).document(receipt_id).get()
            return self._dict_to_receipt(doc.to_dict()) if doc.exists else None
        else:
            data = self._get_from_local(receipt_id)
            return self._dict_to_receipt(data) if data else None

    def list_receipts(self, limit: int = 100) -> List[Receipt]:
        if self.mode == "gcs":
            from google.cloud import firestore
            docs = (
                self.firestore.collection(self.COLLECTION_NAME)
                .order_by("created_at", direction=firestore.Query.DESCENDING)
                .limit(limit)
                .stream()
            )
            return [self._dict_to_receipt(doc.to_dict()) for doc in docs]
        else:
            all_receipts = self._load_local_db()
            # Sort by created_at desc
            sorted_data = sorted(
                all_receipts.values(),
                key=lambda x: x.get("created_at", ""),
                reverse=True
            )
            return [self._dict_to_receipt(d) for d in sorted_data[:limit]]

    def delete_receipt(self, receipt_id: str) -> Optional[str]:
        """Returns blob_name if found and deleted, None otherwise."""
        if self.mode == "gcs":
            doc_ref = self.firestore.collection(self.COLLECTION_NAME).document(receipt_id)
            doc = doc_ref.get()
            if not doc.exists:
                return None
            blob_name = doc.to_dict().get("blob_name")
            doc_ref.delete()
            return blob_name
        else:
            db = self._load_local_db()
            if receipt_id not in db:
                return None
            blob_name = db[receipt_id].get("blob_name")
            del db[receipt_id]
            self._write_local_db(db)
            return blob_name

    # ==================== PRIVATE HELPERS ====================

    def _generate_id(self) -> str:
        if self.mode == "gcs":
            return self.firestore.collection(self.COLLECTION_NAME).document().id
        else:
            import uuid
            return str(uuid.uuid4())

    def _dict_to_receipt(self, data: Dict[str, Any]) -> Receipt:
        # Convert date strings back to datetime if needed
        # (Receipt model handles from_attributes, but let's be explicit)
        if not data:
            return None
            
        extracted_data = None
        if data.get("extracted_data"):
            ed = data["extracted_data"]
            items = [LineItem(**item) for item in ed.get("items", [])]
            extracted_data = ReceiptData(
                merchant=ed.get("merchant"),
                date=ed.get("date"),
                total=ed.get("total"),
                currency=ed.get("currency"),
                subtotal=ed.get("subtotal"),
                tax=ed.get("tax"),
                tip=ed.get("tip"),
                payment_method=ed.get("payment_method"),
                items=items,
                category=ed.get("category"),
                notes=ed.get("notes")
            )

        # Handle datetime parsing from ISO string (for local DB) or Timestamp (Firestore)
        created_at = data.get("created_at")
        if isinstance(created_at, str):
            created_at = datetime.fromisoformat(created_at)
        
        updated_at = data.get("updated_at")
        if isinstance(updated_at, str):
            updated_at = datetime.fromisoformat(updated_at)

        return Receipt(
            id=data["id"],
            file_name=data["file_name"],
            file_url=data["file_url"],
            file_type=data["file_type"],
            blob_name=data.get("blob_name"),
            extracted_data=extracted_data,
            processing_status=ProcessingStatus(data.get("processing_status", "pending")),
            error_message=data.get("error_message"),
            created_at=created_at,
            updated_at=updated_at
        )

    # --- Local DB Helpers ---

    def _load_local_db(self) -> Dict[str, Any]:
        if not self._local_db_path.exists():
            return {}
        try:
            with open(self._local_db_path, "r") as f:
                return json.load(f)
        except:
            return {}

    def _write_local_db(self, db: Dict[str, Any]):
        with open(self._local_db_path, "w") as f:
            json.dump(db, f, indent=2, default=str)

    def _save_to_local(self, data: Dict[str, Any]):
        db = self._load_local_db()
        db[data["id"]] = data
        self._write_local_db(db)

    def _get_from_local(self, receipt_id: str) -> Optional[Dict[str, Any]]:
        db = self._load_local_db()
        return db.get(receipt_id)

    def _update_local(self, receipt_id, extracted_data, status, error_message):
        db = self._load_local_db()
        if receipt_id not in db:
            return False
        
        item = db[receipt_id]
        item["processing_status"] = status.value
        item["error_message"] = error_message
        item["updated_at"] = datetime.utcnow().isoformat()
        
        if extracted_data:
            item["extracted_data"] = extracted_data.model_dump()
            
        self._write_local_db(db)
        return True

    def _update_firestore(self, receipt_id, extracted_data, status, error_message):
        doc_ref = self.firestore.collection(self.COLLECTION_NAME).document(receipt_id)
        update_data = {
            "processing_status": status.value,
            "error_message": error_message,
            "updated_at": datetime.utcnow()
        }
        if extracted_data:
            update_data["extracted_data"] = extracted_data.model_dump()
        doc_ref.update(update_data)
        return True


# Global instance
database_service = DatabaseService()

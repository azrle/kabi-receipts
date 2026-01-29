"""
Script to import Costco receipts from JSON file.
Treats the JSON entry as the "source file" by uploading it to storage.
"""
import json
import asyncio
import argparse
import logging
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List

# Add project root to path
import sys
from pathlib import Path
sys.path.append(str(Path(__file__).resolve().parent.parent))

from app.models import Receipt, ReceiptData, LineItem, ProcessingStatus
from app.services import database_service, storage_service
from app.config import get_settings

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

def map_costco_to_receipt_data(costco_data: Dict[str, Any]) -> ReceiptData:
    """Map Costco JSON fields to our ReceiptData model."""
    
    # Items
    items = []
    for item in costco_data.get("itemArray", []):
        description = item.get("itemDescription01", "Unknown Item")
        desc2 = item.get("itemDescription02")
        if desc2:
            description += f" {desc2}"
            
        unit_price = item.get("itemUnitPriceAmount") or item.get("amount")
        quantity = item.get("unit", 1)
        total = item.get("amount")
        
        # Handle returns or weird negative quantities if any
        if quantity < 0:
            # Maybe mark as return or keep negative
            pass
            
        items.append(LineItem(
            description=description,
            quantity=float(quantity) if quantity is not None else 1.0,
            unit_price=float(unit_price) if unit_price is not None else None,
            total=float(total) if total is not None else None
        ))

    # Payment method
    payment_method = "Unknown"
    tenders = costco_data.get("tenderArray", [])
    if tenders:
        payment_method = tenders[0].get("tenderDescription", "Unknown")

    return ReceiptData(
        merchant="Costco Wholesale",
        date=costco_data.get("transactionDate"), # YYYY-MM-DD
        total=float(costco_data.get("total", 0)),
        currency="USD", # Assuming US Costco
        subtotal=float(costco_data.get("subTotal", 0)),
        tax=float(costco_data.get("taxes", 0)),
        tip=0.0,
        payment_method=payment_method,
        items=items,
        category="Groceries", # Default category
        notes=f"Warehouse: {costco_data.get('warehouseName')} #{costco_data.get('warehouseNumber')}\nTransaction: {costco_data.get('transactionBarcode')}"
    )

async def import_receipts(json_file: str, dry_run: bool = False):
    """Import receipts from JSON."""
    file_path = Path(json_file)
    if not file_path.exists():
        logger.error(f"File {json_file} does not exist.")
        return

    with open(file_path, "r") as f:
        receipts_data = json.load(f)

    if not isinstance(receipts_data, list):
        receipts_data = [receipts_data]

    logger.info(f"Found {len(receipts_data)} receipts to import.")

    success_count = 0
    
    for entry in receipts_data:
        try:
            # 1. Prepare metadata
            txn_barcode = entry.get("transactionBarcode")
            txn_date = entry.get("transactionDate", "unknown_date")
            warehouse = entry.get("warehouseName", "COSTCO")
            
            # 2. Map data
            extracted_data = map_costco_to_receipt_data(entry)
            
            if dry_run:
                logger.info(f"[DRY RUN] Would import receipt: {txn_date} - ${extracted_data.total}")
                continue

            # 3. Create "File" content (the JSON snippet itself)
            # We want to store the specific JSON for this receipt as the "original file"
            receipt_json_content = json.dumps(entry, indent=2).encode('utf-8')
            filename = f"costco_{txn_date}_{txn_barcode}.json"
            content_type = "application/json"
            
            # 4. Upload file using StorageService
            # We don't have a request object here for base_url in local mode, 
            # so we might need a workaround or hardcode/ignore if mostly for GCS
            # or just pass a dummy base_url
            base_url = "http://localhost:8080" # Default assumption for local
            
            blob_name, file_url = storage_service.upload_file(
                file_content=receipt_json_content,
                original_filename=filename,
                content_type=content_type,
                base_url=base_url
            )
            
            # 5. Create Receipt in DB
            receipt = database_service.create_receipt(
                file_name=filename,
                file_url=file_url,
                file_type=content_type,
                blob_name=blob_name
            )
            
            # 6. Update with "Extracted" data (which is actually just mapped data)
            # We skip the AI processing queue since we already have the data!
            database_service.update_receipt_processing(
                receipt_id=receipt.id,
                extracted_data=extracted_data,
                status=ProcessingStatus.COMPLETED
            )
            
            success_count += 1
            logger.info(f"Imported receipt {txn_barcode} as ID {receipt.id}")

        except Exception as e:
            logger.error(f"Failed to import receipt {entry.get('transactionBarcode')}: {e}")

    logger.info(f"Import finished. Successfully imported {success_count}/{len(receipts_data)} receipts.")

def main():
    parser = argparse.ArgumentParser(description="Import Costco Receipts")
    parser.add_argument("file", help="JSON file containing receipts")
    parser.add_argument("--dry-run", action="store_true", help="Validate mapping without saving")
    args = parser.parse_args()

    asyncio.run(import_receipts(args.file, args.dry_run))

if __name__ == "__main__":
    main()

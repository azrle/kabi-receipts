"""
Kabi Receipts - FastAPI Backend Application

A web application for uploading receipts, extracting data using AI,
and storing results in a database for future AI usage.
"""
import os
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, File, UploadFile, HTTPException, BackgroundTasks, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import get_settings
from app.models import (
    Receipt,
    ReceiptResponse,
    ReceiptListResponse,
    ProcessingStatus
)
from app.services import (
    storage_service,
    extractor_service,
    database_service
)

# Configure logging
def setup_logging():
    """Configure logging to include timestamps, even when running via Uvicorn CLI."""
    log_format = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    
    # Configure root logger
    logging.basicConfig(level=logging.INFO, format=log_format)
    
    # Patch Uvicorn loggers (important for CLI usage)
    for logger_name in ("uvicorn", "uvicorn.error", "uvicorn.access"):
        log = logging.getLogger(logger_name)
        # Only add a handler if none exist to avoid duplicates
        # or just reset the formatter on existing ones
        for handler in log.handlers:
            handler.setFormatter(logging.Formatter(log_format))

# Initialize logging immediately upon module import
setup_logging()
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events."""
    # Re-apply logging setup in case Uvicorn CLI added handlers after import
    setup_logging()
    logger.info("🚀 Starting Kabi Receipts API...")
    
    # Check output of current config useful for debugging
    settings = get_settings()
    logger.info(f"🔧 Env Config: STORAGE_MODE={settings.storage_mode}")
    logger.info(f"🔧 Env Config: GEMINI_MODEL={settings.gemini_model}")
            
    yield
    logger.info("👋 Shutting down Kabi Receipts API...")


# Create FastAPI application
app = FastAPI(
    title="Kabi Receipts API",
    description="Upload receipts, extract data with AI, and store for future use",
    version="1.0.0",
    lifespan=lifespan
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "*", 
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount uploads directory for local storage mode
settings = get_settings()
# Normalize storage_mode check
if settings.storage_mode.lower() == "local":
    # Critical: Ensure directory exists BEFORE mounting or StaticFiles throws error
    if not os.path.exists(settings.upload_dir):
        logger.info(f"📂 Creating missing upload directory: {settings.upload_dir}")
        os.makedirs(settings.upload_dir, exist_ok=True)
    
    # Mount /uploads to serve local files
    logger.info(f"📂 Mounting /uploads to serve from: {os.path.abspath(settings.upload_dir)}")
    app.mount("/uploads", StaticFiles(directory=settings.upload_dir), name="uploads")


def get_allowed_extensions() -> set:
    settings = get_settings()
    return {f".{ext.strip()}" for ext in settings.allowed_extensions.split(",")}


def validate_file(file: UploadFile) -> str:
    settings = get_settings()
    allowed_extensions = get_allowed_extensions()
    
    file_ext = os.path.splitext(file.filename or "")[1].lower()
    if file_ext not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"File type not allowed. Allowed types: {settings.allowed_extensions}"
        )
    
    content_type = file.content_type or "application/octet-stream"
    if file_ext == ".pdf":
        content_type = "application/pdf"
    elif file_ext in {".jpg", ".jpeg"}:
        content_type = "image/jpeg"
    elif file_ext == ".png":
        content_type = "image/png"
    elif file_ext == ".gif":
        content_type = "image/gif"
    
    return content_type


async def process_receipt(receipt_id: str, file_content: bytes, content_type: str):
    """
    Background task to process a receipt using multimodal AI.
    """
    try:
        # Update status
        database_service.update_receipt_processing(
            receipt_id=receipt_id,
            raw_text="[Processed by Multimodal AI]",
            extracted_data=None,
            status=ProcessingStatus.PROCESSING
        )
        
        # Direct multimodal extraction
        extracted_data = extractor_service.extract_from_file(file_content, content_type)
        
        # Update database with results
        database_service.update_receipt_processing(
            receipt_id=receipt_id,
            raw_text="[Processed by Multimodal AI]",
            extracted_data=extracted_data,
            status=ProcessingStatus.COMPLETED
        )
        
        logger.info(f"✅ Successfully processed receipt {receipt_id}")
        
    except Exception as e:
        logger.error(f"❌ Error processing receipt {receipt_id}: {str(e)}")
        database_service.update_receipt_processing(
            receipt_id=receipt_id,
            raw_text="",
            extracted_data=None,
            status=ProcessingStatus.FAILED,
            error_message=str(e)
        )


@app.get("/")
async def root():
    return {
        "service": "Kabi Receipts API",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/health"
    }


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


@app.post("/api/receipts", response_model=ReceiptResponse)
async def upload_receipt(
    request: Request,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...)
):
    content_type = validate_file(file)
    settings = get_settings()
    file_content = await file.read()
    max_size = settings.max_file_size_mb * 1024 * 1024
    
    if len(file_content) > max_size:
        raise HTTPException(
            status_code=400,
            detail=f"File too large. Maximum size: {settings.max_file_size_mb}MB"
        )
    
    try:
        # Construct base URL for local file serving
        base_url = str(request.base_url).rstrip("/")
        
        blob_name, file_url = storage_service.upload_file(
            file_content=file_content,
            original_filename=file.filename or "receipt",
            content_type=content_type,
            base_url=base_url
        )
        
        receipt = database_service.create_receipt(
            file_name=file.filename or "receipt",
            file_url=file_url,
            file_type=content_type,
            blob_name=blob_name
        )
        
        background_tasks.add_task(
            process_receipt,
            receipt.id,
            file_content,
            content_type
        )
        
        return ReceiptResponse(
            success=True,
            data=receipt,
            message="Receipt uploaded successfully. Processing in background."
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")


@app.get("/api/receipts", response_model=ReceiptListResponse)
async def list_receipts(limit: int = 100):
    try:
        receipts = database_service.list_receipts(limit=limit)
        return ReceiptListResponse(success=True, data=receipts, total=len(receipts))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list receipts: {str(e)}")


@app.get("/api/receipts/{receipt_id}", response_model=ReceiptResponse)
async def get_receipt(receipt_id: str):
    receipt = database_service.get_receipt(receipt_id)
    if not receipt:
        raise HTTPException(status_code=404, detail="Receipt not found")
    return ReceiptResponse(success=True, data=receipt)


@app.delete("/api/receipts/{receipt_id}")
async def delete_receipt(receipt_id: str):
    blob_name = database_service.delete_receipt(receipt_id)
    if not blob_name:
        raise HTTPException(status_code=404, detail="Receipt not found")
    try:
        storage_service.delete_file(blob_name)
    except Exception as e:
        logger.warning(f"Warning: Failed to delete file {blob_name}: {e}")
    return {"success": True, "message": "Receipt deleted successfully"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)

"""
Pydantic models for Receipt data structures.
"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum


class ProcessingStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class LineItem(BaseModel):
    """Individual line item from a receipt."""
    description: str
    quantity: Optional[float] = 1.0
    unit_price: Optional[float] = None
    total: Optional[float] = None


class ReceiptCreate(BaseModel):
    """Request model for creating a receipt (file upload handled separately)."""
    pass


class ReceiptData(BaseModel):
    """Extracted receipt data from AI processing."""
    merchant: Optional[str] = None
    date: Optional[str] = None
    total: Optional[float] = None
    currency: Optional[str] = "USD"
    subtotal: Optional[float] = None
    tax: Optional[float] = None
    tip: Optional[float] = None
    payment_method: Optional[str] = None
    items: List[LineItem] = Field(default_factory=list)
    category: Optional[str] = None
    notes: Optional[str] = None


class Receipt(BaseModel):
    """Complete receipt model with all data."""
    id: str
    file_name: str
    file_url: str
    file_type: str
    extracted_data: Optional[ReceiptData] = None
    processing_status: ProcessingStatus = ProcessingStatus.PENDING
    error_message: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ReceiptResponse(BaseModel):
    """API response model for a single receipt."""
    success: bool
    data: Optional[Receipt] = None
    message: Optional[str] = None


class ReceiptListResponse(BaseModel):
    """API response model for list of receipts."""
    success: bool
    data: List[Receipt] = Field(default_factory=list)
    total: int = 0
    message: Optional[str] = None

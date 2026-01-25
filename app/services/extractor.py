"""
Gemini AI service for fully multimodal receipt data extraction.
Uses structured outputs with Pydantic schema for reliable extraction.
"""
import json
import re
import logging
from typing import Optional, List
from pydantic import BaseModel, Field
from google import genai
from google.genai import types

from app.config import get_settings
from app.models import ReceiptData, LineItem

logger = logging.getLogger(__name__)


# Define Pydantic schema for structured output
class ExtractedLineItem(BaseModel):
    """A single line item from a receipt."""
    description: str = Field(description="Item name/description")
    quantity: Optional[float] = Field(default=1, description="Quantity purchased")
    unit_price: Optional[float] = Field(default=None, description="Price per unit")
    total: Optional[float] = Field(default=None, description="Line total")


class ExtractedReceipt(BaseModel):
    """Structured receipt data extracted by AI."""
    merchant: Optional[str] = Field(default=None, description="Store/restaurant name")
    date: Optional[str] = Field(default=None, description="Date in YYYY-MM-DD format if possible")
    total: Optional[float] = Field(default=None, description="Total amount")
    currency: str = Field(default="USD", description="Currency code (USD, EUR, etc.)")
    subtotal: Optional[float] = Field(default=None, description="Subtotal before tax")
    tax: Optional[float] = Field(default=None, description="Tax amount")
    tip: Optional[float] = Field(default=None, description="Tip amount if applicable")
    payment_method: Optional[str] = Field(default=None, description="Cash, Credit Card, Debit, etc.")
    items: List[ExtractedLineItem] = Field(default_factory=list, description="Line items")
    category: Optional[str] = Field(default=None, description="Category like Groceries, Restaurant, etc.")
    notes: Optional[str] = Field(default=None, description="Any other relevant information")


# Prompt for extraction
EXTRACTION_PROMPT = """Analyze this receipt image and extract all visible information.
Be accurate with the total and include as many line items as you can identify.
Use null for any field that cannot be determined."""


class ExtractorService:
    """Service for extracting structured data from receipt images using Gemini."""
    
    def __init__(self):
        self.settings = get_settings()
        self._client = None
    
    @property
    def client(self):
        """Lazy initialization of Gemini client."""
        if self._client is None:
            self._client = genai.Client(api_key=self.settings.google_api_key)
        return self._client
    
    def extract_from_file(self, file_content: bytes, mime_type: str) -> ReceiptData:
        """
        Extract structured data from receipt image using Gemini with structured output.
        """
        # Create content part for the file
        file_part = types.Part.from_bytes(
            data=file_content,
            mime_type=mime_type
        )
        
        logger.info(f"🤖 Calling Gemini using model: {self.settings.gemini_model}")
        logger.info(f"📄 File size: {len(file_content)} bytes, MIME type: {mime_type}")
        
        # Call Gemini API with structured output schema
        response = self.client.models.generate_content(
            model=self.settings.gemini_model,
            contents=[file_part, EXTRACTION_PROMPT],
            config=types.GenerateContentConfig(
                response_mime_type='application/json',
                response_schema=ExtractedReceipt
            )
        )
        
        # Debug: Log raw response details
        logger.info(f"📥 Response received:")
        logger.info(f"   - candidates: {len(response.candidates) if response.candidates else 0}")
        
        if response.candidates:
            candidate = response.candidates[0]
            logger.info(f"   - finish_reason: {candidate.finish_reason}")
            logger.info(f"   - safety_ratings: {candidate.safety_ratings}")
            
            if candidate.content and candidate.content.parts:
                for i, part in enumerate(candidate.content.parts):
                    logger.info(f"   - part[{i}].text length: {len(part.text) if part.text else 0}")
        
        # Check for blocked content or safety issues
        if response.candidates and response.candidates[0].finish_reason:
            finish_reason = str(response.candidates[0].finish_reason)
            if "SAFETY" in finish_reason or "BLOCKED" in finish_reason:
                raise Exception(f"Content blocked by safety filters: {finish_reason}")
        
        # Parse the response
        response_text = response.text
        if not response_text:
            # Try to get text from candidates directly
            if response.candidates and response.candidates[0].content:
                parts = response.candidates[0].content.parts
                if parts and parts[0].text:
                    response_text = parts[0].text
        
        if not response_text:
            logger.error(f"❌ Empty response. Full response object: {response}")
            raise Exception("Received empty response from Gemini AI. Check logs for details.")
        
        logger.info(f"✅ Got response: {response_text[:200]}...")
        
        # Parse JSON response into our Pydantic model
        extracted = ExtractedReceipt.model_validate_json(response_text)
        
        # Convert to app's ReceiptData model
        items = [
            LineItem(
                description=item.description,
                quantity=item.quantity,
                unit_price=item.unit_price,
                total=item.total
            )
            for item in extracted.items
        ]
        
        return ReceiptData(
            merchant=extracted.merchant,
            date=extracted.date,
            total=extracted.total,
            currency=extracted.currency,
            subtotal=extracted.subtotal,
            tax=extracted.tax,
            tip=extracted.tip,
            payment_method=extracted.payment_method,
            items=items,
            category=extracted.category,
            notes=extracted.notes
        )


# Global instance
extractor_service = ExtractorService()

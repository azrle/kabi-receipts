import requests
import json
import logging
import argparse
import os
import time
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from dateutil.relativedelta import relativedelta
from dotenv import load_dotenv

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

class CostcoCrawler:
    """
    Crawler to fetch receipts from Costco using their GraphQL API.
    Based on implementation: https://github.com/dangoldin/costco-analysis
    """
    
    GRAPHQL_URL = "https://ecom-api.costco.com/ebusiness/order/v1/orders/graphql"
    
    def __init__(self):
        load_dotenv()
        self.bearer_token = os.getenv('COSTCO_BEARER_TOKEN')
        self.wcs_client_id = os.getenv('COSTCO_WCS_CLIENT_ID')
        self.client_identifier = os.getenv('COSTCO_CLIENT_IDENTIFIER')
        
        self.session = requests.Session()
        
        # Validate credentials only if we are taking actions that require them
        self._headers_configured = False

    def _configure_headers(self):
        """Configure headers for the session. Raises ValueError if creds are missing."""
        if self._headers_configured:
            return

        if not self.bearer_token:
            raise ValueError("COSTCO_BEARER_TOKEN environment variable is required.")
        
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:140.0) Gecko/20100101 Firefox/140.0',
            'Accept': '*/*',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate, br, zstd',
            'costco.service': 'restOrders',
            'costco.env': 'ecom',
            'costco-x-authorization': f'Bearer {self.bearer_token}',
            'Content-Type': 'application/json-patch+json',
            'costco-x-wcs-clientId': self.wcs_client_id,
            'client-identifier': self.client_identifier,
            'Origin': 'https://www.costco.com',
            'DNT': '1',
            'Sec-GPC': '1',
            'Connection': 'keep-alive',
            'Referer': 'https://www.costco.com/',
            'Sec-Fetch-Dest': 'empty',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Site': 'same-site'
        })
        self._headers_configured = True

    def generate_quarters(self, start_date: datetime, end_date: datetime) -> List[tuple]:
        """Generate quarterly date ranges from start_date to end_date"""
        quarters = []
        current = start_date

        while current < end_date:
            # Calculate quarter end (3 months later, minus 1 day)
            quarter_end = current + relativedelta(months=3) - timedelta(days=1)
            if quarter_end > end_date:
                quarter_end = end_date

            quarters.append((current, quarter_end))
            current = current + relativedelta(months=3)

        return quarters

    def fetch_receipts_list_chunk(self, start_date: datetime, end_date: datetime) -> List[Dict[str, Any]]:
        """Fetch list of receipts for a specific date range (max 6 months recommended, we use quarters)."""
        self._configure_headers()
        
        query = """query receiptsWithCounts($startDate: String!, $endDate: String!,$documentType:String!,$documentSubType:String!) {
        receiptsWithCounts(startDate: $startDate, endDate: $endDate,documentType:$documentType,documentSubType:$documentSubType) {
        receipts{
            transactionBarcode
            transactionDateTime
            total
            warehouseName
        }
    }
      }"""
        
        start_str = start_date.strftime("%-m/%d/%Y")
        end_str = end_date.strftime("%-m/%d/%Y")
        
        payload = {
            "query": query,
            "variables": {
                "startDate": start_str,
                "endDate": end_str,
                "text": f"{start_str} to {end_str}",
                "documentType": "all",
                "documentSubType": "all"
            }
        }
        
        logger.info(f"Fetching receipt list for {start_str} to {end_str}...")
        try:
            response = self.session.post(self.GRAPHQL_URL, json=payload)
            if response.status_code != 200:
                logger.error(f"Error fetching list: {response.status_code} - {response.text[:500]}")
                return []
                
            response.raise_for_status()
            data = response.json()
            receipts = data.get('data', {}).get('receiptsWithCounts', {}).get('receipts', [])
            return receipts
        except Exception as e:
            logger.error(f"Exception fetching list for {start_str}: {e}")
            return []

    def fetch_receipt_details(self, barcode: str) -> Optional[Dict[str, Any]]:
        """Fetch full details for a single receipt by barcode."""
        self._configure_headers()
        
        query = """query receiptsWithCounts($barcode: String!,$documentType:String!) {
    receiptsWithCounts(barcode: $barcode,documentType:$documentType) {
receipts{
      warehouseName
      receiptType
      documentType
      transactionDateTime
      transactionDate
      companyNumber
      warehouseNumber
      operatorNumber
      warehouseName
      warehouseShortName
      registerNumber
      transactionNumber
      transactionType
      transactionBarcode
      total
      warehouseAddress1
      warehouseAddress2
      warehouseCity
      warehouseState
      warehouseCountry
      warehousePostalCode
      totalItemCount
      subTotal
      taxes
      total
      invoiceNumber
      sequenceNumber
      itemArray {
        itemNumber
        itemDescription01
        frenchItemDescription1
        itemDescription02
        frenchItemDescription2
        itemIdentifier
        itemDepartmentNumber
        unit
        amount
        taxFlag
        merchantID
        entryMethod
        transDepartmentNumber
        fuelUnitQuantity
        fuelGradeCode
        fuelUnitQuantity
        itemUnitPriceAmount
        fuelUomCode
        fuelUomDescription
        fuelUomDescriptionFr
        fuelGradeDescription
        fuelGradeDescriptionFr
      }
      tenderArray {
        tenderTypeCode
        tenderDescription
        amountTender
        displayAccountNumber
        sequenceNumber
        approvalNumber
        tenderTypeName
      }
        subTaxes {
          tax1
          tax2
          tax3
          tax4
          aTaxAmount
          bTaxAmount
          cTaxAmount
          dTaxAmount
        }
        instantSavings
        membershipNumber
    }
  }
 }"""
        
        payload = {
            "query": query,
            "variables": {
                "barcode": barcode,
                "documentType": "warehouse"
            }
        }
        
        try:
            response = self.session.post(self.GRAPHQL_URL, json=payload)
            response.raise_for_status()
            data = response.json()
            receipts = data.get('data', {}).get('receiptsWithCounts', {}).get('receipts', [])
            if receipts:
                return receipts[0]
            return None
        except Exception as e:
            logger.error(f"Error fetching details for barcode {barcode}: {e}")
            return None

    def fetch_all_receipts(self, start_date: str, end_date: str, delay: float = 1.0) -> List[Dict[str, Any]]:
        """
        Main method to fetch all fully detailed receipts in a date range.
        1. Splitting range into quarters.
        2. Fetching summaries.
        3. Extracting barcodes.
        4. Fetching full details for each barcode.
        """
        start_dt = datetime.strptime(start_date, "%Y-%m-%d")
        end_dt = datetime.strptime(end_date, "%Y-%m-%d")
        
        quarters = self.generate_quarters(start_dt, end_dt)
        all_barcodes = set()
        
        # Step 1: Get all barcodes
        logger.info(f"Step 1: Fetching receipt lists for {len(quarters)} date chunks...")
        for q_start, q_end in quarters:
            receipts_summary = self.fetch_receipts_list_chunk(q_start, q_end)
            for r in receipts_summary:
                bc = r.get('transactionBarcode')
                if bc:
                    all_barcodes.add(bc)
            time.sleep(delay)
            
        logger.info(f"Found {len(all_barcodes)} unique receipts.")
        
        # Step 2: Get details
        full_receipts = []
        logger.info("Step 2: Fetching details for each receipt...")
        
        for i, barcode in enumerate(all_barcodes, 1):
            logger.info(f"[{i}/{len(all_barcodes)}] Fetching details for {barcode}...")
            details = self.fetch_receipt_details(barcode)
            if details:
                full_receipts.append(details)
            time.sleep(delay)
            
        return full_receipts

def main():
    parser = argparse.ArgumentParser(description="Fetch Costco Receipts")
    parser.add_argument("--start-date", required=True, help="YYYY-MM-DD")
    parser.add_argument("--end-date", required=True, help="YYYY-MM-DD")
    parser.add_argument("--output", default="costco_receipts.json", help="Output file")
    parser.add_argument("--sample", action="store_true", help="Generate sample data instead of fetching")
    args = parser.parse_args()

    if args.sample:
        # Sample data provided in the prompt/reference
        sample_data = [{
            "warehouseName": "NEWARK",
            "receiptType": "In-Warehouse",
            "transactionDate": "2026-01-25",
            "total": 94.19,
            "itemArray": [
                {"itemDescription01": "ORG CUCUMBER", "amount": 6.99},
                {"itemDescription01": "BEEF BACKRIB", "amount": 26.66}
            ]
        }]
        with open(args.output, "w") as f:
            json.dump(sample_data, f, indent=4)
        logger.info(f"Generated sample receipt in {args.output}")
        return

    crawler = CostcoCrawler()
    try:
        receipts = crawler.fetch_all_receipts(args.start_date, args.end_date)
        with open(args.output, "w") as f:
            json.dump(receipts, f, indent=4)
        logger.info(f"Saved {len(receipts)} receipts to {args.output}")
    except ValueError as e:
        logger.error(str(e))
        logger.error("Please ensure .env contains COSTCO_BEARER_TOKEN, COSTCO_CLIENT_ID, and COSTCO_CLIENT_IDENTIFIER")

if __name__ == "__main__":
    main()

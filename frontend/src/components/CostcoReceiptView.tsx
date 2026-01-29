import { Receipt } from '@/lib/types';
import { getReceiptImageUrl } from '@/lib/api';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

interface CostcoReceiptViewProps {
    receipt: Receipt;
}

export default function CostcoReceiptView({ receipt }: CostcoReceiptViewProps) {
    // If we have actual JSON data from source file, we could fetch it.
    // For now, let's assume we render using the `extracted_data` which we 
    // populated from the JSON during import. This ensures what we see matches what we have in DB.
    // To match the visual style of the image provided by user, we use a specific layout.

    const ed = receipt.extracted_data;
    if (!ed) return <div className="p-4 text-center">No details available</div>;

    const items = ed.items || [];
    const dateStr = ed.date ? new Date(ed.date).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) : '';
    // Format: 01/25/2026

    // Attempt to parse warehouse info from Notes if stored there (our importer puts it there)
    // Notes format: "Warehouse: {name} #{number}\nTransaction: {barcode}"
    let warehouseInfo = "COSTCO WHOLESALE";
    let warehouseAddress = "Unknown Address"; // We didn't map address in ReceiptData notes, maybe we should have?
    // In our importer, we didn't store address in notes, just name/number.
    // For strict fidelity, we might want to fetch the JSON content.

    // Let's implement fetching the JSON content if file_type is application/json
    const [originalJson, setOriginalJson] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (receipt.file_type === 'application/json') {
            setLoading(true);
            getReceiptImageUrl(receipt.id).then(({ url }) => {
                fetch(url).then(res => res.json()).then(data => {
                    setOriginalJson(data);
                }).catch(err => {
                    console.error("Failed to load original JSON", err);
                }).finally(() => setLoading(false));
            });
        }
    }, [receipt.id, receipt.file_type]);

    if (loading) {
        return <div className="p-8 text-center animate-pulse">Loading original receipt...</div>;
    }

    // Use original JSON if available for better fidelity, otherwise fallback to extracted_data
    const data = originalJson || {};

    const warehouseName = data.warehouseName || "COSTCO";
    const warehouseNumber = data.warehouseNumber || "";
    const address1 = data.warehouseAddress1 || "";
    const city = data.warehouseCity || "";
    const state = data.warehouseState || "";
    const zip = data.warehousePostalCode || "";

    const barcode = data.transactionBarcode || ed.notes?.split('Transaction: ')[1] || "";

    // Line items from original JSON or fallback
    const displayItems = data.itemArray || items.map(i => ({
        // Map back to display format if using extracted_data
        itemNumber: "000000", // placeholder
        itemDescription01: i.description,
        amount: i.total, // or unit price? Original json has 'amount' as line total usually
        unit: i.quantity,
        itemIdentifier: "E", // placeholder
        taxFlag: "N" // placeholder
    }));

    // Helpers
    const fmt = (n: any) => Number(n).toFixed(2);

    return (
        <div className="bg-white text-black font-mono text-sm leading-tight p-6 max-w-md mx-auto shadow-lg my-4 overflow-hidden relative">
            <div className="text-center space-y-1 mb-4">
                <h1 className="text-2xl font-black uppercase tracking-tighter">COSTCO</h1>
                <h2 className="text-xl font-bold uppercase tracking-widest">WHOLESALE</h2>

                <div className="mt-4 font-bold uppercase">
                    {warehouseName} #{warehouseNumber}
                </div>
                <div className="uppercase">
                    {address1}<br />
                    {city}, {state} {zip}
                </div>
            </div>

            {/* Barcode Mockup */}
            <div className="my-6 flex flex-col items-center">
                {/* CSS Barcode simplified simulation */}
                <div className="h-12 w-3/4 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjUwIj48cmVjdCB3aWR0aD0iMiIgaGVpZ2h0PSI1MCIgZmlsbD0iYmxhY2siLz48L3N2Zz4=')] bg-repeat-x" />
                <div className="text-xs mt-1 tracking-widest">{barcode}</div>
            </div>

            {/* Line Items */}
            <div className="space-y-1 mb-4">
                {displayItems.map((item: any, i: number) => {
                    const isReturn = (item.amount < 0 || item.unit < 0);
                    const desc = item.itemDescription01 || item.description;
                    const itemNum = item.itemNumber || "000000";
                    const flag = item.itemIdentifier || "E";
                    const tax = item.taxFlag || "N";
                    const amount = item.amount || 0;

                    return (
                        <div key={i} className="flex justify-between items-start gap-2">
                            <div className="flex gap-2 w-full">
                                <span className="w-4 flex-shrink-0">{flag}</span>
                                <span className="w-14 flex-shrink-0">{itemNum}</span>
                                <span className="flex-grow uppercase truncate">{desc}</span>
                            </div>
                            <div className="flex gap-2 flex-shrink-0">
                                <span className="w-12 text-right">{fmt(Math.abs(amount))}{isReturn ? '-' : ' '}</span>
                                <span className="w-2">{tax}</span>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Totals */}
            <div className="border-t border-dashed border-black pt-2 space-y-1 mb-6">
                <div className="flex justify-between pl-20 pr-4">
                    <span>SUBTOTAL</span>
                    <span>{fmt(data.subTotal || ed.subtotal || 0)}</span>
                </div>
                <div className="flex justify-between pl-20 pr-4">
                    <span>TAX</span>
                    <span>{fmt(data.taxes || ed.tax || 0)}</span>
                </div>
                <div className="flex justify-between pl-20 pr-4 font-bold text-lg mt-2">
                    <span>**** TOTAL</span>
                    <span className="bg-black text-white px-1">{fmt(data.total || ed.total || 0)}</span>
                </div>
            </div>

            <div className="border-b border-dashed border-black mb-4" />

            {/* Payment & Footer */}
            <div className="space-y-1 text-xs">
                {/* Tenders */}
                {(data.tenderArray || []).map((t: any, idx: number) => (
                    <div key={idx} className="flex justify-between">
                        <span className="uppercase">{t.tenderDescription}</span>
                        <span>{fmt(t.amountTender)}</span>
                    </div>
                ))}

                <div className="flex justify-between">
                    <span>CHANGE</span>
                    <span>0.00</span>
                </div>

                <div className="border-b border-dashed border-black my-2" />

                <div className="flex justify-between">
                    <span>TOTAL TAX</span>
                    <span>{fmt(data.totalTax || data.taxes || 0)}</span>
                </div>
                <div className="mt-2">
                    TOTAL NUMBER OF ITEMS SOLD = {data.totalItemCount || items.length}
                </div>
                <div className="flex justify-between">
                    <span>INSTANT SAVINGS</span>
                    <span>${fmt(data.instantSavings || 0)}</span>
                </div>

                <div className="mt-4 flex gap-4">
                    <span className="bg-black text-white px-1">{dateStr}</span>
                    <span>{data.transactionDateTime?.split('T')[1]?.slice(0, 5) || "00:00"}</span>
                    <span>{warehouseNumber} {data.registerNumber || "0"} {data.transactionNumber || "0"} {data.operatorNumber || "0"}</span>
                </div>
            </div>

            <div className="mt-8 text-center space-y-2">
                <div className="text-lg">Thank You!</div>
                <div>Please Come Again</div>
            </div>

            <div className="mt-4 text-xs flex justify-between px-8">
                <span>Whse: {warehouseNumber}</span>
                <span>Trm: {data.registerNumber}</span>
                <span>Trn: {data.transactionNumber}</span>
                <span>OPT: {data.operatorNumber}</span>
            </div>

            {/* Bottom timestamp */}
            <div className="mt-6 font-bold">
                <h2>Items Sold: {data.totalItemCount || items.length}</h2>
                <h2>P7 {dateStr} {data.transactionDateTime?.split('T')[1]?.slice(0, 5)}</h2>
            </div>
        </div>
    );
}

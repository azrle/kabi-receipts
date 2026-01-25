'use client';

import { Receipt, formatTotal, getMerchant, ProcessingStatus } from '@/lib/types';
import { TrashIcon } from '@heroicons/react/24/outline';

interface ReceiptTableProps {
    receipts: Receipt[];
    onView: (receipt: Receipt) => void;
    onDelete: (id: string) => void;
    onSearch: (query: string) => void;
}

function StatusBadge({ status }: { status: ProcessingStatus }) {
    const styles = {
        pending: 'bg-yellow-500/20 text-yellow-400',
        processing: 'bg-purple-500/20 text-purple-400',
        completed: 'bg-emerald-500/20 text-emerald-400',
        failed: 'bg-red-500/20 text-red-400',
    };

    const labels = {
        pending: '⏳ Pending',
        processing: '🔄 Processing',
        completed: '✅ Completed',
        failed: '❌ Failed',
    };

    return (
        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${styles[status]}`}>
            {status === 'processing' && (
                <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
            )}
            {labels[status]}
        </span>
    );
}

export default function ReceiptTable({ receipts, onView, onDelete, onSearch }: ReceiptTableProps) {
    if (receipts.length === 0) {
        return null;
    }

    const handleMerchantClick = (e: React.MouseEvent, merchant: string) => {
        e.stopPropagation();
        onSearch(merchant);
    };

    const handleCategoryClick = (e: React.MouseEvent, category: string) => {
        e.stopPropagation();
        onSearch(category);
    };

    return (
        <div className="overflow-x-auto rounded-xl border border-white/10 bg-gradient-to-br from-[#1a1a2e]/80 to-[#141428]/90 backdrop-blur-lg">
            <table className="w-full text-sm">
                <thead>
                    <tr className="border-b border-white/10 bg-white/5">
                        <th className="text-left py-4 px-4 text-gray-400 font-medium uppercase text-xs tracking-wide">
                            Date
                        </th>
                        <th className="text-left py-4 px-4 text-gray-400 font-medium uppercase text-xs tracking-wide">
                            Merchant
                        </th>
                        <th className="text-left py-4 px-4 text-gray-400 font-medium uppercase text-xs tracking-wide">
                            Total
                        </th>
                        <th className="text-left py-4 px-4 text-gray-400 font-medium uppercase text-xs tracking-wide">
                            Category
                        </th>
                        <th className="text-left py-4 px-4 text-gray-400 font-medium uppercase text-xs tracking-wide">
                            Status
                        </th>
                        <th className="text-right py-4 px-4 text-gray-400 font-medium uppercase text-xs tracking-wide">
                            Actions
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {receipts.map((receipt) => {
                        const merchant = receipt.extracted_data?.merchant;
                        const category = receipt.extracted_data?.category;

                        return (
                            <tr
                                key={receipt.id}
                                onClick={() => onView(receipt)}
                                className="border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors group cursor-pointer"
                            >
                                <td className="py-4 px-4 text-gray-300">
                                    {receipt.extracted_data?.date || (
                                        <span className="text-gray-500">—</span>
                                    )}
                                </td>
                                <td className="py-4 px-4">
                                    {merchant ? (
                                        <button
                                            onClick={(e) => handleMerchantClick(e, merchant)}
                                            className="font-medium text-gray-100 hover:text-purple-400 hover:underline transition-colors text-left"
                                        >
                                            {getMerchant(receipt)}
                                        </button>
                                    ) : (
                                        <span className="font-medium text-gray-100">
                                            {getMerchant(receipt)}
                                        </span>
                                    )}
                                </td>
                                <td className="py-4 px-4">
                                    {receipt.extracted_data?.total ? (
                                        <span className="font-semibold bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
                                            {formatTotal(receipt)}
                                        </span>
                                    ) : (
                                        <span className="text-gray-500">—</span>
                                    )}
                                </td>
                                <td className="py-4 px-4">
                                    {category ? (
                                        <button
                                            onClick={(e) => handleCategoryClick(e, category)}
                                            className="inline-flex items-center gap-1 px-2 py-1 bg-white/5 hover:bg-purple-500/20 rounded-full text-xs text-gray-400 hover:text-purple-400 transition-colors"
                                        >
                                            🏷️ {category}
                                        </button>
                                    ) : (
                                        <span className="text-gray-500">—</span>
                                    )}
                                </td>
                                <td className="py-4 px-4">
                                    <StatusBadge status={receipt.processing_status} />
                                </td>
                                <td className="py-4 px-4">
                                    <div className="flex items-center justify-end gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onDelete(receipt.id);
                                            }}
                                            className="flex items-center justify-center p-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 rounded-lg transition-colors"
                                            title="Delete receipt"
                                        >
                                            <TrashIcon className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

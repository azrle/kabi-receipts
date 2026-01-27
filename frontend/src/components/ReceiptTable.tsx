import { useState, useMemo } from 'react';
import { Receipt, formatTotal, getMerchant, ProcessingStatus } from '@/lib/types';
import { TrashIcon, ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/24/outline';

interface ReceiptTableProps {
    receipts: Receipt[];
    onView: (receipt: Receipt) => void;
    onDelete: (id: string) => void;
    onSearch: (query: string) => void;
}

type SortField = 'date' | 'merchant' | 'total' | 'category' | 'status' | 'upload';
type SortOrder = 'asc' | 'desc';

function StatusBadge({ status }: { status: ProcessingStatus }) {
    const styles = {
        pending: 'bg-yellow-500/20 text-yellow-400',
        processing: 'bg-purple-500/20 text-purple-400',
        completed: 'bg-emerald-500/20 text-emerald-400',
        failed: 'bg-red-500/20 text-red-400',
    };

    const labels = {
        pending: 'Wait',
        processing: 'Wait',
        completed: 'Done',
        failed: 'Error',
    };

    return (
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${styles[status]}`}>
            {status === 'processing' && (
                <span className="w-2.5 h-2.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
            )}
            {labels[status]}
        </span>
    );
}

export default function ReceiptTable({ receipts, onView, onDelete, onSearch }: ReceiptTableProps) {
    const [sortField, setSortField] = useState<SortField>('date');
    const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortOrder('desc');
        }
    };

    const sortedReceipts = useMemo(() => {
        return [...receipts].sort((a, b) => {
            let valA: any = '';
            let valB: any = '';

            switch (sortField) {
                case 'date':
                    valA = a.extracted_data?.date || '';
                    valB = b.extracted_data?.date || '';
                    break;
                case 'upload':
                    valA = a.created_at || '';
                    valB = b.created_at || '';
                    break;
                case 'merchant':
                    valA = getMerchant(a).toLowerCase();
                    valB = getMerchant(b).toLowerCase();
                    break;
                case 'total':
                    valA = a.extracted_data?.total || 0;
                    valB = b.extracted_data?.total || 0;
                    break;
                case 'category':
                    valA = a.extracted_data?.category || '';
                    valB = b.extracted_data?.category || '';
                    break;
                case 'status':
                    valA = a.processing_status;
                    valB = b.processing_status;
                    break;
            }

            if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
            if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
            return 0;
        });
    }, [receipts, sortField, sortOrder]);

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

    const SortIcon = ({ field }: { field: SortField }) => {
        if (sortField !== field) return null;
        return sortOrder === 'asc' ? (
            <ChevronUpIcon className="w-3 h-3 ml-1" />
        ) : (
            <ChevronDownIcon className="w-3 h-3 ml-1" />
        );
    };

    return (
        <div className="space-y-4">
            {/* Sort Controls */}
            <div className="flex items-center gap-2 mb-2 px-1">
                <span className="text-xs text-gray-500 font-medium uppercase tracking-wider">Sort by:</span>
                <div className="flex bg-white/5 p-1 rounded-lg border border-white/10">
                    <button
                        onClick={() => handleSort('date')}
                        className={`px-3 py-1 text-[11px] font-bold rounded-md transition-all ${sortField === 'date'
                            ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20'
                            : 'text-gray-400 hover:text-gray-200'
                            }`}
                    >
                        Receipt Date
                    </button>
                    <button
                        onClick={() => handleSort('upload')}
                        className={`px-3 py-1 text-[11px] font-bold rounded-md transition-all ${sortField === 'upload'
                            ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20'
                            : 'text-gray-400 hover:text-gray-200'
                            }`}
                    >
                        Upload Time
                    </button>
                </div>
            </div>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-[#1a1a2e]/80 to-[#141428]/90 backdrop-blur-lg">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-white/10 bg-white/5">
                            <th
                                className="text-left py-4 px-4 text-gray-400 font-medium uppercase text-xs tracking-wide cursor-pointer hover:text-white transition-colors"
                                onClick={() => handleSort('date')}
                            >
                                <div className="flex items-center">Date <SortIcon field="date" /></div>
                            </th>
                            <th
                                className="text-left py-4 px-4 text-gray-400 font-medium uppercase text-xs tracking-wide cursor-pointer hover:text-white transition-colors"
                                onClick={() => handleSort('merchant')}
                            >
                                <div className="flex items-center">Merchant <SortIcon field="merchant" /></div>
                            </th>
                            <th
                                className="text-left py-4 px-4 text-gray-400 font-medium uppercase text-xs tracking-wide cursor-pointer hover:text-white transition-colors"
                                onClick={() => handleSort('total')}
                            >
                                <div className="flex items-center">Total <SortIcon field="total" /></div>
                            </th>
                            <th
                                className="text-left py-4 px-4 text-gray-400 font-medium uppercase text-xs tracking-wide cursor-pointer hover:text-white transition-colors"
                                onClick={() => handleSort('category')}
                            >
                                <div className="flex items-center">Category <SortIcon field="category" /></div>
                            </th>
                            <th
                                className="text-left py-4 px-4 text-gray-400 font-medium uppercase text-xs tracking-wide cursor-pointer hover:text-white transition-colors"
                                onClick={() => handleSort('status')}
                            >
                                <div className="flex items-center">Status <SortIcon field="status" /></div>
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedReceipts.map((receipt) => {
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
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-4">
                {sortedReceipts.map((receipt) => (
                    <div
                        key={receipt.id}
                        onClick={() => onView(receipt)}
                        className="bg-gradient-to-br from-[#1a1a2e]/80 to-[#141428]/90 border border-white/10 rounded-xl p-4 space-y-3 cursor-pointer hover:border-purple-500/50 transition-colors"
                    >
                        <div className="flex justify-between items-start">
                            <div>
                                <h3 className="font-bold text-gray-100">{getMerchant(receipt)}</h3>
                                <p className="text-xs text-gray-500">{receipt.extracted_data?.date || 'No date'}</p>
                            </div>
                            <StatusBadge status={receipt.processing_status} />
                        </div>

                        <div className="flex justify-between items-center">
                            <div className="flex flex-wrap gap-2">
                                {receipt.extracted_data?.category && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-white/5 rounded-full text-[10px] text-gray-400">
                                        🏷️ {receipt.extracted_data.category}
                                    </span>
                                )}
                            </div>
                            <div className="text-right">
                                {receipt.extracted_data?.total ? (
                                    <span className="font-bold text-lg bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
                                        {formatTotal(receipt)}
                                    </span>
                                ) : (
                                    <span className="text-gray-500">—</span>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

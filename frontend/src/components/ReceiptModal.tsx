'use client';

import { useState, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { Receipt, formatTotal, getMerchant, getCurrencySymbol } from '@/lib/types';
import { getReceiptImageUrl } from '@/lib/api';
import toast from 'react-hot-toast';

interface ReceiptModalProps {
    receipt: Receipt | null;
    isOpen: boolean;
    onClose: () => void;
}

export default function ReceiptModal({ receipt, isOpen, onClose }: ReceiptModalProps) {
    if (!receipt) return null;

    const ed = receipt.extracted_data;
    const items = ed?.items || [];
    const currency = ed?.currency || 'USD';
    const symbol = getCurrencySymbol(currency);

    return (
        <Transition appear show={isOpen} as={Fragment}>
            <Dialog as="div" className="relative z-50" onClose={onClose}>
                {/* Backdrop */}
                <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" />
                </Transition.Child>

                {/* Modal */}
                <div className="fixed inset-0 overflow-y-auto">
                    <div className="flex min-h-full items-center justify-center p-4">
                        <Transition.Child
                            as={Fragment}
                            enter="ease-out duration-300"
                            enterFrom="opacity-0 scale-95"
                            enterTo="opacity-100 scale-100"
                            leave="ease-in duration-200"
                            leaveFrom="opacity-100 scale-100"
                            leaveTo="opacity-0 scale-95"
                        >
                            <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-[#1a1a2e] border border-white/10 shadow-xl transition-all">
                                {/* Header */}
                                <div className="flex items-start justify-between p-6 border-b border-white/10 bg-white/5">
                                    <div className="space-y-1">
                                        <Dialog.Title className="text-2xl font-bold text-white tracking-tight">
                                            {getMerchant(receipt)}
                                        </Dialog.Title>
                                        <div className="flex items-center gap-2 text-sm text-gray-400">
                                            <span>{ed?.date || 'Unknown Date'}</span>
                                            {ed?.category && (
                                                <>
                                                    <span>•</span>
                                                    <span className="px-2 py-0.5 rounded-full bg-white/10 text-xs font-medium text-gray-300">
                                                        {ed.category}
                                                    </span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                    <button
                                        onClick={onClose}
                                        className="text-gray-400 hover:text-white transition-colors p-1 rounded-full hover:bg-white/10"
                                    >
                                        <XMarkIcon className="w-6 h-6" />
                                    </button>
                                </div>

                                {/* Content */}
                                <div className="p-6 max-h-[70vh] overflow-y-auto space-y-8">

                                    {/* Line Items Table */}
                                    <div className="overflow-hidden rounded-lg border border-white/5">
                                        <table className="w-full text-sm">
                                            <thead className="bg-white/5">
                                                <tr className="border-b border-white/5 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                                                    <th className="px-4 py-3 w-1/2">Description</th>
                                                    <th className="px-4 py-3 text-center">Qty</th>
                                                    <th className="px-4 py-3 text-right">Price</th>
                                                    <th className="px-4 py-3 text-right">Total</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-white/5">
                                                {items.length > 0 ? (
                                                    items.map((item, idx) => (
                                                        <tr key={idx} className="hover:bg-white/5 transition-colors">
                                                            <td className="px-4 py-3 text-gray-200">{item.description}</td>
                                                            <td className="px-4 py-3 text-center text-gray-400">{item.quantity || 1}</td>
                                                            <td className="px-4 py-3 text-right text-gray-400">
                                                                {item.unit_price != null ? `${symbol}${item.unit_price.toFixed(2)}` : '-'}
                                                            </td>
                                                            <td className="px-4 py-3 text-right font-medium text-gray-200">
                                                                {item.total != null ? `${symbol}${item.total.toFixed(2)}` : '-'}
                                                            </td>
                                                        </tr>
                                                    ))
                                                ) : (
                                                    <tr>
                                                        <td colSpan={4} className="px-4 py-6 text-center text-gray-500 italic">
                                                            No line items extracted
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Calculation Stack */}
                                    <div className="flex flex-col items-end space-y-2 text-sm border-t border-white/10 pt-6">
                                        <div className="flex justify-between w-full sm:w-1/2 md:w-1/3">
                                            <span className="text-gray-400">Subtotal</span>
                                            <span className="font-medium">{ed?.subtotal != null ? `${symbol}${ed.subtotal.toFixed(2)}` : '-'}</span>
                                        </div>
                                        <div className="flex justify-between w-full sm:w-1/2 md:w-1/3">
                                            <span className="text-gray-400">Tax</span>
                                            <span className="font-medium">{ed?.tax != null ? `${symbol}${ed.tax.toFixed(2)}` : '-'}</span>
                                        </div>
                                        <div className="flex justify-between w-full sm:w-1/2 md:w-1/3 border-b border-white/10 pb-2">
                                            <span className="text-gray-400">Tip</span>
                                            <span className="font-medium">{ed?.tip != null ? `${symbol}${ed.tip.toFixed(2)}` : '-'}</span>
                                        </div>
                                        <div className="flex justify-between w-full sm:w-1/2 md:w-1/3 pt-1">
                                            <span className="text-base font-bold text-white">Total</span>
                                            <span className="text-lg font-bold bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
                                                {formatTotal(receipt) || '0.00'}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Additional Info (Footer) */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-white/10">
                                        {/* Payment Info */}
                                        <div className="p-4 rounded-lg bg-white/5 space-y-1">
                                            <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Payment Method</p>
                                            <p className="text-sm font-medium text-gray-200">{ed?.payment_method || '—'}</p>
                                        </div>

                                        {/* Notes */}
                                        <div className="p-4 rounded-lg bg-white/5 space-y-1">
                                            <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Notes</p>
                                            <p className="text-sm text-gray-300 italic">
                                                {ed?.notes || 'No notes available'}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Error Message */}
                                    {receipt.error_message && (
                                        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                                            <p className="text-xs text-red-500 uppercase font-medium mb-1">Extraction Error</p>
                                            <p className="text-sm text-red-400">{receipt.error_message}</p>
                                        </div>
                                    )}

                                    {/* Download Button */}
                                    <DownloadSection receipt={receipt} />
                                </div>
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition>
    );
}

function DetailItem({ label, value }: { label: string; value: string }) {
    return (
        <div className="p-4 bg-white/5 rounded-lg">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{label}</p>
            <p className="text-lg font-medium">{value}</p>
        </div>
    );
}

function DownloadSection({ receipt }: { receipt: Receipt }) {
    const [isLoading, setIsLoading] = useState(false);

    const handleDownload = async () => {
        setIsLoading(true);
        try {
            const { url } = await getReceiptImageUrl(receipt.id);
            window.open(url, '_blank');
        } catch (error) {
            toast.error('Failed to get download URL');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="mt-6 text-center">
            <button
                onClick={handleDownload}
                disabled={isLoading}
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-purple-400 hover:from-purple-500 hover:to-purple-300 text-white font-medium rounded-full shadow-lg shadow-purple-500/30 transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {isLoading ? (
                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                    '📥'
                )}
                Download Original
            </button>
        </div>
    );
}

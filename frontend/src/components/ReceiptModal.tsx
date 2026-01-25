'use client';

import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { Receipt, formatTotal, getMerchant, getCurrencySymbol } from '@/lib/types';

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
                                <div className="flex items-center justify-between p-6 border-b border-white/10">
                                    <Dialog.Title className="text-xl font-semibold">
                                        {getMerchant(receipt)}
                                    </Dialog.Title>
                                    <button
                                        onClick={onClose}
                                        className="text-gray-400 hover:text-white transition-colors"
                                    >
                                        <XMarkIcon className="w-6 h-6" />
                                    </button>
                                </div>

                                {/* Content */}
                                <div className="p-6 max-h-[70vh] overflow-y-auto">

                                    {/* Details Grid */}
                                    <div className="grid grid-cols-2 gap-4 mb-6">
                                        <DetailItem label="Merchant" value={ed?.merchant || 'Unknown'} />
                                        <DetailItem label="Date" value={ed?.date || 'Unknown'} />
                                        <DetailItem label="Total" value={formatTotal(receipt) || 'Unknown'} />
                                        <DetailItem label="Payment Method" value={ed?.payment_method || 'Unknown'} />
                                        {ed?.subtotal != null && (
                                            <DetailItem label="Subtotal" value={`${symbol}${ed.subtotal.toFixed(2)}`} />
                                        )}
                                        {ed?.tax != null && (
                                            <DetailItem label="Tax" value={`${symbol}${ed.tax.toFixed(2)}`} />
                                        )}
                                        {ed?.tip != null && (
                                            <DetailItem label="Tip" value={`${symbol}${ed.tip.toFixed(2)}`} />
                                        )}
                                        {ed?.category && (
                                            <DetailItem label="Category" value={ed.category} />
                                        )}
                                    </div>

                                    {/* Line Items */}
                                    {items.length > 0 && (
                                        <div className="mb-6">
                                            <h3 className="text-lg font-semibold mb-3">Line Items</h3>
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-sm">
                                                    <thead>
                                                        <tr className="border-b border-white/10">
                                                            <th className="text-left py-2 px-3 text-gray-500 font-medium uppercase text-xs tracking-wide">Description</th>
                                                            <th className="text-left py-2 px-3 text-gray-500 font-medium uppercase text-xs tracking-wide">Qty</th>
                                                            <th className="text-left py-2 px-3 text-gray-500 font-medium uppercase text-xs tracking-wide">Price</th>
                                                            <th className="text-left py-2 px-3 text-gray-500 font-medium uppercase text-xs tracking-wide">Total</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {items.map((item, idx) => (
                                                            <tr key={idx} className="border-b border-white/5 last:border-0">
                                                                <td className="py-2 px-3">{item.description}</td>
                                                                <td className="py-2 px-3">{item.quantity || 1}</td>
                                                                <td className="py-2 px-3">
                                                                    {item.unit_price != null ? `${symbol}${item.unit_price.toFixed(2)}` : '-'}
                                                                </td>
                                                                <td className="py-2 px-3">
                                                                    {item.total != null ? `${symbol}${item.total.toFixed(2)}` : '-'}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}

                                    {/* Notes */}
                                    {ed?.notes && (
                                        <DetailItem label="Notes" value={ed.notes} />
                                    )}

                                    {/* Error */}
                                    {receipt.error_message && (
                                        <div className="mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                                            <p className="text-xs text-red-500 uppercase font-medium mb-1">Error</p>
                                            <p className="text-red-400">{receipt.error_message}</p>
                                        </div>
                                    )}

                                    {/* Download Button */}
                                    <div className="mt-6 text-center">
                                        <a
                                            href={receipt.file_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-purple-400 hover:from-purple-500 hover:to-purple-300 text-white font-medium rounded-full shadow-lg shadow-purple-500/30 transition-all hover:-translate-y-0.5"
                                        >
                                            📥 Download Original
                                        </a>
                                    </div>
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

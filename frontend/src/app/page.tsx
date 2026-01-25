'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSession, signOut } from "next-auth/react";
import toast from 'react-hot-toast';
import UploadButton from '@/components/UploadButton';
import ReceiptTable from '@/components/ReceiptTable';
import ReceiptModal from '@/components/ReceiptModal';
import SearchBox from '@/components/SearchBox';
import LoginButton from '@/components/LoginButton';
import { Receipt, ApiError } from '@/lib/types';
import { uploadReceipt, getReceipts, deleteReceipt } from '@/lib/api';
import { ArrowPathIcon, InboxIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

export default function Home() {
  const { data: session, status } = useSession();
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<{ title: string; message: string } | null>(null);

  // Load receipts
  const loadReceipts = useCallback(async () => {
    if (status !== 'authenticated') return;
    setError(null);

    try {
      const response = await getReceipts();
      if (response.success) {
        setReceipts(response.data);
      }
    } catch (error) {
      console.error('Failed to load receipts:', error);
      if (error instanceof ApiError) {
        if (error.status === 403) {
          setError({
            title: 'Access Denied',
            message: 'You are not authorized to access this service. Please contact the administrator.'
          });
        } else if (error.status === 401) {
          setError({
            title: 'Authentication Failed',
            message: 'Please try signing in again.'
          });
        } else {
          setError({
            title: 'Connection Error',
            message: 'Failed to connect to the server. Please try again later.'
          });
        }
      } else {
        setError({
          title: 'Unknown Error',
          message: 'An unexpected error occurred.'
        });
      }
    } finally {
      setIsLoading(false);
    }
  }, [status]);

  // Initial load
  useEffect(() => {
    if (status === 'authenticated') {
      loadReceipts();
    } else if (status === 'unauthenticated') {
      setIsLoading(false);
    }
  }, [loadReceipts, status]);

  // Filter receipts based on search query
  const filteredReceipts = useMemo(() => {
    if (!searchQuery.trim()) {
      return receipts;
    }

    const query = searchQuery.toLowerCase();
    return receipts.filter((receipt) => {
      // Search in merchant name
      const merchant = receipt.extracted_data?.merchant?.toLowerCase() || '';
      if (merchant.includes(query)) return true;

      // Search in date
      const date = receipt.extracted_data?.date?.toLowerCase() || '';
      if (date.includes(query)) return true;

      // Search in category
      const category = receipt.extracted_data?.category?.toLowerCase() || '';
      if (category.includes(query)) return true;

      // Search in line items
      const items = receipt.extracted_data?.items || [];
      for (const item of items) {
        if (item.description?.toLowerCase().includes(query)) return true;
      }

      // Search in file name
      if (receipt.file_name.toLowerCase().includes(query)) return true;

      return false;
    });
  }, [receipts, searchQuery]);

  // Handle file upload
  const handleUpload = async (file: File) => {
    setIsUploading(true);

    try {
      const response = await uploadReceipt(file);
      if (response.success) {
        toast.success('Receipt uploaded! Processing with AI...');
        loadReceipts();
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        toast.error('You are not authorized to upload files.');
      } else {
        toast.error(error instanceof Error ? error.message : 'Upload failed');
      }
    } finally {
      setIsUploading(false);
    }
  };

  // Handle view receipt
  const handleView = (receipt: Receipt) => {
    setSelectedReceipt(receipt);
    setIsModalOpen(true);
  };

  // Handle delete receipt
  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this receipt?')) {
      return;
    }

    try {
      await deleteReceipt(id);
      toast.success('Receipt deleted successfully');
      loadReceipts();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Delete failed');
    }
  };

  // Handle search
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-[#0f0f1a] text-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  if (!session) {
    return (
      <main className="min-h-screen bg-[#0f0f1a] text-gray-100 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-8">
          <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-500 to-purple-300">
            Kabi Receipts
          </h1>
          <p className="text-gray-400 text-lg">
            Securely upload and manage your receipts with AI-powered extraction.
          </p>
          <div className="flex justify-center">
            <LoginButton />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <header className="flex flex-col md:flex-row items-center justify-between mb-10 gap-4">
          <div className="text-center md:text-left">
            <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-purple-500 to-purple-300 bg-clip-text text-transparent inline-flex items-center gap-3">
              <span>📄</span>
              Kabi Receipts
            </h1>
            <p className="text-gray-400 text-lg">
              Upload your receipts and let AI extract the data for you
            </p>
          </div>

          <div className="flex items-center gap-4 bg-white/5 p-2 rounded-xl backdrop-blur-sm border border-white/10">
            <span className="text-sm text-gray-300 px-2">{session.user?.email}</span>
            <button
              onClick={() => signOut()}
              className="text-sm px-4 py-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
            >
              Sign out
            </button>
          </div>
        </header>

        {/* Error State */}
        {error ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="bg-red-500/10 p-4 rounded-full mb-4">
              <ExclamationTriangleIcon className="w-12 h-12 text-red-500" />
            </div>
            <h3 className="text-2xl font-semibold text-gray-200 mb-2">{error.title}</h3>
            <p className="text-gray-400 max-w-md">{error.message}</p>
            {error.title === 'Authentication Failed' && (
              <button
                onClick={() => signOut()}
                className="mt-6 px-6 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg transition-colors"
              >
                Sign in again
              </button>
            )}
          </div>
        ) : (
          /* Receipts Section */
          <section>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
              <h2 className="text-2xl font-semibold flex items-center gap-2">
                📋 Your Receipts
                {receipts.length > 0 && (
                  <span className="text-sm font-normal text-gray-500">
                    ({filteredReceipts.length} of {receipts.length})
                  </span>
                )}
              </h2>
              <UploadButton onUpload={handleUpload} isUploading={isUploading} />
            </div>

            {/* Search Box */}
            {receipts.length > 0 && (
              <div className="mb-6">
                <SearchBox value={searchQuery} onChange={setSearchQuery} />
              </div>
            )}

            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : receipts.length === 0 ? (
              <div className="text-center py-16 text-gray-500">
                <InboxIcon className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <h3 className="text-xl font-medium mb-2">No receipts yet</h3>
                <p>Upload your first receipt to get started</p>
              </div>
            ) : filteredReceipts.length === 0 ? (
              <div className="text-center py-16 text-gray-500">
                <h3 className="text-xl font-medium mb-2">No matching receipts</h3>
                <p>Try adjusting your search query</p>
              </div>
            ) : (
              <ReceiptTable
                receipts={filteredReceipts}
                onView={handleView}
                onDelete={handleDelete}
                onSearch={setSearchQuery}
              />
            )}
          </section>
        )}
      </div>

      {/* Receipt Modal */}
      <ReceiptModal
        receipt={selectedReceipt}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </main>
  );
}

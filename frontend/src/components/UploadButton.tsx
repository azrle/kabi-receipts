'use client';

import { useRef, useState } from 'react';
import { PlusIcon } from '@heroicons/react/24/outline';

interface UploadButtonProps {
    onUpload: (file: File) => void;
    isUploading: boolean;
}

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

export default function UploadButton({ onUpload, isUploading }: UploadButtonProps) {
    const [error, setError] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const handleClick = () => {
        if (!isUploading && inputRef.current) {
            inputRef.current.click();
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setError(null);
        const file = e.target.files?.[0];

        if (!file) return;

        if (!ALLOWED_TYPES.includes(file.type)) {
            setError('Invalid file type. Please upload JPG, PNG, GIF, or PDF.');
            return;
        }

        if (file.size > MAX_SIZE) {
            setError('File too large. Maximum size is 10MB.');
            return;
        }

        onUpload(file);

        // Reset input so same file can be uploaded again
        if (inputRef.current) {
            inputRef.current.value = '';
        }
    };

    return (
        <div className="flex flex-col items-center gap-2">
            <button
                onClick={handleClick}
                disabled={isUploading}
                className={`
                    flex items-center gap-2 px-6 py-3
                    bg-gradient-to-r from-purple-600 to-purple-500 
                    hover:from-purple-500 hover:to-purple-400
                    text-white font-medium rounded-full
                    shadow-lg shadow-purple-500/30
                    transition-all duration-200
                    hover:-translate-y-0.5 hover:shadow-xl hover:shadow-purple-500/40
                    ${isUploading ? 'opacity-60 cursor-not-allowed' : ''}
                `}
            >
                {isUploading ? (
                    <>
                        <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Uploading...
                    </>
                ) : (
                    <>
                        <PlusIcon className="w-5 h-5" />
                        Upload Receipt
                    </>
                )}
            </button>

            <input
                ref={inputRef}
                type="file"
                accept=".jpg,.jpeg,.png,.gif,.pdf"
                onChange={handleChange}
                className="hidden"
            />

            <span className="text-xs text-gray-500">
                JPG, PNG, GIF, PDF (max 10MB)
            </span>

            {error && (
                <p className="text-red-400 text-sm">{error}</p>
            )}
        </div>
    );
}

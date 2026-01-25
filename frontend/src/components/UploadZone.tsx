'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { CloudArrowUpIcon } from '@heroicons/react/24/outline';

interface UploadZoneProps {
    onUpload: (file: File) => void;
    isUploading: boolean;
}

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

export default function UploadZone({ onUpload, isUploading }: UploadZoneProps) {
    const [error, setError] = useState<string | null>(null);

    const onDrop = useCallback(
        (acceptedFiles: File[], rejectedFiles: unknown[]) => {
            setError(null);

            if (rejectedFiles.length > 0) {
                setError('Invalid file. Please upload an image or PDF (max 10MB).');
                return;
            }

            if (acceptedFiles.length > 0) {
                onUpload(acceptedFiles[0]);
            }
        },
        [onUpload]
    );

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'image/jpeg': ['.jpg', '.jpeg'],
            'image/png': ['.png'],
            'image/gif': ['.gif'],
            'application/pdf': ['.pdf'],
        },
        maxSize: MAX_SIZE,
        multiple: false,
        disabled: isUploading,
    });

    return (
        <div
            {...getRootProps()}
            className={`
        relative overflow-hidden rounded-2xl border-2 border-dashed p-12 text-center cursor-pointer
        transition-all duration-300 ease-out
        bg-gradient-to-br from-[#282846]/60 to-[#141428]/80
        backdrop-blur-lg
        ${isDragActive
                    ? 'border-purple-500 scale-[1.02] shadow-2xl shadow-purple-500/20'
                    : 'border-white/10 hover:border-purple-500/50 hover:-translate-y-1 hover:shadow-xl'
                }
        ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}
      `}
        >
            {/* Gradient overlay on hover */}
            <div
                className={`
          absolute inset-0 bg-gradient-to-r from-purple-600 to-purple-400 opacity-0 
          transition-opacity duration-300
          ${isDragActive ? 'opacity-10' : 'group-hover:opacity-5'}
        `}
            />

            <input {...getInputProps()} />

            <div className="relative z-10">
                <CloudArrowUpIcon
                    className={`
            w-16 h-16 mx-auto mb-4 text-purple-400
            ${!isUploading ? 'animate-float' : ''}
          `}
                />

                <h2 className="text-xl font-semibold mb-2">
                    {isDragActive ? 'Drop your receipt here' : 'Drop your receipt here'}
                </h2>

                <p className="text-gray-400 mb-4">
                    or click to browse files
                </p>

                <span className="text-sm text-gray-500">
                    Supports: JPG, PNG, GIF, PDF (max 10MB)
                </span>

                {error && (
                    <p className="mt-4 text-red-400 text-sm">{error}</p>
                )}

                {isUploading && (
                    <div className="mt-4 flex items-center justify-center gap-2 text-purple-400">
                        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        <span>Uploading...</span>
                    </div>
                )}
            </div>
        </div>
    );
}

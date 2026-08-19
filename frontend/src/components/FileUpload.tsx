'use client';

import { useState, useCallback } from 'react';
import { api } from '@/lib/api';

interface FileUploadProps {
  onUploadComplete?: () => void;
}

export default function FileUpload({ onUploadComplete }: FileUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleUpload = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setError(null);
    setSuccess(null);
    setUploading(true);

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ext = file.name.toLowerCase().split('.').pop();

      if (ext !== 'pdf' && ext !== 'docx') {
        errorCount++;
        continue;
      }

      try {
        await api.uploadCV(file);
        successCount++;
      } catch {
        errorCount++;
      }
    }

    setUploading(false);

    if (successCount > 0) {
      setSuccess(`Successfully uploaded ${successCount} file(s)`);
      if (onUploadComplete) {
        onUploadComplete();
      }
    }

    if (errorCount > 0) {
      setError(`Failed to upload ${errorCount} file(s). Only PDF and DOCX files are supported.`);
    }
  }, [onUploadComplete]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      handleUpload(e.dataTransfer.files);
    },
    [handleUpload]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  return (
    <div className="space-y-3">
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
          dragOver
            ? 'border-indigo-300 bg-indigo-50'
            : 'border-gray-300 bg-muted hover:border-gray-300'
        }`}
      >
        <input
          type="file"
          accept=".pdf,.docx"
          multiple
          onChange={(e) => handleUpload(e.target.files)}
          className="hidden"
          id="file-upload"
          disabled={uploading}
        />
        <label
          htmlFor="file-upload"
          className="cursor-pointer flex flex-col items-center"
        >
          {uploading ? (
            <div className="flex items-center gap-2">
              <div className="spinner w-5 h-5"></div>
              <span className="text-muted-foreground">Uploading...</span>
            </div>
          ) : (
            <>
              <svg
                className="w-10 h-10 text-muted-foreground/50 mb-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
              <span className="text-muted-foreground font-medium">
                Drop CV files here or click to upload
              </span>
              <span className="text-sm text-muted-foreground mt-1">
                PDF and DOCX files supported
              </span>
            </>
          )}
        </label>
      </div>

      {error && (
        <div className="alert-error">
          {error}
        </div>
      )}

      {success && (
        <div className="alert-success">
          {success}
        </div>
      )}
    </div>
  );
}

'use client';

import React, { useState } from 'react';
import { ApiService } from '../../services/api.service';
import { ShieldAlert, ShieldCheck, Loader2 } from 'lucide-react';
import { VerifyFileResponse } from '@/types';

export default function VerifyPage() {
  const [documentId, setDocumentId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerifyFileResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!documentId.trim()) {
      setError('Please enter a Document ID.');
      return;
    }
    if (!file) {
      setError('Please upload a scanned file copy.');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await ApiService.verifyScan(documentId, file);
      setResult(res);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to complete verification request. Verify the Document ID is correct.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-12 flex-1 flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Verify Document Scan</h1>
        <p className="text-sm text-slate-500 mt-1">Submit a document scan alongside its Document ID to detect unauthorized updates.</p>
      </div>

      <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-xs flex flex-col gap-6">
        <form onSubmit={handleVerify} className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-slate-700">Document ID (UUID)</label>
            <input
              type="text"
              placeholder="e.g. a98dfb02-5c91-4cf1-8bc9-93e1189ac3f2"
              value={documentId}
              onChange={(e) => setDocumentId(e.target.value)}
              className="border border-slate-200 rounded-lg px-4 py-2 text-sm focus:outline-hidden focus:border-blue-900"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-slate-700">Upload Scanned File Copy (PDF/PNG/JPG)</label>
            <div className="border-2 border-dashed border-slate-200 hover:border-blue-900 rounded-lg p-6 text-center cursor-pointer transition-colors relative">
              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={handleFileChange}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <span className="text-sm text-slate-500 font-medium block">
                {file ? `Selected file: ${file.name}` : 'Drag & drop file or click to browse'}
              </span>
              <span className="text-xs text-slate-400 block mt-1">Supports PDF, PNG, or JPG files up to 25MB</span>
            </div>
          </div>

          {error && <div className="text-sm font-medium text-red-600 bg-red-50 p-3 rounded-lg">{error}</div>}

          <button
            type="submit"
            disabled={loading}
            className="bg-blue-900 text-white rounded-lg py-2.5 font-medium hover:bg-blue-950 transition-colors disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? 'Hasing & Verifying...' : 'Submit Verification Check'}
          </button>
        </form>
      </div>

      {result && (
        <div className={`p-8 rounded-xl border flex flex-col gap-6 ${
          result.result === 'authentic' 
            ? 'bg-emerald-50/50 border-emerald-200 text-slate-800' 
            : 'bg-rose-50/50 border-rose-200 text-slate-800'
        }`}>
          <div className="flex items-center gap-4">
            {result.result === 'authentic' ? (
              <div className="p-3 bg-emerald-100 text-emerald-800 rounded-full"><ShieldCheck className="h-8 w-8" /></div>
            ) : (
              <div className="p-3 bg-rose-100 text-rose-800 rounded-full"><ShieldAlert className="h-8 w-8" /></div>
            )}
            <div>
              <h2 className="text-lg font-bold">
                {result.result === 'authentic' ? 'Document Verified: Authentic' : 'Integrity Check Failed: Modified'}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">Checked at {new Date(result.detectedAt).toLocaleString()}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono mt-2">
            <div className="bg-white p-3 rounded-lg border border-slate-100 flex flex-col gap-1">
              <span className="text-slate-400 font-bold uppercase tracking-wider">Solana Anchored Hash</span>
              <span className="text-slate-800 break-all">{result.expectedHash}</span>
            </div>
            <div className="bg-white p-3 rounded-lg border border-slate-100 flex flex-col gap-1">
              <span className="text-slate-400 font-bold uppercase tracking-wider">Submitted File Hash</span>
              <span className={`break-all ${result.result === 'authentic' ? 'text-emerald-850' : 'text-rose-600 font-semibold'}`}>
                {result.submittedHash}
              </span>
            </div>
          </div>

          <div className="flex justify-between items-center bg-white p-4 rounded-lg border border-slate-100 text-sm mt-2">
            <span className="font-semibold text-slate-700">Fraud Risk Score:</span>
            <span className={`font-bold px-3 py-1 rounded-full text-xs ${
              result.riskScore === 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
            }`}>
              {result.riskScore} / 100 ({result.riskScore === 0 ? 'LOW RISK' : 'CRITICAL TAMPERING'})
            </span>
          </div>

          {result.result === 'authentic' && (
            <div className="flex justify-end">
              <a
                href={`${ApiService.apiBaseUrl}/documents/${result.documentId}/certificate`}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-blue-900 text-white rounded-lg px-6 py-2 text-sm font-semibold hover:bg-blue-950 transition-colors"
              >
                Download Verification Certificate
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

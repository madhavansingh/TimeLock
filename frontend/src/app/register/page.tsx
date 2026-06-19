'use client';

import React, { useState } from 'react';
import { ApiService } from '../../services/api.service';
import { RegisterDocumentResponse } from '@/types';
import { Loader2, CheckCircle2, Copy } from 'lucide-react';

const NOTARY_LIST = [
  { id: '7df83c92-d3a9-4672-9b2f-2d93e110b9ad', name: 'Advocate Rao' },
  { id: '1df83c92-d3a9-4672-9b2f-2d93e110b9ae', name: 'Advocate Singh' }
];

export default function RegisterPage() {
  const [title, setTitle] = useState('');
  const [type, setType] = useState('Sale Deed');
  const [notaryId, setNotaryId] = useState(NOTARY_LIST[0].id);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RegisterDocumentResponse | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !file) {
      setError('Please fill in the title and select a document file.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Upload & Register Document
      const res = await ApiService.registerDocument(title, type, notaryId, file);
      setResult(res);

      // 2. Fetch QR Code Asset
      const qrRes = await ApiService.getQrCode(res.documentId);
      setQrCode(qrRes.qrCode);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to register document.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyId = () => {
    if (result) {
      navigator.clipboard.writeText(result.documentId);
      alert('Document ID copied to clipboard!');
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-12 flex-1 flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Register Legal Document</h1>
        <p className="text-sm text-slate-500 mt-1">Anchor document fingerprints on the Solana blockchain and configure notary signatures.</p>
      </div>

      {!result ? (
        <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-xs">
          <form onSubmit={handleRegister} className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-slate-700">Document Title</label>
              <input
                type="text"
                placeholder="e.g. Property Sale Agreement - Plot 42"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="border border-slate-200 rounded-lg px-4 py-2 text-sm focus:outline-hidden focus:border-blue-900"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-slate-700">Document Type</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="border border-slate-200 rounded-lg px-4 py-2 text-sm focus:outline-hidden focus:border-blue-900"
                >
                  <option value="Sale Deed">Sale Deed</option>
                  <option value="Loan Agreement">Loan Agreement</option>
                  <option value="Affidavit">Affidavit</option>
                  <option value="Power of Attorney">Power of Attorney</option>
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-slate-700">Assign Notary Partner</label>
                <select
                  value={notaryId}
                  onChange={(e) => setNotaryId(e.target.value)}
                  className="border border-slate-200 rounded-lg px-4 py-2 text-sm focus:outline-hidden focus:border-blue-900"
                >
                  {NOTARY_LIST.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-slate-700">Select Document File</label>
              <div className="border-2 border-dashed border-slate-200 hover:border-blue-900 rounded-lg p-6 text-center cursor-pointer transition-colors relative">
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={handleFileChange}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
                <span className="text-sm text-slate-500 font-medium block">
                  {file ? `Selected: ${file.name}` : 'Drag & drop document file or click to browse'}
                </span>
              </div>
            </div>

            {error && <div className="text-sm font-medium text-red-650 bg-red-50 p-3 rounded-lg">{error}</div>}

            <button
              type="submit"
              disabled={loading}
              className="bg-blue-900 text-white rounded-lg py-2.5 font-medium hover:bg-blue-950 transition-colors disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? 'Hashing & Securing on Solana...' : 'Register and Anchor Document'}
            </button>
          </form>
        </div>
      ) : (
        <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-xs flex flex-col items-center text-center gap-6">
          <div className="text-emerald-600"><CheckCircle2 className="h-16 w-16" /></div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Document Anchored Successfully!</h2>
            <p className="text-sm text-slate-400 mt-1">Fingerprint is committed to Solana Devnet ledger permanently.</p>
          </div>

          <div className="w-full bg-slate-50 p-4 rounded-lg text-left flex flex-col gap-3 text-sm">
            <div className="flex justify-between items-center border-b border-slate-200/50 pb-2">
              <span className="font-semibold text-slate-600">Document ID:</span>
              <div className="flex items-center gap-1.5 font-mono text-slate-800 text-xs">
                <span>{result.documentId}</span>
                <button onClick={handleCopyId} className="text-slate-400 hover:text-slate-600"><Copy className="h-3.5 w-3.5" /></button>
              </div>
            </div>
            <div className="flex justify-between items-center border-b border-slate-200/50 pb-2">
              <span className="font-semibold text-slate-600">SHA-256 Fingerprint:</span>
              <span className="font-mono text-slate-800 text-xs truncate max-w-xs">{result.hash}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-semibold text-slate-600">Solana Tx Sig:</span>
              <span className="font-mono text-slate-800 text-xs truncate max-w-xs">{result.onchainTxSignature || 'N/A'}</span>
            </div>
          </div>

          {qrCode && (
            <div className="flex flex-col items-center gap-2 border-t border-slate-100 pt-6 w-full">
              <span className="text-sm font-semibold text-slate-700">Verification QR Code</span>
              <p className="text-xs text-slate-400 max-w-md">Print and affix this QR Code to the physical document. Scanning it will load the live verification status.</p>
              <img src={qrCode} alt="Verification QR Code" className="h-44 w-44 border border-slate-200 rounded-lg p-2 bg-white mt-4" />
            </div>
          )}

          <div className="flex gap-4 mt-4 w-full">
            <a href="/dashboard" className="flex-1 border border-slate-200 text-slate-700 py-2.5 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">
              Go to Dashboard
            </a>
            <a href={`/document/${result.documentId}`} className="flex-1 bg-blue-900 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-950 transition-colors">
              View Document Details
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

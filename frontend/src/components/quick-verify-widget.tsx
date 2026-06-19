import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function QuickVerifyWidget() {
  const [docId, setDocId] = useState('');
  const router = useRouter();

  const handleStatusCheck = (e: React.FormEvent) => {
    e.preventDefault();
    if (docId.trim()) {
      router.push(`/document/${docId.trim()}`);
    }
  };

  const handleScanVerification = () => {
    router.push('/verify');
  };

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={handleStatusCheck} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Document ID (UUID)</label>
          <input
            type="text"
            placeholder="Enter UUID to fetch history..."
            value={docId}
            onChange={(e) => setDocId(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-hidden focus:border-blue-900 font-mono"
          />
        </div>
        <button
          type="submit"
          disabled={!docId.trim()}
          className="bg-blue-900 text-white rounded-lg py-2 text-xs font-semibold hover:bg-blue-950 transition-colors disabled:bg-slate-250 disabled:cursor-not-allowed"
        >
          Inspect Audit Timeline
        </button>
      </form>

      <div className="relative flex py-2 items-center">
        <div className="flex-grow border-t border-slate-100"></div>
        <span className="flex-shrink mx-3 text-[10px] text-slate-400 font-bold uppercase tracking-wider">or</span>
        <div className="flex-grow border-t border-slate-100"></div>
      </div>

      <button
        onClick={handleScanVerification}
        className="border border-slate-200 bg-slate-50 text-slate-700 rounded-lg py-2 text-xs font-semibold hover:bg-slate-100 transition-colors"
      >
        Upload Scanned PDF Check
      </button>
    </div>
  );
}

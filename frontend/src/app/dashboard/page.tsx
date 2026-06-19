'use client';

import React, { useEffect, useState } from 'react';
import { ApiService } from '../../services/api.service';
import { Document } from '../../types';
import { DocumentStatus } from '@/types';
import { Shield, FileText, Clock, AlertTriangle } from 'lucide-react';
import QuickVerifyWidget from '../../components/quick-verify-widget';

export default function DashboardPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const data = await ApiService.searchDocuments({});
        setDocuments(data || []);
      } catch (err) {
        console.error('Failed to load documents:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const total = documents.length;
  const verified = documents.filter(d => d.status === DocumentStatus.FULLY_EXECUTED || d.status === DocumentStatus.NOTARY_SIGNED).length;
  const pending = documents.filter(d => d.status === DocumentStatus.PENDING).length;
  const disputes = documents.filter(d => d.status === DocumentStatus.DISPUTED).length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex-1 flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Institutional Dashboard</h1>
        <p className="text-sm text-slate-500 mt-1">Manage documents registry, check signature queues, and run audits.</p>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-900 rounded-lg"><FileText className="h-6 w-6" /></div>
          <div>
            <div className="text-2xl font-bold text-slate-900">{total}</div>
            <div className="text-xs text-slate-400 font-medium">Total Registered</div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg"><Shield className="h-6 w-6" /></div>
          <div>
            <div className="text-2xl font-bold text-slate-900">{verified}</div>
            <div className="text-xs text-slate-400 font-medium">Verified / Signed</div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-lg"><Clock className="h-6 w-6" /></div>
          <div>
            <div className="text-2xl font-bold text-slate-900">{pending}</div>
            <div className="text-xs text-slate-400 font-medium">Pending Solana Anchor</div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-rose-50 text-rose-600 rounded-lg"><AlertTriangle className="h-6 w-6" /></div>
          <div>
            <div className="text-2xl font-bold text-slate-900">{disputes}</div>
            <div className="text-xs text-slate-400 font-medium">Tampering Alerts</div>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid lg:grid-cols-3 gap-8">
        {/* Left Side: Document Registry Table */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col">
          <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
            <h2 className="text-lg font-bold text-slate-950">Recent Documents Registry</h2>
          </div>
          <div className="overflow-x-auto flex-1">
            {loading ? (
              <div className="p-6 text-center text-sm text-slate-400">Loading registry...</div>
            ) : documents.length === 0 ? (
              <div className="p-12 text-center text-sm text-slate-400 flex flex-col items-center gap-2">
                <FileText className="h-10 w-10 text-slate-350" />
                <span>No registered documents found.</span>
                <a href="/register" className="text-blue-900 font-semibold hover:underline mt-2">Register first document &rarr;</a>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="px-6 py-3">Document Title</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Type</th>
                    <th className="px-6 py-3">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {documents.map((doc) => (
                    <tr key={doc.documentId} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 font-medium text-slate-900">
                        <a href={`/document/${doc.documentId}`} className="text-blue-900 hover:underline">
                          {doc.title}
                        </a>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${
                          doc.status === DocumentStatus.FULLY_EXECUTED || doc.status === DocumentStatus.NOTARY_SIGNED
                            ? 'bg-emerald-100 text-emerald-800'
                            : doc.status === DocumentStatus.DISPUTED
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {doc.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-500">{doc.type}</td>
                      <td className="px-6 py-4 text-slate-400 text-xs">{new Date(doc.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Right Side: Verification Widget */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs flex flex-col gap-6">
          <div>
            <h2 className="text-lg font-bold text-slate-950">Quick Verification</h2>
            <p className="text-xs text-slate-400 mt-1">Verify a document hash or ID against the blockchain.</p>
          </div>
          <QuickVerifyWidget />
        </div>
      </div>
    </div>
  );
}

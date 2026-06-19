'use client';

import React, { useEffect, useState, use } from 'react';
import { ApiService } from '../../../services/api.service';
import { DocumentStatusResponse, DocumentStatus, VerificationEvent } from '@/types';
import { FileText, Shield, ExternalLink, Calendar, UserCheck, ShieldAlert, Download, QrCode } from 'lucide-react';
import CustodyTimeline from '../../../components/custody-timeline';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function DocumentDetailsPage({ params }: PageProps) {
  const { id } = use(params);
  const [doc, setDoc] = useState<DocumentStatusResponse | null>(null);
  const [timeline, setTimeline] = useState<VerificationEvent[]>([]);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const details = await ApiService.getDocumentStatus(id);
        setDoc(details);

        const custody = await ApiService.getCustodyTrail(id);
        setTimeline(custody.timeline || []);

        const qr = await ApiService.getQrCode(id);
        setQrCode(qr.qrCode);
      } catch (err: any) {
        console.error(err);
        setError(err.message || 'Failed to load document details.');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [id]);

  const handleDownloadCertificate = () => {
    window.open(`${ApiService.apiBaseUrl}/documents/${id}/certificate`, '_blank');
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 flex-1 flex justify-center items-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 border-4 border-blue-900 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-slate-400 text-sm">Fetching document ledger records...</span>
        </div>
      </div>
    );
  }

  if (error || !doc) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 flex-1 flex justify-center items-center">
        <div className="text-center bg-white p-8 rounded-xl border border-slate-200">
          <ShieldAlert className="h-12 w-12 text-rose-600 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-slate-900">Failed to Retrieve Record</h2>
          <p className="text-sm text-slate-400 mt-1">{error || 'Document ID does not match any anchored registration.'}</p>
          <a href="/dashboard" className="text-blue-950 font-semibold hover:underline block mt-4">&larr; Return to Dashboard</a>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex-1 flex flex-col gap-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Property Document</h1>
            <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold ${
              doc.status === DocumentStatus.FULLY_EXECUTED || doc.status === DocumentStatus.NOTARY_SIGNED
                ? 'bg-emerald-100 text-emerald-800'
                : doc.status === DocumentStatus.DISPUTED
                ? 'bg-rose-100 text-rose-800'
                : 'bg-amber-100 text-amber-800'
            }`}>
              {doc.status.replace('_', ' ')}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">ID: {doc.documentId}</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleDownloadCertificate}
            className="bg-blue-900 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-blue-950 transition-colors flex items-center gap-2 shadow-xs"
          >
            <Download className="h-4 w-4" />
            Verification Certificate
          </button>
        </div>
      </div>

      {/* Details Grid */}
      <div className="grid lg:grid-cols-3 gap-8">
        {/* Left Side: Metadata and Blockchain Details */}
        <div className="lg:col-span-2 flex flex-col gap-8">
          {/* Document Properties */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs flex flex-col gap-6">
            <h2 className="text-lg font-bold text-slate-950 flex items-center gap-2"><FileText className="h-5 w-5 text-blue-900" /> Document Ledger Data</h2>
            <div className="grid sm:grid-cols-2 gap-6 text-sm">
              <div>
                <span className="text-slate-450 block text-xs uppercase tracking-wider font-semibold">SHA-256 Fingerprint Checksum</span>
                <span className="font-mono text-slate-800 font-medium break-all mt-1 block">{doc.contentHash}</span>
              </div>
              <div>
                <span className="text-slate-450 block text-xs uppercase tracking-wider font-semibold">Registered Timestamp</span>
                <span className="text-slate-800 font-medium flex items-center gap-1.5 mt-1">
                  <Calendar className="h-4 w-4 text-slate-400" />
                  {new Date(doc.timestamp).toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Blockchain & Authority Signature */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs flex flex-col gap-6">
            <h2 className="text-lg font-bold text-slate-950 flex items-center gap-2"><Shield className="h-5 w-5 text-blue-900" /> Solana On-Chain Anchors</h2>
            <div className="flex flex-col gap-4 text-sm">
              <div className="bg-slate-50 p-4 rounded-lg flex justify-between items-start gap-4">
                <div>
                  <span className="text-slate-450 block text-xs uppercase tracking-wider font-semibold">Solana Devnet Tx Signature</span>
                  <span className="font-mono text-slate-800 break-all text-xs font-semibold block mt-1">{doc.onchainTxSignature || 'N/A'}</span>
                </div>
                {doc.onchainTxSignature && (
                  <a
                    href={`https://explorer.solana.com/tx/${doc.onchainTxSignature}?cluster=devnet`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-900 hover:text-blue-950 flex items-center gap-1 flex-shrink-0 text-xs font-semibold"
                  >
                    Solana Explorer
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>

              {doc.notarySummary && (
                <div className="border border-slate-100 p-4 rounded-lg flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><UserCheck className="h-5 w-5" /></div>
                    <div>
                      <span className="text-slate-450 block text-xs uppercase tracking-wider font-semibold">DSC Digitally Signed By</span>
                      <span className="text-slate-800 font-bold text-sm block mt-0.5">Authorized Notary (ID: {doc.notarySummary.notaryId})</span>
                    </div>
                  </div>
                  <span className="text-xs text-slate-400">{new Date(doc.notarySummary.signedAt).toLocaleDateString()}</span>
                </div>
              )}
            </div>
          </div>

          {/* Timeline */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs flex flex-col gap-6">
            <h2 className="text-lg font-bold text-slate-950">Audit Chain of Custody Timeline</h2>
            <CustodyTimeline timeline={timeline} />
          </div>
        </div>

        {/* Right Side: QR Code */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs flex flex-col items-center text-center gap-6">
          <h2 className="text-lg font-bold text-slate-950 flex items-center gap-2 self-start"><QrCode className="h-5 w-5 text-blue-900" /> Printable QR Stamp</h2>
          <p className="text-xs text-slate-400 max-w-xs self-start text-left">Affix this physical QR code badge onto stamp paper. Anyone scanning it can instantly review this digital audit ledger.</p>
          {qrCode ? (
            <img src={qrCode} alt="Verification QR Code" className="h-44 w-44 border border-slate-200 rounded-lg p-2 bg-white mt-2" />
          ) : (
            <div className="h-44 w-44 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-center text-xs text-slate-350">QR unavailable</div>
          )}
          <div className="text-xs text-slate-400 font-mono select-all bg-slate-50 p-2 rounded-lg break-all w-full text-left">
            Verification ID: {doc.documentId}
          </div>
        </div>
      </div>
    </div>
  );
}

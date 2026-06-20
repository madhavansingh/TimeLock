'use client';

import React, { useEffect, useState, use } from 'react';
import { useAuth } from '@/context/auth-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  Lock, ArrowLeft, ShieldCheck, ShieldAlert, Calendar, Clock, 
  FileText, CheckCircle2, User, HelpCircle, Activity, FileSignature, AlertTriangle, ExternalLink
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';

interface ChecklistItem {
  id: string;
  label: string;
  ticked: boolean;
}

export default function NotaryTransferWorkspace({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const { id } = resolvedParams;
  const { user } = useAuth();
  const router = useRouter();

  const [transfer, setTransfer] = useState<any | null>(null);
  const [ownershipHistory, setOwnershipHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // USB DSC PIN Modal States
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [dscPin, setDscPin] = useState('');
  const [signing, setSigning] = useState(false);

  // Interactive Checklist
  const [checklist, setChecklist] = useState<ChecklistItem[]>([
    { id: 'seller-id', label: 'Previous owner (seller) identity verified via national ID', ticked: false },
    { id: 'buyer-id', label: 'Proposed owner (buyer) identity verified via national ID', ticked: false },
    { id: 'stamp-duty', label: 'Stamp duty and transaction taxes verified as fully paid', ticked: false },
    { id: 'encumbrance', label: 'Encumbrance registry check clear (no active liens/disputes)', ticked: false },
    { id: 'evidence-match', label: 'Supporting sale agreement matches database property details', ticked: false }
  ]);

  const trustScore = checklist.filter((c) => c.ticked).length * 20;

  const fetchTransferDetails = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      // 1. Get transfer session details
      const transferRes = await apiClient.get(`/transfers/${id}`);
      if (!transferRes.data) {
        throw new Error('Transfer request not found.');
      }
      setTransfer(transferRes.data);

      // 2. Fetch ownership history for the document
      const docId = transferRes.data.documentId;
      const historyRes = await apiClient.get(`/transfers/document/${docId}/ownership`);
      if (historyRes.data) {
        setOwnershipHistory(historyRes.data);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load transfer workspace.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    if (user.role !== 'NOTARY') {
      router.push('/login');
      return;
    }
    fetchTransferDetails();
  }, [id, user]);

  const handleToggleCheck = (checkId: string) => {
    setChecklist(
      checklist.map((item) =>
        item.id === checkId ? { ...item, ticked: !item.ticked } : item
      )
    );
  };

  const handleApproveClick = () => {
    const untickedCount = checklist.filter(c => !c.ticked).length;
    if (untickedCount > 0) {
      if (!confirm(`Warning: ${untickedCount} verification checks are still unticked. Proceed to sign transfer?`)) {
        return;
      }
    }
    setDscPin('');
    setErrorMsg('');
    setSuccessMsg('');
    setIsPinModalOpen(true);
  };

  const handleDscSigningSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transfer) return;
    if (dscPin !== '1234') {
      setErrorMsg('Incorrect DSC USB Token PIN. Access Denied.');
      return;
    }

    setSigning(true);
    setErrorMsg('');
    try {
      const res = await apiClient.post('/transfers/approve', {
        transferId: id,
        role: 'NOTARY',
        signerAddress: '5h3K1111111111111111111111111111111111111111',
        signatureBytes: 'notary_transfer_signature_verification_proof'
      });

      if (!res.data) {
        throw new Error(res.error?.message || 'Failed to record notary signature.');
      }

      setSuccessMsg('Digital Signature (DSC) verified and transfer approval anchored on Solana!');
      setTimeout(() => {
        setIsPinModalOpen(false);
        router.push('/notary');
      }, 1500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to submit signature to Solana Devnet.');
    } finally {
      setSigning(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'FINALIZED':
        return <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Finalized</Badge>;
      case 'APPROVED':
        return <Badge className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-medium">Approved</Badge>;
      case 'PENDING':
        return <Badge className="bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">Awaiting Signatures</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <Activity className="h-8 w-8 text-indigo-500 animate-spin" />
        <span className="ml-3 text-slate-400 font-mono">Loading transfer case details...</span>
      </div>
    );
  }

  if (errorMsg && !transfer) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <Card className="border-slate-800 bg-slate-900 max-w-md w-full text-center p-6 space-y-4">
          <HelpCircle className="h-12 w-12 text-slate-600 mx-auto" />
          <h2 className="text-xl font-bold">Transfer Workspace Error</h2>
          <p className="text-slate-400 text-sm">{errorMsg}</p>
          <Link href="/notary" className="block">
            <Button className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-full">Return Dashboard</Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 antialiased font-sans flex flex-col justify-between">
      {/* Top Navbar */}
      <header className="border-b border-slate-800 bg-slate-900 px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <Link href="/notary" className="flex items-center gap-2 text-slate-400 hover:text-slate-100 transition-colors">
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm font-medium">Operations Center</span>
          </Link>
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-indigo-600 text-slate-100 shadow-sm">
              <Lock className="h-3.5 w-3.5" />
            </div>
            <span className="text-md font-bold tracking-tight">
              Time<span className="font-light text-indigo-400">Lock</span>
            </span>
          </div>
        </div>
      </header>

      {/* Main Workspace layout */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8 grid gap-6 lg:grid-cols-3">
        {/* Left Column: Transfer details and chain of title (2 cols wide) */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="flex flex-row items-center justify-between border-b border-slate-850 pb-4">
              <div>
                <CardTitle className="text-xl font-bold">Ownership Transfer Review Workstation</CardTitle>
                <CardDescription className="text-slate-400 text-xs mt-1">
                  Session ID: <code className="text-slate-300 font-mono">{transfer.transferId}</code>
                </CardDescription>
              </div>
              {getStatusBadge(transfer.status)}
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              {/* Transfer Details Panel */}
              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-1">
                  <span className="text-slate-500 text-xs block font-mono">PREVIOUS OWNER (SELLER) ID:</span>
                  <span className="font-mono text-slate-200 text-sm select-all">{transfer.previousOwnerHash}</span>
                </div>
                <div className="space-y-1">
                  <span className="text-slate-500 text-xs block font-mono">PROPOSED NEW OWNER (BUYER) ID:</span>
                  <span className="font-mono text-slate-200 text-sm select-all">{transfer.newOwnerHash}</span>
                </div>
                <div className="space-y-1">
                  <span className="text-slate-500 text-xs block font-mono">TRANSFER TYPE:</span>
                  <Badge variant="outline" className="border-indigo-500/20 bg-indigo-500/5 text-indigo-300 font-semibold px-2.5 py-0.5 mt-0.5">
                    {transfer.transferType || 'Sale'}
                  </Badge>
                </div>
                <div className="space-y-1">
                  <span className="text-slate-500 text-xs block font-mono">REGISTRY DOCUMENT REF ID:</span>
                  <span className="font-mono text-slate-200 text-sm select-all">{transfer.documentId}</span>
                </div>
              </div>

              {transfer.transferNotes && (
                <div className="bg-slate-950/60 border border-slate-855 p-4 rounded-lg space-y-1 text-sm">
                  <span className="text-slate-500 text-xs font-mono block">TRANSFER NOTES / DESCRIPTION:</span>
                  <p className="text-slate-300 leading-relaxed">{transfer.transferNotes}</p>
                </div>
              )}

              {/* Supporting evidence files */}
              <div className="border-t border-slate-850 pt-6 space-y-3">
                <h3 className="font-semibold text-slate-200 text-sm flex items-center gap-2">
                  <FileText className="h-4.5 w-4.5 text-indigo-400" />
                  Supporting Evidence Registry
                </h3>
                {(() => {
                  let docs = [];
                  try {
                    docs = typeof transfer.supportingDocs === 'string' 
                      ? JSON.parse(transfer.supportingDocs) 
                      : (transfer.supportingDocs || []);
                  } catch {
                    docs = [];
                  }
                  if (docs.length === 0) {
                    return <p className="text-xs text-slate-500 italic">No supporting documentation uploaded by citizen.</p>;
                  }
                  return (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {docs.map((d: any, idx: number) => (
                        <a 
                          key={idx}
                          href={`https://gateway.pinata.cloud/ipfs/${d.ipfsCid}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-3 p-3 rounded-lg border border-slate-800 bg-slate-950/40 hover:bg-slate-850 transition-colors"
                        >
                          <FileText className="h-5 w-5 text-slate-400" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-slate-300 truncate">{d.title}</p>
                            <p className="text-[10px] text-slate-500 font-mono truncate">{d.ipfsCid}</p>
                          </div>
                          <ExternalLink className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                        </a>
                      ))}
                    </div>
                  );
                })()}
              </div>

              {/* Chronological Ownership Timeline */}
              <div className="border-t border-slate-850 pt-6 space-y-3">
                <h3 className="font-semibold text-slate-200 text-sm flex items-center gap-2">
                  <Activity className="h-4.5 w-4.5 text-indigo-400" />
                  Current Ownership Chain & Timeline
                </h3>
                {ownershipHistory.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">No historical registry records found.</p>
                ) : (
                  <div className="relative pl-6 border-l border-slate-800 space-y-6 ml-3 py-1">
                    {ownershipHistory.map((record, index) => {
                      const isCurrent = record.status === 'ACTIVE';
                      return (
                        <div key={record.recordId} className="relative">
                          <div className={`absolute -left-[30px] top-1 flex h-4 w-4 items-center justify-center rounded-full border-2 border-slate-900 ${
                            isCurrent ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-slate-400'
                          }`}>
                            <div className="h-1.5 w-1.5 rounded-full bg-slate-950" />
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-slate-200 flex items-center gap-2">
                              Owner: {record.ownerUserId === transfer.previousOwnerHash ? 'Seller (Current)' : record.ownerUserId}
                              {isCurrent && (
                                <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] px-1.5 py-0.5">
                                  Active Owner
                                </Badge>
                              )}
                            </p>
                            <p className="text-[10px] text-slate-500 font-mono mt-0.5">Record ID: {record.recordId}</p>
                            <p className="text-[10px] text-slate-400 mt-1">
                              Reason: {record.transferReason || 'Initial Registration'} &bull; Start Date: {new Date(record.startDate).toLocaleDateString()}
                              {record.endDate && ` &bull; End Date: ${new Date(record.endDate).toLocaleDateString()}`}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: VPL Checklist & Actions */}
        <div className="lg:col-span-1 space-y-4">
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="border-b border-slate-850 pb-4">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <ShieldCheck className="h-4.5 w-4.5 text-indigo-400" />
                VPL Checklist & Trust Score
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4 text-sm pt-6">
              {/* Dynamic Score indicator */}
              <div className="flex items-center gap-4 p-4 rounded-xl border border-slate-800 bg-slate-950/40">
                <div className="flex flex-col items-center justify-center h-16 w-16 rounded-full border border-slate-800 bg-slate-900/60 shadow-inner">
                  <span className={`text-xl font-mono font-bold ${
                    trustScore >= 80 ? 'text-emerald-400' : trustScore >= 60 ? 'text-amber-400' : 'text-rose-400'
                  }`}>
                    {trustScore}
                  </span>
                  <span className="text-[8px] text-slate-500 font-semibold tracking-wider font-sans">SCORE</span>
                </div>
                <div className="space-y-0.5">
                  <span className="text-slate-400 text-xs block">VPL CALCULATED INDEX:</span>
                  <Badge className={
                    trustScore >= 80 
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold text-[9px]'
                      : 'bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold text-[9px]'
                  }>
                    {trustScore >= 80 ? 'EXCELLENT TRUST' : 'WARNING (INSUFFICIENT)'}
                  </Badge>
                </div>
              </div>

              {/* Verification Checklist */}
              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-semibold text-slate-400 uppercase font-mono tracking-wider">Review Tasks</h4>
                <div className="space-y-2">
                  {checklist.map((item) => (
                    <label 
                      key={item.id} 
                      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        item.ticked 
                          ? 'border-indigo-500/30 bg-indigo-500/5 text-slate-200' 
                          : 'border-slate-855 bg-slate-955/20 text-slate-400 hover:bg-slate-900'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={item.ticked}
                        onChange={() => handleToggleCheck(item.id)}
                        className="mt-0.5 rounded border-slate-700 text-indigo-600 focus:ring-indigo-600 bg-slate-900"
                      />
                      <span className="text-xs leading-normal font-medium">{item.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Actions panel */}
              <div className="space-y-2 pt-4 border-t border-slate-850">
                {transfer.status === 'PENDING' && (
                  <Button
                    onClick={handleApproveClick}
                    disabled={actionLoading}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-slate-100 rounded-lg shadow-md font-semibold text-xs py-2.5 flex items-center justify-center gap-1.5"
                  >
                    <FileSignature className="h-4 w-4" />
                    Apply Digital Signature (DSC)
                  </Button>
                )}
                {transfer.status !== 'PENDING' && (
                  <div className="rounded p-3 border border-slate-800 bg-slate-950/40 text-center text-xs text-slate-500 italic">
                    This transfer session is in {transfer.status} status. No review action required.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* USB DSC PIN modal */}
      <Dialog open={isPinModalOpen} onOpenChange={setIsPinModalOpen}>
        <DialogContent className="border-slate-800 bg-slate-900 text-slate-100 max-w-sm rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <FileSignature className="h-5 w-5 text-indigo-400" />
              Sign Ownership Transfer
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              Enter your Class-3 Digital Signature Certificate USB token PIN to authorize this deed transfer and anchor it on the Solana blockchain.
            </DialogDescription>
          </DialogHeader>

          {errorMsg && (
            <div className="rounded border border-rose-500/20 bg-rose-500/10 p-2.5 text-xs text-rose-400 flex items-center gap-2.5">
              <ShieldAlert className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="rounded border border-emerald-500/20 bg-emerald-500/10 p-2.5 text-xs text-emerald-400 flex items-center gap-2.5">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          <form onSubmit={handleDscSigningSubmit} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="usbPin" className="text-xs text-slate-300 font-mono">DSC USB TOKEN PIN</Label>
              <Input
                id="usbPin"
                type="password"
                maxLength={4}
                value={dscPin}
                onChange={(e) => setDscPin(e.target.value)}
                placeholder="Enter PIN (try 1234)"
                className="bg-slate-950 border-slate-800 text-slate-100 font-mono text-center tracking-widest text-sm focus-visible:ring-indigo-600"
              />
            </div>

            <DialogFooter className="grid grid-cols-2 gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsPinModalOpen(false)}
                className="border-slate-850 bg-transparent text-slate-400 hover:bg-slate-800 hover:text-slate-100 rounded-lg text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={signing}
                className="bg-indigo-600 hover:bg-indigo-500 text-slate-100 rounded-lg text-xs font-semibold"
              >
                {signing ? 'Signing on Solana...' : 'Verify & Sign'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

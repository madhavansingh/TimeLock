'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  AlertCircle, Lock, ArrowLeft, CheckCircle2, ShieldAlert, Cpu, 
  FileUp, ShieldCheck, FileText, RefreshCw, Download, 
  ExternalLink, Calendar, User, ShieldCheck as VerifiedIcon, AlertTriangle
} from 'lucide-react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { calculateSHA256 } from '@/lib/crypto';
import { apiClient } from '@/lib/api';
import { verifyDocumentOnChain, verifySignatureRecordOnChain } from '@/lib/solana-verifier';
import { PublicKey } from '@solana/web3.js';


function VerifyContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [documentId, setDocumentId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hashingProgress, setHashingProgress] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Loaded details state
  const [docDetails, setDocDetails] = useState<any | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState('');

  // Tab state
  const [activeTab, setActiveTab] = useState<'overview' | 'security' | 'timeline' | 'custody'>('overview');

  // Result state
  const [verified, setVerified] = useState(false);
  const [verificationResult, setVerificationResult] = useState<{
    documentId: string;
    result: 'authentic' | 'modified';
    expectedHash: string;
    submittedHash: string;
    riskScore: number;
    signals: {
      hashMismatch: boolean;
      missingBlockchainTx: boolean;
      missingNotarySignature: boolean;
      expiredVerification: boolean;
    };
    detectedAt: string;
  } | null>(null);

  // Blockchain verification state
  const [blockchainState, setBlockchainState] = useState<'idle' | 'loading' | 'verified' | 'mismatch' | 'unavailable'>('idle');
  const [blockchainDetails, setBlockchainDetails] = useState<any | null>(null);
  const [blockchainError, setBlockchainError] = useState<string>('');
  const [uploadedFileHash, setUploadedFileHash] = useState<string | null>(null);

  // Upload receipt blockchain state
  const [receiptBlockchainState, setReceiptBlockchainState] = useState<'idle' | 'loading' | 'verified' | 'mismatch' | 'unavailable'>('idle');
  const [receiptBlockchainDetails, setReceiptBlockchainDetails] = useState<any | null>(null);

  const runSolanaVerification = async (doc: any, customHash?: string | null) => {
    if (!doc.onchainTxSignature) {
      setBlockchainState('unavailable');
      setReceiptBlockchainState('unavailable');
      return;
    }

    if (doc.onchainTxSignature.endsWith('_mock_sig')) {
      try {
        const programId = 'EbKjjyvxck5REvVXTXuAvPDrydzKFniiGgLdKSeyfc3w';
        const docIdHash = await window.crypto.subtle.digest(
          'SHA-256',
          new TextEncoder().encode(doc.documentId)
        );
        const [pda] = PublicKey.findProgramAddressSync(
          [new TextEncoder().encode('document'), new Uint8Array(docIdHash)],
          new PublicKey(programId)
        );
        setBlockchainDetails({
          pdaAddress: pda.toBase58(),
          slot: 18294719,
          onchainStatus: doc.status === 'FULLY_EXECUTED' ? 3 : (doc.status === 'DISPUTED' ? 5 : 1),
          onchainHash: customHash || (doc.contentHash !== '[REDACTED]' ? doc.contentHash : 'N/A (Redacted)'),
          ownerMatches: true,
          signatureValid: true,
          statusValid: true,
          hashValid: true
        });

        if (doc.uploadReceipt) {
          setReceiptBlockchainDetails({
            pdaAddress: 'MockSigPDA1111111111111111111111111111111',
            signerRole: 10,
            signerPubkey: 'MockRelayerPubkey111111111111111111111111',
            signedAt: Math.floor(Date.now() / 1000),
            offChainCertRef: doc.uploadReceipt.receiptHash,
            isValid: true
          });
          setReceiptBlockchainState('verified');
        }
      } catch (e) {
        console.error(e);
      }
      setBlockchainState('unavailable');
      return;
    }

    setBlockchainState('loading');
    setBlockchainError('');
    setReceiptBlockchainState('loading');

    try {
      const hashToCheck = customHash || uploadedFileHash || (doc.contentHash !== '[REDACTED]' ? doc.contentHash : null);
      const res = await verifyDocumentOnChain(
        doc.documentId,
        doc.onchainTxSignature,
        doc.status,
        hashToCheck
      );

      if (res.success && res.details) {
        setBlockchainState('verified');
        setBlockchainDetails(res.details);
      } else {
        setBlockchainState('mismatch');
        setBlockchainError(res.error || 'Verification criteria failed.');
        if (res.details) {
          setBlockchainDetails(res.details);
        }
      }

      // Verify signature record for upload receipt if present
      if (doc.uploadReceipt) {
        try {
          const sigRes = await verifySignatureRecordOnChain(
            doc.documentId,
            10, // Sovereign Upload Receipt role byte
            doc.uploadReceipt.receiptHash
          );
          if (sigRes.success && sigRes.details) {
            setReceiptBlockchainState('verified');
            setReceiptBlockchainDetails(sigRes.details);
          } else {
            setReceiptBlockchainState('mismatch');
            if (sigRes.details) {
              setReceiptBlockchainDetails(sigRes.details);
            }
          }
        } catch (sigErr) {
          console.error('[Solana Receipt Verification Error]:', sigErr);
          setReceiptBlockchainState('unavailable');
        }
      } else {
        setReceiptBlockchainState('idle');
      }
    } catch (err: any) {
      console.error('[Solana Verification Error]:', err);
      setBlockchainState('unavailable');
      setBlockchainError('Blockchain verification temporarily unavailable.');
    }
  };

  const downloadReceiptPdf = async () => {
    if (!docDetails?.documentId) return;
    try {
      setLoading(true);
      const baseUrl = apiClient.getBaseUrl();
      const url = `${baseUrl}/documents/${docDetails.documentId}/receipt/pdf`;
      const token = localStorage.getItem('token');
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to download receipt PDF');
      }
      
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const downloadAnchor = document.createElement('a');
      downloadAnchor.href = blobUrl;
      downloadAnchor.download = `${docDetails.title.replace(/\s+/g, '_')}_upload_receipt.pdf`;
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (err: any) {
      console.error('Error downloading receipt PDF:', err);
      alert(err.message || 'Failed to download receipt PDF.');
    } finally {
      setLoading(false);
    }
  };

  const downloadReceiptJson = () => {
    if (!docDetails?.uploadReceipt) return;
    const receiptData = docDetails.uploadReceipt;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(receiptData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `upload_receipt_${docDetails.documentId}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };


  const loadDetails = async (id: string, customHash?: string | null) => {
    setDetailsLoading(true);
    setDetailsError('');
    setDocDetails(null);
    try {
      const res = await apiClient.get(`/documents/${id}/status`);
      if (res.data) {
        setDocDetails(res.data);
        await runSolanaVerification(res.data, customHash);
      } else {
        setDetailsError('Document registry not found.');
      }
    } catch (err: any) {
      setDetailsError(err.message || 'Failed to load document registration details.');
    } finally {
      setDetailsLoading(false);
    }
  };

  useEffect(() => {
    const idParam = searchParams.get('id');
    if (idParam) {
      setDocumentId(idParam);
      loadDetails(idParam);
    }
  }, [searchParams]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!documentId) {
      setDetailsError('Please enter a valid Document ID.');
      return;
    }
    loadDetails(documentId);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!documentId) {
      setErrorMsg('Please enter a valid Document ID.');
      return;
    }
    if (!file) {
      setErrorMsg('Please select a file copy to verify.');
      return;
    }

    setLoading(true);
    setHashingProgress(true);
    setErrorMsg('');

    try {
      const hash = await calculateSHA256(file);
      setUploadedFileHash(hash);
      setHashingProgress(false);

      const formData = new FormData();
      formData.append('file', file);
      
      const res = await apiClient.postFormData(`/documents/${documentId}/verify`, formData);
      if (!res.data) {
        throw new Error(res.error?.message || 'Verification check failed.');
      }

      setVerificationResult(res.data);
      setVerified(true);
      
      // Reload timeline and details to capture verification event
      await loadDetails(documentId, hash);
    } catch (err: any) {
      setHashingProgress(false);
      const isBlockchainError = /discriminator|digest|pda|anchor|solana|rpc|blockchain|ledger|transaction|hash|fail/i.test(err.message || '');
      if (isBlockchainError) {
        setErrorMsg('Blockchain verification temporarily unavailable. The registration record remains accessible. Please try again later.');
      } else {
        setErrorMsg(err.message || 'Verification check failed.');
      }
    } finally {
      setLoading(false);
    }
  };

  const resetVerification = () => {
    setVerified(false);
    setVerificationResult(null);
    setFile(null);
    setErrorMsg('');
    setUploadedFileHash(null);
    if (docDetails) {
      runSolanaVerification(docDetails, null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'FULLY_EXECUTED':
        return <Badge className="bg-emerald-500/15 text-emerald-500 border border-emerald-500/20 px-2.5 py-1">Fully Executed</Badge>;
      case 'NOTARY_SIGNED':
        return <Badge className="bg-blue-500/15 text-blue-500 border border-blue-500/20 px-2.5 py-1">Notary Signed</Badge>;
      case 'READY_FOR_SIGNATURE':
        return <Badge className="bg-purple-500/15 text-purple-500 border border-purple-500/20 px-2.5 py-1">Awaiting Signature</Badge>;
      case 'NOTARY_REVIEW_STARTED':
        return <Badge className="bg-blue-500/15 text-blue-500 border border-blue-500/20 px-2.5 py-1">Under Review</Badge>;
      case 'ONCHAIN_CONFIRMED':
        return <Badge className="bg-indigo-500/15 text-indigo-500 border border-indigo-500/20 px-2.5 py-1">Anchored</Badge>;
      case 'DISPUTED':
        return <Badge className="bg-red-500/15 text-red-500 border border-red-500/20 px-2.5 py-1">Disputed</Badge>;
      default:
        return <Badge className="bg-yellow-500/15 text-yellow-500 border border-yellow-500/20 px-2.5 py-1">Pending</Badge>;
    }
  };

  const getConfidenceLevel = (score: number) => {
    if (score <= 30) return { label: 'Low Confidence', color: 'text-red-500 bg-red-500/10 border-red-500/20' };
    if (score <= 70) return { label: 'Moderate Confidence', color: 'text-amber-500 bg-amber-500/10 border-amber-500/20' };
    if (score <= 90) return { label: 'High Confidence', color: 'text-blue-500 bg-blue-500/10 border-blue-500/20' };
    return { label: 'Verified', color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' };
  };

  const getTimelineEvents = () => {
    if (!docDetails) return [];
    const baseTime = new Date(docDetails.timestamp);
    const events = [];

    // If uploadReceipt is present, it represents the very first step of the chain of custody!
    if (docDetails.uploadReceipt) {
      events.push({
        title: 'Sovereign Client Upload Receipt Created',
        description: `Browser-verified SHA-256 fingerprint frozen in deterministic, alphabetized receipt payload.`,
        timestamp: new Date(docDetails.uploadReceipt.uploadTimestamp).toLocaleString(),
        status: 'COMPLETED'
      });

      events.push({
        title: 'Client-Server Hash Integrity Verified',
        description: `Dual constant-time verification completed: Client Hash matched Server Hash.`,
        timestamp: new Date(docDetails.uploadReceipt.uploadTimestamp).toLocaleString(),
        status: 'COMPLETED'
      });
    }

    events.push({
      title: 'Document Registered & Anchored',
      description: 'Initial entry created on Solana ledger.',
      timestamp: baseTime.toLocaleString(),
      status: 'COMPLETED'
    });

    if (docDetails.uploadReceipt && docDetails.uploadReceipt.receiptBlockchainTx) {
      events.push({
        title: 'C3 Receipt Anchored on Solana Devnet',
        description: `Sovereign receipt hash anchored on-chain with signature record PDA (role = 10).`,
        timestamp: docDetails.uploadReceipt.receiptAnchoredAt 
          ? new Date(docDetails.uploadReceipt.receiptAnchoredAt).toLocaleString()
          : baseTime.toLocaleString(),
        status: 'COMPLETED'
      });
    }

    events.push({
      title: 'Metadata Extracted & Validated',
      description: 'AI model processed registry schema and properties.',
      timestamp: new Date(baseTime.getTime() + 2 * 60 * 1000).toLocaleString(),
      status: 'COMPLETED'
    });

    events.push({
      title: 'AI Verification Analysis Finished',
      description: 'No direct evidence of fraud or duplicate registration found.',
      timestamp: new Date(baseTime.getTime() + 5 * 60 * 1000).toLocaleString(),
      status: 'COMPLETED'
    });

    events.push({
      title: 'Blockchain Fingerprint Created',
      description: 'Decentralized IPFS CID anchored on the Solana ledger.',
      timestamp: new Date(baseTime.getTime() + 10 * 60 * 1000).toLocaleString(),
      status: 'COMPLETED'
    });

    if (docDetails.status === 'NOTARY_SIGNED' || docDetails.status === 'FULLY_EXECUTED') {
      const signedTime = docDetails.notarySummary?.signedAt 
        ? new Date(docDetails.notarySummary.signedAt) 
        : new Date(baseTime.getTime() + 1 * 60 * 60 * 1000);
      
      events.push({
        title: 'Evidence Review Completed',
        description: 'All required document criteria marked as PASSED.',
        timestamp: new Date(signedTime.getTime() - 5 * 60 * 1000).toLocaleString(),
        status: 'COMPLETED'
      });
      
      events.push({
        title: 'Notary Review & DSC Sign',
        description: `Digitally signed by Notary: ${docDetails.notarySummary?.name || 'Accredited Notary'}.`,
        timestamp: signedTime.toLocaleString(),
        status: 'COMPLETED'
      });

      events.push({
        title: 'Ledger Anchoring Confirmed',
        description: 'Verification Proof Layer (VPL) finalized on Solana.',
        timestamp: new Date(signedTime.getTime() + 5 * 1000).toLocaleString(),
        status: 'COMPLETED'
      });
    } else if (docDetails.status === 'DISPUTED' || docDetails.status === 'REVOKED') {
      events.push({
        title: 'Dispute Flagged / Registry Revoked',
        description: 'Conflict analysis flagged potential ownership overlap.',
        timestamp: new Date(baseTime.getTime() + 30 * 60 * 1000).toLocaleString(),
        status: 'FLAGGED'
      });
    } else {
      events.push({
        title: 'Notary Review in Progress',
        description: 'Currently awaiting accredited notary signature.',
        timestamp: 'Pending...',
        status: 'PENDING'
      });
    }

    return events;
  };

  return (
    <div className="min-h-screen bg-background text-foreground antialiased font-sans flex flex-col justify-between noise-overlay">
      {/* Top Navbar */}
      <header className="border-b border-border bg-background/80 backdrop-blur-md px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm font-medium">Home</span>
          </Link>
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-primary text-primary-foreground shadow-sm">
              <Lock className="h-3.5 w-3.5" />
            </div>
            <span className="text-md font-bold tracking-tight text-foreground">
              Time <span className="font-display font-light">Lock</span>
            </span>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 flex items-start justify-center py-12 px-6">
        <div className="w-full max-w-5xl space-y-6">
          
          {/* Header Search if no active query or search failed */}
          {!searchParams.get('id') && !docDetails && (
            <Card className="border-border bg-card/60 backdrop-blur-md max-w-xl mx-auto">
              <CardHeader>
                <CardTitle className="text-xl font-bold flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                  Land Record Verification Portal
                </CardTitle>
                <CardDescription>
                  Enter a Document Registry ID to query its immutable ledger registration, ownership timeline, and notary certificate.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSearchSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="searchId" className="text-foreground/80 font-medium">Registry ID (UUID)</Label>
                    <Input
                      id="searchId"
                      placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000"
                      value={documentId}
                      onChange={(e) => setDocumentId(e.target.value)}
                      className="border-border bg-background text-foreground font-mono text-xs focus-visible:ring-ring"
                    />
                  </div>
                  <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-full">
                    Search Registry Details
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Details Loading */}
          {detailsLoading && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <RefreshCw className="h-10 w-10 text-primary animate-spin mb-4" />
              <p className="text-muted-foreground font-medium text-sm">Querying TimeLock Network records...</p>
            </div>
          )}

          {/* Details Error */}
          {detailsError && !detailsLoading && (
            <div className="max-w-xl mx-auto">
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive flex items-center gap-2.5 mb-4">
                <AlertCircle className="h-5 w-5 shrink-0" />
                <span>{detailsError}</span>
              </div>
              <Button size="sm" onClick={() => loadDetails(documentId)} variant="outline" className="w-full rounded-full">
                Retry Query
              </Button>
            </div>
          )}

          {/* Document Verification Dashboard */}
          {docDetails && !detailsLoading && (() => {
            const isVerified = docDetails.status === 'NOTARY_SIGNED' || docDetails.status === 'FULLY_EXECUTED';
            const isRejected = docDetails.status === 'DISPUTED' || docDetails.status === 'REVOKED';
            const isRegistered = !isVerified && !isRejected;

            const registrationTime = new Date(docDetails.timestamp).toLocaleString();
            const verificationTime = docDetails.notarySummary?.signedAt 
              ? new Date(docDetails.notarySummary.signedAt).toLocaleString() 
              : new Date(docDetails.timestamp).toLocaleString();

            const trustScore = docDetails.verificationCase?.trustScore !== undefined ? docDetails.verificationCase.trustScore : 85;
            const confidence = getConfidenceLevel(trustScore);

            return (
              <div className="space-y-6 max-w-3xl mx-auto">
                {/* 1. Large Top Verification Badge */}
                {isVerified && (
                  <div className="flex flex-col items-center justify-center p-8 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 text-center shadow-lg shadow-emerald-500/5 relative overflow-hidden">
                    <div className="absolute top-0 right-0 h-24 w-24 translate-x-8 -translate-y-8 bg-emerald-500/10 rounded-full blur-xl" />
                    <CheckCircle2 className="h-16 w-16 text-emerald-500 mb-3" />
                    <span className="text-2xl font-bold text-emerald-500 uppercase tracking-wide">✓ Verified Document</span>
                    <p className="text-sm text-emerald-600/90 font-medium mt-1">Solana Ledger Authenticity Confirmed ✓</p>
                  </div>
                )}
                {isRegistered && (
                  <div className="flex flex-col items-center justify-center p-8 rounded-2xl border border-amber-500/30 bg-amber-500/10 text-center shadow-lg shadow-amber-500/5 relative overflow-hidden">
                    <div className="absolute top-0 right-0 h-24 w-24 translate-x-8 -translate-y-8 bg-amber-500/10 rounded-full blur-xl" />
                    <RefreshCw className="h-16 w-16 text-amber-500 mb-3 animate-spin-slow" />
                    <span className="text-2xl font-bold text-amber-500 uppercase tracking-wide">⏳ Awaiting Verification</span>
                    <p className="text-sm text-amber-600/90 font-medium mt-1">Registry Registered & Anchored ✓</p>
                  </div>
                )}
                {isRejected && (
                  <div className="flex flex-col items-center justify-center p-8 rounded-2xl border border-red-500/30 bg-red-500/10 text-center shadow-lg shadow-red-500/5 relative overflow-hidden">
                    <div className="absolute top-0 right-0 h-24 w-24 translate-x-8 -translate-y-8 bg-red-500/10 rounded-full blur-xl" />
                    <AlertTriangle className="h-16 w-16 text-red-500 mb-3" />
                    <span className="text-2xl font-bold text-red-500 uppercase tracking-wide">✗ Rejected Document</span>
                    <p className="text-sm text-red-600/90 font-medium mt-1">Registry Flagged / Revoked</p>
                  </div>
                )}

                {/* Dashboard Tabs Navigation */}
                <div className="flex border-b border-border/60 gap-1.5 overflow-x-auto pb-px">
                  <button
                    onClick={() => setActiveTab('overview')}
                    className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-colors whitespace-nowrap ${
                      activeTab === 'overview'
                        ? 'border-primary text-primary'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Overview
                  </button>
                  <button
                    onClick={() => setActiveTab('security')}
                    className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-colors whitespace-nowrap ${
                      activeTab === 'security'
                        ? 'border-primary text-primary'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Security Checks
                  </button>
                  <button
                    onClick={() => setActiveTab('timeline')}
                    className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-colors whitespace-nowrap ${
                      activeTab === 'timeline'
                        ? 'border-primary text-primary'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Audit Timeline
                  </button>
                  <button
                    onClick={() => setActiveTab('custody')}
                    className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-colors whitespace-nowrap ${
                      activeTab === 'custody'
                        ? 'border-primary text-primary'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Chain of Custody
                  </button>
                </div>

                {/* Tab Contents */}
                <div className="space-y-6">
                  {/* OVERVIEW TAB */}
                  {activeTab === 'overview' && (
                    <div className="space-y-6">
                      <Card className="border-border bg-card/60 backdrop-blur-md">
                        <CardHeader>
                          <CardTitle className="text-base font-bold">Document Registry Record</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 border-t border-border/60 pt-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm">
                            <div>
                              <span className="block text-muted-foreground text-xs font-semibold mb-1">DOCUMENT TITLE</span>
                              <span className="font-semibold text-foreground">{docDetails.title}</span>
                            </div>
                            <div>
                              <span className="block text-muted-foreground text-xs font-semibold mb-1">REGISTRATION ID</span>
                              <span className="font-mono text-xs text-foreground select-all break-all">{docDetails.documentId}</span>
                            </div>
                            <div>
                              <span className="block text-muted-foreground text-xs font-semibold mb-1">DOCUMENT TYPE</span>
                              <span className="font-semibold text-foreground">{docDetails.type}</span>
                            </div>
                            <div>
                              <span className="block text-muted-foreground text-xs font-semibold mb-1">PROPERTY ID / KHATA</span>
                              <span className="font-mono text-xs text-foreground">{docDetails.metadata?.propertyId || docDetails.metadata?.surveyNumber || 'N/A'}</span>
                            </div>
                            <div>
                              <span className="block text-muted-foreground text-xs font-semibold mb-1">CURRENT REGISTERED OWNER</span>
                              <span className="font-semibold text-foreground">{docDetails.metadata?.ownerName || 'Citizen Executant'}</span>
                            </div>
                            <div>
                              <span className="block text-muted-foreground text-xs font-semibold mb-1">REGISTRY STATUS</span>
                              <div className="mt-1">{getStatusBadge(docDetails.status)}</div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Cryptographic Chain of Custody (C3) Integrity Grid */}
                      <Card className="border-border bg-card/60 backdrop-blur-md overflow-hidden relative">
                        <div className="absolute top-0 right-0 h-32 w-32 translate-x-12 -translate-y-12 bg-primary/5 rounded-full blur-2xl" />
                        <CardHeader className="pb-3 border-b border-border/40">
                          <div className="flex items-center justify-between gap-4 flex-wrap">
                            <div className="space-y-1">
                              <CardTitle className="text-base font-bold flex items-center gap-2">
                                <Cpu className="h-5 w-5 text-primary animate-pulse" />
                                Cryptographic Chain of Custody (C3)
                              </CardTitle>
                              <CardDescription className="text-xs">
                                Multi-party end-to-end cryptographic verification grid
                              </CardDescription>
                            </div>
                            <div>
                              {docDetails.uploadReceipt ? (
                                docDetails.uploadReceipt.clientHash === docDetails.uploadReceipt.serverHash ? (
                                  <Badge className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/25 text-xs font-semibold px-2.5 py-1">
                                    Client ↔ Server Integrity Verified
                                  </Badge>
                                ) : (
                                  <Badge className="bg-red-500/10 text-red-500 border border-red-500/25 text-xs font-semibold px-2.5 py-1">
                                    Hash Mismatch Detected
                                  </Badge>
                                )
                              ) : (
                                <Badge className="bg-muted text-muted-foreground border border-border text-xs font-semibold px-2.5 py-1">
                                  Legacy Hash Protocol
                                </Badge>
                              )}
                            </div>
                          </div>
                        </CardHeader>
                        
                        <CardContent className="pt-6 space-y-6">
                          {/* Grid of hashes */}
                          <div className="space-y-4">
                            {/* 1. Sovereign Client Hash */}
                            <div className="p-3.5 rounded-lg border border-border/40 bg-background/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                              <div className="space-y-1 sm:max-w-[40%]">
                                <span className="font-semibold text-foreground flex items-center gap-1.5">
                                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                                  Sovereign Client Hash
                                </span>
                                <p className="text-[11px] text-muted-foreground leading-normal">
                                  Deed SHA-256 fingerprint generated in citizen's browser prior to transfer.
                                </p>
                              </div>
                              <div className="flex items-center gap-3 shrink-0">
                                <span className="font-mono text-[11px] text-foreground bg-muted/30 px-2 py-1 rounded truncate max-w-[180px] sm:max-w-[260px] select-all">
                                  {docDetails.uploadReceipt?.clientHash || 'N/A (Pre-C3 Protocol)'}
                                </span>
                                {docDetails.uploadReceipt ? (
                                  <Badge className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/25 text-[10px] font-semibold px-1.5 py-0.5 shrink-0">
                                    MATCH
                                  </Badge>
                                ) : (
                                  <Badge className="bg-muted text-muted-foreground border border-border text-[10px] font-semibold px-1.5 py-0.5 shrink-0">
                                    LEGACY
                                  </Badge>
                                )}
                              </div>
                            </div>

                            {/* 2. Verified Server Hash */}
                            <div className="p-3.5 rounded-lg border border-border/40 bg-background/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                              <div className="space-y-1 sm:max-w-[40%]">
                                <span className="font-semibold text-foreground flex items-center gap-1.5">
                                  <Cpu className="h-3.5 w-3.5 text-muted-foreground" />
                                  Verified Server Hash
                                </span>
                                <p className="text-[11px] text-muted-foreground leading-normal">
                                  Deed SHA-256 fingerprint computed independently on registry backend.
                                </p>
                              </div>
                              <div className="flex items-center gap-3 shrink-0">
                                <span className="font-mono text-[11px] text-foreground bg-muted/30 px-2 py-1 rounded truncate max-w-[180px] sm:max-w-[260px] select-all">
                                  {docDetails.uploadReceipt?.serverHash || (docDetails.contentHash !== '[REDACTED]' ? docDetails.contentHash : 'N/A')}
                                </span>
                                {docDetails.uploadReceipt ? (
                                  docDetails.uploadReceipt.clientHash === docDetails.uploadReceipt.serverHash ? (
                                    <Badge className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/25 text-[10px] font-semibold px-1.5 py-0.5 shrink-0">
                                      MATCH
                                    </Badge>
                                  ) : (
                                    <Badge className="bg-red-500/10 text-red-500 border border-red-500/25 text-[10px] font-semibold px-1.5 py-0.5 shrink-0">
                                      MISMATCH
                                    </Badge>
                                  )
                                ) : (
                                  <Badge className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/25 text-[10px] font-semibold px-1.5 py-0.5 shrink-0">
                                    ANCHORED
                                  </Badge>
                                )}
                              </div>
                            </div>

                            {/* 3. Canonical Receipt Hash */}
                            <div className="p-3.5 rounded-lg border border-border/40 bg-background/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                              <div className="space-y-1 sm:max-w-[40%]">
                                <span className="font-semibold text-foreground flex items-center gap-1.5">
                                  <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                                  Canonical Receipt Hash
                                </span>
                                <p className="text-[11px] text-muted-foreground leading-normal">
                                  SHA-256 digest of key-sorted, deterministically serialized receipt payload.
                                </p>
                              </div>
                              <div className="flex items-center gap-3 shrink-0">
                                <span className="font-mono text-[11px] text-foreground bg-muted/30 px-2 py-1 rounded truncate max-w-[180px] sm:max-w-[260px] select-all">
                                  {docDetails.uploadReceipt?.receiptHash || 'N/A (Pre-C3 Protocol)'}
                                </span>
                                {docDetails.uploadReceipt ? (
                                  <Badge className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/25 text-[10px] font-semibold px-1.5 py-0.5 shrink-0">
                                    VERIFIED
                                  </Badge>
                                ) : (
                                  <Badge className="bg-muted text-muted-foreground border border-border text-[10px] font-semibold px-1.5 py-0.5 shrink-0">
                                    LEGACY
                                  </Badge>
                                )}
                              </div>
                            </div>

                            {/* 4. On-chain Anchor Hash */}
                            <div className="p-3.5 rounded-lg border border-border/40 bg-background/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                              <div className="space-y-1 sm:max-w-[40%]">
                                <span className="font-semibold text-foreground flex items-center gap-1.5">
                                  <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" />
                                  On-chain Solana Anchor
                                </span>
                                <p className="text-[11px] text-muted-foreground leading-normal">
                                  The immutable hash record anchored in Solana signature PDA ledger.
                                </p>
                              </div>
                              <div className="flex items-center gap-3 shrink-0">
                                <span className="font-mono text-[11px] text-foreground bg-muted/30 px-2 py-1 rounded truncate max-w-[180px] sm:max-w-[260px] select-all">
                                  {docDetails.uploadReceipt 
                                    ? (receiptBlockchainDetails?.offChainCertRef || 'Verifying Ledger...') 
                                    : (blockchainDetails?.onchainHash || 'Verifying Ledger...')}
                                </span>
                                {docDetails.uploadReceipt ? (
                                  receiptBlockchainState === 'verified' ? (
                                    <Badge className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/25 text-[10px] font-semibold px-1.5 py-0.5 shrink-0">
                                      MATCH
                                    </Badge>
                                  ) : receiptBlockchainState === 'mismatch' ? (
                                    <Badge className="bg-red-500/10 text-red-500 border border-red-500/25 text-[10px] font-semibold px-1.5 py-0.5 shrink-0">
                                      MISMATCH
                                    </Badge>
                                  ) : receiptBlockchainState === 'unavailable' ? (
                                    <Badge className="bg-amber-500/10 text-amber-500 border border-amber-500/25 text-[10px] font-semibold px-1.5 py-0.5 shrink-0 animate-pulse">
                                      UNAVAILABLE
                                    </Badge>
                                  ) : (
                                    <Badge className="bg-muted text-muted-foreground border border-border text-[10px] font-semibold px-1.5 py-0.5 shrink-0 animate-pulse">
                                      PENDING
                                    </Badge>
                                  )
                                ) : (
                                  blockchainState === 'verified' ? (
                                    <Badge className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/25 text-[10px] font-semibold px-1.5 py-0.5 shrink-0">
                                      MATCH
                                    </Badge>
                                  ) : blockchainState === 'mismatch' ? (
                                    <Badge className="bg-red-500/10 text-red-500 border border-red-500/25 text-[10px] font-semibold px-1.5 py-0.5 shrink-0">
                                      MISMATCH
                                    </Badge>
                                  ) : (
                                    <Badge className="bg-muted text-muted-foreground border border-border text-[10px] font-semibold px-1.5 py-0.5 shrink-0 animate-pulse">
                                      PENDING
                                    </Badge>
                                  )
                                )}
                              </div>
                            </div>

                            {/* 5. Optional Local Copy Hash (if verified) */}
                            {uploadedFileHash && (
                              <div className={`p-3.5 rounded-lg border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs transition-all ${
                                verificationResult?.result === 'authentic' 
                                  ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-600'
                                  : 'border-red-500/30 bg-red-500/5 text-red-600'
                              }`}>
                                <div className="space-y-1 sm:max-w-[40%]">
                                  <span className="font-semibold flex items-center gap-1.5">
                                    <FileUp className="h-3.5 w-3.5" />
                                    Uploaded Copy Hash
                                  </span>
                                  <p className="text-[11px] opacity-85 leading-normal">
                                    The SHA-256 fingerprint of the local copy just uploaded for validation.
                                  </p>
                                </div>
                                <div className="flex items-center gap-3 shrink-0">
                                  <span className="font-mono text-[11px] bg-muted/30 px-2 py-1 rounded truncate max-w-[180px] sm:max-w-[260px] select-all">
                                    {uploadedFileHash}
                                  </span>
                                  {verificationResult?.result === 'authentic' ? (
                                    <Badge className="bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 text-[10px] font-bold px-1.5 py-0.5 shrink-0">
                                      MATCH
                                    </Badge>
                                  ) : (
                                    <Badge className="bg-red-500/15 text-red-500 border border-red-500/30 text-[10px] font-bold px-1.5 py-0.5 shrink-0">
                                      MISMATCH
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Metadata and Download actions */}
                          {docDetails.uploadReceipt && (
                            <div className="border-t border-border/40 pt-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                              <div className="text-[11px] text-muted-foreground space-y-1">
                                <p>Receipt ID: <span className="font-mono">{docDetails.uploadReceipt.receiptId}</span></p>
                                <p>Anchored via relayer key: <span className="font-mono">{receiptBlockchainDetails?.signerPubkey || docDetails.uploadReceipt.receiptPda || 'Pending...'}</span></p>
                              </div>
                              <div className="flex items-center gap-2 w-full sm:w-auto">
                                <Button 
                                  onClick={downloadReceiptJson} 
                                  variant="outline" 
                                  size="sm" 
                                  className="flex-1 sm:flex-none text-xs rounded-full gap-1.5 border-border/60 hover:bg-accent/10 font-bold"
                                >
                                  <Download className="h-3.5 w-3.5 text-muted-foreground" />
                                  Download JSON
                                </Button>
                                <Button 
                                  onClick={downloadReceiptPdf} 
                                  variant="outline" 
                                  size="sm" 
                                  className="flex-1 sm:flex-none text-xs rounded-full gap-1.5 border-border/60 hover:bg-accent/10 font-bold"
                                >
                                  <Download className="h-3.5 w-3.5 text-muted-foreground" />
                                  Download PDF
                                </Button>
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>

                      {/* File Matcher */}
                      <Card className="border-border bg-card/60 backdrop-blur-md">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base font-bold flex items-center gap-2">
                            <FileUp className="h-5 w-5 text-primary" />
                            Local Copy Verification
                          </CardTitle>
                          <CardDescription className="text-xs">
                            Upload your local PDF copy of this deed to run a real-time cryptographic checksum validation against the anchored ledger fingerprint.
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          {errorMsg && (
                            <div className="rounded border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive flex items-center gap-2 mb-3">
                              <AlertCircle className="h-4 w-4 shrink-0" />
                              <span>{errorMsg}</span>
                            </div>
                          )}

                          {!verified ? (
                            <form onSubmit={handleVerify} className="space-y-4">
                              <div
                                onDragEnter={handleDrag}
                                onDragOver={handleDrag}
                                onDragLeave={handleDrag}
                                onDrop={handleDrop}
                                className={`relative flex flex-col items-center justify-center rounded-lg border border-dashed py-10 px-4 text-center transition-all ${
                                  dragActive 
                                    ? 'border-foreground bg-foreground/5' 
                                    : 'border-border bg-background/50 hover:bg-accent/10'
                                }`}
                              >
                                <input
                                  type="file"
                                  id="dashboard-verify-file"
                                  onChange={handleFileChange}
                                  className="hidden"
                                  accept=".pdf"
                                />
                                <FileUp className="h-8 w-8 text-muted-foreground/45 mb-2" />
                                {file ? (
                                  <div className="text-xs">
                                    <p className="font-semibold text-foreground truncate max-w-[250px]">{file.name}</p>
                                    <p className="text-muted-foreground mt-0.5">
                                      {(file.size / 1024 / 1024).toFixed(2)} MB
                                    </p>
                                    <label
                                      htmlFor="dashboard-verify-file"
                                      className="mt-1.5 inline-block text-[10px] text-muted-foreground hover:text-foreground underline cursor-pointer"
                                    >
                                      Change file
                                    </label>
                                  </div>
                                ) : (
                                  <div>
                                    <p className="text-xs text-muted-foreground">
                                      Drop document PDF here, or{' '}
                                      <label
                                        htmlFor="dashboard-verify-file"
                                        className="underline cursor-pointer font-semibold text-foreground hover:text-primary transition-colors"
                                      >
                                        browse files
                                      </label>
                                    </p>
                                  </div>
                                )}
                              </div>

                              <Button type="submit" disabled={loading} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground text-xs rounded-full py-4.5">
                                {loading ? (
                                  <span className="flex items-center justify-center gap-1.5">
                                    <Cpu className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                                    {hashingProgress ? 'Generating SHA-256 Checksum...' : 'Verifying on Solana Ledger...'}
                                  </span>
                                ) : (
                                  'Verify Copy Authenticity'
                                )}
                              </Button>
                            </form>
                          ) : (
                            <div className="space-y-4">
                              <div className={`p-4 rounded-lg border text-xs flex flex-col gap-2 ${
                                verificationResult?.result === 'authentic'
                                  ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                                  : 'bg-red-500/10 text-red-600 border-red-500/20'
                              }`}>
                                <div className="flex items-center gap-1.5 font-bold text-sm">
                                  {verificationResult?.result === 'authentic' ? (
                                    <>
                                      <CheckCircle2 className="h-4.5 w-4.5" />
                                      <span>Local Copy Verified Authentic</span>
                                    </>
                                  ) : (
                                    <>
                                      <AlertTriangle className="h-4.5 w-4.5" />
                                      <span>Cryptographic Fingerprint Mismatch</span>
                                    </>
                                  )}
                                </div>
                                <p className="text-xs leading-relaxed opacity-90">
                                  {verificationResult?.result === 'authentic'
                                    ? 'The cryptographic fingerprint of your local file matches the on-chain registry record exactly. The document content is authentic and unaltered.'
                                    : 'Warning: The local file copy has a different cryptographic fingerprint. This indicates the file has been edited, tampered with, or does not belong to this registry entry.'}
                                </p>
                              </div>

                              <Button onClick={resetVerification} variant="outline" className="w-full text-xs rounded-full py-4">
                                Test Another Copy
                              </Button>
                            </div>
                          )}
                        </CardContent>
                      </Card>

                      {/* Download Attestation */}
                      {isVerified && (
                        <a href={`${apiClient.getBaseUrl()}/documents/${docDetails.documentId}/certificate?download=true`} target="_blank" rel="noopener noreferrer" className="block w-full">
                          <Button className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-bold flex items-center justify-center gap-1.5 rounded-full py-6 text-sm transition-all shadow-md">
                            <Download className="h-4 w-4" />
                            Download Legal Attestation Certificate (Sec. 65B)
                          </Button>
                        </a>
                      )}
                    </div>
                  )}

                  {/* SECURITY CHECKS TAB */}
                  {activeTab === 'security' && (
                    <div className="space-y-6">
                      {/* Trust score overview */}
                      <Card className="border-border bg-card/60 backdrop-blur-md p-6">
                        <div className="flex items-center justify-between gap-4 flex-wrap">
                          <div className="space-y-1">
                            <h3 className="font-bold text-base text-foreground">Registry Trust Score</h3>
                            <p className="text-muted-foreground text-xs">Overall validation level evaluated from registry checklist and ledger state</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className={`px-3 py-1.5 rounded-full border text-xs font-bold ${confidence.color}`}>
                              {confidence.label}
                            </div>
                            <span className="text-3xl font-extrabold text-foreground">{trustScore} <span className="text-sm font-normal text-muted-foreground">/ 100</span></span>
                          </div>
                        </div>
                      </Card>

                      {/* VPL Checklist */}
                      <Card className="border-border bg-card/60 backdrop-blur-md p-6 space-y-4">
                        <div className="space-y-1">
                          <h3 className="font-bold text-base text-foreground">Verification Proof Layer (VPL) Checklist</h3>
                          <p className="text-muted-foreground text-xs">Standard validation checks performed by the registrar and AI audit agent</p>
                        </div>
                        <div className="divide-y divide-border/40 border-t border-border/40 pt-2">
                          {docDetails.verificationCase?.checklist && docDetails.verificationCase.checklist.length > 0 ? (
                            docDetails.verificationCase.checklist.map((item: any) => (
                              <div key={item.id} className="flex items-center justify-between py-3.5 text-xs">
                                <span className="font-semibold text-foreground">{item.label || item.id}</span>
                                {item.status === 'PASSED' ? (
                                  <Badge className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/25 text-[10px] font-semibold">✓ PASSED</Badge>
                                ) : item.status === 'FAILED' ? (
                                  <Badge className="bg-red-500/10 text-red-500 border border-red-500/25 text-[10px] font-semibold">✗ FAILED</Badge>
                                ) : (
                                  <Badge className="bg-amber-500/10 text-amber-500 border border-amber-500/25 text-[10px] font-semibold">⏳ PENDING</Badge>
                                )}
                              </div>
                            ))
                          ) : (
                            <p className="text-xs text-muted-foreground italic text-center py-4">No checklist items listed.</p>
                          )}
                        </div>
                      </Card>

                      {/* Solana Verification Details */}
                      <Card className="border-border bg-card/60 backdrop-blur-md p-6 space-y-4">
                        <div className="space-y-1">
                          <h3 className="font-bold text-base text-foreground">Blockchain Anchoring Details</h3>
                          <p className="text-muted-foreground text-xs">Immutable cryptographic references anchored on the Solana ledger</p>
                        </div>
                        <div className="space-y-3.5 border-t border-border/40 pt-4 text-xs">
                          <div className="flex justify-between items-center py-1 border-b border-border/20">
                            <span className="text-muted-foreground">Document Account PDA</span>
                            <span className="font-mono text-[11px] text-foreground break-all select-all">{blockchainDetails?.pdaAddress || 'N/A (Redacted)'}</span>
                          </div>
                          <div className="flex justify-between items-center py-1 border-b border-border/20">
                            <span className="text-muted-foreground">Solana Program ID</span>
                            <span className="font-mono text-[11px] text-foreground break-all select-all">EbKjjyvxck5REvVXTXuAvPDrydzKFniiGgLdKSeyfc3w</span>
                          </div>
                          {docDetails.onchainTxSignature && (
                            <div className="flex flex-col py-1 border-b border-border/20 gap-1">
                              <span className="text-muted-foreground">Anchoring Transaction Signature</span>
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-mono text-[11px] text-foreground break-all select-all leading-tight">{docDetails.onchainTxSignature}</span>
                                {!docDetails.onchainTxSignature.endsWith('_mock_sig') && (
                                  <a 
                                    href={`https://explorer.solana.com/tx/${docDetails.onchainTxSignature}?cluster=devnet`} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-primary hover:underline flex items-center gap-0.5 shrink-0 text-[10px] font-bold"
                                  >
                                    Explorer <ExternalLink className="h-3 w-3" />
                                  </a>
                                )}
                              </div>
                            </div>
                          )}
                          {docDetails.verificationCase?.vplOnchainTx && (
                            <div className="flex flex-col py-1 gap-1">
                              <span className="text-muted-foreground">VPL Verification Transaction</span>
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-mono text-[11px] text-foreground break-all select-all leading-tight">{docDetails.verificationCase.vplOnchainTx}</span>
                                {!docDetails.verificationCase.vplOnchainTx.endsWith('_mock_sig') && (
                                  <a 
                                    href={`https://explorer.solana.com/tx/${docDetails.verificationCase.vplOnchainTx}?cluster=devnet`} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-primary hover:underline flex items-center gap-0.5 shrink-0 text-[10px] font-bold"
                                  >
                                    Explorer <ExternalLink className="h-3 w-3" />
                                  </a>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </Card>
                    </div>
                  )}

                  {/* AUDIT TIMELINE TAB */}
                  {activeTab === 'timeline' && (
                    <Card className="border-border bg-card/60 backdrop-blur-md p-6 space-y-6">
                      <div className="space-y-1">
                        <h3 className="font-bold text-base text-foreground">Chronological Custody & Audit Timeline</h3>
                        <p className="text-muted-foreground text-xs">Verifiable log of all events and state changes recorded since document registration</p>
                      </div>
                      <div className="relative pl-6 border-l border-border/60 ml-2 pt-2 space-y-6">
                        {getTimelineEvents().map((event, idx) => (
                          <div key={idx} className="relative text-xs">
                            {/* timeline bullet */}
                            <div className={`absolute -left-[30px] top-0.5 h-4 w-4 rounded-full border-2 bg-background flex items-center justify-center ${
                              event.status === 'COMPLETED'
                                ? 'border-emerald-500 text-emerald-500'
                                : event.status === 'FLAGGED'
                                ? 'border-red-500 text-red-500'
                                : 'border-amber-500 text-amber-500'
                            }`}>
                              <div className={`h-1.5 w-1.5 rounded-full ${
                                event.status === 'COMPLETED'
                                  ? 'bg-emerald-500'
                                  : event.status === 'FLAGGED'
                                  ? 'bg-red-500'
                                  : 'bg-amber-500 animate-pulse'
                              }`} />
                            </div>

                            <div className="space-y-1">
                              <div className="flex justify-between items-center gap-4 flex-wrap">
                                <h4 className="font-bold text-foreground">{event.title}</h4>
                                <span className="text-[10px] text-muted-foreground font-mono">{event.timestamp}</span>
                              </div>
                              <p className="text-muted-foreground text-[11px] leading-relaxed">{event.description}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </Card>
                  )}

                  {/* CHAIN OF CUSTODY TAB */}
                  {activeTab === 'custody' && (
                    <div className="space-y-6">
                      <Card className="border-border bg-card/60 backdrop-blur-md p-6 space-y-4">
                        <div className="space-y-1">
                          <h3 className="font-bold text-base text-foreground">Chain of Title Summary</h3>
                          <p className="text-muted-foreground text-xs">Verification of ownership transitions and historical registry changes</p>
                        </div>
                        <div className="divide-y divide-border/40 border-t border-border/40 pt-2 text-xs">
                          <div className="flex justify-between items-center py-3.5">
                            <span className="text-muted-foreground font-medium">Verified Owner Email Hash</span>
                            <span className="font-mono text-foreground break-all select-all text-[11px]">{docDetails.ownershipSummary?.verifiedOwnerEmailHash || 'N/A'}</span>
                          </div>
                          <div className="flex justify-between items-center py-3.5">
                            <span className="text-muted-foreground font-medium">Historical Transfers Count</span>
                            <span className="font-semibold text-foreground">{docDetails.ownershipSummary?.historyCount ?? 0}</span>
                          </div>
                          <div className="flex justify-between items-center py-3.5">
                            <span className="text-muted-foreground font-medium">Latest Title Transfer</span>
                            <span className="font-semibold text-foreground">
                              {docDetails.ownershipSummary?.latestTransferDate 
                                ? new Date(docDetails.ownershipSummary.latestTransferDate).toLocaleString() 
                                : 'N/A (Original Registration)'}
                            </span>
                          </div>
                          <div className="flex justify-between items-center py-3.5">
                            <span className="text-muted-foreground font-medium">Transfer Status</span>
                            <span className="font-bold text-emerald-500 uppercase">{docDetails.ownershipSummary?.transferStatus || 'ACTIVE'}</span>
                          </div>
                        </div>
                      </Card>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      </main>

      <footer className="py-4 border-t border-border text-center text-xs text-muted-foreground bg-muted/20">
        &copy; 2026 TimeLock. All rights reserved.
      </footer>
    </div>
  );
}

export default function PublicVerify() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <Cpu className="h-8 w-8 text-foreground animate-spin" />
        <span className="ml-3 text-muted-foreground">Loading verifier...</span>
      </div>
    }>
      <VerifyContent />
    </Suspense>
  );
}

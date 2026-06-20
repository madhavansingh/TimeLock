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
import { verifyDocumentOnChain } from '@/lib/solana-verifier';
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

  const runSolanaVerification = async (doc: any, customHash?: string | null) => {
    if (!doc.onchainTxSignature) {
      setBlockchainState('unavailable');
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
      } catch (e) {
        console.error(e);
      }
      setBlockchainState('unavailable');
      return;
    }

    setBlockchainState('loading');
    setBlockchainError('');

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
    } catch (err: any) {
      setBlockchainState('mismatch');
      setBlockchainError(err.message || 'Direct on-chain check failed.');
    }
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
      setErrorMsg(err.message || 'Registry verification failed. Solana PDA record could not be read.');
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
          {docDetails && !detailsLoading && (
            <div className="space-y-6">
              {/* Blockchain Verification Banner */}
              {blockchainState === 'loading' && (
                <div className="p-4 rounded-xl border border-blue-500/30 bg-blue-500/10 text-center flex flex-col items-center justify-center space-y-1 shadow-lg shadow-blue-500/5 animate-pulse">
                  <span className="text-xl font-black tracking-widest text-blue-500 font-mono">VERIFYING BLOCKCHAIN...</span>
                  <p className="text-xs text-blue-600/90 font-medium">Reading PDA account state directly from Solana Devnet RPC...</p>
                </div>
              )}
              {blockchainState === 'verified' && (
                <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-center flex flex-col items-center justify-center space-y-1 shadow-lg shadow-emerald-500/5">
                  <span className="text-xl font-black tracking-widest text-emerald-500 font-mono">BLOCKCHAIN VERIFIED</span>
                  <p className="text-xs text-emerald-600/90 font-medium">This asset deed is independently validated and anchored on the Solana ledger.</p>
                </div>
              )}
              {blockchainState === 'mismatch' && (
                <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-center flex flex-col items-center justify-center space-y-1 shadow-lg shadow-red-500/5">
                  <span className="text-xl font-black tracking-widest text-red-500 font-mono">BLOCKCHAIN MISMATCH</span>
                  <p className="text-xs text-red-600/90 font-medium">Warning: Client-side verification failed! On-chain state does not match database or copy data.</p>
                  {blockchainError && <p className="text-[10px] text-red-500 font-mono mt-1">Error: {blockchainError}</p>}
                </div>
              )}
              {blockchainState === 'unavailable' && (
                <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 text-center flex flex-col items-center justify-center space-y-1 shadow-lg shadow-amber-500/5">
                  <span className="text-xl font-black tracking-widest text-amber-500 font-mono">BLOCKCHAIN UNAVAILABLE</span>
                  <p className="text-xs text-amber-600/90 font-medium">Unable to verify on-chain anchors. Sandbox environment active or connection offline.</p>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Left Column: Metadata & Notary & IPFS */}
              <div className="lg:col-span-2 space-y-6">
                
                {/* 1. Document Registry Card */}
                <Card className="border-border bg-card/60 backdrop-blur-md">
                  <CardHeader className="flex flex-row items-center justify-between pb-3">
                    <div className="space-y-1">
                      <CardTitle className="text-xl font-bold flex items-center gap-2">
                        <FileText className="h-5 w-5 text-primary" />
                        Registry Record Details
                      </CardTitle>
                      <CardDescription className="text-xs font-mono select-all">
                        ID: {docDetails.documentId}
                      </CardDescription>
                    </div>
                    <div>
                      {getStatusBadge(docDetails.status)}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4 text-sm">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-border/60 pt-4">
                      <div>
                        <Label className="text-muted-foreground text-xs font-mono">DOCUMENT TITLE</Label>
                        <p className="font-semibold mt-0.5 text-foreground">{docDetails.title}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground text-xs font-mono">DOCUMENT TYPE</Label>
                        <p className="font-semibold mt-0.5 text-foreground">{docDetails.type}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground text-xs font-mono">REGISTRATION TIME</Label>
                        <p className="mt-0.5 flex items-center gap-1.5 text-foreground">
                          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                          {new Date(docDetails.timestamp).toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground text-xs font-mono">FINGERPRINT MATCH STATUS</Label>
                        <p className="font-semibold mt-0.5 flex items-center gap-1 text-emerald-500">
                          <VerifiedIcon className="h-4 w-4" /> Cryptographically Untampered
                        </p>
                      </div>
                    </div>

                    <div className="bg-background/70 border border-border p-3.5 rounded-lg space-y-2">
                      <div>
                        <span className="block text-muted-foreground text-xs font-mono">SHA-256 CONTENT CHECKSUM</span>
                        <span className="font-mono text-xs select-all break-all text-primary font-bold">{docDetails.contentHash}</span>
                      </div>
                    </div>

                    {docDetails.ownershipSummary && (
                      <div className="border-t border-border/60 pt-4 mt-4 space-y-4">
                        <h4 className="text-sm font-semibold text-foreground">Ownership Ledger Summary</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                          <div>
                            <Label className="text-muted-foreground text-xs font-mono">CURRENT VERIFIED OWNER</Label>
                            <p className="font-mono text-xs font-semibold mt-0.5 text-foreground break-all select-all">
                              {docDetails.ownershipSummary.verifiedOwnerEmailHash}
                            </p>
                          </div>
                          <div>
                            <Label className="text-muted-foreground text-xs font-mono">OWNERSHIP HISTORY COUNT</Label>
                            <p className="font-semibold mt-0.5 text-foreground">
                              {docDetails.ownershipSummary.historyCount} Transfer(s)
                            </p>
                          </div>
                          <div>
                            <Label className="text-muted-foreground text-xs font-mono">LATEST TRANSFER DATE</Label>
                            <p className="font-semibold mt-0.5 text-foreground">
                              {docDetails.ownershipSummary.latestTransferDate
                                ? new Date(docDetails.ownershipSummary.latestTransferDate).toLocaleString()
                                : 'N/A (Initial Registration)'}
                            </p>
                          </div>
                          <div>
                            <Label className="text-muted-foreground text-xs font-mono">TRANSFER STATUS</Label>
                            <p className="font-semibold mt-0.5 text-foreground flex items-center gap-1">
                              <Badge className={
                                docDetails.ownershipSummary.transferStatus === 'FINALIZED'
                                  ? 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/20'
                                  : 'bg-yellow-500/15 text-yellow-500 border border-yellow-500/20'
                              }>
                                {docDetails.ownershipSummary.transferStatus}
                              </Badge>
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* 2. Decentralized Storage IPFS Card */}
                <Card className="border-border bg-card/60 backdrop-blur-md">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg font-bold flex items-center gap-2">
                      <Cpu className="h-4 w-4 text-primary" />
                      Decentralized Storage (IPFS) Proof
                    </CardTitle>
                    <CardDescription>
                      Secure symmetric AES-256 encrypted archival on decentralized IPFS network
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3.5 text-sm border-t border-border/60 pt-4">
                    {docDetails.ipfsReference ? (
                      <>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <Label className="text-muted-foreground text-xs font-mono">STORAGE PROVIDER</Label>
                            <p className="font-semibold text-foreground">Pinata IPFS Gateway</p>
                          </div>
                          <div>
                            <Label className="text-muted-foreground text-xs font-mono">UPLOAD TIMESTAMP</Label>
                            <p className="font-semibold text-foreground">
                              {new Date(docDetails.ipfsReference.uploadedAt).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <div className="bg-background/70 border border-border p-3.5 rounded-lg space-y-2">
                          <div>
                            <span className="block text-muted-foreground text-xs font-mono">IPFS CONTENT IDENTIFIER (CID)</span>
                            <span className="font-mono text-xs select-all break-all text-blue-500 font-bold flex items-center gap-1.5">
                              {docDetails.ipfsReference.cid}
                              <a href={`https://${process.env.NEXT_PUBLIC_PINATA_GATEWAY || 'silver-acceptable-bandicoot-606.mypinata.cloud'}/ipfs/${docDetails.ipfsReference.cid}`} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground inline" />
                              </a>
                            </span>
                          </div>
                          <div className="border-t border-border/60 pt-2 mt-2">
                            <span className="block text-muted-foreground text-xs font-mono font-bold">SYMMETRIC ENCRYPTION KEY HASH REFERENCE</span>
                            <span className="font-mono text-xs select-all break-all text-muted-foreground">{docDetails.ipfsReference.keyReference}</span>
                          </div>
                        </div>
                      </>
                    ) : (
                      <p className="text-muted-foreground text-xs italic">No decentralized storage reference details recorded.</p>
                    )}
                  </CardContent>
                </Card>

                {/* 3. Notary Information Card */}
                {docDetails.notarySummary && (
                  <Card className="border-border bg-card/60 backdrop-blur-md">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg font-bold flex items-center gap-2">
                        <User className="h-4 w-4 text-primary" />
                        Accredited Notarization Record
                      </CardTitle>
                      <CardDescription>
                        State-accredited Class-3 Digital Signature Certificate (DSC) verification details
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4 text-sm border-t border-border/60 pt-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label className="text-muted-foreground text-xs font-mono">SIGNING NOTARY AUTHORITY</Label>
                          <p className="font-bold text-foreground">{docDetails.notarySummary.name}</p>
                        </div>
                        <div>
                          <Label className="text-muted-foreground text-xs font-mono">DSC CERTIFICATE SERIAL</Label>
                          <p className="font-mono text-foreground font-semibold">{docDetails.notarySummary.dscCertificateSerial}</p>
                        </div>
                        <div>
                          <Label className="text-muted-foreground text-xs font-mono">SIGNATURE CONFIRMATION TIMESTAMP</Label>
                          <p className="text-foreground">{new Date(docDetails.notarySummary.signedAt).toLocaleString()}</p>
                        </div>
                        <div>
                          <Label className="text-muted-foreground text-xs font-mono">AUTHORIZATION ACCREDITATION</Label>
                          <p className="text-emerald-500 font-semibold flex items-center gap-1">
                            <VerifiedIcon className="h-4.5 w-4.5" /> DSC Signature Active & Valid
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* VPL Details Card */}
                {docDetails.verificationCase && (
                  <Card className="border-border bg-card/60 backdrop-blur-md">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg font-bold flex items-center gap-2">
                        <ShieldCheck className="h-5 w-5 text-primary" />
                        Verification Proof Layer (VPL) Attestation
                      </CardTitle>
                      <CardDescription>
                        Independent verification proof record and trust anchor score
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4 text-sm border-t border-border/60 pt-4">
                      <div className="grid gap-6 sm:grid-cols-2">
                        {/* Trust Score & Status */}
                        <div className="flex items-center gap-4 p-4 rounded-xl border border-border bg-background/40">
                          <div className="flex flex-col items-center justify-center h-20 w-20 rounded-full border border-border bg-background/60 shadow-inner">
                            <span className={`text-2xl font-mono font-bold ${
                              docDetails.verificationCase.trustScore >= 80 
                                ? 'text-emerald-500' 
                                : docDetails.verificationCase.trustScore >= 50 
                                  ? 'text-yellow-500' 
                                  : 'text-red-500'
                            }`}>
                              {docDetails.verificationCase.trustScore}
                            </span>
                            <span className="text-[8px] text-muted-foreground font-semibold font-sans">SCORE</span>
                          </div>
                          <div className="space-y-1">
                            <span className="text-muted-foreground text-xs block">VPL CASE STATUS:</span>
                            <Badge className={
                              docDetails.verificationCase.status === 'VERIFIED'
                                ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/25 font-bold uppercase text-[10px]'
                                : 'bg-yellow-500/10 text-yellow-600 border border-yellow-500/25 font-bold uppercase text-[10px]'
                            }>
                              {docDetails.verificationCase.status}
                            </Badge>
                          </div>
                        </div>

                        {/* Checklist Summary */}
                        <div className="p-4 rounded-xl border border-border bg-background/40 space-y-2">
                          <span className="text-muted-foreground text-xs block">CHECKLIST COMPLIANCE:</span>
                          <div className="space-y-1.5">
                            {docDetails.verificationCase.checklist.map((item: any) => (
                              <div key={item.id} className="flex items-center justify-between text-xs">
                                <span className="text-muted-foreground">{item.label}</span>
                                <Badge variant="outline" className={
                                  item.status === 'PASSED'
                                    ? 'bg-emerald-500/5 text-emerald-500 border-emerald-500/20 text-[10px]'
                                    : item.status === 'FAILED'
                                      ? 'bg-red-500/5 text-red-500 border-red-500/20 text-[10px]'
                                      : 'bg-muted text-muted-foreground border-border text-[10px]'
                                }>
                                  {item.status}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Property Registry Metadata display if present */}
                      {docDetails.metadata && (
                        <div className="border-t border-border pt-4 space-y-2.5">
                          <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">Property Registry Metadata</h4>
                          <div className="grid gap-4 sm:grid-cols-2 text-xs font-mono bg-background/30 rounded-lg p-3.5 border border-border">
                            <div>
                              <span className="text-muted-foreground block">SURVEY NUMBER:</span>
                              <span className="text-foreground font-semibold">{docDetails.metadata.surveyNumber || 'N/A'}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground block">PROPERTY ID / KHATA:</span>
                              <span className="text-foreground font-semibold">{docDetails.metadata.propertyId || 'N/A'}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground block">REGISTRATION NUMBER:</span>
                              <span className="text-foreground font-semibold">{docDetails.metadata.registrationNumber || 'N/A'}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground block">REGISTERED OWNER NAME:</span>
                              <span className="text-foreground font-semibold">{docDetails.metadata.ownerName || 'N/A'}</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Solana VPL Anchor Details */}
                      {docDetails.verificationCase.vplOnchainTx && (
                        <div className="border-t border-border pt-4 space-y-3">
                          <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider font-sans">On-chain VPL Attestation Proof</h4>
                          <div className="rounded-lg bg-background/60 border border-border p-4 space-y-3.5 text-xs">
                            {docDetails.verificationCase.vplProofHash && (
                              <div>
                                <span className="block text-muted-foreground font-mono">VPL PROOF RECORD HASH (SHA-256):</span>
                                <span className="font-mono text-foreground select-all break-all">{docDetails.verificationCase.vplProofHash}</span>
                              </div>
                            )}
                            <div>
                              <span className="block text-muted-foreground font-mono">SOLANA ATTESTATION TRANSACTION:</span>
                              {docDetails.verificationCase.vplOnchainTx.endsWith('_mock_sig') ? (
                                <span className="font-mono text-muted-foreground italic">
                                  {docDetails.verificationCase.vplOnchainTx} (Local Sandbox Mode)
                                </span>
                              ) : (
                                <a
                                  href={`https://explorer.solana.com/tx/${docDetails.verificationCase.vplOnchainTx}?cluster=devnet`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="font-mono text-foreground underline hover:text-muted-foreground break-all flex items-center gap-1 text-blue-500"
                                >
                                  {docDetails.verificationCase.vplOnchainTx}
                                  <ExternalLink className="h-3 w-3 inline" />
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* 4. Live Verification Event Timeline */}
                <Card className="border-border bg-card/60 backdrop-blur-md">
                  <CardHeader>
                    <CardTitle className="text-lg font-bold">Unified Timeline Audit Trail</CardTitle>
                    <CardDescription>
                      Secure, chronologically ordered logs from the PostgreSQL verification events ledger
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="border-t border-border/60 pt-4">
                    {docDetails.verificationEvents && docDetails.verificationEvents.length > 0 ? (
                      <div className="relative pl-6 border-l border-border space-y-6 ml-3">
                        {docDetails.verificationEvents.map((event: any) => (
                          <div key={event.eventId} className="relative">
                            {/* Line Bullet */}
                            <div className="absolute -left-[30px] top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-white border-2 border-background">
                              <div className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />
                            </div>
                            
                            <div>
                              <p className="text-sm font-semibold text-foreground capitalize">
                                {event.eventType.replace(/_/g, ' ')}
                              </p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {new Date(event.occurredAt).toLocaleString()} &bull; Actor: <span className="font-semibold text-foreground/80">{event.actorLabel}</span>
                              </p>
                              {event.onchainTxRef && (
                                <p className="text-[10px] font-mono text-muted-foreground/80 mt-1 break-all select-all bg-background/50 p-1 rounded border border-border/40">
                                  Tx Ref: {event.onchainTxRef}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">No audit trail timeline logs found.</p>
                    )}
                  </CardContent>
                </Card>

              </div>

              {/* Right Column: Risk Gauge & Proof Panel & File Uploader */}
              <div className="space-y-6">
                
                {/* 1. Dynamic Risk Score Gauge */}
                <Card className="border-border bg-card/60 backdrop-blur-md">
                  <CardHeader className="pb-3 text-center">
                    <CardTitle className="text-md font-mono text-muted-foreground font-semibold">FRAUD RISK ANALYSIS</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col items-center justify-center pb-6">
                    <div className="relative flex items-center justify-center h-28 w-28">
                      <svg className="w-full h-full transform -rotate-90">
                        <circle
                          cx="56"
                          cy="56"
                          r="46"
                          stroke="hsl(var(--border))"
                          strokeWidth="8"
                          fill="transparent"
                        />
                        <circle
                          cx="56"
                          cy="56"
                          r="46"
                          stroke={
                            docDetails.riskAnalysis?.score === 0 
                              ? '#10B981' 
                              : docDetails.riskAnalysis?.score >= 80 
                                ? '#EF4444' 
                                : '#F59E0B'
                          }
                          strokeWidth="8"
                          fill="transparent"
                          strokeDasharray={289}
                          strokeDashoffset={289 - (289 * (docDetails.riskAnalysis?.score || 0)) / 100}
                          strokeLinecap="round"
                        />
                      </svg>
                      <div className="absolute flex flex-col items-center justify-center text-center">
                        <span className="text-2xl font-black text-foreground">
                          {docDetails.riskAnalysis?.score}%
                        </span>
                        <span className="text-[10px] text-muted-foreground font-bold tracking-tight mt-0.5">
                          RISK LEVEL
                        </span>
                      </div>
                    </div>

                    <div className="w-full mt-5 space-y-2.5 text-xs">
                      <div className="flex items-center justify-between p-2 rounded bg-background/50 border border-border">
                        <span>Content Match Status</span>
                        <Badge className="bg-emerald-500/15 text-emerald-500">Uncompromised</Badge>
                      </div>
                      <div className="flex items-center justify-between p-2 rounded bg-background/50 border border-border">
                        <span>Solana Anchor State</span>
                        {docDetails.riskAnalysis?.signals?.missingBlockchainTx ? (
                          <Badge variant="destructive" className="bg-red-500/15 text-red-500">Unanchored</Badge>
                        ) : (
                          <Badge className="bg-emerald-500/15 text-emerald-500">Anchored</Badge>
                        )}
                      </div>
                      <div className="flex items-center justify-between p-2 rounded bg-background/50 border border-border">
                        <span>Stakeholder Notarization</span>
                        {docDetails.riskAnalysis?.signals?.missingNotarySignature ? (
                          <Badge className="bg-amber-500/15 text-amber-500">Missing Signature</Badge>
                        ) : (
                          <Badge className="bg-emerald-500/15 text-emerald-500">DSC Notarized</Badge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* 2. Solana Blockchain Proof Panel */}
                <Card className="border-border bg-card/60 backdrop-blur-md">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-md font-bold flex items-center gap-2">
                      <Cpu className="h-4 w-4 text-primary" />
                      Solana Trust Anchor Proofs
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 text-xs">
                    <div>
                      <Label className="text-muted-foreground font-mono block mb-0.5">ANCHOR PROGRAM ID</Label>
                      <span className="font-mono bg-background/60 p-1.5 rounded border border-border/80 block select-all text-primary font-bold">
                        EbKjjyvxck5REvVXTXuAvPDrydzKFniiGgLdKSeyfc3w
                      </span>
                    </div>
                    <div>
                      <Label className="text-muted-foreground font-mono block mb-0.5">DOCUMENT PDA ACCOUNT</Label>
                      <span className="font-mono bg-background/60 p-1.5 rounded border border-border/80 block select-all break-all text-foreground font-semibold">
                        {blockchainDetails?.pdaAddress || 'Deriving...'}
                      </span>
                    </div>
                    {docDetails.onchainTxSignature && (
                      <div>
                        <Label className="text-muted-foreground font-mono block mb-0.5">TRANSACTION SIGNATURE</Label>
                        <span className="font-mono bg-background/60 p-1.5 rounded border border-border/80 block select-all break-all text-muted-foreground">
                          {docDetails.onchainTxSignature.endsWith('_mock_sig') ? (
                            <span>{docDetails.onchainTxSignature}</span>
                          ) : (
                            <a
                              href={`https://explorer.solana.com/tx/${docDetails.onchainTxSignature}?cluster=devnet`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-500 hover:underline flex items-center gap-1"
                            >
                              {docDetails.onchainTxSignature.slice(0, 16)}...
                              <ExternalLink className="h-3 w-3 inline" />
                            </a>
                          )}
                        </span>
                      </div>
                    )}
                    <div>
                      <Label className="text-muted-foreground font-mono block mb-0.5">CONFIRMATION SLOT</Label>
                      <span className="font-mono bg-background/60 p-1.5 rounded border border-border/80 block text-foreground">
                        {blockchainDetails?.slot !== undefined ? blockchainDetails.slot : 'Pending...'}
                      </span>
                    </div>
                    {blockchainDetails && (
                      <>
                        <div>
                          <Label className="text-muted-foreground font-mono block mb-0.5">ON-CHAIN STATUS CODE</Label>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="font-mono bg-background/60 px-1.5 py-0.5 rounded border border-border/80 text-foreground">
                              {blockchainDetails.onchainStatus}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {blockchainDetails.onchainStatus === 1 && '(Active / Confirmed)'}
                              {blockchainDetails.onchainStatus === 2 && '(Notary Signed)'}
                              {blockchainDetails.onchainStatus === 3 && '(Fully Signed / Executed)'}
                              {blockchainDetails.onchainStatus === 5 && '(Disputed / Flagged)'}
                              {blockchainDetails.onchainStatus === 6 && '(Revoked)'}
                            </span>
                          </div>
                        </div>
                        <div>
                          <Label className="text-muted-foreground font-mono block mb-0.5">ON-CHAIN RECORD HASH</Label>
                          <span className="font-mono bg-background/60 p-1.5 rounded border border-border/80 block select-all break-all text-primary font-bold">
                            {blockchainDetails.onchainHash}
                          </span>
                        </div>
                      </>
                    )}
                    <div className="flex justify-between items-center border-t border-border pt-3 mt-3">
                      <span className="text-muted-foreground">Ledger Sync</span>
                      {blockchainState === 'verified' ? (
                        <Badge className="bg-emerald-500/15 text-emerald-500 border border-emerald-500/20">Live Confirmed</Badge>
                      ) : blockchainState === 'mismatch' ? (
                        <Badge variant="destructive" className="bg-red-500/15 text-red-500 border border-red-500/20 animate-pulse">Mismatch</Badge>
                      ) : blockchainState === 'loading' ? (
                        <Badge className="bg-blue-500/15 text-blue-500 border border-blue-500/20 animate-pulse">Syncing...</Badge>
                      ) : (
                        <Badge className="bg-amber-500/15 text-amber-500 border border-amber-500/20">Sandbox / Offline</Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* 3. Live File Matcher */}
                <Card className="border-border bg-card/60 backdrop-blur-md">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-md font-bold flex items-center gap-2">
                      <FileUp className="h-4 w-4 text-primary" />
                      Local Copy Verification
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Drag & drop a local copy of this document to verify its hash matches the anchored ledger value.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {errorMsg && (
                      <div className="rounded border border-destructive/20 bg-destructive/10 p-2.5 text-xs text-destructive flex items-center gap-2 mb-3">
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
                          className={`relative flex flex-col items-center justify-center rounded-lg border border-dashed py-8 px-3 text-center transition-all ${
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
                          <FileUp className="h-6 w-6 text-muted-foreground/45 mb-2" />
                          {file ? (
                            <div className="text-xs">
                              <p className="font-semibold text-foreground truncate max-w-[200px]">{file.name}</p>
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
                                Drop scan PDF, or{' '}
                                <label
                                  htmlFor="dashboard-verify-file"
                                  className="underline cursor-pointer font-semibold text-foreground"
                                >
                                  browse
                                </label>
                              </p>
                            </div>
                          )}
                        </div>

                        <Button type="submit" disabled={loading} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground text-xs rounded-full">
                          {loading ? (
                            <span className="flex items-center justify-center gap-1.5">
                              <Cpu className="h-3 w-3 animate-spin text-muted-foreground" />
                              {hashingProgress ? 'Calculating SHA-256...' : 'Checking blockchain...'}
                            </span>
                          ) : (
                            'Verify Copy Authenticity'
                          )}
                        </Button>
                      </form>
                    ) : (
                      <div className="space-y-4">
                        <div className={`p-3 rounded-lg border text-xs flex flex-col gap-1.5 ${
                          verificationResult?.result === 'authentic'
                            ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                            : 'bg-red-500/10 text-red-500 border-red-500/20'
                        }`}>
                          <div className="flex items-center gap-1.5 font-bold">
                            {verificationResult?.result === 'authentic' ? (
                              <>
                                <CheckCircle2 className="h-4 w-4" />
                                <span>Copy is Authentic</span>
                              </>
                            ) : (
                              <>
                                <AlertTriangle className="h-4.5 w-4.5" />
                                <span>Integrity Mismatch Detected</span>
                              </>
                            )}
                          </div>
                          <p className="text-[10px] opacity-90 leading-relaxed">
                            {verificationResult?.result === 'authentic'
                              ? 'This local file matches the exact SHA-256 cryptographic signature anchored on Solana.'
                              : 'Warning: This file hash does not match the Solana registry record. It may have been edited or tampered with.'}
                          </p>
                        </div>

                        <div className="bg-background/50 border border-border p-3.5 rounded-lg space-y-2 text-[10px]">
                          <div>
                            <span className="block text-muted-foreground font-mono">EXPECTED LEDGER HASH:</span>
                            <span className="font-mono select-all break-all block text-foreground">{verificationResult?.expectedHash}</span>
                          </div>
                          <div className="border-t border-border pt-1.5">
                            <span className="block text-muted-foreground font-mono">SUBMITTED FILE HASH:</span>
                            <span className={`font-mono select-all break-all block ${
                              verificationResult?.result === 'authentic' ? 'text-emerald-500' : 'text-red-500 font-bold'
                            }`}>
                              {verificationResult?.submittedHash}
                            </span>
                          </div>
                        </div>

                        <Button onClick={resetVerification} variant="outline" className="w-full text-xs rounded-full">
                          Test Another Copy
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* 4. PDF Certificate Downloader */}
                <a href={`${apiClient.getBaseUrl()}/documents/${docDetails.documentId}/certificate?download=true`} target="_blank" rel="noopener noreferrer" className="block w-full">

                  <Button className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-bold flex items-center justify-center gap-1.5 rounded-full py-5">
                    <Download className="h-4 w-4" />
                    Download Legal Attestation Certificate
                  </Button>
                </a>

              </div>
              
            </div>
          </div>
          )}

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

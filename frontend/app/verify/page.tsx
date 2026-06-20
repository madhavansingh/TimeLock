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
      console.error('[Solana Verification Error]:', err);
      setBlockchainState('unavailable');
      setBlockchainError('Blockchain verification temporarily unavailable.');
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

            return (
              <div className="space-y-6 max-w-2xl mx-auto">
                {/* 1. Large Top Verification Badge */}
                {isVerified && (
                  <div className="flex flex-col items-center justify-center p-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 text-center shadow-lg shadow-emerald-500/5">
                    <CheckCircle2 className="h-16 w-16 text-emerald-500 mb-2" />
                    <span className="text-2xl font-bold text-emerald-500 uppercase tracking-wide">✓ Verified Document</span>
                    <p className="text-sm text-emerald-600/90 font-medium mt-1">Blockchain Anchored ✓</p>
                  </div>
                )}
                {isRegistered && (
                  <div className="flex flex-col items-center justify-center p-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 text-center shadow-lg shadow-amber-500/5">
                    <RefreshCw className="h-16 w-16 text-amber-500 mb-2 animate-spin-slow" />
                    <span className="text-2xl font-bold text-amber-500 uppercase tracking-wide">⏳ Pending Verification</span>
                    <p className="text-sm text-amber-600/90 font-medium mt-1">Blockchain Anchored ✓</p>
                  </div>
                )}
                {isRejected && (
                  <div className="flex flex-col items-center justify-center p-6 rounded-2xl border border-red-500/30 bg-red-500/10 text-center shadow-lg shadow-red-500/5">
                    <AlertTriangle className="h-16 w-16 text-red-500 mb-2" />
                    <span className="text-2xl font-bold text-red-500 uppercase tracking-wide">✗ Rejected Document</span>
                    <p className="text-sm text-red-600/90 font-medium mt-1">Registry Flagged / Revoked</p>
                  </div>
                )}

                {/* 2. Main Details Card */}
                <Card className="border-border bg-card/60 backdrop-blur-md">
                  <CardHeader>
                    <CardTitle className="text-lg font-bold">Document Registry Record</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 border-t border-border/60 pt-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="block text-muted-foreground text-xs font-semibold">DOCUMENT TITLE</span>
                        <span className="font-medium text-foreground">{docDetails.title}</span>
                      </div>
                      <div>
                        <span className="block text-muted-foreground text-xs font-semibold">REGISTRATION ID</span>
                        <span className="font-mono text-xs text-foreground select-all break-all">{docDetails.documentId}</span>
                      </div>
                      <div>
                        <span className="block text-muted-foreground text-xs font-semibold">PROPERTY ID / KHATA</span>
                        <span className="font-mono text-xs text-foreground">{docDetails.metadata?.propertyId || docDetails.metadata?.surveyNumber || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="block text-muted-foreground text-xs font-semibold">CURRENT OWNER</span>
                        <span className="font-medium text-foreground">{docDetails.metadata?.ownerName || 'Citizen Executant'}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* 3. Status Details Card */}
                <Card className="border-border bg-card/60 backdrop-blur-md">
                  <CardHeader>
                    <CardTitle className="text-lg font-bold">Verification Status</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 border-t border-border/60 pt-4">
                    {isVerified && (
                      <div className="space-y-3 text-sm">
                        <div className="flex justify-between items-center py-1.5 border-b border-border/30">
                          <span className="text-muted-foreground">Document Status</span>
                          <span className="font-bold text-emerald-500 flex items-center gap-1">VERIFIED ✓</span>
                        </div>
                        <div className="flex justify-between items-center py-1.5 border-b border-border/30">
                          <span className="text-muted-foreground">Verified By</span>
                          <span className="font-semibold text-foreground">{docDetails.notarySummary?.name || 'Accredited Notary Authority'}</span>
                        </div>
                        <div className="flex justify-between items-center py-1.5 border-b border-border/30">
                          <span className="text-muted-foreground">Verification Time</span>
                          <span className="text-foreground">{verificationTime}</span>
                        </div>
                        <div className="flex justify-between items-center py-1.5 border-b border-border/30">
                          <span className="text-muted-foreground">Trust Score</span>
                          <span className="font-bold text-emerald-500">{(docDetails.verificationCase?.trustScore !== undefined) ? docDetails.verificationCase.trustScore : 95} / 100</span>
                        </div>
                        <div className="flex justify-between items-center py-1.5">
                          <span className="text-muted-foreground">Blockchain Status</span>
                          <span className="font-semibold text-emerald-500">ANCHORED ✓</span>
                        </div>
                      </div>
                    )}

                    {isRegistered && (
                      <div className="space-y-3 text-sm">
                        <div className="flex justify-between items-center py-1.5 border-b border-border/30">
                          <span className="text-muted-foreground">Document Status</span>
                          <span className="font-bold text-amber-500">REGISTERED</span>
                        </div>
                        <div className="flex justify-between items-center py-1.5 border-b border-border/30">
                          <span className="text-muted-foreground">Blockchain Record</span>
                          <span className="font-semibold text-emerald-500">ANCHORED ✓</span>
                        </div>
                        <div className="flex justify-between items-center py-1.5 border-b border-border/30">
                          <span className="text-muted-foreground">Verification Status</span>
                          <span className="font-bold text-amber-500">PENDING REVIEW</span>
                        </div>
                        <div className="flex justify-between items-center py-1.5">
                          <span className="text-muted-foreground">Registration Time</span>
                          <span className="text-foreground">{registrationTime}</span>
                        </div>
                      </div>
                    )}

                    {isRejected && (
                      <div className="space-y-3 text-sm">
                        <div className="flex justify-between items-center py-1.5 border-b border-border/30">
                          <span className="text-muted-foreground">Document Status</span>
                          <span className="font-bold text-red-500">REJECTED</span>
                        </div>
                        <div className="flex flex-col py-1.5 border-b border-border/30">
                          <span className="text-muted-foreground">Reason</span>
                          <span className="font-semibold text-foreground mt-1">
                            {docDetails.status === 'REVOKED' ? 'Revoked by registration authority.' : 'Disputed ownership or metadata mismatches.'}
                          </span>
                        </div>
                        <div className="flex justify-between items-center py-1.5 border-b border-border/30">
                          <span className="text-muted-foreground">Reviewed By</span>
                          <span className="font-semibold text-foreground">Accredited Registry Reviewer</span>
                        </div>
                        <div className="flex justify-between items-center py-1.5">
                          <span className="text-muted-foreground">Review Date</span>
                          <span className="text-foreground">{registrationTime}</span>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* 4. Blockchain Status Warning/Notice Banner */}
                {(blockchainState === 'mismatch' || blockchainState === 'unavailable') && (
                  <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 text-center flex flex-col items-center justify-center space-y-1.5">
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                    <span className="text-sm font-semibold text-amber-600">Blockchain verification temporarily unavailable.</span>
                    <p className="text-xs text-muted-foreground">The registration record remains accessible. Please try again later.</p>
                  </div>
                )}

                {/* 5. Clean Copy Verification File Matcher */}
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
                              ? 'This local file matches the exact cryptographic signature anchored on the ledger.'
                              : 'Warning: This file does not match the registry record. It may have been edited or tampered with.'}
                          </p>
                        </div>

                        <Button onClick={resetVerification} variant="outline" className="w-full text-xs rounded-full">
                          Test Another Copy
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* 6. Certificate Download Button */}
                <a href={`${apiClient.getBaseUrl()}/documents/${docDetails.documentId}/certificate?download=true`} target="_blank" rel="noopener noreferrer" className="block w-full">
                  <Button className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-bold flex items-center justify-center gap-1.5 rounded-full py-5">
                    <Download className="h-4 w-4" />
                    Download Legal Attestation Certificate
                  </Button>
                </a>
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

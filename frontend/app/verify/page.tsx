'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle, Lock, ArrowLeft, CheckCircle2, ShieldAlert, Cpu, FileUp, ShieldCheck, HelpCircle, FileText } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { calculateSHA256 } from '@/lib/crypto';
import { apiClient } from '@/lib/api';

function VerifyContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [documentId, setDocumentId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hashingProgress, setHashingProgress] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

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

  useEffect(() => {
    const idParam = searchParams.get('id');
    const hashParam = searchParams.get('hash');
    const nameParam = searchParams.get('name');

    if (idParam) {
      setDocumentId(idParam);
    }
    
    if (hashParam) {
      setFile(new File([""], nameParam || "document.pdf"));
    }
  }, [searchParams]);

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
      setHashingProgress(false);

      const formData = new FormData();
      formData.append('file', file);
      
      const res = await apiClient.postFormData(`/documents/${documentId}/verify`, formData);
      if (!res.data) {
        throw new Error(res.error?.message || 'Verification check failed.');
      }

      setVerificationResult(res.data);
      setVerified(true);
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
  };

  return (
    <div className="min-h-screen bg-background text-foreground antialiased font-sans flex flex-col justify-between noise-overlay">
      {/* Top Navbar */}
      <header className="border-b border-border bg-background/80 backdrop-blur-md px-6 py-4">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
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
      <main className="flex-1 flex items-center justify-center py-12 px-4">
        <div className="w-full max-w-xl">
          {errorMsg && (
            <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3.5 text-sm text-destructive flex items-center gap-2.5">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {!verified ? (
            <Card className="border-border bg-card/60 backdrop-blur-md">
              <CardHeader>
                <CardTitle className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-foreground" />
                  Verify Document Scan
                </CardTitle>
                <CardDescription className="text-muted-foreground">
                  Compare a scanned document copy against its immutable Solana Devnet anchor hash.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleVerify} className="space-y-5">
                  {/* Document ID */}
                  <div className="space-y-2">
                    <Label htmlFor="documentId" className="text-foreground/80 font-medium">Document Registry ID</Label>
                    <Input
                      id="documentId"
                      placeholder="Enter Document ID (UUID)"
                      value={documentId}
                      onChange={(e) => setDocumentId(e.target.value)}
                      disabled={loading}
                      className="border-border bg-background text-foreground focus-visible:ring-ring font-mono text-xs"
                    />
                  </div>

                  {/* Upload */}
                  <div className="space-y-2">
                    <Label className="text-foreground/80 font-medium">Upload Copy for Check</Label>
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
                        id="verify-upload-input"
                        onChange={handleFileChange}
                        className="hidden"
                        accept=".pdf,.png,.jpg,.jpeg"
                      />
                      <FileUp className="h-8 w-8 text-muted-foreground/45 mb-3" />
                      {file ? (
                        <div className="text-sm">
                          <p className="font-semibold text-foreground">{file.name}</p>
                          <p className="text-muted-foreground text-xs mt-1">
                            {file.size > 0 ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : 'Dynamic Hash Search Ready'}
                          </p>
                          <label
                            htmlFor="verify-upload-input"
                            className="mt-2 inline-block text-xs text-muted-foreground hover:text-foreground underline cursor-pointer"
                          >
                            Change file
                          </label>
                        </div>
                      ) : (
                        <div>
                          <p className="text-sm text-muted-foreground font-medium">
                            Drag & drop scan PDF here, or
                          </p>
                          <label
                            htmlFor="verify-upload-input"
                            className="mt-1 text-sm text-foreground underline cursor-pointer font-medium"
                          >
                            browse files
                          </label>
                          <p className="text-xs text-muted-foreground/65 mt-2">
                            Only PDF, PNG, JPG accepted (Max 25MB)
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  <Button type="submit" disabled={loading} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-full">
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <Cpu className="h-4 w-4 animate-spin text-muted-foreground" />
                        {hashingProgress ? 'Calculating copy SHA-256...' : 'Checking Solana registers...'}
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-1.5">
                        Verify Authenticity
                      </span>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-border bg-card/60 backdrop-blur-md">
              <CardHeader className="text-center pb-2">
                <div className={`flex h-12 w-12 items-center justify-center rounded-full mx-auto mb-4 border ${
                  verificationResult?.result === 'authentic'
                    ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                    : 'bg-red-500/10 text-red-600 border-red-500/20'
                }`}>
                  {verificationResult?.result === 'authentic' ? (
                    <CheckCircle2 className="h-6 w-6" />
                  ) : (
                    <ShieldAlert className="h-6 w-6" />
                  )}
                </div>
                <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
                  {verificationResult?.result === 'authentic' ? 'Document Verified' : 'Integrity Check Failed'}
                </CardTitle>
                <CardDescription className={`text-sm font-semibold mt-1 ${
                  verificationResult?.result === 'authentic' ? 'text-emerald-600' : 'text-red-600'
                }`}>
                  {verificationResult?.result === 'authentic' 
                    ? 'AUTHENTIC - MATCHES SOLANA REGISTER' 
                    : 'MODIFIED - HASH MISMATCH DETECTED'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                
                {/* Risk Gauge */}
                <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-muted/20">
                  <div>
                    <span className="block text-muted-foreground text-xs font-mono">FRAUD RISK SCORE:</span>
                    <span className={`text-2xl font-bold ${
                      verificationResult?.riskScore === 0 
                        ? 'text-emerald-600' 
                        : verificationResult?.riskScore && verificationResult?.riskScore >= 80 
                          ? 'text-red-600' 
                          : 'text-yellow-600'
                    }`}>
                      {verificationResult?.riskScore} / 100
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="block text-muted-foreground text-xs font-mono">COMPUTED ON:</span>
                    <span className="text-xs text-foreground">
                      {verificationResult?.detectedAt ? new Date(verificationResult.detectedAt).toLocaleString() : 'N/A'}
                    </span>
                  </div>
                </div>

                {/* Comparative hashes */}
                <div className="rounded-lg bg-background/60 border border-border p-4 space-y-3.5 text-xs">
                  <div>
                    <span className="block text-muted-foreground font-mono">EXPECTED SOLANA HASH:</span>
                    <span className="font-mono text-foreground select-all break-all">{verificationResult?.expectedHash}</span>
                  </div>
                  <div>
                    <span className="block text-muted-foreground font-mono">SUBMITTED SCAN HASH:</span>
                    <span className={`font-mono select-all break-all ${
                      verificationResult?.result === 'authentic' ? 'text-emerald-600 font-semibold' : 'text-red-600 font-bold'
                    }`}>
                      {verificationResult?.submittedHash}
                    </span>
                  </div>
                </div>

                {/* Signals breakdown */}
                {verificationResult?.signals && (
                  <div className="space-y-2">
                    <Label className="text-muted-foreground text-xs font-mono">Integrity Checklist</Label>
                    <div className="grid gap-2 text-xs">
                      <div className="flex items-center justify-between p-2 rounded bg-background/60 border border-border">
                        <span>Fingerprint match</span>
                        {verificationResult.signals.hashMismatch ? (
                          <Badge variant="destructive" className="bg-red-500/20 text-red-600">Failed</Badge>
                        ) : (
                          <Badge className="bg-emerald-500/20 text-emerald-600">Passed</Badge>
                        )}
                      </div>
                      <div className="flex items-center justify-between p-2 rounded bg-background/60 border border-border">
                        <span>On-Chain Solana anchor existence</span>
                        {verificationResult.signals.missingBlockchainTx ? (
                          <Badge variant="destructive" className="bg-red-500/20 text-red-600">Missing</Badge>
                        ) : (
                          <Badge className="bg-emerald-500/20 text-emerald-600">Passed</Badge>
                        )}
                      </div>
                      <div className="flex items-center justify-between p-2 rounded bg-background/60 border border-border">
                        <span>Digital notary Class-3 signature</span>
                        {verificationResult.signals.missingNotarySignature ? (
                          <Badge className="bg-yellow-500/20 text-yellow-600">Pending</Badge>
                        ) : (
                          <Badge className="bg-emerald-500/20 text-emerald-600 font-semibold">Signed</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
              <CardFooter className="flex flex-col sm:flex-row gap-3">
                <Button variant="outline" onClick={resetVerification} className="w-full border-border bg-transparent text-foreground hover:bg-accent rounded-full">
                  Verify Another File
                </Button>
                <Link href={`/document/${documentId}`} className="w-full">
                  <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-full">
                    Inspect Timeline History
                  </Button>
                </Link>
              </CardFooter>
            </Card>
          )}
        </div>
      </main>

      <footer className="py-4 border-t border-border text-center text-xs text-muted-foreground bg-muted/20">
        &copy; 2026 Time Lock. All rights reserved.
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

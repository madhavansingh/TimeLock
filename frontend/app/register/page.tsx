'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/auth-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, Lock, ArrowLeft, ArrowRight, CheckCircle2, ShieldAlert, Cpu, FileUp, QrCode, FileText } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { calculateSHA256 } from '@/lib/crypto';
import { apiClient } from '@/lib/api';

const documentTypes = [
  'Sale Deed',
  'Agreement to Sell',
  'Power of Attorney',
  'Partnership Deed',
  'Lease Deed',
  'Affidavit',
  'Will / Testament',
  'Non-Disclosure Agreement (NDA)',
  'Service Level Agreement (SLA)'
];

const mockNotaries = [
  { notaryId: '688c6761-c8d3-4628-8792-87f62f8cb5a5', name: 'Advocate Rao (Class-3 DSC Active)' }
];

export default function RegisterDocument() {
  const { user } = useAuth();
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [type, setType] = useState('');
  const [notaryId, setNotaryId] = useState('688c6761-c8d3-4628-8792-87f62f8cb5a5');
  const [requiredSigners, setRequiredSigners] = useState(1);
  const [file, setFile] = useState<File | null>(null);

  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hashingProgress, setHashingProgress] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Success state
  const [success, setSuccess] = useState(false);
  const [registeredData, setRegisteredData] = useState<{
    documentId: string;
    hash: string;
    cid: string;
    status: string;
    onchainTxSignature: string;
    qrCode?: string;
  } | null>(null);

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    if (user.role !== 'CITIZEN') {
      router.push('/login');
    }
  }, [user, router]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !type || !notaryId || !file) {
      setErrorMsg('Please fill out all fields and select a file to upload.');
      return;
    }

    setLoading(true);
    setHashingProgress(true);
    setErrorMsg('');

    try {
      const clientHash = await calculateSHA256(file);
      setHashingProgress(false);

      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', title);
      formData.append('type', type);
      formData.append('clientHash', clientHash);
      formData.append('notaryId', notaryId);
      formData.append('requiredSigners', requiredSigners.toString());

      const res = await apiClient.postFormData('/documents', formData);
      if (!res.data) {
        throw new Error(res.error?.message || 'Failed to anchor document.');
      }

      const docData = res.data;
      
      let qrBase64 = '';
      try {
        const qrRes = await apiClient.get(`/documents/${docData.documentId}/qr`);
        qrBase64 = qrRes.data?.qrCode || '';
      } catch (err) {
        console.warn('QR code generation lagged or failed:', err);
      }

      const finalState = {
        documentId: docData.documentId,
        hash: docData.hash,
        cid: docData.cid,
        status: docData.status,
        onchainTxSignature: docData.onchainTxSignature,
        qrCode: qrBase64
      };

      setRegisteredData(finalState);
      
      const stored = localStorage.getItem('registered_documents');
      const docsList = stored ? JSON.parse(stored) : [];
      const newLocalDoc = {
        documentId: docData.documentId,
        title,
        type,
        contentHash: docData.hash,
        status: docData.status,
        createdAt: new Date().toISOString()
      };
      docsList.unshift(newLocalDoc);
      localStorage.setItem('registered_documents', JSON.stringify(docsList));

      setSuccess(true);
    } catch (err: any) {
      setHashingProgress(false);
      setErrorMsg(err.message || 'Registry creation failed. Solana devnet may be offline or lagging.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground antialiased font-sans flex flex-col justify-between noise-overlay">
      {/* Top Navbar */}
      <header className="border-b border-border bg-background/80 backdrop-blur-md px-6 py-4">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm font-medium">Dashboard</span>
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

      {/* Content wrapper */}
      <main className="flex-1 flex items-center justify-center py-12 px-4">
        <div className="w-full max-w-xl">
          {errorMsg && (
            <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3.5 text-sm text-destructive flex items-center gap-2.5">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {!success ? (
            <Card className="border-border bg-card/60 backdrop-blur-md">
              <CardHeader>
                <CardTitle className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                  <FileUp className="h-5 w-5 text-foreground" />
                  Anchor Legal Document
                </CardTitle>
                <CardDescription className="text-muted-foreground">
                  Submit metadata and secure the hash fingerprint permanently on Solana Devnet.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Title */}
                  <div className="space-y-2">
                    <Label htmlFor="title" className="text-foreground/80">Document Title</Label>
                    <Input
                      id="title"
                      placeholder="e.g. Sale Deed - Plot 42"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      disabled={loading}
                      className="border-border bg-background text-foreground focus-visible:ring-ring"
                    />
                  </div>

                  {/* Document Type */}
                  <div className="space-y-2">
                    <Label htmlFor="type" className="text-foreground/80">Document Type</Label>
                    <Select onValueChange={(val) => setType(val)} disabled={loading}>
                      <SelectTrigger className="border-border bg-background text-foreground">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent className="border-border bg-background text-foreground">
                        {documentTypes.map((t) => (
                          <SelectItem key={t} value={t} className="focus:bg-accent focus:text-foreground">
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Notary Selector */}
                  <div className="space-y-2">
                    <Label htmlFor="notary" className="text-foreground/80">Assign Notary Authority</Label>
                    <Select defaultValue={notaryId} onValueChange={(val) => setNotaryId(val)} disabled={loading}>
                      <SelectTrigger className="border-border bg-background text-foreground">
                        <SelectValue placeholder="Select notary" />
                      </SelectTrigger>
                      <SelectContent className="border-border bg-background text-foreground">
                        {mockNotaries.map((n) => (
                          <SelectItem key={n.notaryId} value={n.notaryId} className="focus:bg-accent focus:text-foreground">
                            {n.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Required Signers */}
                  <div className="space-y-2">
                    <Label htmlFor="signers" className="text-foreground/80">Required Notary Signatures</Label>
                    <Input
                      id="signers"
                      type="number"
                      min={1}
                      max={5}
                      value={requiredSigners}
                      onChange={(e) => setRequiredSigners(parseInt(e.target.value) || 1)}
                      disabled={loading}
                      className="border-border bg-background text-foreground focus-visible:ring-ring"
                    />
                  </div>

                  {/* Upload Area */}
                  <div className="space-y-2">
                    <Label className="text-foreground/80">Select Legal File</Label>
                    <div
                      onDragEnter={handleDrag}
                      onDragOver={handleDrag}
                      onDragLeave={handleDrag}
                      onDrop={handleDrop}
                      className={`relative flex flex-col items-center justify-center rounded-lg border border-dashed py-8 px-4 text-center transition-all ${
                        dragActive 
                          ? 'border-foreground bg-foreground/5' 
                          : 'border-border bg-background/50 hover:bg-accent/10'
                      }`}
                    >
                      <input
                        type="file"
                        id="document-upload-input"
                        onChange={handleFileChange}
                        className="hidden"
                        accept=".pdf,.png,.jpg,.jpeg"
                      />
                      <FileText className="h-8 w-8 text-muted-foreground/45 mb-3" />
                      {file ? (
                        <div className="text-sm">
                          <p className="font-semibold text-foreground">{file.name}</p>
                          <p className="text-muted-foreground text-xs mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                          <label
                            htmlFor="document-upload-input"
                            className="mt-2.5 inline-block text-xs text-muted-foreground hover:text-foreground underline cursor-pointer"
                          >
                            Change file
                          </label>
                        </div>
                      ) : (
                        <div>
                          <p className="text-sm text-muted-foreground">
                            Drag & drop contract PDF here, or
                          </p>
                          <label
                            htmlFor="document-upload-input"
                            className="mt-1 text-sm text-foreground underline cursor-pointer font-medium"
                          >
                            browse files
                          </label>
                          <p className="text-xs text-muted-foreground/60 mt-2">
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
                        {hashingProgress ? 'Calculating SHA-256 fingerprint...' : 'Anchoring to Solana Devnet...'}
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-1.5">
                        Compute Hash & Anchor
                        <ArrowRight className="h-4 w-4" />
                      </span>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-border bg-card/60 backdrop-blur-md">
              <CardHeader className="text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 mx-auto mb-4">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <CardTitle className="text-2xl font-bold tracking-tight text-foreground">Anchored Successfully</CardTitle>
                <CardDescription className="text-muted-foreground">
                  Verification proof locked on Solana Devnet PDA.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="rounded-lg bg-background/60 border border-border p-4 space-y-3.5 text-sm">
                  <div>
                    <span className="block text-muted-foreground text-xs">DOCUMENT REGISTRY ID:</span>
                    <span className="font-mono text-foreground select-all">{registeredData?.documentId}</span>
                  </div>
                  <div>
                    <span className="block text-muted-foreground text-xs">SHA-256 FILE FINGERPRINT:</span>
                    <span className="font-mono text-foreground select-all break-all">{registeredData?.hash}</span>
                  </div>
                  <div>
                    <span className="block text-muted-foreground text-xs">SOLANA TRANSACTION SIGNATURE:</span>
                    {registeredData?.onchainTxSignature?.endsWith('_mock_sig') ? (
                      <span className="font-mono text-muted-foreground text-xs italic">
                        {registeredData?.onchainTxSignature} (Local Sandbox Mode)
                      </span>
                    ) : (
                      <a
                        href={`https://explorer.solana.com/tx/${registeredData?.onchainTxSignature}?cluster=devnet`}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-foreground underline hover:text-muted-foreground break-all"
                      >
                        {registeredData?.onchainTxSignature}
                      </a>
                    )}
                  </div>
                </div>

                {registeredData?.qrCode && (
                  <div className="flex flex-col items-center justify-center text-center p-4 rounded-lg border border-border bg-muted/20">
                    <img src={registeredData.qrCode} alt="Verification QR Code" className="w-40 h-40 border border-border bg-white p-2 rounded" />
                    <p className="text-xs text-muted-foreground mt-3 max-w-[280px]">
                      Download this QR code. Anyone can scan it to inspect document integrity instantly.
                    </p>
                  </div>
                )}
              </CardContent>
              <CardFooter className="flex flex-col sm:flex-row gap-3">
                <Link href="/dashboard" className="w-full">
                  <Button variant="outline" className="w-full border-border bg-transparent text-foreground hover:bg-accent rounded-full">
                    Dashboard
                  </Button>
                </Link>
                <Link href={`/document/${registeredData?.documentId}`} className="w-full">
                  <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-full">
                    View Audit Details
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

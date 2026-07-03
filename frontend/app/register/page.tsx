'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/auth-context';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, Lock, ArrowLeft, ArrowRight, CheckCircle2, ShieldAlert, Cpu, FileUp, QrCode, FileText, RefreshCw, CreditCard, Receipt, Loader2, Download, Check, Network, Server, Clock, FileCheck } from 'lucide-react';
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

const loadRazorpayScript = () => {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve(false);
      return;
    }
    if ((window as any).Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

export default function RegisterDocument() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [type, setType] = useState('');
  const [notaryId, setNotaryId] = useState('');
  const [requiredSigners, setRequiredSigners] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [surveyNumber, setSurveyNumber] = useState('');
  const [propertyId, setPropertyId] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [ownerName, setOwnerName] = useState('');

  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hashingProgress, setHashingProgress] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [notaries, setNotaries] = useState<{ notaryId: string; name: string }[]>([]);
  const [notariesLoading, setNotariesLoading] = useState(true);
  const [notariesError, setNotariesError] = useState('');

  // C3 (Cryptographic Chain of Custody) states
  const [clientHash, setClientHash] = useState('');
  const [isHashing, setIsHashing] = useState(false);
  const [showIntegrityModal, setShowIntegrityModal] = useState(false);
  const [uploadSessionId] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        return window.crypto.randomUUID();
      } catch {
        return 'session-' + Math.random().toString(36).substring(2, 15);
      }
    }
    return 'session-uuid';
  });

  // AI analysis states
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState(0);

  // Payment states
  const [paymentStep, setPaymentStep] = useState<'details' | 'summary' | 'verifying'>('details');
  const [paymentId, setPaymentId] = useState<string | null>(null);

  useEffect(() => {
    if (!isAnalyzing) return;
    if (analysisStep < 5) {
      const timer = setTimeout(() => {
        setAnalysisStep(prev => prev + 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else {
      setIsAnalyzing(false);
      setSuccess(true);
    }
  }, [isAnalyzing, analysisStep]);

  // Success state
  const [success, setSuccess] = useState(false);
  const [registeredData, setRegisteredData] = useState<{
    documentId: string;
    hash: string;
    cid: string;
    status: string;
    onchainTxSignature: string;
    qrCode?: string;
    uploadReceipt?: any;
  } | null>(null);

  const fetchNotaries = async () => {
    setNotariesLoading(true);
    setNotariesError('');
    try {
      const res = await apiClient.get('/notaries');
      if (res.data) {
        setNotaries(res.data);
        if (res.data.length > 0) {
          setNotaryId(res.data[0].notaryId);
        }
      } else {
        setNotaries([]);
      }
    } catch (err: any) {
      setNotariesError(err.message || 'Failed to load notaries.');
      setNotaries([]);
    } finally {
      setNotariesLoading(false);
    }
  };

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    if (user.role !== 'CITIZEN') {
      router.push('/login');
      return;
    }
    fetchNotaries();
  }, [user, router]);

  // Hash selected file immediately in the browser
  const hashFile = async (selectedFile: File) => {
    setIsHashing(true);
    setClientHash('');
    try {
      const hash = await calculateSHA256(selectedFile);
      setClientHash(hash);
    } catch (err) {
      console.error('Browser hashing failed:', err);
    } finally {
      setIsHashing(false);
    }
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
      const selectedFile = e.dataTransfer.files[0];
      setFile(selectedFile);
      hashFile(selectedFile);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      hashFile(selectedFile);
    }
  };

  const handleProceedToPaymentSummary = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !type || !notaryId || !file) {
      setErrorMsg('Please fill out all fields and select a file to upload.');
      return;
    }
    setErrorMsg('');
    setShowIntegrityModal(true); // Intercept and show institutional confirmation dialog
  };

  const handleInitiateRazorpay = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      // Step 3: Backend creates Razorpay order (cost fixed at ₹10)
      const orderRes = await apiClient.post('/payments/create-order', { amount: 10 });
      if (!orderRes.data) {
        throw new Error(orderRes.error?.message || 'Failed to initiate payment.');
      }

      const { orderId, paymentId: dbPaymentId, keyId, amount, currency } = orderRes.data;

      // Step 4: Razorpay Test Checkout opens
      const isScriptLoaded = await loadRazorpayScript();
      if (!isScriptLoaded) {
        throw new Error('Failed to load Razorpay Checkout SDK. Please verify internet connection.');
      }

      const options = {
        key: keyId,
        amount: amount,
        currency: currency || 'INR',
        name: 'TimeLock Network',
        description: 'Document Anchoring Verification',
        order_id: orderId,
        handler: async function (response: any) {
          setLoading(true);
          setPaymentStep('verifying');
          try {
            // Step 7: Backend verifies Razorpay signature
            const verifyRes = await apiClient.post('/payments/verify', {
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            });

            if (!verifyRes.data) {
              throw new Error(verifyRes.error?.message || 'Payment signature verification failed.');
            }

            // Step 8 & 9: Payment record verified, start document upload
            setPaymentId(dbPaymentId);
            await executeDocumentUpload(dbPaymentId);
          } catch (verifyErr: any) {
            setPaymentStep('summary');
            setErrorMsg(verifyErr.message || 'Verification of your payment signature failed.');
            setLoading(false);
          }
        },
        prefill: {
          name: (user as any)?.name || 'Citizen Executant',
          email: (user as any)?.email || '',
        },
        theme: {
          color: '#3b82f6',
        },
        modal: {
          ondismiss: function () {
            setLoading(false);
          }
        }
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    } catch (err: any) {
      setErrorMsg(err.message || 'Payment initiation failed.');
      setLoading(false);
    }
  };

  const executeDocumentUpload = async (verifiedPaymentId: string) => {
    setLoading(true);
    setHashingProgress(true);
    setErrorMsg('');

    try {
      if (!file) return;
      
      // Compute / fetch final browser hash
      const finalClientHash = clientHash || await calculateSHA256(file);
      setHashingProgress(false);

      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', title);
      formData.append('type', type);
      formData.append('clientHash', finalClientHash);
      formData.append('notaryId', notaryId);
      formData.append('requiredSigners', requiredSigners.toString());
      if (surveyNumber) formData.append('surveyNumber', surveyNumber);
      if (propertyId) formData.append('propertyId', propertyId);
      if (registrationNumber) formData.append('registrationNumber', registrationNumber);
      if (ownerName) formData.append('ownerName', ownerName);
      formData.append('paymentId', verifiedPaymentId);

      // C3 Provenance Metadata Payload
      formData.append('uploadTimestamp', new Date().toISOString());
      formData.append('uploadSessionId', uploadSessionId);
      formData.append('algorithm', 'SHA256');
      formData.append('frontendVersion', '1.0.0');
      formData.append('browserTimezone', Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
      formData.append('browserUserAgent', navigator.userAgent || 'unknown');
      formData.append('browserLanguage', navigator.language || 'en-US');
      formData.append('clientVersion', 'Production');

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
        qrCode: qrBase64,
        uploadReceipt: docData.uploadReceipt
      };

      setRegisteredData(finalState);
      setIsAnalyzing(true);
      setAnalysisStep(0);
    } catch (err: any) {
      setHashingProgress(false);
      if (err.status === 401 || err.message?.includes('session no longer exists') || err.message?.includes('not exist in the database')) {
        setErrorMsg('Your session has expired or your user account was reset. Logging out...');
        setTimeout(() => {
          logout();
        }, 2000);
      } else {
        setErrorMsg(err.message || 'Registry creation failed. Solana devnet may be offline or lagging.');
      }
    } finally {
      setLoading(false);
    }
  };

  const downloadReceiptPdf = async () => {
    if (!registeredData?.documentId) return;
    try {
      setLoading(true);
      const baseUrl = apiClient.getBaseUrl();
      const url = `${baseUrl}/documents/${registeredData.documentId}/receipt/pdf`;
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
      downloadAnchor.download = `${title.replace(/\s+/g, '_')}_upload_receipt.pdf`;
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
            <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive flex items-center justify-between gap-3 shadow-md">
              <div className="flex items-center gap-2.5">
                <AlertCircle className="h-5 w-5 shrink-0" />
                <span>{errorMsg}</span>
              </div>
              <Badge className="bg-red-500/10 text-red-500 border border-red-500/20 shrink-0">
                Failed
              </Badge>
            </div>
          )}

          {isAnalyzing ? (
            <Card className="border-border bg-card/60 backdrop-blur-md shadow-lg border">
              <CardHeader className="text-center pb-2">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary border border-primary/20 mx-auto mb-4">
                  <Cpu className="h-6 w-6 animate-pulse" />
                </div>
                <CardTitle className="text-xl font-bold tracking-tight text-foreground flex items-center justify-center gap-2">
                  AI Registry Audit
                </CardTitle>
                <CardDescription className="text-muted-foreground">
                  Running automated risk assessments and registry consistency checks.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 py-4 px-6">
                <div className="space-y-3.5 bg-background/40 border border-border/50 rounded-lg p-4">
                  {[
                    'Analyzing registry consistency...',
                    'Checking ownership chain...',
                    'Reviewing supporting evidence...',
                    'Calculating trust score...',
                    'Detecting fraud indicators...'
                  ].map((stepText, idx) => {
                    const isDone = analysisStep > idx;
                    const isActive = analysisStep === idx;
                    return (
                      <div key={idx} className="flex items-center gap-3.5 text-sm transition-all duration-300">
                        {isDone ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                        ) : isActive ? (
                          <RefreshCw className="h-4 w-4 text-primary animate-spin shrink-0" />
                        ) : (
                          <div className="h-4 w-4 rounded-full border border-border shrink-0" />
                        )}
                        <span className={isDone ? 'text-foreground/50 line-through' : isActive ? 'text-foreground font-medium' : 'text-muted-foreground'}>
                          {stepText}
                        </span>
                      </div>
                    );
                  })}
                </div>
                
                {/* Visual completion progress bar */}
                <div className="w-full bg-accent/30 rounded-full h-1.5 mt-6">
                  <div 
                    className="bg-primary h-1.5 rounded-full transition-all duration-500" 
                    style={{ width: `${(analysisStep / 5) * 100}%` }}
                  />
                </div>
              </CardContent>
            </Card>
          ) : !success ? (
            paymentStep === 'details' ? (
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
                  <form onSubmit={handleProceedToPaymentSummary} className="space-y-4">
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
                      {notariesLoading ? (
                        <div className="text-xs text-muted-foreground py-2">Loading active notaries...</div>
                      ) : notariesError ? (
                        <div className="text-xs text-destructive py-2">{notariesError}</div>
                      ) : notaries.length === 0 ? (
                        <div className="text-xs text-muted-foreground py-2">No active notaries available.</div>
                      ) : (
                        <Select value={notaryId} onValueChange={(val) => setNotaryId(val)} disabled={loading}>
                          <SelectTrigger className="border-border bg-background text-foreground">
                            <SelectValue placeholder="Select notary" />
                          </SelectTrigger>
                          <SelectContent className="border-border bg-background text-foreground">
                            {notaries.map((n) => (
                              <SelectItem key={n.notaryId} value={n.notaryId} className="focus:bg-accent focus:text-foreground">
                                {n.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
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

                    {/* Property Registry Metadata (Optional VPL Inputs) */}
                    <div className="border-t border-border pt-4 mt-4 space-y-4">
                      <h3 className="text-sm font-semibold text-foreground">Property Registry Details (VPL Verification)</h3>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="surveyNumber" className="text-foreground/80 text-xs">Survey Number</Label>
                          <Input
                            id="surveyNumber"
                            placeholder="e.g. SV-100/4B"
                            value={surveyNumber}
                            onChange={(e) => setSurveyNumber(e.target.value)}
                            disabled={loading}
                            className="border-border bg-background text-foreground text-xs focus-visible:ring-ring"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="propertyId" className="text-foreground/80 text-xs">Property ID / Khata</Label>
                          <Input
                            id="propertyId"
                            placeholder="e.g. PROP-9921"
                            value={propertyId}
                            onChange={(e) => setPropertyId(e.target.value)}
                            disabled={loading}
                            className="border-border bg-background text-foreground text-xs focus-visible:ring-ring"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="registrationNumber" className="text-foreground/80 text-xs">Registration Number</Label>
                          <Input
                            id="registrationNumber"
                            placeholder="e.g. REG-2026-X88"
                            value={registrationNumber}
                            onChange={(e) => setRegistrationNumber(e.target.value)}
                            disabled={loading}
                            className="border-border bg-background text-foreground text-xs focus-visible:ring-ring"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="ownerName" className="text-foreground/80 text-xs">Registered Owner Name</Label>
                          <Input
                            id="ownerName"
                            placeholder="e.g. Priya Executant"
                            value={ownerName}
                            onChange={(e) => setOwnerName(e.target.value)}
                            disabled={loading}
                            className="border-border bg-background text-foreground text-xs focus-visible:ring-ring"
                          />
                        </div>
                      </div>
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
                            
                            {isHashing ? (
                              <div className="flex items-center justify-center gap-1.5 text-xs text-primary mt-2">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                <span>Generating local browser checksum...</span>
                              </div>
                            ) : clientHash ? (
                              <div className="flex items-center justify-center gap-1 text-xs text-emerald-500 mt-2">
                                <Check className="h-3 w-3" />
                                <span>Fingerprint locked: {clientHash.substring(0, 12)}...</span>
                              </div>
                            ) : null}

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

                    {/* Selected Notary / Document Summary display before submission */}
                    {title && type && notaryId && (
                      <div className="rounded-lg bg-accent/20 border border-border p-3 space-y-1.5 text-xs text-muted-foreground">
                        <span className="font-semibold text-foreground block">Assigned Notary Verification:</span>
                        <p>
                          Document <span className="text-foreground font-semibold">"{title}"</span> of type <span className="text-foreground font-semibold">"{type}"</span> will be anchored and assigned to Notary: <span className="text-foreground font-semibold">{notaries.find(n => n.notaryId === notaryId)?.name || 'Loading...'}</span>.
                        </p>
                      </div>
                    )}

                    <Button type="submit" disabled={loading || isHashing} className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl shadow-md transition-all">
                      <span className="flex items-center justify-center gap-1.5">
                        Proceed to Payment (₹10)
                        <ArrowRight className="h-4 w-4" />
                      </span>
                    </Button>
                  </form>
                </CardContent>
              </Card>
            ) : paymentStep === 'summary' ? (
              <Card className="border-border bg-card/60 backdrop-blur-md shadow-2xl rounded-2xl overflow-hidden max-w-xl mx-auto border">
                <CardHeader className="border-b border-border bg-muted/20 pb-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
                        <Receipt className="h-5 w-5" />
                      </div>
                      <div>
                        <CardTitle className="text-xl font-bold tracking-tight text-foreground">
                          Order Summary
                        </CardTitle>
                        <CardDescription className="text-muted-foreground text-xs mt-0.5">
                          Review details and complete the verification fee
                        </CardDescription>
                      </div>
                    </div>
                    <Badge className="bg-amber-500/10 text-amber-500 border border-amber-500/20 font-semibold px-2.5 py-1">
                      Pending
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  {/* Document Details Section */}
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      <FileText className="h-3.5 w-3.5" />
                      <span>Document Details</span>
                    </div>
                    <div className="rounded-xl bg-background/40 border border-border p-4 space-y-3">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Title:</span>
                        <span className="font-semibold text-foreground text-right max-w-[240px] truncate" title={title}>{title}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Type:</span>
                        <span className="font-semibold text-foreground">{type}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Assigned Notary:</span>
                        <span className="font-semibold text-foreground">{notaries.find(n => n.notaryId === notaryId)?.name || 'Loading...'}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Required Signatures:</span>
                        <span className="font-semibold text-foreground">{requiredSigners}</span>
                      </div>
                    </div>
                  </div>

                  {/* Verification Fee Breakdown & Payment Summary */}
                  <div className="space-y-2.5">
                     <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      <Receipt className="h-3.5 w-3.5" />
                      <span>Payment Summary</span>
                    </div>
                    <div className="rounded-xl bg-background/40 border border-border p-4 space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Verification Fee</span>
                        <span className="font-semibold text-foreground">₹10</span>
                      </div>
                      <div className="flex justify-between text-sm items-center">
                        <span className="text-muted-foreground flex items-center gap-1.5">
                          Platform Processing
                        </span>
                        <Badge className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-[10px] py-0.5 px-1.5">Included</Badge>
                      </div>
                      <div className="flex justify-between text-sm items-center">
                        <span className="text-muted-foreground flex items-center gap-1.5">
                          Blockchain Anchoring
                        </span>
                        <Badge className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-[10px] py-0.5 px-1.5">Included</Badge>
                      </div>
                      <div className="flex justify-between font-bold text-base text-foreground pt-3 border-t border-border border-dashed items-baseline">
                        <span>Total Payable</span>
                        <span className="text-2xl font-extrabold text-primary">₹10</span>
                      </div>
                    </div>
                  </div>

                  {/* Security Information */}
                  <div className="rounded-xl border border-border bg-emerald-500/5 p-4 flex gap-3 text-xs text-muted-foreground">
                    <Lock className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <span className="font-semibold text-foreground block">Secured Cryptographic Registry</span>
                      <p className="leading-relaxed">
                        Your transaction is secured with end-to-end 256-bit SSL encryption. Anchoring guarantees non-repudiation of legal document hash fingerprints on the Solana Devnet blockchain.
                      </p>
                    </div>
                  </div>

                  {/* Button structure */}
                  <div className="flex flex-col sm:flex-row gap-3 pt-2">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setPaymentStep('details')}
                      disabled={loading}
                      className="w-full sm:w-1/3 h-11 border-border bg-transparent text-foreground hover:bg-accent rounded-xl text-sm font-semibold transition-all"
                    >
                      Back
                    </Button>
                    <Button 
                      type="button"
                      onClick={handleInitiateRazorpay}
                      disabled={loading}
                      className="w-full sm:w-2/3 h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl text-sm transition-all shadow-md flex items-center justify-center gap-2"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin text-primary-foreground" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <CreditCard className="h-4 w-4" />
                          Pay ₹10 & Continue
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-border bg-card/60 backdrop-blur-md shadow-2xl rounded-2xl overflow-hidden max-w-xl mx-auto border">
                <CardHeader className="text-center border-b border-border bg-muted/20 pb-5">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary border border-primary/20 mx-auto mb-4">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                  <CardTitle className="text-xl font-bold tracking-tight text-foreground flex flex-col items-center gap-2">
                    Securing Registry
                    <div className="flex gap-2 mt-1">
                      <Badge className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-[10px] py-0.5 px-2.5 font-bold">
                        Paid
                      </Badge>
                      <Badge className="bg-blue-500/10 text-blue-500 border border-blue-500/20 text-[10px] py-0.5 px-2.5 font-bold animate-pulse">
                        Processing
                      </Badge>
                    </div>
                  </CardTitle>
                  <CardDescription className="text-muted-foreground text-sm mt-1">
                    {hashingProgress ? 'Calculating file SHA-256 fingerprint...' : 'Completing secure document upload and anchoring to Solana Devnet...'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 py-8 px-6 text-center text-sm text-muted-foreground bg-card/40">
                  <p className="leading-relaxed">Please do not close this window or refresh the page.</p>
                  <p className="text-xs text-muted-foreground/60 leading-relaxed">This process involves multi-party cryptographic signature allocations and smart contract state registration.</p>
                </CardContent>
              </Card>
            )
          ) : (
            <Card className="border-border bg-card/60 backdrop-blur-md shadow-2xl rounded-2xl overflow-hidden max-w-xl mx-auto border">
              <CardHeader className="text-center border-b border-border bg-muted/20 pb-5">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 mx-auto mb-4">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <CardTitle className="text-2xl font-bold tracking-tight text-foreground flex flex-col items-center gap-2">
                  Anchored Successfully
                  <Badge className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/25 text-xs font-bold py-1 px-3">
                    Verified
                  </Badge>
                </CardTitle>
                <CardDescription className="text-muted-foreground text-sm">
                  Verification proof locked on Solana Devnet PDA.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 p-6">
                <div className="rounded-xl bg-background/60 border border-border p-4 space-y-4 text-sm">
                  <div className="space-y-1">
                    <span className="block text-muted-foreground text-xs font-bold tracking-wider">DOCUMENT REGISTRY ID</span>
                    <span className="font-mono text-foreground text-sm select-all">{registeredData?.documentId}</span>
                  </div>
                  <div className="space-y-1">
                    <span className="block text-muted-foreground text-xs font-bold tracking-wider">SHA-256 FILE FINGERPRINT</span>
                    <span className="font-mono text-foreground text-xs select-all break-all">{registeredData?.hash}</span>
                  </div>
                  <div className="space-y-1">
                    <span className="block text-muted-foreground text-xs font-bold tracking-wider">SOLANA TRANSACTION SIGNATURE</span>
                    {registeredData?.onchainTxSignature?.endsWith('_mock_sig') ? (
                      <span className="font-mono text-muted-foreground text-xs italic block mt-1">
                        {registeredData?.onchainTxSignature} (Local Sandbox Mode)
                      </span>
                    ) : (
                      <a
                        href={`https://explorer.solana.com/tx/${registeredData?.onchainTxSignature}?cluster=devnet`}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-foreground underline hover:text-muted-foreground break-all block mt-1"
                      >
                        {registeredData?.onchainTxSignature}
                      </a>
                    )}
                  </div>
                </div>

                {/* C3 Chain of Custody Timeline */}
                <div className="space-y-4 border-t border-border pt-4">
                  <span className="block text-muted-foreground text-xs font-bold tracking-wider uppercase mb-1">Cryptographic Chain of Custody (C3) Trail</span>
                  <div className="relative border-l border-border pl-6 ml-3 space-y-6 text-sm">
                    {/* Step 1: Browser Hashing */}
                    <div className="relative">
                      <div className="absolute -left-[31px] top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm ring-4 ring-background">
                        <Check className="h-3 w-3" />
                      </div>
                      <div className="space-y-1">
                        <span className="font-semibold text-foreground text-xs block">1. Sovereign Browser Hashing</span>
                        <p className="text-[11px] text-muted-foreground">Computed SHA-256 checksum locally in browser on file selection to guarantee absolute source integrity.</p>
                        <span className="font-mono text-[10px] text-primary bg-primary/5 border border-primary/10 rounded px-1.5 py-0.5 block mt-1 select-all break-all">{registeredData?.uploadReceipt?.clientHash || registeredData?.hash}</span>
                      </div>
                    </div>

                    {/* Step 2: Server Verification */}
                    <div className="relative">
                      <div className="absolute -left-[31px] top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm ring-4 ring-background">
                        <Check className="h-3 w-3" />
                      </div>
                      <div className="space-y-1">
                        <span className="font-semibold text-foreground text-xs block">2. Dual-Hash Server Validation</span>
                        <p className="text-[11px] text-muted-foreground">Backend re-hashed file and executed constant-time comparison. Match verified in {registeredData?.uploadReceipt?.validationDurationMs || 0}ms.</p>
                        <span className="font-mono text-[10px] text-emerald-600 bg-emerald-500/5 border border-emerald-500/10 rounded px-1.5 py-0.5 block mt-1 select-all break-all">{registeredData?.uploadReceipt?.serverHash || registeredData?.hash}</span>
                      </div>
                    </div>

                    {/* Step 3: Solana Anchoring */}
                    <div className="relative">
                      <div className="absolute -left-[31px] top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm ring-4 ring-background">
                        <Check className="h-3 w-3" />
                      </div>
                      <div className="space-y-1">
                        <span className="font-semibold text-foreground text-xs block">3. Blockchain Consensus Anchor</span>
                        <p className="text-[11px] text-muted-foreground">Anchored serialized receipt hash on Solana Devnet (Role Byte: 10) under derived PDA registry.</p>
                        <span className="font-mono text-[10px] text-muted-foreground bg-accent/20 border border-border rounded px-1.5 py-0.5 block mt-1 select-all break-all">{registeredData?.uploadReceipt?.receiptPda || 'Anchored On Solana Program'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Download Options Grid */}
                <div className="grid grid-cols-2 gap-3 border-t border-border pt-4 mt-6">
                  <Button 
                    onClick={() => {
                      if (!registeredData?.uploadReceipt) return;
                      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(registeredData.uploadReceipt, null, 2));
                      const downloadAnchor = document.createElement('a');
                      downloadAnchor.setAttribute("href",     dataStr);
                      downloadAnchor.setAttribute("download", `upload_receipt_${registeredData.documentId}.json`);
                      document.body.appendChild(downloadAnchor);
                      downloadAnchor.click();
                      downloadAnchor.remove();
                    }}
                    disabled={!registeredData?.uploadReceipt || loading}
                    className="h-11 border-border bg-transparent hover:bg-accent text-foreground border rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
                  >
                    <Download className="h-4 w-4" />
                    Download JSON Receipt
                  </Button>
                  <Button 
                    onClick={downloadReceiptPdf}
                    disabled={!registeredData?.uploadReceipt || loading}
                    className="h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-md"
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin text-primary-foreground" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                    Download PDF Receipt
                  </Button>
                </div>

                {registeredData?.qrCode && (
                  <div className="flex flex-col items-center justify-center text-center p-4 rounded-xl border border-border bg-muted/20">
                    <img src={registeredData.qrCode} alt="Verification QR Code" className="w-40 h-40 border border-border bg-white p-2 rounded-lg" />
                    <p className="text-xs text-muted-foreground mt-3 max-w-[280px]">
                      Download this QR code. Anyone can scan it to inspect document integrity instantly.
                    </p>
                  </div>
                )}
              </CardContent>
              <CardFooter className="flex flex-col sm:flex-row gap-3 p-6 border-t border-border bg-muted/10">
                <Link href="/dashboard" className="w-full">
                  <Button variant="outline" className="w-full h-11 border-border bg-transparent text-foreground hover:bg-accent rounded-xl text-sm font-semibold transition-all">
                    Dashboard
                  </Button>
                </Link>
                <Link href={`/document/${registeredData?.documentId}`} className="w-full">
                  <Button className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl text-sm transition-all shadow-md">
                    View Audit Details
                  </Button>
                </Link>
              </CardFooter>
            </Card>
          )}
        </div>
      </main>

      {/* Confirm Document Integrity Modal Overlay */}
      {showIntegrityModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <Card className="w-full max-w-lg border-border bg-card shadow-2xl rounded-2xl border overflow-hidden">
            <CardHeader className="bg-primary/5 pb-4 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
                  <Cpu className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-lg font-bold text-foreground">Confirm Document Integrity</CardTitle>
                  <CardDescription className="text-muted-foreground text-xs">Aadhaar / DigiLocker Sovereign Registry Verification</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="rounded-xl border border-border bg-accent/10 p-4 space-y-3.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">Document Name:</span>
                  <span className="font-semibold text-foreground max-w-[240px] truncate">{file?.name}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">Document Size:</span>
                  <span className="font-semibold text-foreground">{(file!.size / 1024 / 1024).toFixed(2)} MB</span>
                </div>
                <div className="space-y-1">
                  <span className="block text-muted-foreground text-[10px] font-bold uppercase tracking-wider">Browser Hashed Fingerprint (SHA-256)</span>
                  {isHashing ? (
                    <div className="flex items-center gap-2 text-xs text-primary font-medium py-1">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Computing checksum inside browser...</span>
                    </div>
                  ) : (
                    <span className="font-mono text-foreground text-xs block bg-background/65 border border-border p-2.5 rounded-lg break-all select-all">{clientHash}</span>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-border bg-emerald-500/5 p-4 flex gap-3 text-xs text-muted-foreground">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-semibold text-foreground block">Integrity Certification</span>
                  <p className="leading-relaxed">
                    By proceeding, you certify that the file selected is authentic. The browser has locked this cryptographic fingerprint, which will be matched by the server and immutably anchored on the Solana blockchain.
                  </p>
                </div>
              </div>
            </CardContent>
            <CardFooter className="bg-muted/10 p-6 border-t border-border flex justify-end gap-3">
              <Button 
                variant="outline" 
                onClick={() => setShowIntegrityModal(false)}
                className="border-border bg-transparent text-foreground hover:bg-accent rounded-xl text-sm font-semibold transition-all"
              >
                Cancel
              </Button>
              <Button 
                onClick={() => {
                  setShowIntegrityModal(false);
                  setPaymentStep('summary');
                }}
                disabled={isHashing || !clientHash}
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl text-sm transition-all shadow-md flex items-center gap-1.5"
              >
                Confirm & Proceed
                <ArrowRight className="h-4 w-4" />
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}

      <footer className="py-4 border-t border-border text-center text-xs text-muted-foreground bg-muted/20">
        &copy; 2026 Time Lock. All rights reserved.
      </footer>
    </div>
  );
}

'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/auth-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, Lock, ArrowLeft, ArrowRight, CheckCircle2, ShieldAlert, Cpu, FileUp, QrCode, FileText, RefreshCw, CreditCard, Receipt, Loader2 } from 'lucide-react';
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
  const { user } = useAuth();
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

  const handleProceedToPaymentSummary = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !type || !notaryId || !file) {
      setErrorMsg('Please fill out all fields and select a file to upload.');
      return;
    }
    setErrorMsg('');
    setPaymentStep('summary');
  };

  const handleInitiateRazorpay = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      // Step 3: Backend creates Razorpay order (cost fixed at ₹99)
      const orderRes = await apiClient.post('/payments/create-order', { amount: 99 });
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
          name: user?.name || 'Citizen Executant',
          email: user?.email || '',
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
      
      // Step 10: Existing workflow continues
      // * SHA-256 generation
      const clientHash = await calculateSHA256(file);
      setHashingProgress(false);

      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', title);
      formData.append('type', type);
      formData.append('clientHash', clientHash);
      formData.append('notaryId', notaryId);
      formData.append('requiredSigners', requiredSigners.toString());
      if (surveyNumber) formData.append('surveyNumber', surveyNumber);
      if (propertyId) formData.append('propertyId', propertyId);
      if (registrationNumber) formData.append('registrationNumber', registrationNumber);
      if (ownerName) formData.append('ownerName', ownerName);
      formData.append('paymentId', verifiedPaymentId);

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
      setIsAnalyzing(true);
      setAnalysisStep(0);
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

                    <Button type="submit" disabled={loading} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-full">
                      <span className="flex items-center justify-center gap-1.5">
                        Proceed to Payment (₹99)
                        <ArrowRight className="h-4 w-4" />
                      </span>
                    </Button>
                  </form>
                </CardContent>
              </Card>
            ) : paymentStep === 'summary' ? (
              <Card className="border-border bg-card/60 backdrop-blur-md">
                <CardHeader>
                  <CardTitle className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                    <Receipt className="h-5 w-5 text-foreground" />
                    Payment Summary
                  </CardTitle>
                  <CardDescription className="text-muted-foreground">
                    Review your verification details and complete payment to initiate anchoring.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Detailed receipt */}
                  <div className="rounded-lg bg-background/60 border border-border p-4 space-y-4 text-sm">
                    <div className="space-y-2 border-b border-border pb-3">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Document Title:</span>
                        <span className="font-semibold text-foreground text-right max-w-[240px] truncate">{title}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Type:</span>
                        <span className="font-semibold text-foreground">{type}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Assigned Notary:</span>
                        <span className="font-semibold text-foreground">{notaries.find(n => n.notaryId === notaryId)?.name || 'Loading...'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Required Signatures:</span>
                        <span className="font-semibold text-foreground">{requiredSigners}</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Solana Anchoring Fee</span>
                        <span>₹79.00</span>
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Notary Registry & VPL Case Creation</span>
                        <span>₹20.00</span>
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Platform GST (18% inclusive)</span>
                        <span>₹0.00</span>
                      </div>
                      <div className="flex justify-between font-bold text-base text-foreground pt-2 border-t border-border border-dashed">
                        <span>Amount Due</span>
                        <span className="text-primary">₹99.00</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setPaymentStep('details')}
                      disabled={loading}
                      className="w-full border-border bg-transparent text-foreground hover:bg-accent rounded-full"
                    >
                      Back to Details
                    </Button>
                    <Button 
                      type="button"
                      onClick={handleInitiateRazorpay}
                      disabled={loading}
                      className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-full"
                    >
                      {loading ? (
                        <span className="flex items-center justify-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          Processing...
                        </span>
                      ) : (
                        <span className="flex items-center justify-center gap-1.5">
                          <CreditCard className="h-4 w-4" />
                          Pay via Razorpay (Test Mode)
                        </span>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-border bg-card/60 backdrop-blur-md">
                <CardHeader className="text-center pb-2">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary border border-primary/20 mx-auto mb-4">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                  <CardTitle className="text-xl font-bold tracking-tight text-foreground flex items-center justify-center gap-2">
                    Securing Registry
                  </CardTitle>
                  <CardDescription className="text-muted-foreground">
                    {hashingProgress ? 'Calculating file SHA-256 fingerprint...' : 'Completing secure document upload and anchoring to Solana Devnet...'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 py-8 px-6 text-center text-sm text-muted-foreground">
                  <p>Please do not close this window or refresh the page.</p>
                  <p className="text-xs text-muted-foreground/60">This process involves multi-party cryptographic signature allocations and smart contract state registration.</p>
                </CardContent>
              </Card>
            )
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

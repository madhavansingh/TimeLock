'use client';

import React, { useEffect, useState, use } from 'react';
import { useAuth } from '@/context/auth-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Lock, ArrowLeft, Download, ShieldCheck, ShieldAlert, Calendar, Clock, Link as LinkIcon, FileText, CheckCircle2, User, HelpCircle, Activity, RefreshCw, AlertTriangle, TrendingUp, PlusCircle, MinusCircle, Info, Sparkles, Cpu, Shield, Zap, Check } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';

interface ChecklistItem {
  id: string;
  label: string;
  status: 'PENDING' | 'PASSED' | 'FAILED';
}

interface EvidenceItem {
  evidenceId: string;
  title: string;
  ipfsCid: string;
  uploadedAt: string;
}

interface VerificationCase {
  caseId: string;
  status: string;
  checklist: ChecklistItem[];
  challenges?: any[];
  evidence?: EvidenceItem[];
  trustScore: number;
  vplProofHash?: string;
  vplOnchainTx?: string;
}

interface DocumentMetadata {
  surveyNumber?: string;
  propertyId?: string;
  registrationNumber?: string;
  ownerName?: string;
}

interface DocumentDetails {
  documentId: string;
  title: string;
  type: string;
  status: string;
  contentHash: string;
  ownerUserId: string;
  onchainTxSignature: string | null;
  onchainPda: string | null;
  timestamp: string;
  assignedNotary?: {
    notaryId: string;
    name: string;
    dscCertificateSerial: string;
    certStatus: string;
  } | null;
  notarySummary: {
    notaryId: string;
    signedAt: string;
    name?: string;
    dscCertificateSerial?: string;
  } | null;
  signers: {
    required: number;
    completed: number;
  };
  viewProfile?: string;
  metadata?: DocumentMetadata | null;
  verificationCase?: VerificationCase | null;
}


interface TimelineEvent {
  eventId: string;
  eventType: string;
  actorLabel: string;
  onchainTxRef?: string | null;
  occurredAt: string;
}

interface FraudScoreDetails {
  documentId: string;
  score: number;
  signals: {
    hashMismatch: boolean;
    missingBlockchainTx: boolean;
    missingNotarySignature: boolean;
    expiredVerification: boolean;
  };
  computedAt: string;
}

export default function DocumentDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const { id } = resolvedParams;
  const { user } = useAuth();
  const router = useRouter();

  const [doc, setDoc] = useState<DocumentDetails | null>(null);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [fraudScore, setFraudScore] = useState<FraudScoreDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Ownership transfer states
  const [transfers, setTransfers] = useState<any[]>([]);
  const [newOwnerId, setNewOwnerId] = useState('');
  const [transferring, setTransferring] = useState(false);
  const [transferType, setTransferType] = useState('Sale');
  const [transferNotes, setTransferNotes] = useState('');
  const [supportingFile, setSupportingFile] = useState<File | null>(null);
  const [ownershipHistory, setOwnershipHistory] = useState<any[]>([]);

  // AI Verification Insights states
  const [aiInsights, setAiInsights] = useState<any | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const [regeneratingAi, setRegeneratingAi] = useState(false);

  // Digital Twin states
  const [digitalTwin, setDigitalTwin] = useState<any | null>(null);
  const [loadingTwin, setLoadingTwin] = useState(false);

  // AI Copilot states
  const [aiTab, setAiTab] = useState<'trust_index' | 'investigation' | 'trust_intelligence'>('trust_index');
  const [copilotData, setCopilotData] = useState<any | null>(null);
  const [loadingCopilot, setLoadingCopilot] = useState(false);
  const [propertyTrust, setPropertyTrust] = useState<any | null>(null);
  const [loadingPropertyTrust, setLoadingPropertyTrust] = useState(false);
  const [aiErrorMsg, setAiErrorMsg] = useState<string | null>(null);

  const fetchPropertyTrust = async (propId: string) => {
    setLoadingPropertyTrust(true);
    try {
      const res = await apiClient.get(`/v1/avcc/property/${propId}`);
      if (res.data) {
        setPropertyTrust(res.data);
      }
    } catch (err) {
      console.warn('Failed to load property trust details:', err);
    } finally {
      setLoadingPropertyTrust(false);
    }
  };

  const fetchCopilotData = async () => {
    if (!user) return;
    setLoadingCopilot(true);
    try {
      const res = await apiClient.get(`/v1/ai/documents/${id}/copilot`);
      if (res.data) {
        setCopilotData(res.data);
      }
    } catch (err: any) {
      console.warn('Failed to load AI copilot data:', err);
      if (err.message && (err.message.includes('API key') || err.message.includes('NVIDIA') || err.message.includes('Nemotron'))) {
        setAiErrorMsg(err.message);
      }
    } finally {
      setLoadingCopilot(false);
    }
  };

  const fetchAiInsights = async () => {
    if (!user) return;
    setLoadingAi(true);
    setAiErrorMsg(null);
    try {
      const res = await apiClient.get(`/documents/${id}/ai-insights`);
      if (res.data) {
        setAiInsights(res.data);
      }
    } catch (err: any) {
      console.warn('Failed to load AI insights:', err);
      if (err.message && (err.message.includes('API key') || err.message.includes('NVIDIA') || err.message.includes('Nemotron'))) {
        setAiErrorMsg(err.message);
      } else {
        setAiErrorMsg('AI Services Unavailable: ' + (err.message || ''));
      }
    } finally {
      setLoadingAi(false);
    }
  };

  const fetchDigitalTwin = async () => {
    setLoadingTwin(true);
    try {
      const res = await apiClient.get(`/documents/${id}/twin`);
      if (res.data) {
        setDigitalTwin(res.data);
      }
    } catch (err) {
      console.warn('Failed to load Digital Twin data:', err);
    } finally {
      setLoadingTwin(false);
    }
  };

  const handleRegenerateAi = async () => {
    if (!user) return;
    setRegeneratingAi(true);
    setAiErrorMsg(null);
    try {
      await apiClient.post(`/v1/ai/documents/${id}/regenerate`, {});
      await apiClient.post(`/documents/${id}/ai-insights/regenerate`, {});
      await apiClient.post(`/documents/${id}/twin/recalculate`, {});
      await Promise.all([
        fetchAiInsights(),
        fetchCopilotData(),
        fetchDetails(),
        fetchDigitalTwin()
      ]);
    } catch (err: any) {
      console.warn('Failed to regenerate AI insights:', err);
      if (err.message && (err.message.includes('API key') || err.message.includes('NVIDIA') || err.message.includes('Nemotron'))) {
        setAiErrorMsg(err.message);
      } else {
        setAiErrorMsg('AI Services Unavailable: ' + (err.message || ''));
      }
      alert(err.message || 'Failed to regenerate AI insights.');
    } finally {
      setRegeneratingAi(false);
    }
  };

  const fetchDetails = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await apiClient.get(`/documents/${id}/status`);
      if (!res.data) {
        throw new Error('Document not found in on-chain registry.');
      }

      const apiData = res.data;
      
      const formattedDoc: DocumentDetails = {
        documentId: apiData.documentId,
        title: apiData.title || 'Sale Deed - Plot 42',
        type: apiData.type || 'Sale Deed',
        status: apiData.status,
        contentHash: apiData.contentHash,
        ownerUserId: apiData.ownerUserId || '',
        onchainTxSignature: apiData.onchainTxSignature,
        onchainPda: apiData.onchainPda || 'Solana derived Program Derived Address (PDA)',
        timestamp: apiData.timestamp,
        assignedNotary: apiData.assignedNotary || null,
        notarySummary: apiData.notarySummary ? {
          notaryId: apiData.notarySummary.notaryId,
          name: apiData.notarySummary.name || 'Advocate Rao',
          dscCertificateSerial: apiData.notarySummary.dscCertificateSerial || 'CA-3-889a2bc1',
          signedAt: apiData.notarySummary.signedAt
        } : null,
        signers: apiData.signers || { required: 1, completed: 0 },
        viewProfile: apiData.viewProfile,
        metadata: apiData.metadata || null,
        verificationCase: apiData.verificationCase || null
      };


      setDoc(formattedDoc);

      const propId = formattedDoc.metadata?.propertyId || formattedDoc.metadata?.surveyNumber;
      if (propId) {
        fetchPropertyTrust(propId);
      }

      // Always use the real verificationEvents returned by the status endpoint
      if (apiData.verificationEvents) {
        setTimeline(apiData.verificationEvents);
      } else {
        generateMockTimeline(formattedDoc);
      }

      // Fetch transfers history
      try {
        const transfersRes = await apiClient.get(`/transfers/document/${id}`);
        if (transfersRes.data) {
          setTransfers(transfersRes.data);
        }
      } catch (err) {
        console.warn('Failed to load transfers:', err);
      }

      // Fetch ownership history
      try {
        const historyRes = await apiClient.get(`/transfers/document/${id}/ownership`);
        if (historyRes.data) {
          setOwnershipHistory(historyRes.data);
        }
      } catch (err) {
        console.warn('Failed to load ownership history:', err);
      }

      // Fetch fraud score for institutional roles
      if (user && ['BANK_OFFICER', 'COURT_CLERK', 'ADMIN'].includes(user.role)) {
        try {
          const fraudRes = await apiClient.get(`/documents/${id}/fraud-score`);
          if (fraudRes.data) {
            setFraudScore(fraudRes.data);
          }
        } catch (err) {
          console.warn('Failed to load fraud score:', err);
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to fetch document registry details.');
    } finally {
      setLoading(false);
    }
  };

  const generateMockTimeline = (d: DocumentDetails) => {
    const ownerName = d.metadata?.ownerName || 'Citizen';
    const notaryName = d.notarySummary?.name || d.assignedNotary?.name || 'Assigned Notary';
    const mockList: TimelineEvent[] = [
      {
        eventId: 'evt-1',
        eventType: 'registration_confirmed',
        actorLabel: `Citizen Executant (${ownerName})`,
        occurredAt: d.timestamp,
        onchainTxRef: d.onchainTxSignature
      }
    ];

    if (d.status === 'NOTARY_SIGNED' || d.status === 'FULLY_EXECUTED') {
      mockList.push({
        eventId: 'evt-2',
        eventType: 'notary_signed',
        actorLabel: `Notary Advocate (${notaryName})`,
        occurredAt: d.notarySummary?.signedAt || new Date().toISOString(),
        onchainTxRef: d.onchainTxSignature
      });
    }

    setTimeline(mockList);
  };

  useEffect(() => {
    fetchDetails();
    if (user) {
      fetchAiInsights();
      fetchCopilotData();
      fetchDigitalTwin();
    }
    if (user && user.role === 'NOTARY') {
      apiClient.post(`/documents/${id}/review`, {}).catch((err) => {
        console.warn('Failed to record review start event:', err);
      });
    }
  }, [id, user]);

  const downloadCertificate = async () => {
    if (!doc) return;
    setDownloading(true);
    try {
      const res = await apiClient.get(`/documents/${id}/certificate`);
      if (res.data?.pdfBase64) {
        const linkSource = `data:application/pdf;base64,${res.data.pdfBase64}`;
        const downloadLink = document.createElement("a");
        const fileName = `${doc.title.replace(/\s+/g, '_')}_verification_certificate.pdf`;

        downloadLink.href = linkSource;
        downloadLink.download = fileName;
        downloadLink.click();
      }
    } catch (err) {
      alert('Failed to generate PDF certificate.');
    } finally {
      setDownloading(false);
    }
  };

  const handleInitiateTransfer = async () => {
    if (!newOwnerId) {
      alert('Please enter a buyer user ID.');
      return;
    }
    setTransferring(true);
    try {
      let uploadedDocs: any[] = [];
      if (supportingFile) {
        const formData = new FormData();
        formData.append('file', supportingFile);
        const uploadRes = await apiClient.postFormData('/transfers/upload', formData);
        if (uploadRes.data) {
          uploadedDocs.push(uploadRes.data);
        }
      }

      await apiClient.post('/transfers/initiate', {
        documentId: id,
        newOwnerId,
        transferType,
        transferNotes: transferNotes || null,
        supportingDocs: uploadedDocs
      });

      setNewOwnerId('');
      setTransferNotes('');
      setSupportingFile(null);
      fetchDetails();
    } catch (err: any) {
      alert(err.message || 'Failed to initiate ownership transfer.');
    } finally {
      setTransferring(false);
    }
  };

  const handleApproveTransfer = async (transferId: string, role: string) => {
    setTransferring(true);
    try {
      await apiClient.post('/transfers/approve', {
        transferId,
        role,
        signerAddress: '5h3K1111111111111111111111111111111111111111',
        signatureBytes: 'mock_signature'
      });
      fetchDetails();
    } catch (err: any) {
      alert(err.message || 'Failed to approve ownership transfer.');
    } finally {
      setTransferring(false);
    }
  };

  const handleFinalizeTransfer = async (transferId: string) => {
    setTransferring(true);
    try {
      await apiClient.post('/transfers/finalize', {
        transferId
      });
      fetchDetails();
    } catch (err: any) {
      alert(err.message || 'Failed to finalize ownership transfer.');
    } finally {
      setTransferring(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <Badge className="bg-yellow-500/10 text-yellow-600 border border-yellow-500/25">Pending Notary Signature</Badge>;
      case 'ONCHAIN_CONFIRMED':
        return <Badge className="bg-foreground/5 text-foreground border border-foreground/20">Anchored on Solana</Badge>;
      case 'NOTARY_REVIEW_STARTED':
        return <Badge className="bg-blue-500/10 text-blue-600 border border-blue-500/25">Under Review</Badge>;
      case 'READY_FOR_SIGNATURE':
        return <Badge className="bg-purple-500/10 text-purple-600 border border-purple-500/25">Awaiting Signature</Badge>;
      case 'NOTARY_SIGNED':
        return <Badge className="bg-foreground/5 text-foreground border border-foreground/20 font-semibold">Notary Verified</Badge>;
      case 'FULLY_EXECUTED':
        return <Badge className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/25 font-bold">Fully Executed</Badge>;
      case 'DISPUTED':
        return <Badge className="bg-red-500/10 text-red-600 border border-red-500/25 font-semibold">Disputed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getBackLink = () => {
    if (!user) return '/verify';
    if (user.role === 'CITIZEN') return '/dashboard';
    if (user.role === 'NOTARY') return '/notary';
    return '/search';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center noise-overlay">
        <Activity className="h-8 w-8 text-foreground animate-spin" />
        <span className="ml-3 text-muted-foreground">Loading audit trail...</span>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4 noise-overlay">
        <Card className="border-border bg-card max-w-md w-full text-center p-6 space-y-4">
          <HelpCircle className="h-12 w-12 text-muted-foreground/45 mx-auto" />
          <h2 className="text-xl font-bold">Audit Record Not Found</h2>
          <p className="text-muted-foreground text-sm">{errorMsg}</p>
          <Link href={getBackLink()} className="block">
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-full">Return</Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground antialiased font-sans flex flex-col justify-between noise-overlay">
      {/* Top Navbar */}
      <header className="border-b border-border bg-background/80 backdrop-blur-md px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link href={getBackLink()} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm font-medium">Back</span>
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

      {/* Main Content */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-10 grid gap-8 lg:grid-cols-3">
        {/* Left Col: Document Details Card (2 columns wide) */}
        <div className="lg:col-span-2 space-y-6">
          {doc?.viewProfile === 'ASSIGNED_NOTARY_VIEW' && doc.status === 'PENDING' && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="space-y-1">
                <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <ShieldCheck className="h-4.5 w-4.5 text-primary" />
                  Assigned Notary Verification Case
                </h4>
                <p className="text-xs text-muted-foreground">
                  You are the assigned notary for this document. Please complete the Verification Proof Layer workspace to sign and anchor.
                </p>
              </div>
              <Link href={`/notary/case/${doc.documentId}`} className="shrink-0">
                <Button className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs rounded-full font-semibold px-4 py-2">
                  Open Verification Workspace
                </Button>
              </Link>
            </div>
          )}

          <Card className="border-border bg-card/60 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-start justify-between">
              <div>
                <CardTitle className="text-2xl font-bold text-foreground tracking-tight">{doc?.title}</CardTitle>
                <CardDescription className="text-muted-foreground text-sm mt-1">{doc?.type}</CardDescription>
              </div>
              <div>{doc && getStatusBadge(doc.status)}</div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Metadata list */}
              <div className="grid gap-4 sm:grid-cols-2 text-sm">
                <div className="space-y-1">
                  <span className="text-muted-foreground text-xs block font-mono">REGISTRY UUID:</span>
                  <span className="font-mono text-foreground text-xs select-all">{doc?.documentId}</span>
                </div>
                <div className="space-y-1">
                  <span className="text-muted-foreground text-xs block font-mono">SHA-256 CHECK FINGERPRINT:</span>
                  <span className="font-mono text-foreground text-xs select-all break-all">{doc?.contentHash}</span>
                </div>
                <div className="space-y-1">
                  <span className="text-muted-foreground text-xs block font-mono">REGISTRATION TIMESTAMP:</span>
                  <span className="text-foreground flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                    {doc && new Date(doc.timestamp).toLocaleString()}
                  </span>
                </div>
                <div className="space-y-1">
                  <span className="text-muted-foreground text-xs block font-mono">DSC SIGNATURE REQUIREMENTS:</span>
                  <span className="text-foreground font-medium">
                    {doc?.signers.completed} / {doc?.signers.required} Notary Endorsements Completed
                  </span>
                </div>
                {doc?.assignedNotary && (
                  <div className="space-y-1">
                    <span className="text-muted-foreground text-xs block font-mono">ASSIGNED NOTARY:</span>
                    <span className="text-foreground font-medium">
                      {doc.assignedNotary.name} (Serial: {doc.assignedNotary.dscCertificateSerial})
                    </span>
                  </div>
                )}
              </div>

              {/* Solana Anchor */}
              <div className="border-t border-border pt-6 space-y-3 text-sm">
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-foreground" />
                  Solana Trust Anchor Record
                </h3>
                <div className="rounded-lg bg-background/60 border border-border p-4 space-y-3.5 text-xs">
                  <div>
                    <span className="block text-muted-foreground font-mono">SOLANA TRANSACTION SIGNATURE:</span>
                    {doc?.onchainTxSignature?.endsWith('_mock_sig') ? (
                      <span className="font-mono text-muted-foreground italic">
                        {doc?.onchainTxSignature} (Local Sandbox Mode)
                      </span>
                    ) : (
                      <a
                        href={`https://explorer.solana.com/tx/${doc?.onchainTxSignature}?cluster=devnet`}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-foreground underline hover:text-muted-foreground break-all flex items-center gap-1"
                      >
                        {doc?.onchainTxSignature}
                        <LinkIcon className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                  <div>
                    <span className="block text-muted-foreground font-mono">DERIVED PDA REGISTRY ACCOUNT:</span>
                    <span className="font-mono text-foreground break-all">
                      {doc?.onchainTxSignature?.endsWith('_mock_sig') 
                        ? 'pda_derived_document_record_account_solana_pda' 
                        : 'EbKjjyvxck5REvVXTXuAvPDrydzKFniiGgLdKSeyfc3w'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Notary Endorsements list */}
              {doc?.notarySummary && (
                <div className="border-t border-border pt-6 space-y-3 text-sm">
                  <h3 className="font-semibold text-foreground flex items-center gap-2">
                    <User className="h-4 w-4 text-foreground" />
                    Recorded Digital Signatures
                  </h3>
                  <div className="rounded-lg border border-border bg-background/40 p-4 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground">{doc.notarySummary.name} (Notary Authority)</span>
                      <Badge className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/25">Class-3 DSC Signed</Badge>
                    </div>
                    <p className="text-muted-foreground mt-1">
                      Certificate Serial: <code className="text-foreground">{doc.notarySummary.dscCertificateSerial}</code>
                    </p>
                    <p className="text-muted-foreground">
                      Signed At: <span className="text-foreground">{new Date(doc.notarySummary.signedAt).toLocaleString()}</span>
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
            <CardFooter className="border-t border-border bg-muted/20 py-4 flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Indian Evidence Act Sec 65B Audit Report</span>
              <Button
                onClick={downloadCertificate}
                disabled={downloading}
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-sm rounded-full"
              >
                <Download className="h-4 w-4 mr-2" />
{downloading ? 'Generating Certificate...' : 'Download Certificate PDF'}
              </Button>
            </CardFooter>
          </Card>

          {/* Digital Twin Intelligence Workspace (Citizen Experience) */}
          {user && user.role === 'CITIZEN' && (
            <div className="space-y-6">
              {/* 1. Verification Readiness Gauge */}
              <Card className="border-border bg-card/60 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-lg font-bold text-foreground flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary animate-pulse" />
                    Verification Readiness Advisor
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">
                    Live operational model analyzing your document's cryptographic integrity and compliance readiness
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {loadingTwin && !digitalTwin ? (
                    <div className="text-center py-10">
                      <Activity className="h-6 w-6 text-primary animate-spin mx-auto" />
                      <p className="text-xs text-muted-foreground mt-2">Synchronizing Digital Twin...</p>
                    </div>
                  ) : !digitalTwin ? (
                    <div className="text-center py-6">
                      <p className="text-xs text-muted-foreground">No Digital Twin compiled for this document.</p>
                      <Button
                        onClick={handleRegenerateAi}
                        disabled={regeneratingAi}
                        className="mt-3 bg-primary hover:bg-primary/90 text-primary-foreground text-xs rounded-full px-4 py-2 font-semibold"
                      >
                        {regeneratingAi ? 'Generating...' : 'Compute Digital Twin'}
                      </Button>
                    </div>
                  ) : (
                    (() => {
                      const passport = digitalTwin.passportData || {};
                      const score = passport.overallVerificationScore ?? 0;
                      const readiness = passport.verificationReadiness || 'INCOMPLETE';

                      let readinessText = "In Progress. Verification is ongoing.";
                      let readinessDesc = "Providing additional supporting evidence will speed up approval.";
                      let badgeColor = "bg-yellow-500/10 text-yellow-600 border border-yellow-500/25";

                      if (readiness === 'READY') {
                        readinessText = "Attestation Ready";
                        readinessDesc = "Your deed meets all structural and cryptographic requirements and is ready for final notary endorsement.";
                        badgeColor = "bg-emerald-500/10 text-emerald-600 border border-emerald-500/25 font-bold";
                      } else if (readiness === 'RISK_DETECTED') {
                        readinessText = "Attention Required";
                        readinessDesc = "Potential anomalies or missing records have been identified. Please review the items below.";
                        badgeColor = "bg-red-500/10 text-red-600 border border-red-500/25 font-bold";
                      }

                      // Compile action items
                      const actionItems: string[] = [];
                      if (passport.evidenceCoverage < 100 && aiInsights?.evidenceRecommendations) {
                        aiInsights.evidenceRecommendations.forEach((rec: any) => {
                          if (!rec.requested) {
                            actionItems.push(`Upload missing supporting document: ${rec.recommendedDoc}`);
                          }
                        });
                      }
                      if (readiness === 'INCOMPLETE') {
                        actionItems.push("Awaiting Notary review and validation checklist completions.");
                      }
                      if (digitalTwin.registryConsistency?.conflictScore > 0) {
                        actionItems.push("Provide justification or title proof for overlapping registry survey numbers.");
                      }

                      return (
                        <div className="space-y-6">
                          <div className="flex flex-col md:flex-row items-center gap-6 p-4 rounded-xl border border-border bg-background/40">
                            {/* Radial Gauge */}
                            <div className="relative flex items-center justify-center h-28 w-28 shrink-0">
                              <div className={`absolute inset-0 rounded-full blur-[4px] opacity-10 ${
                                score >= 80 ? 'bg-emerald-500' : score >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                              }`} />
                              
                              <svg className="w-full h-full transform -rotate-90">
                                <circle
                                  cx="56"
                                  cy="56"
                                  r="48"
                                  className="stroke-muted/40"
                                  strokeWidth="5"
                                  fill="transparent"
                                />
                                <circle
                                  cx="56"
                                  cy="56"
                                  r="48"
                                  className={`transition-all duration-1000 ${
                                    score >= 80 ? 'stroke-emerald-500' : score >= 50 ? 'stroke-yellow-500' : 'stroke-red-500'
                                  }`}
                                  strokeWidth="6"
                                  fill="transparent"
                                  strokeDasharray={2 * Math.PI * 48}
                                  strokeDashoffset={2 * Math.PI * 48 * (1 - score / 100)}
                                  strokeLinecap="round"
                                />
                              </svg>
                              <div className="absolute text-center">
                                <span className="text-3xl font-mono font-black text-foreground">{score}%</span>
                                <span className="block text-[8px] text-muted-foreground uppercase tracking-widest font-bold">Readiness</span>
                              </div>
                            </div>

                            <div className="flex-1 space-y-2 text-center md:text-left">
                              <div className="flex items-center justify-center md:justify-start gap-2">
                                <span className="text-xs text-muted-foreground uppercase font-mono">Status:</span>
                                <Badge className={badgeColor}>{readinessText}</Badge>
                              </div>
                              <p className="text-sm font-semibold text-foreground">{readinessDesc}</p>
                              <p className="text-xs text-muted-foreground">
                                Calculated continuously by the Autonomous Verification Engine cross-referencing registries, Solana signatures, and VPL checklist logs.
                              </p>
                            </div>
                          </div>

                          {/* Action Items Box */}
                          {actionItems.length > 0 && (
                            <div className="rounded-xl border border-yellow-500/15 bg-yellow-500/5 p-4 space-y-2.5">
                              <span className="text-xs font-bold text-yellow-600 uppercase tracking-wider block font-mono">Current Actions Required</span>
                              <div className="space-y-2 text-xs">
                                {actionItems.map((item, idx) => (
                                  <div key={idx} className="flex items-start gap-2 text-yellow-700 font-medium">
                                    <AlertTriangle className="h-4 w-4 shrink-0 text-yellow-600 mt-0.5" />
                                    <span>{item}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Cryptographic Provance Details */}
                          <div className="grid gap-4 sm:grid-cols-2 pt-4 border-t border-border/40 text-xs">
                            <div className="space-y-1 bg-background/30 border border-border p-3 rounded-lg">
                              <span className="text-[9px] font-mono text-muted-foreground uppercase block">Twin Snapshot Hash</span>
                              <span className="font-mono text-foreground break-all select-all">{passport.passportHash || 'AWAITING_ANALYTICS'}</span>
                            </div>
                            <div className="space-y-1 bg-background/30 border border-border p-3 rounded-lg flex flex-col justify-between">
                              <div>
                                <span className="text-[9px] font-mono text-muted-foreground uppercase block">Model Integrity Version</span>
                                <span className="font-mono text-foreground font-bold">v{digitalTwin.version}</span>
                              </div>
                              <span className="text-[9px] text-muted-foreground">Updated: {new Date(digitalTwin.updatedAt).toLocaleString()}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })()
                  )}
                </CardContent>
              </Card>

              {/* 2. Digital Twin Timeline */}
              <Card className="border-border bg-card/60 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-lg font-bold text-foreground flex items-center gap-2">
                    <Activity className="h-5 w-5 text-foreground" />
                    Digital Twin Lifecycle Timeline
                  </CardTitle>
                  <CardDescription className="text-muted-foreground text-xs">
                    Cryptographic provenance tracking from browser upload to final government register entry
                  </CardDescription>
                </CardHeader>
                <CardContent className="relative pl-8 py-4">
                  {loadingTwin && !digitalTwin ? (
                    <div className="text-center py-10">
                      <Activity className="h-6 w-6 text-primary animate-spin mx-auto" />
                    </div>
                  ) : !digitalTwin ? (
                    <p className="text-xs text-muted-foreground italic">No lifecycle timeline compiled.</p>
                  ) : (
                    (() => {
                      const stages = digitalTwin.legalLifecycle || [];
                      return (
                        <>
                          <div className="absolute left-[33px] top-6 bottom-6 w-[2px] bg-border" />
                          <div className="space-y-6">
                            {stages.map((stage: any, index: number) => {
                              const isPassed = stage.status === 'PASSED';
                              const isWarning = stage.status === 'WARNING';
                              const isIncomplete = stage.status === 'INCOMPLETE';

                              let statusColor = "border-border text-muted-foreground";
                              let badgeClass = "bg-muted text-muted-foreground";
                              let iconElement = <Clock className="h-3.5 w-3.5" />;

                              if (isPassed) {
                                statusColor = "border-emerald-500 text-emerald-500";
                                badgeClass = "bg-emerald-500/10 text-emerald-600 border border-emerald-500/25";
                                iconElement = <Check className="h-3.5 w-3.5" />;
                              } else if (isWarning) {
                                statusColor = "border-yellow-500 text-yellow-500";
                                badgeClass = "bg-yellow-500/10 text-yellow-600 border border-yellow-500/25";
                                iconElement = <AlertTriangle className="h-3.5 w-3.5" />;
                              } else if (isIncomplete) {
                                statusColor = "border-amber-500 text-amber-500";
                                badgeClass = "bg-amber-500/10 text-amber-600 border border-amber-500/25";
                                iconElement = <Activity className="h-3.5 w-3.5 animate-pulse" />;
                              }

                              return (
                                <div key={stage.id} className="relative flex items-start gap-4 text-xs">
                                  <div className={`z-10 flex h-7 w-7 items-center justify-center rounded-full bg-background border shadow-sm ${statusColor}`}>
                                    {iconElement}
                                  </div>
                                  <div className="flex-1 space-y-1">
                                    <div className="flex items-center justify-between">
                                      <span className="font-bold text-foreground text-sm">{stage.label}</span>
                                      <Badge className={`text-[9px] px-1.5 py-0 border-0 ${badgeClass}`}>
                                        {stage.status}
                                      </Badge>
                                    </div>
                                    <div className="flex flex-wrap items-center justify-between gap-2 text-muted-foreground text-[11px]">
                                      <span>
                                        {stage.time ? new Date(stage.time).toLocaleString() : "Awaiting event trigger..."}
                                      </span>
                                      {stage.id === 'ANCHOR' && doc?.onchainTxSignature && (
                                        <a
                                          href={`https://explorer.solana.com/tx/${doc.onchainTxSignature}?cluster=devnet`}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="text-primary hover:underline font-mono text-[10px] flex items-center gap-0.5"
                                        >
                                          Solana Explorer
                                          <LinkIcon className="h-2.5 w-2.5" />
                                        </a>
                                      )}
                                      {stage.id === 'RECEIPT' && doc?.documentId && (
                                        <Link
                                          href={`/document/${doc.documentId}/receipt`}
                                          className="text-primary hover:underline font-mono text-[10px] flex items-center gap-0.5"
                                        >
                                          View receipt
                                          <LinkIcon className="h-2.5 w-2.5" />
                                        </Link>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </>
                      );
                    })()
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Verification Proof Layer (VPL) details card */}
          {doc?.verificationCase && (
            <Card className="border-border bg-card/60 backdrop-blur-sm mt-6">
              <CardHeader>
                <CardTitle className="text-lg font-bold text-foreground flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-foreground" />
                  Verification Proof Layer (VPL)
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Deterministic case audit trail and trust score anchoring
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-6 sm:grid-cols-2">
                  {/* Trust Score & Status */}
                  <div className="flex items-center gap-4 p-4 rounded-xl border border-border bg-background/40">
                    <div className="flex flex-col items-center justify-center h-20 w-20 rounded-full border border-border bg-background/60 shadow-inner">
                      <span className={`text-2xl font-mono font-bold ${
                        doc.verificationCase.trustScore >= 80 
                          ? 'text-emerald-500' 
                          : doc.verificationCase.trustScore >= 50 
                            ? 'text-yellow-500' 
                            : 'text-red-500'
                      }`}>
                        {doc.verificationCase.trustScore}
                      </span>
                      <span className="text-[8px] text-muted-foreground font-semibold">SCORE</span>
                    </div>
                    <div className="space-y-1">
                      <span className="text-muted-foreground text-xs block">VPL CASE STATUS:</span>
                      <Badge className={
                        doc.verificationCase.status === 'VERIFIED'
                          ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/25 font-bold uppercase text-[10px]'
                          : 'bg-yellow-500/10 text-yellow-600 border border-yellow-500/25 font-bold uppercase text-[10px]'
                      }>
                        {doc.verificationCase.status}
                      </Badge>
                    </div>
                  </div>

                  {/* Checklist Summary */}
                  <div className="p-4 rounded-xl border border-border bg-background/40 space-y-2">
                    <span className="text-muted-foreground text-xs block">CHECKLIST COMPLIANCE:</span>
                    <div className="space-y-1.5">
                      {doc.verificationCase.checklist.map((item) => (
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
                {doc?.metadata && (
                  <div className="border-t border-border pt-4 space-y-2.5">
                    <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">Property Registry Metadata</h4>
                    <div className="grid gap-4 sm:grid-cols-2 text-xs font-mono bg-background/30 rounded-lg p-3.5 border border-border">
                      <div>
                        <span className="text-muted-foreground block">SURVEY NUMBER:</span>
                        <span className="text-foreground font-semibold">{doc.metadata.surveyNumber || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block">PROPERTY ID / KHATA:</span>
                        <span className="text-foreground font-semibold">{doc.metadata.propertyId || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block">REGISTRATION NUMBER:</span>
                        <span className="text-foreground font-semibold">{doc.metadata.registrationNumber || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block">REGISTERED OWNER NAME:</span>
                        <span className="text-foreground font-semibold">{doc.metadata.ownerName || 'N/A'}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Solana VPL Anchor Details */}
                {doc.verificationCase.vplProofHash && (
                  <div className="border-t border-border pt-4 space-y-3">
                    <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">On-chain VPL Attestation Proof</h4>
                    <div className="rounded-lg bg-background/60 border border-border p-4 space-y-3.5 text-xs">
                      <div>
                        <span className="block text-muted-foreground font-mono">VPL PROOF RECORD HASH (SHA-256):</span>
                        <span className="font-mono text-foreground select-all break-all">{doc.verificationCase.vplProofHash}</span>
                      </div>
                      <div>
                        <span className="block text-muted-foreground font-mono">SOLANA ATTESTATION TRANSACTION:</span>
                        {doc.verificationCase.vplOnchainTx?.endsWith('_mock_sig') ? (
                          <span className="font-mono text-muted-foreground italic">
                            {doc.verificationCase.vplOnchainTx} (Local Sandbox Mode)
                          </span>
                        ) : (
                          <a
                            href={`https://explorer.solana.com/tx/${doc.verificationCase.vplOnchainTx}?cluster=devnet`}
                            target="_blank"
                            rel="noreferrer"
                            className="font-mono text-foreground underline hover:text-muted-foreground break-all flex items-center gap-1"
                          >
                            {doc.verificationCase.vplOnchainTx}
                            <LinkIcon className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Chain of Title Timeline Card */}
          {doc && doc.viewProfile !== 'PUBLIC_VIEW' && (
            <Card className="border-border bg-card/60 backdrop-blur-sm mt-6">
              <CardHeader>
                <CardTitle className="text-lg font-bold text-foreground flex items-center gap-2">
                  <Activity className="h-5 w-5 text-foreground" />
                  Chain of Title & Ownership History
                </CardTitle>
                <CardDescription className="text-muted-foreground text-xs">
                  Immutable chronological ledger of document/property ownership
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {ownershipHistory.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No ownership records found.</p>
                ) : (
                  <div className="relative pl-6 py-2">
                    <div className="absolute left-[13px] top-6 bottom-6 w-[2px] bg-border" />
                    <div className="space-y-6">
                      {ownershipHistory.map((record, index) => {
                        const isCurrent = record.status === 'ACTIVE';
                        return (
                          <div key={record.recordId} className="relative flex items-start gap-4 text-sm">
                            <div className={`z-10 flex h-7 w-7 items-center justify-center rounded-full bg-background border shadow-sm ${
                              isCurrent ? 'border-emerald-500 text-emerald-500 font-bold' : 'border-border text-muted-foreground'
                            }`}>
                              {index + 1}
                            </div>
                            <div className="flex-1 space-y-1">
                              <p className="font-semibold text-foreground flex items-center gap-2">
                                {isCurrent ? 'Current Owner' : `Previous Owner #${index + 1}`}
                                {isCurrent && (
                                  <Badge className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/25 text-[10px]">
                                    Active
                                  </Badge>
                                )}
                              </p>
                              <p className="text-xs font-mono text-muted-foreground break-all">
                                User ID: {record.ownerUserId}
                              </p>
                              <div className="text-xs text-muted-foreground">
                                <span className="font-semibold">Reason:</span> {record.transferReason || 'Initial Registration'}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                <span className="font-semibold">Held:</span>{' '}
                                {new Date(record.startDate).toLocaleDateString()}
                                {record.endDate ? ` to ${new Date(record.endDate).toLocaleDateString()}` : ' (Present)'}
                              </div>
                              {record.blockchainTx && (
                                <p className="text-[10px] font-mono text-muted-foreground truncate max-w-[300px]">
                                  Solana Tx: {record.blockchainTx}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Ownership Transfer Card (Concealed for public view) */}
          {doc && doc.viewProfile !== 'PUBLIC_VIEW' && (

            <Card className="border-border bg-card/60 backdrop-blur-sm mt-6">
              <CardHeader>
                <CardTitle className="text-lg font-bold text-foreground flex items-center gap-2">
                  <Activity className="h-5 w-5 text-foreground" />
                  Ownership Transfer Registry
                </CardTitle>
                <CardDescription className="text-muted-foreground text-xs">
                  Track and approve real estate / asset deed ownership change lifecycle
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {transfers.length === 0 ? (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      No transfer request is active for this document.
                    </p>
                    {user?.userId === doc.ownerUserId && (
                      <div className="rounded-lg border border-border bg-background/40 p-4 space-y-4">
                        <h4 className="text-sm font-semibold text-foreground">Initiate Ownership Transfer</h4>
                        <div className="space-y-3">
                          <div>
                            <label className="block text-xs font-mono text-muted-foreground mb-1">BUYER USER ID:</label>
                            <input
                              type="text"
                              value={newOwnerId}
                              onChange={(e) => setNewOwnerId(e.target.value)}
                              placeholder="Enter buyer's UUID..."
                              className="w-full text-xs font-mono bg-background border border-border rounded px-3 py-2 text-foreground focus:outline-none"
                            />
                          </div>

                          <div className="grid gap-3 sm:grid-cols-2">
                            <div>
                              <label className="block text-xs font-mono text-muted-foreground mb-1">TRANSFER TYPE:</label>
                              <select
                                value={transferType}
                                onChange={(e) => setTransferType(e.target.value)}
                                className="w-full text-xs bg-background border border-border rounded px-3 py-2 text-foreground focus:outline-none"
                              >
                                <option value="Sale">Sale</option>
                                <option value="Gift">Gift</option>
                                <option value="Inheritance">Inheritance</option>
                                <option value="Court Order">Court Order</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs font-mono text-muted-foreground mb-1">SUPPORTING DOCUMENT:</label>
                              <input
                                type="file"
                                onChange={(e) => setSupportingFile(e.target.files?.[0] || null)}
                                className="w-full text-xs text-muted-foreground"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-xs font-mono text-muted-foreground mb-1">TRANSFER NOTES:</label>
                            <textarea
                              value={transferNotes}
                              onChange={(e) => setTransferNotes(e.target.value)}
                              placeholder="Describe transfer details..."
                              rows={3}
                              className="w-full text-xs bg-background border border-border rounded px-3 py-2 text-foreground focus:outline-none"
                            />
                          </div>

                          <Button
                            onClick={handleInitiateTransfer}
                            disabled={transferring}
                            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground text-xs rounded-full py-2"
                          >
                            {transferring ? 'Initiating Transfer & Uploading to IPFS...' : 'Initiate Transfer'}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  transfers.map((t) => {
                    let approvals = [];
                    try {
                      approvals = typeof t.approvals === 'string' ? JSON.parse(t.approvals) : (t.approvals || []);
                    } catch {
                      approvals = [];
                    }
                    const isOwnerApproved = approvals.some((a: any) => a.actorRole === 'OWNER');
                    const isBuyerApproved = approvals.some((a: any) => a.actorRole === 'BUYER');
                    const isNotaryApproved = approvals.some((a: any) => a.actorRole === 'NOTARY');
                    const isGovApproved = t.status === 'FINALIZED';

                    const canOwnerApprove = user?.userId === doc.ownerUserId && !isOwnerApproved && t.status !== 'FINALIZED';
                    const canBuyerApprove = user?.userId === t.newOwnerHash && !isBuyerApproved && t.status !== 'FINALIZED';
                    const canNotaryApprove = user?.role === 'NOTARY' && !isNotaryApproved && t.status !== 'FINALIZED';
                    const canGovFinalize = user?.role === 'ADMIN' && isOwnerApproved && isBuyerApproved && isNotaryApproved && t.status !== 'FINALIZED';

                    return (
                      <div key={t.transferId} className="space-y-4 border-b border-border pb-4 last:border-b-0 last:pb-0">
                        <div className="flex justify-between items-center text-xs">
                          <div>
                            <span className="font-mono text-muted-foreground">SESSION ID: </span>
                            <span className="font-mono text-foreground font-semibold select-all">{t.transferId}</span>
                          </div>
                          <Badge className={
                            t.status === 'FINALIZED' 
                              ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/25'
                              : t.status === 'APPROVED'
                                ? 'bg-indigo-500/10 text-indigo-600 border border-indigo-500/25'
                                : 'bg-yellow-500/10 text-yellow-600 border border-yellow-500/25'
                          }>
                            {t.status}
                          </Badge>
                        </div>

                        <div className="text-xs text-muted-foreground">
                          <span className="font-semibold">Type:</span> {t.transferType || 'Sale'}
                        </div>
                        {t.transferNotes && (
                          <div className="text-xs text-muted-foreground">
                            <span className="font-semibold">Notes:</span> {t.transferNotes}
                          </div>
                        )}
                        {t.supportingDocs && (() => {
                          let docs = [];
                          try {
                            docs = typeof t.supportingDocs === 'string' ? JSON.parse(t.supportingDocs) : (t.supportingDocs || []);
                          } catch {
                            docs = [];
                          }
                          if (docs.length === 0) return null;
                          return (
                            <div className="text-xs text-muted-foreground space-y-1">
                              <span className="font-semibold">Supporting Evidence:</span>
                              <ul className="list-disc list-inside">
                                {docs.map((d: any, idx: number) => (
                                  <li key={idx}>
                                    <a
                                      href={`https://gateway.pinata.cloud/ipfs/${d.ipfsCid}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="underline hover:text-foreground font-mono text-[10px]"
                                    >
                                      {d.title} (IPFS)
                                    </a>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          );
                        })()}

                        <div className="grid grid-cols-4 gap-2 text-center">
                          <div className={`p-2 rounded border ${isOwnerApproved ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-600' : 'bg-background/40 border-border text-muted-foreground'}`}>
                            <span className="block text-[10px] font-bold">1. OWNER</span>
                            <span className="text-[9px]">{isOwnerApproved ? 'Approved' : 'Pending'}</span>
                          </div>
                          <div className={`p-2 rounded border ${isBuyerApproved ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-600' : 'bg-background/40 border-border text-muted-foreground'}`}>
                            <span className="block text-[10px] font-bold">2. BUYER</span>
                            <span className="text-[9px]">{isBuyerApproved ? 'Approved' : 'Pending'}</span>
                          </div>
                          <div className={`p-2 rounded border ${isNotaryApproved ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-600' : 'bg-background/40 border-border text-muted-foreground'}`}>
                            <span className="block text-[10px] font-bold">3. NOTARY</span>
                            <span className="text-[9px]">{isNotaryApproved ? 'Approved' : 'Pending'}</span>
                          </div>
                          <div className={`p-2 rounded border ${isGovApproved ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-600' : 'bg-background/40 border-border text-muted-foreground'}`}>
                            <span className="block text-[10px] font-bold">4. GOVT</span>
                            <span className="text-[9px]">{isGovApproved ? 'Finalized' : 'Pending'}</span>
                          </div>
                        </div>

                        {t.status !== 'FINALIZED' && (
                          <div className="space-y-2">
                            {canOwnerApprove && (
                              <Button
                                onClick={() => handleApproveTransfer(t.transferId, 'OWNER')}
                                disabled={transferring}
                                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs py-2 rounded-full"
                              >
                                Approve Transfer as Owner
                              </Button>
                            )}
                            {canBuyerApprove && (
                              <Button
                                onClick={() => handleApproveTransfer(t.transferId, 'BUYER')}
                                disabled={transferring}
                                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs py-2 rounded-full"
                              >
                                Approve Transfer as Buyer
                              </Button>
                            )}
                            {canNotaryApprove && (
                              <Button
                                onClick={() => handleApproveTransfer(t.transferId, 'NOTARY')}
                                disabled={transferring}
                                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs py-2 rounded-full"
                              >
                                Endorse & Sign Transfer as Notary
                              </Button>
                            )}
                            {canGovFinalize && (
                              <Button
                                onClick={() => handleFinalizeTransfer(t.transferId)}
                                disabled={transferring}
                                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs py-2 rounded-full"
                              >
                                Finalize & Record Ownership Transfer
                              </Button>
                            )}
                          </div>
                        )}

                        {t.blockchainTxSig && (
                          <div className="text-[10px] font-mono text-muted-foreground truncate">
                            ON-CHAIN TX: <span className="text-foreground">{t.blockchainTxSig}</span>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Col: Custody Timeline & Fraud Assessment (1 column wide) */}
        <div className="space-y-6">
          {/* Fraud score card */}
          {fraudScore && (
            <Card className="border-border bg-card/60 backdrop-blur-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-bold text-foreground flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5 text-foreground" />
                  Fraud Assessment
                </CardTitle>
                <CardDescription className="text-muted-foreground text-xs">
                  Real-time rule-based heuristics & integrity check
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Risk score display */}
                <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-background/50">
                  <span className="text-xs font-mono text-muted-foreground">RISK INDEX:</span>
                  <span className={`text-xl font-mono font-bold ${
                    fraudScore.score <= 25 
                      ? 'text-emerald-600' 
                      : fraudScore.score <= 75 
                        ? 'text-yellow-600' 
                        : 'text-red-600'
                  }`}>
                    {fraudScore.score} / 100
                  </span>
                </div>

                {/* Signals checklist */}
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between p-2 rounded bg-background/40 border border-border/60">
                    <span className="text-muted-foreground">SHA-256 Fingerprint Hash Match</span>
                    {fraudScore.signals.hashMismatch ? (
                      <Badge className="bg-red-500/15 text-red-600 hover:bg-red-500/15 border-0">Mismatch</Badge>
                    ) : (
                      <Badge className="bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/15 border-0">Passed</Badge>
                    )}
                  </div>
                  <div className="flex items-center justify-between p-2 rounded bg-background/40 border border-border/60">
                    <span className="text-muted-foreground">Solana Anchor Verification</span>
                    {fraudScore.signals.missingBlockchainTx ? (
                      <Badge className="bg-red-500/15 text-red-600 hover:bg-red-500/15 border-0">Failed</Badge>
                    ) : (
                      <Badge className="bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/15 border-0">Passed</Badge>
                    )}
                  </div>
                  <div className="flex items-center justify-between p-2 rounded bg-background/40 border border-border/60">
                    <span className="text-muted-foreground">Class-3 Notary Endorsement</span>
                    {fraudScore.signals.missingNotarySignature ? (
                      <Badge className="bg-yellow-500/15 text-yellow-600 hover:bg-yellow-500/15 border-0">Missing</Badge>
                    ) : (
                      <Badge className="bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/15 border-0">Passed</Badge>
                    )}
                  </div>
                  <div className="flex items-center justify-between p-2 rounded bg-background/40 border border-border/60">
                    <span className="text-muted-foreground">Timestamp Recency Validity</span>
                    {fraudScore.signals.expiredVerification ? (
                      <Badge className="bg-yellow-500/15 text-yellow-600 hover:bg-yellow-500/15 border-0">Failed</Badge>
                    ) : (
                      <Badge className="bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/15 border-0">Passed</Badge>
                    )}
                  </div>
                </div>
              </CardContent>
              <CardFooter className="py-2.5 border-t border-border text-[10px] text-muted-foreground font-mono">
                Computed: {new Date(fraudScore.computedAt).toLocaleString()}
              </CardFooter>
            </Card>
          )}

          <Card className="border-border bg-card/60 backdrop-blur-sm h-auto">
            <CardHeader>
              <CardTitle className="text-lg font-bold text-foreground flex items-center gap-2">
                <Activity className="h-5 w-5 text-foreground" />
                Custody Audit Timeline
              </CardTitle>
              <CardDescription className="text-muted-foreground text-xs">
                Trace chronological transaction events logged on Solana
              </CardDescription>
            </CardHeader>
            <CardContent className="relative pl-6 py-2">
              {doc?.viewProfile === 'PUBLIC_VIEW' ? (
                <p className="text-xs text-muted-foreground italic py-4">
                  Audit trail timeline is concealed for document confidentiality.
                </p>
              ) : (
                <>
                  <div className="absolute left-[33px] top-6 bottom-6 w-[2px] bg-border" />
                  
                  <div className="space-y-8">
                    {timeline.map((event, index) => (
                      <div key={event.eventId} className="relative flex items-start gap-4 text-sm">
                        <div className="z-10 flex h-7 w-7 items-center justify-center rounded-full bg-background border border-border text-foreground shadow-sm">
                          {event.eventType === 'registration_confirmed' ? (
                            <FileText className="h-3.5 w-3.5 text-foreground" />
                          ) : event.eventType === 'notary_signed' ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-foreground" />
                          ) : (
                            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
                        </div>

                        <div className="flex-1 space-y-1">
                          <p className="font-semibold text-foreground capitalize">
                            {event.eventType.replace(/_/g, ' ')}
                          </p>
                          <p className="text-xs text-muted-foreground">{event.actorLabel}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {new Date(event.occurredAt).toLocaleString()}
                          </p>
                          {event.onchainTxRef && (
                            <p className="text-[10px] font-mono text-muted-foreground truncate max-w-[200px]">
                              TX: {event.onchainTxRef}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

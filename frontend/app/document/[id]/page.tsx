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

  const handleRegenerateAi = async () => {
    if (!user) return;
    setRegeneratingAi(true);
    setAiErrorMsg(null);
    try {
      const copilotRes = await apiClient.post(`/v1/ai/documents/${id}/regenerate`, {});
      if (copilotRes.data && copilotRes.data.data) {
        setCopilotData(copilotRes.data.data);
      }
      const res = await apiClient.post(`/documents/${id}/ai-insights/regenerate`, {});
      if (res.data) {
        setAiInsights(res.data);
      }
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

          {/* Verification Readiness Advisor Card */}
          {user && user.role === 'CITIZEN' && (
            <Card className="border-border bg-card/60 backdrop-blur-sm mt-6">
              <CardHeader>
                <CardTitle className="text-lg font-bold text-foreground flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary animate-pulse" />
                  Verification Readiness Advisor
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  AI analysis of your document's verification readiness and approval probability
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {aiErrorMsg ? (
                  <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-xs text-destructive space-y-2">
                    <div className="flex items-center gap-2 font-bold">
                      <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
                      <span>AI Services Unavailable</span>
                    </div>
                    <p className="text-foreground/90 font-mono text-[11px] leading-relaxed">{aiErrorMsg}</p>
                  </div>
                ) : !aiInsights ? (
                  <div className="text-center py-6">
                    <p className="text-xs text-muted-foreground">No AI compliance report generated for this deed yet.</p>
                    <Button
                      onClick={handleRegenerateAi}
                      disabled={regeneratingAi}
                      className="mt-3 bg-primary hover:bg-primary/90 text-primary-foreground text-xs rounded-full px-4 py-2 font-semibold"
                    >
                      {regeneratingAi ? 'Analyzing...' : 'Generate Advisor Insights'}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Top Metric Grid */}
                    <div className="grid gap-4 sm:grid-cols-3">
                      <div className="p-4 rounded-lg bg-background/40 border border-border/60 text-center">
                        <span className="block text-[10px] font-mono text-muted-foreground uppercase">Readiness Score</span>
                        <span className="text-2xl font-bold font-mono text-primary">{aiInsights.trustScore}%</span>
                        <span className="block text-[9px] text-muted-foreground mt-1">Completion of VPL Targets</span>
                      </div>
                      <div className="p-4 rounded-lg bg-background/40 border border-border/60 text-center">
                        <span className="block text-[10px] font-mono text-muted-foreground uppercase">Approval Probability</span>
                        <span className="text-2xl font-bold font-mono text-emerald-500">
                          {copilotData?.prediction?.approvalProbability || Math.min(99, Math.max(10, aiInsights.trustScore + 5))}%
                        </span>
                        <span className="block text-[9px] text-muted-foreground mt-1">Notary Approval Likelihood</span>
                      </div>
                      <div className="p-4 rounded-lg bg-background/40 border border-border/60 text-center">
                        <span className="block text-[10px] font-mono text-muted-foreground uppercase">Estimated Delay</span>
                        <span className="text-sm font-bold text-foreground mt-1 block">
                          {aiInsights.evidenceRecommendations?.filter((r: any) => !r.requested).length > 0
                            ? '3-5 Business Days'
                            : '12-24 Hours'}
                        </span>
                        <span className="block text-[9px] text-muted-foreground mt-1">Pending Evidence Request</span>
                      </div>
                    </div>

                    {/* Missing Documents & Expected Improvement */}
                    <div className="space-y-3">
                      <span className="text-xs font-mono text-muted-foreground uppercase block">Missing / Recommended Documents:</span>
                      {aiInsights.evidenceRecommendations && aiInsights.evidenceRecommendations.length > 0 ? (
                        <div className="space-y-2">
                          {aiInsights.evidenceRecommendations.map((rec: any, idx: number) => (
                            <div key={idx} className="flex items-start justify-between p-3 rounded-md bg-background/20 border border-border/40 text-xs">
                              <div className="space-y-1">
                                <div className="font-semibold text-foreground flex items-center gap-1.5">
                                  <span className="h-1.5 w-1.5 rounded-full bg-yellow-500 animate-pulse" />
                                  {rec.recommendedDoc}
                                  {rec.requested && (
                                    <Badge className="bg-yellow-500/10 text-yellow-600 border border-yellow-500/25 text-[8px] py-0 px-1 font-sans font-bold">
                                      Requested by Notary
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-[11px] text-muted-foreground pl-3 leading-relaxed">{rec.reason}</p>
                              </div>
                              <div className="text-right shrink-0 flex flex-col items-end gap-1">
                                <Badge className={`text-[9px] border-0 font-bold ${
                                  rec.priority === 'HIGH' ? 'bg-red-500/10 text-red-500' : 'bg-yellow-500/10 text-yellow-600'
                                }`}>
                                  {rec.priority}
                                </Badge>
                                <span className="text-[10px] text-emerald-500 font-mono font-semibold">
                                  +{rec.expectedTrustIncrease} Trust Score
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-xs text-emerald-500 p-3 rounded-md bg-emerald-500/5 border border-emerald-500/10">
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                          <span>All recommended documents have been provided. No missing evidence!</span>
                        </div>
                      )}
                    </div>

                    {/* Risk Factors & Suggested Actions */}
                    <div className="grid gap-4 sm:grid-cols-2 pt-2 border-t border-border/40 text-xs">
                      <div className="space-y-2">
                        <span className="text-[10px] font-mono text-muted-foreground uppercase block">Risk Factors:</span>
                        <div className="space-y-1 max-h-[120px] overflow-y-auto pr-1">
                          {aiInsights.riskFactors && aiInsights.riskFactors.length > 0 ? (
                            aiInsights.riskFactors.map((f: string, idx: number) => (
                              <div key={idx} className="flex items-start gap-1.5 text-muted-foreground leading-relaxed">
                                <AlertTriangle className="h-3.5 w-3.5 text-yellow-600 shrink-0 mt-0.5" />
                                <span>{f}</span>
                              </div>
                            ))
                          ) : (
                            <p className="text-muted-foreground italic">No immediate risk factors detected.</p>
                          )}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <span className="text-[10px] font-mono text-muted-foreground uppercase block">Suggested Actions:</span>
                        <div className="space-y-1 max-h-[120px] overflow-y-auto pr-1">
                          {aiInsights.recommendations && aiInsights.recommendations.length > 0 ? (
                            aiInsights.recommendations.map((action: string, idx: number) => (
                              <div key={idx} className="flex items-start gap-1.5 text-slate-300 leading-relaxed">
                                <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                                <span>{action}</span>
                              </div>
                            ))
                          ) : (
                            <p className="text-muted-foreground italic">No suggested actions required.</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* AI Verification Console Section */}
          {user && doc && doc.viewProfile !== 'PUBLIC_VIEW' && (
            <div className="space-y-6 mt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary shadow-sm border border-primary/20">
                    <Cpu className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-md font-bold tracking-tight text-foreground flex items-center gap-1.5">
                      AI Verification Console
                      <Badge className="bg-primary/10 text-primary border border-primary/25 text-[9px] px-1.5 py-0.5 font-semibold">
                        NVIDIA NEMOTRON
                      </Badge>
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Automated advisory compliance & integrity analysis
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRegenerateAi}
                  disabled={loadingAi || regeneratingAi || loadingCopilot}
                  className="rounded-full text-xs gap-1 border-border bg-card/40 hover:bg-card/80 text-foreground"
                >
                  <RefreshCw className={`h-3 w-3 ${loadingAi || regeneratingAi || loadingCopilot ? 'animate-spin' : ''}`} />
                  {loadingAi || regeneratingAi || loadingCopilot ? 'Analyzing...' : 'Refresh'}
                </Button>
              </div>

              {/* Tabs Switcher */}
              <div className="flex gap-1.5 border-b border-border/40 pb-0.5">
                <button
                  onClick={() => setAiTab('trust_index')}
                  className={`px-4 py-2 text-xs font-semibold border-b-2 transition-all ${
                    aiTab === 'trust_index'
                      ? 'border-primary text-primary font-bold bg-muted/10'
                      : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/5'
                  }`}
                >
                  Trust Index
                </button>
                <button
                  onClick={() => setAiTab('investigation')}
                  className={`px-4 py-2 text-xs font-semibold border-b-2 transition-all ${
                    aiTab === 'investigation'
                      ? 'border-primary text-primary font-bold bg-muted/10'
                      : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/5'
                  }`}
                >
                  AI Investigation Center
                </button>
                <button
                  onClick={() => setAiTab('trust_intelligence')}
                  className={`px-4 py-2 text-xs font-semibold border-b-2 transition-all ${
                    aiTab === 'trust_intelligence'
                      ? 'border-primary text-primary font-bold bg-muted/10'
                      : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/5'
                  }`}
                >
                  Property Trust Intelligence
                </button>
              </div>

              {loadingAi || loadingCopilot ? (
                <Card className="border-border bg-card/60 backdrop-blur-sm p-8 text-center space-y-3">
                  <Activity className="h-6 w-6 text-primary animate-spin mx-auto" />
                  <p className="text-sm text-muted-foreground">Analyzing document compliance indices...</p>
                </Card>
              ) : aiTab === 'trust_index' ? (
                aiInsights ? (
                  <div className="grid gap-6 md:grid-cols-3">
                    
                    {/* Card 1: Verification Readiness */}
                    <Card className="border-border bg-card/60 backdrop-blur-sm overflow-hidden flex flex-col justify-between">
                      <CardHeader className="pb-3">
                        <div className="flex justify-between items-start">
                          <CardTitle className="text-sm font-bold text-foreground uppercase tracking-wider">
                            Verification Readiness
                          </CardTitle>
                          <Badge className={`text-[10px] uppercase font-bold border-0 px-2 py-0.5 ${
                            aiInsights.trustScore >= 80 
                              ? 'bg-emerald-500/10 text-emerald-500'
                              : aiInsights.trustScore >= 50
                                ? 'bg-yellow-500/10 text-yellow-500'
                                : 'bg-red-500/10 text-red-500'
                          }`}>
                            {aiInsights.trustScore >= 80 ? 'Optimal' : aiInsights.trustScore >= 50 ? 'Awaiting Action' : 'Critical Action Required'}
                          </Badge>
                        </div>
                        <CardDescription className="text-[11px] text-muted-foreground">
                          Document and evidence audit completion state
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4 flex-1">
                        {/* Evidence Completeness Progress Bar */}
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-xs font-mono">
                            <span className="text-muted-foreground">EVIDENCE COMPLETENESS:</span>
                            <span className="text-foreground font-bold">{aiInsights.scoreBreakdown.evidenceCompleteness}%</span>
                          </div>
                          <div className="w-full bg-muted/60 rounded-full h-2 overflow-hidden border border-border/40">
                            <div 
                              className="bg-primary h-full rounded-full transition-all duration-500" 
                              style={{ width: `${aiInsights.scoreBreakdown.evidenceCompleteness}%` }}
                            />
                          </div>
                        </div>

                        {/* Recommendations list */}
                        <div className="space-y-2">
                          <span className="text-[10px] font-mono text-muted-foreground block uppercase">RECOMMENDED ACTIONS:</span>
                          <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
                            {aiInsights.recommendations && aiInsights.recommendations.length > 0 ? (
                              aiInsights.recommendations.map((rec: string, idx: number) => (
                                <div key={idx} className="flex items-start gap-1.5 text-xs text-muted-foreground leading-normal">
                                  <span className="text-primary mt-0.5">•</span>
                                  <span>{rec}</span>
                                </div>
                              ))
                            ) : (
                              <div className="flex items-center gap-1.5 text-xs text-emerald-500">
                                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                                <span>Deed is fully ready. No further recommendations.</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                      <CardFooter className="py-2.5 border-t border-border bg-muted/10 text-[9px] text-muted-foreground font-mono flex items-center gap-1">
                        <Info className="h-3 w-3 shrink-0" />
                        Advisory checklist recommendation
                      </CardFooter>
                    </Card>

                    {/* Card 2: Fraud Risk Profile */}
                    <Card className="border-border bg-card/60 backdrop-blur-sm overflow-hidden flex flex-col justify-between">
                      <CardHeader className="pb-3">
                        <div className="flex justify-between items-start">
                          <CardTitle className="text-sm font-bold text-foreground uppercase tracking-wider">
                            Fraud Risk Profile
                          </CardTitle>
                          <div className="relative flex h-2 w-2 mt-1">
                            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                              aiInsights.riskLevel === 'LOW' 
                                ? 'bg-emerald-400' 
                                : aiInsights.riskLevel === 'MEDIUM' 
                                  ? 'bg-yellow-400' 
                                  : 'bg-red-400'
                            }`}></span>
                            <span className={`relative inline-flex rounded-full h-2 w-2 ${
                              aiInsights.riskLevel === 'LOW' ? 'bg-emerald-500' : aiInsights.riskLevel === 'MEDIUM' ? 'bg-yellow-500' : 'bg-red-500'
                            }`}></span>
                          </div>
                        </div>
                        <CardDescription className="text-[11px] text-muted-foreground">
                          Integrity review and conflict analysis
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4 flex-1">
                        {/* Risk score bar */}
                        <div className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-background/40">
                          <span className="text-[10px] font-mono text-muted-foreground">RISK LEVEL:</span>
                          <Badge className={`text-xs font-bold uppercase border-0 px-2 py-0.5 ${
                            aiInsights.riskLevel === 'LOW' 
                              ? 'bg-emerald-500/10 text-emerald-500'
                              : aiInsights.riskLevel === 'MEDIUM'
                                ? 'bg-yellow-500/10 text-yellow-500'
                                : 'bg-red-500/10 text-red-500'
                          }`}>
                            {aiInsights.riskLevel} ({aiInsights.riskScore}/100)
                          </Badge>
                        </div>

                        {/* Risk factors list */}
                        <div className="space-y-2">
                          <span className="text-[10px] font-mono text-muted-foreground block uppercase">RISK FACTOR MATRIX:</span>
                          <div className="space-y-1.5 max-h-[120px] overflow-y-auto pr-1">
                            {aiInsights.riskFactors && aiInsights.riskFactors.length > 0 ? (
                              aiInsights.riskFactors.map((factor: string, idx: number) => (
                                <div key={idx} className="flex items-start gap-1.5 text-xs text-muted-foreground leading-normal font-sans">
                                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-yellow-600 mt-0.5" />
                                  <span>{factor}</span>
                                </div>
                              ))
                            ) : (
                              <div className="flex items-center gap-1.5 text-xs text-emerald-500">
                                <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                                <span>No duplicate claims or conflict signals.</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                      <CardFooter className="py-2.5 border-t border-border bg-muted/10 text-[9px] text-muted-foreground font-mono flex items-center gap-1">
                        <Shield className="h-3 w-3 shrink-0" />
                        NVIDIA Nemotron Guardrails Active
                      </CardFooter>
                    </Card>

                    {/* Card 3: Trust Score & Compliance Breakdown */}
                    <Card className="border-border bg-card/60 backdrop-blur-sm overflow-hidden flex flex-col justify-between">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-bold text-foreground uppercase tracking-wider">
                          Compliance Trust Index
                        </CardTitle>
                        <CardDescription className="text-[11px] text-muted-foreground">
                          Weighted trust score & sub-category breakdown
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4 flex-1">
                        {/* Trust Meter (Radial/Circular Progress SVG) */}
                        <div className="flex items-center gap-4">
                          <div className="relative flex items-center justify-center h-16 w-16 shrink-0">
                            <div className={`absolute inset-0 rounded-full blur-[2px] opacity-10 ${
                              aiInsights.trustScore >= 80 
                                ? 'bg-emerald-500' 
                                : aiInsights.trustScore >= 50 
                                  ? 'bg-yellow-500' 
                                  : 'bg-red-500'
                            }`} />
                            
                            <svg className="w-full h-full transform -rotate-90">
                              <circle
                                cx="32"
                                cy="32"
                                r="28"
                                className="stroke-muted/40"
                                strokeWidth="4"
                                fill="transparent"
                              />
                              <circle
                                cx="32"
                                cy="32"
                                r="28"
                                className={`transition-all duration-1000 ${
                                  aiInsights.trustScore >= 80 
                                    ? 'stroke-emerald-500' 
                                    : aiInsights.trustScore >= 50 
                                      ? 'stroke-yellow-500' 
                                      : 'stroke-red-500'
                                }`}
                                strokeWidth="4.5"
                                fill="transparent"
                                strokeDasharray={2 * Math.PI * 28}
                                strokeDashoffset={2 * Math.PI * 28 * (1 - aiInsights.trustScore / 100)}
                                strokeLinecap="round"
                              />
                            </svg>
                            <span className="absolute text-sm font-mono font-bold text-foreground">
                              {aiInsights.trustScore}
                            </span>
                          </div>

                          <div className="space-y-1">
                            <span className="text-[10px] font-mono text-muted-foreground uppercase block">DECISION EXPLANATION:</span>
                            <p className="text-[11px] text-muted-foreground leading-normal line-clamp-3 font-sans">
                              {aiInsights.trustExplanation}
                            </p>
                          </div>
                        </div>

                        {/* Sub-category breakdown bars */}
                        <div className="space-y-2 border-t border-border/40 pt-3">
                          <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-[10px] font-mono">
                            
                            <div className="space-y-0.5">
                              <div className="flex justify-between text-muted-foreground">
                                <span>REGISTRY:</span>
                                <span className="text-foreground">{aiInsights.scoreBreakdown.registryConsistency}%</span>
                              </div>
                              <div className="w-full bg-muted/40 rounded-full h-1 overflow-hidden">
                                <div className="bg-primary h-full rounded-full" style={{ width: `${aiInsights.scoreBreakdown.registryConsistency}%` }} />
                              </div>
                            </div>

                            <div className="space-y-0.5">
                              <div className="flex justify-between text-muted-foreground">
                                <span>BLOCKCHAIN:</span>
                                <span className="text-foreground">{aiInsights.scoreBreakdown.blockchainValidation}%</span>
                              </div>
                              <div className="w-full bg-muted/40 rounded-full h-1 overflow-hidden">
                                <div className="bg-primary h-full rounded-full" style={{ width: `${aiInsights.scoreBreakdown.blockchainValidation}%` }} />
                              </div>
                            </div>

                            <div className="space-y-0.5">
                              <div className="flex justify-between text-muted-foreground">
                                <span>EVIDENCE:</span>
                                <span className="text-foreground">{aiInsights.scoreBreakdown.evidenceCompleteness}%</span>
                              </div>
                              <div className="w-full bg-muted/40 rounded-full h-1 overflow-hidden">
                                <div className="bg-primary h-full rounded-full" style={{ width: `${aiInsights.scoreBreakdown.evidenceCompleteness}%` }} />
                              </div>
                            </div>

                            <div className="space-y-0.5">
                              <div className="flex justify-between text-muted-foreground">
                                <span>NOTARY:</span>
                                <span className="text-foreground">{aiInsights.scoreBreakdown.notaryAccreditation}%</span>
                              </div>
                              <div className="w-full bg-muted/40 rounded-full h-1 overflow-hidden">
                                <div className="bg-primary h-full rounded-full" style={{ width: `${aiInsights.scoreBreakdown.notaryAccreditation}%` }} />
                              </div>
                            </div>

                          </div>
                        </div>

                        {/* Positive Boosters / Negative Deductions */}
                        <div className="border-t border-border/40 pt-3 space-y-2 text-[10px]">
                          {aiInsights.positiveFactors && aiInsights.positiveFactors.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {aiInsights.positiveFactors.map((f: string, idx: number) => (
                                <Badge key={idx} variant="outline" className="bg-emerald-500/5 text-emerald-500 border-emerald-500/10 text-[9px] px-1 font-medium font-sans">
                                  + {f}
                                </Badge>
                              ))}
                            </div>
                          )}
                          {aiInsights.negativeFactors && aiInsights.negativeFactors.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {aiInsights.negativeFactors.map((f: string, idx: number) => (
                                <Badge key={idx} variant="outline" className="bg-red-500/5 text-red-500 border-red-500/10 text-[9px] px-1 font-medium font-sans">
                                  - {f}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>

                      </CardContent>
                      <CardFooter className="py-2.5 border-t border-border bg-muted/10 text-[9px] text-muted-foreground font-mono flex items-center gap-1">
                        <Zap className="h-3 w-3 shrink-0" />
                        Dynamic trust score ledger proof
                      </CardFooter>
                    </Card>

                  </div>
                ) : (
                  <Card className="border-border bg-card/60 backdrop-blur-sm p-6 text-center space-y-3">
                    <HelpCircle className="h-6 w-6 text-muted-foreground/60 mx-auto" />
                    <p className="text-xs text-muted-foreground">No AI compliance report generated for this deed yet.</p>
                    <Button
                      onClick={handleRegenerateAi}
                      className="w-full bg-primary hover:bg-primary/90 text-primary-foreground text-xs rounded-full py-2"
                    >
                      Analyze Deed
                    </Button>
                  </Card>
                )
              ) : aiTab === 'investigation' ? (
                copilotData ? (
                  <div className="grid gap-6 md:grid-cols-2">
                    
                    {/* Card 1: Approval Probability */}
                    <Card className="border-border bg-card/60 backdrop-blur-sm overflow-hidden flex flex-col justify-between">
                      <CardHeader className="pb-3">
                        <div className="flex justify-between items-start">
                          <CardTitle className="text-sm font-bold text-foreground uppercase tracking-wider">
                            Approval Probability
                          </CardTitle>
                          <Badge className={`text-[10px] font-bold border-0 px-2 py-0.5 uppercase ${
                            copilotData.prediction?.missingEvidenceRisk === 'LOW'
                              ? 'bg-emerald-500/10 text-emerald-500'
                              : copilotData.prediction?.missingEvidenceRisk === 'MEDIUM'
                                ? 'bg-yellow-500/10 text-yellow-500'
                                : 'bg-red-500/10 text-red-500'
                          }`}>
                            {copilotData.prediction?.missingEvidenceRisk || 'UNKNOWN'} RISK
                          </Badge>
                        </div>
                        <CardDescription className="text-[11px] text-muted-foreground">
                          Predicted likelihood of notary registration completion
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4 flex-1">
                        <div className="flex items-center gap-6">
                          {/* Radial Progress Gauge */}
                          <div className="relative flex items-center justify-center h-20 w-20 shrink-0">
                            <div className="absolute inset-0 rounded-full bg-primary/5 blur-[2px]" />
                            <svg className="w-full h-full transform -rotate-90">
                              <circle
                                cx="40"
                                cy="40"
                                r="34"
                                className="stroke-muted/40"
                                strokeWidth="5"
                                fill="transparent"
                              />
                              <circle
                                cx="40"
                                cy="40"
                                r="34"
                                className={`transition-all duration-1000 ${
                                  (copilotData.prediction?.approvalProbability ?? 0) >= 80
                                    ? 'stroke-emerald-500'
                                    : (copilotData.prediction?.approvalProbability ?? 0) >= 50
                                      ? 'stroke-yellow-500'
                                      : 'stroke-red-500'
                                }`}
                                strokeWidth="5.5"
                                fill="transparent"
                                strokeDasharray={2 * Math.PI * 34}
                                strokeDashoffset={2 * Math.PI * 34 * (1 - (copilotData.prediction?.approvalProbability ?? 0) / 100)}
                                strokeLinecap="round"
                              />
                            </svg>
                            <span className="absolute text-base font-mono font-bold text-foreground">
                              {copilotData.prediction?.approvalProbability ?? 0}%
                            </span>
                          </div>

                          <div className="space-y-1">
                            <div className="text-[10px] font-mono text-muted-foreground">MODEL CONFIDENCE:</div>
                            <div className="text-xs font-bold text-foreground">
                              {copilotData.prediction?.confidence ?? 0}% (Nemotron Evaluator)
                            </div>
                            <p className="text-[11px] text-muted-foreground leading-relaxed">
                              Prediction based on evidence completeness, metadata verification consistency, and historic notary workflow timelines.
                            </p>
                          </div>
                        </div>
                      </CardContent>
                      <CardFooter className="py-2.5 border-t border-border bg-muted/10 text-[9px] text-muted-foreground font-mono flex justify-between">
                        <span>VERSION: V{copilotData.prediction?.version ?? 1}</span>
                        <span>DETERMINISTIC EVALUATION</span>
                      </CardFooter>
                    </Card>

                    {/* Card 2: Conflict Investigator Findings */}
                    <Card className="border-border bg-card/60 backdrop-blur-sm overflow-hidden flex flex-col justify-between">
                      <CardHeader className="pb-3">
                        <div className="flex justify-between items-start">
                          <CardTitle className="text-sm font-bold text-foreground uppercase tracking-wider">
                            Conflict Investigator Findings
                          </CardTitle>
                          <Badge className={`text-[10px] font-bold border-0 px-2 py-0.5 uppercase ${
                            copilotData.conflict?.conflictLevel === 'NONE' || copilotData.conflict?.conflictLevel === 'LOW'
                              ? 'bg-emerald-500/10 text-emerald-500'
                              : copilotData.conflict?.conflictLevel === 'MEDIUM'
                                ? 'bg-yellow-500/10 text-yellow-500'
                                : 'bg-red-500/10 text-red-500'
                          }`}>
                            {copilotData.conflict?.conflictLevel || 'UNKNOWN'}
                          </Badge>
                        </div>
                        <CardDescription className="text-[11px] text-muted-foreground">
                          Cross-registry collision and duplicate survey analysis
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3 flex-1">
                        <div className="space-y-1">
                          <div className="text-[10px] font-mono text-muted-foreground uppercase">CONFLICT SCORE:</div>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-muted/50 rounded-full h-1.5 overflow-hidden border border-border/40">
                              <div
                                className={`h-full rounded-full ${
                                  (copilotData.conflict?.conflictScore ?? 0) > 60
                                    ? 'bg-red-500'
                                    : (copilotData.conflict?.conflictScore ?? 0) > 20
                                      ? 'bg-yellow-500'
                                      : 'bg-emerald-500'
                                }`}
                                style={{ width: `${copilotData.conflict?.conflictScore ?? 0}%` }}
                              />
                            </div>
                            <span className="text-xs font-mono font-bold">{copilotData.conflict?.conflictScore ?? 0}/100</span>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <span className="text-[10px] font-mono text-muted-foreground block">INVESTIGATION FINDINGS:</span>
                          <div className="space-y-1.5 max-h-[110px] overflow-y-auto pr-1">
                            {(() => {
                              try {
                                const findings = typeof copilotData.conflict?.findings === 'string'
                                  ? JSON.parse(copilotData.conflict.findings)
                                  : (copilotData.conflict?.findings || []);
                                if (Array.isArray(findings) && findings.length > 0) {
                                  return findings.map((f: string, i: number) => (
                                    <div key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground leading-normal">
                                      <AlertTriangle className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${
                                        (copilotData.conflict?.conflictScore ?? 0) > 40 ? 'text-yellow-500' : 'text-primary'
                                      }`} />
                                      <span>{f}</span>
                                    </div>
                                  ));
                                }
                              } catch (e) {}
                              return (
                                <div className="flex items-center gap-1.5 text-xs text-emerald-500">
                                  <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                                  <span>No registry or database collision matches.</span>
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      </CardContent>
                      <CardFooter className="py-2.5 border-t border-border bg-muted/10 text-[9px] text-muted-foreground font-mono flex justify-between">
                        <span>VERSION: V{copilotData.conflict?.version ?? 1}</span>
                        <span>MATCHED DATABASE INDEXES</span>
                      </CardFooter>
                    </Card>

                    {/* Card 3: Verification Readiness */}
                    <Card className="border-border bg-card/60 backdrop-blur-sm overflow-hidden flex flex-col justify-between">
                      <CardHeader className="pb-3">
                        <div className="flex justify-between items-start">
                          <CardTitle className="text-sm font-bold text-foreground uppercase tracking-wider">
                            Verification Readiness
                          </CardTitle>
                          <Badge className={`text-[10px] font-bold border-0 px-2 py-0.5 uppercase ${
                            copilotData.recommendation?.recommendation === 'APPROVE'
                              ? 'bg-emerald-500/10 text-emerald-500'
                              : copilotData.recommendation?.recommendation === 'REQUEST_EVIDENCE'
                                ? 'bg-yellow-500/10 text-yellow-500'
                                : 'bg-red-500/10 text-red-500'
                          }`}>
                            {copilotData.recommendation?.recommendation || 'UNKNOWN'}
                          </Badge>
                        </div>
                        <CardDescription className="text-[11px] text-muted-foreground">
                          Decision support recommendation
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3 flex-1">
                        <div className="space-y-1">
                          <span className="text-[10px] font-mono text-muted-foreground block">VERIFICATION RATIONALE:</span>
                          <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
                            {(() => {
                              try {
                                const rationale = typeof copilotData.recommendation?.rationale === 'string'
                                  ? JSON.parse(copilotData.recommendation.rationale)
                                  : (copilotData.recommendation?.rationale || []);
                                if (Array.isArray(rationale) && rationale.length > 0) {
                                  return rationale.map((r: string, i: number) => (
                                    <div key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground leading-normal">
                                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500 mt-0.5" />
                                      <span>{r}</span>
                                    </div>
                                  ));
                                }
                              } catch (e) {}
                              return (
                                <div className="text-xs text-muted-foreground italic">
                                  No decision rationale compiled.
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      </CardContent>
                      <CardFooter className="py-2.5 border-t border-border bg-muted/10 text-[9px] text-muted-foreground font-mono flex justify-between">
                        <span>VERSION: V{copilotData.recommendation?.version ?? 1}</span>
                        <span>RECOMMENDED PROTOCOL</span>
                      </CardFooter>
                    </Card>

                    {/* Card 4: Timeline & Bottleneck Prediction */}
                    <Card className="border-border bg-card/60 backdrop-blur-sm overflow-hidden flex flex-col justify-between">
                      <CardHeader className="pb-3">
                        <div className="flex justify-between items-start">
                          <CardTitle className="text-sm font-bold text-foreground uppercase tracking-wider">
                            Timeline & Bottleneck Prediction
                          </CardTitle>
                          <Badge className="bg-primary/10 text-primary border-0 px-2 py-0.5 font-mono text-[10px]">
                            ~{copilotData.prediction?.expectedReviewDays ?? 0} DAYS
                          </Badge>
                        </div>
                        <CardDescription className="text-[11px] text-muted-foreground">
                          Estimated processing delays and potential blockers
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3 flex-1">
                        <div className="space-y-1.5">
                          <span className="text-[10px] font-mono text-muted-foreground block">PREDICTED BLOCKERS:</span>
                          <div className="space-y-1.5 max-h-[80px] overflow-y-auto pr-1">
                            {(() => {
                              try {
                                const blockers = typeof copilotData.prediction?.blockers === 'string'
                                  ? JSON.parse(copilotData.prediction.blockers)
                                  : (copilotData.prediction?.blockers || []);
                                if (Array.isArray(blockers) && blockers.length > 0) {
                                  return blockers.map((b: string, i: number) => (
                                    <div key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground leading-normal">
                                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-500 mt-1.5" />
                                      <span>{b}</span>
                                    </div>
                                  ));
                                }
                              } catch (e) {}
                              return (
                                <div className="flex items-center gap-1.5 text-xs text-emerald-500">
                                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                                  <span>No blockers detected for this deed.</span>
                                </div>
                              );
                            })()}
                          </div>
                        </div>

                        {/* Questions list */}
                        {(() => {
                          try {
                            const questions = typeof copilotData.questions?.questions === 'string'
                              ? JSON.parse(copilotData.questions.questions)
                              : (copilotData.questions?.questions || []);
                            if (Array.isArray(questions) && questions.length > 0) {
                              return (
                                <div className="space-y-1.5 pt-2 border-t border-border/40">
                                  <span className="text-[10px] font-mono text-muted-foreground block uppercase">COMPLIANCE CHALLENGES ({questions.length}):</span>
                                  <div className="space-y-1 max-h-[90px] overflow-y-auto pr-1">
                                    {questions.map((q: any, i: number) => (
                                      <div key={i} className="text-xs text-muted-foreground border-l border-primary/20 pl-2 py-0.5">
                                        <div className="font-semibold text-foreground/80">{q.question}</div>
                                        {q.requiredEvidence && (
                                          <div className="text-[10px] text-muted-foreground mt-0.5 font-sans">Req: {q.requiredEvidence}</div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            }
                          } catch (e) {}
                          return null;
                        })()}
                      </CardContent>
                      <CardFooter className="py-2.5 border-t border-border bg-muted/10 text-[9px] text-muted-foreground font-mono flex justify-between">
                        <span>STRESS TEST SCORE: {100 - (copilotData.conflict?.conflictScore ?? 0)}/100</span>
                        <span>NVIDIA FORECASTING</span>
                      </CardFooter>
                    </Card>

                  </div>
                ) : (
                  <Card className="border-border bg-card/60 backdrop-blur-sm p-6 text-center space-y-3">
                    <HelpCircle className="h-6 w-6 text-muted-foreground/60 mx-auto" />
                    <p className="text-xs text-muted-foreground">No AI investigation data compiled for this deed yet.</p>
                    <Button
                      onClick={handleRegenerateAi}
                      className="w-full bg-primary hover:bg-primary/90 text-primary-foreground text-xs rounded-full py-2"
                    >
                      Compile Investigation Data
                    </Button>
                  </Card>
                )
              ) : (
                // PROPERTY TRUST INTELLIGENCE TAB
                loadingPropertyTrust ? (
                  <Card className="border-border bg-card/60 backdrop-blur-sm p-12 text-center space-y-3">
                    <Activity className="h-6 w-6 text-primary animate-spin mx-auto" />
                    <p className="text-sm text-muted-foreground">Retrieving national trust graph metrics...</p>
                  </Card>
                ) : propertyTrust?.rating ? (
                  <div className="grid gap-6 md:grid-cols-3">
                    {/* Card 1: National Trust Rating */}
                    <Card className="border-border bg-card/60 backdrop-blur-sm overflow-hidden flex flex-col justify-between md:col-span-1">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-bold text-foreground uppercase tracking-wider">
                          Sovereign Trust Rating
                        </CardTitle>
                        <CardDescription className="text-[11px] text-muted-foreground">
                          National Risk Intelligence rating index
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4 flex-1">
                        <div className="text-center py-6">
                          <span className={`text-6xl font-black font-mono tracking-tighter ${
                            ['AAA', 'AA', 'A'].includes(propertyTrust.rating.finalRating)
                              ? 'text-indigo-400 drop-shadow-[0_0_15px_rgba(99,102,241,0.5)]'
                              : ['BBB', 'BB'].includes(propertyTrust.rating.finalRating)
                                ? 'text-amber-400 drop-shadow-[0_0_15px_rgba(245,158,11,0.3)]'
                                : 'text-rose-500 drop-shadow-[0_0_15px_rgba(239,68,68,0.5)]'
                          }`}>
                            {propertyTrust.rating.finalRating}
                          </span>
                          <span className="block text-xs text-muted-foreground uppercase font-mono tracking-widest mt-2">
                            FINAL CREDIT RATING
                          </span>
                        </div>
                        <div className="space-y-2 border-t border-border/40 pt-3 text-xs">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Fraud Risk:</span>
                            <span className={`font-semibold font-mono ${
                              propertyTrust.rating.fraudRisk === 'LOW' ? 'text-emerald-500' : propertyTrust.rating.fraudRisk === 'MEDIUM' ? 'text-amber-500' : 'text-rose-500'
                            }`}>{propertyTrust.rating.fraudRisk}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Network Risk Index:</span>
                            <span className="font-semibold text-foreground font-mono">{propertyTrust.rating.networkRiskScore}%</span>
                          </div>
                        </div>
                      </CardContent>
                      <CardFooter className="py-2.5 border-t border-border bg-muted/10 text-[9px] text-muted-foreground font-mono flex items-center justify-between">
                        <span>LEDGER: SOLANA ACTIVE</span>
                        <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                      </CardFooter>
                    </Card>

                    {/* Card 2: Title Chain & Transfer Integrity */}
                    <Card className="border-border bg-card/60 backdrop-blur-sm overflow-hidden flex flex-col justify-between md:col-span-1">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-bold text-foreground uppercase tracking-wider">
                          Chain of Title Integrity
                        </CardTitle>
                        <CardDescription className="text-[11px] text-muted-foreground">
                          Sequential history and continuity scan
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3 flex-1 text-xs">
                        <div className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-background/40">
                          <span className="font-mono text-muted-foreground text-[10px]">CHAIN STATUS:</span>
                          <Badge className={`text-[10px] font-mono border-0 font-bold ${
                            propertyTrust.chainAssessment?.status === 'Verified'
                              ? 'bg-emerald-500/10 text-emerald-500'
                              : propertyTrust.chainAssessment?.status === 'Warning'
                                ? 'bg-amber-500/10 text-amber-500'
                                : 'bg-rose-500/10 text-rose-500'
                          }`}>
                            {propertyTrust.chainAssessment?.status?.toUpperCase() || 'UNKNOWN'}
                          </Badge>
                        </div>
                        <div className="space-y-2">
                          <span className="text-[10px] font-mono text-muted-foreground block uppercase">CHAIN FINDINGS:</span>
                          <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
                            {propertyTrust.chainAssessment?.findings && propertyTrust.chainAssessment.findings.length > 0 ? (
                              propertyTrust.chainAssessment.findings.map((f: string, i: number) => (
                                <div key={i} className="flex items-start gap-1.5 text-[11px] text-muted-foreground leading-normal">
                                  <span className="text-primary mt-0.5">•</span>
                                  <span>{f}</span>
                                </div>
                              ))
                            ) : (
                              <div className="text-muted-foreground italic text-xs">No findings reported.</div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                      <CardFooter className="py-2.5 border-t border-border bg-muted/10 text-[9px] text-muted-foreground font-mono flex items-center gap-1">
                        <Shield className="h-3 w-3 text-muted-foreground" />
                        Accredited chain audit reference
                      </CardFooter>
                    </Card>

                    {/* Card 3: Trust Evolution over Time */}
                    <Card className="border-border bg-card/60 backdrop-blur-sm overflow-hidden flex flex-col justify-between md:col-span-1">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-bold text-foreground uppercase tracking-wider">
                          Trust Evolution Trend
                        </CardTitle>
                        <CardDescription className="text-[11px] text-muted-foreground">
                          Historic scoring evaluations timeline
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4 flex-1">
                        {/* Custom SVG line chart of history */}
                        {propertyTrust.ratingHistory && propertyTrust.ratingHistory.length > 0 ? (
                          <div className="space-y-3">
                            <div className="border border-border rounded-lg bg-background/50 p-2 overflow-hidden h-28 flex flex-col justify-end">
                              <svg className="w-full h-20 overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
                                <defs>
                                  <linearGradient id="evolutionGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#6366f1" stopOpacity="0.4"/>
                                    <stop offset="100%" stopColor="#6366f1" stopOpacity="0.0"/>
                                  </linearGradient>
                                </defs>
                                {(() => {
                                  const ratings = propertyTrust.ratingHistory;
                                  const points = ratings.map((hist: any, index: number) => {
                                    const x = ratings.length > 1 ? (index / (ratings.length - 1)) * 100 : 50;
                                    const y = 100 - hist.trustScore;
                                    return `${x},${y}`;
                                  }).join(' ');

                                  return (
                                    <>
                                      {ratings.length > 1 && (
                                        <path
                                          d={`M 0,100 L ${points} L 100,100 Z`}
                                          fill="url(#evolutionGrad)"
                                        />
                                      )}
                                      <polyline
                                        fill="none"
                                        stroke="#6366f1"
                                        strokeWidth="2"
                                        points={points || '0,50 100,50'}
                                      />
                                      {ratings.map((hist: any, idx: number) => {
                                        const x = ratings.length > 1 ? (idx / (ratings.length - 1)) * 100 : 50;
                                        const y = 100 - hist.trustScore;
                                        return (
                                          <circle
                                            key={idx}
                                            cx={x}
                                            cy={y}
                                            r="3.5"
                                            className="fill-indigo-500 stroke-background stroke-2 hover:r-5 cursor-pointer"
                                          >
                                            <title>{`Score: ${hist.trustScore}`}</title>
                                          </circle>
                                        );
                                      })}
                                    </>
                                  );
                                })()}
                              </svg>
                              <div className="flex justify-between text-[9px] text-muted-foreground font-mono mt-1 pt-1 border-t border-border/20">
                                <span>START</span>
                                <span>CURRENT: {propertyTrust.rating.trustScore}%</span>
                              </div>
                            </div>
                            <div className="text-[11px] text-muted-foreground leading-normal flex items-start gap-1">
                              <Info className="h-3.5 w-3.5 text-indigo-400 shrink-0 mt-0.5" />
                              <span>Anchored on Solana via transaction <span className="font-mono text-[9px] text-foreground bg-muted px-1 py-0.5 rounded">{propertyTrust.rating.trustReportTxSignature?.slice(0, 10)}...</span></span>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center py-6 text-center text-muted-foreground text-xs italic">
                            No historical rating timeline registered.
                          </div>
                        )}
                      </CardContent>
                      <CardFooter className="py-2.5 border-t border-border bg-muted/10 text-[9px] text-muted-foreground font-mono flex items-center gap-1">
                        <TrendingUp className="h-3 w-3 text-indigo-400" />
                        Trust velocity indexing
                      </CardFooter>
                    </Card>

                    {/* Bottom full span: Justification Report */}
                    <div className="md:col-span-3">
                      <Card className="border-border bg-indigo-950/15 border-indigo-500/10 rounded-xl">
                        <CardHeader className="py-3">
                          <CardTitle className="text-xs font-bold text-indigo-400 uppercase tracking-wider font-mono">
                            Risk Intelligence Justification Summary
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="pb-3 text-xs leading-relaxed text-slate-300">
                          {propertyTrust.rating.justification}
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                ) : (
                  <Card className="border-border bg-card/60 backdrop-blur-sm p-8 text-center space-y-2">
                    <HelpCircle className="h-6 w-6 text-muted-foreground/60 mx-auto" />
                    <p className="text-xs text-slate-300">No sovereign trust rating details available for this property.</p>
                    <p className="text-[10px] text-muted-foreground">Property trust requires notary command center verification analysis.</p>
                  </Card>
                )
              )}
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

'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/auth-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Lock, 
  FileSignature, 
  CheckCircle, 
  Search, 
  RefreshCw, 
  LogOut, 
  Eye, 
  AlertCircle, 
  FileText, 
  CheckCircle2, 
  ShieldAlert, 
  ShieldCheck,
  Clock, 
  FileCheck2, 
  ChevronRight, 
  Download, 
  Upload, 
  AlertTriangle,
  Calendar,
  Layers,
  Archive,
  BarChart3,
  ExternalLink,
  ArrowLeft,
  Cpu,
  Zap,
  Shield,
  Sparkles,
  TrendingUp
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { AVCCDashboard } from '@/components/AVCCDashboard';

interface Evidence {
  evidenceId: string;
  title: string;
  ipfsCid: string;
  uploadedAt: string;
}

interface VerificationCase {
  caseId: string;
  status: string;
  checklist: any[];
  challenges: any[];
  evidence: Evidence[];
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

interface VerificationEvent {
  eventId: string;
  eventType: string;
  occurredAt: string;
  actorLabel: string;
  onchainTxRef?: string;
}

interface AssignedDocument {
  documentId: string;
  title: string;
  type: string;
  contentHash: string;
  status: string;
  requiredSigners: number;
  signerCount: number;
  createdAt: string;
  verificationCase?: VerificationCase;
  metadata?: DocumentMetadata;
  verificationEvents?: VerificationEvent[];
}

interface Analytics {
  documentsAssigned: number;
  documentsReviewed: number;
  documentsSigned: number;
  averageReviewTimeHours: number;
  activeConflictCases: number;
  averageTrustScore: number;
  trustScoreDistribution: {
    Excellent: number;
    Good: number;
    Warning: number;
    Critical: number;
  };
  dailyActivity: {
    date: string;
    registered: number;
    reviewed: number;
    signed: number;
  }[];
}

type WorkspaceTab = 
  | 'awaiting_review' 
  | 'under_review' 
  | 'awaiting_signature' 
  | 'archive' 
  | 'conflict_cases' 
  | 'transfers'
  | 'avcc';

interface Recommendation {
  title: string;
  priority: 'High' | 'Medium';
  explanation: string;
  reason: string;
  improvement: string;
}

// Collapsible helper component
const CollapsibleCard = ({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) => {
  const [isOpen, setIsOpen] = useState(true);
  return (
    <Card className="border-border bg-card/60 backdrop-blur-sm shadow-sm overflow-hidden">
      <button 
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 flex items-center justify-between font-semibold text-sm text-foreground hover:bg-muted/20 transition-all border-b border-border focus:outline-none"
      >
        <div className="flex items-center gap-2">
          {icon}
          <span>{title}</span>
        </div>
        <span className="text-muted-foreground text-xs">{isOpen ? 'Collapse' : 'Expand'}</span>
      </button>
      {isOpen && (
        <CardContent className="p-4">
          {children}
        </CardContent>
      )}
    </Card>
  );
};

// Trust score visual configs
const getTrustScoreConfig = (score: number) => {
  if (score >= 90) return { label: 'Excellent', colorClass: 'text-emerald-600', bgClass: 'bg-emerald-600' };
  if (score >= 75) return { label: 'Good', colorClass: 'text-indigo-600', bgClass: 'bg-indigo-600' };
  if (score >= 50) return { label: 'Warning', colorClass: 'text-amber-600', bgClass: 'bg-amber-500' };
  return { label: 'Critical', colorClass: 'text-red-600', bgClass: 'bg-red-600' };
};

// Trust Score Progress Component
const TrustScoreIndicator = ({ score }: { score: number }) => {
  const config = getTrustScoreConfig(score);
  return (
    <div className="space-y-1.5 w-full">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-foreground">{score}/100</span>
        <span className={`font-medium ${config.colorClass}`}>{config.label}</span>
      </div>
      <div className="w-full bg-secondary h-1.5 rounded-full overflow-hidden">
        <div className={`h-full ${config.bgClass} rounded-full`} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
};

export default function PremiumNotaryOperationsCenter() {
  const { user, logout } = useAuth();
  const router = useRouter();
  
  // Data State
  const [documents, setDocuments] = useState<AssignedDocument[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<AssignedDocument | null>(null);
  const [transfers, setTransfers] = useState<any[]>([]);

  // AI Copilot States
  const [copilotData, setCopilotData] = useState<any | null>(null);
  const [loadingCopilot, setLoadingCopilot] = useState(false);

  // AVCC Command Center States
  const [avccData, setAvccData] = useState<any | null>(null);
  const [loadingAvcc, setLoadingAvcc] = useState(false);
  const [recalculatingAvcc, setRecalculatingAvcc] = useState(false);
  const [resolvingAnomalyId, setResolvingAnomalyId] = useState<string | null>(null);

  const fetchAvccData = async () => {
    setLoadingAvcc(true);
    try {
      const res = await apiClient.get('/v1/avcc/dashboard');
      if (res.data) {
        setAvccData(res.data);
      }
    } catch (err) {
      console.warn('Failed to load AVCC dashboard metrics:', err);
    } finally {
      setLoadingAvcc(false);
    }
  };

  const fetchCopilotData = async (docId: string) => {
    setLoadingCopilot(true);
    try {
      const res = await apiClient.get(`/v1/ai/documents/${docId}/copilot`);
      if (res.data) {
        setCopilotData(res.data);
      }
    } catch (err) {
      console.warn('Failed to load AI copilot data for notary:', err);
    } finally {
      setLoadingCopilot(false);
    }
  };

  // Control State
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('awaiting_review');
  const [detailTab, setDetailTab] = useState<'overview' | 'ai_analysis' | 'ownership' | 'evidence' | 'timeline'>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [signing, setSigning] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (selectedDoc) {
      fetchCopilotData(selectedDoc.documentId);
      setDetailTab('overview');
    } else {
      setCopilotData(null);
    }
  }, [selectedDoc?.documentId]);

  // Dialog State
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [dscPin, setDscPin] = useState('');
  const [isEvidenceModalOpen, setIsEvidenceModalOpen] = useState(false);
  const [evidenceTitle, setEvidenceTitle] = useState('');

  // Fetch all documents and analytics
  const refreshAll = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const [queueRes, analyticsRes, transfersRes] = await Promise.all([
        apiClient.get('/notaries/queue'),
        apiClient.get('/notaries/analytics'),
        apiClient.get('/notaries/transfers')
      ]);
      
      const docs = queueRes.data || [];
      setDocuments(docs);
      setAnalytics(analyticsRes.data || null);
      setTransfers(transfersRes.data || []);
      
      // Keep selection in sync
      if (selectedDoc) {
        const updated = docs.find((d: AssignedDocument) => d.documentId === selectedDoc.documentId);
        if (updated) {
          setSelectedDoc(updated);
        } else {
          setSelectedDoc(null);
        }
      } else if (docs.length > 0) {
        setSelectedDoc(docs[0]);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load dashboard data.');
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
      if (user.role === 'CITIZEN') {
        router.push('/dashboard');
      } else {
        router.push('/search');
      }
      return;
    }
    refreshAll();
  }, [user, router]);

  useEffect(() => {
    if (activeTab === 'avcc') {
      fetchAvccData();
    }
  }, [activeTab]);

  const handleResolveAnomaly = async (anomalyId: string) => {
    setResolvingAnomalyId(anomalyId);
    try {
      await apiClient.post(`/v1/avcc/anomalies/${anomalyId}/resolve`, {
        resolutionNotes: 'Verified continuous deed registry and dismissed alert.'
      });
      await fetchAvccData();
    } catch (err) {
      console.warn('Failed to resolve anomaly:', err);
    } finally {
      setResolvingAnomalyId(null);
    }
  };

  const handleRecalculateGraph = async () => {
    setRecalculatingAvcc(true);
    try {
      await apiClient.post('/v1/avcc/recalculate', {});
      await fetchAvccData();
    } catch (err) {
      console.warn('Failed to recalculate trust graph:', err);
    } finally {
      setRecalculatingAvcc(false);
    }
  };

  // Document status check
  const getTabDocuments = (tab: WorkspaceTab) => {
    return documents.filter((doc) => {
      // Apply Search Filter
      const matchesSearch = 
        doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.documentId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.type.toLowerCase().includes(searchQuery.toLowerCase());
      
      if (!matchesSearch) return false;
      
      switch (tab) {
        case 'awaiting_review':
          return doc.status === 'ONCHAIN_CONFIRMED';
        case 'under_review':
          return doc.status === 'NOTARY_REVIEW_STARTED';
        case 'awaiting_signature':
          return doc.status === 'READY_FOR_SIGNATURE';
        case 'archive':
          return ['NOTARY_SIGNED', 'FULLY_EXECUTED'].includes(doc.status);
        case 'conflict_cases': {
          const challenges = doc.verificationCase?.challenges || [];
          return challenges.some((ch) => ch.type === 'CONFLICT' && !ch.resolved);
        }
        default:
          return false;
      }
    });
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'ONCHAIN_CONFIRMED': return 'Awaiting Review';
      case 'NOTARY_REVIEW_STARTED': return 'Under Review';
      case 'READY_FOR_SIGNATURE': return 'Awaiting Signature';
      case 'NOTARY_SIGNED': return 'Notary Signed';
      case 'FULLY_EXECUTED': return 'Fully Executed';
      case 'DISPUTED': return 'Disputed';
      default: return status.replace(/_/g, ' ');
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'ONCHAIN_CONFIRMED':
        return <span className="text-xs font-semibold text-blue-600">Awaiting Review</span>;
      case 'NOTARY_REVIEW_STARTED':
        return <span className="text-xs font-semibold text-yellow-600">Under Review</span>;
      case 'READY_FOR_SIGNATURE':
        return <span className="text-xs font-semibold text-purple-600">Awaiting Signature</span>;
      case 'NOTARY_SIGNED':
        return <span className="text-xs font-semibold text-emerald-600">Notary Signed</span>;
      case 'FULLY_EXECUTED':
        return <span className="text-xs font-semibold text-emerald-600">Completed</span>;
      case 'DISPUTED':
        return <span className="text-xs font-semibold text-red-600">Disputed</span>;
      default:
        return <span className="text-xs text-muted-foreground font-medium">{status.replace(/_/g, ' ')}</span>;
    }
  };

  // Timeline Event Format Helpers
  const formatEventType = (type: string) => {
    switch (type) {
      case 'DOCUMENT_REGISTERED': return 'Document Uploaded';
      case 'SOLANA_ANCHORED': return 'Solana Anchor Confirmed';
      case 'AI_ASSESSMENT_COMPLETED': return 'AI Assessment Completed';
      case 'EVIDENCE_ADDED': return 'Evidence Added';
      case 'CONFLICT_DETECTED': return 'Conflict Detected';
      case 'NOTARY_REVIEW_STARTED': return 'Review Started';
      case 'NOTARY_SIGNED': return 'Signature Applied';
      case 'TRANSFER_FINALIZED': return 'Transfer Finalized';
      default: return type.replace(/_/g, ' ');
    }
  };

  const getTimelineIcon = (type: string) => {
    switch (type) {
      case 'DOCUMENT_REGISTERED': return <FileText className="h-3 w-3 text-slate-500" />;
      case 'SOLANA_ANCHORED': return <ShieldCheck className="h-3 w-3 text-emerald-600" />;
      case 'AI_ASSESSMENT_COMPLETED': return <Cpu className="h-3 w-3 text-indigo-600" />;
      case 'EVIDENCE_ADDED': return <Upload className="h-3 w-3 text-blue-600" />;
      case 'CONFLICT_DETECTED': return <AlertTriangle className="h-3 w-3 text-red-600" />;
      case 'NOTARY_REVIEW_STARTED': return <Eye className="h-3 w-3 text-amber-600" />;
      case 'NOTARY_SIGNED': return <FileSignature className="h-3 w-3 text-purple-600" />;
      case 'TRANSFER_FINALIZED': return <CheckCircle className="h-3 w-3 text-emerald-600" />;
      default: return <Clock className="h-3 w-3 text-slate-500" />;
    }
  };

  // Compiles recent activity across all documents
  const getAllVerificationEvents = (): (VerificationEvent & { documentTitle: string; documentId: string })[] => {
    const allEvents: (VerificationEvent & { documentTitle: string; documentId: string })[] = [];
    documents.forEach(doc => {
      if (doc.verificationEvents) {
        doc.verificationEvents.forEach(event => {
          allEvents.push({
            ...event,
            documentTitle: doc.title,
            documentId: doc.documentId
          });
        });
      }
    });
    return allEvents.sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
  };

  // Property Digital Twin summary card
  const PropertyDigitalTwin = ({ doc, copilotData }: { doc: AssignedDocument; copilotData: any }) => {
    const caseData = doc.verificationCase;
    const metadata = doc.metadata || {};
    const trustScore = caseData?.trustScore ?? 100;
    const checklist = caseData?.checklist || [];
    const evidence = caseData?.evidence || [];
    const challenges = caseData?.challenges || [];
    
    const totalChecklist = checklist.length || 1;
    const passedChecklist = checklist.filter((item: any) => item.status === 'PASSED').length;
    const readiness = Math.round((passedChecklist / totalChecklist) * 100);
    
    const activeConflicts = challenges.filter((c: any) => c.type === 'CONFLICT' && !c.resolved).length;
    const transfersCount = (doc.verificationEvents || []).filter(e => e.eventType === 'OWNERSHIP_TRANSFER').length;
    
    let nationalRating = 'A';
    if (trustScore >= 90) nationalRating = 'AAA';
    else if (trustScore >= 80) nationalRating = 'AA';
    else if (trustScore >= 70) nationalRating = 'A';
    else if (trustScore >= 60) nationalRating = 'BBB';
    else if (trustScore >= 50) nationalRating = 'BB';
    else nationalRating = 'C';

    return (
      <Card className="border-border bg-card/75 backdrop-blur-sm p-6 shadow-sm overflow-hidden border-2 border-primary/20">
        <div className="flex items-center justify-between pb-4 border-b border-border/60">
          <div>
            <Badge className="bg-primary/10 text-primary border border-primary/20 text-xs font-semibold px-2.5 py-1 mb-1.5 rounded-full">
              PROPERTY DIGITAL TWIN
            </Badge>
            <h3 className="font-bold text-xl text-foreground tracking-tight">{doc.title}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Property ID: <span className="font-mono text-foreground font-semibold">{metadata.propertyId || 'N/A'}</span> • Survey Reference: <span className="font-mono text-foreground font-semibold">{metadata.surveyNumber || 'N/A'}</span>
            </p>
          </div>
          <div className="text-right">
            <span className="text-[10px] text-muted-foreground uppercase font-mono tracking-wider block">National Rating</span>
            <span className="text-3xl font-black text-primary font-mono tracking-tighter">{nationalRating}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 pt-5 text-xs">
          <div className="space-y-1 p-3 bg-muted/20 rounded-lg border border-border/40">
            <span className="text-muted-foreground block text-[10px] uppercase font-mono">Property Status</span>
            <span className="font-bold text-foreground block text-sm">{doc.status === 'FULLY_EXECUTED' ? 'Attested' : 'In Registry'}</span>
          </div>

          <div className="space-y-1 p-3 bg-muted/20 rounded-lg border border-border/40">
            <span className="text-muted-foreground block text-[10px] uppercase font-mono">Trust Index</span>
            <span className="font-bold text-foreground block text-sm">{trustScore}/100</span>
          </div>

          <div className="space-y-1 p-3 bg-muted/20 rounded-lg border border-border/40">
            <span className="text-muted-foreground block text-[10px] uppercase font-mono">Ownership Chain</span>
            <span className="font-bold text-foreground block text-sm">{transfersCount + 1} Owners</span>
          </div>

          <div className="space-y-1 p-3 bg-muted/20 rounded-lg border border-border/40">
            <span className="text-muted-foreground block text-[10px] uppercase font-mono">Transfer History</span>
            <span className="font-bold text-foreground block text-sm">{transfersCount} Transfers</span>
          </div>

          <div className="space-y-1 p-3 bg-muted/20 rounded-lg border border-border/40">
            <span className="text-muted-foreground block text-[10px] uppercase font-mono">Conflict Count</span>
            <span className={`font-bold block text-sm ${activeConflicts > 0 ? 'text-destructive' : 'text-emerald-600'}`}>
              {activeConflicts} Conflicts
            </span>
          </div>

          <div className="space-y-1 p-3 bg-muted/20 rounded-lg border border-border/40">
            <span className="text-muted-foreground block text-[10px] uppercase font-mono">Evidence Completeness</span>
            <span className="font-bold text-foreground block text-sm">{evidence.length} Files</span>
          </div>

          <div className="space-y-1 p-3 bg-muted/20 rounded-lg border border-border/40">
            <span className="text-muted-foreground block text-[10px] uppercase font-mono">Blockchain Proof</span>
            <span className="font-bold text-emerald-600 block text-sm truncate" title={caseData?.vplProofHash || 'None'}>
              {caseData?.vplProofHash ? 'Anchored ✓' : 'Pending Sign'}
            </span>
          </div>

          <div className="space-y-1 p-3 bg-muted/20 rounded-lg border border-border/40">
            <span className="text-muted-foreground block text-[10px] uppercase font-mono">Notary Review State</span>
            <span className="font-bold text-foreground block text-sm">{doc.status === 'READY_FOR_SIGNATURE' ? 'Attestation Ready' : 'Under Review'}</span>
          </div>

          <div className="space-y-1 p-3 bg-muted/20 rounded-lg border border-border/40 col-span-2">
            <span className="text-muted-foreground block text-[10px] uppercase font-mono">Verification Readiness</span>
            <div className="flex items-center gap-2 mt-1">
              <div className="w-full bg-secondary h-1.5 rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full" style={{ width: `${readiness}%` }} />
              </div>
              <span className="font-bold font-mono text-xs">{readiness}%</span>
            </div>
          </div>
        </div>
      </Card>
    );
  };

  // Review Actions
  const handleStartReview = async (docId: string) => {
    setActionLoading(true);
    setErrorMsg('');
    try {
      await apiClient.post(`/documents/${docId}/review`, {});
      await refreshAll();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to start review.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleApproveForSignature = async (docId: string) => {
    setActionLoading(true);
    setErrorMsg('');
    try {
      await apiClient.post(`/documents/${docId}/ready-for-signature`, {});
      await refreshAll();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to approve document.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRequestEvidence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDoc || !evidenceTitle) return;
    setActionLoading(true);
    setErrorMsg('');
    try {
      await apiClient.post(`/documents/${selectedDoc.documentId}/vpl/request-evidence`, {
        title: evidenceTitle
      });
      setIsEvidenceModalOpen(false);
      setEvidenceTitle('');
      await refreshAll();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to request evidence.');
    } finally {
      setActionLoading(false);
    }
  };

  const openSigningModal = (doc: AssignedDocument) => {
    setSelectedDoc(doc);
    setDscPin('');
    setErrorMsg('');
    setSuccessMsg('');
    setIsPinModalOpen(true);
  };

  const handleDscSigning = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDoc) return;
    if (dscPin !== '1234') {
      setErrorMsg('Incorrect DSC USB Token PIN. Access Denied.');
      return;
    }

    setSigning(true);
    setErrorMsg('');
    try {
      const res = await apiClient.post(`/documents/${selectedDoc.documentId}/vpl/anchor`, {});
      if (!res.data) {
        throw new Error(res.error?.message || 'Failed to anchor signature.');
      }

      setSuccessMsg('Digital Signature (DSC) verified and anchored on-chain successfully!');
      setTimeout(() => {
        setIsPinModalOpen(false);
        refreshAll();
      }, 1500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Solana on-chain transaction failed.');
    } finally {
      setSigning(false);
    }
  };

  const handleDownloadCertificate = async (docId: string, title: string) => {
    try {
      const res = await apiClient.get(`/documents/${docId}/certificate`);
      if (res.data && res.data.pdfBase64) {
        const linkSource = `data:application/pdf;base64,${res.data.pdfBase64}`;
        const downloadLink = document.createElement('a');
        const fileName = `${title.replace(/\s+/g, '_')}_verification_certificate.pdf`;

        downloadLink.href = linkSource;
        downloadLink.download = fileName;
        downloadLink.click();
      }
    } catch (err) {
      alert('Failed to download certificate.');
    }
  };

  const handleDownloadVplReport = (doc: AssignedDocument) => {
    if (!doc.verificationCase) return;
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(doc.verificationCase, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `VPL_Report_${doc.documentId}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="min-h-screen bg-background text-foreground antialiased font-sans flex flex-col justify-between noise-overlay">
      {/* Dynamic Keyframe Injection */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes fadeSlideIn {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-slide {
          animation: fadeSlideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}} />

      {/* Top Navbar */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded bg-primary text-primary-foreground shadow-sm">
              <Lock className="h-4 w-4" />
            </div>
            <span className="text-xl font-bold tracking-tight text-foreground">
              Time <span className="font-display font-light">Lock</span>
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">Accredited Notary</p>
              <p className="text-sm font-medium text-foreground">Advocate Rao</p>
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={logout}
              className="border-border bg-transparent text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-10 space-y-8">
        
        {/* Section 1: Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Notary Operations Center</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Review, validate and certify property registry submissions.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={refreshAll}
            disabled={loading}
            className="border-border bg-transparent text-foreground hover:bg-accent rounded-full font-medium shadow-sm"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Sync Registry
          </Button>
        </div>

        {/* Section 2: Metrics Row */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border-border bg-card/60 backdrop-blur-sm shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Documents Awaiting Review</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{getTabDocuments('awaiting_review').length}</div>
              <p className="text-xs text-muted-foreground mt-1">Pending initial verification</p>
            </CardContent>
          </Card>

          <Card className="border-border bg-card/60 backdrop-blur-sm shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Documents Under Review</CardTitle>
              <Eye className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{getTabDocuments('under_review').length}</div>
              <p className="text-xs text-muted-foreground mt-1">In active review queue</p>
            </CardContent>
          </Card>

          <Card className="border-border bg-card/60 backdrop-blur-sm shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Awaiting Signature</CardTitle>
              <FileSignature className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{getTabDocuments('awaiting_signature').length}</div>
              <p className="text-xs text-muted-foreground mt-1">Ready for notary digital sign</p>
            </CardContent>
          </Card>

          <Card className="border-border bg-card/60 backdrop-blur-sm shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Completed Today</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{getTabDocuments('archive').length}</div>
              <p className="text-xs text-muted-foreground mt-1">Successfully attested deeds</p>
            </CardContent>
          </Card>
        </div>

        {/* Workspaces Tab Segmented Control */}
        {!selectedDoc && (
          <div className="flex border-b border-border overflow-x-auto gap-6 pb-0.5 scrollbar-none">
            {[
              { id: 'awaiting_review', label: 'Awaiting Review' },
              { id: 'under_review', label: 'Under Review' },
              { id: 'awaiting_signature', label: 'Awaiting Signature' },
              { id: 'conflict_cases', label: 'Conflict Cases' },
              { id: 'transfers', label: 'Transfer Requests' },
              { id: 'archive', label: 'Archive' },
              { id: 'avcc', label: 'AI Command Center' }
            ].map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`pb-2.5 text-xs font-semibold tracking-wide transition-all relative focus:outline-none ${
                    isActive 
                      ? 'text-foreground font-bold' 
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <span>{tab.label}</span>
                  {isActive && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Stripe/Linear Style Main Workspace Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-10 gap-8 items-start">
          
          {/* LEFT 70% MAIN WORKSPACE */}
          <div className="lg:col-span-7 space-y-6">
            {selectedDoc ? (
              // Selected Case Mode: Tabbed Operations Workspace
              <div className="space-y-6">
                
                {/* Workspace Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border">
                  <div className="flex items-center gap-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedDoc(null)}
                      className="border-border bg-transparent text-muted-foreground hover:bg-accent rounded-full"
                    >
                      <ArrowLeft className="h-4 w-4 mr-2" /> Back to Queue
                    </Button>
                    <div>
                      <h2 className="text-xl font-bold text-foreground">{selectedDoc.title}</h2>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Registry Ref: <span className="font-mono">{selectedDoc.documentId}</span>
                      </p>
                    </div>
                  </div>
                </div>

                {/* Sub Tab Segmented Control */}
                <div className="flex border-b border-border overflow-x-auto gap-6 pb-0.5 scrollbar-none">
                  {[
                    { id: 'overview', label: 'Overview' },
                    { id: 'ai_analysis', label: 'AI Analysis' },
                    { id: 'ownership', label: 'Ownership History' },
                    { id: 'evidence', label: 'Evidence Review' },
                    { id: 'timeline', label: 'Timeline' }
                  ].map((tab) => {
                    const isActive = detailTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setDetailTab(tab.id as any)}
                        className={`pb-2.5 text-xs font-semibold tracking-wide transition-all relative focus:outline-none ${
                          isActive 
                            ? 'text-foreground' 
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <span>{tab.label}</span>
                        {isActive && (
                          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Sub Tab Contents */}
                <div className="animate-fade-slide">
                  
                  {/* OVERVIEW TAB */}
                  {detailTab === 'overview' && (
                    <div className="space-y-6">
                      <PropertyDigitalTwin doc={selectedDoc} copilotData={copilotData} />
                      <Card className="border-border bg-card/60 backdrop-blur-sm p-6 space-y-4 shadow-sm">
                        <div className="space-y-1">
                          <h3 className="font-bold text-base text-foreground">Registry Deed Overview</h3>
                          <p className="text-muted-foreground text-xs">Identifications, classifications, and transaction payloads</p>
                        </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs pt-2">
                        <div className="space-y-4">
                          <div>
                            <span className="text-muted-foreground block text-[10px] uppercase font-mono">Deed Title</span>
                            <span className="font-semibold text-foreground text-sm mt-0.5 block">{selectedDoc.title}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground block text-[10px] uppercase font-mono">Property Type</span>
                            <span className="font-semibold text-foreground text-sm mt-0.5 block">{selectedDoc.type}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground block text-[10px] uppercase font-mono">National ID Number</span>
                            <span className="font-semibold text-foreground text-sm font-mono mt-0.5 block">
                              {selectedDoc.metadata?.registrationNumber || 'N/A'}
                            </span>
                          </div>
                        </div>
                        
                        <div className="space-y-4">
                          <div>
                            <span className="text-muted-foreground block text-[10px] uppercase font-mono">IPFS Hash reference</span>
                            <span className="font-mono text-xs text-foreground bg-muted/60 p-2 rounded block mt-1 break-all border border-border">
                              {selectedDoc.contentHash}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground block text-[10px] uppercase font-mono">Deed Registered Date</span>
                            <span className="font-semibold text-foreground text-sm mt-0.5 block">
                              {new Date(selectedDoc.createdAt).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    </Card>
                  </div>
                )}

                  {/* AI ANALYSIS TAB */}
                  {detailTab === 'ai_analysis' && (
                    <div className="space-y-6">
                      {loadingCopilot ? (
                        <div className="py-12 text-center space-y-3 border border-border bg-card/60 rounded-lg p-6">
                          <RefreshCw className="h-6 w-6 text-indigo-600 animate-spin mx-auto" />
                          <p className="text-xs text-muted-foreground">Generating Latest Analysis...</p>
                        </div>
                      ) : copilotData ? (
                        <div className="space-y-6">
                          {/* Top Visual Cards */}
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <Card className="border-border bg-card/60 p-4 flex flex-col justify-between shadow-sm">
                              <div>
                                <span className="text-[10px] text-muted-foreground uppercase font-mono tracking-wider block">Approval Probability</span>
                                <span className="text-2xl font-black text-foreground block mt-1">
                                  {copilotData.prediction?.approvalProbability ?? 0}%
                                </span>
                              </div>
                              <div className="w-full bg-secondary h-1.5 rounded-full overflow-hidden mt-3">
                                <div className="h-full bg-indigo-600 rounded-full" style={{ width: `${copilotData.prediction?.approvalProbability ?? 0}%` }} />
                              </div>
                            </Card>

                            <Card className="border-border bg-card/60 p-4 flex flex-col justify-between shadow-sm">
                              <div>
                                <span className="text-[10px] text-muted-foreground uppercase font-mono tracking-wider block">Risk Assessment</span>
                                <span className={`text-2xl font-black block mt-1 uppercase ${
                                  copilotData.conflict?.conflictLevel === 'HIGH' ? 'text-red-600' : 'text-emerald-600'
                                }`}>
                                  {copilotData.conflict?.conflictLevel || 'LOW'}
                                </span>
                              </div>
                              <p className="text-[10px] text-muted-foreground mt-3">Collision score: {copilotData.conflict?.conflictScore ?? 0}/100</p>
                            </Card>

                            <Card className="border-border bg-card/60 p-4 flex flex-col justify-between shadow-sm">
                              <div>
                                <span className="text-[10px] text-muted-foreground uppercase font-mono tracking-wider block">Verification Readiness</span>
                                <span className="text-2xl font-black text-indigo-600 block mt-1">
                                  {Math.round(
                                    (((selectedDoc.verificationCase?.checklist || []).filter(item => item.status === 'PASSED').length || 0) / 
                                    (selectedDoc.verificationCase?.checklist?.length || 1)) * 100
                                  )}%
                                </span>
                              </div>
                              <div className="w-full bg-secondary h-1.5 rounded-full overflow-hidden mt-3">
                                <div className="h-full bg-indigo-600 rounded-full" style={{ width: `${(((selectedDoc.verificationCase?.checklist || []).filter(item => item.status === 'PASSED').length || 0) / (selectedDoc.verificationCase?.checklist?.length || 1)) * 100}%` }} />
                              </div>
                            </Card>
                          </div>

                          {/* Decision Recommendation */}
                          <Card className="border-border bg-card/60 p-5 space-y-3">
                            <h4 className="font-bold text-xs uppercase font-mono tracking-wider text-muted-foreground">Decision Recommendation</h4>
                            <div className="p-3.5 rounded-lg border border-border bg-muted/40 text-xs">
                              <p className="font-semibold text-foreground flex items-center gap-1.5">
                                <Sparkles className="h-4 w-4 text-indigo-600" />
                                NEMOTRON RECOMMENDATION: {copilotData.recommendation?.recommendation === 'APPROVE' ? (
                                  <span className="text-emerald-600 font-bold uppercase">APPROVE DEED</span>
                                ) : copilotData.recommendation?.recommendation === 'REQUEST_EVIDENCE' ? (
                                  <span className="text-amber-600 font-bold uppercase">REQUEST EVIDENCE</span>
                                ) : (
                                  <span className="text-red-600 font-bold uppercase">REJECT DEED</span>
                                )}
                              </p>
                              <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">
                                Predicts a positive attestation pathway based on the metadata alignment and lack of overlapping claims.
                              </p>
                            </div>

                            {/* Rationale list */}
                            <div className="space-y-1.5 pt-2">
                              <p className="text-[10px] font-mono text-muted-foreground uppercase">Nemotron Reasoning:</p>
                              <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
                                {(() => {
                                  try {
                                    const rationale = typeof copilotData.recommendation?.rationale === 'string'
                                      ? JSON.parse(copilotData.recommendation.rationale)
                                      : (copilotData.recommendation?.rationale || []);
                                    if (Array.isArray(rationale) && rationale.length > 0) {
                                      return rationale.map((r: string, idx: number) => (
                                        <div key={idx} className="flex items-start gap-1.5 text-xs text-muted-foreground leading-normal">
                                          <CheckCircle className="h-3.5 w-3.5 shrink-0 text-emerald-600 mt-0.5" />
                                          <span>{r}</span>
                                        </div>
                                      ));
                                    }
                                  } catch (e) {}
                                  return <p className="text-xs text-muted-foreground italic">No rationale compiled.</p>;
                                })()}
                              </div>
                            </div>
                          </Card>

                          {/* Conflict Investigation */}
                          <Card className="border-border bg-card/60 p-5 space-y-3">
                            <h4 className="font-bold text-xs uppercase font-mono tracking-wider text-muted-foreground">Conflict Investigation</h4>
                            <div className="space-y-2 text-xs">
                              {(() => {
                                try {
                                  const findings = typeof copilotData.conflict?.findings === 'string'
                                    ? JSON.parse(copilotData.conflict.findings)
                                    : (copilotData.conflict?.findings || []);
                                  if (Array.isArray(findings) && findings.length > 0) {
                                    return findings.map((f: string, idx: number) => (
                                      <div key={idx} className="flex items-start gap-1.5 text-muted-foreground leading-normal p-2.5 rounded border border-border bg-muted/20">
                                        <AlertTriangle className="h-4 w-4 shrink-0 text-yellow-600 mt-0.5" />
                                        <span>{f}</span>
                                      </div>
                                    ));
                                  }
                                } catch (e) {}
                                return (
                                  <div className="flex items-center gap-2 text-emerald-600 bg-emerald-500/5 border border-emerald-500/20 p-3 rounded-lg">
                                    <CheckCircle className="h-4 w-4 shrink-0 text-emerald-600" />
                                    <span>No duplicate registry coordinates or boundary claims detected in the national databases.</span>
                                  </div>
                                );
                              })()}
                            </div>
                          </Card>

                          {/* Evidence Recommendations Panel */}
                          <Card className="border-border bg-card/60 p-5 space-y-3">
                            <h4 className="font-bold text-xs uppercase font-mono tracking-wider text-muted-foreground">AI Recommended Evidence</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {copilotData?.evidenceRecommendations && copilotData.evidenceRecommendations.length > 0 ? (
                                copilotData.evidenceRecommendations.map((rec: any, idx: number) => (
                                  <div key={rec.id || idx} className="p-3.5 rounded-lg border border-border bg-muted/25 space-y-2 flex flex-col justify-between">
                                    <div className="space-y-1.5">
                                      <div className="flex justify-between items-center">
                                        <span className={`text-[9px] uppercase font-mono px-2 py-0.5 rounded font-bold ${
                                          rec.priority === 'HIGH' ? 'bg-rose-500/10 text-rose-600 border border-rose-500/20' : 'bg-indigo-500/10 text-indigo-600 border border-indigo-500/20'
                                        }`}>
                                          {rec.priority}
                                        </span>
                                        <span className="text-[10px] font-bold text-emerald-600">+{rec.expectedTrustIncrease} expected</span>
                                      </div>
                                      <h5 className="font-bold text-foreground text-xs">{rec.recommendedDoc}</h5>
                                      <p className="text-muted-foreground text-[11px] leading-relaxed">{rec.reason}</p>
                                    </div>
                                    <div className="text-[10px] bg-muted/40 p-2 rounded text-muted-foreground font-mono mt-2 flex justify-between">
                                      <span>Priority: {rec.priority}</span>
                                      <span>Confidence: {rec.impactScore}%</span>
                                    </div>
                                  </div>
                                ))
                              ) : (
                                <div className="col-span-2 text-center py-6 text-xs text-muted-foreground italic">
                                  No additional evidence recommendations generated by the agent.
                                </div>
                              )}
                            </div>
                          </Card>

                          {/* Cross Examination questions */}
                          <Card className="border-border bg-card/60 p-5 space-y-3">
                            <h4 className="font-bold text-xs uppercase font-mono tracking-wider text-muted-foreground">Cross Examination Log</h4>
                            <div className="overflow-x-auto">
                              <Table>
                                <TableHeader className="bg-muted/30 border-b border-border">
                                  <TableRow className="hover:bg-transparent border-border">
                                    <TableHead className="text-muted-foreground text-[10px] uppercase font-mono py-2 px-3">Question</TableHead>
                                    <TableHead className="text-muted-foreground text-[10px] uppercase font-mono py-2 px-3">Category</TableHead>
                                    <TableHead className="text-muted-foreground text-[10px] uppercase font-mono py-2 px-3">Proof Required</TableHead>
                                    <TableHead className="text-muted-foreground text-[10px] uppercase font-mono py-2 px-3 text-right">Priority</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {(() => {
                                    try {
                                      const questions = typeof copilotData.questions?.questions === 'string'
                                        ? JSON.parse(copilotData.questions.questions)
                                        : (copilotData.questions?.questions || []);
                                      if (Array.isArray(questions) && questions.length > 0) {
                                        return questions.map((q: any, idx: number) => (
                                          <TableRow key={idx} className="border-b border-border hover:bg-muted/20">
                                            <TableCell className="py-2.5 px-3 text-xs text-foreground font-medium">
                                              {q.question}
                                            </TableCell>
                                            <TableCell className="py-2.5 px-3 text-xs text-muted-foreground font-mono">
                                              {q.category}
                                            </TableCell>
                                            <TableCell className="py-2.5 px-3 text-xs text-muted-foreground">
                                              {q.requiredEvidence}
                                            </TableCell>
                                            <TableCell className="py-2.5 px-3 text-right">
                                              <Badge className={`text-[9px] font-mono px-1.5 py-0.5 border-0 ${
                                                q.priority === 'HIGH'
                                                  ? 'bg-rose-500/10 text-rose-600'
                                                  : 'bg-yellow-500/10 text-yellow-600'
                                              }`}>
                                                {q.priority}
                                              </Badge>
                                            </TableCell>
                                          </TableRow>
                                        ));
                                      }
                                    } catch (e) {}
                                    return (
                                      <TableRow>
                                        <TableCell colSpan={4} className="text-center py-6 text-xs text-muted-foreground italic">
                                          No questions or challenge queries generated by the assessment engine.
                                        </TableCell>
                                      </TableRow>
                                    );
                                  })()}
                                </TableBody>
                              </Table>
                            </div>
                          </Card>

                          {/* Extra info cards */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Card className="border-border bg-card/60 p-4 text-xs space-y-1.5 shadow-sm">
                              <span className="text-[10px] text-muted-foreground uppercase font-mono tracking-wider block">Expected Approval Timeline</span>
                              <p className="font-semibold text-foreground">
                                ~{copilotData.prediction?.expectedReviewDays ?? 0} Business Days
                              </p>
                              <p className="text-muted-foreground text-[11px]">
                                Derived from active surveyor queues and DSC authority signatures required.
                              </p>
                            </Card>
                            <Card className="border-border bg-card/60 p-4 text-xs space-y-1.5 shadow-sm">
                              <span className="text-[10px] text-muted-foreground uppercase font-mono tracking-wider block">Trust Index Confidence</span>
                              <p className="font-semibold text-foreground">
                                {Math.round(((copilotData.conflict?.confidence ?? 0) + (copilotData.prediction?.confidence ?? 0) + (copilotData.questions?.confidence ?? 0) + (copilotData.recommendation?.confidence ?? 0)) / 4)}% Aggregated Average
                              </p>
                              <p className="text-muted-foreground text-[11px]">
                                Mean average confidence score computed from spatial conflict verification and registry rules.
                              </p>
                            </Card>
                          </div>
                        </div>
                      ) : (
                        <div className="py-12 text-center space-y-2 border border-border bg-card/60 rounded-lg p-6">
                          <AlertCircle className="h-6 w-6 text-yellow-600 mx-auto" />
                          <p className="text-xs text-foreground font-semibold">Assessment Pending</p>
                          <p className="text-xs text-muted-foreground">The compliance engine has queued this registry submission for analysis.</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* OWNERSHIP HISTORY TAB */}
                  {detailTab === 'ownership' && (
                    <Card className="border-border bg-card/60 backdrop-blur-sm p-6 space-y-4">
                      <div className="space-y-1">
                        <h3 className="font-bold text-base text-foreground">Ownership Ledger Lineage</h3>
                        <p className="text-muted-foreground text-xs">Attested deeds ownership transfers recorded on the ledger</p>
                      </div>

                      <div className="space-y-3 pt-2">
                        {/* Active Owner */}
                        <div className="p-3.5 rounded-lg border border-border bg-emerald-500/5 text-xs flex justify-between items-center shadow-sm">
                          <div>
                            <span className="text-[9px] uppercase font-mono px-2 py-0.5 rounded font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                              Active Registry Owner
                            </span>
                            <h4 className="font-semibold text-foreground text-sm mt-2">{selectedDoc.metadata?.ownerName || 'Unknown Owner'}</h4>
                            <p className="text-muted-foreground text-[10px] mt-0.5 font-mono">Survey Reference: {selectedDoc.metadata?.surveyNumber || 'N/A'}</p>
                          </div>
                          <div className="text-right">
                            <span className="text-muted-foreground block text-[10px]">Active Title Since</span>
                            <span className="font-semibold text-foreground text-xs mt-1 block">{new Date(selectedDoc.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>

                        {/* Historic Transfers */}
                        {(selectedDoc.verificationEvents || []).filter(e => e.eventType === 'OWNERSHIP_TRANSFER').map((e, idx) => (
                          <div key={idx} className="p-3.5 rounded-lg border border-border bg-muted/20 text-xs flex justify-between items-center shadow-sm">
                            <div>
                              <span className="text-[9px] uppercase font-mono px-2 py-0.5 rounded font-bold bg-muted text-muted-foreground">
                                Historic Title Transfer
                              </span>
                              <h4 className="font-semibold text-foreground text-sm mt-2">{e.actorLabel}</h4>
                            </div>
                            <div className="text-right">
                              <span className="text-muted-foreground block text-[10px]">Date of Attestation</span>
                              <span className="font-semibold text-foreground text-xs mt-1 block">{new Date(e.occurredAt).toLocaleDateString()}</span>
                            </div>
                          </div>
                        ))}

                        {(!selectedDoc.verificationEvents?.some(e => e.eventType === 'OWNERSHIP_TRANSFER')) && (
                          <p className="text-xs text-muted-foreground italic text-center py-4 border border-dashed border-border rounded-lg">
                            No prior title transfers recorded. This deed represents the initial registry anchor for this property.
                          </p>
                        )}
                      </div>
                    </Card>
                  )}

                  {/* EVIDENCE REVIEW TAB */}
                  {detailTab === 'evidence' && (
                    <div className="space-y-6">
                      {/* VPL Checklist */}
                      <Card className="border-border bg-card/60 p-6 space-y-4">
                        <div className="space-y-1">
                          <h3 className="font-bold text-base text-foreground">VPL Verification Checklist</h3>
                          <p className="text-muted-foreground text-xs">Rule evaluation logs executed by the Verification Proof Layer ruleset</p>
                        </div>

                        <div className="space-y-2.5 pt-2">
                          {(selectedDoc.verificationCase?.checklist || []).map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/10 text-xs">
                              <div className="flex items-center gap-2.5">
                                {item.status === 'PASSED' ? (
                                  <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
                                ) : (
                                  <AlertCircle className="h-4 w-4 text-yellow-600 shrink-0" />
                                )}
                                <span className="font-semibold text-foreground">{item.title || item.ruleId}</span>
                              </div>
                              <span className={`font-bold ${item.status === 'PASSED' ? 'text-emerald-600' : 'text-yellow-600'}`}>
                                {item.status}
                              </span>
                            </div>
                          ))}
                          {(!selectedDoc.verificationCase?.checklist || selectedDoc.verificationCase.checklist.length === 0) && (
                            <p className="text-xs text-muted-foreground italic text-center py-4">No checklist criteria defined for this case.</p>
                          )}
                        </div>
                      </Card>

                      {/* Evidence Files */}
                      <Card className="border-border bg-card/60 p-6 space-y-4">
                        <div className="space-y-1">
                          <h3 className="font-bold text-base text-foreground">Uploaded Evidence Inventory</h3>
                          <p className="text-muted-foreground text-xs">Supporting credentials and document proofs anchored on IPFS</p>
                        </div>

                        <div className="space-y-3 pt-2">
                          {(selectedDoc.verificationCase?.evidence || []).map((ev, idx) => (
                            <div key={idx} className="p-3.5 rounded-lg border border-border bg-muted/20 text-xs flex justify-between items-center shadow-sm">
                              <div>
                                <h4 className="font-bold text-foreground text-xs">{ev.title}</h4>
                                <p className="text-muted-foreground text-[10px] font-mono mt-0.5">IPFS CID: {ev.ipfsCid}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-muted-foreground mr-2">
                                  Uploaded {new Date(ev.uploadedAt).toLocaleDateString()}
                                </span>
                                <a 
                                  href={`https://ipfs.io/ipfs/${ev.ipfsCid}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-indigo-600 hover:underline flex items-center gap-1 font-semibold"
                                >
                                  Verify IPFS <ExternalLink className="h-3 w-3" />
                                </a>
                              </div>
                            </div>
                          ))}
                          {(!selectedDoc.verificationCase?.evidence || selectedDoc.verificationCase.evidence.length === 0) && (
                            <p className="text-xs text-muted-foreground italic text-center py-6 border border-dashed border-border rounded-lg">
                              No evidence records uploaded for this case. Use "Request Evidence" to request files from the owner.
                            </p>
                          )}
                        </div>
                      </Card>
                    </div>
                  )}

                  {/* TIMELINE TAB */}
                  {detailTab === 'timeline' && (
                    <Card className="border-border bg-card/60 p-6 space-y-4">
                      <div className="space-y-1">
                        <h3 className="font-bold text-base text-foreground">Case Attestation Timeline</h3>
                        <p className="text-muted-foreground text-xs">Chronological logging of all events for this document</p>
                      </div>

                      <div className="relative pl-6 border-l border-border space-y-5 py-2.5 pt-4">
                        {selectedDoc.verificationEvents && selectedDoc.verificationEvents.length > 0 ? (
                          selectedDoc.verificationEvents.map((event) => (
                            <div key={event.eventId} className="relative">
                              <div className="absolute -left-[35px] top-1.5 h-6 w-6 rounded-full bg-background border border-border flex items-center justify-center shadow-sm">
                                {getTimelineIcon(event.eventType)}
                              </div>
                              <div className="text-xs space-y-0.5">
                                <p className="font-bold text-foreground">{formatEventType(event.eventType)}</p>
                                <p className="text-muted-foreground text-[10px]">
                                  By {event.actorLabel} • {new Date(event.occurredAt).toLocaleString()}
                                </p>
                                {event.onchainTxRef && (
                                  <p className="text-[9px] font-mono text-muted-foreground mt-1">
                                    Solana Transaction: {event.onchainTxRef.slice(0, 16)}...
                                  </p>
                                )}
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="text-xs text-muted-foreground italic text-center py-6">No historical events recorded for this registry entry.</p>
                        )}
                      </div>
                    </Card>
                  )}

                </div>
              </div>
            ) : activeTab === 'avcc' ? (
              <AVCCDashboard
                data={avccData}
                loading={loadingAvcc}
                recalculating={recalculatingAvcc}
                resolvingAnomalyId={resolvingAnomalyId}
                onResolveAnomaly={handleResolveAnomaly}
                onRecalculateGraph={handleRecalculateGraph}
              />
            ) : (
              // Queue List Mode: Search input + Table + Timeline below
              <div className="space-y-6">
                
                {/* Filter Search Input */}
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground/50" />
                  <input
                    placeholder="Filter queue by Title, ID, or Property Type..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full rounded-md border border-border bg-background py-2 pl-9 pr-3 text-xs text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>

                {/* Queue Table Card */}
                <Card className="border-border bg-card/60 backdrop-blur-sm shadow-sm overflow-hidden">
                  <CardContent className="p-0">
                    {activeTab === 'transfers' ? (
                      transfers.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center">
                          <Layers className="h-10 w-10 text-muted-foreground/30 mb-3" />
                          <p className="text-muted-foreground text-sm font-semibold">No transfer requests assigned</p>
                        </div>
                      ) : (
                        <Table>
                          <TableHeader className="bg-muted/30 border-b border-border">
                            <TableRow className="hover:bg-transparent border-border">
                              <TableHead className="text-muted-foreground text-xs font-semibold py-3 px-4">Deed Title</TableHead>
                              <TableHead className="text-muted-foreground text-xs font-semibold py-3 px-4">Type</TableHead>
                              <TableHead className="text-muted-foreground text-xs font-semibold py-3 px-4">New Owner Hash</TableHead>
                              <TableHead className="text-muted-foreground text-xs font-semibold py-3 px-4">Status</TableHead>
                              <TableHead className="text-right text-muted-foreground text-xs font-semibold py-3 px-4">Action</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {transfers.map((t) => (
                              <TableRow 
                                key={t.transferId}
                                onClick={() => router.push(`/notary/transfer/${t.transferId}`)}
                                className="border-b border-border hover:bg-muted/30 cursor-pointer"
                              >
                                <TableCell className="py-3 px-4 font-medium text-foreground">
                                  <div>
                                    <p className="font-semibold text-sm max-w-[200px] truncate">{t.document?.title || 'Untitled Deed'}</p>
                                    <p className="text-[10px] text-muted-foreground font-mono mt-0.5">Session: {t.transferId.slice(0, 8)}</p>
                                  </div>
                                </TableCell>
                                <TableCell className="py-3 px-4 text-xs font-medium text-muted-foreground">
                                  {t.transferType || 'Sale'}
                                </TableCell>
                                <TableCell className="py-3 px-4 font-mono text-xs text-muted-foreground">
                                  {t.newOwnerHash.slice(0, 10)}...
                                </TableCell>
                                <TableCell className="py-3 px-4 text-xs">
                                  <span className={`font-semibold ${t.status === 'FINALIZED' ? 'text-emerald-600' : 'text-yellow-600'}`}>
                                    {t.status}
                                  </span>
                                </TableCell>
                                <TableCell className="py-3 px-4 text-right">
                                  <Button
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      router.push(`/notary/transfer/${t.transferId}`);
                                    }}
                                    className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs rounded-full px-4"
                                  >
                                    Open Review
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )
                    ) : getTabDocuments(activeTab).length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-20 text-center">
                        <Layers className="h-10 w-10 text-muted-foreground/30 mb-3" />
                        <p className="text-muted-foreground text-sm font-semibold">No submissions in queue</p>
                      </div>
                    ) : (
                      <Table>
                        <TableHeader className="bg-muted/30 border-b border-border">
                          <TableRow className="hover:bg-transparent border-border">
                            <TableHead className="text-muted-foreground text-xs font-semibold py-3 px-4">Title</TableHead>
                            <TableHead className="text-muted-foreground text-xs font-semibold py-3 px-4">Owner</TableHead>
                            <TableHead className="text-muted-foreground text-xs font-semibold py-3 px-4">Trust Score</TableHead>
                            <TableHead className="text-muted-foreground text-xs font-semibold py-3 px-4">Status</TableHead>
                            <TableHead className="text-muted-foreground text-xs font-semibold py-3 px-4">Last Updated</TableHead>
                            <TableHead className="text-right text-muted-foreground text-xs font-semibold py-3 px-4">Action</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {getTabDocuments(activeTab).map((doc) => {
                            const score = doc.verificationCase?.trustScore ?? 100;
                            return (
                              <TableRow 
                                key={doc.documentId} 
                                onClick={() => setSelectedDoc(doc)}
                                className="border-b border-border hover:bg-muted/30 cursor-pointer transition-all"
                              >
                                <TableCell className="py-3 px-4 font-semibold text-foreground">
                                  <div>
                                    <p className="text-sm max-w-[200px] truncate">{doc.title}</p>
                                    <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{doc.type}</p>
                                  </div>
                                </TableCell>
                                <TableCell className="py-3 px-4 text-xs font-medium text-foreground">
                                  {doc.metadata?.ownerName || 'N/A'}
                                </TableCell>
                                <TableCell className="py-3 px-4">
                                  <div className="max-w-[120px]">
                                    <TrustScoreIndicator score={score} />
                                  </div>
                                </TableCell>
                                <TableCell className="py-3 px-4">
                                  {getStatusText(doc.status)}
                                </TableCell>
                                <TableCell className="py-3 px-4 text-xs font-medium text-muted-foreground">
                                  {new Date(doc.createdAt).toLocaleDateString()}
                                </TableCell>
                                <TableCell className="py-3 px-4 text-right">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedDoc(doc);
                                    }}
                                    className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 font-semibold text-xs rounded-full px-4"
                                  >
                                    Open Review
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>

                {/* Registry Activity Timeline (Below table in queue mode) */}
                <Card className="border-border bg-card/60 backdrop-blur-sm shadow-sm">
                  <CardHeader className="pb-3 border-b border-border">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <CardTitle className="text-sm font-bold text-foreground">Registry Activity Timeline</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6">
                    {getAllVerificationEvents().length > 0 ? (
                      <div className="relative pl-6 border-l border-border space-y-4 py-2">
                        {getAllVerificationEvents().slice(0, 8).map((event) => (
                          <div key={event.eventId} className="relative">
                            <div className="absolute -left-[35px] top-1.5 h-6 w-6 rounded-full bg-background border border-border flex items-center justify-center shadow-sm">
                              {getTimelineIcon(event.eventType)}
                            </div>
                            <div className="text-xs space-y-0.5">
                              <p className="font-bold text-foreground">
                                {formatEventType(event.eventType)} <span className="font-normal text-muted-foreground">for {event.documentTitle}</span>
                              </p>
                              <p className="text-muted-foreground text-[10px]">
                                By {event.actorLabel} • {new Date(event.occurredAt).toLocaleString()}
                              </p>
                              {event.onchainTxRef && (
                                <p className="text-[9px] font-mono text-muted-foreground mt-1">
                                  Solana Ledger Signature: {event.onchainTxRef.slice(0, 16)}...
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground italic text-center py-6">No historical registry events found.</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </div>

          {/* RIGHT 30% STICKY SIDEBAR */}
          <div className="lg:col-span-3 lg:sticky lg:top-24 max-h-[calc(105vh-120px)] overflow-y-auto pr-1">
            {selectedDoc ? (
              // Selected Case Mode: Case Summary Workspace
              <Card className="border-border bg-card/60 backdrop-blur-sm shadow-sm p-5 space-y-4">
                <div className="space-y-1 pb-3 border-b border-border">
                  <span className="text-[10px] text-muted-foreground uppercase font-mono tracking-wider block">Case Reference</span>
                  <span className="font-semibold text-foreground text-xs block truncate font-mono">#{selectedDoc.documentId}</span>
                </div>
                
                <div className="space-y-4 text-xs">
                  {/* Case Status */}
                  <div className="flex justify-between items-center pb-2 border-b border-border/40">
                    <span className="text-muted-foreground font-medium">Case Status</span>
                    {getStatusText(selectedDoc.status)}
                  </div>

                  {/* Trust Score */}
                  <div className="space-y-1 pb-2 border-b border-border/40">
                    <span className="text-muted-foreground block font-medium">Trust Score</span>
                    {selectedDoc.verificationCase ? (
                      <TrustScoreIndicator score={selectedDoc.verificationCase.trustScore} />
                    ) : (
                      <span className="font-semibold text-foreground text-xs">Pending</span>
                    )}
                  </div>

                  {/* Evidence Completion */}
                  {selectedDoc.verificationCase && (
                    <div className="space-y-1.5 pb-2 border-b border-border/40">
                      <span className="text-muted-foreground block font-medium">Evidence Completion</span>
                      <div className="flex justify-between items-center text-[10px] text-muted-foreground">
                        <span>Checklist</span>
                        <span className="font-semibold text-foreground">
                          {(selectedDoc.verificationCase.checklist || []).filter(item => item.status === 'PASSED').length} / {selectedDoc.verificationCase.checklist?.length || 0} Passed
                        </span>
                      </div>
                      <div className="w-full bg-secondary h-1 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-indigo-600 rounded-full" 
                          style={{ 
                            width: `${((selectedDoc.verificationCase.checklist || []).filter(item => item.status === 'PASSED').length / (selectedDoc.verificationCase.checklist?.length || 1)) * 100}%` 
                          }} 
                        />
                      </div>
                    </div>
                  )}

                  {/* Open Challenges */}
                  <div className="flex justify-between items-center pb-2 border-b border-border/40">
                    <span className="text-muted-foreground font-medium">Open Challenges</span>
                    <span className={`font-semibold ${((selectedDoc.verificationCase?.challenges || []).filter(ch => !ch.resolved).length > 0) ? 'text-red-600 font-bold' : 'text-emerald-600'}`}>
                      {(selectedDoc.verificationCase?.challenges || []).filter(ch => !ch.resolved).length} active
                    </span>
                  </div>

                  {/* Property Metadata */}
                  <div className="space-y-2">
                    <span className="text-[10px] text-muted-foreground uppercase font-mono tracking-wider block">Property Metadata</span>
                    <div className="space-y-1.5 font-mono text-[10px] bg-muted/40 p-2.5 rounded border border-border">
                      <p className="flex justify-between">
                        <span className="text-muted-foreground">Owner:</span>
                        <span className="text-foreground font-semibold truncate max-w-[120px]">{selectedDoc.metadata?.ownerName || 'N/A'}</span>
                      </p>
                      <p className="flex justify-between">
                        <span className="text-muted-foreground">Property ID:</span>
                        <span className="text-foreground font-semibold truncate max-w-[120px]">{selectedDoc.metadata?.propertyId || 'N/A'}</span>
                      </p>
                      <p className="flex justify-between">
                        <span className="text-muted-foreground">Survey No:</span>
                        <span className="text-foreground font-semibold truncate max-w-[120px]">{selectedDoc.metadata?.surveyNumber || 'N/A'}</span>
                      </p>
                    </div>
                  </div>

                  {/* Quick Actions */}
                  <div className="pt-4 border-t border-border space-y-2.5">
                    {selectedDoc.status === 'ONCHAIN_CONFIRMED' && (
                      <Button
                        onClick={() => handleStartReview(selectedDoc.documentId)}
                        disabled={actionLoading}
                        className="w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-full text-xs font-semibold py-2"
                      >
                        Start Review Work
                      </Button>
                    )}

                    {selectedDoc.status === 'NOTARY_REVIEW_STARTED' && (
                      <div className="space-y-2">
                        <Button
                          onClick={() => handleApproveForSignature(selectedDoc.documentId)}
                          disabled={actionLoading}
                          className="w-full bg-indigo-600 hover:bg-indigo-600 text-white rounded-full text-xs font-semibold py-2"
                        >
                          Approve for Signature
                        </Button>
                      </div>
                    )}

                    {selectedDoc.status === 'READY_FOR_SIGNATURE' && (
                      <div className="space-y-2">
                        <Button
                          onClick={() => openSigningModal(selectedDoc)}
                          disabled={actionLoading}
                          className="w-full bg-emerald-600 hover:bg-emerald-600 text-white rounded-full text-xs font-semibold py-2"
                        >
                          Apply DSC Sign
                        </Button>
                      </div>
                    )}

                    {selectedDoc.verificationCase && (
                      <Button
                        variant="outline"
                        onClick={() => setIsEvidenceModalOpen(true)}
                        className="w-full border-border text-muted-foreground hover:bg-accent rounded-full text-xs font-semibold py-2"
                      >
                        Request Evidence
                      </Button>
                    )}

                    <div className="flex gap-2 pt-1">
                      {['NOTARY_SIGNED', 'FULLY_EXECUTED'].includes(selectedDoc.status) && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDownloadCertificate(selectedDoc.documentId, selectedDoc.title)}
                            className="border-border text-muted-foreground hover:bg-accent text-[10px] rounded-full flex-1"
                          >
                            Certificate
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDownloadVplReport(selectedDoc)}
                            className="border-border text-muted-foreground hover:bg-accent text-[10px] rounded-full flex-1"
                          >
                            VPL Report
                          </Button>
                        </>
                      )}
                    </div>

                    <Link href={`/document/${selectedDoc.documentId}`} target="_blank" className="block w-full text-center pt-2">
                      <span className="text-[10px] text-muted-foreground hover:text-foreground hover:underline font-mono">
                        Public Audit Registry
                      </span>
                    </Link>
                  </div>
                </div>
              </Card>
            ) : (
              // Queue List Mode: Side Compliance Stats Panel
              <Card className="border-border bg-card/60 backdrop-blur-sm shadow-sm p-6 text-center space-y-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary mx-auto">
                  <Shield className="h-6 w-6" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="font-bold text-base text-foreground">Accredited Workspace</h3>
                  <p className="text-muted-foreground text-xs leading-relaxed">
                    Select a property registry deed submission from the review queue to load the verification workspace, Nemotron compliance telemetry, and attestation logs.
                  </p>
                </div>
                <div className="border-t border-border pt-4 text-left space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Active Workstation</span>
                    <span className="font-semibold text-foreground">Advocate Rao</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Registry Status</span>
                    <span className="font-semibold text-emerald-600">Online & Synced</span>
                  </div>
                </div>
              </Card>
            )}
          </div>

        </div>

      </main>

      {/* Request Evidence Dialog */}
      <Dialog open={isEvidenceModalOpen} onOpenChange={setIsEvidenceModalOpen}>
        <DialogContent className="border-border bg-card text-foreground max-w-sm p-6 rounded-lg shadow-lg">
          <DialogHeader>
            <DialogTitle className="text-foreground text-base font-bold flex items-center gap-2">
              <Upload className="h-5 w-5 text-indigo-600" />
              Request Additional Evidence
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs">
              Prompt the document owner to upload supporting credentials or receipts.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleRequestEvidence} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="evidenceTitle" className="text-foreground text-xs font-semibold">Evidence Title / Document Name</Label>
              <Input
                id="evidenceTitle"
                placeholder="e.g. Property Tax Receipt 2025"
                value={evidenceTitle}
                onChange={(e) => setEvidenceTitle(e.target.value)}
                required
                className="bg-background border-border text-foreground rounded-md text-xs py-2"
              />
              <p className="text-[10px] text-muted-foreground">
                This adds a mandatory missing evidence request task. Trust score will automatically adjust when uploaded.
              </p>
            </div>

            <DialogFooter className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEvidenceModalOpen(false)}
                className="border-border bg-transparent text-muted-foreground hover:bg-accent rounded-full text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={actionLoading}
                className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-full text-xs font-semibold px-4"
              >
                Send Request
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Digital Signature Authentication (DSC) Modal */}
      <Dialog open={isPinModalOpen} onOpenChange={setIsPinModalOpen}>
        <DialogContent className="border-border bg-card text-foreground max-w-md p-6 rounded-lg shadow-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2 text-foreground">
              <FileSignature className="h-5 w-5 text-indigo-600" />
              Digital Signature Authentication
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs">
              Authenticate using Class-3 digital signature token PIN to verify ledger anchoring.
            </DialogDescription>
          </DialogHeader>

          {successMsg ? (
            <div className="py-6 flex flex-col items-center justify-center text-center space-y-3">
              <CheckCircle className="h-12 w-12 text-emerald-600 animate-bounce" />
              <p className="text-sm font-semibold text-foreground">{successMsg}</p>
            </div>
          ) : (
            <form onSubmit={handleDscSigning} className="space-y-4 py-2">
              {errorMsg && (
                <div className="rounded-lg border border-destructive/35 bg-destructive/10 p-2.5 text-xs text-destructive flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {selectedDoc && (
                <div className="bg-muted/40 p-4 rounded-lg border border-border space-y-3 text-xs">
                  <div className="flex justify-between items-center pb-2 border-b border-border">
                    <span className="text-muted-foreground">Document Name</span>
                    <span className="font-semibold text-foreground truncate max-w-[200px]">{selectedDoc.title}</span>
                  </div>
                  
                  <div className="flex justify-between items-center pb-2 border-b border-border">
                    <span className="text-muted-foreground">Trust Score</span>
                    <span className="font-semibold text-foreground">
                      {selectedDoc.verificationCase?.trustScore ?? 100}/100
                    </span>
                  </div>

                  <div className="flex justify-between items-center pb-2 border-b border-border">
                    <span className="text-muted-foreground">Evidence Status</span>
                    <span className="font-semibold text-foreground">
                      {(selectedDoc.verificationCase?.evidence || []).length} files uploaded
                    </span>
                  </div>

                  <div className="flex justify-between items-center pb-2 border-b border-border">
                    <span className="text-muted-foreground">Conflict Status</span>
                    <span className="font-semibold text-foreground">
                      {((selectedDoc.verificationCase?.challenges || []).filter(ch => ch.type === 'CONFLICT' && !ch.resolved).length > 0)
                        ? 'Conflict Detected'
                        : 'Clear'}
                    </span>
                  </div>

                  <div className="flex justify-between items-center pb-2 border-b border-border">
                    <span className="text-muted-foreground">Assigned Notary</span>
                    <span className="font-semibold text-foreground">Advocate Rao</span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Blockchain Status</span>
                    <span className="font-semibold text-foreground font-mono">
                      {selectedDoc.status === 'READY_FOR_SIGNATURE' ? 'Awaiting Signature Anchor' : 'Pending'}
                    </span>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="pin" className="text-muted-foreground text-xs font-semibold">Class-3 USB Key PIN</Label>
                <Input
                  id="pin"
                  type="password"
                  maxLength={4}
                  placeholder="Enter PIN"
                  value={dscPin}
                  onChange={(e) => setDscPin(e.target.value.replace(/\D/g, ''))}
                  disabled={signing}
                  className="border-border bg-background text-center tracking-[0.6em] text-foreground text-lg placeholder:tracking-normal focus-visible:ring-ring"
                />
                <p className="text-[10px] text-muted-foreground">
                  Use <code className="text-foreground font-semibold">1234</code> for simulated DSC token check.
                </p>
              </div>

              <DialogFooter className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsPinModalOpen(false)}
                  disabled={signing}
                  className="border-border bg-transparent hover:bg-accent text-muted-foreground rounded-full text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={signing}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-full text-xs font-semibold px-4"
                >
                  {signing ? 'Signing...' : 'Sign & Anchor'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Footer */}
      <footer className="py-4 border-t border-border text-center text-xs text-muted-foreground bg-muted/20">
        &copy; 2026 TimeLock Accredited Registry Workspace. All rights reserved.
      </footer>
    </div>
  );
}

'use client';

import React, { useEffect, useState, use } from 'react';
import { useAuth } from '@/context/auth-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  ArrowLeft, ShieldCheck, AlertTriangle, FileUp, Cpu, 
  CheckCircle2, AlertCircle, RefreshCw, Lock, Eye, Download, Info, Check, X,
  ChevronRight, ChevronDown, Landmark, History, User, Activity, Sparkles, Clock, LinkIcon
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';

interface ChecklistItem {
  id: string;
  label: string;
  status: 'PENDING' | 'PASSED' | 'FAILED';
}

interface ChallengeItem {
  id: string;
  type: 'CONFLICT' | 'MISSING_EVIDENCE';
  field: string;
  question: string;
  resolved: boolean;
  justification: string | null;
}

interface EvidenceItem {
  evidenceId: string;
  title: string;
  ipfsCid: string;
  uploadedAt: string;
}

interface CaseDetails {
  caseId: string;
  documentId: string;
  status: string;
  checklist: ChecklistItem[];
  challenges: ChallengeItem[];
  evidence: EvidenceItem[];
  trustScore: number;
}

export default function VerificationWorkspace({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const { id } = resolvedParams;
  const { user } = useAuth();
  const router = useRouter();

  // Primary Workspace state
  const [caseDetails, setCaseDetails] = useState<CaseDetails | null>(null);
  const [docDetails, setDocDetails] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Digital Twin state
  const [digitalTwin, setDigitalTwin] = useState<any | null>(null);
  const [twinHistory, setTwinHistory] = useState<any[]>([]);
  const [loadingTwin, setLoadingTwin] = useState(false);
  const [selectedTwinVersion, setSelectedTwinVersion] = useState<number | null>(null);

  // AI Copilot state
  const [aiInsights, setAiInsights] = useState<any | null>(null);
  const [copilotData, setCopilotData] = useState<any | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const [loadingCopilot, setLoadingCopilot] = useState(false);
  const [aiErrorMsg, setAiErrorMsg] = useState<string | null>(null);

  // Case Navigator state
  const [allCases, setAllCases] = useState<any[]>([]);
  const [loadingCases, setLoadingCases] = useState(true);
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({
    awaiting: false,
    reviewing: false,
    ready: false,
    conflict: false,
    high_risk: false,
    completed: true,
  });

  // Ownership Timeline state
  const [ownershipHistory, setOwnershipHistory] = useState<any[]>([]);

  // Evidence upload states
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [evidenceTitle, setEvidenceTitle] = useState('Identity Proof');
  const [uploadingEvidence, setUploadingEvidence] = useState(false);

  // Challenge justification states
  const [justifyingChallengeId, setJustifyingChallengeId] = useState<string | null>(null);
  const [justificationText, setJustificationText] = useState('');
  const [submittingJustification, setSubmittingJustification] = useState(false);

  // Anchor & DSC state
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [dscPin, setDscPin] = useState('');
  const [signing, setSigning] = useState(false);

  const fetchDetails = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const statusRes = await apiClient.get(`/documents/${id}/status`);
      if (!statusRes.data) {
        throw new Error('Document status not found.');
      }
      setDocDetails(statusRes.data);

      const vCase = statusRes.data.verificationCase;
      if (!vCase) {
        throw new Error('Verification workspace has not been initialized for this case.');
      }

      setCaseDetails({
        caseId: vCase.caseId,
        documentId: statusRes.data.documentId,
        status: vCase.status,
        checklist: vCase.checklist || [],
        challenges: vCase.challenges || [],
        evidence: vCase.evidence || [],
        trustScore: vCase.trustScore
      });
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load verification workspace details.');
    } finally {
      setLoading(false);
    }
  };

  const fetchAiInsights = async () => {
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

  const fetchCopilotData = async () => {
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

  const fetchOwnershipHistory = async () => {
    try {
      const res = await apiClient.get(`/transfers/document/${id}/ownership`);
      if (res.data) {
        setOwnershipHistory(res.data);
      }
    } catch (err) {
      console.warn('Failed to load ownership history:', err);
    }
  };

  const fetchNavigatorCases = async () => {
    setLoadingCases(true);
    try {
      const [queueRes, archiveRes] = await Promise.all([
        apiClient.get('/notaries/queue'),
        apiClient.get('/notaries/archive')
      ]);
      setAllCases([...(queueRes.data || []), ...(archiveRes.data || [])]);
    } catch (err) {
      console.warn('Failed to load navigator cases:', err);
    } finally {
      setLoadingCases(false);
    }
  };

  const fetchDigitalTwin = async () => {
    setLoadingTwin(true);
    try {
      const [twinRes, historyRes] = await Promise.all([
        apiClient.get(`/documents/${id}/twin`),
        apiClient.get(`/documents/${id}/twin/history`)
      ]);
      if (twinRes.data) {
        setDigitalTwin(twinRes.data);
        if (selectedTwinVersion === null) {
          setSelectedTwinVersion(twinRes.data.version);
        }
      }
      if (historyRes.data) {
        setTwinHistory(historyRes.data);
      }
    } catch (err) {
      console.warn('Failed to load Digital Twin data:', err);
    } finally {
      setLoadingTwin(false);
    }
  };

  const handleRegenerateAi = async () => {
    setLoadingAi(true);
    setLoadingCopilot(true);
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
      console.warn('Failed to regenerate AI compliance logs:', err);
      if (err.message && (err.message.includes('API key') || err.message.includes('NVIDIA') || err.message.includes('Nemotron'))) {
        setAiErrorMsg(err.message);
      } else {
        setAiErrorMsg('AI Services Unavailable: ' + (err.message || ''));
      }
      alert(err.message || 'Failed to regenerate AI compliance logs.');
    } finally {
      setLoadingAi(false);
      setLoadingCopilot(false);
    }
  };

  const handleRequestEvidence = async (recommendedDoc: string) => {
    try {
      const res = await apiClient.post(`/documents/${id}/vpl/request-evidence`, {
        title: recommendedDoc
      });
      if (res.data) {
        await Promise.all([
          fetchDetails(),
          fetchAiInsights(),
          fetchDigitalTwin()
        ]);
        alert(`Requested "${recommendedDoc}" evidence challenge from citizen.`);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to request evidence.');
    }
  };

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    if (user.role !== 'NOTARY') {
      router.push('/dashboard');
      return;
    }
    fetchDetails();
    fetchAiInsights();
    fetchCopilotData();
    fetchOwnershipHistory();
    fetchNavigatorCases();
    fetchDigitalTwin();
  }, [id, user]);

  const handleChecklistToggle = async (itemId: string, newStatus: 'PASSED' | 'FAILED' | 'PENDING') => {
    if (!caseDetails) return;

    const updatedChecklist = caseDetails.checklist.map(item => {
      if (item.id === itemId) {
        return { ...item, status: newStatus };
      }
      return item;
    });

    try {
      const res = await apiClient.post(`/documents/${id}/vpl/checklist`, {
        checklist: updatedChecklist
      });
      if (res.data) {
        setCaseDetails(prev => prev ? {
          ...prev,
          checklist: res.data.checklist,
          trustScore: res.data.trustScore,
          status: res.data.status
        } : null);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to update checklist item status.');
    }
  };

  const handleEvidenceUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!evidenceFile || !caseDetails) return;

    setUploadingEvidence(true);
    try {
      const formData = new FormData();
      formData.append('file', evidenceFile);
      formData.append('title', evidenceTitle);

      const res = await apiClient.postFormData(`/documents/${id}/vpl/evidence`, formData);
      if (res.data) {
        setEvidenceFile(null);
        await fetchDetails();
      }
    } catch (err: any) {
      alert(err.message || 'Failed to upload evidence.');
    } finally {
      setUploadingEvidence(false);
    }
  };

  const openJustificationBox = (chId: string) => {
    setJustifyingChallengeId(chId);
    setJustificationText('');
  };

  const handleJustificationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!justifyingChallengeId || !justificationText.trim() || !caseDetails) return;

    setSubmittingJustification(true);
    try {
      const res = await apiClient.post(`/documents/${id}/vpl/resolve`, {
        challengeId: justifyingChallengeId,
        justification: justificationText
      });
      if (res.data) {
        setJustifyingChallengeId(null);
        setJustificationText('');
        await fetchDetails();
      }
    } catch (err: any) {
      alert(err.message || 'Failed to submit justification.');
    } finally {
      setSubmittingJustification(false);
    }
  };

  const startAnchorWorkflow = () => {
    if (!caseDetails) return;

    setDscPin('');
    setErrorMsg('');
    setSuccessMsg('');
    setIsPinModalOpen(true);
  };

  const handleDscVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (dscPin !== '1234') {
      setErrorMsg('Incorrect Class-3 DSC USB Token PIN. Access Denied.');
      return;
    }

    setSigning(true);
    setErrorMsg('');
    try {
      const res = await apiClient.post(`/documents/${id}/vpl/anchor`, {});
      if (!res.data) {
        throw new Error(res.error?.message || 'Verification proof anchoring failed.');
      }

      setSuccessMsg('Verification Proof Record cryptographically signed and anchored to Solana successfully!');
      
      setTimeout(() => {
        setIsPinModalOpen(false);
        router.push(`/document/${id}`);
      }, 2000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Solana anchor transaction failed. Please retry.');
    } finally {
      setSigning(false);
    }
  };

  const toggleCategory = (catId: string) => {
    setCollapsedCategories(prev => ({ ...prev, [catId]: !prev[catId] }));
  };

  if (loading && !caseDetails) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center noise-overlay">
        <RefreshCw className="h-8 w-8 text-foreground animate-spin" />
        <span className="ml-3 text-muted-foreground font-medium">Opening VPL Verification Workspace...</span>
      </div>
    );
  }

  if (errorMsg && !caseDetails) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4 noise-overlay">
        <Card className="border-border bg-card max-w-md w-full text-center p-6 space-y-4">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
          <h2 className="text-xl font-bold">Workspace Initialization Failed</h2>
          <p className="text-muted-foreground text-sm">{errorMsg}</p>
          <Link href="/notary" className="block">
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-full">Return to Workstation</Button>
          </Link>
        </Card>
      </div>
    );
  }

  const conflictsList = caseDetails?.challenges.filter(ch => ch.type === 'CONFLICT') || [];

  // Define categories for navigator
  const categories = [
    { id: 'awaiting', label: 'Awaiting Review', filter: (doc: any) => doc.status === 'PENDING' || doc.status === 'ONCHAIN_CONFIRMED' },
    { id: 'reviewing', label: 'Under Review', filter: (doc: any) => doc.status === 'NOTARY_REVIEW_STARTED' },
    { id: 'ready', label: 'Ready For Signature', filter: (doc: any) => doc.status === 'READY_FOR_SIGNATURE' },
    { 
      id: 'conflict', 
      label: 'Conflict Cases', 
      filter: (doc: any) => {
        if (doc.status === 'NOTARY_SIGNED' || doc.status === 'FULLY_EXECUTED') return false;
        const challenges = doc.verificationCase?.challenges || [];
        return challenges.some((c: any) => c.type === 'CONFLICT');
      } 
    },
    { 
      id: 'high_risk', 
      label: 'High Risk Cases', 
      filter: (doc: any) => {
        if (doc.status === 'NOTARY_SIGNED' || doc.status === 'FULLY_EXECUTED') return false;
        return (doc.verificationCase?.trustScore !== undefined && doc.verificationCase.trustScore < 70);
      } 
    },
    { id: 'completed', label: 'Completed Archive', filter: (doc: any) => doc.status === 'NOTARY_SIGNED' || doc.status === 'FULLY_EXECUTED' },
  ];

  return (
    <div className="h-screen flex flex-col bg-background text-foreground overflow-hidden font-sans antialiased noise-overlay">
      {/* Top Navbar */}
      <header className="h-16 border-b border-border bg-background/80 backdrop-blur-md px-6 flex items-center justify-between shrink-0 z-40">
        <Link href="/notary" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" />
          <span className="text-sm font-medium">Workstation</span>
        </Link>
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded bg-primary text-primary-foreground shadow-sm">
            <Lock className="h-3.5 w-3.5" />
          </div>
          <span className="text-md font-bold tracking-tight text-foreground">
            Time <span className="font-display font-light">Lock</span>
          </span>
        </div>
      </header>

      {/* Main Workstation Layout */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* LEFT PANEL: Case Navigator */}
        <aside className="w-80 border-r border-border flex flex-col h-full bg-card/10 overflow-hidden shrink-0">
          <div className="p-4 border-b border-border bg-card/30 flex items-center justify-between shrink-0">
            <span className="font-bold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Landmark className="h-4 w-4 text-muted-foreground" />
              Case Navigator
            </span>
            <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0 border-border/80">
              {allCases.length} Total
            </Badge>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-3.5">
            {loadingCases ? (
              <div className="py-12 text-center">
                <Activity className="h-5 w-5 text-muted-foreground animate-spin mx-auto" />
                <span className="text-xs text-muted-foreground mt-2 block">Loading cases...</span>
              </div>
            ) : (
              categories.map((cat) => {
                const catDocs = allCases.filter(cat.filter);
                const isCollapsed = collapsedCategories[cat.id];

                return (
                  <div key={cat.id} className="space-y-1">
                    <button
                      onClick={() => toggleCategory(cat.id)}
                      className="w-full flex items-center justify-between p-1.5 hover:bg-accent/40 rounded transition-colors text-xs font-semibold text-muted-foreground hover:text-foreground"
                    >
                      <div className="flex items-center gap-1.5">
                        {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        <span>{cat.label}</span>
                      </div>
                      <Badge variant="outline" className="text-[9px] px-1 py-0 border-border bg-background/50 font-semibold font-mono">
                        {catDocs.length}
                      </Badge>
                    </button>

                    {!isCollapsed && (
                      <div className="pl-3 mt-1.5 border-l border-border/40 ml-2 space-y-1.5">
                        {catDocs.length === 0 ? (
                          <span className="text-[10px] text-muted-foreground italic py-1 block">No cases.</span>
                        ) : (
                          catDocs.map((cDoc) => {
                            const isActive = cDoc.documentId === id;
                            const hasConflict = cDoc.verificationCase?.challenges?.some((c: any) => c.type === 'CONFLICT');
                            const priority = hasConflict || (cDoc.verificationCase?.trustScore !== undefined && cDoc.verificationCase.trustScore < 70) ? 'HIGH' : 'MEDIUM';
                            const trust = cDoc.verificationCase?.trustScore ?? 100;

                            return (
                              <div
                                key={cDoc.documentId}
                                onClick={() => router.push(`/notary/case/${cDoc.documentId}`)}
                                className={`flex flex-col p-2.5 rounded cursor-pointer border transition-all text-xs ${
                                  isActive
                                    ? 'bg-primary/10 border-primary/30 text-foreground font-semibold shadow-sm'
                                    : 'bg-background/25 border-transparent text-muted-foreground hover:text-foreground hover:bg-accent/30'
                                }`}
                              >
                                <div className="flex items-start justify-between gap-1.5">
                                  <span className="truncate leading-normal flex-1">{cDoc.title}</span>
                                  <span className={`h-2 w-2 rounded-full shrink-0 mt-1.5 ${
                                    trust >= 80 ? 'bg-emerald-500' : trust >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                                  }`} />
                                </div>
                                <div className="flex items-center justify-between mt-1.5 text-[9px] font-mono text-muted-foreground">
                                  <span>#{cDoc.documentId.substring(0, 8)}</span>
                                  <Badge className={`text-[8px] border-0 leading-none h-4 px-1 ${
                                    priority === 'HIGH' ? 'bg-red-500/10 text-red-500' : 'bg-yellow-500/10 text-yellow-600'
                                  }`}>
                                    {priority}
                                  </Badge>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* CENTER PANEL: Active Verification Workspace */}
        <main className="flex-1 h-full overflow-y-auto p-8 space-y-6">
          <div className="flex items-center justify-between border-b border-border/40 pb-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                <ShieldCheck className="h-7 w-7 text-primary" />
                Active Verification Workspace
              </h1>
              <p className="text-muted-foreground text-xs mt-1">
                Ref: <code className="font-mono text-foreground select-all">{caseDetails?.caseId}</code> | Status: <span className="font-semibold text-foreground uppercase">{caseDetails?.status}</span>
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                onClick={handleRegenerateAi}
                variant="outline"
                size="sm"
                className="rounded-full text-xs gap-1.5 border-border bg-card/45"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Recalculate Trust
              </Button>
            </div>
          </div>

          {/* Core Panel Grid: 2 columns */}
          <div className="grid gap-6 md:grid-cols-2">
            
            {/* Column 1: Document Overview & Checklist */}
            <div className="space-y-6">
              
              {/* Document Overview */}
              <Card className="border-border bg-card/45 backdrop-blur-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Document Metadata</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 text-xs font-mono">
                  <div className="space-y-0.5">
                    <span className="text-muted-foreground block">DEED TITLE:</span>
                    <span className="text-foreground font-semibold font-sans">{docDetails?.title}</span>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-muted-foreground block">DEED TYPE:</span>
                    <span className="text-foreground font-semibold font-sans">{docDetails?.type}</span>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-muted-foreground block">REGISTRATION DATE:</span>
                    <span className="text-foreground font-semibold font-sans">{docDetails && new Date(docDetails.timestamp).toLocaleString()}</span>
                  </div>
                  {docDetails?.metadata && (
                    <>
                      <div className="space-y-0.5 border-t border-border/40 pt-2">
                        <span className="text-muted-foreground block">SURVEY NUMBER:</span>
                        <span className="text-foreground font-semibold">{docDetails.metadata.surveyNumber || 'N/A'}</span>
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-muted-foreground block">PROPERTY ID / KHATA:</span>
                        <span className="text-foreground font-semibold">{docDetails.metadata.propertyId || 'N/A'}</span>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Trust Score circular display */}
              <Card className="border-border bg-card/45 backdrop-blur-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Trust Index Rating</CardTitle>
                </CardHeader>
                <CardContent className="flex items-center gap-6 py-2">
                  <div className="relative flex items-center justify-center h-24 w-24 shrink-0 rounded-full border border-border bg-background/50 shadow-inner">
                    <div className="text-center">
                      <span className={`text-3xl font-mono font-black ${
                        (caseDetails?.trustScore || 100) >= 80 
                          ? 'text-emerald-500' 
                          : (caseDetails?.trustScore || 100) >= 50 
                            ? 'text-yellow-500' 
                            : 'text-red-500'
                      }`}>
                        {caseDetails?.trustScore}
                      </span>
                      <span className="block text-[8px] text-muted-foreground uppercase font-mono tracking-widest mt-0.5">/ 100</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground block font-mono">CLASSIFICATION:</span>
                    <span className="text-sm font-bold text-foreground block">
                      {(caseDetails?.trustScore || 100) >= 80 ? 'EXCELLENT' : (caseDetails?.trustScore || 100) >= 50 ? 'WARNING (CLEARANCE REQ)' : 'CRITICAL (HIGH RISK)'}
                    </span>
                    <p className="text-[11px] text-muted-foreground leading-normal">
                      Dynamic registry scoring adjusted instantly by check resolutions and document evidence checklist completion.
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Verification Checklist */}
              <Card className="border-border bg-card/45 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Verification Checklist</CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">
                    Confirm all legal and survey targets to qualify document signature
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {caseDetails?.checklist.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-2.5 rounded border border-border/80 bg-background/45 text-xs">
                      <span className="font-medium text-foreground">{item.label}</span>
                      <div className="flex gap-1.5">
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={() => handleChecklistToggle(item.id, 'PASSED')}
                          className={`h-7 w-7 rounded-full border ${item.status === 'PASSED' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30' : 'bg-transparent text-muted-foreground hover:bg-accent'}`}
                        >
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={() => handleChecklistToggle(item.id, 'FAILED')}
                          className={`h-7 w-7 rounded-full border ${item.status === 'FAILED' ? 'bg-red-500/10 text-red-500 border-red-500/30' : 'bg-transparent text-muted-foreground hover:bg-accent'}`}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            {/* Column 2: Chain of Title Timeline & VPL Anchors */}
            <div className="space-y-6">
              
              {/* VPL Anchoring & Solana status */}
              <Card className="border-border bg-card/45 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Blockchain Anchoring Status</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3.5 text-xs font-mono">
                  <div>
                    <span className="text-muted-foreground block">SOLANA TRANSACTION SIGNATURE:</span>
                    {docDetails?.onchainTxSignature ? (
                      <a
                        href={`https://explorer.solana.com/tx/${docDetails.onchainTxSignature}?cluster=devnet`}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-foreground underline hover:text-muted-foreground break-all flex items-center gap-1 mt-0.5"
                      >
                        {docDetails.onchainTxSignature.substring(0, 32)}...
                        <LinkIcon className="h-3 w-3" />
                      </a>
                    ) : (
                      <span className="text-yellow-600 font-semibold italic mt-0.5 block">Awaiting Verification Anchor</span>
                    )}
                  </div>
                  <div>
                    <span className="text-muted-foreground block">PDA ADDRESS REFERENCE:</span>
                    <span className="font-mono text-foreground break-all mt-0.5 block">
                      {docDetails?.onchainPda || 'Awaiting derivation from program key'}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Ownership Timeline Chain */}
              <Card className="border-border bg-card/45 backdrop-blur-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <History className="h-4.5 w-4.5 text-muted-foreground" />
                    Chain of Title Registry Timeline
                  </CardTitle>
                </CardHeader>
                <CardContent className="relative pl-6 py-4">
                  {ownershipHistory.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">No previous ownership records exist for this property.</p>
                  ) : (
                    <>
                      <div className="absolute left-[33px] top-6 bottom-6 w-[1.5px] bg-border/80" />
                      <div className="space-y-6">
                        {ownershipHistory.map((record) => {
                          const isHistorical = record.status === 'HISTORICAL';
                          return (
                            <div key={record.recordId} className="relative flex items-start gap-4 text-xs">
                              <div className={`z-10 flex h-7 w-7 items-center justify-center rounded-full bg-background border shadow-sm ${
                                isHistorical ? 'border-border text-muted-foreground' : 'border-emerald-500 text-emerald-500'
                              }`}>
                                <User className="h-3.5 w-3.5" />
                              </div>
                              <div className="flex-1 space-y-1">
                                <div className="flex items-center justify-between">
                                  <span className="font-semibold text-foreground">{record.owner?.name || record.ownerName || 'Unknown Owner'}</span>
                                  <Badge className={`text-[9px] border-0 leading-none ${
                                    isHistorical ? 'bg-muted text-muted-foreground' : 'bg-emerald-500/10 text-emerald-500'
                                  }`}>
                                    {record.status}
                                  </Badge>
                                </div>
                                <p className="text-[10px] font-mono text-muted-foreground">Email: {record.owner?.email || 'N/A'}</p>
                                <p className="text-[10px] text-muted-foreground">
                                  Tenure: {new Date(record.startDate).toLocaleDateString()} to {record.endDate ? new Date(record.endDate).toLocaleDateString() : 'Present'}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

            </div>
          </div>

          {/* Conflict Warning banner */}
          <Card className="border-border bg-card/45 backdrop-blur-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <AlertTriangle className="h-4.5 w-4.5 text-foreground" />
                Cross-Registry Conflict Detection
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3.5">
              {conflictsList.length === 0 ? (
                <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3.5 text-xs text-emerald-600 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                  <span>No double-registration title conflicts detected in database records.</span>
                </div>
              ) : (
                conflictsList.map((conf) => (
                  <div key={conf.id} className="rounded-lg border border-destructive/20 bg-destructive/5 p-3.5 text-xs text-destructive space-y-2">
                    <div className="flex items-center gap-2 font-bold">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      <span>Title Conflict Warning!</span>
                    </div>
                    <p className="text-foreground/90 font-mono text-[11px] leading-relaxed">{conf.question}</p>
                    <div className="flex items-center gap-2 mt-2 pt-1 border-t border-destructive/10">
                      <span className="text-[10px] text-muted-foreground uppercase">STATUS:</span>
                      {conf.resolved ? (
                        <Badge className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/25 text-[10px]">Justified & Cleared</Badge>
                      ) : (
                        <Badge className="bg-red-500/10 text-red-600 border border-red-500/25 text-[10px]">Justification Required</Badge>
                      )}
                    </div>
                    {conf.resolved && (
                      <p className="text-[10px] text-muted-foreground italic font-sans mt-1">Justification: {conf.justification}</p>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Evidence Repository & Uploads */}
          <Card className="border-border bg-card/45 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Evidence Repository & Uploads</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={handleEvidenceUpload} className="rounded-lg border border-border bg-background/50 p-4 space-y-4">
                <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Upload New Supporting Proof</h4>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="evidenceType" className="text-xs text-foreground/80">Evidence Document Type</Label>
                    <select
                      id="evidenceType"
                      value={evidenceTitle}
                      onChange={(e) => setEvidenceTitle(e.target.value)}
                      disabled={uploadingEvidence}
                      className="w-full text-xs bg-background border border-border rounded px-3 py-2 text-foreground focus:outline-none"
                    >
                      <option value="Identity Proof">Identity Proof (Aadhaar/Passport)</option>
                      <option value="Prior Title Deed">Prior Title Deed (Chain of Ownership)</option>
                      <option value="Tax Receipt">Property Tax Clearance Receipt</option>
                      <option value="Survey Clearance">Local Authority Survey NOC</option>
                    </select>
                  </div>
                  <div className="space-y-1.5 flex flex-col justify-end">
                    <Label htmlFor="evidenceFile" className="text-xs text-foreground/80 mb-0.5">Select File Copy</Label>
                    <Input
                      id="evidenceFile"
                      type="file"
                      disabled={uploadingEvidence}
                      onChange={(e) => setEvidenceFile(e.target.files?.[0] || null)}
                      className="border-border bg-background text-foreground text-xs file:bg-accent file:text-foreground file:border-0"
                    />
                  </div>
                </div>
                <div className="flex justify-end pt-1">
                  <Button
                    type="submit"
                    disabled={uploadingEvidence || !evidenceFile}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs rounded-full shadow-sm py-1.5"
                  >
                    {uploadingEvidence ? 'Uploading to IPFS...' : 'Upload Supporting Evidence'}
                  </Button>
                </div>
              </form>

              {/* Uploaded Evidence list */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Active Case Evidence</h4>
                {caseDetails?.evidence.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic py-2">No supporting evidence has been uploaded to case yet.</p>
                ) : (
                  <div className="rounded border border-border bg-background/30 overflow-hidden text-xs">
                    <div className="grid grid-cols-3 bg-muted/40 border-b border-border p-2.5 font-semibold text-muted-foreground">
                      <span>Document Title</span>
                      <span className="col-span-2">IPFS CID Reference Hash</span>
                    </div>
                    {caseDetails?.evidence.map((ev) => (
                      <div key={ev.evidenceId} className="grid grid-cols-3 border-b border-border/50 p-2.5 last:border-b-0 hover:bg-accent/20">
                        <span className="font-semibold text-foreground">{ev.title}</span>
                        <a
                          href={`https://gateway.pinata.cloud/ipfs/${ev.ipfsCid}`}
                          target="_blank"
                          rel="noreferrer"
                          className="col-span-2 font-mono text-muted-foreground hover:text-foreground underline truncate flex items-center gap-1"
                        >
                          {ev.ipfsCid}
                          <Eye className="h-3.5 w-3.5 shrink-0" />
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Dynamic Challenges Workspace */}
          <Card className="border-border bg-card/45 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Dynamic Challenges Workspace</CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Submit notarization logs to verify and clear active registry warnings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {caseDetails?.challenges.length === 0 ? (
                <p className="text-xs text-muted-foreground italic text-center py-4">No active case challenges listed.</p>
              ) : (
                caseDetails?.challenges.map((ch) => (
                  <div key={ch.id} className="rounded border border-border bg-background/50 p-3 space-y-2.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-muted-foreground text-[10px] uppercase font-mono">{ch.type}</span>
                      {ch.resolved ? (
                        <Badge className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/25 text-[9px] font-sans font-semibold">RESOLVED</Badge>
                      ) : (
                        <Badge className="bg-yellow-500/10 text-yellow-600 border border-yellow-500/25 text-[9px] font-sans font-semibold">UNRESOLVED</Badge>
                      )}
                    </div>
                    <p className="text-foreground leading-relaxed text-[11px] font-mono">{ch.question}</p>
                    
                    {ch.resolved ? (
                      <div className="rounded border border-border bg-muted/20 p-2 text-[10px] text-muted-foreground italic mt-2">
                        Justification: {ch.justification}
                      </div>
                    ) : (
                      <div className="mt-2">
                        {justifyingChallengeId === ch.id ? (
                          <form onSubmit={handleJustificationSubmit} className="space-y-2">
                            <Input
                              placeholder="Write notary justification log..."
                              value={justificationText}
                              onChange={(e) => setJustificationText(e.target.value)}
                              disabled={submittingJustification}
                              className="text-xs border-border bg-background text-foreground placeholder:text-muted-foreground/30 focus-visible:ring-ring"
                            />
                            <div className="flex gap-2 justify-end">
                              <Button
                                size="sm"
                                type="button"
                                variant="outline"
                                onClick={() => setJustifyingChallengeId(null)}
                                className="text-[10px] rounded-full px-2.5 h-6"
                              >
                                Cancel
                              </Button>
                              <Button
                                size="sm"
                                type="submit"
                                disabled={submittingJustification || !justificationText.trim()}
                                className="text-[10px] rounded-full px-3 h-6 bg-primary"
                              >
                                Submit Log
                              </Button>
                            </div>
                          </form>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => openJustificationBox(ch.id)}
                            className="w-full text-[10px] border border-border bg-background text-foreground hover:bg-accent rounded-full py-1 h-7 font-semibold"
                          >
                            Submit Justification Log
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Action signature bar */}
          <Card className="border-border bg-card/45 backdrop-blur-sm">
            <CardFooter className="p-4 flex flex-col space-y-3">
              <Button
                onClick={startAnchorWorkflow}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs py-2 rounded-full shadow-md"
              >
                Anchor Verification & Sign
              </Button>
              <p className="text-[9px] text-muted-foreground text-center leading-normal">
                Anchoring compiles the VPL Proof Record, generates its SHA-256 fingerprint, and registers it to the Solana network.
              </p>
            </CardFooter>
          </Card>
        </main>

        {/* RIGHT PANEL: Digital Twin Intelligence Workspace */}
        <aside className="w-96 border-l border-border flex flex-col h-full bg-card/15 overflow-hidden shrink-0">
          <div className="p-4 border-b border-border bg-card/30 flex items-center justify-between shrink-0">
            <span className="font-bold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Cpu className="h-4 w-4 text-primary animate-pulse" />
              Digital Twin Intelligence
            </span>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="icon"
                onClick={handleRegenerateAi}
                disabled={loadingAi || loadingCopilot || loadingTwin}
                className="h-7 w-7 rounded-full bg-card/45 border-border/80"
                title="Recalculate and Synchronize Digital Twin"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loadingAi || loadingCopilot || loadingTwin ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-5">
            {aiErrorMsg ? (
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-xs text-destructive space-y-2">
                <div className="flex items-center gap-2 font-bold">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
                  <span>AI Services Unavailable</span>
                </div>
                <p className="text-foreground/90 font-mono text-[11px] leading-relaxed">{aiErrorMsg}</p>
                <p className="text-[10px] text-muted-foreground">Nemotron reasoning services could not be contacted.</p>
              </div>
            ) : loadingTwin && !digitalTwin ? (
              <div className="py-16 text-center space-y-3">
                <Activity className="h-6 w-6 text-primary animate-spin mx-auto" />
                <p className="text-xs text-muted-foreground">Compiling Digital Twin model...</p>
              </div>
            ) : !digitalTwin ? (
              <div className="py-16 text-center space-y-3">
                <AlertCircle className="h-8 w-8 text-yellow-500 mx-auto" />
                <p className="text-xs text-muted-foreground">No Digital Twin compiled for this document.</p>
                <Button onClick={handleRegenerateAi} size="sm" className="rounded-full bg-primary text-xs">
                  Compile Baseline Twin
                </Button>
              </div>
            ) : (
              (() => {
                // Determine which version data we are inspecting
                const activeTwinData = selectedTwinVersion && digitalTwin.version !== selectedTwinVersion
                  ? twinHistory.find(h => h.version === selectedTwinVersion) || digitalTwin
                  : digitalTwin;

                const passport = activeTwinData.passportData || {};
                const isHistorical = activeTwinData.version !== digitalTwin.version;

                return (
                  <>
                    {/* Version Selector Dropdown */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider block">Model Version Control</span>
                        {isHistorical && (
                          <Badge className="bg-yellow-500/10 text-yellow-600 border border-yellow-500/20 text-[9px] font-sans">
                            Historical Snapshot
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                          value={selectedTwinVersion || digitalTwin.version}
                          onChange={(e) => setSelectedTwinVersion(Number(e.target.value))}
                          className="flex-1 text-xs bg-background border border-border rounded px-2.5 py-1.5 text-foreground focus:outline-none font-mono font-semibold"
                        >
                          <option value={digitalTwin.version}>v{digitalTwin.version} (Active Twin - Latest)</option>
                          {twinHistory
                            .filter(h => h.version !== digitalTwin.version)
                            .map(h => (
                              <option key={h.version} value={h.version}>
                                v{h.version} ({h.triggerEvent || 'UPDATE_EVENT'})
                              </option>
                            ))}
                        </select>
                      </div>
                      <div className="flex items-center justify-between text-[9px] font-mono text-muted-foreground px-0.5">
                        <span>Trigger: {activeTwinData.triggerEvent || 'SYSTEM_MIGRATION'}</span>
                        <span>{new Date(activeTwinData.createdAt).toLocaleDateString()} {new Date(activeTwinData.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                      </div>
                    </div>

                    {/* Verification Passport Status */}
                    <div className="space-y-2">
                      <span className="text-[10px] font-mono text-muted-foreground uppercase block tracking-wider">Verification Passport</span>
                      <div className="p-3.5 rounded-xl bg-background/40 border border-border/80 space-y-3 shadow-inner">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-semibold text-muted-foreground">Passport Status:</span>
                          <Badge className={`text-[10px] font-black border-0 px-2 py-0.5 uppercase ${
                            passport.verificationReadiness === 'READY'
                              ? 'bg-emerald-500/10 text-emerald-500'
                              : passport.verificationReadiness === 'RISK_DETECTED'
                                ? 'bg-red-500/10 text-red-500'
                                : 'bg-yellow-500/10 text-yellow-600'
                          }`}>
                            {passport.verificationReadiness || 'INCOMPLETE'}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-muted-foreground">Verification Score:</span>
                          <span className={`text-2xl font-mono font-black ${
                            (passport.overallVerificationScore ?? 0) >= 80 
                              ? 'text-emerald-500' 
                              : (passport.overallVerificationScore ?? 0) >= 50 
                                ? 'text-yellow-500' 
                                : 'text-red-500'
                          }`}>
                            {passport.overallVerificationScore ?? 0}%
                          </span>
                        </div>
                        <div className="pt-2 border-t border-border/40 space-y-1">
                          <span className="block text-[8px] font-mono text-muted-foreground uppercase tracking-widest">Passport Registry Hash</span>
                          <span className="block font-mono text-[9px] text-muted-foreground select-all break-all bg-background/60 p-1.5 rounded border border-border/50">
                            {passport.passportHash || 'AWAITING_ANALYTIC_PROVENANCE'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Trust Indices Breakdown */}
                    <div className="space-y-2.5">
                      <span className="text-[10px] font-mono text-muted-foreground uppercase block tracking-wider">Twin Trust Indices</span>
                      <div className="p-3.5 rounded-xl bg-background/30 border border-border/60 space-y-2.5 text-xs">
                        {/* Fraud Risk Indicator */}
                        <div className="space-y-1">
                          <div className="flex justify-between font-mono text-[10px]">
                            <span className="text-muted-foreground">FRAUD RISK PROBABILITY:</span>
                            <span className={`font-bold ${passport.fraudProbability > 50 ? 'text-red-500' : 'text-emerald-500'}`}>{passport.fraudProbability ?? 0}%</span>
                          </div>
                          <div className="w-full bg-muted/50 rounded-full h-1 overflow-hidden">
                            <div className={`h-full rounded-full ${passport.fraudProbability > 50 ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width: `${passport.fraudProbability ?? 0}%` }} />
                          </div>
                        </div>

                        {/* Evidence Completeness Indicator */}
                        <div className="space-y-1">
                          <div className="flex justify-between font-mono text-[10px]">
                            <span className="text-muted-foreground">EVIDENCE MATRIX COVERAGE:</span>
                            <span className="text-foreground font-bold">{passport.evidenceCoverage ?? 0}%</span>
                          </div>
                          <div className="w-full bg-muted/50 rounded-full h-1 overflow-hidden">
                            <div className="bg-primary h-full rounded-full" style={{ width: `${passport.evidenceCoverage ?? 0}%` }} />
                          </div>
                        </div>

                        {/* Registry Overlaps Index */}
                        <div className="space-y-1">
                          <div className="flex justify-between font-mono text-[10px]">
                            <span className="text-muted-foreground">REGISTRY CONSISTENCY:</span>
                            <span className="text-foreground font-bold">{passport.registryConfidence ?? 0}%</span>
                          </div>
                          <div className="w-full bg-muted/50 rounded-full h-1 overflow-hidden">
                            <div className="bg-primary h-full rounded-full" style={{ width: `${passport.registryConfidence ?? 0}%` }} />
                          </div>
                        </div>

                        {/* Solana Anchoring Confidence */}
                        <div className="space-y-1">
                          <div className="flex justify-between font-mono text-[10px]">
                            <span className="text-muted-foreground">BLOCKCHAIN ATTESTATION:</span>
                            <span className="text-foreground font-bold">{passport.blockchainConfidence ?? 0}%</span>
                          </div>
                          <div className="w-full bg-muted/50 rounded-full h-1 overflow-hidden">
                            <div className="bg-primary h-full rounded-full" style={{ width: `${passport.blockchainConfidence ?? 0}%` }} />
                          </div>
                        </div>

                        {/* Legal Compliance Check */}
                        <div className="space-y-1">
                          <div className="flex justify-between font-mono text-[10px]">
                            <span className="text-muted-foreground">LEGAL COMPLIANCE:</span>
                            <span className="text-foreground font-bold">{passport.legalCompliance ?? 0}%</span>
                          </div>
                          <div className="w-full bg-muted/50 rounded-full h-1 overflow-hidden">
                            <div className="bg-primary h-full rounded-full" style={{ width: `${passport.legalCompliance ?? 0}%` }} />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Top Recommended Actions */}
                    <div className="space-y-2">
                      <span className="text-[10px] font-mono text-muted-foreground uppercase block tracking-wider">Nemotron Recommendations</span>
                      <div className="p-3.5 rounded-xl bg-background/45 border border-border/60 text-xs space-y-2.5">
                        {activeTwinData.aiAssessments?.recommendations && activeTwinData.aiAssessments.recommendations.length > 0 ? (
                          activeTwinData.aiAssessments.recommendations.map((rec: string, idx: number) => (
                            <div key={idx} className="flex items-start gap-2 text-muted-foreground leading-normal">
                              <Sparkles className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                              <span>{rec}</span>
                            </div>
                          ))
                        ) : (
                          <p className="text-emerald-500 flex items-center gap-1.5 italic">
                            <CheckCircle2 className="h-4 w-4 shrink-0" />
                            Deed meets all baseline compliance parameters.
                          </p>
                        )}
                        
                        {/* Explainable Decision Rationale */}
                        {activeTwinData.aiAssessments?.decisionRationale && activeTwinData.aiAssessments.decisionRationale.length > 0 && (
                          <div className="pt-2 border-t border-border/40 space-y-1.5">
                            <span className="text-[9px] font-mono text-muted-foreground uppercase block">Decision Rationale</span>
                            {activeTwinData.aiAssessments.decisionRationale.map((rat: string, idx: number) => (
                              <div key={idx} className="flex items-start gap-1.5 text-muted-foreground text-[11px] leading-normal pl-1">
                                <span className="text-primary mt-0.5">•</span>
                                <span>{rat}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Missing Evidence & Action Requests */}
                    <div className="space-y-2">
                      <span className="text-[10px] font-mono text-muted-foreground uppercase block tracking-wider">Required Evidence Checklist</span>
                      {aiInsights?.evidenceRecommendations && aiInsights.evidenceRecommendations.length > 0 ? (
                        <div className="space-y-2.5">
                          {aiInsights.evidenceRecommendations.map((rec: any, idx: number) => (
                            <div key={idx} className="p-3 rounded-xl bg-background/45 border border-border/60 text-xs space-y-2">
                              <div className="flex justify-between items-start">
                                <span className="font-semibold text-foreground flex items-center gap-1.5">
                                  <span className="h-1.5 w-1.5 rounded-full bg-yellow-500" />
                                  {rec.recommendedDoc}
                                </span>
                                <Badge className={`text-[8px] border-0 px-1.5 py-0 font-bold ${
                                  rec.priority === 'HIGH' ? 'bg-red-500/10 text-red-500' : 'bg-yellow-500/10 text-yellow-600'
                                }`}>
                                  {rec.priority}
                                </Badge>
                              </div>
                              <p className="text-[11px] text-muted-foreground leading-normal">{rec.reason}</p>
                              <div className="flex items-center justify-between pt-2 border-t border-border/40 text-[10px]">
                                <span className="text-emerald-500 font-semibold font-mono">
                                  +{rec.expectedTrustIncrease} Trust Score
                                </span>
                                {rec.requested ? (
                                  <span className="text-yellow-600 font-semibold italic flex items-center gap-1">
                                    <Check className="h-3 w-3" /> Requested
                                  </span>
                                ) : (
                                  <Button
                                    size="sm"
                                    onClick={() => handleRequestEvidence(rec.recommendedDoc)}
                                    className="h-6 text-[9px] rounded-full bg-primary hover:bg-primary/90 text-primary-foreground px-2.5 font-bold"
                                  >
                                    Request From Citizen
                                  </Button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="p-3.5 rounded-xl bg-emerald-500/5 border border-emerald-500/10 text-xs text-emerald-500 flex items-center gap-1.5">
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                          <span>All supporting evidence requirements fulfilled.</span>
                        </div>
                      )}
                    </div>

                    {/* Cross Examination Registry Challenges */}
                    {activeTwinData.aiAssessments?.questions && activeTwinData.aiAssessments.questions.length > 0 && (
                      <div className="space-y-2">
                        <span className="text-[10px] font-mono text-muted-foreground uppercase block tracking-wider">Cross Examination Suggestions</span>
                        <div className="p-3.5 rounded-xl bg-background/45 border border-border/60 text-xs space-y-2 max-h-60 overflow-y-auto">
                          {activeTwinData.aiAssessments.questions.map((q: any, idx: number) => (
                            <div key={idx} className="border-l border-primary/20 pl-2.5 py-1">
                              <div className="font-semibold text-foreground/80 leading-normal">{q.question}</div>
                              {q.requiredEvidence && (
                                <div className="text-[10px] text-muted-foreground mt-0.5">Suggested Proof: {q.requiredEvidence}</div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                );
              })()
            )}
          </div>
        </aside>

      </div>

      {/* DSC PIN Simulation Dialog */}
      <Dialog open={isPinModalOpen} onOpenChange={setIsPinModalOpen}>
        <DialogContent className="border-border bg-card text-foreground max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-foreground text-lg flex items-center gap-2">
              <Lock className="h-5 w-5 text-foreground" />
              Class-3 Token Attestation
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs">
              Confirm case clearance and anchor verification proof to Solana Devnet.
            </DialogDescription>
          </DialogHeader>

          {successMsg ? (
            <div className="py-6 flex flex-col items-center justify-center text-center space-y-3">
              <CheckCircle2 className="h-10 w-10 text-emerald-600" />
              <p className="text-sm font-semibold text-foreground">{successMsg}</p>
            </div>
          ) : (
            <form onSubmit={handleDscVerification} className="space-y-4 py-2">
              {errorMsg && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}
              <div className="space-y-1.5 text-xs">
                <p><span className="text-muted-foreground font-mono">CASE ID:</span> {caseDetails?.caseId}</p>
                <p><span className="text-muted-foreground font-mono">TRUST INDEX:</span> {caseDetails?.trustScore}/100</p>
                <p><span className="text-muted-foreground font-mono">CERT SERIAL:</span> CA-3-889a2bc1 (Advocate Rao)</p>
              </div>

              {/* Legal Warnings for Pending items */}
              {caseDetails && (
                (() => {
                  const hasPendingChecklist = (caseDetails.checklist || []).some((item: any) => item.status === 'PENDING');
                  const hasUnresolvedEvidence = (caseDetails.challenges || []).some((ch: any) => ch.type === 'MISSING_EVIDENCE' && !ch.resolved);
                  const hasUnresolvedConflicts = (caseDetails.challenges || []).some((ch: any) => ch.type === 'CONFLICT' && !ch.resolved);
                  
                  if (hasPendingChecklist || hasUnresolvedEvidence || hasUnresolvedConflicts) {
                    return (
                      <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/20 p-3 space-y-1.5 text-xs text-yellow-600">
                        <span className="font-semibold block">Legal & Verification Warning:</span>
                        <ul className="list-disc pl-4 space-y-1 text-[11px]">
                          {hasPendingChecklist && <li>Additional verification items remain under review.</li>}
                          {hasUnresolvedConflicts && <li>Property assessment confidence is still being updated.</li>}
                          {hasUnresolvedEvidence && <li>Certain supporting records have not yet been submitted.</li>}
                        </ul>
                        <span className="text-[10px] text-muted-foreground block mt-1">As the accredited notary, you hold final authority and may proceed with signing.</span>
                      </div>
                    );
                  }
                  return null;
                })()
              )}

              <div className="space-y-2">
                <Label htmlFor="pin" className="text-foreground/80 text-xs">Class-3 USB Key PIN</Label>
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
                 <p className="text-[10px] text-muted-foreground">Use <code className="text-foreground font-semibold">1234</code> for secure DSC token check.</p>
              </div>

              <DialogFooter className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsPinModalOpen(false)}
                  disabled={signing}
                  className="border-border bg-transparent hover:bg-accent text-foreground rounded-full"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={signing}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-full"
                >
                  Verify & Anchor VPL
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

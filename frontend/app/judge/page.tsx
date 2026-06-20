'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Terminal, ShieldCheck, Database, Play, CheckCircle2, AlertCircle, Key, RefreshCw, 
  HelpCircle, Eye, EyeOff, LayoutDashboard, History, Activity, Server, FileText, ArrowRight,
  Gavel, Scale, AlertTriangle, Layers, Clock, ExternalLink, ChevronRight, CheckCircle, User
} from 'lucide-react';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import { AVCCDashboard } from '@/components/AVCCDashboard';

interface DemoUsers {
  seller: string;
  buyer: string;
  notary: string;
  notaryId: string;
  govt: string;
}

interface StepDetail {
  num: number;
  title: string;
  actor: string;
  badgeColor: string;
  description: string;
}

const STEPS: StepDetail[] = [
  {
    num: 1,
    title: 'Register Document',
    actor: 'Citizen (Seller)',
    badgeColor: 'bg-blue-550/10 text-blue-600 border-blue-500/20',
    description: 'Upload property deed and initialize owner registry record in PostgreSQL.'
  },
  {
    num: 2,
    title: 'NVIDIA Nemotron Fraud Risk Assessment',
    actor: 'AI Assessor Agent',
    badgeColor: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
    description: 'Run deep assessment on the deed for duplication, tampering, or ownership conflicts.'
  },
  {
    num: 3,
    title: 'AI Conflict Investigator Copilot',
    actor: 'AI Copilot Agent',
    badgeColor: 'bg-rose-500/10 text-rose-600 border-rose-500/20',
    description: 'Reason across prior deeds to predict verification outcome and compile notary challenge checks.'
  },
  {
    num: 4,
    title: 'Notary Assignment & Review Start',
    actor: 'Notary',
    badgeColor: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
    description: 'Notary locks the document into active review and initializes the compliance case workspace.'
  },
  {
    num: 5,
    title: 'Resolve Compliance Checklist & Evidence',
    actor: 'Notary / VPL System',
    badgeColor: 'bg-teal-500/10 text-teal-600 border-teal-500/20',
    description: 'Upload identity and tax proofs, resolve outstanding AI challenge flags, and pass audits.'
  },
  {
    num: 6,
    title: 'Solana Devnet VPL Proof Anchoring',
    actor: 'VPL System',
    badgeColor: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/25',
    description: 'Anchor the final cryptographically-sealed Verification Proof Layer hash on Solana Devnet.'
  },
  {
    num: 7,
    title: 'Generate Notary Verification Copilot Advice',
    actor: 'AI Copilot Agent',
    badgeColor: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
    description: 'Run 4-agent consensus, predict success probability, and draft rationale.'
  },
  {
    num: 8,
    title: 'Notary Verification & Attestation',
    actor: 'Notary Advocate',
    badgeColor: 'bg-cyan-500/10 text-cyan-600 border-cyan-500/20',
    description: 'Review case copilot recommendations, confirm checklist items, and sign the deed.'
  },
  {
    num: 9,
    title: 'Record Multi-Party Digital Signatures',
    actor: 'Seller, Buyer & Notary',
    badgeColor: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
    description: 'Seller, buyer, and notary submit digital signatures to approve transfer requirements.'
  },
  {
    num: 10,
    title: 'Finalize Ownership Deed (Government Approval)',
    actor: 'Government Registrar',
    badgeColor: 'bg-violet-500/10 text-violet-600 border-violet-500/20',
    description: 'Register transfer, update active deed owner record, and anchor transfer signature to Solana.'
  },
  {
    num: 11,
    title: 'Recompile Trust Graph & Ratings (AVCC)',
    actor: 'VCC Autonomous Agent',
    badgeColor: 'bg-rose-500/10 text-rose-600 border-rose-500/20',
    description: 'Autonomous VCC agent re-indexes nodes/edges and runs risk assessment updates.'
  }
];

export default function JudgeDashboardPage() {
  const [viewTab, setViewTab] = useState<'review' | 'sandbox' | 'avcc'>('review');
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [seeded, setSeeded] = useState(false);
  const [users, setUsers] = useState<DemoUsers | null>(null);
  
  // AVCC states
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

  const handleResolveAnomaly = async (anomalyId: string) => {
    setResolvingAnomalyId(anomalyId);
    try {
      await apiClient.post(`/v1/avcc/anomalies/${anomalyId}/resolve`, {
        resolutionNotes: 'Dismissed by Judicial Audit Authority.'
      });
      await fetchAvccData();
    } catch (err) {
      console.error('Failed to resolve anomaly:', err);
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
      console.error('Failed to recompile trust graph:', err);
    } finally {
      setRecalculatingAvcc(false);
    }
  };

  // Sandbox state variables
  const [documentId, setDocumentId] = useState('');
  const [propertyId, setPropertyId] = useState('');
  const [surveyNumber, setSurveyNumber] = useState('');
  const [transferId, setTransferId] = useState('');
  const [activeStep, setActiveStep] = useState(1);
  const [executing, setExecuting] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<Record<number, boolean>>({});
  const [errorSteps, setErrorSteps] = useState<Record<number, string>>({});
  const [inspectingRequest, setInspectingRequest] = useState<any>(null);
  const [inspectingResponse, setInspectingResponse] = useState<any>(null);
  const [inspectingMeta, setInspectingMeta] = useState<{
    url: string;
    method: string;
    status: number | string;
    latencyMs: number;
    requestId: string;
  } | null>(null);

  // Review tab state variables
  const [cases, setCases] = useState<any[]>([]);
  const [selectedCase, setSelectedCase] = useState<any | null>(null);
  const [copilotData, setCopilotData] = useState<any | null>(null);
  const [loadingCases, setLoadingCases] = useState(false);
  const [loadingCopilot, setLoadingCopilot] = useState(false);
  
  // Judge decision form state
  const [decision, setDecision] = useState<'APPROVE' | 'REVIEW' | 'ESCALATE' | 'REJECT'>('APPROVE');
  const [rationale, setRationale] = useState('');
  const [submittingDecision, setSubmittingDecision] = useState(false);

  // System Health
  const [healthStatus, setHealthStatus] = useState<Record<string, string>>({
    database: 'checking',
    blockchain: 'checking',
    ai: 'checking',
    storage: 'checking'
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedKey = localStorage.getItem('nvidiaApiKey') || '';
      setApiKey(storedKey);
    }
    checkSystemHealth();
    fetchCases();
  }, []);

  const fetchCases = async () => {
    setLoadingCases(true);
    try {
      const res = await apiClient.get('/v1/judge/cases');
      if (res.data) {
        setCases(res.data);
        if (res.data.length > 0 && !selectedCase) {
          setSelectedCase(res.data[0]);
        }
      }
    } catch (err) {
      console.warn('Failed to load judge cases list:', err);
    } finally {
      setLoadingCases(false);
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
      console.warn('Failed to load AI copilot data for judge:', err);
    } finally {
      setLoadingCopilot(false);
    }
  };

  useEffect(() => {
    if (selectedCase) {
      fetchCopilotData(selectedCase.documentId);
      setRationale('');
    } else {
      setCopilotData(null);
    }
  }, [selectedCase?.documentId]);

  useEffect(() => {
    if (viewTab === 'avcc') {
      fetchAvccData();
    }
  }, [viewTab]);

  const saveApiKey = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('nvidiaApiKey', apiKey);
      alert('NVIDIA API Key saved to local storage! API requests will attach it automatically.');
    }
  };

  const checkSystemHealth = async () => {
    try {
      const res = await apiClient.get('/system/health');
      if (res.data) {
        setHealthStatus({
          database: res.data.database?.status || 'degraded',
          blockchain: res.data.blockchain?.status || 'degraded',
          ai: res.data.rpc ? 'healthy' : 'degraded',
          storage: res.data.pinata?.status || 'degraded'
        });
      }
    } catch {
      setHealthStatus({
        database: 'degraded',
        blockchain: 'degraded',
        ai: 'degraded',
        storage: 'degraded'
      });
    }
  };

  const handleResetDemo = async () => {
    setExecuting(true);
    setSeeded(false);
    setCompletedSteps({});
    setErrorSteps({});
    setDocumentId('');
    setPropertyId('');
    setSurveyNumber('');
    setTransferId('');
    setActiveStep(1);

    const startTime = Date.now();
    try {
      const res = await apiClient.post('/judge/demo-setup', {});
      const latency = Date.now() - startTime;

      setInspectingMeta({
        url: '/v1/judge/demo-setup',
        method: 'POST',
        status: 200,
        latencyMs: latency,
        requestId: res.requestId || 'unknown'
      });
      setInspectingRequest({});
      setInspectingResponse(res.data);

      if (res.data?.users) {
        setUsers(res.data.users);
        setSeeded(true);
      }
      await fetchCases();
    } catch (err: any) {
      setInspectingMeta({
        url: '/v1/judge/demo-setup',
        method: 'POST',
        status: err.status || 500,
        latencyMs: Date.now() - startTime,
        requestId: err.requestId || 'error'
      });
      setInspectingResponse({ error: err.message, code: err.code });
      alert('Sandbox seeding failed: ' + err.message);
    } finally {
      setExecuting(false);
    }
  };

  const handleExecuteStep = async (stepNum: number) => {
    if (!users) {
      alert('Please reset and seed the sandbox environment first.');
      return;
    }
    setExecuting(true);
    const updatedErrors = { ...errorSteps };
    delete updatedErrors[stepNum];
    setErrorSteps(updatedErrors);

    const payload: any = {
      step: stepNum,
      sellerId: users.seller,
      buyerId: users.buyer,
      notaryId: users.notaryId,
      govtId: users.govt,
      documentId,
      propertyId,
      surveyNumber,
      transferId
    };

    setInspectingRequest(payload);
    const startTime = Date.now();

    try {
      const res = await apiClient.post('/judge/execute-step', payload);
      const latency = Date.now() - startTime;

      setInspectingMeta({
        url: '/v1/judge/execute-step',
        method: 'POST',
        status: 200,
        latencyMs: latency,
        requestId: res.requestId || 'unknown'
      });
      setInspectingResponse(res.data);

      if (stepNum === 1 && res.data) {
        setDocumentId(res.data.documentId);
        setPropertyId(res.data.propertyId);
        setSurveyNumber(res.data.surveyNumber);
      } else if (stepNum === 8 && res.data?.transfer) {
        setTransferId(res.data.transfer.transferId);
      }

      setCompletedSteps(prev => ({ ...prev, [stepNum]: true }));
      if (stepNum < 11) {
        setActiveStep(stepNum + 1);
      }
      await fetchCases();
    } catch (err: any) {
      const latency = Date.now() - startTime;
      setErrorSteps(prev => ({ ...prev, [stepNum]: err.message }));
      setInspectingMeta({
        url: '/v1/judge/execute-step',
        method: 'POST',
        status: err.status || 500,
        latencyMs: latency,
        requestId: err.requestId || 'error'
      });
      setInspectingResponse({ 
        error: err.message, 
        code: err.code,
        hint: 'Encountered failure. Correct issues (such as API keys) and click "Retry Step".'
      });
    } finally {
      setExecuting(false);
    }
  };

  const handleJudgeReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCase) return;

    setSubmittingDecision(true);
    try {
      await apiClient.post(`/v1/judge/cases/${selectedCase.documentId}/review`, {
        decision,
        rationale,
        judgeId: users?.notaryId || 'judge-vikram-99'
      });
      alert(`Attestation Decision "${decision}" submitted successfully to the national registry ledger.`);
      await fetchCases();
      // Keep selection
      const updatedCase = cases.find(c => c.documentId === selectedCase.documentId);
      if (updatedCase) {
        setSelectedCase(updatedCase);
      }
    } catch (err: any) {
      alert('Failed to submit attestation decision: ' + (err.message || err));
    } finally {
      setSubmittingDecision(false);
    }
  };

  const renderHealthDot = (status: string) => {
    if (status === 'ok' || status === 'healthy' || status === 'online') {
      return <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />;
    }
    if (status === 'checking') {
      return <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />;
    }
    return <span className="h-2 w-2 rounded-full bg-red-500" />;
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'ONCHAIN_CONFIRMED': return <span className="text-xs font-semibold text-blue-600">Awaiting Review</span>;
      case 'NOTARY_REVIEW_STARTED': return <span className="text-xs font-semibold text-yellow-600">Under Review</span>;
      case 'READY_FOR_SIGNATURE': return <span className="text-xs font-semibold text-purple-600">Awaiting Signature</span>;
      case 'NOTARY_SIGNED': return <span className="text-xs font-semibold text-emerald-600">Notary Signed</span>;
      case 'FULLY_EXECUTED': return <span className="text-xs font-semibold text-emerald-600">Fully Executed</span>;
      case 'DISPUTED': return <span className="text-xs font-semibold text-red-600 font-bold">Disputed</span>;
      default: return <span className="text-xs text-muted-foreground font-medium">{status.replace(/_/g, ' ')}</span>;
    }
  };

  // Compute stats for selected case Property Digital Twin
  const caseMetadata = selectedCase?.metadata || {};
  const caseData = selectedCase?.verificationCase;
  const trustScore = caseData?.trustScore ?? 100;
  const checklist = caseData?.checklist || [];
  const evidence = caseData?.evidence || [];
  const challenges = caseData?.challenges || [];
  const passedChecklist = checklist.filter((item: any) => item.status === 'PASSED').length;
  const readiness = Math.round((passedChecklist / (checklist.length || 1)) * 100);
  const activeConflicts = challenges.filter((c: any) => c.type === 'CONFLICT' && !c.resolved).length;
  const transfersCount = (selectedCase?.verificationEvents || []).filter((e: any) => e.eventType === 'OWNERSHIP_TRANSFER').length;

  let nationalRating = 'A';
  if (trustScore >= 90) nationalRating = 'AAA';
  else if (trustScore >= 80) nationalRating = 'AA';
  else if (trustScore >= 70) nationalRating = 'A';
  else if (trustScore >= 60) nationalRating = 'BBB';
  else if (trustScore >= 50) nationalRating = 'BB';
  else nationalRating = 'C';

  return (
    <div className="min-h-screen bg-background text-foreground antialiased font-sans flex flex-col justify-between noise-overlay">
      {/* Header bar */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded bg-primary text-primary-foreground shadow-sm">
              <Scale className="h-4 w-4" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-foreground">TimeLock Supreme Court Console</h1>
              <p className="text-xs text-muted-foreground">Sovereign attestation desk for presiding judges.</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* View Mode Switcher */}
            <div className="flex bg-muted p-1 rounded-full border border-border">
              <button 
                onClick={() => setViewTab('review')}
                className={`px-4 py-1 rounded-full text-xs font-semibold transition-all ${viewTab === 'review' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Judge Review Desk
              </button>
              <button 
                onClick={() => setViewTab('sandbox')}
                className={`px-4 py-1 rounded-full text-xs font-semibold transition-all ${viewTab === 'sandbox' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Guided Sandbox Console
              </button>
              <button 
                onClick={() => setViewTab('avcc')}
                className={`px-4 py-1 rounded-full text-xs font-semibold transition-all ${viewTab === 'avcc' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                AI Command Center (AVCC)
              </button>
            </div>
            <Button variant="outline" size="sm" onClick={checkSystemHealth} className="h-8 rounded-full border-border text-xs hover:bg-accent font-medium shadow-sm">
              <RefreshCw className="h-3 w-3 mr-1" />
              Probes
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-10">
        
        {viewTab === 'avcc' ? (
          <AVCCDashboard
            data={avccData}
            loading={loadingAvcc}
            recalculating={recalculatingAvcc}
            resolvingAnomalyId={resolvingAnomalyId}
            onResolveAnomaly={handleResolveAnomaly}
            onRecalculateGraph={handleRecalculateGraph}
          />
        ) : viewTab === 'review' ? (
          // JUDGE REVIEW EXPERIENCE
          <div className="grid grid-cols-1 lg:grid-cols-10 gap-8 items-start">
            
            {/* Left 30%: Cases Queue list */}
            <div className="lg:col-span-3 space-y-4">
              <div className="space-y-1">
                <h2 className="text-lg font-bold text-foreground">Registry Deeds Queue</h2>
                <p className="text-xs text-muted-foreground">Select a registered property submission to begin deep judicial audit.</p>
              </div>

              <div className="space-y-2.5 max-h-[calc(100vh-220px)] overflow-y-auto pr-1">
                {loadingCases ? (
                  <div className="py-12 text-center space-y-2 bg-card/60 border border-border rounded-lg shadow-sm">
                    <RefreshCw className="h-5 w-5 text-primary animate-spin mx-auto" />
                    <p className="text-xs text-muted-foreground">Syncing Judicial Registry...</p>
                  </div>
                ) : cases.length === 0 ? (
                  <div className="py-12 text-center space-y-2 bg-card/60 border border-border rounded-lg shadow-sm">
                    <Layers className="h-6 w-6 text-muted-foreground/45 mx-auto" />
                    <p className="text-xs text-muted-foreground font-semibold">No cases registered</p>
                    <p className="text-[10px] text-muted-foreground/80 px-4">Initialize the sandbox database or register deeds in Citizen / Notary panels.</p>
                  </div>
                ) : (
                  cases.map((c) => {
                    const isSelected = selectedCase?.documentId === c.documentId;
                    return (
                      <div
                        key={c.documentId}
                        onClick={() => setSelectedCase(c)}
                        className={`p-3.5 rounded-lg border text-left cursor-pointer transition-all ${
                          isSelected 
                            ? 'bg-card border-primary border-2 shadow-sm' 
                            : 'bg-card/60 hover:bg-card border-border shadow-sm'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <p className="font-bold text-xs text-foreground truncate max-w-[170px]">{c.title}</p>
                          <Badge className="bg-primary/10 text-primary border border-primary/20 text-[9px] font-mono font-bold px-1.5 py-0.5">
                            {c.verificationCase?.trustScore ?? 100}%
                          </Badge>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1 font-mono">ID: {c.documentId.slice(0, 10)}...</p>
                        <div className="flex justify-between items-center mt-2.5 pt-2 border-t border-border/50 text-[10px]">
                          {getStatusText(c.status)}
                          <span className="text-muted-foreground">{new Date(c.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Right 70%: Review details panel */}
            <div className="lg:col-span-7 space-y-6">
              {selectedCase ? (
                <div className="space-y-6">
                  
                  {/* PROPERTY DIGITAL TWIN CARD */}
                  <Card className="border-border bg-card/75 backdrop-blur-sm p-6 shadow-sm overflow-hidden border-2 border-primary/25">
                    <div className="flex items-center justify-between pb-4 border-b border-border/60">
                      <div>
                        <Badge className="bg-primary/10 text-primary border border-primary/20 text-xs font-semibold px-2.5 py-1 mb-1.5 rounded-full">
                          PROPERTY DIGITAL TWIN
                        </Badge>
                        <h3 className="font-bold text-xl text-foreground tracking-tight">{selectedCase.title}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Property ID: <span className="font-mono text-foreground font-semibold">{caseMetadata.propertyId || 'N/A'}</span> • Survey Reference: <span className="font-mono text-foreground font-semibold">{caseMetadata.surveyNumber || 'N/A'}</span>
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
                        <span className="font-bold text-foreground block text-sm">{selectedCase.status === 'FULLY_EXECUTED' ? 'Attested' : 'In Registry'}</span>
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
                        <span className="font-bold text-foreground block text-sm">{selectedCase.status === 'READY_FOR_SIGNATURE' ? 'Attestation Ready' : 'Under Review'}</span>
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

                  {/* AI DECISION & RECOMMENDATION LAYER */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Nemotron Recommendation */}
                    <Card className="border-border bg-card/60 p-5 space-y-3 shadow-sm flex flex-col justify-between">
                      <div className="space-y-3">
                        <h4 className="font-bold text-xs uppercase font-mono tracking-wider text-muted-foreground flex items-center gap-1">
                          <Activity className="h-4 w-4 text-primary" />
                          AI Decision recommendation
                        </h4>
                        
                        {loadingCopilot ? (
                          <div className="py-6 text-center text-xs text-muted-foreground">Analyzing deed...</div>
                        ) : copilotData?.recommendation ? (
                          <div className="space-y-3">
                            <div className="p-3 rounded-lg border border-border bg-muted/30 text-xs">
                              <p className="font-bold text-foreground">
                                RECOMMENDATION: {copilotData.recommendation.recommendation === 'APPROVE' ? (
                                  <span className="text-emerald-600 uppercase font-black">APPROVE REGISTRY</span>
                                ) : copilotData.recommendation.recommendation === 'REQUEST_EVIDENCE' ? (
                                  <span className="text-amber-600 uppercase font-black">REQUEST ADDITIONAL EVIDENCE</span>
                                ) : (
                                  <span className="text-rose-600 uppercase font-black">REJECT REGISTRY</span>
                                )}
                              </p>
                              <p className="text-[10px] text-muted-foreground font-mono mt-1">Approval Probability: {copilotData.prediction?.approvalProbability ?? 50}%</p>
                            </div>
                            
                            <div className="space-y-1">
                              <span className="text-[9px] font-mono text-muted-foreground uppercase">Reasoning rationale:</span>
                              <div className="max-h-[120px] overflow-y-auto space-y-1 text-xs text-muted-foreground leading-relaxed pr-1">
                                {(() => {
                                  try {
                                    const rationaleList = typeof copilotData.recommendation.rationale === 'string'
                                      ? JSON.parse(copilotData.recommendation.rationale)
                                      : copilotData.recommendation.rationale;
                                    if (Array.isArray(rationaleList)) {
                                      return rationaleList.map((r: string, idx: number) => (
                                        <div key={idx} className="flex gap-1 items-start">
                                          <span className="text-primary">•</span>
                                          <span>{r}</span>
                                        </div>
                                      ));
                                    }
                                  } catch {}
                                  return <p>Nemotron recommends attestation pathway confirmation.</p>;
                                })()}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground italic">Assessment Pending</p>
                        )}
                      </div>
                    </Card>

                    {/* Evidence Gaps & Checklist */}
                    <Card className="border-border bg-card/60 p-5 space-y-3 shadow-sm flex flex-col justify-between">
                      <div className="space-y-2">
                        <h4 className="font-bold text-xs uppercase font-mono tracking-wider text-muted-foreground">Evidence Verification Gaps</h4>
                        <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
                          {checklist.map((item: any, idx: number) => (
                            <div key={idx} className="flex justify-between items-center text-xs p-2 rounded bg-muted/30 border border-border">
                              <span className="font-medium text-foreground truncate max-w-[180px]">{item.title || item.ruleId}</span>
                              <Badge className={`text-[9px] font-mono border-0 ${item.status === 'PASSED' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'}`}>
                                {item.status}
                              </Badge>
                            </div>
                          ))}
                          {checklist.length === 0 && (
                            <p className="text-xs text-muted-foreground italic text-center py-4">No checklist criteria generated yet.</p>
                          )}
                        </div>
                      </div>
                    </Card>
                  </div>

                  {/* BLOCKCHAIN PROOFS & INTEGRITY */}
                  <Card className="border-border bg-card/60 p-5 space-y-3 shadow-sm">
                    <h4 className="font-bold text-xs uppercase font-mono tracking-wider text-muted-foreground flex items-center gap-1">
                      <ShieldCheck className="h-4 w-4 text-emerald-600" />
                      Solana Blockchain attestation proofs
                    </h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
                      <div className="p-3 bg-muted/20 rounded border border-border space-y-2">
                        <div>
                          <span className="text-[9px] text-muted-foreground block uppercase">Program Account Address (PDA)</span>
                          <span className="font-semibold text-foreground text-[10px] break-all select-all">
                            {selectedCase.onchainPda || 'EbKjjyvxck5REvVXTXuAvPDrydzKFniiGgLdKSeyfc3w...'}
                          </span>
                        </div>
                        <div>
                          <span className="text-[9px] text-muted-foreground block uppercase">Signature Anchor Hash</span>
                          <span className="font-semibold text-foreground text-[10px] break-all select-all">
                            {caseData?.vplProofHash || 'Pending Attestation Anchor'}
                          </span>
                        </div>
                      </div>

                      <div className="p-3 bg-muted/20 rounded border border-border space-y-2 flex flex-col justify-between">
                        <div>
                          <span className="text-[9px] text-muted-foreground block uppercase">Attestation Status</span>
                          <Badge className={`text-[10px] font-mono border-0 mt-1 ${caseData?.vplOnchainTx ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'}`}>
                            {caseData?.vplOnchainTx ? 'VERIFIED ON-CHAIN' : 'AWAITING SIGNATURE'}
                          </Badge>
                        </div>
                        {caseData?.vplOnchainTx && (
                          <a 
                            href={`https://explorer.solana.com/tx/${caseData.vplOnchainTx}?cluster=devnet`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-[10px] text-primary hover:underline flex items-center gap-1 font-bold font-sans self-start mt-2"
                          >
                            Verify Solana Ledger Explorer <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  </Card>

                  {/* OWNERSHIP HISTORY TIMELINE */}
                  <Card className="border-border bg-card/60 p-5 space-y-3 shadow-sm">
                    <h4 className="font-bold text-xs uppercase font-mono tracking-wider text-muted-foreground">Ownership Ledger Lineage</h4>
                    <div className="relative pl-6 border-l border-border space-y-4 py-1">
                      {/* Current Owner */}
                      <div className="relative">
                        <div className="absolute -left-[31px] top-1 h-5 w-5 rounded-full bg-emerald-500/10 border border-emerald-500 flex items-center justify-center">
                          <User className="h-3 w-3 text-emerald-600" />
                        </div>
                        <div className="text-xs">
                          <p className="font-bold text-foreground">Current Registered Owner</p>
                          <p className="text-muted-foreground text-[10px]">Deed registered by seller: {selectedCase.metadata?.ownerName || 'Registered Seller'}</p>
                        </div>
                      </div>

                      {/* Timeline transfers */}
                      {(selectedCase.verificationEvents || []).map((e: any, idx: number) => (
                        <div key={idx} className="relative">
                          <div className="absolute -left-[31px] top-1 h-5 w-5 rounded-full bg-background border border-border flex items-center justify-center">
                            <Clock className="h-3 w-3 text-muted-foreground" />
                          </div>
                          <div className="text-xs">
                            <p className="font-semibold text-foreground">{e.eventType.replace(/_/g, ' ')}</p>
                            <p className="text-muted-foreground text-[10px]">Actor: {e.actorLabel} • {new Date(e.occurredAt).toLocaleString()}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>

                  {/* ANOMALIES & TRUST GRAPH SUMMARY */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="border-border bg-card/60 p-4 text-xs space-y-1 shadow-sm">
                      <span className="text-[10px] text-muted-foreground uppercase font-mono tracking-wider block">Trust Score Index</span>
                      <p className="text-xl font-bold text-primary font-mono">{trustScore}%</p>
                      <p className="text-[10px] text-muted-foreground">Computed by VPL engine</p>
                    </Card>

                    <Card className="border-border bg-card/60 p-4 text-xs space-y-1 shadow-sm">
                      <span className="text-[10px] text-muted-foreground uppercase font-mono tracking-wider block">National Rating</span>
                      <p className="text-xl font-bold text-foreground font-mono">{nationalRating}</p>
                      <p className="text-[10px] text-muted-foreground">Security level classification</p>
                    </Card>

                    <Card className="border-border bg-card/60 p-4 text-xs space-y-1 shadow-sm">
                      <span className="text-[10px] text-muted-foreground uppercase font-mono tracking-wider block">Anomaly Alert flags</span>
                      <p className={`text-xl font-bold font-mono ${activeConflicts > 0 ? 'text-destructive' : 'text-emerald-600'}`}>
                        {activeConflicts} Flags
                      </p>
                      <p className="text-[10px] text-muted-foreground">Spatial boundary conflicts</p>
                    </Card>
                  </div>

                  {/* FINAL JUDICIAL ATTENSTATION DECISION FORM */}
                  <Card className="border-border bg-card p-6 border-2 border-primary/20 shadow-sm space-y-4">
                    <div className="border-b border-border pb-3">
                      <h4 className="font-bold text-base text-foreground flex items-center gap-1.5">
                        <Gavel className="h-5 w-5 text-primary" />
                        Presiding Judge Final Registry Decision
                      </h4>
                      <p className="text-xs text-muted-foreground mt-0.5">Submit your official judicial attestation and rationale to record this transaction permanently.</p>
                    </div>

                    <form onSubmit={handleJudgeReviewSubmit} className="space-y-4 text-xs">
                      {/* Decision Selection Buttons */}
                      <div className="space-y-2">
                        <span className="font-semibold text-foreground block">Attestation Action</span>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          {[
                            { id: 'APPROVE', label: 'APPROVE REGISTRY', color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30' },
                            { id: 'REVIEW', label: 'REQUEST REVIEW', color: 'bg-amber-500/10 text-amber-600 border-amber-500/30' },
                            { id: 'ESCALATE', label: 'ESCALATE CASE', color: 'bg-rose-500/10 text-rose-600 border-rose-500/30' },
                            { id: 'REJECT', label: 'REJECT REGISTRY', color: 'bg-red-500/10 text-red-600 border-red-500/30' }
                          ].map((opt) => {
                            const isSelected = decision === opt.id;
                            return (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() => setDecision(opt.id as any)}
                                className={`p-3 rounded-lg border text-center font-bold font-mono transition-all text-[11px] ${
                                  isSelected 
                                    ? 'ring-2 ring-primary ring-offset-1 bg-primary text-primary-foreground border-primary shadow-sm' 
                                    : `bg-card hover:bg-muted/30 border-border text-foreground`
                                }`}
                              >
                                {opt.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Rationale text area */}
                      <div className="space-y-1.5">
                        <span className="font-semibold text-foreground block">Judicial Attestation Rationale & Findings</span>
                        <textarea
                          placeholder="Provide the legal rationale for this attestation. Example: Title lineage verified clean. All VPL evidence checklists pass, and Solana anchor signature has been confirmed. Approval recommended."
                          value={rationale}
                          onChange={(e) => setRationale(e.target.value)}
                          required
                          rows={4}
                          className="w-full rounded-md border border-border bg-background p-3 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring focus:border-ring leading-relaxed"
                        />
                      </div>

                      {/* Submit */}
                      <Button
                        type="submit"
                        disabled={submittingDecision}
                        className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-full px-6 py-2 shadow-sm text-xs"
                      >
                        {submittingDecision ? 'Anchoring Attestation...' : 'Record & Seal Judicial Attestation'}
                      </Button>
                    </form>
                  </Card>

                </div>
              ) : (
                <div className="py-24 text-center space-y-4 border border-dashed border-border bg-card/40 rounded-lg p-6">
                  <Scale className="h-10 w-10 text-muted-foreground/35 mx-auto" />
                  <h3 className="font-bold text-foreground text-sm">Presiding Judge Attestation Workspace</h3>
                  <p className="text-xs text-muted-foreground/90 max-w-sm mx-auto">Select a property registry case from the queue on the left to load its comprehensive AI telemetry, evidence checklist, on-chain Solana proofs, and attestation options.</p>
                </div>
              )}
            </div>

          </div>
        ) : (
          // GUIDED SANDBOX CONSOLE
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Left Side: Setup & Walkthrough Controller */}
            <div className="lg:col-span-7 space-y-6">
              
              {/* API credentials config */}
              <Card className="border-border bg-card shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
                    <Key className="h-4 w-4 text-primary" />
                    NVIDIA Nemotron API Credentials
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">
                    Supply your API key below to enable live AI conflict checking and risk assessments.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type={showKey ? 'text' : 'password'}
                        placeholder="Enter x-nvidia-api-key..."
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        className="w-full h-9 px-3 py-1 bg-background border border-border rounded-md text-xs text-foreground focus:outline-none focus:border-ring focus:ring-1 focus:ring-ring"
                      />
                      <button 
                        type="button"
                        onClick={() => setShowKey(!showKey)}
                        className="absolute right-2.5 top-2 text-muted-foreground hover:text-foreground"
                      >
                        {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <Button size="sm" onClick={saveApiKey} className="bg-primary hover:bg-primary/90 text-primary-foreground h-9 px-4 text-xs font-semibold rounded-md">
                      Save Key
                    </Button>
                  </div>

                  {/* Seed state / Health summary */}
                  <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">System Health:</span>
                      <div className="flex gap-2.5 items-center">
                        <span className="flex items-center gap-1.5 text-foreground" title="Database">
                          {renderHealthDot(healthStatus.database)} DB
                        </span>
                        <span className="flex items-center gap-1.5 text-foreground" title="Solana">
                          {renderHealthDot(healthStatus.blockchain)} Chain
                        </span>
                        <span className="flex items-center gap-1.5 text-foreground" title="Pinata">
                          {renderHealthDot(healthStatus.storage)} Storage
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-end gap-2">
                      <span className="text-muted-foreground">Sandbox State:</span>
                      {seeded ? (
                        <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/25">INITIALIZED</Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground border-border bg-transparent">UNINITIALIZED</Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="bg-muted/30 border-t border-border px-6 py-3 flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Initialize a clean sandbox environment:</span>
                  <Button 
                    onClick={handleResetDemo} 
                    disabled={executing}
                    className="bg-secondary hover:bg-secondary/80 text-foreground border border-border h-8 text-xs font-semibold"
                  >
                    {executing && !seeded ? (
                      <RefreshCw className="h-3 w-3 mr-1.5 animate-spin" />
                    ) : (
                      <Database className="h-3.5 w-3.5 mr-1.5 text-primary" />
                    )}
                    Initialize Sandbox DB
                  </Button>
                </CardFooter>
              </Card>

              {/* Steps Timeline Card */}
              <Card className="border-border bg-card shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-bold text-foreground flex items-center justify-between">
                    <span>Guided Document & Transaction Lifecycle</span>
                    <span className="text-xs font-normal text-muted-foreground">
                      Step {activeStep} of 11
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="divide-y divide-border/60">
                  {STEPS.map((step) => {
                    const status = getStepStatus(step.num);
                    return (
                      <div key={step.num} className={`py-4 transition-all ${status === 'active' ? 'bg-muted/35 px-3 -mx-3 rounded-lg border border-border' : 'opacity-85'}`}>
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3">
                            <div className={`mt-0.5 h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold border ${
                              status === 'completed' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-600' :
                              status === 'error' ? 'bg-red-500/20 border-red-500 text-red-600' :
                              status === 'active' ? 'bg-primary/20 border-primary text-primary' :
                              'border-border text-muted-foreground bg-muted/40'
                            }`}>
                              {status === 'completed' ? '✓' : step.num}
                            </div>

                            <div className="space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="text-xs font-bold text-foreground">{step.title}</h3>
                                <Badge variant="outline" className={`px-1.5 py-0 text-[10px] uppercase font-mono ${step.badgeColor} border-0`}>
                                  {step.actor}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground leading-normal max-w-md">
                                {step.description}
                              </p>

                              {step.num === 1 && documentId && (
                                <div className="text-[11px] font-mono text-muted-foreground/80 mt-1 flex flex-col">
                                  <span>Generated ID: {documentId}</span>
                                  <span>Property ID: {propertyId}</span>
                                  <span>Survey ID: {surveyNumber}</span>
                                </div>
                              )}
                              {step.num === 8 && transferId && (
                                <div className="text-[11px] font-mono text-muted-foreground/80 mt-1">
                                  <span>Transfer ID: {transferId}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center">
                            {status === 'active' && (
                              <Button
                                size="sm"
                                disabled={executing || !seeded}
                                onClick={() => handleExecuteStep(step.num)}
                                className="bg-primary hover:bg-primary/90 text-primary-foreground h-7 px-3 text-xs font-semibold rounded-full shadow-sm"
                              >
                                {executing ? (
                                  <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                                ) : (
                                  <Play className="h-3 w-3 mr-1 fill-primary-foreground text-primary-foreground" />
                                )}
                                Run Step
                              </Button>
                            )}
                            {status === 'error' && (
                              <Button
                                size="sm"
                                disabled={executing}
                                onClick={() => handleExecuteStep(step.num)}
                                className="bg-destructive hover:bg-destructive/90 text-destructive-foreground h-7 px-3 text-xs font-semibold rounded-full border border-destructive/20"
                              >
                                Retry Step
                              </Button>
                            )}
                            {status === 'completed' && (
                              <span className="text-emerald-600 flex items-center gap-1 text-xs font-bold font-mono">
                                <CheckCircle2 className="h-4 w-4" /> SUCCESS
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </div>

            {/* Right Side: Live API payload Inspector */}
            <div className="lg:col-span-5 space-y-6">
              <Card className="border-border bg-card h-full flex flex-col justify-between shadow-sm">
                <CardHeader className="pb-3 border-b border-border">
                  <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                    <Terminal className="h-4 w-4 text-primary" />
                    Live API Log & Payload Inspector
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">
                    Telemetry output from the active network pipeline step execution.
                  </CardDescription>
                </CardHeader>

                <CardContent className="p-0 flex-1 flex flex-col justify-between min-h-[480px]">
                  {/* Meta information row */}
                  <div className="bg-muted/40 px-4 py-3 border-b border-border grid grid-cols-2 gap-4 text-xs font-mono">
                    <div>
                      <span className="text-muted-foreground block text-[10px]">ROUTE</span>
                      {inspectingMeta ? (
                        <span className="text-foreground font-bold">
                          <span className="text-primary font-bold mr-1">{inspectingMeta.method}</span>
                          {inspectingMeta.url}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/60">No active request</span>
                      )}
                    </div>
                    <div className="text-right">
                      <span className="text-muted-foreground block text-[10px]">HTTP STATUS</span>
                      {inspectingMeta ? (
                        <Badge className={inspectingMeta.status === 200 ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/25' : 'bg-red-500/10 text-red-600 border-red-500/25'}>
                          {inspectingMeta.status}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground/60">—</span>
                      )}
                    </div>
                    <div className="pt-2 border-t border-border/60">
                      <span className="text-muted-foreground block text-[10px]">LATENCY</span>
                      {inspectingMeta ? (
                        <span className="text-emerald-600 font-bold">{inspectingMeta.latencyMs} ms</span>
                      ) : (
                        <span className="text-muted-foreground/60">—</span>
                      )}
                    </div>
                    <div className="pt-2 border-t border-border/60 text-right">
                      <span className="text-muted-foreground block text-[10px]">CORRELATION ID</span>
                      {inspectingMeta ? (
                        <span className="text-muted-foreground text-[10px]" title={inspectingMeta.requestId}>
                          {inspectingMeta.requestId.slice(0, 18)}...
                        </span>
                      ) : (
                        <span className="text-muted-foreground/60">—</span>
                      )}
                    </div>
                  </div>

                  {/* Payload blocks */}
                  <div className="flex-1 p-4 space-y-4 max-h-[500px] overflow-y-auto bg-muted/10">
                    <div className="space-y-1">
                      <h4 className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground font-mono">Request Payload</h4>
                      <div className="bg-background p-3 rounded border border-border font-mono text-[11px] overflow-x-auto text-foreground max-h-[140px] shadow-inner">
                        {inspectingRequest ? (
                          <pre>{JSON.stringify(inspectingRequest, null, 2)}</pre>
                        ) : (
                          <span className="text-muted-foreground/60 italic">Waiting for request trigger...</span>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1 flex-1 flex flex-col">
                      <h4 className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground font-mono">Response Payload</h4>
                      <div className="bg-background p-3 rounded border border-border font-mono text-[11px] overflow-x-auto text-foreground flex-1 max-h-[260px] min-h-[180px] overflow-y-auto shadow-inner">
                        {inspectingResponse ? (
                          <pre>{JSON.stringify(inspectingResponse, null, 2)}</pre>
                        ) : (
                          <span className="text-muted-foreground/60 italic">Waiting for step output...</span>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>

                <CardFooter className="bg-muted/30 border-t border-border px-6 py-4 text-xs text-muted-foreground shadow-sm">
                  <div className="flex items-center justify-between w-full">
                    <span className="flex items-center gap-1 font-semibold">
                      <Server className="h-3.5 w-3.5 text-primary" />
                      Live API telemetry mode
                    </span>
                    <span className="text-emerald-600 font-semibold">PostgreSQL Database Registry</span>
                  </div>
                </CardFooter>
              </Card>
            </div>
          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="py-4 border-t border-border text-center text-xs text-muted-foreground bg-muted/20">
        &copy; 2026 TimeLock Supreme Judicial Council. All rights reserved.
      </footer>
    </div>
  );

  function getStepStatus(stepNum: number) {
    if (errorSteps[stepNum]) return 'error';
    if (completedSteps[stepNum]) return 'completed';
    if (activeStep === stepNum) return 'active';
    return 'pending';
  }
}

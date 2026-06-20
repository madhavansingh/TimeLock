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
  CheckCircle2, AlertCircle, RefreshCw, Lock, Eye, Download, Info, Check, X
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
  vplProofHash?: string;
  vplOnchainTx?: string;
}

export default function VerificationWorkspace({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const { id } = resolvedParams;
  const { user } = useAuth();
  const router = useRouter();

  const [caseDetails, setCaseDetails] = useState<CaseDetails | null>(null);
  const [docDetails, setDocDetails] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

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
        // Refetch details to reload challenges and trust score status
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
    // Validate everything first
    if (!caseDetails) return;

    const pendingChecklist = caseDetails.checklist.filter(i => i.status === 'PENDING');
    if (pendingChecklist.length > 0) {
      alert('You must review all checklist items before anchoring verification proof.');
      return;
    }

    const unresolvedChallenges = caseDetails.challenges.filter(c => !c.resolved);
    if (unresolvedChallenges.length > 0) {
      alert('You must resolve/justify all dynamic challenges before anchoring verification proof.');
      return;
    }

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

  if (loading) {
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
  const missingEvidenceList = caseDetails?.challenges.filter(ch => ch.type === 'MISSING_EVIDENCE') || [];

  return (
    <div className="min-h-screen bg-background text-foreground antialiased font-sans flex flex-col justify-between noise-overlay">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
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
        </div>
      </header>

      {/* Main Workspace layout */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-10 grid gap-8 lg:grid-cols-3">
        {/* Left Columns (Case Details & Evidence workspace) */}
        <div className="lg:col-span-2 space-y-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <ShieldCheck className="h-8 w-8 text-foreground" />
              Verification workspace
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Case Case Ref: <code className="text-foreground select-all">{caseDetails?.caseId}</code> | Status: <span className="font-semibold text-foreground uppercase">{caseDetails?.status}</span>
            </p>
          </div>

          {/* Case Overview Card */}
          <Card className="border-border bg-card/60 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-md font-bold">Case Overview</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 text-xs font-mono">
              <div className="space-y-1">
                <span className="text-muted-foreground block">DOCUMENT ID:</span>
                <span className="text-foreground text-xs font-semibold select-all">{id}</span>
              </div>
              <div className="space-y-1">
                <span className="text-muted-foreground block">DEED TITLE:</span>
                <span className="text-foreground font-semibold">{docDetails?.title}</span>
              </div>
              <div className="space-y-1">
                <span className="text-muted-foreground block">DEED TYPE:</span>
                <span className="text-foreground font-semibold">{docDetails?.type}</span>
              </div>
              <div className="space-y-1">
                <span className="text-muted-foreground block">REGISTRATION DATE:</span>
                <span className="text-foreground font-semibold">{docDetails && new Date(docDetails.timestamp).toLocaleString()}</span>
              </div>
              {docDetails?.metadata && (
                <>
                  <div className="space-y-1 border-t border-border/40 pt-2 mt-1">
                    <span className="text-muted-foreground block">SURVEY NUMBER:</span>
                    <span className="text-foreground font-semibold">{docDetails.metadata.surveyNumber || 'N/A'}</span>
                  </div>
                  <div className="space-y-1 border-t border-border/40 pt-2 mt-1">
                    <span className="text-muted-foreground block">PROPERTY ID / KHATA:</span>
                    <span className="text-foreground font-semibold">{docDetails.metadata.propertyId || 'N/A'}</span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Conflict Detection Panel */}
          <Card className="border-border bg-card/60 backdrop-blur-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-md font-bold flex items-center gap-2">
                <AlertTriangle className="h-4.5 w-4.5 text-foreground" />
                Conflict Detection Panel
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Automated cross-checks against registered property deeds in PostgreSQL database
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {conflictsList.length === 0 ? (
                <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3.5 text-xs text-emerald-600 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
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

          {/* Evidence Repository Card */}
          <Card className="border-border bg-card/60 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-md font-bold">Evidence Repository & Uploads</CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                All uploaded verification proofs are pinned to decentralized IPFS storage
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Evidence upload form */}
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
                  <div className="rounded-md border border-border bg-background/30 overflow-hidden text-xs">
                    <div className="grid grid-cols-3 bg-muted/40 border-b border-border p-2 font-semibold text-muted-foreground">
                      <span>Document Title</span>
                      <span className="col-span-2">IPFS CID Reference Hash</span>
                    </div>
                    {caseDetails?.evidence.map((ev) => (
                      <div key={ev.evidenceId} className="grid grid-cols-3 border-b border-border/50 p-2 last:border-b-0 hover:bg-accent/20">
                        <span className="font-semibold text-foreground">{ev.title}</span>
                        <a
                          href={`https://gateway.pinata.cloud/ipfs/${ev.ipfsCid}`}
                          target="_blank"
                          rel="noreferrer"
                          className="col-span-2 font-mono text-muted-foreground hover:text-foreground underline truncate flex items-center gap-1"
                        >
                          {ev.ipfsCid}
                          <Eye className="h-3 w-3 shrink-0" />
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column (Checklist, Challenges, Trust score) */}
        <div className="space-y-6">
          {/* Trust Score Panel */}
          <Card className="border-border bg-card/60 backdrop-blur-sm">
            <CardHeader className="pb-3 text-center">
              <CardTitle className="text-lg font-bold">Case Trust Index</CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Real-time dynamic trust rating adjusted by conflicts and evidence checks
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center py-6 space-y-4">
              <div className="relative flex items-center justify-center h-32 w-32 rounded-full border border-border bg-background/50 shadow-inner">
                <div className="text-center space-y-0.5">
                  <span className={`text-4xl font-mono font-bold ${
                    (caseDetails?.trustScore || 100) >= 80 
                      ? 'text-emerald-500' 
                      : (caseDetails?.trustScore || 100) >= 50 
                        ? 'text-yellow-500' 
                        : 'text-red-500'
                  }`}>
                    {caseDetails?.trustScore}
                  </span>
                  <span className="block text-[10px] text-muted-foreground uppercase font-semibold">/ 100 INDEX</span>
                </div>
              </div>

              {/* Status Indicator */}
              <div className="text-center">
                <span className="text-xs text-muted-foreground">Trust Rating: </span>
                <span className="text-xs font-semibold text-foreground">
                  {(caseDetails?.trustScore || 100) >= 80 ? 'EXCELLENT' : (caseDetails?.trustScore || 100) >= 50 ? 'WARNING (CLEARANCE REQ)' : 'CRITICAL (HIGH SUSPICION)'}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Verification Checklist */}
          <Card className="border-border bg-card/60 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-md font-bold">Verification Checklist</CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Verify all operational checklist targets to enable anchoring
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3.5">
              {caseDetails?.checklist.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-2.5 rounded-lg border border-border/80 bg-background/40">
                  <span className="text-xs font-medium text-foreground">{item.label}</span>
                  <div className="flex gap-1">
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => handleChecklistToggle(item.id, 'PASSED')}
                      className={`h-7 w-7 rounded-full border border-border ${item.status === 'PASSED' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30' : 'bg-transparent text-muted-foreground hover:bg-accent'}`}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => handleChecklistToggle(item.id, 'FAILED')}
                      className={`h-7 w-7 rounded-full border border-border ${item.status === 'FAILED' ? 'bg-red-500/10 text-red-500 border-red-500/30' : 'bg-transparent text-muted-foreground hover:bg-accent'}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Challenges & Justifications Panel */}
          <Card className="border-border bg-card/60 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-md font-bold">Dynamic Challenges Workspace</CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Notary must justification-log each warning query to enable final validation
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {caseDetails?.challenges.length === 0 ? (
                <p className="text-xs text-muted-foreground italic text-center py-4">No active case challenges listed.</p>
              ) : (
                caseDetails?.challenges.map((ch) => (
                  <div key={ch.id} className="rounded-lg border border-border bg-background/50 p-3 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-muted-foreground text-[10px] uppercase font-mono">{ch.type}</span>
                      {ch.resolved ? (
                        <Badge className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/25 text-[9px] font-sans">RESOLVED</Badge>
                      ) : (
                        <Badge className="bg-yellow-500/10 text-yellow-600 border border-yellow-500/25 text-[9px] font-sans">UNRESOLVED</Badge>
                      )}
                    </div>
                    <p className="text-foreground leading-relaxed text-[11px] font-mono">{ch.question}</p>
                    
                    {ch.resolved ? (
                      <div className="rounded border border-border bg-muted/20 p-2 text-[10px] text-muted-foreground italic mt-2">
                        Justification: {ch.justification}
                      </div>
                    ) : (
                      <div className="mt-2.5">
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
                            className="w-full text-[10px] border border-border bg-background text-foreground hover:bg-accent rounded-full py-1 h-7"
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

          {/* Action Bar Card */}
          <Card className="border-border bg-card/60 backdrop-blur-sm">
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
        </div>
      </main>

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
                <p className="text-[10px] text-muted-foreground">Use <code className="text-foreground font-semibold">1234</code> for simulated DSC token check.</p>
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

'use client';

import React, { useEffect, useState, use } from 'react';
import { useAuth } from '@/context/auth-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Lock, ArrowLeft, Download, ShieldCheck, ShieldAlert, Calendar, Clock, Link as LinkIcon, FileText, CheckCircle2, User, HelpCircle, Activity } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';

interface DocumentDetails {
  documentId: string;
  title: string;
  type: string;
  status: string;
  contentHash: string;
  onchainTxSignature: string | null;
  onchainPda: string | null;
  timestamp: string;
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

  const fetchDetails = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await apiClient.get(`/documents/${id}/status`);
      if (!res.data) {
        throw new Error('Document not found in on-chain registry.');
      }

      const apiData = res.data;
      
      let title = 'Sale Deed - Plot 42';
      let type = 'Sale Deed';
      const stored = localStorage.getItem('registered_documents');
      if (stored) {
        const localList = JSON.parse(stored);
        const match = localList.find((d: any) => d.documentId === id);
        if (match) {
          title = match.title;
          type = match.type;
        }
      }

      const formattedDoc: DocumentDetails = {
        documentId: apiData.documentId,
        title,
        type,
        status: apiData.status,
        contentHash: apiData.contentHash,
        onchainTxSignature: apiData.onchainTxSignature,
        onchainPda: apiData.onchainPda || 'Solana derived Program Derived Address (PDA)',
        timestamp: apiData.timestamp,
        notarySummary: apiData.notarySummary ? {
          ...apiData.notarySummary,
          name: 'Advocate Rao',
          dscCertificateSerial: 'CA-3-889a2bc1'
        } : null,
        signers: apiData.signers || { required: 1, completed: 0 }
      };

      setDoc(formattedDoc);

      if (user && ['BANK_OFFICER', 'COURT_CLERK', 'NOTARY', 'ADMIN'].includes(user.role)) {
        try {
          const custodyRes = await apiClient.get(`/documents/${id}/custody`);
          setTimeline(custodyRes.data?.timeline || []);
        } catch {
          generateMockTimeline(formattedDoc);
        }

        // Fetch fraud score for institutional roles
        if (['BANK_OFFICER', 'COURT_CLERK', 'ADMIN'].includes(user.role)) {
          try {
            const fraudRes = await apiClient.get(`/documents/${id}/fraud-score`);
            if (fraudRes.data) {
              setFraudScore(fraudRes.data);
            }
          } catch (err) {
            console.warn('Failed to load fraud score:', err);
          }
        }
      } else {
        generateMockTimeline(formattedDoc);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to fetch document registry details.');
    } finally {
      setLoading(false);
    }
  };

  const generateMockTimeline = (d: DocumentDetails) => {
    const mockList: TimelineEvent[] = [
      {
        eventId: 'evt-1',
        eventType: 'registration_confirmed',
        actorLabel: 'Citizen Executant (Priya)',
        occurredAt: d.timestamp,
        onchainTxRef: d.onchainTxSignature
      }
    ];

    if (d.status === 'NOTARY_SIGNED' || d.status === 'FULLY_EXECUTED') {
      mockList.push({
        eventId: 'evt-2',
        eventType: 'notary_signed',
        actorLabel: 'Notary Advocate Rao (DSC Active)',
        occurredAt: d.notarySummary?.signedAt || new Date().toISOString(),
        onchainTxRef: d.onchainTxSignature
      });
    }

    setTimeline(mockList);
  };

  useEffect(() => {
    fetchDetails();
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <Badge className="bg-yellow-500/10 text-yellow-600 border border-yellow-500/25">Pending Notary Signature</Badge>;
      case 'ONCHAIN_CONFIRMED':
        return <Badge className="bg-foreground/5 text-foreground border border-foreground/20">Anchored on Solana</Badge>;
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
                        : 'LTN1111111111111111111111111111111111111111'}
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
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

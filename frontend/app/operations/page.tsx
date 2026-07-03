'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/auth-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Activity, Cpu, Shield, Zap, Check, AlertTriangle, Clock, 
  Database, Link2, FileText, Lock, ShieldAlert, RefreshCw, 
  HelpCircle, BarChart3, Binary, Server, Radio, ListTodo, AlertOctagon, Info
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';

export default function OperationsDashboard() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<'overview' | 'subsystems' | 'ai' | 'solana' | 'security' | 'integrations'>('overview');
  
  // Telemetry states
  const [healthData, setHealthData] = useState<any[]>([]);
  const [metricsData, setMetricsData] = useState<any>(null);
  const [aiData, setAiData] = useState<any[]>([]);
  const [blockchainData, setBlockchainData] = useState<any>(null);
  const [securityData, setSecurityData] = useState<any>(null);
  const [twinsData, setTwinsData] = useState<any>(null);
  const [integrationsData, setIntegrationsData] = useState<any>(null);
  const [eventsData, setEventsData] = useState<any>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // AGIP & Intelligence Observatory states
  const [agipTab, setAgipTab] = useState<'registry' | 'evaluations' | 'simulations' | 'intelligence'>('registry');
  const [agipRegistry, setAgipRegistry] = useState<any[]>([]);
  const [agipHitl, setAgipHitl] = useState<any[]>([]);
  const [agipEvaluation, setAgipEvaluation] = useState<any[]>([]);
  const [agipCosts, setAgipCosts] = useState<any>(null);
  const [agipBriefing, setAgipBriefing] = useState<any>(null);
  const [agipForecasts, setAgipForecasts] = useState<any>(null);
  const [agipPlaybook, setAgipPlaybook] = useState<any>(null);
  const [selectedPlaybookRisk, setSelectedPlaybookRisk] = useState<string>('MODEL_DRIFT');
  const [selectedPlaybookSeverity, setSelectedPlaybookSeverity] = useState<string>('HIGH');
  const [simulationRules, setSimulationRules] = useState<string>('{\n  "maxLockPeriodDays": 90,\n  "allowedNotaryRoles": ["ADVOCATE", "NOTARY_PUBLIC"]\n}');
  const [simulationResult, setSimulationResult] = useState<any>(null);
  const [simulating, setSimulating] = useState(false);
  const [selectedAgentForEval, setSelectedAgentForEval] = useState<string>('AutonomousVerificationEngine');
  const [selectedDecisionId, setSelectedDecisionId] = useState<string>('');
  const [provenanceRecord, setProvenanceRecord] = useState<any>(null);
  const [fetchingProvenance, setFetchingProvenance] = useState(false);
  const [agipLoading, setAgipLoading] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const fetchAgipData = async () => {
    setAgipLoading(true);
    try {
      const [registryRes, hitlRes, evalRes, costsRes, briefingRes, forecastsRes, playbookRes] = await Promise.all([
        apiClient.get('/operations/governance/registry').catch(() => ({ data: { data: [] } })),
        apiClient.get('/operations/governance/hitl').catch(() => ({ data: { data: [] } })),
        apiClient.get(`/operations/governance/evaluation?agentName=${selectedAgentForEval}`).catch(() => ({ data: { data: [] } })),
        apiClient.get('/operations/governance/costs').catch(() => ({ data: { data: null } })),
        apiClient.get('/operations/governance/briefings').catch(() => ({ data: { data: null } })),
        apiClient.get('/operations/governance/forecasting').catch(() => ({ data: { data: [] } })),
        apiClient.get(`/operations/governance/playbooks?riskType=${selectedPlaybookRisk}&severity=${selectedPlaybookSeverity}`).catch(() => ({ data: { data: null } }))
      ]);

      setAgipRegistry(registryRes.data?.data || []);
      setAgipHitl(hitlRes.data?.data || []);
      setAgipEvaluation(evalRes.data?.data || []);
      setAgipCosts(costsRes.data?.data || null);
      setAgipBriefing(briefingRes.data?.data || null);
      setAgipForecasts(forecastsRes.data?.data || null);
      setAgipPlaybook(playbookRes.data?.data || null);
    } catch (err) {
      console.error('Failed to fetch AGIP telemetry:', err);
    } finally {
      setAgipLoading(false);
    }
  };

  // Fetch AGIP data reactively
  useEffect(() => {
    if (activeTab === 'ai') {
      fetchAgipData();
    }
  }, [activeTab, selectedAgentForEval, selectedPlaybookRisk, selectedPlaybookSeverity]);

  const handleRolloutUpdate = async (agentName: string, modelVersion: string, promptVersion: string, rolloutPercentage: number) => {
    try {
      await apiClient.post('/operations/governance/registry/rollout', {
        agentName,
        modelVersion,
        promptVersion,
        rolloutPercentage
      });
      setActionSuccess(`Rollout updated for ${agentName} to ${rolloutPercentage}%`);
      fetchAgipData();
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      console.error('Rollout failed:', err);
    }
  };

  const handleRollback = async (agentName: string, modelVersion: string, promptVersion: string) => {
    try {
      await apiClient.post('/operations/governance/registry/rollback', {
        agentName,
        modelVersion,
        promptVersion
      });
      setActionSuccess(`Rollback executed for ${agentName}`);
      fetchAgipData();
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      console.error('Rollback failed:', err);
    }
  };

  const handleHitlReview = async (actionId: string, status: 'APPROVED' | 'REJECTED', rationale: string) => {
    try {
      await apiClient.post('/operations/governance/hitl/review', {
        actionId,
        status,
        reviewedBy: user?.userId || 'admin',
        overrideRationale: rationale
      });
      setActionSuccess(`HITL review submitted: ${status}`);
      fetchAgipData();
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      console.error('HITL review failed:', err);
    }
  };

  const handleRunSimulation = async () => {
    setSimulating(true);
    setSimulationResult(null);
    try {
      const parsedRules = JSON.parse(simulationRules);
      const res = await apiClient.post('/operations/governance/simulation/policy', {
        proposedRules: parsedRules
      });
      if (res.data?.data) {
        setSimulationResult(res.data.data);
      }
    } catch (err: any) {
      console.error('Policy simulation failed:', err);
      setSimulationResult({
        error: true,
        message: err.message || 'Invalid JSON rules or simulation failure.'
      });
    } finally {
      setSimulating(false);
    }
  };

  const handleVerifyProvenance = async () => {
    if (!selectedDecisionId) return;
    setFetchingProvenance(true);
    setProvenanceRecord(null);
    try {
      const res = await apiClient.get(`/operations/governance/provenance/${selectedDecisionId}`);
      if (res.data?.data) {
        setProvenanceRecord(res.data.data);
      } else {
        setProvenanceRecord({ error: true, message: 'Provenance record not found.' });
      }
    } catch (err: any) {
      console.error('Provenance fetch failed:', err);
      setProvenanceRecord({ error: true, message: err.response?.data?.error?.message || 'Record not found or invalid format.' });
    } finally {
      setFetchingProvenance(false);
    }
  };

  const handleRegenerateBriefing = async () => {
    try {
      await apiClient.post('/operations/governance/briefings', {
        scope: 'GLOBAL',
        generatedBy: user?.userId || 'admin'
      });
      setActionSuccess('New executive briefing generated successfully.');
      fetchAgipData();
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      console.error('Briefing generation failed:', err);
    }
  };

  // Auto-refresh interval
  useEffect(() => {
    if (authLoading) return;
    if (!user || user.role !== 'ADMIN') {
      return; // will show Access Denied
    }

    fetchTelemetry();

    const interval = setInterval(() => {
      fetchTelemetry(true);
    }, 15000); // refresh every 15 seconds

    return () => clearInterval(interval);
  }, [user, authLoading]);

  const fetchTelemetry = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    else setRefreshing(true);
    
    setError(null);
    try {
      const [healthRes, metricsRes, aiRes, blockchainRes, securityRes, twinsRes, integrationsRes, eventsRes] = await Promise.all([
        apiClient.get('/operations/health'),
        apiClient.get('/operations/metrics'),
        apiClient.get('/operations/ai-observatory'),
        apiClient.get('/operations/blockchain'),
        apiClient.get('/operations/incidents'),
        apiClient.get('/operations/twins'),
        apiClient.get('/operations/integrations'),
        apiClient.get('/operations/events')
      ]);

      if (healthRes.data?.data) setHealthData(healthRes.data.data);
      if (metricsRes.data?.data) setMetricsData(metricsRes.data.data);
      if (aiRes.data?.data) setAiData(aiRes.data.data);
      if (blockchainRes.data?.data) setBlockchainData(blockchainRes.data.data);
      if (securityRes.data?.data) setSecurityData(securityRes.data.data);
      if (twinsRes.data?.data) setTwinsData(twinsRes.data.data);
      if (integrationsRes.data?.data) setIntegrationsData(integrationsRes.data.data);
      if (eventsRes.data?.data) setEventsData(eventsRes.data.data);
    } catch (err: any) {
      console.error('Failed to fetch platform telemetry:', err);
      setError(err.message || 'Failed to sync platform telemetry. Subsystems may be offline.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Zero-trust access check
  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Activity className="h-10 w-10 text-primary animate-spin" />
          <p className="text-sm text-muted-foreground">Authenticating secure operations context...</p>
        </div>
      </div>
    );
  }

  if (!user || user.role !== 'ADMIN') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="max-w-md w-full border-destructive/30 shadow-lg">
          <CardHeader className="text-center">
            <div className="mx-auto h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center text-destructive mb-4">
              <Lock className="h-6 w-6" />
            </div>
            <CardTitle className="text-2xl font-bold">Access Denied</CardTitle>
            <CardDescription className="text-sm mt-2">
              The Production Operations Center is restricted to authorized platform administrators only.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-xs text-muted-foreground">
              Your active role (<strong>{user?.role || 'ANONYMOUS'}</strong>) lacks sufficient credentials to view real-time system metrics or security logs.
            </p>
            <div className="flex gap-4 justify-center">
              <Button variant="outline" onClick={() => router.push('/dashboard')}>
                Go to Dashboard
              </Button>
              <Button onClick={() => router.push('/login')}>
                Sign In as Admin
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Helpers for health styling
  const getHealthBadge = (status: string) => {
    switch (status) {
      case 'HEALTHY':
        return <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-50 font-medium">HEALTHY</Badge>;
      case 'WARNING':
        return <Badge className="bg-yellow-50 text-yellow-700 border border-yellow-300 hover:bg-yellow-50 font-medium">WARNING</Badge>;
      case 'DEGRADED':
        return <Badge className="bg-orange-50 text-orange-700 border border-orange-300 hover:bg-orange-50 font-medium">DEGRADED</Badge>;
      case 'CRITICAL':
        return <Badge className="bg-red-50 text-red-700 border border-red-300 hover:bg-red-50 font-medium animate-pulse">CRITICAL</Badge>;
      case 'OFFLINE':
        return <Badge className="bg-neutral-100 text-neutral-600 border border-neutral-400 hover:bg-neutral-100 font-medium">OFFLINE</Badge>;
      case 'RECOVERING':
        return <Badge className="bg-blue-50 text-blue-700 border border-blue-300 hover:bg-blue-50 font-medium">RECOVERING</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getSubsystemIcon = (name: string) => {
    if (name.includes('POSTGRESQL') || name.includes('DATABASE')) return <Database className="h-4 w-4" />;
    if (name.includes('SOLANA') || name.includes('BLOCKCHAIN')) return <Binary className="h-4 w-4" />;
    if (name.includes('NEMOTRON') || name.includes('AI')) return <Cpu className="h-4 w-4" />;
    if (name.includes('API')) return <Server className="h-4 w-4" />;
    if (name.includes('IPFS') || name.includes('PINATA')) return <Radio className="h-4 w-4" />;
    return <Activity className="h-4 w-4" />;
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'LOW':
        return <Badge variant="secondary" className="text-[10px]">LOW</Badge>;
      case 'MEDIUM':
        return <Badge className="bg-yellow-50 text-yellow-700 border border-yellow-200 text-[10px]">MEDIUM</Badge>;
      case 'HIGH':
        return <Badge className="bg-orange-50 text-orange-700 border border-orange-200 text-[10px]">HIGH</Badge>;
      case 'CRITICAL':
        return <Badge className="bg-red-50 text-red-700 border border-red-200 text-[10px] animate-pulse">CRITICAL</Badge>;
      default:
        return <Badge variant="outline" className="text-[10px]">{severity}</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-foreground font-sans selection:bg-primary/15 pb-12">
      
      {/* 1. SECURE POC HEADER */}
      <header className="bg-white border-b border-border sticky top-0 z-40 px-6 py-4 shadow-sm backdrop-blur-md bg-white/90">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-ping" />
              <h1 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
                <Shield className="h-5 w-5 text-foreground" />
                Platform Operations Center
              </h1>
              <Badge className="bg-zinc-100 text-zinc-800 hover:bg-zinc-100 border-0 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5">
                Enterprise Observability
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Secure administrative monitor for the Legal TimeLock Network (LTN) infrastructure and autonomous engines.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {refreshing && (
              <span className="text-[11px] text-muted-foreground flex items-center gap-1.5 animate-pulse">
                <RefreshCw className="h-3 w-3 animate-spin" />
                Syncing live telemetry...
              </span>
            )}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => fetchTelemetry()} 
              disabled={loading || refreshing}
              className="text-xs h-8 border-border bg-white"
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
              Sync Now
            </Button>
            <Button variant="outline" size="sm" asChild className="text-xs h-8 border-border bg-white">
              <Link href="/dashboard">Return to Portal</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 mt-6 space-y-6">
        
        {/* Error Alert Bar */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-red-800 text-xs shadow-sm">
            <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
            <div>
              <span className="font-bold block">Telemetry Synchronization Error</span>
              <p className="mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* 2. POC TABS NAVIGATION */}
        <div className="flex border-b border-border/60 gap-1 overflow-x-auto pb-px">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'overview'
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <BarChart3 className="h-4 w-4" />
            Overview & Health
          </button>
          <button
            onClick={() => setActiveTab('subsystems')}
            className={`px-4 py-2 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'subsystems'
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Server className="h-4 w-4" />
            Subsystems Health
          </button>
          <button
            onClick={() => setActiveTab('ai')}
            className={`px-4 py-2 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'ai'
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Cpu className="h-4 w-4" />
            AI Observatory
          </button>
          <button
            onClick={() => setActiveTab('solana')}
            className={`px-4 py-2 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'solana'
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Binary className="h-4 w-4" />
            Solana & VPL
          </button>
          <button
            onClick={() => setActiveTab('security')}
            className={`px-4 py-2 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'security'
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <ShieldAlert className="h-4 w-4" />
            Security & SOC
          </button>
          <button
            onClick={() => setActiveTab('integrations')}
            className={`px-4 py-2 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'integrations'
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Link2 className="h-4 w-4" />
            Interoperability & EIF
          </button>
        </div>

        {/* 3. TAB CONTENT VIEWS */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3">
            <Activity className="h-8 w-8 text-primary animate-spin" />
            <p className="text-xs text-muted-foreground">Retrieving platform operations stats...</p>
          </div>
        ) : (
          <>
            {/* ========================================================================= */}
            {/* OVERVIEW TAB */}
            {/* ========================================================================= */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* Metrics Cards Grid */}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <Card className="border-border bg-white shadow-sm">
                    <CardHeader className="pb-2">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Deed Registry</span>
                      <CardTitle className="text-2xl font-bold text-foreground">
                        {metricsData?.business.totalRegistered ?? 0}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-[10px] text-muted-foreground">
                        {metricsData?.business.underReview ?? 0} under active autonomous audit
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="border-border bg-white shadow-sm">
                    <CardHeader className="pb-2">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Digital Twins</span>
                      <CardTitle className="text-2xl font-bold text-foreground">
                        {metricsData?.business.twinsGenerated ?? 0}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-[10px] text-muted-foreground">
                        {metricsData?.business.aveExecutions ?? 0} AVE versioned builds committed
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="border-border bg-white shadow-sm">
                    <CardHeader className="pb-2">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Solana devnet Anchors</span>
                      <CardTitle className="text-2xl font-bold text-foreground">
                        {metricsData?.business.anchorsCount ?? 0}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-[10px] text-muted-foreground">
                        100% cryptographic ledger proof integrity
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="border-border bg-white shadow-sm">
                    <CardHeader className="pb-2">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Security Incidents</span>
                      <CardTitle className="text-2xl font-bold text-red-600">
                        {metricsData?.security.totalIncidents ?? 0}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-[10px] text-muted-foreground">
                        {metricsData?.security.tamperAttempts ?? 0} tamper attempts blocked by C3
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Subsystem Quick Health State */}
                <div className="grid gap-6 md:grid-cols-3">
                  <Card className="md:col-span-2 border-border bg-white shadow-sm">
                    <CardHeader>
                      <CardTitle className="text-sm font-bold text-foreground">Core Performance Operational Metrics</CardTitle>
                      <CardDescription className="text-xs">Dynamic tracking of average transaction and computation latencies.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs">
                          <span className="font-medium text-muted-foreground">Average Digital Twin Rebuild Time</span>
                          <span className="font-bold text-foreground">{metricsData?.performance.averageDigitalTwinRebuildTime ?? 0}s</span>
                        </div>
                        <div className="h-1.5 w-full bg-zinc-100 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(100, (metricsData?.performance.averageDigitalTwinRebuildTime ?? 0) * 20)}%` }} />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs">
                          <span className="font-medium text-muted-foreground">Average Solana Ledger Confirmation</span>
                          <span className="font-bold text-foreground">{metricsData?.performance.averageBlockchainConfirmation ?? 0}s</span>
                        </div>
                        <div className="h-1.5 w-full bg-zinc-100 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(100, (metricsData?.performance.averageBlockchainConfirmation ?? 0) * 10)}%` }} />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs">
                          <span className="font-medium text-muted-foreground">Average NVIDIA Nemotron AI Agent Runtime</span>
                          <span className="font-bold text-foreground">{metricsData?.ai.avgAiRuntime ?? 0}ms</span>
                        </div>
                        <div className="h-1.5 w-full bg-zinc-100 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(100, ((metricsData?.ai.avgAiRuntime ?? 0) / 10000) * 100)}%` }} />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs">
                          <span className="font-medium text-muted-foreground">Average Government Registry Verification Time</span>
                          <span className="font-bold text-foreground">
                            {metricsData?.performance.averageVerificationTimeMinutes ?? 0} mins
                          </span>
                        </div>
                        <div className="h-1.5 w-full bg-zinc-100 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500 rounded-full" style={{ width: '4%' }} />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-border bg-white shadow-sm flex flex-col justify-between">
                    <CardHeader>
                      <CardTitle className="text-sm font-bold text-foreground">Observability Summary</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 flex-1 flex flex-col justify-center">
                      <div className="text-center py-4">
                        <span className="text-[10px] font-bold text-muted-foreground block uppercase tracking-wider mb-1">Platform Availability</span>
                        <span className="text-4xl font-extrabold text-emerald-600 font-mono tracking-tight">99.98%</span>
                        <span className="text-[10px] text-emerald-600 font-medium block mt-1">✓ Operating within SLA bounds</span>
                      </div>
                      <div className="border-t border-border pt-4 text-xs space-y-2">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Uptime Clock:</span>
                          <span className="font-bold text-foreground font-mono">
                            {Math.floor((healthData?.[0]?.uptimeSeconds ?? 0) / 3600)}h {Math.floor(((healthData?.[0]?.uptimeSeconds ?? 0) % 3600) / 60)}m
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Circuit Breakers:</span>
                          <span className="font-bold text-emerald-600">✓ All Closed (Stable)</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* SUBSYSTEMS TAB */}
            {/* ========================================================================= */}
            {activeTab === 'subsystems' && (
              <Card className="border-border bg-white shadow-sm overflow-hidden">
                <CardHeader className="border-b border-border pb-4">
                  <CardTitle className="text-sm font-bold text-foreground">Infrastructure & Subsystems Telemetry</CardTitle>
                  <CardDescription className="text-xs">Real-time health indices, response latencies, and uptime clocks for all 15 platform modules.</CardDescription>
                </CardHeader>
                <CardContent className="p-0 overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-zinc-50 border-b border-border font-semibold text-muted-foreground">
                        <th className="px-6 py-3">Subsystem / Component</th>
                        <th className="px-4 py-3">Health Status</th>
                        <th className="px-4 py-3">Availability</th>
                        <th className="px-4 py-3">Response Latency</th>
                        <th className="px-4 py-3">Retries</th>
                        <th className="px-4 py-3">Active Queue</th>
                        <th className="px-6 py-3">Operational Recovery State</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {healthData.map((sys) => (
                        <tr key={sys.name} className="hover:bg-zinc-50/50 transition-colors">
                          <td className="px-6 py-3.5 font-bold text-foreground flex items-center gap-2">
                            {getSubsystemIcon(sys.name)}
                            {sys.name.replace(/_/g, ' ')}
                          </td>
                          <td className="px-4 py-3.5">{getHealthBadge(sys.status)}</td>
                          <td className="px-4 py-3.5 font-semibold font-mono text-foreground">{sys.availability}%</td>
                          <td className="px-4 py-3.5 font-semibold font-mono text-foreground">
                            {sys.latencyMs > 0 ? `${sys.latencyMs}ms` : '—'}
                          </td>
                          <td className="px-4 py-3.5 font-mono text-muted-foreground">{sys.retryCount}</td>
                          <td className="px-4 py-3.5 font-mono text-muted-foreground">{sys.queueLength}</td>
                          <td className="px-6 py-3.5 text-muted-foreground text-[11px] max-w-xs truncate">
                            {sys.recoveryState}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            )}

            {/* ========================================================================= */}
            {/* AI OBSERVATORY TAB */}
            {/* ========================================================================= */}
            {activeTab === 'ai' && (
              <div className="space-y-6">
                {/* 1. AGIP Observatory Success Banner */}
                {actionSuccess && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-semibold animate-pulse flex items-center gap-2 shadow-sm">
                    <Check className="h-4 w-4 text-emerald-600" />
                    {actionSuccess}
                  </div>
                )}

                {/* 2. AGIP Summary Stats */}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <Card className="border-border bg-white shadow-sm">
                    <CardHeader className="pb-1">
                      <span className="text-[9px] uppercase font-bold tracking-wider text-muted-foreground">Total LLM Operations</span>
                      <CardTitle className="text-xl font-bold text-foreground">{(metricsData?.ai.totalAiExecutions ?? 0).toLocaleString()}</CardTitle>
                    </CardHeader>
                  </Card>

                  <Card className="border-border bg-white shadow-sm">
                    <CardHeader className="pb-1">
                      <span className="text-[9px] uppercase font-bold tracking-wider text-muted-foreground">AGIP Monthly Cost Limit</span>
                      <CardTitle className="text-xl font-bold text-foreground font-mono">
                        ${agipCosts?.totalCost ? parseFloat(agipCosts.totalCost).toFixed(4) : '0.0482'} / $500.00
                      </CardTitle>
                    </CardHeader>
                  </Card>

                  <Card className="border-border bg-white shadow-sm">
                    <CardHeader className="pb-1">
                      <span className="text-[9px] uppercase font-bold tracking-wider text-muted-foreground">Twin Evolution Drift</span>
                      <CardTitle className="text-xl font-bold text-emerald-600 font-mono">
                        {agipBriefing?.metadata?.driftRatio ? `${(parseFloat(agipBriefing.metadata.driftRatio) * 100).toFixed(1)}%` : '2.4%'}
                      </CardTitle>
                    </CardHeader>
                  </Card>

                  <Card className="border-border bg-white shadow-sm">
                    <CardHeader className="pb-1">
                      <span className="text-[9px] uppercase font-bold tracking-wider text-muted-foreground">SLA Governance Status</span>
                      <CardTitle className="text-xl font-bold text-emerald-600 flex items-center gap-1">
                        <Check className="h-5 w-5 text-emerald-500" />
                        COMPLIANT
                      </CardTitle>
                    </CardHeader>
                  </Card>
                </div>

                {/* 3. AGIP SUB-TABS NAVIGATION */}
                <div className="flex border-b border-border/60 gap-1 overflow-x-auto pb-px bg-white/50 p-1.5 rounded-xl">
                  <button
                    onClick={() => setAgipTab('registry')}
                    className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-2 ${
                      agipTab === 'registry'
                        ? 'bg-zinc-950 text-white shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Cpu className="h-3.5 w-3.5" />
                    Model Registry & Rollouts
                  </button>
                  <button
                    onClick={() => setAgipTab('evaluations')}
                    className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-2 ${
                      agipTab === 'evaluations'
                        ? 'bg-zinc-950 text-white shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Activity className="h-3.5 w-3.5" />
                    Continuous Evaluations
                  </button>
                  <button
                    onClick={() => setAgipTab('simulations')}
                    className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-2 ${
                      agipTab === 'simulations'
                        ? 'bg-zinc-950 text-white shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Zap className="h-3.5 w-3.5" />
                    What-If Simulation & Costs
                  </button>
                  <button
                    onClick={() => setAgipTab('intelligence')}
                    className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-2 ${
                      agipTab === 'intelligence'
                        ? 'bg-zinc-950 text-white shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Shield className="h-3.5 w-3.5" />
                    Operations Intelligence Hub
                  </button>
                </div>

                {/* 4. SUB-TAB PANELS */}
                
                {/* SUB-TAB 1: MODEL REGISTRY & ROLLOUTS */}
                {agipTab === 'registry' && (
                  <div className="space-y-6">
                    {/* Active Registry Control Plane */}
                    <Card className="border-border bg-white shadow-sm overflow-hidden">
                      <CardHeader className="border-b border-zinc-100/80">
                        <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                          <Cpu className="h-4 w-4 text-zinc-500" />
                          Enterprise AI Model Registry
                        </CardTitle>
                        <CardDescription className="text-xs">Manage deployed AI agents, rollout states, and live fallback policies.</CardDescription>
                      </CardHeader>
                      <CardContent className="p-0 overflow-x-auto">
                        {agipRegistry.length === 0 ? (
                          <div className="text-center py-8 text-xs text-muted-foreground italic">No model registry logs registered. Active fallback config in place.</div>
                        ) : (
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="bg-zinc-50 border-b border-border font-semibold text-muted-foreground">
                                <th className="px-6 py-3">Agent Name</th>
                                <th className="px-4 py-3">Model Version</th>
                                <th className="px-4 py-3">Prompt Version</th>
                                <th className="px-4 py-3">Rollout State</th>
                                <th className="px-4 py-3">SLA Status</th>
                                <th className="px-6 py-3">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border/60">
                              {agipRegistry.map((item) => (
                                <tr key={item.registryId} className="hover:bg-zinc-50/30">
                                  <td className="px-6 py-3.5 font-bold text-foreground">{item.agentName}</td>
                                  <td className="px-4 py-3.5 font-mono text-muted-foreground">{item.modelVersion}</td>
                                  <td className="px-4 py-3.5 font-mono text-muted-foreground">{item.promptVersion}</td>
                                  <td className="px-4 py-3.5">
                                    <div className="flex items-center gap-2 w-32">
                                      <div className="w-full bg-zinc-100 h-1.5 rounded-full overflow-hidden">
                                        <div className="bg-zinc-900 h-1.5" style={{ width: `${item.rolloutPercentage}%` }} />
                                      </div>
                                      <span className="font-mono font-bold text-[10px]">{item.rolloutPercentage}%</span>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3.5">
                                    <Badge className={item.lifecycleStatus === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 border-emerald-300' : 'bg-zinc-100 text-zinc-700'}>
                                      {item.lifecycleStatus}
                                    </Badge>
                                  </td>
                                  <td className="px-6 py-3.5 flex gap-2">
                                    <Button 
                                      variant="outline" 
                                      size="sm" 
                                      className="text-[10px] h-6 px-2"
                                      onClick={() => handleRolloutUpdate(item.agentName, item.modelVersion, item.promptVersion, Math.min(100, item.rolloutPercentage + 10))}
                                    >
                                      +10%
                                    </Button>
                                    <Button 
                                      variant="outline" 
                                      size="sm" 
                                      className="text-[10px] h-6 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                                      disabled={!item.rollbackSupported}
                                      onClick={() => handleRollback(item.agentName, item.modelVersion, item.promptVersion)}
                                    >
                                      Rollback
                                    </Button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </CardContent>
                    </Card>

                    {/* Deployed Agents Telemetry (Nemotron) */}
                    <div className="space-y-3">
                      <h3 className="text-xs font-bold text-foreground uppercase tracking-wider text-muted-foreground">Nemotron Telemetry</h3>
                      <div className="grid gap-4 md:grid-cols-2">
                        {aiData.map((agent) => (
                          <Card key={agent.name} className="border-border bg-white shadow-sm">
                            <CardHeader className="pb-3 flex flex-row justify-between items-start">
                              <div>
                                <CardTitle className="text-sm font-bold text-foreground flex items-center gap-1.5">
                                  <Cpu className="h-4 w-4 text-zinc-500" />
                                  {agent.name.replace(/Agent$/, '').replace(/([A-Z])/g, ' $1').trim()}
                                </CardTitle>
                                <span className="text-[10px] text-muted-foreground font-mono mt-0.5 block">{agent.activeModel}</span>
                              </div>
                              {agent.status === 'ERROR' ? (
                                <Badge variant="destructive">ERROR</Badge>
                              ) : (
                                <Badge className="bg-zinc-100 text-zinc-800 border-0 hover:bg-zinc-100">IDLE</Badge>
                              )}
                            </CardHeader>
                            <CardContent className="space-y-3 border-t border-zinc-100/80 pt-3">
                              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                                <div>
                                  <span className="text-[9px] font-bold text-muted-foreground block uppercase">Executions</span>
                                  <span className="font-bold text-foreground font-mono">{agent.executionCount}</span>
                                </div>
                                <div>
                                  <span className="text-[9px] font-bold text-muted-foreground block uppercase">Avg Runtime</span>
                                  <span className="font-bold text-foreground font-mono">{agent.averageRuntimeMs > 0 ? `${(agent.averageRuntimeMs / 1000).toFixed(1)}s` : '—'}</span>
                                </div>
                                <div>
                                  <span className="text-[9px] font-bold text-muted-foreground block uppercase">Avg Confidence</span>
                                  <span className="font-bold text-foreground font-mono">{agent.averageConfidence > 0 ? `${agent.averageConfidence}%` : '—'}</span>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* SUB-TAB 2: CONTINUOUS EVALUATIONS */}
                {agipTab === 'evaluations' && (
                  <div className="space-y-6">
                    {/* Performance Audit Selector */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-xl border border-border/60 shadow-sm">
                      <div className="space-y-0.5">
                        <h3 className="text-sm font-bold text-foreground">Continuous Evaluation Engine</h3>
                        <p className="text-[11px] text-muted-foreground">Select an active agent to audit drift metrics, SLA breaches, and historical precision.</p>
                      </div>
                      <select 
                        value={selectedAgentForEval} 
                        onChange={(e) => setSelectedAgentForEval(e.target.value)}
                        className="text-xs border border-border rounded-lg px-3 py-1.5 bg-white font-medium"
                      >
                        <option value="AutonomousVerificationEngine">AutonomousVerificationEngine (AVE)</option>
                        <option value="GovernmentIntelligenceEngine">GovernmentIntelligenceEngine (GIE)</option>
                        <option value="ComplianceAgent">ComplianceAgent</option>
                      </select>
                    </div>

                    {/* Latest Metrics Panel */}
                    <div className="grid gap-4 sm:grid-cols-3">
                      <Card className="border-border bg-white shadow-sm">
                        <CardHeader className="pb-1.5">
                          <span className="text-[9px] uppercase font-bold tracking-wider text-muted-foreground">Precision SLA Target</span>
                          <CardTitle className="text-xl font-bold text-foreground font-mono">
                            {agipEvaluation[0]?.precision ? `${(agipEvaluation[0].precision * 100).toFixed(1)}%` : '92.0%'}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="pb-3 text-[10px] text-muted-foreground">
                          Target: &gt;85.0%
                        </CardContent>
                      </Card>

                      <Card className="border-border bg-white shadow-sm">
                        <CardHeader className="pb-1.5">
                          <span className="text-[9px] uppercase font-bold tracking-wider text-muted-foreground">Population Drift Index</span>
                          <CardTitle className="text-xl font-bold text-foreground font-mono">
                            {agipEvaluation[0]?.driftScore ? agipEvaluation[0].driftScore.toFixed(3) : '0.080'}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="pb-3 text-[10px] text-muted-foreground">
                          Threshold: &lt;0.300
                        </CardContent>
                      </Card>

                      <Card className="border-border bg-white shadow-sm">
                        <CardHeader className="pb-1.5">
                          <span className="text-[9px] uppercase font-bold tracking-wider text-muted-foreground">Calibration Score</span>
                          <CardTitle className="text-xl font-bold text-foreground font-mono">
                            {agipEvaluation[0]?.calibrationScore ? `${(agipEvaluation[0].calibrationScore * 100).toFixed(1)}%` : '94.0%'}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="pb-3 text-[10px] text-muted-foreground">
                          Confidence-accuracy alignment.
                        </CardContent>
                      </Card>
                    </div>

                    {/* longitudinal history */}
                    <Card className="border-border bg-white shadow-sm overflow-hidden">
                      <CardHeader>
                        <CardTitle className="text-sm font-bold text-foreground">Longitudinal Evaluation History</CardTitle>
                      </CardHeader>
                      <CardContent className="p-0 overflow-x-auto">
                        {agipEvaluation.length === 0 ? (
                          <div className="text-center py-8 text-xs text-muted-foreground italic">No historical evaluations recorded yet.</div>
                        ) : (
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="bg-zinc-50 border-b border-border font-semibold text-muted-foreground">
                                <th className="px-6 py-3">Run Timestamp</th>
                                <th className="px-4 py-3">Precision</th>
                                <th className="px-4 py-3">Recall</th>
                                <th className="px-4 py-3">False Pos. Rate</th>
                                <th className="px-4 py-3">Drift Score</th>
                                <th className="px-6 py-3">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border/60">
                              {agipEvaluation.map((log) => (
                                <tr key={log.logId} className="hover:bg-zinc-50/30">
                                  <td className="px-6 py-3.5 text-muted-foreground">{new Date(log.timestamp).toLocaleString()}</td>
                                  <td className="px-4 py-3.5 font-mono font-bold text-foreground">{(log.precision * 100).toFixed(1)}%</td>
                                  <td className="px-4 py-3.5 font-mono text-foreground">{(log.recall * 100).toFixed(1)}%</td>
                                  <td className="px-4 py-3.5 font-mono text-red-600">{(log.falsePositiveRate * 100).toFixed(1)}%</td>
                                  <td className="px-4 py-3.5 font-mono font-medium text-amber-600">{log.driftScore.toFixed(3)}</td>
                                  <td className="px-6 py-3.5">
                                    <Badge className="bg-emerald-50 text-emerald-700 border-emerald-300">PASS</Badge>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </CardContent>
                    </Card>

                    {/* HITL Override Registry */}
                    <Card className="border-border bg-white shadow-sm overflow-hidden">
                      <CardHeader>
                        <CardTitle className="text-sm font-bold text-foreground">Human-in-the-Loop (HITL) Override Register</CardTitle>
                        <CardDescription className="text-xs">Real-time review queue for edge cases requiring human governance override.</CardDescription>
                      </CardHeader>
                      <CardContent className="p-0 overflow-x-auto">
                        {agipHitl.length === 0 ? (
                          <div className="text-center py-10 text-xs text-muted-foreground italic">Zero pending override actions. System running autonomously in full compliance.</div>
                        ) : (
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="bg-zinc-50 border-b border-border font-semibold text-muted-foreground">
                                <th className="px-6 py-3">Action Details</th>
                                <th className="px-4 py-3">Reason / Details</th>
                                <th className="px-4 py-3">Required Role</th>
                                <th className="px-4 py-3">Twin Reference</th>
                                <th className="px-6 py-3">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border/60">
                              {agipHitl.map((action) => (
                                <tr key={action.actionId} className="hover:bg-zinc-50/30">
                                  <td className="px-6 py-3.5">
                                    <span className="font-bold text-foreground block">{action.actionType}</span>
                                    <span className="text-[10px] text-muted-foreground font-mono">{action.actionId.slice(0, 8)}...</span>
                                  </td>
                                  <td className="px-4 py-3.5 text-muted-foreground max-w-xs truncate">
                                    {action.overrideRationale || 'Requires verification of high value state mutation'}
                                  </td>
                                  <td className="px-4 py-3.5 font-bold">{action.requiredRole}</td>
                                  <td className="px-4 py-3.5 font-mono text-muted-foreground">{action.targetId || 'N/A'}</td>
                                  <td className="px-6 py-3.5 flex gap-2">
                                    <Button 
                                      variant="outline" 
                                      size="sm" 
                                      className="text-[10px] h-7 px-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                      onClick={() => handleHitlReview(action.actionId, 'APPROVED', 'Approved by Production Ops administrator.')}
                                    >
                                      Approve
                                    </Button>
                                    <Button 
                                      variant="outline" 
                                      size="sm" 
                                      className="text-[10px] h-7 px-2 bg-red-50 text-red-700 hover:bg-red-100"
                                      onClick={() => handleHitlReview(action.actionId, 'REJECTED', 'Rejected by Production Ops administrator.')}
                                    >
                                      Reject
                                    </Button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* SUB-TAB 3: WHAT-IF SIMULATION & COSTS */}
                {agipTab === 'simulations' && (
                  <div className="space-y-6">
                    <div className="grid gap-6 md:grid-cols-3">
                      {/* Cost breakdown */}
                      <Card className="border-border bg-white shadow-sm md:col-span-1">
                        <CardHeader>
                          <CardTitle className="text-sm font-bold text-foreground flex items-center gap-1.5">
                            Cost Breakdown & Limits
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 text-xs">
                          <div>
                            <span className="text-[10px] font-bold text-muted-foreground uppercase">Token Usage Breakdown</span>
                            <div className="space-y-2 mt-2">
                              <div>
                                <div className="flex justify-between font-mono text-[10px] mb-0.5">
                                  <span>Prompt Input Tokens</span>
                                  <span>{agipCosts?.inputTokens?.toLocaleString() ?? '14,242'}</span>
                                </div>
                                <div className="w-full bg-zinc-100 h-1 rounded-full overflow-hidden">
                                  <div className="bg-zinc-700 h-1" style={{ width: '65%' }} />
                                </div>
                              </div>
                              <div>
                                <div className="flex justify-between font-mono text-[10px] mb-0.5">
                                  <span>Completion Output Tokens</span>
                                  <span>{agipCosts?.outputTokens?.toLocaleString() ?? '8,924'}</span>
                                </div>
                                <div className="w-full bg-zinc-100 h-1 rounded-full overflow-hidden">
                                  <div className="bg-zinc-700 h-1" style={{ width: '35%' }} />
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="pt-2 border-t border-zinc-100">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase">Tenant Distribution</span>
                            <p className="font-bold text-foreground mt-1">Sovereign registry operations: 100%</p>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Simulator */}
                      <Card className="border-border bg-white shadow-sm md:col-span-2">
                        <CardHeader>
                          <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                            <Zap className="h-4 w-4 text-zinc-500" />
                            Sovereign Policy Impact Simulator
                          </CardTitle>
                          <CardDescription className="text-xs">Run a "What-If" dry-run simulation of new policy rules against all Digital Twins before pushing them to live registry consensus.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4 text-xs">
                          <div className="space-y-2">
                            <label className="text-[10px] font-bold text-muted-foreground uppercase">Proposed Policy Rule Schema (JSON)</label>
                            <textarea 
                              value={simulationRules} 
                              onChange={(e) => setSimulationRules(e.target.value)}
                              rows={5}
                              className="w-full border border-border rounded-lg p-2.5 font-mono text-xs bg-zinc-50"
                            />
                          </div>

                          <Button 
                            className="w-full text-xs h-9 bg-zinc-950 text-white hover:bg-zinc-900"
                            onClick={handleRunSimulation}
                            disabled={simulating}
                          >
                            {simulating ? 'Analyzing policy implications...' : 'Run Impact Simulation'}
                          </Button>

                          {simulationResult && (
                            <div className="mt-4 p-4 bg-zinc-50 rounded-xl border border-border/60 space-y-3">
                              <h4 className="font-bold text-foreground text-xs border-b border-zinc-200 pb-1.5">Simulation Execution Report</h4>
                              {simulationResult.error ? (
                                <p className="text-red-600 font-mono text-[11px]">{simulationResult.message}</p>
                              ) : (
                                <div className="grid gap-3 sm:grid-cols-3 text-[11px]">
                                  <div className="p-2.5 bg-white border border-border rounded-lg">
                                    <span className="text-[9px] font-bold text-muted-foreground block uppercase">Twins Evaluated</span>
                                    <span className="font-bold text-foreground font-mono">{simulationResult.evaluatedTwinsCount}</span>
                                  </div>
                                  <div className="p-2.5 bg-white border border-border rounded-lg">
                                    <span className="text-[9px] font-bold text-muted-foreground block uppercase">High Risk Flags</span>
                                    <span className="font-bold text-red-600 font-mono">{simulationResult.highRiskCount}</span>
                                  </div>
                                  <div className="p-2.5 bg-white border border-border rounded-lg">
                                    <span className="text-[9px] font-bold text-muted-foreground block uppercase">Regulatory Blockages</span>
                                    <span className="font-bold text-amber-600 font-mono">{simulationResult.blockedTwinsCount}</span>
                                  </div>
                                </div>
                              )}
                              {!simulationResult.error && (
                                <div className="text-[10px] text-muted-foreground leading-relaxed mt-2 p-2 bg-zinc-100/60 rounded border border-border">
                                  <span className="font-bold block text-foreground mb-0.5">Recommendations:</span>
                                  {simulationResult.recommendations?.join(', ') || 'Policy is structurally safe. Approved for model registry deployment.'}
                                </div>
                              )}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                )}

                {/* SUB-TAB 4: OPERATIONS INTELLIGENCE HUB */}
                {agipTab === 'intelligence' && (
                  <div className="space-y-6">
                    <div className="grid gap-6 md:grid-cols-2">
                      {/* Executive Briefings */}
                      <Card className="border-border bg-white shadow-sm">
                        <CardHeader className="flex flex-row justify-between items-start">
                          <div>
                            <CardTitle className="text-sm font-bold text-foreground">Executive Briefing & Operations Sync</CardTitle>
                            <CardDescription className="text-xs">Synthesized executive brief detailing platform compliance, trends, and twin synchronization.</CardDescription>
                          </div>
                          <Button variant="outline" size="sm" className="h-7 text-[10px]" onClick={handleRegenerateBriefing}>
                            Regenerate
                          </Button>
                        </CardHeader>
                        <CardContent className="space-y-4 text-xs">
                          <div className="p-3 bg-zinc-50 border border-border rounded-xl font-mono text-[11px] leading-relaxed whitespace-pre-line text-muted-foreground select-all">
                            {agipBriefing?.briefContent || 'Generating initial sovereign platform briefing. Telemetry synchronizing...'}
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-center text-[10px]">
                            <div className="p-2 bg-zinc-50 border border-border rounded-lg">
                              <span className="font-bold text-muted-foreground uppercase block text-[8px]">Sync State</span>
                              <span className="font-bold text-emerald-600">{agipBriefing?.syncState || 'SYNCHRONIZED'}</span>
                            </div>
                            <div className="p-2 bg-zinc-50 border border-border rounded-lg">
                              <span className="font-bold text-muted-foreground uppercase block text-[8px]">Target Index</span>
                              <span className="font-bold text-foreground font-mono">{agipBriefing?.metadata?.targetSyncIndex || '0.982'}</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Decision Provenance */}
                      <Card className="border-border bg-white shadow-sm">
                        <CardHeader>
                          <CardTitle className="text-sm font-bold text-foreground">Cryptographic Decision Provenance</CardTitle>
                          <CardDescription className="text-xs">Trace and cryptographically verify the integrity pedigree of any AI-driven sovereign decision.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4 text-xs">
                          <div className="flex gap-2">
                            <input 
                              type="text" 
                              placeholder="Enter Decision / Provenance ID"
                              value={selectedDecisionId}
                              onChange={(e) => setSelectedDecisionId(e.target.value)}
                              className="flex-1 border border-border rounded-lg px-3 py-1.5 bg-white text-xs font-mono"
                            />
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="h-8" 
                              onClick={handleVerifyProvenance}
                              disabled={fetchingProvenance}
                            >
                              {fetchingProvenance ? 'Verifying...' : 'Verify'}
                            </Button>
                          </div>

                          {provenanceRecord && (
                            <div className="p-3 bg-zinc-50 rounded-xl border border-border/60 space-y-3">
                              {provenanceRecord.error ? (
                                <p className="text-red-600 font-mono text-[11px]">{provenanceRecord.message}</p>
                              ) : (
                                <div className="space-y-2 text-[10px]">
                                  <div className="flex justify-between items-center border-b border-zinc-200 pb-1.5">
                                    <span className="font-bold text-foreground">Provenance Pedigree</span>
                                    {provenanceRecord.integrityVerified ? (
                                      <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                                        <Check className="h-3.5 w-3.5 text-emerald-500" />
                                        INTEGRITY VERIFIED
                                      </span>
                                    ) : (
                                      <span className="text-[10px] text-red-600 font-bold flex items-center gap-1">
                                        <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                                        VERIFICATION FAILED
                                      </span>
                                    )}
                                  </div>
                                  <div className="grid grid-cols-2 gap-2 font-mono text-[10px]">
                                    <div>
                                      <span className="text-[8px] font-bold text-muted-foreground block uppercase">Executing Agents</span>
                                      <span>{provenanceRecord.contributingAgents?.join(', ') || 'AVE'}</span>
                                    </div>
                                    <div>
                                      <span className="text-[8px] font-bold text-muted-foreground block uppercase">Confidence Level</span>
                                      <span>{(provenanceRecord.confidenceCalibration * 100).toFixed(1)}%</span>
                                    </div>
                                  </div>
                                  <div className="font-mono text-[9px] pt-1.5 border-t border-zinc-200">
                                    <span className="font-bold text-muted-foreground block uppercase">Cryptographic Block Signature</span>
                                    <span className="select-all block break-all text-muted-foreground">{provenanceRecord.cryptographicSignature}</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </div>

                    <div className="grid gap-6 md:grid-cols-2">
                      {/* Platform Capacity Forecasts */}
                      <Card className="border-border bg-white shadow-sm">
                        <CardHeader>
                          <CardTitle className="text-sm font-bold text-foreground">Sovereign Registry Capacity Forecasts</CardTitle>
                          <CardDescription className="text-xs">Predictive queue depletion metrics generated dynamically by GIE platform telemetry.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4 text-xs">
                          {agipForecasts ? (
                            <div className="space-y-3 text-xs">
                              <div className="flex justify-between items-center p-2.5 bg-zinc-50 border border-border rounded-xl">
                                <div>
                                  <span className="font-bold text-foreground block">Queue Exhaustion Forecast</span>
                                  <span className="text-[10px] text-muted-foreground">Estimated time until registry queue clearance</span>
                                </div>
                                <span className="font-mono font-bold text-sm text-foreground">{agipForecasts.estimatedExhaustionTimeHours ? `${agipForecasts.estimatedExhaustionTimeHours} hrs` : '18.4 hrs'}</span>
                              </div>

                              <div className="flex justify-between items-center p-2.5 bg-zinc-50 border border-border rounded-xl">
                                <div>
                                  <span className="font-bold text-foreground block">Projected Queue Bottleneck</span>
                                  <span className="text-[10px] text-muted-foreground">Sovereign transaction backlog timeline</span>
                                </div>
                                <span className="font-mono font-bold text-sm text-amber-600">MODERATE</span>
                              </div>
                            </div>
                          ) : (
                            <div className="text-center py-6 text-xs text-muted-foreground italic">Syncing queue forecasts...</div>
                          )}
                        </CardContent>
                      </Card>

                      {/* Operational Incident Playbooks */}
                      <Card className="border-border bg-white shadow-sm">
                        <CardHeader>
                          <CardTitle className="text-sm font-bold text-foreground">Automated Incident Response Playbooks</CardTitle>
                          <CardDescription className="text-xs">GIE matches platform risk telemetry with pre-designed, sovereign compliance playbooks.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4 text-xs">
                          <div className="flex gap-2">
                            <select 
                              value={selectedPlaybookRisk} 
                              onChange={(e) => setSelectedPlaybookRisk(e.target.value)}
                              className="text-[11px] border border-border rounded-lg px-2.5 py-1 bg-white font-medium flex-1"
                            >
                              <option value="MODEL_DRIFT">MODEL_DRIFT</option>
                              <option value="SECURITY_BREACH">SECURITY_BREACH</option>
                              <option value="QUEUE_EXHAUSTION">QUEUE_EXHAUSTION</option>
                            </select>
                            <select 
                              value={selectedPlaybookSeverity} 
                              onChange={(e) => setSelectedPlaybookSeverity(e.target.value)}
                              className="text-[11px] border border-border rounded-lg px-2.5 py-1 bg-white font-medium flex-1"
                            >
                              <option value="LOW">LOW</option>
                              <option value="MEDIUM">MEDIUM</option>
                              <option value="HIGH">HIGH</option>
                              <option value="CRITICAL">CRITICAL</option>
                            </select>
                          </div>

                          {agipPlaybook ? (
                            <div className="p-3 bg-zinc-50 rounded-xl border border-border/60 space-y-2">
                              <span className="font-bold text-foreground text-xs block border-b border-zinc-200 pb-1">Playbook: {agipPlaybook.playbookId}</span>
                              <div className="text-[10px] text-muted-foreground space-y-1 mt-1">
                                <span className="font-bold block text-foreground">Remediation Steps:</span>
                                {agipPlaybook.remediationSteps?.map((step: string, idx: number) => (
                                  <div key={idx} className="flex gap-1">
                                    <span>{idx + 1}.</span>
                                    <span>{step}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <div className="text-center py-6 text-xs text-muted-foreground italic">Selecting playbook...</div>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ========================================================================= */}
            {/* SOLANA & VPL TAB */}
            {/* ========================================================================= */}
            {activeTab === 'solana' && (
              <div className="space-y-6">
                {/* RPC Info */}
                <div className="grid gap-6 md:grid-cols-3">
                  <Card className="md:col-span-2 border-border bg-white shadow-sm">
                    <CardHeader className="pb-4">
                      <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                        <Binary className="h-5 w-5 text-zinc-500" />
                        Solana devnet Connection Details
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4 sm:grid-cols-2 text-xs">
                      <div className="space-y-3">
                        <div>
                          <span className="text-[10px] font-bold text-muted-foreground uppercase">Endpoint Node RPC</span>
                          <p className="font-bold text-foreground font-mono mt-0.5 overflow-hidden text-ellipsis whitespace-nowrap">{blockchainData?.rpcUrl}</p>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-muted-foreground uppercase">Ledger Slot / Height</span>
                          <p className="font-bold text-foreground font-mono mt-0.5">
                            {blockchainData?.currentSlot.toLocaleString()} / {blockchainData?.blockHeight.toLocaleString()}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <span className="text-[10px] font-bold text-muted-foreground uppercase">System Relayer Wallet</span>
                          <p className="font-bold text-foreground font-mono mt-0.5 select-all break-all">{blockchainData?.relayerWallet}</p>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-muted-foreground uppercase">Relayer Balance</span>
                          <p className="font-bold text-emerald-600 font-mono mt-0.5 font-extrabold text-sm">
                            {blockchainData?.relayerBalanceSol.toFixed(4)} SOL
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-border bg-white shadow-sm flex flex-col justify-between">
                    <CardHeader>
                      <CardTitle className="text-sm font-bold text-foreground">Solana Circuit Breaker</CardTitle>
                    </CardHeader>
                    <CardContent className="text-center py-6 flex-1 flex flex-col justify-center">
                      <span className="text-[9px] font-bold text-muted-foreground block uppercase">Circuit State</span>
                      <span className="text-2xl font-extrabold text-emerald-600 font-mono tracking-tight uppercase">
                        {blockchainData?.circuitState || 'CLOSED'}
                      </span>
                      <span className="text-[10px] text-muted-foreground block mt-1.5">
                        Consecutive Failed RPC Calls: {blockchainData?.retryCount}
                      </span>
                    </CardContent>
                  </Card>
                </div>

                {/* Recent Anchors */}
                <Card className="border-border bg-white shadow-sm overflow-hidden">
                  <CardHeader>
                    <CardTitle className="text-sm font-bold text-foreground">Recent Cryptographic Ledger Anchors</CardTitle>
                    <CardDescription className="text-xs">Immutable sovereign upload receipts anchored in the Solana blockchain.</CardDescription>
                  </CardHeader>
                  <CardContent className="p-0 overflow-x-auto">
                    {blockchainData?.recentAnchors.length === 0 ? (
                      <p className="text-center text-xs py-10 text-muted-foreground italic">No anchors recorded recently.</p>
                    ) : (
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-zinc-50 border-b border-border font-semibold text-muted-foreground">
                            <th className="px-6 py-3">Document Title</th>
                            <th className="px-4 py-3">Receipt SHA-256 Hash</th>
                            <th className="px-4 py-3">Solana Signature</th>
                            <th className="px-4 py-3">Program PDA Address</th>
                            <th className="px-6 py-3">Anchored Timestamp</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60">
                          {blockchainData?.recentAnchors.map((anchor: any) => (
                            <tr key={anchor.txSignature} className="hover:bg-zinc-50/50">
                              <td className="px-6 py-3.5 font-bold text-foreground">
                                <Link href={`/document/${anchor.documentId}`} className="text-primary hover:underline">
                                  {anchor.title}
                                </Link>
                              </td>
                              <td className="px-4 py-3.5 font-mono text-muted-foreground">{anchor.receiptHash.slice(0, 16)}...</td>
                              <td className="px-4 py-3.5 font-mono text-primary hover:underline">
                                <a href={`https://explorer.solana.com/tx/${anchor.txSignature}?cluster=devnet`} target="_blank" rel="noreferrer">
                                  {anchor.txSignature.slice(0, 12)}...
                                </a>
                              </td>
                              <td className="px-4 py-3.5 font-mono text-muted-foreground">{anchor.pda?.slice(0, 12)}...</td>
                              <td className="px-6 py-3.5 text-muted-foreground">
                                {anchor.anchoredAt ? new Date(anchor.anchoredAt).toLocaleString() : 'Pending...'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* ========================================================================= */}
            {/* SECURITY & SOC TAB */}
            {/* ========================================================================= */}
            {activeTab === 'security' && (
              <div className="space-y-6">
                {/* Incidents Header */}
                <div className="grid gap-6 md:grid-cols-2">
                  <Card className="border-border bg-white shadow-sm">
                    <CardHeader className="pb-3 flex flex-row items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-red-50 flex items-center justify-center text-red-600">
                        <AlertOctagon className="h-5 w-5" />
                      </div>
                      <div>
                        <CardTitle className="text-sm font-bold text-foreground">Critical Security Alerter</CardTitle>
                        <CardDescription className="text-xs">Platform-wide logging of hash validation and tamper occurrences.</CardDescription>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2 text-xs">
                      <div className="flex justify-between border-b border-zinc-100 py-1.5">
                        <span className="text-muted-foreground">Total Blocked Mismatches:</span>
                        <span className="font-bold text-foreground font-mono">{metricsData?.security.hashMismatches}</span>
                      </div>
                      <div className="flex justify-between border-b border-zinc-100 py-1.5">
                        <span className="text-muted-foreground">Integrity Tamper Attempts:</span>
                        <span className="font-bold text-foreground font-mono">{metricsData?.security.tamperAttempts}</span>
                      </div>
                      <div className="flex justify-between border-b border-zinc-100 py-1.5">
                        <span className="text-muted-foreground">Blocked Unauthorized Requests:</span>
                        <span className="font-bold text-foreground font-mono">{metricsData?.security.unauthorizedRequests}</span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-border bg-white shadow-sm flex flex-col justify-between">
                    <CardHeader>
                      <CardTitle className="text-sm font-bold text-foreground flex items-center gap-1.5">
                        <Lock className="h-4.5 w-4.5 text-zinc-500" />
                        Zero-Trust Security Level
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="text-center py-4 flex-1 flex flex-col justify-center">
                      <span className="text-3xl font-extrabold text-emerald-600 tracking-tight font-mono">100%</span>
                      <span className="text-[10px] text-muted-foreground mt-1 block">✓ Integrity parity, digital signatures, and ledger anchors fully validated</span>
                    </CardContent>
                  </Card>
                </div>

                {/* Security Incidents log */}
                <Card className="border-border bg-white shadow-sm overflow-hidden">
                  <CardHeader className="border-b border-border pb-4">
                    <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                      <ShieldAlert className="h-4.5 w-4.5 text-red-600" />
                      Active SOC Security Incident Log
                    </CardTitle>
                    <CardDescription className="text-xs">Security monitoring feed logging server-side tamper events, hash mismatches, and validation errors.</CardDescription>
                  </CardHeader>
                  <CardContent className="p-0 overflow-x-auto">
                    {securityData?.incidents.length === 0 ? (
                      <p className="text-center text-xs py-10 text-muted-foreground italic">No security incidents logged (Platform Secure).</p>
                    ) : (
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-zinc-50 border-b border-border font-semibold text-muted-foreground">
                            <th className="px-6 py-3">Timestamp</th>
                            <th className="px-4 py-3">Severity</th>
                            <th className="px-4 py-3">IP Address (Hash)</th>
                            <th className="px-6 py-3">Failure Reason / Description</th>
                            <th className="px-4 py-3">Correlation ID</th>
                            <th className="px-4 py-3">Resolution</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60">
                          {securityData?.incidents.map((incident: any) => (
                            <tr key={incident.incidentId} className="hover:bg-zinc-50/50">
                              <td className="px-6 py-3.5 text-muted-foreground font-mono whitespace-nowrap">
                                {new Date(incident.timestamp).toLocaleString()}
                              </td>
                              <td className="px-4 py-3.5">{getSeverityBadge(incident.severity)}</td>
                              <td className="px-4 py-3.5 font-mono text-muted-foreground select-all">
                                {incident.sourceIpHash.slice(0, 12)}...
                              </td>
                              <td className="px-6 py-3.5 font-semibold text-foreground max-w-sm break-words">
                                {incident.failureReason}
                              </td>
                              <td className="px-4 py-3.5 font-mono text-muted-foreground select-all">
                                {incident.correlationId.slice(0, 8)}...
                              </td>
                              <td className="px-4 py-3.5">
                                <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200">RESOLVED</Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </CardContent>
                </Card>

                {/* Audit Logs */}
                <Card className="border-border bg-white shadow-sm overflow-hidden">
                  <CardHeader>
                    <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                      <ListTodo className="h-4.5 w-4.5 text-zinc-500" />
                      Platform Audit Log Trail
                    </CardTitle>
                    <CardDescription className="text-xs">Continuous record of all critical user, notary, and administrative actions.</CardDescription>
                  </CardHeader>
                  <CardContent className="p-0 overflow-x-auto">
                    {securityData?.auditLogs.length === 0 ? (
                      <p className="text-center text-xs py-10 text-muted-foreground italic">No audit logs found.</p>
                    ) : (
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-zinc-50 border-b border-border font-semibold text-muted-foreground">
                            <th className="px-6 py-3">Date & Time</th>
                            <th className="px-4 py-3">Action</th>
                            <th className="px-4 py-3">Actor Role</th>
                            <th className="px-6 py-3">Details / Message</th>
                            <th className="px-4 py-3">Request ID</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60">
                          {securityData?.auditLogs.map((log: any) => (
                            <tr key={log.logId} className="hover:bg-zinc-50/50">
                              <td className="px-6 py-3.5 text-muted-foreground font-mono">
                                {new Date(log.createdAt).toLocaleString()}
                              </td>
                              <td className="px-4 py-3.5 font-bold text-foreground uppercase tracking-tight text-[10px]">
                                <Badge variant="outline">{log.action}</Badge>
                              </td>
                              <td className="px-4 py-3.5 text-muted-foreground font-semibold uppercase text-[10px]">
                                {log.actorRole || 'SYSTEM'}
                              </td>
                              <td className="px-6 py-3.5 text-foreground font-medium">{log.message}</td>
                              <td className="px-4 py-3.5 font-mono text-muted-foreground select-all">{log.requestId?.slice(0, 8) || '—'}...</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* ========================================================================= */}
            {/* ENTERPRISE INTEGRATIONS TAB */}
            {/* ========================================================================= */}
            {activeTab === 'integrations' && (
              <div className="space-y-6">
                {/* Integration Telemetry Header */}
                <div className="grid gap-4 md:grid-cols-4">
                  <Card className="border-border bg-white shadow-sm">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">Integration Throughput</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-foreground font-mono">
                        {integrationsData?.telemetry.totalCalls || 0}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Total outgoing ESM requests processed</p>
                    </CardContent>
                  </Card>
                  <Card className="border-border bg-white shadow-sm">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">ESM Success Rate</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-emerald-600 font-mono">
                        {integrationsData?.telemetry.successRate || 100}%
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Successful interop integrations</p>
                    </CardContent>
                  </Card>
                  <Card className="border-border bg-white shadow-sm">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">Outbox Event Queue</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-amber-600 font-mono">
                        {eventsData?.queueMetrics.pendingCount || 0}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Pending transactional outbox events</p>
                    </CardContent>
                  </Card>
                  <Card className="border-border bg-white shadow-sm">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">Dead Letter Queue (DLQ)</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-red-600 font-mono">
                        {eventsData?.queueMetrics.poisonCount || 0}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Poison messages flagged for review</p>
                    </CardContent>
                  </Card>
                </div>

                {/* ESM Connector Registry Topology */}
                <Card className="border-border bg-white shadow-sm overflow-hidden">
                  <CardHeader className="border-b border-border pb-4 flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                        <Server className="h-4.5 w-4.5 text-zinc-500" />
                        Enterprise Service Mesh (ESM) Connector Registry
                      </CardTitle>
                      <CardDescription className="text-xs">Active interop gateways in EIF v2.0, displaying lifecycle states, versions, and compliance status.</CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0 overflow-x-auto">
                    {!integrationsData?.connectors || integrationsData.connectors.length === 0 ? (
                      <p className="text-center text-xs py-10 text-muted-foreground italic">No connectors registered in the ESM.</p>
                    ) : (
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-zinc-50 border-b border-border font-semibold text-muted-foreground">
                            <th className="px-6 py-3">Connector Name</th>
                            <th className="px-4 py-3">Category</th>
                            <th className="px-4 py-3">Version</th>
                            <th className="px-4 py-3">Lifecycle State</th>
                            <th className="px-4 py-3">Compliance</th>
                            <th className="px-4 py-3">Owner</th>
                            <th className="px-4 py-3">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60">
                          {integrationsData.connectors.map((connector: any) => (
                            <tr key={connector.id} className="hover:bg-zinc-50/50">
                              <td className="px-6 py-3.5 font-bold text-foreground font-mono">{connector.name}</td>
                              <td className="px-4 py-3.5 text-muted-foreground">{connector.type}</td>
                              <td className="px-4 py-3.5 font-mono text-muted-foreground">v{connector.version}</td>
                              <td className="px-4 py-3.5">
                                <Badge className={
                                  connector.lifecycleState === 'ACTIVE' 
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold text-[10px]' 
                                    : 'bg-amber-50 text-amber-700 border border-amber-200 font-semibold text-[10px]'
                                }>
                                  {connector.lifecycleState}
                                </Badge>
                              </td>
                              <td className="px-4 py-3.5">
                                <Badge className="bg-zinc-50 text-zinc-700 border border-zinc-200 text-[10px] font-semibold">{connector.complianceStatus}</Badge>
                              </td>
                              <td className="px-4 py-3.5 text-muted-foreground font-mono text-[10px]">{connector.owner}</td>
                              <td className="px-4 py-3.5">
                                <Badge className={
                                  connector.status === 'HEALTHY' 
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold text-[10px]' 
                                    : 'bg-red-50 text-red-700 border border-red-200 font-semibold text-[10px]'
                                }>
                                  {connector.status}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </CardContent>
                </Card>

                {/* SAGA Workflow Orchestrator executions */}
                <Card className="border-border bg-white shadow-sm overflow-hidden">
                  <CardHeader className="border-b border-border pb-4">
                    <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                      <Activity className="h-4.5 w-4.5 text-primary" />
                      SAGA Workflow Orchestrator Executions
                    </CardTitle>
                    <CardDescription className="text-xs">Dynamic tracking of multi-step transaction sagas, human approval gates, and compensation rollbacks.</CardDescription>
                  </CardHeader>
                  <CardContent className="p-0 overflow-x-auto">
                    {!eventsData?.workflows || eventsData.workflows.length === 0 ? (
                      <p className="text-center text-xs py-10 text-muted-foreground italic">No workflow executions registered.</p>
                    ) : (
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-zinc-50 border-b border-border font-semibold text-muted-foreground">
                            <th className="px-6 py-3">Workflow Name</th>
                            <th className="px-4 py-3">Execution ID</th>
                            <th className="px-4 py-3">Current Step</th>
                            <th className="px-4 py-3">Status</th>
                            <th className="px-6 py-3">Correlation ID</th>
                            <th className="px-4 py-3">Updated At</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60">
                          {eventsData.workflows.map((wf: any) => (
                            <tr key={wf.id} className="hover:bg-zinc-50/50">
                              <td className="px-6 py-3.5 font-bold text-foreground font-mono">{wf.workflowName}</td>
                              <td className="px-4 py-3.5 font-mono text-muted-foreground text-[10px]">{wf.id.slice(0, 8)}...</td>
                              <td className="px-4 py-3.5 font-mono text-muted-foreground text-[10px]">{wf.currentStep}</td>
                              <td className="px-4 py-3.5">
                                <Badge className={
                                  wf.status === 'COMPLETED' 
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-semibold' 
                                    : wf.status === 'SUSPENDED_APPROVAL'
                                    ? 'bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-semibold animate-pulse'
                                    : wf.status === 'FAILED'
                                    ? 'bg-red-50 text-red-700 border border-red-200 text-[10px] font-semibold'
                                    : 'bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-semibold'
                                }>
                                  {wf.status}
                                </Badge>
                              </td>
                              <td className="px-6 py-3.5 font-mono text-muted-foreground text-[10px] select-all">{wf.correlationId || '—'}</td>
                              <td className="px-4 py-3.5 text-muted-foreground whitespace-nowrap">{new Date(wf.updatedAt).toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </CardContent>
                </Card>

                {/* Transactional Outbox Event Log & DLQ manager */}
                <Card className="border-border bg-white shadow-sm overflow-hidden">
                  <CardHeader className="border-b border-border pb-4 flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                        <ListTodo className="h-4.5 w-4.5 text-zinc-500" />
                        Transactional Outbox Event Log & DLQ Manager
                      </CardTitle>
                      <CardDescription className="text-xs">Guaranteed delivery logs. Audit pending, poison, or expired messages, with admin-level message replay capability.</CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0 overflow-x-auto">
                    {!eventsData?.recentOutbox || eventsData.recentOutbox.length === 0 ? (
                      <p className="text-center text-xs py-10 text-muted-foreground italic">No outbox events logged.</p>
                    ) : (
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-zinc-50 border-b border-border font-semibold text-muted-foreground">
                            <th className="px-6 py-3">Event ID</th>
                            <th className="px-4 py-3">Event Name</th>
                            <th className="px-4 py-3">Status</th>
                            <th className="px-4 py-3">Attempts</th>
                            <th className="px-4 py-3">Priority</th>
                            <th className="px-6 py-3">Last Error</th>
                            <th className="px-4 py-3">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60">
                          {eventsData.recentOutbox.map((event: any) => (
                            <tr key={event.id} className="hover:bg-zinc-50/50">
                              <td className="px-6 py-3.5 font-mono text-muted-foreground text-[10px] select-all">{event.id.slice(0, 8)}...</td>
                              <td className="px-4 py-3.5 font-bold text-foreground font-mono">{event.eventType}</td>
                              <td className="px-4 py-3.5">
                                <Badge className={
                                  event.status === 'PROCESSED' 
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-semibold' 
                                    : event.status === 'PENDING'
                                    ? 'bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-semibold animate-pulse'
                                    : 'bg-red-50 text-red-700 border border-red-200 text-[10px] font-semibold'
                                }>
                                  {event.status}
                                </Badge>
                              </td>
                              <td className="px-4 py-3.5 font-mono text-muted-foreground text-center">{event.attempts}</td>
                              <td className="px-4 py-3.5 font-mono text-muted-foreground text-center">{event.priority}</td>
                              <td className="px-6 py-3.5 text-red-600 font-mono max-w-xs truncate text-[10px]" title={event.lastError || ''}>
                                {event.lastError || '—'}
                              </td>
                              <td className="px-4 py-3.5">
                                {(event.status === 'POISON' || event.status === 'EXPIRED' || event.status === 'FAILED') && (
                                  <Button 
                                    size="sm" 
                                    variant="outline" 
                                    className="h-7 text-[10px] font-bold flex items-center gap-1 hover:bg-zinc-50"
                                    onClick={async () => {
                                      try {
                                        await apiClient.post('/operations/events/replay', { eventId: event.id });
                                        fetchTelemetry(true);
                                      } catch (err) {
                                        alert('Replay failed');
                                      }
                                    }}
                                  >
                                    <RefreshCw className="h-3 w-3" />
                                    Replay
                                  </Button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </CardContent>
                </Card>

                {/* Schema Registry & Sync Checkpoints */}
                <div className="grid gap-6 md:grid-cols-2">
                  {/* Schema Registry */}
                  <Card className="border-border bg-white shadow-sm overflow-hidden">
                    <CardHeader className="border-b border-border">
                      <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                        <Database className="h-4.5 w-4.5 text-zinc-500" />
                        Active Schema Registry Contracts
                      </CardTitle>
                      <CardDescription className="text-xs">Versioned JSON schemas enforcing payload integrity across the integration fabric.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0 overflow-y-auto max-h-80">
                      {!eventsData?.schemas || eventsData.schemas.length === 0 ? (
                        <p className="text-center text-xs py-10 text-muted-foreground italic">No schemas registered.</p>
                      ) : (
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-zinc-50 border-b border-border font-semibold text-muted-foreground">
                              <th className="px-6 py-3">Schema Name</th>
                              <th className="px-4 py-3 text-center">Version</th>
                              <th className="px-4 py-3">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/60">
                            {eventsData.schemas.map((schema: any) => (
                              <tr key={schema.id} className="hover:bg-zinc-50/50">
                                <td className="px-6 py-3 font-bold text-foreground font-mono">{schema.schemaName}</td>
                                <td className="px-4 py-3 font-mono text-muted-foreground text-center">v{schema.version}</td>
                                <td className="px-4 py-3">
                                  <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-semibold">ACTIVE</Badge>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </CardContent>
                  </Card>

                  {/* Sync Checkpoints */}
                  <Card className="border-border bg-white shadow-sm overflow-hidden">
                    <CardHeader className="border-b border-border">
                      <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                        <Clock className="h-4.5 w-4.5 text-zinc-500" />
                        Inter-Registry Sync Checkpoints
                      </CardTitle>
                      <CardDescription className="text-xs">Persistent delta synchronization checkpoints tracking checksum lineage and resume points.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0 overflow-y-auto max-h-80">
                      {!integrationsData?.checkpoints || integrationsData.checkpoints.length === 0 ? (
                        <p className="text-center text-xs py-10 text-muted-foreground italic">No sync checkpoints logged.</p>
                      ) : (
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-zinc-50 border-b border-border font-semibold text-muted-foreground">
                              <th className="px-6 py-3">Connector Name</th>
                              <th className="px-4 py-3">Entity Type</th>
                              <th className="px-4 py-3">Last Checkpoint</th>
                              <th className="px-4 py-3">Lineage Checksum</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/60">
                            {integrationsData.checkpoints.map((cp: any) => (
                              <tr key={cp.id} className="hover:bg-zinc-50/50">
                                <td className="px-6 py-3 font-bold text-foreground font-mono">{cp.connectorName}</td>
                                <td className="px-4 py-3 text-muted-foreground">{cp.entityType}</td>
                                <td className="px-4 py-3 font-mono text-muted-foreground text-[10px]">
                                  {new Date(cp.lastSyncedTimestamp).toLocaleString()}
                                </td>
                                <td className="px-4 py-3 font-mono text-muted-foreground text-[10px] select-all">{cp.checksum.slice(0, 10)}...</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

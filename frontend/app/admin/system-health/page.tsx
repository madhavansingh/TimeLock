'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/auth-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Server, Database, Cpu, Activity, RefreshCw, AlertTriangle, ShieldCheck, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';

interface HealthData {
  status: string;
  database: { status: string; latencyMs: number; error?: string };
  blockchain: { status: string; latencyMs: number; slot: number; error?: string };
  rpc: { status: string; url: string; error?: string };
  ipfs: { status: string; latencyMs: number; error?: string };
  pinata: { status: string; latencyMs: number; error?: string };
  certificateService: { status: string; error?: string };
  queueStatus: { status: string; lagMs: number };
  timestamp: string;
}

export default function SystemHealthPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const checkHealth = async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);
    setErrorMsg('');
    try {
      const res = await apiClient.get('/system/health');
      if (res.data) {
        setHealth(res.data);
      }
    } catch (err: any) {
      if (err.response?.data?.data) {
        setHealth(err.response.data.data);
      } else {
        setErrorMsg(err.message || 'Failed to check system health.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!user || user.role !== 'ADMIN') {
      router.push('/login');
      return;
    }
    checkHealth();
  }, [user, router]);

  const getStatusIndicator = (status: string) => {
    switch (status) {
      case 'ok':
      case 'healthy':
        return <Badge className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/25">ONLINE</Badge>;
      case 'fail':
      case 'degraded':
        return <Badge className="bg-red-500/10 text-red-600 border border-red-500/25">OFFLINE</Badge>;
      default:
        return <Badge variant="outline">{status?.toUpperCase() || 'UNKNOWN'}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center noise-overlay">
        <Activity className="h-8 w-8 text-foreground animate-spin" />
        <span className="ml-3 text-muted-foreground">Checking live system health probes...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground antialiased font-sans flex flex-col justify-between noise-overlay">
      <header className="border-b border-border bg-background/80 backdrop-blur-md px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm font-medium">Dashboard</span>
          </Link>
          <div className="flex items-center gap-6">
            <Link href="/admin/authorities" className="text-sm text-muted-foreground hover:text-foreground">
              Authority Registry
            </Link>
            <Button onClick={() => checkHealth(true)} disabled={refreshing} variant="outline" className="rounded-full py-1 h-8 text-xs">
              <RefreshCw className={`h-3 w-3 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-10 space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">System Health Operations</h1>
          <p className="text-muted-foreground text-sm">
            Live real-time connectivity status and RPC latency diagnostics.
          </p>
        </div>

        {errorMsg && (
          <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center gap-3 text-sm text-red-600">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {/* Database */}
          <Card className="border-border bg-card/60 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Database className="h-4 w-4 text-muted-foreground" />
                PostgreSQL Database
              </CardTitle>
              {health && getStatusIndicator(health.database.status)}
            </CardHeader>
            <CardContent className="space-y-2 py-4">
              <div className="text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">PROBE RESPONSE:</span>
                  <span className="font-mono text-foreground font-semibold">{health?.database.latencyMs}ms</span>
                </div>
                {health?.database.error && (
                  <div className="text-red-500 font-mono mt-2 break-all max-h-20 overflow-auto bg-background/50 p-2 rounded">
                    {health.database.error}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Blockchain Node */}
          <Card className="border-border bg-card/60 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Cpu className="h-4 w-4 text-muted-foreground" />
                Solana Devnet Node
              </CardTitle>
              {health && getStatusIndicator(health.blockchain.status)}
            </CardHeader>
            <CardContent className="space-y-2 py-4">
              <div className="text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">LATENCY:</span>
                  <span className="font-mono text-foreground font-semibold">{health?.blockchain.latencyMs}ms</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">LATEST SLOT:</span>
                  <span className="font-mono text-foreground font-semibold">{health?.blockchain.slot || 'N/A'}</span>
                </div>
                {health?.blockchain.error && (
                  <div className="text-red-500 font-mono mt-2 break-all max-h-20 overflow-auto bg-background/50 p-2 rounded">
                    {health.blockchain.error}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* RPC Provider */}
          <Card className="border-border bg-card/60 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Server className="h-4 w-4 text-muted-foreground" />
                Solana JSON-RPC
              </CardTitle>
              {health && getStatusIndicator(health.rpc.status)}
            </CardHeader>
            <CardContent className="space-y-2 py-4">
              <div className="text-xs space-y-1">
                <div className="space-y-1">
                  <span className="text-muted-foreground block">NODE URL:</span>
                  <span className="font-mono text-foreground font-semibold select-all break-all block bg-background/50 p-2 rounded">{health?.rpc.url}</span>
                </div>
                {health?.rpc.error && (
                  <div className="text-red-500 font-mono mt-2 break-all max-h-20 overflow-auto bg-background/50 p-2 rounded">
                    {health.rpc.error}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* IPFS Node */}
          <Card className="border-border bg-card/60 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Server className="h-4 w-4 text-muted-foreground" />
                Decentralized IPFS
              </CardTitle>
              {health && getStatusIndicator(health.ipfs.status)}
            </CardHeader>
            <CardContent className="space-y-2 py-4">
              <div className="text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">GATEWAY DELAY:</span>
                  <span className="font-mono text-foreground font-semibold">{health?.ipfs.latencyMs}ms</span>
                </div>
                {health?.ipfs.error && (
                  <div className="text-red-500 font-mono mt-2 break-all max-h-20 overflow-auto bg-background/50 p-2 rounded">
                    {health.ipfs.error}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Pinata IPFS Pinning Service */}
          <Card className="border-border bg-card/60 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                Pinata API Endpoint
              </CardTitle>
              {health && getStatusIndicator(health.pinata.status)}
            </CardHeader>
            <CardContent className="space-y-2 py-4">
              <div className="text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">RESPONSE TIME:</span>
                  <span className="font-mono text-foreground font-semibold">{health?.pinata.latencyMs}ms</span>
                </div>
                {health?.pinata.error && (
                  <div className="text-red-500 font-mono mt-2 break-all max-h-20 overflow-auto bg-background/50 p-2 rounded">
                    {health.pinata.error}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Certificate Authority Service */}
          <Card className="border-border bg-card/60 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                Certificate Validation CA
              </CardTitle>
              {health && getStatusIndicator(health.certificateService.status)}
            </CardHeader>
            <CardContent className="space-y-2 py-4">
              <div className="text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">HSM ENGINE:</span>
                  <span className="font-mono text-foreground font-semibold">Active & Operational</span>
                </div>
                {health?.certificateService.error && (
                  <div className="text-red-500 font-mono mt-2 break-all max-h-20 overflow-auto bg-background/50 p-2 rounded">
                    {health.certificateService.error}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Event Queue Lag */}
          <Card className="border-border bg-card/60 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Activity className="h-4 w-4 text-muted-foreground" />
                Task Event Queue Lag
              </CardTitle>
              {health && getStatusIndicator(health.queueStatus.lagMs <= 50 ? 'ok' : 'fail')}
            </CardHeader>
            <CardContent className="space-y-2 py-4">
              <div className="text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">EVENT LOOP DELAY:</span>
                  <span className="font-mono text-foreground font-semibold">{health?.queueStatus.lagMs}ms</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      <footer className="border-t border-border py-4 text-center text-xs text-muted-foreground bg-muted/10">
        TimeLock Operations Dashboard • Last Checked: {health && new Date(health.timestamp).toLocaleString()}
      </footer>
    </div>
  );
}

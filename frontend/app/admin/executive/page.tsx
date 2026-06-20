'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/auth-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  FileText, ShieldCheck, UserCheck, CheckCircle, AlertTriangle, Shield, 
  RefreshCw, LayoutDashboard, ArrowLeft, BarChart2, PieChart as PieIcon, Activity
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, 
  BarChart, Bar, PieChart, Pie, Cell, Legend
} from 'recharts';

interface StatsData {
  documentsRegistered: number;
  documentsVerified: number;
  activeNotaries: number;
  activeOwnershipRecords: number;
  fraudCasesPrevented: number;
  ownershipTransfersCompleted: number;
  aiAssessmentsGenerated: number;
  blockchainAnchorsConfirmed: number;
  nationalTrustRatings: number;
  avccRiskAlerts: number;
  ratingDistribution: Record<string, number>;
  fraudRiskDistribution: Record<string, number>;
  registrationTrend: Array<{ day: string; count: number }>;
}

const COLORS = ['#10b981', '#f59e0b', '#ef4444']; // emerald, amber, red

export default function ExecutiveDashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const fetchStats = async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);
    setErrorMsg('');
    try {
      const res = await apiClient.get('/admin/executive-stats');
      if (res.data) {
        setStats(res.data);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to fetch executive stats.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    setMounted(true);
    if (!user || user.role !== 'ADMIN') {
      router.push('/login');
      return;
    }
    fetchStats();
  }, [user, router]);

  if (!mounted) return null;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center noise-overlay">
        <Activity className="h-8 w-8 text-emerald-400 animate-spin" />
        <span className="ml-3 mt-2 text-xs text-slate-400 font-mono">Aggregating live PostgreSQL registry metrics...</span>
      </div>
    );
  }

  const fraudRiskData = stats ? [
    { name: 'Low Risk', value: stats.fraudRiskDistribution.LOW || 0 },
    { name: 'Medium Risk', value: stats.fraudRiskDistribution.MEDIUM || 0 },
    { name: 'High Risk', value: stats.fraudRiskDistribution.HIGH || 0 }
  ] : [];

  const ratingData = stats ? Object.keys(stats.ratingDistribution).map(key => ({
    name: key,
    count: stats.ratingDistribution[key] || 0
  })) : [];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans noise-overlay flex flex-col justify-between">
      <div>
        {/* Header */}
        <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur px-6 py-4 sticky top-0 z-10">
          <div className="mx-auto flex max-w-6xl items-center justify-between">
            <Link href="/dashboard" className="flex items-center gap-2 text-slate-400 hover:text-slate-200 transition-colors">
              <ArrowLeft className="h-4 w-4" />
              <span className="text-xs font-semibold font-mono uppercase tracking-wider">Dashboard</span>
            </Link>
            <div className="flex items-center gap-4">
              <Link href="/admin/system-health" className="text-xs text-slate-400 hover:text-slate-200">
                System Health Probes
              </Link>
              <Link href="/admin/audit" className="text-xs text-slate-400 hover:text-slate-200">
                Audit Console
              </Link>
              <Button onClick={() => fetchStats(true)} disabled={refreshing} variant="outline" className="rounded-full py-1 h-8 text-xs border-slate-800 hover:bg-slate-900">
                <RefreshCw className={`h-3 w-3 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
                Sync Aggregates
              </Button>
            </div>
          </div>
        </header>

        {/* Dashboard Content */}
        <main className="max-w-6xl mx-auto p-6 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold tracking-tight text-white">Executive Command Center</h2>
              <p className="text-xs text-slate-400">National Trust Network verification metrics and compliance auditing.</p>
            </div>
            {stats && stats.avccRiskAlerts > 0 && (
              <Badge className="bg-red-500/10 text-red-400 border border-red-500/25 flex items-center gap-1.5 py-1 px-3">
                <AlertTriangle className="h-3.5 w-3.5" />
                {stats.avccRiskAlerts} ACTIVE ANOMALY ALERTS REPORTED
              </Badge>
            )}
          </div>

          {errorMsg && (
            <Card className="bg-red-500/10 border-red-500/25 text-red-200">
              <CardContent className="p-4 flex items-center gap-3 text-xs">
                <AlertTriangle className="h-5 w-5 text-red-400 flex-shrink-0" />
                <span>{errorMsg}</span>
              </CardContent>
            </Card>
          )}

          {/* Aggregated stats row */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="bg-slate-900 border-slate-850">
                <CardContent className="p-4 space-y-1">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 font-mono block">Registered Deeds</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-xl font-bold text-white">{stats.documentsRegistered}</span>
                    <span className="text-[10px] text-slate-400">docs</span>
                  </div>
                  <div className="text-[10px] text-emerald-400 flex items-center gap-1">
                    <FileText className="h-3 w-3" /> PostgreSQL Source
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-slate-900 border-slate-850">
                <CardContent className="p-4 space-y-1">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 font-mono block">Fully Verified</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-xl font-bold text-white">{stats.documentsVerified}</span>
                    <span className="text-[10px] text-slate-400">deeds</span>
                  </div>
                  <div className="text-[10px] text-emerald-400 flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" /> VPL Cryptographic Seal
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-slate-900 border-slate-850">
                <CardContent className="p-4 space-y-1">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 font-mono block">Blockchain Anchors</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-xl font-bold text-white">{stats.blockchainAnchorsConfirmed}</span>
                    <span className="text-[10px] text-slate-400">txs</span>
                  </div>
                  <div className="text-[10px] text-emerald-400 flex items-center gap-1">
                    <ShieldCheck className="h-3 w-3" /> Solana Devnet Verified
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-slate-900 border-slate-850">
                <CardContent className="p-4 space-y-1">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 font-mono block">Fraud Prevented</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-xl font-bold text-white">{stats.fraudCasesPrevented}</span>
                    <span className="text-[10px] text-slate-400">incidents</span>
                  </div>
                  <div className="text-[10px] text-purple-400 flex items-center gap-1">
                    <Shield className="h-3 w-3" /> AI Verification Copilot
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Charts grid */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            {/* Registration Trend (AreaChart) */}
            <Card className="bg-slate-900 border-slate-850 md:col-span-8">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-bold font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <BarChart2 className="h-4 w-4 text-emerald-400" />
                  Deed Registration Pipeline (Last 7 Days)
                </CardTitle>
                <CardDescription className="text-[11px] text-slate-500">Daily deed submissions logged in registry.</CardDescription>
              </CardHeader>
              <CardContent className="pt-4 h-64">
                {stats && stats.registrationTrend.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={stats.registrationTrend} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorTrend" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="day" stroke="#475569" fontSize={10} fontStyle="italic" />
                      <YAxis stroke="#475569" fontSize={10} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: 6 }} 
                        labelStyle={{ fontSize: 10, fontStyle: 'italic', color: '#94a3b8' }}
                        itemStyle={{ fontSize: 11, color: '#f8fafc' }}
                      />
                      <Area type="monotone" dataKey="count" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorTrend)" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-slate-500 italic">
                    No registry deed data logged in the last 7 days.
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Fraud Risk distribution (PieChart) */}
            <Card className="bg-slate-900 border-slate-850 md:col-span-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-bold font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <PieIcon className="h-4 w-4 text-purple-400" />
                  AI Fraud Risk Classification
                </CardTitle>
                <CardDescription className="text-[11px] text-slate-500">Deed assessments categorised by risk.</CardDescription>
              </CardHeader>
              <CardContent className="pt-4 h-64 flex flex-col justify-between items-center">
                {stats && stats.aiAssessmentsGenerated > 0 ? (
                  <>
                    <div className="w-full h-44">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={fraudRiskData}
                            cx="50%"
                            cy="50%"
                            innerRadius={45}
                            outerRadius={65}
                            paddingAngle={4}
                            dataKey="value"
                          >
                            {fraudRiskData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: 6 }}
                            itemStyle={{ fontSize: 11, color: '#f8fafc' }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex gap-4 text-[10px] font-mono text-slate-400">
                      <span className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 block" /> Low
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full bg-amber-500 block" /> Medium
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full bg-red-500 block" /> High
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-slate-500 italic">
                    No risk assessments generated yet.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* National Trust Rating distribution */}
          <div className="grid grid-cols-1 gap-6">
            <Card className="bg-slate-900 border-slate-850">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-bold font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-emerald-400" />
                  National Trust Graph Rating Distribution
                </CardTitle>
                <CardDescription className="text-[11px] text-slate-500">Property and Citizen trust index levels currently compiled.</CardDescription>
              </CardHeader>
              <CardContent className="pt-4 h-56">
                {stats && stats.nationalTrustRatings > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={ratingData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                      <XAxis dataKey="name" stroke="#475569" fontSize={10} fontStyle="italic" />
                      <YAxis stroke="#475569" fontSize={10} allowDecimals={false} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: 6 }} 
                        itemStyle={{ fontSize: 11, color: '#f8fafc' }}
                      />
                      <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-slate-500 italic">
                    No active property ratings logged in database. Run VCC Graph Compile.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 px-6 py-4 mt-12 text-slate-500 text-xs font-mono">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <span>Legal TimeLock Network (LTN) — Governance Board Console</span>
          <span>© 2026 Sovereign Trust Authority</span>
        </div>
      </footer>
    </div>
  );
}

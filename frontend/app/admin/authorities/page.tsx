'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/auth-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, UserPlus, Trash2, ShieldCheck, Activity, HelpCircle, RefreshCw, Cpu } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';

interface Authority {
  authorityKey: string;
  role: string;
  status: string;
  registeredAt: number;
  revokedAt?: number;
  details: string;
}

export default function AuthorityRegistryPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [authorities, setAuthorities] = useState<Authority[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Form states
  const [authorityKey, setAuthorityKey] = useState('');
  const [role, setRole] = useState<'NOTARY' | 'GOVERNMENT' | 'BANK' | 'AUDITOR' | 'OWNER' | 'BUYER'>('NOTARY');
  const [details, setDetails] = useState('');

  const fetchAuthorities = async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await apiClient.get('/authorities');
      if (res.data) {
        setAuthorities(res.data);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to fetch accredited authorities.');
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
    fetchAuthorities();
  }, [user, router]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authorityKey || !details) {
      alert('Please fill out all fields.');
      return;
    }
    setSubmitting(true);
    try {
      await apiClient.post('/authorities', {
        authorityKey,
        role,
        details
      });
      setAuthorityKey('');
      setDetails('');
      fetchAuthorities();
    } catch (err: any) {
      alert(err.message || 'Failed to register authority.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevoke = async (key: string) => {
    if (!confirm('Are you sure you want to revoke accreditation for this authority?')) return;
    try {
      await apiClient.delete(`/authorities/${key}`);
      fetchAuthorities();
    } catch (err: any) {
      alert(err.message || 'Failed to revoke authority.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center noise-overlay">
        <Activity className="h-8 w-8 text-foreground animate-spin" />
        <span className="ml-3 text-muted-foreground">Loading accredited registries...</span>
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
            <Link href="/admin/system-health" className="text-sm text-muted-foreground hover:text-foreground">
              System Health
            </Link>
            <Button onClick={() => fetchAuthorities(true)} disabled={refreshing} variant="outline" className="rounded-full py-1 h-8 text-xs">
              <RefreshCw className={`h-3 w-3 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-10 grid gap-8 lg:grid-cols-3">
        {/* Left Col: Register New Authority (1 column) */}
        <div className="lg:col-span-1">
          <Card className="border-border bg-card/60 backdrop-blur-sm sticky top-24">
            <CardHeader>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-foreground" />
                Register Authority
              </CardTitle>
              <CardDescription className="text-muted-foreground text-xs">
                Accredit a new notary or stakeholder public key on the Solana program registry
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="space-y-1">
                  <label className="block text-xs font-mono text-muted-foreground">SOLANA PUBLIC KEY:</label>
                  <input
                    type="text"
                    value={authorityKey}
                    onChange={(e) => setAuthorityKey(e.target.value)}
                    placeholder="Enter Base58 public key..."
                    className="w-full text-xs font-mono bg-background border border-border rounded px-3 py-2 text-foreground focus:outline-none"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-mono text-muted-foreground">AUTHORITY ROLE:</label>
                  <select
                    value={role}
                    onChange={(e: any) => setRole(e.target.value)}
                    className="w-full text-xs bg-background border border-border rounded px-3 py-2 text-foreground focus:outline-none"
                  >
                    <option value="NOTARY">Notary Authority</option>
                    <option value="GOVERNMENT">Government Agency</option>
                    <option value="BANK">Lending Institution (Bank)</option>
                    <option value="AUDITOR">Compliance Auditor</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-mono text-muted-foreground">ORGANIZATION / DEED DETAILS:</label>
                  <textarea
                    value={details}
                    onChange={(e) => setDetails(e.target.value)}
                    placeholder="e.g. Bangalore Registry Office, Notary Rao..."
                    className="w-full text-xs bg-background border border-border rounded px-3 py-2 text-foreground focus:outline-none h-20 resize-none"
                    required
                  />
                </div>

                <Button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground text-xs rounded-full py-2.5 mt-2"
                >
                  {submitting ? 'Registering...' : 'Accredit Authority'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Right Col: List Accredited Authorities (2 columns) */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-border bg-card/60 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-xl font-bold flex items-center gap-2">
                <ShieldCheck className="h-5.5 w-5.5 text-foreground" />
                Accredited Authorities Registry
              </CardTitle>
              <CardDescription className="text-muted-foreground text-xs">
                Active notary and official registrar keys authorized to endorse documents
              </CardDescription>
            </CardHeader>
            <CardContent>
              {authorities.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground space-y-2">
                  <HelpCircle className="h-10 w-10 mx-auto text-muted-foreground/30" />
                  <p className="text-sm">No authorities registered in this sandbox instance.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border hover:bg-transparent">
                        <TableHead className="text-xs font-semibold text-muted-foreground font-mono">ROLE / KEY</TableHead>
                        <TableHead className="text-xs font-semibold text-muted-foreground font-mono">DETAILS</TableHead>
                        <TableHead className="text-xs font-semibold text-muted-foreground font-mono text-center">STATUS</TableHead>
                        <TableHead className="text-xs font-semibold text-muted-foreground font-mono text-right">ACTION</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {authorities.map((auth) => (
                        <TableRow key={auth.authorityKey} className="border-border hover:bg-muted/10">
                          <TableCell className="align-top py-4">
                            <div className="space-y-1">
                              <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] font-mono font-semibold">
                                {auth.role}
                              </Badge>
                              <span className="block font-mono text-[10px] text-muted-foreground select-all truncate max-w-[150px]">
                                {auth.authorityKey}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="align-top py-4 text-xs">
                            <div className="space-y-1">
                              <span className="text-foreground font-medium">{auth.details}</span>
                              <span className="block text-[10px] text-muted-foreground">
                                Registered: {new Date(auth.registeredAt * 1000).toLocaleDateString()}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="align-top py-4 text-center">
                            <Badge className={
                              auth.status === 'ACTIVE'
                                ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/25'
                                : 'bg-red-500/10 text-red-600 border border-red-500/25'
                            }>
                              {auth.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="align-top py-4 text-right">
                            {auth.status === 'ACTIVE' ? (
                              <Button
                                onClick={() => handleRevoke(auth.authorityKey)}
                                variant="ghost"
                                className="text-red-500 hover:text-red-600 hover:bg-red-500/10 p-2 h-8 rounded-full"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            ) : (
                              <span className="text-[10px] text-muted-foreground italic">
                                Revoked {auth.revokedAt && new Date(auth.revokedAt * 1000).toLocaleDateString()}
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      <footer className="border-t border-border py-4 text-center text-xs text-muted-foreground bg-muted/10">
        Legal TimeLock Network Authority Registrar Console
      </footer>
    </div>
  );
}

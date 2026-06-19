'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/auth-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Lock, Search, RefreshCw, Eye, Download, LogOut, FileText, AlertTriangle, ShieldCheck, HelpCircle } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';

interface SearchResult {
  documentId: string;
  title: string;
  type: string;
  contentHash: string;
  status: string;
  createdAt: string;
  ownerUserId: string;
}

export default function AuditorSearch() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [dateFilter, setDateFilter] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const executeSearch = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      let queryParams = '';
      const params: string[] = [];
      if (statusFilter && statusFilter !== 'ALL') {
        params.push(`status=${statusFilter}`);
      }
      if (dateFilter) {
        params.push(`startDate=${dateFilter}`);
      }
      if (params.length > 0) {
        queryParams = `?${params.join('&')}`;
      }

      const res = await apiClient.get(`/documents/search${queryParams}`);
      setResults(res.data?.items || []);
    } catch (err: any) {
      console.warn('Backend search API failed or scoped out, using fallback cache:', err.message);
      const stored = localStorage.getItem('registered_documents');
      if (stored) {
        let list = JSON.parse(stored) as SearchResult[];
        if (statusFilter && statusFilter !== 'ALL') {
          list = list.filter(d => d.status === statusFilter);
        }
        if (dateFilter) {
          list = list.filter(d => d.createdAt.startsWith(dateFilter));
        }
        setResults(list);
      } else {
        setResults([]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    const isAuditor = ['BANK_OFFICER', 'COURT_CLERK', 'ADMIN'].includes(user.role);
    if (!isAuditor) {
      if (user.role === 'CITIZEN') {
        router.push('/dashboard');
      } else {
        router.push('/notary');
      }
      return;
    }
    executeSearch();
  }, [user, router, statusFilter, dateFilter]);

  const downloadCertificate = async (docId: string, title: string) => {
    try {
      const res = await apiClient.get(`/documents/${docId}/certificate`);
      if (res.data?.pdfBase64) {
        const linkSource = `data:application/pdf;base64,${res.data.pdfBase64}`;
        const downloadLink = document.createElement("a");
        const fileName = `${title.replace(/\s+/g, '_')}_verification_certificate.pdf`;

        downloadLink.href = linkSource;
        downloadLink.download = fileName;
        downloadLink.click();
      }
    } catch (err) {
      alert('Failed to generate certificate.');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <Badge className="bg-yellow-500/10 text-yellow-600 border border-yellow-500/25">Pending</Badge>;
      case 'ONCHAIN_CONFIRMED':
        return <Badge className="bg-foreground/5 text-foreground border border-foreground/20">Anchored</Badge>;
      case 'NOTARY_SIGNED':
        return <Badge className="bg-foreground/5 text-foreground border border-foreground/20 font-semibold">Notary Signed</Badge>;
      case 'FULLY_EXECUTED':
        return <Badge className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/25 font-bold">Fully Executed</Badge>;
      case 'DISPUTED':
        return <Badge className="bg-red-500/10 text-red-600 border border-red-500/25">Disputed</Badge>;
      case 'REVOKED':
        return <Badge className="bg-slate-500/10 text-slate-400 border border-slate-550">Revoked</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground antialiased font-sans flex flex-col justify-between noise-overlay">
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
              <p className="text-xs text-muted-foreground font-mono">Institutional Audit</p>
              <p className="text-sm font-medium text-foreground">
                {user?.role === 'BANK_OFFICER' ? 'Anjali Bank Officer' : 'Court Auditor'}
              </p>
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

      {/* Main content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-10 space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Compliance Registry Search</h1>
          <p className="text-muted-foreground text-sm mt-1">Audit on-chain document fingerprints, verify timestamp timelines, and validate digital notary signatures.</p>
        </div>

        {/* Filters */}
        <Card className="border-border bg-card/60 backdrop-blur-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-sm font-semibold text-foreground">Search Filters</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3 items-end">
            {/* Status */}
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs">Registry Status</Label>
              <Select defaultValue={statusFilter} onValueChange={(val) => setStatusFilter(val)}>
                <SelectTrigger className="border-border bg-background text-foreground text-xs">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent className="border-border bg-background text-foreground text-xs">
                  <SelectItem value="ALL">All Statuses</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="ONCHAIN_CONFIRMED">Onchain Confirmed</SelectItem>
                  <SelectItem value="NOTARY_SIGNED">Notary Signed</SelectItem>
                  <SelectItem value="FULLY_EXECUTED">Fully Executed</SelectItem>
                  <SelectItem value="DISPUTED">Disputed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Date */}
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs">Registry Date</Label>
              <Input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="border-border bg-background text-foreground text-xs py-1 h-9"
              />
            </div>

            <Button
              onClick={executeSearch}
              disabled={loading}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-xs h-9 flex items-center justify-center rounded-full shadow-sm"
            >
              <Search className="h-3.5 w-3.5 mr-1.5" />
              Search Registry
            </Button>
          </CardContent>
        </Card>

        {/* Results */}
        <Card className="border-border bg-card/60 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-6">
            <div>
              <CardTitle className="text-lg font-bold text-foreground">Registry Matches</CardTitle>
              <CardDescription className="text-muted-foreground text-xs">
                Found {results.length} document matching records.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {results.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <FileText className="h-12 w-12 text-muted-foreground/30 mb-3" />
                <p className="text-muted-foreground text-sm font-medium">No matching records found</p>
                <p className="text-muted-foreground/60 text-xs mt-1">Try modifying your query constraints.</p>
              </div>
            ) : (
              <Table>
                <TableHeader className="border-b border-border bg-muted/20">
                  <TableRow className="border-b border-border hover:bg-transparent">
                    <TableHead className="text-muted-foreground">Document ID</TableHead>
                    <TableHead className="text-muted-foreground">Title</TableHead>
                    <TableHead className="text-muted-foreground">Type</TableHead>
                    <TableHead className="text-muted-foreground">Status</TableHead>
                    <TableHead className="text-muted-foreground">Registered Date</TableHead>
                    <TableHead className="text-right text-muted-foreground">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((doc) => (
                    <TableRow key={doc.documentId} className="border-b border-border/60 hover:bg-accent/40">
                      <TableCell className="font-mono text-muted-foreground text-xs max-w-[120px] truncate">
                        {doc.documentId}
                      </TableCell>
                      <TableCell className="font-medium text-foreground max-w-[180px] truncate">{doc.title}</TableCell>
                      <TableCell className="text-foreground/80 text-sm">{doc.type}</TableCell>
                      <TableCell>{getStatusBadge(doc.status)}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {new Date(doc.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right flex items-center justify-end gap-2 h-[52px]">
                        <Link href={`/document/${doc.documentId}`}>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-border bg-transparent text-muted-foreground hover:bg-accent rounded-full"
                          >
                            <Eye className="h-3.5 w-3.5 mr-1" />
                            Audit
                          </Button>
                        </Link>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => downloadCertificate(doc.documentId, doc.title)}
                          className="border-border bg-transparent text-muted-foreground hover:bg-accent rounded-full"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>

      <footer className="py-4 border-t border-border text-center text-xs text-muted-foreground bg-muted/20">
        &copy; 2026 Time Lock. All rights reserved.
      </footer>
    </div>
  );
}

'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/auth-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { 
  History, Search, Filter, RefreshCw, ArrowLeft, ChevronLeft, ChevronRight, 
  Terminal, ShieldCheck, User, Database, Globe, Calendar, AlertTriangle
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';

interface AuditLog {
  id: string;
  action: string;
  message: string;
  actorId?: string;
  actorRole?: string;
  entityType?: string;
  entityId?: string;
  requestId: string;
  metadata?: any;
  createdAt: string;
}

interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const ACTION_FILTERS = [
  { label: 'All Actions', value: '' },
  { label: 'Document Registration', value: 'DOCUMENT_REGISTRATION' },
  { label: 'Notary Assignment', value: 'NOTARY_ASSIGNMENT' },
  { label: 'Notary Review', value: 'NOTARY_REVIEW' },
  { label: 'Signature Registered', value: 'SIGNATURE' },
  { label: 'Ownership Transfer', value: 'OWNERSHIP_TRANSFER' },
  { label: 'VCC Graph Compile', value: 'TRUST_GRAPH_UPDATE' },
  { label: 'AI Review Generated', value: 'AI_ANALYSIS' },
  { label: 'System Configuration', value: 'SYSTEM_CONFIG' }
];

export default function AuditLogsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [action, setAction] = useState('');
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  const fetchLogs = async (currentPage = page) => {
    setLoading(true);
    setErrorMsg('');
    try {
      const query = `?page=${currentPage}&limit=12&search=${encodeURIComponent(search)}&action=${action}`;
      const res = await apiClient.get(`/admin/audit-logs${query}`);
      if (res.data) {
        setLogs(res.data.logs || []);
        setPagination(res.data.pagination || null);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to fetch system audit logs.');
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user || user.role !== 'ADMIN') {
      router.push('/login');
      return;
    }
    fetchLogs(page);
  }, [user, router, page, action]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchLogs(1);
  };

  const getActorBadgeStyle = (role?: string) => {
    switch (role?.toUpperCase()) {
      case 'ADMIN':
        return 'bg-red-500/10 text-red-400 border-red-500/20';
      case 'NOTARY':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'CITIZEN':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      default:
        return 'bg-slate-800 text-slate-400 border-slate-700';
    }
  };

  const getActionBadgeStyle = (act: string) => {
    if (act.includes('REGISTRATION') || act.includes('TRANSFER')) {
      return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25';
    }
    if (act.includes('AI_')) {
      return 'bg-purple-500/10 text-purple-400 border border-purple-500/25';
    }
    if (act.includes('SIGNATURE') || act.includes('NOTARY_')) {
      return 'bg-blue-500/10 text-blue-400 border border-blue-500/25';
    }
    return 'bg-slate-900 text-slate-300 border border-slate-800';
  };

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
              <Link href="/admin/executive" className="text-xs text-slate-400 hover:text-slate-200">
                Executive Command Center
              </Link>
              <Link href="/admin/system-health" className="text-xs text-slate-400 hover:text-slate-200">
                System Health
              </Link>
              <Button onClick={() => fetchLogs(page)} disabled={loading} variant="outline" className="rounded-full py-1 h-8 text-xs border-slate-800 hover:bg-slate-900">
                <RefreshCw className={`h-3 w-3 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
                Sync Logs
              </Button>
            </div>
          </div>
        </header>

        {/* Dashboard Content */}
        <main className="max-w-6xl mx-auto p-6 space-y-6">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-white">Cryptographic Audit Console</h2>
            <p className="text-xs text-slate-400">Database logging of all active contract transitions, blockchain anchors, and notary signature operations.</p>
          </div>

          {errorMsg && (
            <Card className="bg-red-500/10 border-red-500/25 text-red-200">
              <CardContent className="p-4 flex items-center gap-3 text-xs">
                <AlertTriangle className="h-5 w-5 text-red-400 flex-shrink-0" />
                <span>{errorMsg}</span>
              </CardContent>
            </Card>
          )}

          {/* Search & filters bar */}
          <div className="flex flex-col md:flex-row gap-3">
            <form onSubmit={handleSearchSubmit} className="flex-1 flex gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Search logs by message, actor, entity ID, or request ID..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full h-9 pl-9 pr-3 py-1 bg-slate-900 border border-slate-800 rounded-md text-xs text-slate-200 focus:outline-none focus:border-slate-700"
                />
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
              </div>
              <Button type="submit" size="sm" className="bg-slate-800 hover:bg-slate-750 text-slate-100 border border-slate-700 h-9 text-xs">
                Search
              </Button>
            </form>

            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-slate-500" />
              <select
                value={action}
                onChange={(e) => {
                  setAction(e.target.value);
                  setPage(1);
                }}
                className="h-9 px-3 py-1 bg-slate-900 border border-slate-800 rounded-md text-xs text-slate-200 focus:outline-none focus:border-slate-700"
              >
                {ACTION_FILTERS.map(f => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Logs Table */}
          <Card className="bg-slate-900 border-slate-850">
            <CardContent className="p-0">
              {loading ? (
                <div className="p-12 flex flex-col justify-center items-center text-xs text-slate-500 font-mono">
                  <RefreshCw className="h-6 w-6 animate-spin mb-2 text-emerald-400" />
                  Querying paginated audit records...
                </div>
              ) : logs.length === 0 ? (
                <div className="p-12 text-center text-xs text-slate-500 italic">
                  No matching log records found in PostgreSQL.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-slate-950/50">
                      <TableRow className="border-slate-850">
                        <TableHead className="text-[10px] uppercase font-bold font-mono tracking-wider text-slate-400 w-[140px]">Timestamp</TableHead>
                        <TableHead className="text-[10px] uppercase font-bold font-mono tracking-wider text-slate-400 w-[160px]">Action Type</TableHead>
                        <TableHead className="text-[10px] uppercase font-bold font-mono tracking-wider text-slate-400">Activity Log Message</TableHead>
                        <TableHead className="text-[10px] uppercase font-bold font-mono tracking-wider text-slate-400 w-[110px]">Actor / Role</TableHead>
                        <TableHead className="text-[10px] uppercase font-bold font-mono tracking-wider text-slate-400 w-[130px]">Correlation Request ID</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logs.map((log) => (
                        <TableRow key={log.id} className="border-slate-850 hover:bg-slate-850/10 font-mono text-[11px] text-slate-300">
                          <TableCell className="text-slate-500 font-sans text-xs">
                            {new Date(log.createdAt).toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`px-1.5 py-0 text-[10px] uppercase ${getActionBadgeStyle(log.action)}`}>
                              {log.action}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-md break-words font-sans text-xs text-slate-200">
                            {log.message}
                            {log.entityId && (
                              <span className="ml-1 text-[10px] font-mono text-slate-500" title="Entity ID">
                                ({log.entityType || 'ENTITY'}: {log.entityId.slice(0, 12)}...)
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            {log.actorId ? (
                              <div className="flex flex-col gap-0.5">
                                <span className="text-[10px] text-slate-400" title={log.actorId}>
                                  {log.actorId.slice(0, 8)}...
                                </span>
                                {log.actorRole && (
                                  <Badge variant="outline" className={`w-fit px-1 py-0 text-[8px] tracking-wide font-mono ${getActorBadgeStyle(log.actorRole)}`}>
                                    {log.actorRole}
                                  </Badge>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-600 italic">SYSTEM</span>
                            )}
                          </TableCell>
                          <TableCell className="text-slate-500 text-[10px]" title={log.requestId}>
                            {log.requestId.slice(0, 16)}...
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>

            {/* Pagination footer */}
            {pagination && pagination.totalPages > 1 && (
              <CardFooter className="bg-slate-950/30 border-t border-slate-850 px-6 py-4 flex items-center justify-between">
                <span className="text-xs text-slate-400 font-mono">
                  Showing {(page - 1) * pagination.limit + 1} - {Math.min(page * pagination.limit, pagination.total)} of {pagination.total} entries
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={page === 1}
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    className="h-8 border-slate-800 text-xs hover:bg-slate-900"
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" /> Prev
                  </Button>
                  <span className="text-xs font-mono font-bold text-white px-2">
                    Page {page} of {pagination.totalPages}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={page === pagination.totalPages}
                    onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                    className="h-8 border-slate-800 text-xs hover:bg-slate-900"
                  >
                    Next <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </CardFooter>
            )}
          </Card>
        </main>
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 px-6 py-4 mt-12 text-slate-500 text-xs font-mono">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <span>Legal TimeLock Network (LTN) — Cryptographic Registry Audit Log</span>
          <span className="flex items-center gap-1">
            <Database className="h-3.5 w-3.5" />
            Direct DB Log Mode
          </span>
        </div>
      </footer>
    </div>
  );
}

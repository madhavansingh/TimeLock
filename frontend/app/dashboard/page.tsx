'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/auth-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { FileUp, Search, Eye, Download, LogOut, Lock, ShieldCheck, AlertTriangle, CheckCircle, FileText, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { calculateSHA256 } from '@/lib/crypto';
import { apiClient } from '@/lib/api';

interface LocalDocument {
  documentId: string;
  title: string;
  type: string;
  contentHash: string;
  status: string;
  createdAt: string;
}

export default function CitizenDashboard() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [documents, setDocuments] = useState<LocalDocument[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [verifyingFile, setVerifyingFile] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    if (user.role !== 'CITIZEN') {
      if (user.role === 'NOTARY') {
        router.push('/notary');
      } else {
        router.push('/search');
      }
      return;
    }

    const stored = localStorage.getItem('registered_documents');
    if (stored) {
      try {
        setDocuments(JSON.parse(stored));
      } catch {
        setDocuments([]);
      }
    }
  }, [user, router]);

  const totalDocs = documents.length;
  const onchainDocs = documents.filter(d => ['ONCHAIN_CONFIRMED', 'NOTARY_SIGNED', 'FULLY_EXECUTED'].includes(d.status)).length;
  const pendingDocs = documents.filter(d => d.status === 'PENDING').length;
  const disputedDocs = documents.filter(d => d.status === 'DISPUTED').length;

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await processVerifyFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      await processVerifyFile(e.target.files[0]);
    }
  };

  const processVerifyFile = async (file: File) => {
    setVerifyingFile(true);
    try {
      const hash = await calculateSHA256(file);
      sessionStorage.setItem('verify_file_hash', hash);
      sessionStorage.setItem('verify_file_name', file.name);
      router.push(`/verify?hash=${hash}&name=${encodeURIComponent(file.name)}`);
    } catch (err) {
      console.error('Failed to hash file', err);
    } finally {
      setVerifyingFile(false);
    }
  };

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
        return <Badge className="bg-muted text-muted-foreground border border-border">Revoked</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const filteredDocs = documents.filter(doc => 
    doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.documentId.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background text-foreground antialiased font-sans noise-overlay">
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
              <p className="text-xs text-muted-foreground">Logged in as Citizen</p>
              <p className="text-sm font-medium text-foreground">Priya Executant</p>
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

      <main className="mx-auto max-w-7xl px-6 py-10 space-y-8">
        {/* Welcome Section */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Dashboard</h1>
            <p className="text-muted-foreground text-sm mt-1">Manage and verify your anchored legal assets on Solana</p>
          </div>
          <Link href="/register">
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-full">
              <FileUp className="mr-2 h-4 w-4" />
              Register Document
            </Button>
          </Link>
        </div>

        {/* Metrics Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border-border bg-card/60 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Registry</CardTitle>
              <FileText className="h-4 w-4 text-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{totalDocs}</div>
              <p className="text-xs text-muted-foreground mt-1">Active files uploaded</p>
            </CardContent>
          </Card>

          <Card className="border-border bg-card/60 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Anchored Proofs</CardTitle>
              <ShieldCheck className="h-4 w-4 text-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{onchainDocs}</div>
              <p className="text-xs text-muted-foreground mt-1">Confirmed on Solana Devnet</p>
            </CardContent>
          </Card>

          <Card className="border-border bg-card/60 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pending Signatures</CardTitle>
              <CheckCircle className="h-4 w-4 text-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{pendingDocs}</div>
              <p className="text-xs text-muted-foreground mt-1">Awaiting notary verification</p>
            </CardContent>
          </Card>

          <Card className="border-border bg-card/60 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Dispute Alerts</CardTitle>
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{disputedDocs}</div>
              <p className="text-xs text-muted-foreground mt-1">Integrity warning matches</p>
            </CardContent>
          </Card>
        </div>

        {/* Dashboard Actions split */}
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Recent Documents Table (2 columns wide) */}
          <div className="lg:col-span-2 space-y-4">
            <Card className="border-border bg-card/60 backdrop-blur-sm h-full">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-bold text-foreground">Recent Documents</CardTitle>
                  <CardDescription className="text-muted-foreground text-xs">Registry records of your active uploads</CardDescription>
                </div>
                <div className="relative w-48 sm:w-64">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground/50" />
                  <input
                    type="text"
                    placeholder="Search registry..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full rounded-md border border-border bg-background py-1.5 pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {filteredDocs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <FileText className="h-10 w-10 text-muted-foreground/30 mb-3" />
                    <p className="text-muted-foreground text-sm font-medium">No documents registered yet.</p>
                    <p className="text-muted-foreground/60 text-xs mt-1">Anchor your first legal deed to get started.</p>
                    <Link href="/register" className="mt-4">
                      <Button size="sm" variant="outline" className="border-border hover:bg-accent text-foreground rounded-full">
                        Upload Document
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <Table>
                    <TableHeader className="border-b border-border bg-muted/20">
                      <TableRow className="border-b border-border hover:bg-transparent">
                        <TableHead className="text-muted-foreground">Document Title</TableHead>
                        <TableHead className="text-muted-foreground">Type</TableHead>
                        <TableHead className="text-muted-foreground">Status</TableHead>
                        <TableHead className="text-muted-foreground">Anchored Date</TableHead>
                        <TableHead className="text-right text-muted-foreground">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredDocs.map((doc) => (
                        <TableRow key={doc.documentId} className="border-b border-border/60 hover:bg-accent/40">
                          <TableCell className="font-medium text-foreground max-w-[160px] truncate">
                            {doc.title}
                          </TableCell>
                          <TableCell className="text-foreground/80 text-sm">{doc.type}</TableCell>
                          <TableCell>{getStatusBadge(doc.status)}</TableCell>
                          <TableCell className="text-muted-foreground text-xs">
                            {new Date(doc.createdAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-right flex items-center justify-end gap-2 h-[52px]">
                            <Link href={`/document/${doc.documentId}`}>
                              <Button
                                size="icon"
                                variant="outline"
                                className="h-8 w-8 border-border bg-transparent text-muted-foreground hover:bg-accent hover:text-foreground"
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                            </Link>
                            <Button
                              size="icon"
                              variant="outline"
                              onClick={() => downloadCertificate(doc.documentId, doc.title)}
                              className="h-8 w-8 border-border bg-transparent text-muted-foreground hover:bg-accent hover:text-foreground"
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
          </div>

          {/* Quick Verify Drag Zone (1 column wide) */}
          <div className="space-y-4">
            <Card className="border-border bg-card/60 backdrop-blur-sm flex flex-col justify-between h-full">
              <CardHeader>
                <CardTitle className="text-lg font-bold text-foreground">Instant Verification</CardTitle>
                <CardDescription className="text-muted-foreground text-xs">
                  Verify document scan integrity locally against Solana anchors without registering
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col justify-center">
                <div
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  className={`relative flex flex-col items-center justify-center rounded-lg border border-dashed py-12 px-4 text-center transition-all ${
                    dragActive 
                      ? 'border-foreground bg-foreground/5' 
                      : 'border-border bg-background/40 hover:bg-accent/20'
                  }`}
                >
                  <input
                    type="file"
                    id="dashboard-verify-input"
                    onChange={handleFileChange}
                    className="hidden"
                    accept=".pdf,.png,.jpg,.jpeg"
                  />
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-foreground border border-border mb-4 shadow-sm">
                    <FileUp className="h-6 w-6" />
                  </div>
                  <p className="text-sm font-medium text-foreground/80">
                    Drag and drop file here, or
                  </p>
                  <label
                    htmlFor="dashboard-verify-input"
                    className="mt-2 text-sm text-foreground underline hover:text-muted-foreground cursor-pointer font-medium"
                  >
                    browse files
                  </label>
                  <p className="text-xs text-muted-foreground mt-2">
                    Supports PDF, PNG, JPG (Max 25MB)
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}

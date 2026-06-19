'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/auth-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Lock, FileSignature, CheckCircle, Search, RefreshCw, LogOut, Eye, AlertCircle, FileText, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';

interface PendingDocument {
  documentId: string;
  title: string;
  type: string;
  contentHash: string;
  status: string;
  requiredSigners: number;
  signerCount: number;
  createdAt: string;
}

export default function NotaryDashboard() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [queue, setQueue] = useState<PendingDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [signing, setSigning] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  
  // DSC Token simulation state
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [dscPin, setDscPin] = useState('');
  const [selectedDoc, setSelectedDoc] = useState<PendingDocument | null>(null);

  const fetchQueue = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await apiClient.get('/notaries/queue');
      setQueue(res.data || []);
    } catch (err: any) {
      console.warn('Failed to load pending queue, using fallback cache:', err.message);
      const stored = localStorage.getItem('registered_documents');
      if (stored) {
        const list = JSON.parse(stored) as PendingDocument[];
        setQueue(list.filter(doc => doc.status === 'ONCHAIN_CONFIRMED'));
      } else {
        setQueue([]);
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
    if (user.role !== 'NOTARY') {
      if (user.role === 'CITIZEN') {
        router.push('/dashboard');
      } else {
        router.push('/search');
      }
      return;
    }
    fetchQueue();
  }, [user, router]);

  const openSigningModal = (doc: PendingDocument) => {
    setSelectedDoc(doc);
    setDscPin('');
    setErrorMsg('');
    setSuccessMsg('');
    setIsPinModalOpen(true);
  };

  const handleSigning = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDoc) return;
    if (dscPin !== '1234') {
      setErrorMsg('Incorrect DSC USB Token PIN. Access Denied.');
      return;
    }

    setSigning(true);
    setErrorMsg('');
    try {
      const signatureBytes = `mock_sig_notary_rao_${selectedDoc.documentId}_${Date.now()}`;
      
      const payload = {
        signerRole: 'NOTARY',
        signatureBytes,
        certSerial: 'CA-3-889a2bc1'
      };

      const res = await apiClient.post(`/documents/${selectedDoc.documentId}/signatures`, payload);
      if (!res.data) {
        throw new Error(res.error?.message || 'Failed to apply signature.');
      }

      setSuccessMsg('Digital Signature (DSC) verified and registered on-chain successfully!');
      
      const stored = localStorage.getItem('registered_documents');
      if (stored) {
        const list = JSON.parse(stored) as PendingDocument[];
        const updatedList = list.map(doc => {
          if (doc.documentId === selectedDoc.documentId) {
            return { 
              ...doc, 
              status: res.data.status, 
              signerCount: doc.signerCount + 1 
            };
          }
          return doc;
        });
        localStorage.setItem('registered_documents', JSON.stringify(updatedList));
      }

      setTimeout(() => {
        setIsPinModalOpen(false);
        fetchQueue();
      }, 1500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Solana signature transaction failed. Please retry.');
    } finally {
      setSigning(false);
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
              <p className="text-xs text-muted-foreground font-mono">Notary Station</p>
              <p className="text-sm font-medium text-foreground">Advocate Rao</p>
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
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Notary Workstation</h1>
          <p className="text-muted-foreground text-sm mt-1">Review pending signature requests and digitally sign them using your Class 3 DSC token.</p>
        </div>

        <Card className="border-border bg-card/60 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-6">
            <div>
              <CardTitle className="text-lg font-bold text-foreground">Pending Signatures Queue</CardTitle>
              <CardDescription className="text-muted-foreground text-xs">
                Awaiting your cryptographic endorsement to confirm validity.
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchQueue}
              disabled={loading}
              className="border-border bg-background text-muted-foreground hover:bg-accent rounded-full"
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh Queue
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {queue.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <FileSignature className="h-12 w-12 text-muted-foreground/30 mb-3" />
                <p className="text-muted-foreground text-sm font-medium">No pending documents</p>
                <p className="text-muted-foreground/60 text-xs mt-1">Your signature queue is completely cleared.</p>
              </div>
            ) : (
              <Table>
                <TableHeader className="border-b border-border bg-muted/20">
                  <TableRow className="border-b border-border hover:bg-transparent">
                    <TableHead className="text-muted-foreground">Document ID</TableHead>
                    <TableHead className="text-muted-foreground">Title</TableHead>
                    <TableHead className="text-muted-foreground">Type</TableHead>
                    <TableHead className="text-muted-foreground">Uploaded On</TableHead>
                    <TableHead className="text-right text-muted-foreground">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {queue.map((doc) => (
                    <TableRow key={doc.documentId} className="border-b border-border/60 hover:bg-accent/40">
                      <TableCell className="font-mono text-muted-foreground text-xs max-w-[120px] truncate">
                        {doc.documentId}
                      </TableCell>
                      <TableCell className="font-medium text-foreground max-w-[180px] truncate">{doc.title}</TableCell>
                      <TableCell className="text-foreground/80 text-sm">{doc.type}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {new Date(doc.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right flex items-center justify-end gap-2.5 h-[52px]">
                        <Link href={`/document/${doc.documentId}`}>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-border bg-transparent text-muted-foreground hover:bg-accent rounded-full"
                          >
                            <Eye className="h-3.5 w-3.5 mr-1" />
                            Inspect
                          </Button>
                        </Link>
                        <Button
                          size="sm"
                          onClick={() => openSigningModal(doc)}
                          className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-full shadow-sm"
                        >
                          <FileSignature className="h-3.5 w-3.5 mr-1.5" />
                          DSC Sign
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

      {/* DSC PIN Simulation Dialog */}
      <Dialog open={isPinModalOpen} onOpenChange={setIsPinModalOpen}>
        <DialogContent className="border-border bg-card text-foreground max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-foreground text-lg flex items-center gap-2">
              <FileSignature className="h-5 w-5 text-foreground" />
              DSC Authentication Required
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs">
              Review hash details and verify identity using Class-3 Token PIN.
            </DialogDescription>
          </DialogHeader>

          {successMsg ? (
            <div className="py-6 flex flex-col items-center justify-center text-center space-y-3">
              <CheckCircle2 className="h-10 w-10 text-emerald-600" />
              <p className="text-sm font-semibold text-foreground">{successMsg}</p>
            </div>
          ) : (
            <form onSubmit={handleSigning} className="space-y-4 py-2">
              {errorMsg && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="space-y-1.5 text-xs">
                <p><span className="text-muted-foreground font-mono">FILE:</span> {selectedDoc?.title}</p>
                <p className="break-all"><span className="text-muted-foreground font-mono">HASH:</span> {selectedDoc?.contentHash}</p>
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
                  Verify & Sign On-Chain
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <footer className="py-4 border-t border-border text-center text-xs text-muted-foreground bg-muted/20">
        &copy; 2026 Time Lock. All rights reserved.
      </footer>
    </div>
  );
}

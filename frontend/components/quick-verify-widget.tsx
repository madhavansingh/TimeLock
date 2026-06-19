'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ShieldCheck, FileUp, Cpu, AlertCircle, CheckCircle2, ShieldAlert, ArrowRight } from 'lucide-react';
import { calculateSHA256 } from '@/lib/crypto';
import { apiClient } from '@/lib/api';
import Link from 'next/link';

export function QuickVerifyWidget() {
  const [documentId, setDocumentId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [hashingProgress, setHashingProgress] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [verified, setVerified] = useState(false);
  const [result, setResult] = useState<{
    result: 'authentic' | 'modified';
    riskScore: number;
  } | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setErrorMsg('');
      setVerified(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!documentId) {
      setErrorMsg('Please enter a Document ID.');
      return;
    }
    if (!file) {
      setErrorMsg('Please select a file copy.');
      return;
    }

    setLoading(true);
    setHashingProgress(true);
    setErrorMsg('');

    try {
      const hash = await calculateSHA256(file);
      setHashingProgress(false);

      const formData = new FormData();
      formData.append('file', file);

      const res = await apiClient.postFormData(`/documents/${documentId}/verify`, formData);
      if (!res.data) {
        throw new Error(res.error?.message || 'Verification failed.');
      }

      setResult(res.data);
      setVerified(true);
    } catch (err: any) {
      setHashingProgress(false);
      setErrorMsg(err.message || 'Verification request failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setVerified(false);
    setResult(null);
    setErrorMsg('');
  };

  return (
    <Card className="border-border bg-card/60 backdrop-blur-md">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-bold text-foreground flex items-center gap-1.5">
          <ShieldCheck className="h-4 w-4" />
          Quick Verifier
        </CardTitle>
        <CardDescription className="text-[11px] text-muted-foreground">
          Instant integrity checks against Solana records
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {errorMsg && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-2 text-[11px] text-destructive flex items-center gap-1.5">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {!verified ? (
          <form onSubmit={handleVerify} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="widget-doc-id" className="text-[10px] text-foreground/80 font-mono">DOCUMENT ID</Label>
              <Input
                id="widget-doc-id"
                placeholder="Enter Registry UUID"
                value={documentId}
                onChange={(e) => setDocumentId(e.target.value.trim())}
                disabled={loading}
                className="h-8 border-border bg-background text-[11px] font-mono text-foreground placeholder:text-muted-foreground/45 focus-visible:ring-ring"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-[10px] text-foreground/80 font-mono">FILE COPY</Label>
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  id="widget-file-input"
                  onChange={handleFileChange}
                  className="hidden"
                  accept=".pdf,.png,.jpg,.jpeg"
                  disabled={loading}
                />
                <Label
                  htmlFor="widget-file-input"
                  className="flex-1 flex items-center justify-center gap-1 h-8 rounded border border-dashed border-border bg-background/50 hover:bg-accent/25 text-[11px] text-muted-foreground cursor-pointer font-medium"
                >
                  <FileUp className="h-3.5 w-3.5 text-muted-foreground/60" />
                  {file ? file.name : 'Select document'}
                </Label>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-8 bg-primary hover:bg-primary/95 text-primary-foreground text-[11px] font-semibold rounded-full shadow-sm"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-1.5">
                  <Cpu className="h-3 w-3 animate-spin text-muted-foreground" />
                  {hashingProgress ? 'Hashing...' : 'Checking...'}
                </span>
              ) : (
                'Verify Authenticity'
              )}
            </Button>
          </form>
        ) : (
          <div className="space-y-3 pt-1">
            <div className="flex items-center gap-2">
              {result?.result === 'authentic' ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
              ) : (
                <ShieldAlert className="h-5 w-5 text-red-600 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-bold leading-none ${result?.result === 'authentic' ? 'text-emerald-600' : 'text-red-600'}`}>
                  {result?.result === 'authentic' ? 'Authentic' : 'Tampered'}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">
                  Risk Score: {result?.riskScore}/100
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleReset}
                className="flex-1 h-7 text-[10px] border-border bg-transparent hover:bg-accent text-foreground rounded-full"
              >
                Clear
              </Button>
              <Link href={`/document/${documentId}`} className="flex-1">
                <Button className="w-full h-7 text-[10px] bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-full flex items-center justify-center gap-0.5">
                  Audit
                  <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

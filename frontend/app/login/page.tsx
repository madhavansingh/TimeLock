'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/auth-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiClient } from '@/lib/api';
import { Lock, ArrowRight, ShieldCheck, Mail, Phone, Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function LoginPage() {
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [infoMsg, setInfoMsg] = useState('');

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier) {
      setErrorMsg('Please enter your Email address.');
      return;
    }
    if (!identifier.includes('@')) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }
    setLoading(true);
    setErrorMsg('');
    setInfoMsg('');
    try {
      await apiClient.post('/auth/otp/request', { identifier });
      setOtpSent(true);
      setInfoMsg('OTP sent successfully! (Use "123456" for this demo)');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to request OTP. Please verify your format.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || code.length !== 6) {
      setErrorMsg('Please enter a valid 6-digit OTP code.');
      return;
    }
    setLoading(true);
    setErrorMsg('');
    setInfoMsg('');
    try {
      await login(identifier, code);
    } catch (err: any) {
      setErrorMsg(err.message || 'Incorrect OTP code or session expired.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-4 text-foreground antialiased noise-overlay">
      {/* Subtle grid lines matching the landing page */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-30"></div>

      <div className="relative z-10 w-full max-w-md">
        {/* Brand header - B&W Style */}
        <div className="mb-8 flex items-center justify-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
            <Lock className="h-5 w-5" />
          </div>
          <span className="font-sans text-2xl font-bold tracking-tight text-foreground">
            Time <span className="font-display font-light">Lock</span>
          </span>
        </div>

        <Card className="border-border bg-card/60 backdrop-blur-md">
          <CardHeader className="space-y-1.5 text-center">
            <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
              {otpSent ? 'Enter Security Code' : 'Sign In'}
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              {otpSent 
                ? `Enter the 6-digit code sent to ${identifier}` 
                : 'Secure workspace access for citizens, notaries, and auditors'}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {errorMsg && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                {errorMsg}
              </div>
            )}
            
            {infoMsg && (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-600">
                {infoMsg}
              </div>
            )}

            {!otpSent ? (
              <form onSubmit={handleRequestOtp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="identifier" className="text-foreground/80">Email Address</Label>
                  <div className="relative">
                    <Input
                      id="identifier"
                      type="email"
                      placeholder="e.g., priya.executant@example.com"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      disabled={loading}
                      className="border-border bg-background pl-10 text-foreground placeholder:text-muted-foreground/50 focus-visible:ring-ring"
                    />
                    <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted-foreground">
                      <Mail className="h-4.5 w-4.5" />
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-1.5 mt-3 pt-3 border-t border-border/50">
                    <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/80 mb-2">Demo Accounts:</p>
                    <div className="space-y-1">
                      <div className="flex justify-between items-center bg-foreground/[0.02] hover:bg-foreground/[0.04] px-3 py-2 border border-foreground/5 rounded-lg transition-colors">
                        <span className="font-medium text-foreground/80 text-[11px]">Citizen</span>
                        <code className="text-foreground font-mono text-[11px] select-all">priya.executant@example.com</code>
                      </div>
                      <div className="flex justify-between items-center bg-foreground/[0.02] hover:bg-foreground/[0.04] px-3 py-2 border border-foreground/5 rounded-lg transition-colors">
                        <span className="font-medium text-foreground/80 text-[11px]">Notary</span>
                        <code className="text-foreground font-mono text-[11px] select-all">rao.notary@example.com</code>
                      </div>
                      <div className="flex justify-between items-center bg-foreground/[0.02] hover:bg-foreground/[0.04] px-3 py-2 border border-foreground/5 rounded-lg transition-colors">
                        <span className="font-medium text-foreground/80 text-[11px]">Auditor</span>
                        <code className="text-foreground font-mono text-[11px] select-all">bank.officer@example.com</code>
                      </div>
                    </div>
                  </div>
                </div>

                <Button type="submit" disabled={loading} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-full">
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Requesting OTP...
                    </>
                  ) : (
                    <>
                      Send One-Time Passcode
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="code" className="text-foreground/80">One-Time Password (OTP)</Label>
                  <Input
                    id="code"
                    type="text"
                    maxLength={6}
                    placeholder="Enter 6-digit code"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                    disabled={loading}
                    className="border-border bg-background text-center text-lg font-mono tracking-[0.4em] placeholder:tracking-normal text-foreground focus-visible:ring-ring"
                  />
                </div>

                <div className="flex gap-3">
                  <Button 
                    type="button" 
                    variant="outline" 
                    disabled={loading}
                    onClick={() => setOtpSent(false)}
                    className="flex-1 border-border bg-transparent hover:bg-accent text-foreground rounded-full"
                  >
                    Back
                  </Button>
                  <Button type="submit" disabled={loading} className="flex-[2] bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-full">
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      <>
                        Verify OTP
                        <ShieldCheck className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                </div>
              </form>
            )}
          </CardContent>

          <CardFooter className="border-t border-border bg-muted/20 py-4 text-center justify-center text-xs text-muted-foreground">
            <span>Secured by Solana Devnet & DSC Network.</span>
            <Link href="/" className="ml-2.5 text-foreground underline hover:text-muted-foreground">Return Home</Link>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}

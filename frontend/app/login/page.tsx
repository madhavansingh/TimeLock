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
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [infoMsg, setInfoMsg] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMsg('Please enter both email and password.');
      return;
    }
    setLoading(true);
    setErrorMsg('');
    setInfoMsg('');
    try {
      await login(email, password);
    } catch (err: any) {
      setErrorMsg(err.message || 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = async (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword('Demo@123');
    setLoading(true);
    setErrorMsg('');
    setInfoMsg('');
    try {
      await login(demoEmail, 'Demo@123');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to login with authority account.');
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
              Sign In
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Secure workspace access for citizens, notaries, judges, and administrators
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

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-foreground/80">Email Address</Label>
                <div className="relative">
                  <Input
                    id="email"
                    type="email"
                    placeholder="e.g., citizen@ltn.gov"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                    className="border-border bg-background pl-10 text-foreground placeholder:text-muted-foreground/50 focus-visible:ring-ring"
                  />
                  <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted-foreground">
                    <Mail className="h-4.5 w-4.5" />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-foreground/80">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    className="border-border bg-background pl-10 text-foreground placeholder:text-muted-foreground/50 focus-visible:ring-ring"
                  />
                  <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted-foreground">
                    <Lock className="h-4.5 w-4.5" />
                  </div>
                </div>
              </div>

              <Button type="submit" disabled={loading} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-full mt-2">
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing In...
                  </>
                ) : (
                  <>
                    Sign In
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </form>

            <div className="text-xs text-muted-foreground space-y-1.5 mt-3 pt-3 border-t border-border/50">
              <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/80 mb-2">Registry Portal Quick Logins:</p>
              <div className="grid grid-cols-2 gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  disabled={loading}
                  onClick={() => handleQuickLogin('citizen@ltn.demo')}
                  className="bg-foreground/[0.02] hover:bg-foreground/[0.04] text-[11px] h-9 rounded-lg"
                >
                  Login as Citizen
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  disabled={loading}
                  onClick={() => handleQuickLogin('notary@ltn.demo')}
                  className="bg-foreground/[0.02] hover:bg-foreground/[0.04] text-[11px] h-9 rounded-lg"
                >
                  Login as Notary
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  disabled={loading}
                  onClick={() => handleQuickLogin('judge@ltn.demo')}
                  className="bg-foreground/[0.02] hover:bg-foreground/[0.04] text-[11px] h-9 rounded-lg"
                >
                  Login as Judge
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  disabled={loading}
                  onClick={() => handleQuickLogin('admin@ltn.demo')}
                  className="bg-foreground/[0.02] hover:bg-foreground/[0.04] text-[11px] h-9 rounded-lg"
                >
                  Login as Admin
                </Button>
              </div>
            </div>
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

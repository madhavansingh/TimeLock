'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ShieldCheck, RefreshCw, LogOut } from 'lucide-react';

interface NotaryHeaderProps {
  user: any;
  loading: boolean;
  onRefresh: () => void;
  onLogout: () => void;
}

export const NotaryHeader: React.FC<NotaryHeaderProps> = ({
  user,
  loading,
  onRefresh,
  onLogout,
}) => {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card/60 backdrop-blur-md p-6 rounded-2xl border border-border/60 shadow-sm">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">Notary Operations Center</h1>
          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 gap-1 text-xs">
            <ShieldCheck className="w-3.5 h-3.5" />
            Classified Clearance: Top Secret (LEVEL-4)
          </Badge>
        </div>
        <p className="text-muted-foreground text-sm mt-1">
          Welcome back, <span className="text-foreground font-medium">{user?.name || 'Notary Public'}</span>. Execute legal signatures, review evidence, and audit ownership trails.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={loading}
          className="gap-2 h-9 text-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh Registry
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={onLogout}
          className="gap-2 h-9 text-xs text-muted-foreground hover:text-foreground"
        >
          <LogOut className="w-3.5 h-3.5" />
          Disconnect Session
        </Button>
      </div>
    </div>
  );
};

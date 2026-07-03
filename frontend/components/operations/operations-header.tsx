'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Activity, RefreshCw, Layers } from 'lucide-react';

interface OperationsHeaderProps {
  loading: boolean;
  onRefresh: () => void;
}

export const OperationsHeader: React.FC<OperationsHeaderProps> = ({ loading, onRefresh }) => {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card/60 backdrop-blur-md p-6 rounded-2xl border border-border/60 shadow-sm">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">LTN System Operations & Health</h1>
          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 gap-1 text-xs font-mono">
            <Activity className="w-3.5 h-3.5 animate-pulse" />
            ALL SYSTEMS OPERATIONAL
          </Badge>
        </div>
        <p className="text-muted-foreground text-sm mt-1">
          Monitor real-time Solana network metrics, API latency, PostgreSQL connection pools, and AI agent workloads.
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
          Refresh Metrics
        </Button>
      </div>
    </div>
  );
};

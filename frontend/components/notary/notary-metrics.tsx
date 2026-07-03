'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { FileText, CheckCircle2, FileCheck2, ShieldAlert } from 'lucide-react';

interface NotaryMetricsProps {
  analytics: {
    documentsAssigned: number;
    documentsReviewed: number;
    signaturesCompleted: number;
    disputesCount: number;
  } | null;
}

export const NotaryMetrics: React.FC<NotaryMetricsProps> = ({ analytics }) => {
  const stats = [
    {
      label: 'Assigned Cases',
      value: analytics?.documentsAssigned ?? 0,
      icon: FileText,
      color: 'text-blue-500 bg-blue-500/10',
    },
    {
      label: 'Reviewed Cases',
      value: analytics?.documentsReviewed ?? 0,
      icon: CheckCircle2,
      color: 'text-amber-500 bg-amber-500/10',
    },
    {
      label: 'Signed Documents',
      value: analytics?.signaturesCompleted ?? 0,
      icon: FileCheck2,
      color: 'text-emerald-500 bg-emerald-500/10',
    },
    {
      label: 'Pending Disputes',
      value: analytics?.disputesCount ?? 0,
      icon: ShieldAlert,
      color: 'text-rose-500 bg-rose-500/10',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, i) => {
        const Icon = stat.icon;
        return (
          <Card key={i} className="border-border/60 bg-card/40 backdrop-blur-sm">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {stat.label}
                </p>
                <h3 className="text-2xl font-bold tracking-tight mt-1">{stat.value}</h3>
              </div>
              <div className={`p-3 rounded-xl ${stat.color}`}>
                <Icon className="w-5 h-5" />
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

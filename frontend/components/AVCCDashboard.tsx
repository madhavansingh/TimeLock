import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Network, 
  ShieldAlert, 
  AlertTriangle, 
  Activity, 
  ShieldCheck, 
  RefreshCw,
  Info,
  TrendingUp,
  Fingerprint,
  User,
  FileText,
  Clock,
  KeyRound,
  FileCheck2
} from 'lucide-react';

interface AVCCDashboardProps {
  data: any;
  loading: boolean;
  recalculating: boolean;
  resolvingAnomalyId: string | null;
  onResolveAnomaly: (anomalyId: string) => Promise<void>;
  onRecalculateGraph: () => Promise<void>;
}

export function AVCCDashboard({
  data,
  loading,
  recalculating,
  resolvingAnomalyId,
  onResolveAnomaly,
  onRecalculateGraph
}: AVCCDashboardProps) {
  const [selectedNode, setSelectedNode] = useState<any | null>(null);

  if (loading) {
    return (
      <Card className="bg-card/60 border-border backdrop-blur-sm p-16 text-center space-y-3 shadow-sm">
        <RefreshCw className="h-8 w-8 text-primary animate-spin mx-auto" />
        <p className="text-sm text-muted-foreground">Loading AVCC Trust Intelligence Network and live Node Graph...</p>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card className="bg-card/60 border-border backdrop-blur-sm p-16 text-center space-y-4 shadow-sm">
        <Network className="h-8 w-8 text-muted-foreground mx-auto" />
        <p className="text-sm text-muted-foreground">No National Trust Graph compiled yet.</p>
        <Button 
          onClick={onRecalculateGraph}
          disabled={recalculating}
          className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-full px-5 text-xs font-semibold h-9 shadow-sm"
        >
          {recalculating ? 'Analyzing Registry...' : 'Initialize National Trust Graph'}
        </Button>
      </Card>
    );
  }

  // 1. Compute node coordinates for rendering the Network Risk Map
  const nodes = data.nodes || [];
  const edges = data.edges || [];

  // Group nodes by entityType to position them in distinct layout bands
  const citizenNodes = nodes.filter((n: any) => n.entityType === 'CITIZEN');
  const notaryNodes = nodes.filter((n: any) => n.entityType === 'NOTARY');
  const propertyNodes = nodes.filter((n: any) => n.entityType === 'PROPERTY');
  const documentNodes = nodes.filter((n: any) => n.entityType === 'DOCUMENT');
  const otherNodes = nodes.filter((n: any) => !['CITIZEN', 'NOTARY', 'PROPERTY', 'DOCUMENT'].includes(n.entityType));

  const nodePositions = new Map<string, { x: number; y: number }>();

  // Helper to assign circular layout coordinates
  const positionInCircle = (nodeList: any[], cx: number, cy: number, radius: number, angleOffset = 0) => {
    nodeList.forEach((node, index) => {
      const angle = (index / Math.max(1, nodeList.length)) * 2 * Math.PI + angleOffset;
      nodePositions.set(node.nodeId, {
        x: cx + radius * Math.cos(angle),
        y: cy + radius * Math.sin(angle)
      });
    });
  };

  // Center the property nodes
  propertyNodes.forEach((node: any, index: number) => {
    nodePositions.set(node.nodeId, { x: 300, y: 220 + index * 40 });
  });

  // Inner ring: Documents
  positionInCircle(documentNodes, 300, 220, 95);

  // Outer ring left: Citizens
  positionInCircle(citizenNodes, 120, 220, 100);

  // Outer ring right: Notaries
  positionInCircle(notaryNodes, 480, 220, 100);

  // Bottom ring: Other entities (Evidence, Cases, Anchors)
  positionInCircle(otherNodes, 300, 390, 80, Math.PI / 2);

  // Fallback for any nodes without preset coordinates
  nodes.forEach((node: any) => {
    if (!nodePositions.has(node.nodeId)) {
      nodePositions.set(node.nodeId, { x: 150 + Math.random() * 300, y: 100 + Math.random() * 200 });
    }
  });

  const getNodeColor = (type: string) => {
    switch (type) {
      case 'PROPERTY': return '#4f46e5'; // indigo-600
      case 'DOCUMENT': return '#0284c7'; // sky-600
      case 'CITIZEN': return '#059669'; // emerald-600
      case 'NOTARY': return '#7c3aed'; // purple-600
      case 'CASE': return '#d97706'; // amber-600
      case 'EVIDENCE': return '#e11d48'; // rose-600
      case 'ANCHOR': return '#0891b2'; // cyan-600
      default: return '#475569'; // slate-600
    }
  };

  return (
    <div className="space-y-6 animate-fade-slide">
      {/* VCC Top Action Bar */}
      <div className="flex items-center justify-between flex-wrap gap-4 bg-muted/40 p-4 rounded-xl border border-border backdrop-blur-sm">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2 text-foreground">
            <Network className="h-5 w-5 text-primary" />
            <span>Autonomous Verification Command Center (AVCC)</span>
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Sovereign trust graph and multi-agent compliance intelligence system
          </p>
        </div>

        <Button
          onClick={onRecalculateGraph}
          disabled={recalculating}
          className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-full px-5 text-xs font-semibold h-9 shadow-sm"
        >
          <RefreshCw className={`h-3.5 w-3.5 mr-2 ${recalculating ? 'animate-spin' : ''}`} />
          {recalculating ? 'Recalculating Graph...' : 'Re-Run Multi-Agent Telemetry'}
        </Button>
      </div>

      {/* Main AVCC Grid Dashboard */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Panel 1: Live National Trust Graph Map */}
        <Card className="lg:col-span-2 bg-card border-border backdrop-blur-sm overflow-hidden flex flex-col justify-between min-h-[500px] shadow-sm">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between border-b border-border">
            <div>
              <CardTitle className="text-sm font-bold text-foreground uppercase tracking-wider">
                Live National Trust Graph Map
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-0.5">
                Active node linkages mapping citizen property credentials and Solana ledger anchors
              </CardDescription>
            </div>
            <div className="flex gap-2 text-[10px] font-mono text-muted-foreground">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-600" /> Citizen</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-indigo-600" /> Property</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-sky-600" /> Document</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-purple-600" /> Notary</span>
            </div>
          </CardHeader>
          <CardContent className="p-0 flex-1 relative bg-muted/5 min-h-[350px]">
            {/* Node Info Overlay details */}
            {selectedNode && (() => {
              const matchingRisk = (data.entityRisks || []).find(
                (r: any) => r.entityType === selectedNode.entityType && r.entityId === selectedNode.entityId
              );
              return (
                <div className="absolute top-4 left-4 z-10 bg-card/95 border border-border rounded-xl p-3.5 max-w-xs text-xs space-y-2.5 backdrop-blur-md shadow-md">
                  <div className="flex justify-between items-start">
                    <span className="font-bold font-mono text-primary text-[10px] uppercase tracking-wider">{selectedNode.entityType}</span>
                    <button type="button" onClick={() => setSelectedNode(null)} className="text-muted-foreground hover:text-foreground font-bold">&times;</button>
                  </div>
                  <p className="font-semibold text-foreground text-sm">{selectedNode.label}</p>
                  <div className="text-[10px] text-muted-foreground space-y-1 font-mono">
                    <p className="truncate">NODE ID: {selectedNode.nodeId}</p>
                    {selectedNode.entityId && <p className="truncate">REF ID: {selectedNode.entityId}</p>}
                  </div>
                  {matchingRisk && (
                    <div className="border-t border-border pt-2 space-y-1.5">
                      <p className="text-[10px] text-foreground font-bold font-mono uppercase tracking-wider">Entity Risk Rating</p>
                      <div className="grid grid-cols-2 gap-2 text-[10px]">
                        <div className="bg-emerald-500/10 text-emerald-600 font-bold p-1 rounded text-center">
                          TRUST: {matchingRisk.trustScore}%
                        </div>
                        <div className="bg-red-500/10 text-red-600 font-bold p-1 rounded text-center">
                          RISK: {matchingRisk.riskScore}%
                        </div>
                      </div>
                      {Array.isArray(matchingRisk.riskFactors) && matchingRisk.riskFactors.length > 0 && (
                        <div className="space-y-1">
                          <p className="text-[9px] text-muted-foreground font-mono uppercase">Key Risk Factors:</p>
                          <ul className="list-disc list-inside text-[9px] text-muted-foreground space-y-0.5">
                            {matchingRisk.riskFactors.map((factor: string, i: number) => (
                              <li key={i}>{factor}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* SVG Graph Canvas */}
            <svg className="w-full h-full min-h-[400px] overflow-visible" viewBox="0 0 600 480" preserveAspectRatio="xMidYMid meet">
              <defs>
                <marker id="arrow" viewBox="0 0 10 10" refX="22" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#cbd5e1" />
                </marker>
              </defs>

              {/* Render edges */}
              {edges.map((edge: any) => {
                const sourcePos = nodePositions.get(edge.sourceNodeId);
                const targetPos = nodePositions.get(edge.targetNodeId);

                if (!sourcePos || !targetPos) return null;

                return (
                  <line
                    key={edge.edgeId}
                    x1={sourcePos.x}
                    y1={sourcePos.y}
                    x2={targetPos.x}
                    y2={targetPos.y}
                    stroke="#cbd5e1"
                    strokeWidth="1.5"
                    markerEnd="url(#arrow)"
                    className="transition-all"
                  />
                );
              })}

              {/* Render nodes */}
              {nodes.map((node: any) => {
                const pos = nodePositions.get(node.nodeId);
                if (!pos) return null;

                const color = getNodeColor(node.entityType);
                const isSelected = selectedNode?.nodeId === node.nodeId;

                return (
                  <g 
                    key={node.nodeId} 
                    transform={`translate(${pos.x}, ${pos.y})`}
                    onClick={() => setSelectedNode(node)}
                    className="cursor-pointer group"
                  >
                    <circle
                      r="12"
                      fill={color}
                      fillOpacity="0.1"
                      stroke={color}
                      strokeWidth={isSelected ? '2.5' : '1.5'}
                      className="group-hover:fill-opacity-25 transition-all duration-300"
                    />
                    <circle
                      r="4"
                      fill={color}
                    />
                    <text
                      y="24"
                      textAnchor="middle"
                      fill="#475569"
                      className="text-[8px] font-mono select-none pointer-events-none tracking-tight opacity-75 group-hover:opacity-100"
                    >
                      {node.label.length > 15 ? node.label.slice(0, 13) + '...' : node.label}
                    </text>
                  </g>
                );
              })}
            </svg>
          </CardContent>
          <div className="p-3 border-t border-border bg-muted/20 flex justify-between text-[9px] font-mono text-muted-foreground">
            <span>GRAPH DATABASE PERSISTENCE ACTIVE</span>
            <span>NODES: {nodes.length} | EDGES: {edges.length}</span>
          </div>
        </Card>

        {/* Right side panels: Rating & Anchors */}
        <div className="space-y-6">

          {/* Panel 2: Property Trust Rating Radar */}
          <Card className="bg-card border-border backdrop-blur-sm overflow-hidden flex flex-col justify-between shadow-sm">
            <CardHeader className="p-4 pb-2 border-b border-border">
              <CardTitle className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Fingerprint className="h-4 w-4 text-primary" />
                Network Rating Metrics
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-0.5">
                Sovereign land registry score parameters
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4 bg-muted/20 p-3.5 rounded-lg border border-border">
                <div className="space-y-0.5">
                  <p className="text-[10px] text-muted-foreground uppercase font-mono tracking-wider">Average Trust</p>
                  <p className="text-xl font-black text-primary font-mono">{data.avgTrustScore}%</p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-[10px] text-muted-foreground uppercase font-mono tracking-wider">Network Risk</p>
                  <p className="text-xl font-black text-destructive font-mono">{data.avgNetworkRisk}%</p>
                </div>
              </div>

              <div className="space-y-3 pt-1">
                <span className="text-[10px] font-mono text-muted-foreground block uppercase tracking-wider">Rating Distribution Index</span>
                <div className="space-y-2">
                  {Object.entries(data.ratingsDistribution || {}).map(([rating, count]: [string, any]) => (
                    <div key={rating} className="space-y-1">
                      <div className="flex justify-between text-[11px] font-mono">
                        <span className="text-foreground font-bold">{rating}</span>
                        <span className="text-muted-foreground">{count} properties</span>
                      </div>
                      <div className="w-full bg-secondary rounded-full h-1.5 overflow-hidden">
                        <div 
                          className="bg-primary h-full rounded-full transition-all" 
                          style={{ width: `${(count / Math.max(1, data.trustRatings?.length || 1)) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
            <div className="p-2.5 border-t border-border bg-muted/20 text-[9px] text-muted-foreground font-mono text-center">
              Credit Score Metric Distribution index
            </div>
          </Card>

          {/* Panel 6: Solana Anchored Ledgers */}
          <Card className="bg-card border-border backdrop-blur-sm overflow-hidden flex flex-col justify-between shadow-sm">
            <CardHeader className="p-4 pb-2 border-b border-border">
              <CardTitle className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                Solana Anchored Ledgers
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-0.5">
                On-chain trust verification receipts
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 space-y-3 max-h-[220px] overflow-y-auto">
              {(data.trustRatings || []).slice(0, 4).map((rating: any) => (
                <div key={rating.ratingId} className="p-2.5 rounded border border-border bg-muted/10 text-xs space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-foreground">Property: {rating.propertyId.slice(0, 10)}...</span>
                    <Badge className="bg-primary text-primary-foreground border-0 text-[10px] font-bold font-mono px-1.5 py-0.5">{rating.finalRating}</Badge>
                  </div>
                  <div className="font-mono text-[9px] text-muted-foreground break-all space-y-0.5">
                    <p>HASH: {rating.trustReportHash?.slice(0, 20)}...</p>
                    {rating.trustReportTxSignature && (
                      <p className="text-emerald-600 font-semibold">TX: {rating.trustReportTxSignature.slice(0, 20)}...</p>
                    )}
                  </div>
                </div>
              ))}
              {(data.trustRatings || []).length === 0 && (
                <div className="text-center py-6 text-xs text-muted-foreground italic">No ratings anchored on-chain yet.</div>
              )}
            </CardContent>
            <div className="p-2 border-t border-border bg-muted/20 text-[9px] text-muted-foreground font-mono text-center flex items-center justify-center gap-1">
              <KeyRound className="h-3 w-3" /> Class-3 Authenticated On-Chain Ledgers
            </div>
          </Card>

        </div>

      </div>

      {/* Bottom Row Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Panel 3: Ownership Chain Integrity */}
        <Card className="lg:col-span-1 bg-card border-border backdrop-blur-sm overflow-hidden flex flex-col justify-between min-h-[350px] shadow-sm">
          <CardHeader className="p-4 pb-2 border-b border-border flex items-center justify-between flex-row">
            <div>
              <CardTitle className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-primary" />
                Chain Integrity Logs
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-0.5">
                Sequential property history transitions audit
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="p-4 space-y-4 max-h-[300px] overflow-y-auto">
            {(data.chainIntegrity || []).map((audit: any) => (
              <div key={audit.assessmentId} className="p-3 rounded border border-border bg-muted/10 text-xs space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-foreground font-mono">Property: {audit.propertyId.slice(0, 10)}...</span>
                  <Badge className={`text-[9px] font-bold font-mono border-0 px-2 py-0.5 ${
                    audit.status === 'Verified' ? 'bg-emerald-500/10 text-emerald-600' : audit.status === 'Warning' ? 'bg-amber-500/10 text-amber-600' : 'bg-rose-500/10 text-rose-600'
                  }`}>
                    {audit.status.toUpperCase()}
                  </Badge>
                </div>
                <div className="space-y-1.5 border-t border-border pt-2 text-[11px] text-muted-foreground">
                  {audit.findings.map((f: string, i: number) => (
                    <div key={i} className="flex items-start gap-1">
                      <span className="text-primary">•</span>
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {(data.chainIntegrity || []).length === 0 && (
              <div className="text-center py-10 text-xs text-muted-foreground italic">No chain audit history compiled.</div>
            )}
          </CardContent>
          <div className="p-2 border-t border-border bg-muted/20 text-[9px] text-muted-foreground font-mono text-center">
            Verification Integrity Engine audits
          </div>
        </Card>

        {/* Panel 4: Active Anomalies list & resolution controller */}
        <Card className="lg:col-span-1 bg-card border-border backdrop-blur-sm overflow-hidden flex flex-col justify-between min-h-[350px] shadow-sm">
          <CardHeader className="p-4 pb-2 border-b border-border">
            <CardTitle className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              Active Network Anomalies
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground mt-0.5">
              Velocity, volume, or notary throughput flags
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 space-y-4 max-h-[300px] overflow-y-auto">
            {(data.anomalies || []).map((anomaly: any) => (
              <div key={anomaly.anomalyId} className="p-3 rounded border border-border bg-muted/10 text-xs space-y-2.5">
                <div className="flex justify-between items-start">
                  <div className="space-y-0.5">
                    <p className="font-bold text-foreground">{anomaly.title}</p>
                    <p className="text-[10px] text-muted-foreground font-mono">{anomaly.anomalyId.slice(0, 8)}...</p>
                  </div>
                  <Badge className={`text-[9px] font-bold font-mono border-0 px-2 py-0.5 uppercase ${
                    anomaly.severity === 'CRITICAL' ? 'bg-red-500/10 text-red-600' : anomaly.severity === 'HIGH' ? 'bg-rose-500/10 text-rose-600' : 'bg-amber-500/10 text-amber-600'
                  }`}>
                    {anomaly.severity}
                  </Badge>
                </div>
                <p className="text-muted-foreground leading-normal text-[11px]">{anomaly.description}</p>
                <div className="bg-muted/30 p-2 rounded border border-border space-y-1">
                  <p className="text-[10px] text-primary font-bold uppercase tracking-wider">Suggested Actions:</p>
                  <p className="text-[10px] text-muted-foreground leading-normal">{anomaly.suggestedInvestigation}</p>
                </div>
                <Button
                  onClick={() => onResolveAnomaly(anomaly.anomalyId)}
                  disabled={resolvingAnomalyId === anomaly.anomalyId}
                  className="w-full bg-secondary hover:bg-secondary/80 text-foreground border border-border rounded-lg text-[10px] font-bold py-1.5 h-auto uppercase"
                >
                  {resolvingAnomalyId === anomaly.anomalyId ? 'Dismissing...' : 'Resolve Anomaly'}
                </Button>
              </div>
            ))}
            {(data.anomalies || []).length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground space-y-2">
                <ShieldCheck className="h-8 w-8 text-emerald-600" />
                <p className="text-xs font-semibold text-foreground">Clean Network Slate</p>
                <p className="text-[10px]">No active title or notary velocity anomalies registered.</p>
              </div>
            )}
          </CardContent>
          <div className="p-2 border-t border-border bg-muted/20 text-[9px] text-muted-foreground font-mono text-center">
            Active Threat Mitigation Engine
          </div>
        </Card>

        {/* Panel 5: AI Investigation Feed */}
        <Card className="lg:col-span-1 bg-card border-border backdrop-blur-sm overflow-hidden flex flex-col justify-between min-h-[350px] shadow-sm">
          <CardHeader className="p-4 pb-2 border-b border-border">
            <CardTitle className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Activity className="h-4 w-4 text-primary animate-pulse" />
              AI Investigation Feed
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground mt-0.5">
              Chronological log of AI rating transitions
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 space-y-4 max-h-[300px] overflow-y-auto">
            {(data.investigationFeed || []).map((feed: any) => (
              <div key={feed.historyId} className="flex gap-2.5 items-start text-xs border-b border-border pb-2.5 last:border-0 last:pb-0">
                <div className="h-2 w-2 rounded-full bg-primary mt-1 shrink-0" />
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-foreground">Property Evaluation</span>
                    <Badge className="bg-primary/10 text-primary border border-primary/20 text-[8px] font-bold py-0 px-1 font-mono">{feed.finalRating}</Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-normal">{feed.justification}</p>
                  <p className="text-[9px] text-muted-foreground font-mono">{new Date(feed.createdAt).toLocaleString()}</p>
                </div>
              </div>
            ))}
            {(data.investigationFeed || []).length === 0 && (
              <div className="text-center py-10 text-xs text-muted-foreground italic">No historical evaluations registered.</div>
            )}
          </CardContent>
          <div className="p-2 border-t border-border bg-muted/20 text-[9px] text-muted-foreground font-mono text-center">
            Live AI Telemetry Feed
          </div>
        </Card>

      </div>
    </div>
  );
}

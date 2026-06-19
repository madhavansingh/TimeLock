import React from 'react';
import { VerificationEvent } from '@/types';
import { CheckCircle, Award, AlertTriangle, Search, Info } from 'lucide-react';

interface CustodyTimelineProps {
  timeline: VerificationEvent[];
}

export default function CustodyTimeline({ timeline }: CustodyTimelineProps) {
  if (!timeline || timeline.length === 0) {
    return <div className="text-slate-400 text-sm py-4">No timeline events recorded.</div>;
  }

  const getIcon = (type: string) => {
    switch (type) {
      case 'registration_confirmed':
        return <CheckCircle className="h-5 w-5 text-emerald-600" />;
      case 'notary_signed':
        return <Award className="h-5 w-5 text-blue-600" />;
      case 'VERIFICATION_SUCCESS':
        return <Search className="h-5 w-5 text-indigo-600" />;
      case 'VERIFICATION_TAMPER_DETECTED':
        return <AlertTriangle className="h-5 w-5 text-rose-600" />;
      default:
        return <Info className="h-5 w-5 text-slate-400" />;
    }
  };

  const getBgColor = (type: string) => {
    switch (type) {
      case 'registration_confirmed':
        return 'bg-emerald-50';
      case 'notary_signed':
        return 'bg-blue-50';
      case 'VERIFICATION_SUCCESS':
        return 'bg-indigo-50';
      case 'VERIFICATION_TAMPER_DETECTED':
        return 'bg-rose-50';
      default:
        return 'bg-slate-50';
    }
  };

  const formatEventName = (type: string) => {
    return type.replace(/_/g, ' ').toUpperCase();
  };

  return (
    <div className="flow-root mt-4">
      <ul role="list" className="-mb-8">
        {timeline.map((event, idx) => (
          <li key={event.eventId || idx}>
            <div className="relative pb-8">
              {idx !== timeline.length - 1 && (
                <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-slate-200" aria-hidden="true" />
              )}
              <div className="relative flex space-x-3">
                <div>
                  <span className={`h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-white ${getBgColor(event.eventType)}`}>
                    {getIcon(event.eventType)}
                  </span>
                </div>
                <div className="flex-1 min-w-0 pt-1.5 flex justify-between space-x-4">
                  <div>
                    <p className="text-sm font-bold text-slate-900">{formatEventName(event.eventType)}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Actor: <span className="font-semibold text-slate-700">{event.actorLabel}</span>
                    </p>
                    {event.onchainTxRef && (
                      <p className="text-[10px] font-mono text-slate-400 mt-1 truncate max-w-md">
                        Tx Ref: {event.onchainTxRef}
                      </p>
                    )}
                  </div>
                  <div className="text-right text-xs whitespace-nowrap text-slate-400">
                    <time dateTime={new Date(event.occurredAt).toISOString()}>
                      {new Date(event.occurredAt).toLocaleString()}
                    </time>
                  </div>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

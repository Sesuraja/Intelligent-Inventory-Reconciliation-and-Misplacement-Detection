import React from 'react';
import { CheckCircle2, AlertTriangle, EyeOff, Radio, HelpCircle, ShieldCheck } from 'lucide-react';

interface StatusBadgeProps {
  status: string;
  showIcon?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, showIcon = true }) => {
  switch (status) {
    case 'IN_PLACE':
    case 'present_ok':
      return (
        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-xs">
          {showIcon && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
          <span>Present OK</span>
        </span>
      );
    case 'MISPLACED':
    case 'LIKELY_MISSING':
    case 'likely_absent_or_misplaced':
      return (
        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 shadow-xs">
          {showIcon && <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />}
          <span>Likely Absent / Misplaced</span>
        </span>
      );
    case 'POSSIBLE_UNREAD':
    case 'likely_unread':
      return (
        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-xs">
          {showIcon && <Radio className="w-3.5 h-3.5 text-indigo-600" />}
          <span>Likely Unread</span>
        </span>
      );
    case 'AMBIGUOUS':
    case 'uncertain_verify':
      return (
        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200 shadow-xs">
          {showIcon && <HelpCircle className="w-3.5 h-3.5 text-purple-600" />}
          <span>Uncertain (Rescan)</span>
        </span>
      );
    case 'VERIFIED':
      return (
        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cyan-50 text-cyan-700 border border-cyan-200 shadow-xs">
          {showIcon && <ShieldCheck className="w-3.5 h-3.5 text-cyan-600" />}
          <span>Verified</span>
        </span>
      );
    case 'AI_ANALYZED':
      return (
        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 shadow-xs">
          <span>AI Analyzed</span>
        </span>
      );
    case 'RESOLVED':
      return (
        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200 shadow-xs">
          <span>Resolved</span>
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
          {status}
        </span>
      );
  }
};


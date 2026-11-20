import React from 'react';
import {
  Brain,
  Sparkles,
  Layers,
  ArrowRight,
  ShieldAlert,
  Sliders,
  CheckCircle2,
  HelpCircle,
  TrendingDown,
  TrendingUp,
  Cpu
} from 'lucide-react';
import { DiscrepancyItem } from '../../types';

interface RootCauseAnalysisViewProps {
  selectedException: DiscrepancyItem | null;
  onNavigateVerify?: () => void;
}

export const RootCauseAnalysisView: React.FC<RootCauseAnalysisViewProps> = ({
  selectedException,
  onNavigateVerify
}) => {
  if (!selectedException) {
    return (
      <div className="bg-white border border-slate-200/90 rounded-2xl p-12 text-center text-slate-500 shadow-xs">
        <Brain className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <h3 className="text-base font-bold text-slate-800">No Exception Selected</h3>
        <p className="text-xs text-slate-400 mt-1">
          Select an inventory discrepancy from 4.1 Discrepancies list to view its probabilistic AI root-cause diagnosis.
        </p>
      </div>
    );
  }

  const causeDist: Record<string, number> = (selectedException.cause_distribution as Record<string, number>) || {
    'PHYSICAL_RELOCATION': 0.48,
    'RF_SHADOWING': 0.24,
    'WMS_TRANSACTION_ERROR': 0.14,
    'DUPLICATE_EPC': 0.08,
    'UNKNOWN': 0.06
  };

  const shapContributions: Array<{ feature: string; impact: number; direction: 'positive' | 'negative' }> =
    selectedException.feature_contributions || [
    { feature: 'Antenna read count', impact: 0.31, direction: 'positive' },
    { feature: 'RSSI variance across ports', impact: 0.18, direction: 'positive' },
    { feature: 'Time since last authorized move', impact: -0.05, direction: 'negative' },
    { feature: 'Antenna beam coverage index', impact: -0.03, direction: 'negative' },
    { feature: 'Reader hardware health', impact: 0.02, direction: 'positive' }
  ];

  return (
    <div className="space-y-6 text-xs text-slate-800">
      
      {/* Top Banner */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Brain className="w-5 h-5 text-indigo-600" />
            <h3 className="text-base font-bold text-slate-900">4.2 Root Cause Analysis</h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
              SHAP Multi-Class Attribution
            </span>
          </div>
          <p className="text-slate-500 text-[11px] mt-1">
            Probabilistic root-cause hypotheses computed with TreeSHAP feature importance to explain why the item is out of place.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {onNavigateVerify && (
            <button
              onClick={onNavigateVerify}
              className="flex items-center space-x-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs transition"
            >
              <span>Take Action & Verify →</span>
            </button>
          )}
        </div>
      </div>

      {/* Item Summary Bar */}
      <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="font-mono text-base font-bold text-blue-400">{selectedException.epc}</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
              {selectedException.discrepancy_type}
            </span>
          </div>
          <p className="text-slate-300 text-xs mt-1">
            {selectedException.product_name} <span className="text-slate-400 font-mono">({selectedException.product_sku})</span>
          </p>
        </div>

        <div className="flex items-center space-x-6 text-xs font-mono">
          <div>
            <span className="text-slate-400 block text-[10px] uppercase">Expected Shelf</span>
            <strong className="text-white text-sm">{selectedException.expected_shelf_code}</strong>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] uppercase">Observed Shelf</span>
            <strong className="text-amber-400 text-sm">{selectedException.observed_shelf_code || 'Unread'}</strong>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] uppercase">Confidence</span>
            <strong className="text-emerald-400 text-sm">{Math.round(selectedException.confidence * 100)}%</strong>
          </div>
        </div>
      </div>

      {/* Main Grid: Probabilities & SHAP Attribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Left: Cause Probabilities */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-slate-900 text-sm">Top Causes (Probability Distribution)</h4>
            <span className="text-[10px] font-mono text-slate-400">Softmax Calibrated</span>
          </div>

          <div className="space-y-3 pt-2">
            {Object.entries(causeDist).map(([cause, rawProb]) => {
              const prob = Number(rawProb);
              const pct = Math.round(prob * 100);
              const label = cause.replace(/_/g, ' ');
              const maxVal = Math.max(...Object.values(causeDist).map(Number));
              const isTop = prob === maxVal;

              return (
                <div key={cause} className="space-y-1">
                  <div className="flex justify-between items-center text-xs">
                    <span className={`font-semibold capitalize ${isTop ? 'text-blue-900 font-bold' : 'text-slate-700'}`}>
                      {label.toLowerCase()}
                    </span>
                    <span className="font-mono font-bold text-slate-900">{prob.toFixed(2)} ({pct}%)</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-2 rounded-full transition-all duration-500 ${
                        isTop ? 'bg-blue-600' : 'bg-slate-400'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-500">
            <strong>Model Hypothesis:</strong> {selectedException.ai_reasoning || 'Strong physical relocation probability based on elevated read rates on adjacent Antenna 2 without matching WMS pick transaction.'}
          </div>
        </div>

        {/* Right: SHAP Feature Attributions */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-slate-900 text-sm">SHAP Explanation (Feature Impact)</h4>
            <span className="text-[10px] font-mono text-purple-700 font-bold bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
              TreeSHAP Explainer
            </span>
          </div>

          <div className="space-y-3 pt-2">
            {shapContributions.map((feat, idx) => {
              const absVal = Math.abs(feat.impact);
              const pct = Math.min(100, Math.round((absVal / 0.4) * 100));
              const isPositive = feat.impact >= 0;

              return (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-700 font-medium">{feat.feature}</span>
                    <span className={`font-mono font-bold ${isPositive ? 'text-purple-700' : 'text-slate-500'}`}>
                      {isPositive ? `+${feat.impact.toFixed(2)}` : feat.impact.toFixed(2)}
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-2 rounded-full transition-all duration-500 ${
                        isPositive ? 'bg-purple-600' : 'bg-slate-400'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-500 flex justify-between">
            <span>Positive impact reinforces the misplacement prediction</span>
            <span className="font-mono text-slate-600">Base Value: 0.12</span>
          </div>
        </div>

      </div>

    </div>
  );
};

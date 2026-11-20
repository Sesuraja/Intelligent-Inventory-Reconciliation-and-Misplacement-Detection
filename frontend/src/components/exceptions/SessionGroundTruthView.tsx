import React, { useState } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  Clock,
  Layers,
  ArrowRight,
  Sparkles,
  Smartphone,
  Radio,
  FileCheck2,
  Check
} from 'lucide-react';

interface SessionGroundTruthViewProps {
  onRefresh?: () => void;
}

export const SessionGroundTruthView: React.FC<SessionGroundTruthViewProps> = ({ onRefresh }) => {
  const [selectedSessionCode, setSelectedSessionCode] = useState('SES-001');

  const sessions = [
    { id: 1, code: 'SES-001', type: 'Baseline Truth', date: 'Nov 19, 2026', swaps: '0 Swaps', status: 'Closed', items: 150, labeled: 150, accuracy: 97.3 },
    { id: 2, code: 'SES-002', type: 'Scenario Injected', date: 'Nov 19, 2026', swaps: '3 Swaps', status: 'In Progress', items: 120, labeled: 98, accuracy: 94.8 },
    { id: 3, code: 'SES-003', type: 'Physical Verification', date: 'Nov 19, 2026', swaps: '1 Swap', status: 'Open', items: 50, labeled: 12, accuracy: 96.0 },
  ];

  const threeWayLedger = [
    { epc: 'EPC0000345', expected: 'Shelf A', aiObserved: 'Shelf C', groundTruth: 'Shelf C', result: 'AI Prediction Verified' },
    { epc: 'EPC0000531', expected: 'Shelf B', aiObserved: 'Unread', groundTruth: 'Shelf B (Shielded)', result: 'RF Shadowing Confirmed' },
    { epc: 'EPC0000876', expected: 'Shelf D', aiObserved: 'Shelf D', groundTruth: 'Shelf D', result: 'Match (In-Place)' },
    { epc: 'EPC0000216', expected: 'Shelf A', aiObserved: 'Shelf A', groundTruth: 'Shelf A', result: 'Match (In-Place)' },
    { epc: 'EPC0000645', expected: 'Shelf C', aiObserved: 'Shelf B', groundTruth: 'Shelf B', result: 'AI Prediction Verified' },
  ];

  const currentSession = sessions.find((s) => s.code === selectedSessionCode) || sessions[0];

  return (
    <div className="space-y-6 text-xs text-slate-800">
      
      {/* Top Banner */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-5 h-5 text-indigo-600" />
            <h3 className="text-base font-bold text-slate-900">Session & Ground Truth Validation</h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
              3-Way Truth Verification
            </span>
          </div>
          <p className="text-slate-500 text-[11px] mt-1">
            Compare expected WMS inventory against AI antenna observations and physical handheld ground truth.
          </p>
        </div>

        <div className="flex items-center space-x-2 font-mono text-xs">
          <span className="text-slate-500">Benchmark Accuracy:</span>
          <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
            {currentSession.accuracy}% Verified
          </span>
        </div>
      </div>

      {/* Session Progress Hero Card */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 border border-indigo-100 shadow-xs">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h4 className="font-bold text-slate-900 text-base font-mono">{currentSession.code}</h4>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                {currentSession.status}
              </span>
            </div>
            <p className="text-slate-500 text-xs mt-0.5">{currentSession.type} • {currentSession.date}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6 text-center">
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 min-w-[100px]">
            <span className="text-slate-400 block text-[10px] uppercase font-bold">Total Items</span>
            <strong className="text-slate-900 font-mono text-base">{currentSession.items}</strong>
          </div>
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 min-w-[100px]">
            <span className="text-slate-400 block text-[10px] uppercase font-bold">Labeled</span>
            <strong className="text-blue-600 font-mono text-base">{currentSession.labeled}</strong>
          </div>
          <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200 min-w-[100px]">
            <span className="text-emerald-700 block text-[10px] uppercase font-bold">Accuracy</span>
            <strong className="text-emerald-700 font-mono text-base">{currentSession.accuracy}%</strong>
          </div>
        </div>

        {/* 3 Step Indicator */}
        <div className="flex items-center space-x-3 text-xs">
          <div className="flex items-center space-x-1 text-emerald-600 font-bold">
            <CheckCircle2 className="w-4 h-4" />
            <span>1. Sweep</span>
          </div>
          <span className="text-slate-300">→</span>
          <div className="flex items-center space-x-1 text-emerald-600 font-bold">
            <CheckCircle2 className="w-4 h-4" />
            <span>2. Verify</span>
          </div>
          <span className="text-slate-300">→</span>
          <div className="flex items-center space-x-1 text-blue-600 font-bold">
            <CheckCircle2 className="w-4 h-4" />
            <span>3. Reconcile</span>
          </div>
        </div>
      </div>

      {/* Sessions Table */}
      <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h4 className="font-bold text-slate-900 text-xs">Ground-Truth Audit Sessions</h4>
          <span className="text-slate-400 text-[11px] font-mono">3 Sessions Recorded</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold text-[10px]">
              <tr>
                <th className="py-2.5 px-4">Session Code</th>
                <th className="py-2.5 px-4">Session Type</th>
                <th className="py-2.5 px-4">Date</th>
                <th className="py-2.5 px-4">Injected Scenarios</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4 text-right">Accuracy</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 font-mono">
              {sessions.map((ses) => (
                <tr
                  key={ses.id}
                  onClick={() => setSelectedSessionCode(ses.code)}
                  className={`hover:bg-slate-50 cursor-pointer transition ${
                    selectedSessionCode === ses.code ? 'bg-indigo-50/50 font-bold' : ''
                  }`}
                >
                  <td className="py-3 px-4 text-blue-600">{ses.code}</td>
                  <td className="py-3 px-4 font-sans text-slate-900">{ses.type}</td>
                  <td className="py-3 px-4 text-slate-500 font-sans">{ses.date}</td>
                  <td className="py-3 px-4 text-amber-700 font-sans">{ses.swaps}</td>
                  <td className="py-3 px-4 font-sans">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      ses.status === 'Closed'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-blue-50 text-blue-700 border border-blue-200'
                    }`}>
                      {ses.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-emerald-600">{ses.accuracy}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3-Way Reconciliation Comparison Ledger */}
      <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h4 className="font-bold text-slate-900 text-xs">3-Way Reconciliation Comparison Matrix</h4>
            <p className="text-[11px] text-slate-400">WMS Expected vs AI Antenna Estimation vs Handheld Ground Truth</p>
          </div>
          <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
            Gold Standard Match
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold text-[10px]">
              <tr>
                <th className="py-2.5 px-4">Tag EPC</th>
                <th className="py-2.5 px-4">WMS Expected</th>
                <th className="py-2.5 px-4">AI Fixed Observed</th>
                <th className="py-2.5 px-4">Handheld Ground Truth</th>
                <th className="py-2.5 px-4 text-right">Verification Outcome</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 font-mono">
              {threeWayLedger.map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-50/80 transition">
                  <td className="py-3 px-4 font-bold text-slate-900">{row.epc}</td>
                  <td className="py-3 px-4 text-slate-600">{row.expected}</td>
                  <td className="py-3 px-4 text-blue-600 font-semibold">{row.aiObserved}</td>
                  <td className="py-3 px-4 text-emerald-600 font-bold">{row.groundTruth}</td>
                  <td className="py-3 px-4 text-right font-sans">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {row.result}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};

import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  Layers,
  Plus,
  RefreshCw
} from 'lucide-react';
import { api } from '../../services/api';

interface SessionGroundTruthViewProps {
  onRefresh?: () => void;
}

export const SessionGroundTruthView: React.FC<SessionGroundTruthViewProps> = ({ onRefresh }) => {
  const [sessions, setSessions] = useState<any[]>([]);
  const [verifications, setVerifications] = useState<any[]>([]);
  const [exceptions, setExceptions] = useState<any[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [sesRes, verRes, excRes] = await Promise.allSettled([
        api.getSessions(),
        api.getHandheldVerificationHistory(),
        api.getExceptions()
      ]);
      if (sesRes.status === 'fulfilled') {
        const list = sesRes.value || [];
        setSessions(list);
        if (list.length > 0 && selectedSessionId === null) {
          setSelectedSessionId(list[0].id);
        }
      }
      if (verRes.status === 'fulfilled') setVerifications(verRes.value || []);
      if (excRes.status === 'fulfilled') setExceptions(excRes.value || []);
    } catch (err) {
      console.error('Error loading session ground truth data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateSession = async () => {
    setCreating(true);
    try {
      const created = await api.createSession({
        name: `Audit Session ${new Date().toLocaleTimeString()}`,
        description: 'Live 3-way reconciliation & handheld ground-truth audit',
        created_by: 'Supervisor'
      });
      await loadData();
      if (created?.id) setSelectedSessionId(created.id);
      onRefresh?.();
    } catch (err: any) {
      alert(`Failed to create session: ${err.message}`);
    } finally {
      setCreating(false);
    }
  };

  const currentSession = sessions.find((s) => s.id === selectedSessionId) || sessions[0] || null;

  // Build 3-way comparison ledger from live verifications and open exceptions
  const threeWayLedger = verifications.length > 0
    ? verifications.slice(0, 20).map((v: any) => ({
        epc: v.epc,
        expected: v.expected_shelf_code || '—',
        aiObserved: v.observed_shelf_code || 'Unread',
        groundTruth: v.actual_shelf_code || '—',
        result: v.verification_status || 'VERIFIED'
      }))
    : exceptions.slice(0, 20).map((e: any) => ({
        epc: e.epc,
        expected: e.expected_shelf_code || '—',
        aiObserved: e.observed_shelf_code || 'Unread',
        groundTruth: e.status === 'RESOLVED' ? (e.observed_shelf_code || e.expected_shelf_code) : 'Pending Scan',
        result: e.status || e.discrepancy_type
      }));

  const verifiedCount = verifications.length;
  const totalItems = exceptions.length + verifiedCount;
  const accuracyPct = totalItems > 0 ? Math.round((verifiedCount / totalItems) * 1000) / 10 : null;

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
            Compare expected WMS inventory against live antenna observations and physical handheld ground truth.
          </p>
        </div>

        <div className="flex items-center space-x-2 font-mono text-xs">
          <button
            onClick={loadData}
            className="p-2 border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600 transition cursor-pointer"
            title="Refresh Sessions"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleCreateSession}
            disabled={creating}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-sans font-semibold shadow-xs transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{creating ? 'Creating...' : '+ New Audit Session'}</span>
          </button>
        </div>
      </div>

      {/* Session Progress Hero Card */}
      {currentSession && (
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 border border-indigo-100 shadow-xs">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h4 className="font-bold text-slate-900 text-base font-mono">{currentSession.session_code || `SES-${currentSession.id}`}</h4>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase">
                  {currentSession.status || 'OPEN'}
                </span>
              </div>
              <p className="text-slate-500 text-xs mt-0.5">
                {currentSession.name} • {currentSession.created_at ? new Date(currentSession.created_at).toLocaleString() : 'Active'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-6 text-center">
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 min-w-[100px]">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Exceptions</span>
              <strong className="text-slate-900 font-mono text-base">{exceptions.length}</strong>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 min-w-[100px]">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Verified Scans</span>
              <strong className="text-blue-600 font-mono text-base">{verifiedCount}</strong>
            </div>
            <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200 min-w-[100px]">
              <span className="text-emerald-700 block text-[10px] uppercase font-bold">Verified Rate</span>
              <strong className="text-emerald-700 font-mono text-base">
                {accuracyPct !== null ? `${accuracyPct}%` : '—'}
              </strong>
            </div>
          </div>
        </div>
      )}

      {/* Sessions Table */}
      <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h4 className="font-bold text-slate-900 text-xs">Ground-Truth Audit Sessions</h4>
          <span className="text-slate-400 text-[11px] font-mono">{sessions.length} Sessions Recorded</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold text-[10px]">
              <tr>
                <th className="py-2.5 px-4">Session Code</th>
                <th className="py-2.5 px-4">Session Name</th>
                <th className="py-2.5 px-4">Created</th>
                <th className="py-2.5 px-4">Created By</th>
                <th className="py-2.5 px-4 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 font-mono">
              {sessions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center font-sans text-slate-400">
                    No audit sessions recorded yet. Click "+ New Audit Session" above to start one.
                  </td>
                </tr>
              ) : (
                sessions.map((ses) => (
                  <tr
                    key={ses.id}
                    onClick={() => setSelectedSessionId(ses.id)}
                    className={`hover:bg-slate-50 cursor-pointer transition ${
                      currentSession?.id === ses.id ? 'bg-indigo-50/50 font-bold' : ''
                    }`}
                  >
                    <td className="py-3 px-4 text-blue-600">{ses.session_code || `SES-${ses.id}`}</td>
                    <td className="py-3 px-4 font-sans text-slate-900">{ses.name}</td>
                    <td className="py-3 px-4 text-slate-500 font-sans">
                      {ses.created_at ? new Date(ses.created_at).toLocaleString() : '—'}
                    </td>
                    <td className="py-3 px-4 font-sans text-slate-600">{ses.created_by || 'System'}</td>
                    <td className="py-3 px-4 text-right font-sans">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase">
                        {ses.status || 'OPEN'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3-Way Reconciliation Comparison Ledger */}
      <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h4 className="font-bold text-slate-900 text-xs">3-Way Reconciliation Comparison Matrix</h4>
            <p className="text-[11px] text-slate-400">WMS Expected vs Live Antenna Observation vs Handheld Ground Truth</p>
          </div>
          <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
            Live Database Records ({threeWayLedger.length})
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold text-[10px]">
              <tr>
                <th className="py-2.5 px-4">Tag EPC</th>
                <th className="py-2.5 px-4">WMS Expected</th>
                <th className="py-2.5 px-4">Live Antenna Observed</th>
                <th className="py-2.5 px-4">Handheld Ground Truth</th>
                <th className="py-2.5 px-4 text-right">Status / Outcome</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 font-mono">
              {threeWayLedger.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center font-sans text-slate-400">
                    No discrepancies or ground-truth verifications recorded yet.
                  </td>
                </tr>
              ) : (
                threeWayLedger.map((row, idx) => (
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
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

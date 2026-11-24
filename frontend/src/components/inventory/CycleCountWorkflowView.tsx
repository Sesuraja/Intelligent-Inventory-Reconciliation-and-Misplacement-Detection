import React, { useState, useEffect } from 'react';
import {
  Boxes,
  Plus,
  Play,
  CheckCircle2,
  AlertTriangle,
  Clock,
  User,
  Barcode,
  Search,
  RefreshCw,
  Layers,
  ArrowRight
} from 'lucide-react';
import { api } from '../../services/api';

export const CycleCountWorkflowView: React.FC = () => {
  const [lists, setLists] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedList, setSelectedList] = useState<any | null>(null);
  const [timeBudget, setTimeBudget] = useState(30);
  const [generating, setGenerating] = useState(false);
  const [assignee, setAssignee] = useState('Jordan Lee (Operator)');
  const [scanInput, setScanInput] = useState('');
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);

  useEffect(() => {
    loadLists();
  }, []);

  const loadLists = async () => {
    setLoading(true);
    try {
      const data = await api.getCycleCounts();
      setLists(data || []);
      if (data && data.length > 0 && !selectedList) {
        setSelectedList(data[0]);
      }
    } catch (err) {
      console.warn('Failed to fetch cycle count lists', err);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const newList = await api.generateCycleCount({
        time_budget_minutes: timeBudget,
        created_by: 'Supervisor'
      });
      await loadLists();
      setSelectedList(newList);
    } catch (err: any) {
      alert(`Generation failed: ${err.message}`);
    } finally {
      setGenerating(false);
    }
  };

  const handleAssign = async (listId: string) => {
    try {
      const updated = await api.assignCycleCount(listId, assignee);
      setSelectedList(updated);
      await loadLists();
    } catch (err: any) {
      alert(`Assign failed: ${err.message}`);
    }
  };

  const handleRecordScan = async (taskId: string) => {
    if (!scanInput.trim()) return;
    const epcs = scanInput.split(',').map((s) => s.trim()).filter(Boolean);
    try {
      await api.scanCycleCountTask(taskId, epcs, assignee);
      setScanInput('');
      setActiveTaskId(null);
      // Reload current list
      if (selectedList) {
        const fresh = await api.getCycleCount(selectedList.id);
        setSelectedList(fresh);
      }
      await loadLists();
    } catch (err: any) {
      alert(`Scan submission failed: ${err.message}`);
    }
  };

  const handleCloseList = async (listId: string) => {
    if (!window.confirm('Close and seal this cycle count list? Variance summary will be generated.')) return;
    try {
      const closed = await api.closeCycleCount(listId, assignee);
      setSelectedList(closed);
      await loadLists();
    } catch (err: any) {
      alert(`Closure failed: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6 text-xs text-slate-800">
      
      {/* Banner */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Boxes className="w-5 h-5 text-indigo-600" />
            <h3 className="text-base font-bold text-slate-900">Prioritized Cycle Count Task Workflow</h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
              Model 4 Deterministic Scheduler
            </span>
          </div>
          <p className="text-slate-500 text-[11px] mt-1">
            Prioritize warehouse counts by discrepancy risk, item value, operational impact, and audit staleness.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5 text-xs text-slate-600">
            <span>Budget:</span>
            <select
              value={timeBudget}
              onChange={(e) => setTimeBudget(Number(e.target.value))}
              className="px-2 py-1 border border-slate-200 rounded-lg text-xs"
            >
              <option value={15}>15 mins</option>
              <option value={30}>30 mins</option>
              <option value={60}>60 mins</option>
            </select>
          </div>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition disabled:opacity-50"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{generating ? 'Generating...' : 'Generate New List'}</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Lists on Left, Detail on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: List History */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <span className="font-bold text-slate-800 text-xs">Count Lists ({lists.length})</span>
            <button onClick={loadLists} className="text-slate-400 hover:text-slate-600">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {lists.length === 0 ? (
              <p className="text-slate-400 py-6 text-center">No count lists generated yet.</p>
            ) : (
              lists.map((l) => (
                <div
                  key={l.id}
                  onClick={() => setSelectedList(l)}
                  className={`p-3 rounded-xl border cursor-pointer transition ${
                    selectedList?.id === l.id
                      ? 'bg-indigo-50/70 border-indigo-300'
                      : 'bg-slate-50/50 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-slate-800 font-mono text-[11px]">{l.id.slice(0, 8)}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                      l.status === 'completed'
                        ? 'bg-emerald-100 text-emerald-800'
                        : l.status === 'assigned'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}>
                      {l.status}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500 flex justify-between">
                    <span>{l.tasks?.length || 0} bins to count</span>
                    <span>{l.time_budget_minutes}m budget</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Column: Selected List Task Workflow */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
          {!selectedList ? (
            <div className="py-16 text-center text-slate-400">
              Select or generate a cycle count list to inspect bins and record scans.
            </div>
          ) : (
            <div className="space-y-4">
              
              {/* Header Info */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-2">
                <div>
                  <div className="flex items-center space-x-2">
                    <h4 className="font-bold text-slate-900 text-sm">List ID: {selectedList.id}</h4>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                      Status: {selectedList.status}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Assigned to: <span className="font-semibold text-slate-700">{selectedList.assigned_to || 'Unassigned'}</span>
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  {selectedList.status === 'draft' && (
                    <div className="flex items-center space-x-1.5">
                      <input
                        type="text"
                        value={assignee}
                        onChange={(e) => setAssignee(e.target.value)}
                        className="px-2 py-1 text-xs border border-slate-200 rounded-lg w-36"
                        placeholder="Assignee name"
                      />
                      <button
                        onClick={() => handleAssign(selectedList.id)}
                        className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs"
                      >
                        Assign
                      </button>
                    </div>
                  )}

                  {selectedList.status !== 'completed' && (
                    <button
                      onClick={() => handleCloseList(selectedList.id)}
                      className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs"
                    >
                      Close & Seal List
                    </button>
                  )}
                </div>
              </div>

              {/* Recommendation Banner */}
              {selectedList.summary?.top_5_bins_recommendation && (
                <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-1">
                  <div className="flex items-center space-x-1.5 text-indigo-900 font-bold text-xs">
                    <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Algorithmic Recommendation: Count these 5 bins first</span>
                  </div>
                  <p className="text-[11px] text-indigo-700">
                    Bins with highest expected variance recovery: {selectedList.summary.top_5_bins_recommendation.map((b: any) => b.shelf_code).join(', ')}
                  </p>
                </div>
              )}

              {/* Task Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 text-[10px] text-slate-500 uppercase border-b border-slate-200 font-bold">
                    <tr>
                      <th className="p-2.5">Shelf / Bin</th>
                      <th className="p-2.5">Risk Score</th>
                      <th className="p-2.5">Expected EPCs</th>
                      <th className="p-2.5">Scanned EPCs</th>
                      <th className="p-2.5">Variance</th>
                      <th className="p-2.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {selectedList.tasks?.map((t: any) => (
                      <tr key={t.id} className="hover:bg-slate-50/50">
                        <td className="p-2.5 font-bold font-mono text-slate-800">{t.bin_or_shelf}</td>
                        <td className="p-2.5 font-mono text-indigo-700 font-bold">{t.priority_score.toFixed(3)}</td>
                        <td className="p-2.5 text-slate-600 font-mono text-[10px]">{t.expected_epcs?.length || 0} tags</td>
                        <td className="p-2.5 text-slate-600 font-mono text-[10px]">{t.scanned_epcs?.length || 0} tags</td>
                        <td className="p-2.5">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                            t.variance_status === 'matched'
                              ? 'bg-emerald-100 text-emerald-800'
                              : t.variance_status === 'discrepant'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-slate-100 text-slate-600'
                          }`}>
                            {t.variance_status}
                          </span>
                        </td>
                        <td className="p-2.5 text-right">
                          {selectedList.status !== 'completed' && (
                            <button
                              onClick={() => {
                                setActiveTaskId(t.id);
                                setScanInput(t.expected_epcs ? t.expected_epcs.join(', ') : '');
                              }}
                              className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded text-[11px]"
                            >
                              Scan
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Inline Scan Entry Box */}
              {activeTaskId && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <div className="font-bold text-slate-800 text-xs flex justify-between">
                    <span>Record Handheld Barcode / RFID Scans:</span>
                    <button onClick={() => setActiveTaskId(null)} className="text-slate-400 hover:text-slate-600">Cancel</button>
                  </div>
                  <input
                    type="text"
                    value={scanInput}
                    onChange={(e) => setScanInput(e.target.value)}
                    placeholder="Enter comma-separated EPCs (e.g. EPC-1001, EPC-1002)..."
                    className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                  />
                  <div className="flex justify-end space-x-2">
                    <button
                      onClick={() => handleRecordScan(activeTaskId)}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs"
                    >
                      Submit Scanned Verification
                    </button>
                  </div>
                </div>
              )}

              {/* Closure Details */}
              {selectedList.summary?.closure && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1 text-emerald-900 text-xs">
                  <div className="font-bold flex items-center space-x-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Cycle Count Sealed & Audited</span>
                  </div>
                  <p>
                    Closed by: <span className="font-semibold">{selectedList.summary.closure.closed_by}</span> • Matched: {selectedList.summary.closure.matched_tasks} • Discrepant: {selectedList.summary.closure.discrepant_tasks}
                  </p>
                </div>
              )}

            </div>
          )}
        </div>

      </div>

    </div>
  );
};

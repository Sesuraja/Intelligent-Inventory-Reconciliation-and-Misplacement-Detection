import React, { useState, useEffect } from 'react';
import {
  Smartphone,
  Plus,
  Upload,
  CheckCircle2,
  Clock,
  Layers,
  Search,
  Radio,
  FileSpreadsheet,
  Battery,
  ShieldCheck,
  RotateCw
} from 'lucide-react';
import { api } from '../../services/api';
import { ShelfItem } from '../../types';
import { HandheldBatchModal } from '../exceptions/HandheldBatchModal';

interface HandheldScansViewProps {
  shelves: ShelfItem[];
  onRefresh?: () => void;
}

export const HandheldScansView: React.FC<HandheldScansViewProps> = ({
  shelves,
  onRefresh
}) => {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewSessionModal, setShowNewSessionModal] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);
  
  // New session form
  const [sessionCode, setSessionCode] = useState(`SCAN-00${Math.floor(Math.random() * 900 + 100)}`);
  const [selectedDevice, setSelectedDevice] = useState('HH-01 (Zebra RFD40 Mobile Sled)');
  const [selectedShelf, setSelectedShelf] = useState(shelves[0]?.shelf_code || 'SHELF_A');
  const [operatorName, setOperatorName] = useState('Marcus Vance (Warehouse Supervisor)');

  const devices = [
    { id: 'HH-01', name: 'HH-01 (Zebra RFD40 Mobile Sled)', type: 'eConn Sled', battery: '82%', status: 'Active', operator: 'Marcus Vance' },
    { id: 'HH-02', name: 'HH-02 (Chainway C72 Android)', type: 'All-in-One Gun', battery: '95%', status: 'Standby', operator: 'Elena Rostova' }
  ];

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    setLoading(true);
    try {
      const data = await api.getHandheldSessions();
      setSessions(data);
    } catch (err) {
      console.error('Error loading handheld sessions:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createHandheldSession({
        session_code: sessionCode,
        device_id: selectedDevice.split(' ')[0],
        shelf_code: selectedShelf,
        operator_name: operatorName
      });
      setShowNewSessionModal(false);
      setSessionCode(`SCAN-00${Math.floor(Math.random() * 900 + 100)}`);
      await loadSessions();
      onRefresh?.();
    } catch (err: any) {
      alert(`Error creating session: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6 text-xs text-slate-800">
      
      {/* Top Banner */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Smartphone className="w-5 h-5 text-indigo-600" />
            <h3 className="text-base font-bold text-slate-900">3.3 Handheld Mobile RFID Scans & Audits</h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
              Ground-Truth Verification Sleds
            </span>
          </div>
          <p className="text-slate-500 text-[11px] mt-1">
            Perform physical ground-truth sweeps using mobile Zebra & Chainway handheld readers to verify AI discrepancy hypotheses.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowBatchModal(true)}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold border border-slate-200 shadow-xs transition"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload CSV Batch</span>
          </button>
          
          <button
            onClick={() => setShowNewSessionModal(true)}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ New Scan Session</span>
          </button>
        </div>
      </div>

      {/* Handheld Device Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {devices.map((dev) => (
          <div key={dev.id} className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 border border-indigo-100 shadow-xs">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-slate-900 text-sm">{dev.id}</span>
                  <span className="text-[10px] px-2 py-0.2 rounded-full bg-slate-100 text-slate-700 font-semibold border border-slate-200">
                    {dev.type}
                  </span>
                </div>
                <p className="text-slate-500 text-[11px]">{dev.name}</p>
                <p className="text-slate-400 text-[10px] mt-0.5">Assigned: {dev.operator}</p>
              </div>
            </div>

            <div className="text-right space-y-1">
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                dev.status === 'Active'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-slate-100 text-slate-600 border-slate-200'
              }`}>
                {dev.status}
              </span>
              <div className="flex items-center justify-end space-x-1 text-slate-500 text-[11px] pt-1 font-mono">
                <Battery className="w-3.5 h-3.5 text-emerald-600" />
                <span>{dev.battery}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Scan Sessions History */}
      <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h4 className="font-bold text-slate-900 text-xs">Mobile Scan Sessions & Physical Audits</h4>
            <p className="text-[11px] text-slate-400">Audited physical sweeps for shelf-level ground truth</p>
          </div>
          <button
            onClick={loadSessions}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-50 transition"
            title="Reload"
          >
            <RotateCw className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                <th className="py-3 px-4">Session Code</th>
                <th className="py-3 px-4">Target Shelf / Bay</th>
                <th className="py-3 px-4">Handheld Device</th>
                <th className="py-3 px-4">Tags Scanned</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Operator</th>
                <th className="py-3 px-4 text-right">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-400">
                    Loading handheld scan sessions...
                  </td>
                </tr>
              ) : sessions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-400">
                    No handheld scan sessions recorded yet. Start a new session or upload a CSV scan batch.
                  </td>
                </tr>
              ) : (
                sessions.map((ses) => (
                  <tr key={ses.id} className="hover:bg-slate-50/80 transition font-mono">
                    <td className="py-3 px-4 font-bold text-slate-900">{ses.session_code}</td>
                    <td className="py-3 px-4 font-semibold text-blue-600">{ses.shelf_code}</td>
                    <td className="py-3 px-4 font-sans text-slate-600">{ses.device_id || 'HH-01 Zebra'}</td>
                    <td className="py-3 px-4 font-bold text-emerald-700">{ses.total_tags_scanned || 0} tags</td>
                    <td className="py-3 px-4 font-sans">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        ses.status === 'COMPLETED'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-blue-50 text-blue-700 border border-blue-200'
                      }`}>
                        {ses.status === 'COMPLETED' ? 'Completed' : 'In Progress'}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-sans text-slate-600">{ses.operator_name || 'Supervisor'}</td>
                    <td className="py-3 px-4 font-sans text-right text-slate-500 text-[11px]">
                      {new Date(ses.created_at).toLocaleTimeString([], { hour12: true, hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Session Modal */}
      {showNewSessionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-xs p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4 text-xs">
            <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
              <Smartphone className="w-5 h-5 text-indigo-600" />
              <span>Initiate Handheld Scan Session</span>
            </h3>
            <p className="text-slate-500 text-[11px]">
              Pair a mobile reader with a warehouse shelf to collect ground-truth RFID tags.
            </p>

            <form onSubmit={handleCreateSession} className="space-y-3 pt-1">
              <div>
                <label className="text-slate-700 font-semibold block mb-1">Session Code</label>
                <input
                  type="text"
                  value={sessionCode}
                  onChange={(e) => setSessionCode(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-mono focus:bg-white focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="text-slate-700 font-semibold block mb-1">Handheld Device</label>
                <select
                  value={selectedDevice}
                  onChange={(e) => setSelectedDevice(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:bg-white focus:outline-none"
                >
                  {devices.map((d) => (
                    <option key={d.id} value={d.name}>{d.name} ({d.battery})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-700 font-semibold block mb-1">Target Shelf / Bay</label>
                <select
                  value={selectedShelf}
                  onChange={(e) => setSelectedShelf(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:bg-white focus:outline-none"
                >
                  {shelves.map((s) => (
                    <option key={s.id} value={s.shelf_code}>{s.shelf_code} ({s.name || 'Shelf'})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-700 font-semibold block mb-1">Operator Name</label>
                <input
                  type="text"
                  value={operatorName}
                  onChange={(e) => setOperatorName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:bg-white focus:outline-none"
                  required
                />
              </div>

              <div className="pt-3 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowNewSessionModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-semibold hover:bg-slate-200 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 shadow-xs transition"
                >
                  Start Session
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CSV Batch Upload Modal */}
      <HandheldBatchModal
        isOpen={showBatchModal}
        onClose={() => setShowBatchModal(false)}
        onSuccess={() => {
          loadSessions();
          onRefresh?.();
        }}
      />

    </div>
  );
};

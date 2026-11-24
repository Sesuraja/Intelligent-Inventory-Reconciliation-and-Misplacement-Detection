import React, { useState, useEffect } from 'react';
import {
  Bell,
  AlertTriangle,
  Radio,
  CheckCircle2,
  Clock,
  Mail,
  Send,
  RefreshCw,
  Filter,
  Check,
  Moon,
  ShieldAlert
} from 'lucide-react';
import { api } from '../../services/api';

export const AlertsManagementView: React.FC = () => {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [actingId, setActingId] = useState<string | null>(null);

  useEffect(() => {
    loadAlerts();
  }, [statusFilter]);

  const loadAlerts = async () => {
    setLoading(true);
    try {
      const data = await api.getAlerts(statusFilter || undefined);
      setAlerts(data || []);
    } catch (err) {
      console.warn('Failed to load alerts', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAcknowledge = async (id: string) => {
    setActingId(id);
    try {
      await api.acknowledgeAlert(id, 'Warehouse Supervisor');
      await loadAlerts();
    } catch (err: any) {
      alert(`Acknowledge failed: ${err.message}`);
    } finally {
      setActingId(null);
    }
  };

  const handleSnooze = async (id: string, minutes: number) => {
    setActingId(id);
    try {
      await api.snoozeAlert(id, minutes);
      await loadAlerts();
    } catch (err: any) {
      alert(`Snooze failed: ${err.message}`);
    } finally {
      setActingId(null);
    }
  };

  const handleResolve = async (id: string) => {
    setActingId(id);
    try {
      await api.resolveAlert(id, 'Warehouse Supervisor');
      await loadAlerts();
    } catch (err: any) {
      alert(`Resolve failed: ${err.message}`);
    } finally {
      setActingId(null);
    }
  };

  return (
    <div className="space-y-6 text-xs text-slate-800">
      
      {/* Banner */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Bell className="w-5 h-5 text-indigo-600" />
            <h3 className="text-base font-bold text-slate-900">System Alerts & Fault Governance Module</h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
              Active Monitoring
            </span>
          </div>
          <p className="text-slate-500 text-[11px] mt-1">
            Real-time notifications for RFID reader power outages, high-confidence misplacements, data staleness, model drift, and failed ingestion jobs.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-xl"
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="acknowledged">Acknowledged</option>
            <option value="snoozed">Snoozed</option>
            <option value="resolved">Resolved</option>
          </select>
          <button
            onClick={loadAlerts}
            className="p-2 border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Alerts Feed */}
      <div className="space-y-3">
        {alerts.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-400">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
            <span>No alerts matching the selected filter. System health is nominal.</span>
          </div>
        ) : (
          alerts.map((al) => {
            const isActing = actingId === al.id;
            const isHigh = al.severity === 'high' || al.severity === 'critical';
            return (
              <div
                key={al.id}
                className={`bg-white border rounded-2xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 transition ${
                  isHigh ? 'border-rose-200 hover:border-rose-300' : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      isHigh ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {al.severity}
                    </span>
                    <span className="font-mono text-slate-500 text-[10px]">{al.alert_type}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                      Status: {al.status}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {new Date(al.created_at).toLocaleString()}
                    </span>
                  </div>

                  <h4 className="font-bold text-slate-900 text-sm">{al.title}</h4>
                  <p className="text-slate-600 text-xs">{al.description}</p>

                  <div className="flex flex-wrap items-center gap-2 pt-1 text-[10px] text-slate-500">
                    <span>Dispatched via:</span>
                    {al.channels?.map((ch: string) => (
                      <span key={ch} className="px-1.5 py-0.5 bg-slate-100 rounded text-slate-600 font-mono">
                        {ch}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center space-x-2 flex-shrink-0">
                  {al.status === 'active' && (
                    <>
                      <button
                        onClick={() => handleAcknowledge(al.id)}
                        disabled={isActing}
                        className="flex items-center space-x-1 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl font-bold transition disabled:opacity-50"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Acknowledge</span>
                      </button>
                      <button
                        onClick={() => handleSnooze(al.id, 30)}
                        disabled={isActing}
                        className="flex items-center space-x-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium transition disabled:opacity-50"
                      >
                        <Moon className="w-3.5 h-3.5" />
                        <span>Snooze 30m</span>
                      </button>
                    </>
                  )}

                  {al.status !== 'resolved' && (
                    <button
                      onClick={() => handleResolve(al.id)}
                      disabled={isActing}
                      className="flex items-center space-x-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Resolve</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

    </div>
  );
};

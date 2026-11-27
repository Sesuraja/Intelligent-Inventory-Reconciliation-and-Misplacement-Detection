import React, { useState, useEffect } from 'react';
import { Server, RefreshCw } from 'lucide-react';
import { api } from '../../services/api';
import { ReaderItem, AntennaItem } from '../../types';

export const ReaderPerformanceReportView: React.FC = () => {
  const [readers, setReaders] = useState<ReaderItem[]>([]);
  const [antennas, setAntennas] = useState<AntennaItem[]>([]);
  const [report, setReport] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);

  const loadData = () => {
    setLoading(true);
    Promise.allSettled([
      api.getReaders(),
      api.getAntennas(),
      api.getReaderPerformanceReport()
    ])
      .then(([rRes, aRes, repRes]) => {
        if (rRes.status === 'fulfilled') setReaders(rRes.value || []);
        if (aRes.status === 'fulfilled') setAntennas(aRes.value || []);
        if (repRes.status === 'fulfilled') setReport(repRes.value || null);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const hardwareUnits = [
    ...readers.map((r) => ({
      id: r.reader_code,
      type: r.model || r.name,
      detail: `${r.protocol || 'HTTP_GATEWAY'} • ${r.ip_address || 'Gateway'}`,
      eventsCount: report?.total_events_logged ?? '—',
      status: r.status || 'UNKNOWN'
    })),
    ...antennas.map((ant) => ({
      id: ant.antenna_code || `PORT-${ant.port_number}`,
      type: `Port ${ant.port_number} (${ant.shelf_code || 'Unmapped'})`,
      detail: `Tx ${ant.tx_power_dbm ?? 30} dBm • Gain ${ant.gain_dbi ?? 6} dBi`,
      eventsCount: report?.port_breakdown?.[String(ant.port_number)] ?? 'Live',
      status: ant.is_active ? 'ACTIVE' : 'STANDBY'
    }))
  ];

  return (
    <div className="space-y-6 text-xs text-slate-800">
      {/* Top Banner */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Server className="w-5 h-5 text-blue-600" />
            <h3 className="text-base font-bold text-slate-900">Fixed Reader & Antenna Performance Audit</h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
              Live Hardware Telemetry
            </span>
          </div>
          <p className="text-slate-500 text-[11px] mt-1">
            Real-time reader status, registered antenna ports, and recorded telemetry volume from the backend.
          </p>
        </div>

        <div className="flex items-center space-x-2 font-mono text-xs">
          <span className="font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
            {readers.filter((r) => r.status === 'ONLINE').length} / {readers.length} Readers Online
          </span>
          <button
            onClick={loadData}
            className="p-2 border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600 transition cursor-pointer"
            title="Refresh Hardware Audit"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Reader & Port Performance Table */}
      <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h4 className="font-bold text-slate-900 text-xs">Reader & Antenna Array Metrics</h4>
          <span className="text-[10px] font-mono text-slate-400">
            {antennas.length} Mounted Antennas • {report?.total_events_logged ?? 0} Total Events Logged
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold text-[10px]">
              <tr>
                <th className="py-3 px-4">Hardware Unit</th>
                <th className="py-3 px-4">Channel / Assignment</th>
                <th className="py-3 px-4">Configuration</th>
                <th className="py-3 px-4 text-center">Events / Activity</th>
                <th className="py-3 px-4 text-right">Health Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 font-mono">
              {hardwareUnits.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center font-sans text-slate-400">
                    No readers or antennas registered.
                  </td>
                </tr>
              ) : (
                hardwareUnits.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-4 font-bold text-slate-900">{u.id}</td>
                    <td className="py-3 px-4 font-sans text-slate-600">{u.type}</td>
                    <td className="py-3 px-4 text-slate-500">{u.detail}</td>
                    <td className="py-3 px-4 text-center font-bold text-blue-600">{u.eventsCount}</td>
                    <td className="py-3 px-4 text-right font-sans">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                        u.status === 'ONLINE' || u.status === 'ACTIVE'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}>
                        {u.status}
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

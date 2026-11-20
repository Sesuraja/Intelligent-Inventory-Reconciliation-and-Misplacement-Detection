import React from 'react';
import {
  Server,
  Radio,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Wifi,
  ShieldCheck
} from 'lucide-react';

export const ReaderPerformanceReportView: React.FC = () => {
  const hardwareUnits = [
    { id: 'RDR-01', type: 'Fixed Speedway R420', readRate: '1,400 tag/min', uptime: '99.7%', errors: 0, status: 'Online' },
    { id: 'ANT-01', type: 'Port 1 (Shelf A)', readRate: '520 tag/min', uptime: '99.8%', errors: 0, status: 'Online' },
    { id: 'ANT-02', type: 'Port 2 (Shelf B)', readRate: '460 tag/min', uptime: '99.6%', errors: 1, status: 'Online' },
    { id: 'ANT-03', type: 'Port 3 (Shelf C)', readRate: '480 tag/min', uptime: '99.7%', errors: 0, status: 'Online' },
    { id: 'ANT-04', type: 'Port 4 (Shelf D)', readRate: '410 tag/min', uptime: '99.9%', errors: 0, status: 'Online' },
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
              Hardware Telemetry Audit
            </span>
          </div>
          <p className="text-slate-500 text-[11px] mt-1">
            Throughput velocity, uptime reliability, packet drops, and error rates across all fixed UHF reader ports.
          </p>
        </div>

        <div className="flex items-center space-x-2 font-mono text-xs">
          <span className="text-slate-500">System Availability:</span>
          <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
            99.7% SLA Satisfied
          </span>
        </div>
      </div>

      {/* Reader & Port Performance Table */}
      <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h4 className="font-bold text-slate-900 text-xs">Reader Array Performance Metrics</h4>
          <span className="text-[10px] font-mono text-slate-400">LLRP Port Matrix 5084</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold text-[10px]">
              <tr>
                <th className="py-3 px-4">Hardware Unit</th>
                <th className="py-3 px-4">Channel / Port</th>
                <th className="py-3 px-4 text-center">Read Rate (tag/min)</th>
                <th className="py-3 px-4 text-center">Uptime SLA</th>
                <th className="py-3 px-4 text-center">Packet Errors</th>
                <th className="py-3 px-4 text-right">Health Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 font-mono">
              {hardwareUnits.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50/80 transition">
                  <td className="py-3 px-4 font-bold text-slate-900">{u.id}</td>
                  <td className="py-3 px-4 font-sans text-slate-600">{u.type}</td>
                  <td className="py-3 px-4 text-center font-bold text-blue-600">{u.readRate}</td>
                  <td className="py-3 px-4 text-center font-bold text-emerald-600">{u.uptime}</td>
                  <td className="py-3 px-4 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] ${u.errors === 0 ? 'bg-slate-100 text-slate-600' : 'bg-amber-100 text-amber-800 font-bold'}`}>
                      {u.errors}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-sans">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {u.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="py-3 px-4 border-t border-slate-200/80 bg-slate-50/50 flex justify-between items-center text-xs text-slate-500">
          <span>Mean Reader Ingestion Latency: 4.8ms • Zero TCP socket disconnects in last 24h</span>
          <span className="font-mono text-emerald-700 font-semibold">Port Sweep Frequency: 50 Hz</span>
        </div>
      </div>

    </div>
  );
};

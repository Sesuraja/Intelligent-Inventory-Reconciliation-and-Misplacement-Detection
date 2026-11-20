import React, { useState } from 'react';
import {
  Layers,
  Search,
  Download,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  RotateCw
} from 'lucide-react';
import { StatusBadge } from '../common/StatusBadge';

interface InventoryReconciliationReportViewProps {
  reconciliationRows: any[];
  accuracyStats: any;
  loading: boolean;
  onRefresh: () => void;
}

export const InventoryReconciliationReportView: React.FC<InventoryReconciliationReportViewProps> = ({
  reconciliationRows,
  accuracyStats,
  loading,
  onRefresh
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [timeRange, setTimeRange] = useState('Last 7 Days');

  const filteredRows = reconciliationRows.filter((r) =>
    r.epc?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.product_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const dates = ['Nov 9', 'Nov 11', 'Nov 13', 'Nov 15', 'Nov 17', 'Nov 19'];
  const expectedPoints = [1240, 1242, 1245, 1246, 1248, 1248];
  const observedPoints = [1210, 1215, 1218, 1220, 1221, 1222];

  // SVG Y coords (scale 1180 to 1260 -> Y 180 to 20)
  const toY = (val: number) => {
    const minVal = 1180;
    const maxVal = 1260;
    const ratio = (val - minVal) / (maxVal - minVal);
    return 180 - ratio * 160;
  };

  const toLinePoints = (data: number[]) => {
    return data.map((d, i) => `${40 + i * 90},${toY(d)}`).join(' ');
  };

  return (
    <div className="space-y-6 text-xs text-slate-800">
      
      {/* Top Banner */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Layers className="w-5 h-5 text-blue-600" />
            <h3 className="text-base font-bold text-slate-900">5.1 Inventory Reconciliation Ledger</h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
              Autonomous Discrepancy Reconciliation
            </span>
          </div>
          <p className="text-slate-500 text-[11px] mt-1">
            Historical audit trail of WMS expected states versus physical UHF RFID telemetry observations and ground-truth resolutions.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-700 focus:outline-none"
          >
            <option>Last 7 Days</option>
            <option>Last 30 Days</option>
            <option>This Quarter</option>
          </select>
          <button
            onClick={onRefresh}
            className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-xl transition"
            title="Refresh"
          >
            <RotateCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* KPI Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs">
          <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider block">Expected Stock</span>
          <div className="text-2xl font-bold font-mono text-slate-900 mt-1">1,248</div>
          <span className="text-[11px] text-slate-500 mt-0.5 block">WMS active registered SKUs</span>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs">
          <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider block">Observed Tags</span>
          <div className="text-2xl font-bold font-mono text-blue-600 mt-1">1,222</div>
          <span className="text-[11px] text-slate-500 mt-0.5 block">Active sweeps across 4 antenna ports</span>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs">
          <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider block">Reconciliation Rate</span>
          <div className="text-2xl font-bold font-mono text-emerald-600 mt-1">97.9%</div>
          <span className="text-[11px] text-emerald-700 mt-0.5 block">Target &gt; 95.0% SLA Satisfied</span>
        </div>
      </div>

      {/* Time-Series Line Chart */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-bold text-slate-900 text-sm">Inventory Reconciliation Trend (Expected vs Observed)</h4>
            <p className="text-[11px] text-slate-400">Daily telemetry reconciliation curve</p>
          </div>
          <div className="flex items-center space-x-4 text-[11px] font-mono">
            <div className="flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
              <span>Expected Stock</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
              <span>Observed Tags</span>
            </div>
          </div>
        </div>

        <div className="w-full bg-slate-50/70 border border-slate-200 rounded-xl p-4">
          <svg viewBox="0 0 540 200" className="w-full h-48">
            {/* Grid lines */}
            {[1260, 1240, 1220, 1200, 1180].map((val) => (
              <g key={val}>
                <line x1="40" y1={toY(val)} x2="510" y2={toY(val)} stroke="#e2e8f0" strokeDasharray="3 3" strokeWidth="1" />
                <text x="35" y={toY(val) + 3} textAnchor="end" className="text-[9px] fill-slate-400 font-mono">{val}</text>
              </g>
            ))}

            {/* X Labels */}
            {dates.map((d, i) => (
              <text key={d} x={40 + i * 90} y="195" textAnchor="middle" className="text-[9px] fill-slate-400 font-mono">{d}</text>
            ))}

            {/* Expected Line */}
            <polyline fill="none" stroke="#94a3b8" strokeDasharray="4 4" strokeWidth="2" points={toLinePoints(expectedPoints)} />

            {/* Observed Line */}
            <polyline fill="none" stroke="#2563eb" strokeWidth="2.5" points={toLinePoints(observedPoints)} />

            {/* Observed Dots */}
            {observedPoints.map((d, i) => (
              <circle key={i} cx={40 + i * 90} cy={toY(d)} r="3.5" fill="#2563eb" />
            ))}
          </svg>
        </div>
      </div>

      {/* Reconciliation Records Table */}
      <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 sm:max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
            <input
              type="text"
              placeholder="Search by EPC, SKU or product..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200/90 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none"
            />
          </div>
          <span className="text-xs text-slate-500 font-mono">{filteredRows.length} items logged</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                <th className="py-3 px-4">Tag EPC</th>
                <th className="py-3 px-4">Master SKU</th>
                <th className="py-3 px-4">Product Name</th>
                <th className="py-3 px-4">Expected Shelf</th>
                <th className="py-3 px-4">Observed Shelf</th>
                <th className="py-3 px-4">Reconciliation Status</th>
                <th className="py-3 px-4 text-right">Confidence</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredRows.slice(0, 15).map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-50/80 transition">
                  <td className="py-2.5 px-4 font-mono font-bold text-slate-900">{row.epc}</td>
                  <td className="py-2.5 px-4 font-mono text-slate-600">{row.sku}</td>
                  <td className="py-2.5 px-4 font-medium text-slate-900">{row.product_name}</td>
                  <td className="py-2.5 px-4 font-mono font-bold text-blue-600">{row.expected_shelf_code}</td>
                  <td className="py-2.5 px-4 font-mono font-bold text-slate-800">{row.observed_shelf_code || 'Unread'}</td>
                  <td className="py-2.5 px-4">
                    <StatusBadge status={row.status} />
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900">
                    {Math.round((row.confidence || 0.95) * 100)}%
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

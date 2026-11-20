import React, { useState } from 'react';
import {
  TrendingUp,
  ShieldCheck,
  AlertTriangle,
  Boxes,
  Calendar,
  Layers,
  BarChart2
} from 'lucide-react';

export const CycleCountForecastView: React.FC = () => {
  const [selectedSku, setSelectedSku] = useState('SKU-1001');

  const riskBins = [
    { bin: 'Bin A-01-03', shelf: 'Shelf A', risk: 0.92, level: 'High', reason: 'High velocity mismatch + RF shadow', recommendedAction: 'Priority physical audit' },
    { bin: 'Bin B-01-01', shelf: 'Shelf B', risk: 0.87, level: 'High', reason: 'Repeated unread telemetry', recommendedAction: 'Sweep with HH-01' },
    { bin: 'Bin C-01-02', shelf: 'Shelf C', risk: 0.61, level: 'Medium', reason: 'Adjacent cross-talk anomaly', recommendedAction: 'Scheduled cycle count' },
    { bin: 'Bin D-02-04', shelf: 'Shelf D', risk: 0.24, level: 'Low', reason: 'Stable RF signal signature', recommendedAction: 'Normal inspection' },
  ];

  const forecastDays = [
    { day: 'D1', val: 24, high: 28, low: 20 },
    { day: 'D2', val: 32, high: 38, low: 27 },
    { day: 'D3', val: 40, high: 47, low: 34 },
    { day: 'D4', val: 38, high: 45, low: 31 },
    { day: 'D5', val: 48, high: 56, low: 41 },
    { day: 'D6', val: 55, high: 65, low: 46 },
    { day: 'D7', val: 62, high: 74, low: 52 },
  ];

  // Convert demand val (0 to 80) to SVG Y (160 to 20)
  const toY = (val: number) => {
    return 160 - (val / 80) * 140;
  };

  return (
    <div className="space-y-6 text-xs text-slate-800">
      
      {/* Top Banner */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <TrendingUp className="w-5 h-5 text-indigo-600" />
            <h3 className="text-base font-bold text-slate-900">Risk-Ranked Cycle Counting & Demand Forecast</h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
              Autonomous Audit Optimization
            </span>
          </div>
          <p className="text-slate-500 text-[11px] mt-1">
            Prioritize warehouse audit sweeps based on discrepancy probability and forecast 7-day outbound stock depletion.
          </p>
        </div>
      </div>

      {/* Main Grid: Risk-Ranked Bins & 7-Day Forecast */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Left: Risk-Ranked Bins */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-slate-900 text-sm">Risk-Ranked Bins (Audit Priority)</h4>
            <span className="text-[10px] font-mono text-slate-400">Bay Risk Index Score</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold text-[10px]">
                <tr>
                  <th className="py-2.5 px-3">Warehouse Bin</th>
                  <th className="py-2.5 px-3">Physical Shelf</th>
                  <th className="py-2.5 px-3 text-center">Risk Score</th>
                  <th className="py-2.5 px-3 text-right">Priority</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 font-mono">
                {riskBins.map((b) => (
                  <tr key={b.bin} className="hover:bg-slate-50 transition">
                    <td className="py-2.5 px-3 font-bold text-slate-900">{b.bin}</td>
                    <td className="py-2.5 px-3 font-sans text-slate-600">{b.shelf}</td>
                    <td className="py-2.5 px-3 text-center font-bold text-amber-600">{b.risk.toFixed(2)}</td>
                    <td className="py-2.5 px-3 text-right font-sans">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        b.level === 'High'
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : b.level === 'Medium'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}>
                        {b.level}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-500">
            High risk bins recommend immediate physical sweep with handheld scanner to prevent stockouts.
          </div>
        </div>

        {/* Right: 7-Day Demand Forecast */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-bold text-slate-900 text-sm">7-Day Demand Forecast ({selectedSku})</h4>
              <p className="text-[11px] text-slate-400">Predicted outbound pick volume</p>
            </div>
            <select
              value={selectedSku}
              onChange={(e) => setSelectedSku(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-700 font-mono focus:outline-none"
            >
              <option value="SKU-1001">SKU-1001 (Microcontroller)</option>
              <option value="SKU-1002">SKU-1002 (Sensor Module)</option>
              <option value="SKU-1003">SKU-1003 (Relay Shield)</option>
            </select>
          </div>

          <div className="w-full bg-slate-50/70 border border-slate-200 rounded-xl p-4">
            <svg viewBox="0 0 450 180" className="w-full h-44">
              {/* Grid lines */}
              {[80, 60, 40, 20].map((v) => (
                <g key={v}>
                  <line x1="30" y1={toY(v)} x2="420" y2={toY(v)} stroke="#e2e8f0" strokeDasharray="3 3" strokeWidth="1" />
                  <text x="25" y={toY(v) + 3} textAnchor="end" className="text-[9px] fill-slate-400 font-mono">{v}</text>
                </g>
              ))}

              {/* Day Labels & Bars */}
              {forecastDays.map((d, i) => {
                const x = 50 + i * 55;
                const y = toY(d.val);
                const height = 160 - y;
                return (
                  <g key={d.day}>
                    {/* Bar */}
                    <rect
                      x={x - 12}
                      y={y}
                      width="24"
                      height={height}
                      rx="4"
                      fill="#3b82f6"
                      className="hover:fill-blue-700 transition"
                    />
                    <text x={x} y="174" textAnchor="middle" className="text-[9px] fill-slate-500 font-mono">{d.day}</text>
                    <text x={x} y={y - 4} textAnchor="middle" className="text-[9px] fill-blue-600 font-mono font-bold">{d.val}</text>
                  </g>
                );
              })}
            </svg>
          </div>

          <div className="pt-2 text-[11px] text-slate-500 flex justify-between">
            <span>Peak demand expected on D6/D7 (Weekend replenishment wave)</span>
            <span className="font-mono text-emerald-700 font-bold">Safety Stock: 20 units</span>
          </div>
        </div>

      </div>

    </div>
  );
};

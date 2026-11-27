import React, { useState, useEffect } from 'react';
import { TrendingUp, RefreshCw } from 'lucide-react';
import { api } from '../../services/api';
import { ProductItem } from '../../types';

export const CycleCountForecastView: React.FC = () => {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [selectedSku, setSelectedSku] = useState('');
  const [riskRows, setRiskRows] = useState<any[]>([]);
  const [forecasts, setForecasts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const [prodRes, riskRes, fcRes] = await Promise.allSettled([
        api.getProducts(),
        api.getCycleCountingPriorities(),
        api.getDemandForecast()
      ]);
      if (prodRes.status === 'fulfilled') {
        const list = prodRes.value || [];
        setProducts(list);
        if (list.length > 0 && !selectedSku) {
          setSelectedSku(list[0].sku);
        }
      }
      if (riskRes.status === 'fulfilled') setRiskRows(riskRes.value || []);
      if (fcRes.status === 'fulfilled') setForecasts(fcRes.value || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const activeForecast = forecasts.find((f: any) => f.sku === selectedSku) || forecasts[0] || null;
  const forecastPoints: Array<{ day: string; val: number }> = activeForecast?.daily_forecast
    ? activeForecast.daily_forecast.map((d: any, idx: number) => ({
        day: d.date || `D${idx + 1}`,
        val: Number(d.predicted_demand ?? d.quantity ?? 0)
      }))
    : [];

  const maxVal = Math.max(10, ...forecastPoints.map((p) => p.val));
  const toY = (val: number) => 160 - (val / maxVal) * 130;

  return (
    <div className="space-y-6 text-xs text-slate-800">
      {/* Top Banner */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <TrendingUp className="w-5 h-5 text-indigo-600" />
            <h3 className="text-base font-bold text-slate-900">Risk-Ranked Cycle Counting & Demand Forecast</h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
              Live Priority Engine
            </span>
          </div>
          <p className="text-slate-500 text-[11px] mt-1">
            Prioritize warehouse audit sweeps from live discrepancy risk scores and demand forecast endpoints.
          </p>
        </div>

        <button
          onClick={loadData}
          className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold transition cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Main Grid: Risk-Ranked Shelves & Demand Forecast */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Risk-Ranked Shelves */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-slate-900 text-sm">Risk-Ranked Locations (Audit Priority)</h4>
            <span className="text-[10px] font-mono text-slate-400">{riskRows.length} Locations Scored</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold text-[10px]">
                <tr>
                  <th className="py-2.5 px-3">Shelf / Location</th>
                  <th className="py-2.5 px-3">Reason</th>
                  <th className="py-2.5 px-3 text-center">Risk Score</th>
                  <th className="py-2.5 px-3 text-right">Priority</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 font-mono">
                {riskRows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center font-sans text-slate-400">
                      No risk-ranked cycle count targets available.
                    </td>
                  </tr>
                ) : (
                  riskRows.map((b: any, idx: number) => {
                    const score = Number(b.risk_score ?? b.priority_score ?? 0);
                    const level = score >= 0.7 ? 'High' : score >= 0.4 ? 'Medium' : 'Low';
                    return (
                      <tr key={b.shelf_code || idx} className="hover:bg-slate-50 transition">
                        <td className="py-2.5 px-3 font-bold text-slate-900">{b.shelf_code || b.location || '—'}</td>
                        <td className="py-2.5 px-3 font-sans text-slate-600">{b.reason || b.recommended_action || 'Live telemetry risk'}</td>
                        <td className="py-2.5 px-3 text-center font-bold text-amber-600">{score.toFixed(2)}</td>
                        <td className="py-2.5 px-3 text-right font-sans">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            level === 'High'
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : level === 'Medium'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}>
                            {b.priority || level}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: 7-Day Demand Forecast */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-bold text-slate-900 text-sm">Demand Forecast ({selectedSku || 'All SKUs'})</h4>
              <p className="text-[11px] text-slate-400">From /api/v1/ai/demand-forecast</p>
            </div>
            <select
              value={selectedSku}
              onChange={(e) => setSelectedSku(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-700 font-mono focus:outline-none"
            >
              {products.length === 0 ? (
                <option value="">No Products</option>
              ) : (
                products.map((p) => (
                  <option key={p.id} value={p.sku}>
                    {p.sku} ({p.name})
                  </option>
                ))
              )}
            </select>
          </div>

          {forecastPoints.length > 0 ? (
            <div className="w-full bg-slate-50/70 border border-slate-200 rounded-xl p-4">
              <svg viewBox="0 0 460 180" className="w-full h-44">
                <polyline
                  fill="none"
                  stroke="#4f46e5"
                  strokeWidth="2.5"
                  points={forecastPoints
                    .map((d, i) => `${30 + (i * 400) / Math.max(1, forecastPoints.length - 1)},${toY(d.val)}`)
                    .join(' ')}
                />
                {forecastPoints.map((d, i) => {
                  const x = 30 + (i * 400) / Math.max(1, forecastPoints.length - 1);
                  return (
                    <g key={d.day}>
                      <circle cx={x} cy={toY(d.val)} r="4" fill="#4f46e5" stroke="#fff" strokeWidth="1.5" />
                      <text x={x} y="175" textAnchor="middle" className="text-[9px] fill-slate-500 font-mono">
                        {d.day}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          ) : (
            <div className="p-8 bg-slate-50 border border-slate-200 rounded-xl text-center text-slate-400">
              {activeForecast
                ? `Predicted 7-day demand for ${activeForecast.sku}: ${activeForecast.predicted_demand ?? activeForecast.forecasted_units ?? 0} units.`
                : 'No historical outbound movement data available to compute a forecast yet.'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

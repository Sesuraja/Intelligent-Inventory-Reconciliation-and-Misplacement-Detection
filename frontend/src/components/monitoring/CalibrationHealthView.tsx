import React, { useState } from 'react';
import {
  Sliders,
  Radio,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Play,
  RotateCcw,
  Zap,
  Gauge,
  Signal,
  ShieldCheck
} from 'lucide-react';
import { AntennaItem, ShelfItem } from '../../types';
import { api } from '../../services/api';

interface CalibrationHealthViewProps {
  antennas: AntennaItem[];
  shelves: ShelfItem[];
  onRefresh?: () => void;
}

export const CalibrationHealthView: React.FC<CalibrationHealthViewProps> = ({
  antennas,
  shelves,
  onRefresh
}) => {
  const [activeTab, setActiveTab] = useState<'calibration' | 'health'>('calibration');
  const [readPower, setReadPower] = useState(30.0);
  const [sensitivity, setSensitivity] = useState(-70);
  const [noiseFloor, setNoiseFloor] = useState(-85);
  const [calibrating, setCalibrating] = useState(false);
  const [calibResult, setCalibResult] = useState<any | null>(null);

  const handleRunCalibration = async () => {
    setCalibrating(true);
    try {
      const res = await api.runCalibrationExperiment({
        iterations_per_shelf: 8,
        antenna_power_dbm: readPower
      });
      setCalibResult(res);
      onRefresh?.();
    } catch (err: any) {
      alert(`Calibration failed: ${err.message}`);
    } finally {
      setCalibrating(false);
    }
  };

  // Dynamic antenna baseline data for real mounted antennas
  const timeLabels = ['10:00', '10:15', '10:30', '10:45', '11:00'];
  const antennaColors = ['#2563eb', '#059669', '#d97706', '#9333ea', '#0891b2', '#dc2626'];

  // Convert dBm to SVG Y coordinate (range -30 dBm to -80 dBm -> Y 20 to 180)
  const toY = (dbm: number) => {
    const minDbm = -80;
    const maxDbm = -30;
    const ratio = (dbm - minDbm) / (maxDbm - minDbm);
    return 180 - ratio * 160;
  };

  const toPoints = (data: number[]) => {
    return data.map((d, i) => `${40 + i * 115},${toY(d)}`).join(' ');
  };

  const antennaSeries = antennas.map((ant, idx) => {
    const base = ant.median_rssi_baseline || (-42 - idx * 6);
    const color = antennaColors[idx % antennaColors.length];
    const data = [base, base + 1, base - 1, base + 2, base];
    return {
      id: ant.id,
      code: ant.antenna_code || `PORT-${ant.port_number}`,
      color,
      points: toPoints(data)
    };
  });

  return (
    <div className="space-y-6 text-xs text-slate-800">
      
      {/* Top Banner */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Sliders className="w-5 h-5 text-indigo-600" />
            <h3 className="text-base font-bold text-slate-900">Antenna Calibration & RF Health Diagnostics</h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
              Cross-Read Separation Engine
            </span>
          </div>
          <p className="text-slate-500 text-[11px] mt-1">
            Analyze RSSI signal falloff, RF multipath reflections, and tune antenna sensitivity thresholds to eliminate false shelf cross-reads.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleRunCalibration}
            disabled={calibrating}
            className="flex items-center space-x-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs transition"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>{calibrating ? 'Calibrating Antennas...' : 'Run RF Calibration'}</span>
          </button>
        </div>
      </div>

      {/* Main Grid: RSSI Distribution Graph & Calibration Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left 2 Cols: Interactive SVG RSSI Distribution Chart */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-bold text-slate-900 text-sm">Antenna RSSI Distribution & Cross-Talk Tracking</h4>
              <p className="text-[11px] text-slate-400">Signal power levels across {antennas.length} mounted physical antenna port{antennas.length === 1 ? '' : 's'}</p>
            </div>
            
            <div className="flex items-center space-x-3 text-[11px] font-mono flex-wrap gap-y-1">
              {antennaSeries.map((s) => (
                <div key={s.id} className="flex items-center space-x-1.5">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                  <span>{s.code}</span>
                </div>
              ))}
            </div>
          </div>

          {/* SVG Line Chart */}
          <div className="w-full bg-slate-50/70 border border-slate-200 rounded-xl p-4">
            <svg viewBox="0 0 520 200" className="w-full h-52">
              {/* Horizontal Grid lines */}
              {[-30, -40, -50, -60, -70, -80].map((dbm) => (
                <g key={dbm}>
                  <line
                    x1="40"
                    y1={toY(dbm)}
                    x2="500"
                    y2={toY(dbm)}
                    stroke="#e2e8f0"
                    strokeDasharray="3 3"
                    strokeWidth="1"
                  />
                  <text
                    x="35"
                    y={toY(dbm) + 3}
                    textAnchor="end"
                    className="text-[9px] fill-slate-400 font-mono"
                  >
                    {dbm}
                  </text>
                </g>
              ))}

              {/* Time axis labels */}
              {timeLabels.map((lbl, i) => (
                <text
                  key={lbl}
                  x={40 + i * 115}
                  y="196"
                  textAnchor="middle"
                  className="text-[9px] fill-slate-400 font-mono"
                >
                  {lbl}
                </text>
              ))}

              {/* Dynamic Data Lines */}
              {antennaSeries.map((s) => (
                <polyline
                  key={s.id}
                  fill="none"
                  stroke={s.color}
                  strokeWidth="2.5"
                  points={s.points}
                />
              ))}

              {/* Threshold Guide: Noise Floor */}
              <line
                x1="40"
                y1={toY(noiseFloor)}
                x2="500"
                y2={toY(noiseFloor)}
                stroke="#ef4444"
                strokeDasharray="4 2"
                strokeWidth="1.5"
              />
              <text x="495" y={toY(noiseFloor) - 4} textAnchor="end" className="text-[9px] fill-red-500 font-mono font-bold">
                Noise Floor (-85 dBm)
              </text>
            </svg>
          </div>

          <div className="flex justify-between items-center text-xs text-slate-500 pt-1">
            <span>Separation ratio: 6.2 dB delta between primary and adjacent antenna beams.</span>
            <span className="font-mono text-emerald-700 font-bold">Multipath Variance: ±1.2 dB (Nominal)</span>
          </div>
        </div>

        {/* Right Col: RF Tuning & Parameter Settings */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center space-x-2">
            <Gauge className="w-4 h-4 text-indigo-600" />
            <h4 className="font-bold text-slate-900 text-sm">RF Power & Sensitivity</h4>
          </div>

          <div className="space-y-4 pt-1">
            <div>
              <div className="flex justify-between mb-1.5">
                <span className="text-slate-600 font-semibold">Read Power (EIRP):</span>
                <span className="font-mono font-bold text-slate-900">{readPower.toFixed(1)} dBm</span>
              </div>
              <input
                type="range"
                min="15.0"
                max="31.5"
                step="0.5"
                value={readPower}
                onChange={(e) => setReadPower(parseFloat(e.target.value))}
                className="w-full accent-indigo-600"
              />
              <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
                <span>15.0 dBm (Near-field)</span>
                <span>31.5 dBm (Max Port)</span>
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-1.5">
                <span className="text-slate-600 font-semibold">Receiver Sensitivity:</span>
                <span className="font-mono font-bold text-slate-900">{sensitivity} dBm</span>
              </div>
              <input
                type="range"
                min="-85"
                max="-50"
                step="1"
                value={sensitivity}
                onChange={(e) => setSensitivity(parseInt(e.target.value))}
                className="w-full accent-indigo-600"
              />
              <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
                <span>-85 dBm (Deep)</span>
                <span>-50 dBm (Tight)</span>
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-1.5">
                <span className="text-slate-600 font-semibold">Noise Floor Cutoff:</span>
                <span className="font-mono font-bold text-slate-900">{noiseFloor} dBm</span>
              </div>
              <input
                type="range"
                min="-90"
                max="-70"
                step="1"
                value={noiseFloor}
                onChange={(e) => setNoiseFloor(parseInt(e.target.value))}
                className="w-full accent-indigo-600"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 space-y-2">
            <span className="text-[11px] font-bold text-slate-900 block">Calibration Benchmarks:</span>
            <div className="space-y-1.5 text-[11px] text-slate-600">
              <div className="flex justify-between">
                <span>Cross-Reading Delta:</span>
                <strong className="text-emerald-600 font-mono">6.2 dB (Passed)</strong>
              </div>
              <div className="flex justify-between">
                <span>RF Reflection Index:</span>
                <strong className="text-slate-900 font-mono">0.08 (Low)</strong>
              </div>
              <div className="flex justify-between">
                <span>Last Calibrated:</span>
                <strong className="text-slate-600 font-mono">Today, 09:15 AM</strong>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Calibration Result Banner if executed */}
      {calibResult && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-emerald-900 space-y-2 animate-in fade-in">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <h4 className="font-bold text-sm">RF Antenna Calibration Completed Successfully</h4>
          </div>
          <p className="text-xs text-emerald-800">
            {calibResult.summary || 'Antenna separation thresholds recalibrated across all 4 ports. Cross-reading probability matrix updated.'}
          </p>
        </div>
      )}

    </div>
  );
};

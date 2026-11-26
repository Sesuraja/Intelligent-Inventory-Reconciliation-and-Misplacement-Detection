import React, { useState, useEffect } from 'react';
import {
  Radio,
  Sliders,
  Activity,
  Layers,
  Zap,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Edit2,
  Signal,
  Trash2
} from 'lucide-react';
import { AntennaItem, ShelfItem, RFIDEvent } from '../../types';
import { api } from '../../services/api';

interface AntennaStatusViewProps {
  antennas: AntennaItem[];
  shelves: ShelfItem[];
  liveEvents?: RFIDEvent[];
  onConfigureAntenna: (port: number) => void;
  onDeleteAntenna?: (antennaId: number) => void;
  onRefresh: () => void;
}

export const AntennaStatusView: React.FC<AntennaStatusViewProps> = ({
  antennas,
  shelves,
  liveEvents = [],
  onConfigureAntenna,
  onDeleteAntenna,
  onRefresh
}) => {
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  // Automatically update antenna status and live telemetry every 5 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      onRefresh();
      setLastRefreshed(new Date());
    }, 5000);
    return () => clearInterval(timer);
  }, [onRefresh]);
  return (
    <div className="space-y-6 text-xs text-slate-800">
      {/* Top Banner */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Radio className="w-5 h-5 text-emerald-600" />
            <h3 className="text-base font-bold text-slate-900">Overhead UHF Antenna Array Matrix</h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono">
              {antennas.length > 0 ? `${antennas.length}-PORT PHASED ARRAY` : '0 PORTS DETECTED'}
            </span>
            <span className="flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
              <span>AUTO-UPDATING EVERY 5S</span>
            </span>
            <span className="text-[11px] text-slate-400 font-mono hidden sm:inline">
              Synced: {lastRefreshed.toLocaleTimeString()}
            </span>
          </div>
          <p className="text-slate-500 text-xs mt-1">
            Physical RF antenna array coverage, transmit power (dBm), noise floor, and zone mapping across warehouse shelves.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={onRefresh}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold transition cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh Antennas</span>
          </button>
        </div>
      </div>

      {/* Antenna Cards Grid */}
      {antennas.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-3">
          <Radio className="w-10 h-10 text-slate-300 mx-auto" />
          <h4 className="font-bold text-slate-700 text-sm">No Antennas Connected</h4>
          <p className="text-slate-500 text-xs max-w-md mx-auto">
            No physical antenna ports are registered in the system. Use the Warehouse Layout view to mount and map antenna ports to shelves.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {antennas.map((ant) => {
            const mappedShelf = shelves.find((s) => s.id === ant.shelf_id || s.shelf_code === ant.shelf_code);
            const shelfCode = ant.shelf_code || mappedShelf?.shelf_code || `PORT-${ant.port_number}`;
            const shelfName = mappedShelf?.name || 'Unassigned Shelf';

            const antEvents = (liveEvents || []).filter(
              (e) => (e.antenna_port || (e as any).antenna_id) === ant.port_number
            );
            const activeTagsCount = new Set(antEvents.map((e) => e.epc)).size;
            const avgRssi = antEvents.length > 0
              ? Math.round(antEvents.reduce((acc, cur) => acc + (cur.rssi_dbm || -75), 0) / antEvents.length)
              : null;

            return (
              <div
                key={ant.id}
                className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs space-y-5 hover:border-slate-300 transition"
              >
                {/* Card Header */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center space-x-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
                      <Radio className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-mono font-bold text-sm text-slate-900">{ant.antenna_code}</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          PORT {ant.port_number}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-500">Phased Linear Array</span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-1.5">
                    <button
                      onClick={() => onConfigureAntenna(ant.port_number)}
                      className="flex items-center space-x-1 px-2.5 py-1 bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-600 rounded-lg text-xs font-semibold transition cursor-pointer"
                      title="Configure Antenna Mapping"
                    >
                      <Edit2 className="w-3 h-3" />
                      <span>Configure</span>
                    </button>
                    {onDeleteAntenna && (
                      <button
                        onClick={() => onDeleteAntenna(ant.id)}
                        className="flex items-center space-x-1 px-2.5 py-1 bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-500 rounded-lg text-xs font-semibold transition cursor-pointer"
                        title="Remove Antenna"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Remove</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Real-time RF Sweep Status */}
                <div className="flex items-center justify-between p-3 bg-emerald-50/70 rounded-xl border border-emerald-200/80">
                  <div className="flex items-center space-x-2">
                    <Signal className="w-4 h-4 text-emerald-600 animate-pulse" />
                    <div>
                      <span className="font-bold text-slate-900 text-xs block">Live Telemetry Sweep</span>
                      <span className="text-[10px] text-emerald-700 font-medium">Real-time gateway auto-sync (5s)</span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-mono font-bold text-xs shadow-xs">
                      {activeTagsCount} TAGS ACTIVE
                    </span>
                    {avgRssi !== null && (
                      <span className="text-xs font-mono font-bold text-emerald-800 bg-white border border-emerald-200 px-2 py-0.5 rounded-lg">
                        {avgRssi} dBm
                      </span>
                    )}
                  </div>
                </div>

                {/* Physical Target Mapping */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold tracking-wider block">Assigned Shelf Location</span>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Layers className="w-3.5 h-3.5 text-blue-600" />
                      <span className="font-mono font-bold text-xs text-blue-700">{shelfCode}</span>
                      <span className="text-slate-500 text-[11px]">— {shelfName}</span>
                    </div>
                    <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 text-[10px] font-bold">MONITORED</span>
                  </div>
                </div>

                {/* RF Telemetry Parameters */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="text-[10px] text-slate-400 block">Transmit Power (Tx)</span>
                    <span className="font-bold text-slate-900 font-mono">{ant.tx_power_dbm?.toFixed(1) || '30.0'} dBm</span>
                    <span className="text-[10px] text-slate-500 block">Max Legal ERP</span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="text-[10px] text-slate-400 block">Antenna Gain</span>
                    <span className="font-bold text-slate-900 font-mono">{ant.gain_dbi?.toFixed(1) || '6.0'} dBi</span>
                    <span className="text-[10px] text-slate-500 block">Directional Beam</span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="text-[10px] text-slate-400 block">Median RSSI Baseline</span>
                    <span className="font-bold text-emerald-700 font-mono">{ant.median_rssi_baseline || -42.0} dBm</span>
                    <span className="text-[10px] text-emerald-600 block">Optimal Signal Range</span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="text-[10px] text-slate-400 block">RF Noise Floor</span>
                    <span className="font-bold text-slate-700 font-mono">{ant.noise_floor_dbm || -85.0} dBm</span>
                    <span className="text-[10px] text-slate-500 block">&gt; 38 dB SNR Margin</span>
                  </div>
                </div>

                {/* Antenna Physical Features */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                  <div className="flex items-center space-x-1.5">
                    <Zap className="w-3.5 h-3.5 text-amber-500" />
                    <span>Beam Width: <strong>{ant.beam_angle || 70}° Cone</strong></span>
                  </div>
                  <span>Polarization: <strong>{ant.polarization || 'CIRCULAR_RHCP'}</strong></span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

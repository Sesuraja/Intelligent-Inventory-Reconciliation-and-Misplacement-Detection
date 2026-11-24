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
  Edit2
} from 'lucide-react';
import { AntennaItem, ShelfItem } from '../../types';
import { api } from '../../services/api';

interface AntennaStatusViewProps {
  antennas: AntennaItem[];
  shelves: ShelfItem[];
  onConfigureAntenna: (port: number) => void;
  onRefresh: () => void;
}

export const AntennaStatusView: React.FC<AntennaStatusViewProps> = ({
  antennas,
  shelves,
  onConfigureAntenna,
  onRefresh
}) => {
  const displayAntennas: AntennaItem[] = antennas.length > 0 ? antennas : [
    {
      id: 1,
      reader_id: 1,
      port_number: 1,
      antenna_code: 'ANT-01',
      shelf_id: 1,
      shelf_code: 'SHELF_A',
      tx_power_dbm: 30.0,
      gain_dbi: 6.0,
      beam_angle: 70,
      polarization: 'CIRCULAR_RHCP',
      status: 'ACTIVE',
      noise_floor_dbm: -85.0,
      median_rssi_baseline: -42.0
    },
    {
      id: 2,
      reader_id: 1,
      port_number: 2,
      antenna_code: 'ANT-02',
      shelf_id: 2,
      shelf_code: 'SHELF_B',
      tx_power_dbm: 30.0,
      gain_dbi: 6.0,
      beam_angle: 70,
      polarization: 'CIRCULAR_RHCP',
      status: 'ACTIVE',
      noise_floor_dbm: -84.0,
      median_rssi_baseline: -44.0
    }
  ];

  return (
    <div className="space-y-6 text-xs text-slate-800">
      {/* Top Banner */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Radio className="w-5 h-5 text-emerald-600" />
            <h3 className="text-base font-bold text-slate-900">Overhead UHF Antenna Array Matrix</h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              2-PORT PHASED ARRAY
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
              CIRCULAR POLARIZATION
            </span>
          </div>
          <p className="text-slate-500 text-xs mt-1">
            Physical RF antenna array coverage, transmit power (dBm), noise floor, and zone mapping across warehouse shelves.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={onRefresh}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh Antennas</span>
          </button>
        </div>
      </div>

      {/* Antenna Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {displayAntennas.map((ant) => {
          const mappedShelf = shelves.find((s) => s.id === ant.shelf_id) || {
            name: ant.shelf_code === 'SHELF_A' ? 'Shelf A (Bay A - Fast Moving)' : 'Shelf B (Bay B - Secondary)',
            shelf_code: ant.shelf_code || `SHELF_${String.fromCharCode(64 + ant.port_number)}`
          };

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

                <button
                  onClick={() => onConfigureAntenna(ant.port_number)}
                  className="flex items-center space-x-1 px-2.5 py-1 bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-600 rounded-lg text-xs font-semibold transition"
                  title="Configure Antenna Mapping"
                >
                  <Edit2 className="w-3 h-3" />
                  <span>Configure</span>
                </button>
              </div>

              {/* Physical Target Mapping */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
                <span className="text-[10px] text-slate-400 uppercase font-semibold tracking-wider block">Assigned Shelf Location</span>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Layers className="w-3.5 h-3.5 text-blue-600" />
                    <span className="font-mono font-bold text-xs text-blue-700">{ant.shelf_code || mappedShelf.shelf_code}</span>
                    <span className="text-slate-500 text-[11px]">— {mappedShelf.name}</span>
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
    </div>
  );
};

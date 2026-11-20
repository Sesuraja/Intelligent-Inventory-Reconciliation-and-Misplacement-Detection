import React, { useState } from 'react';
import {
  Layers,
  Radio,
  Boxes,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  Cpu,
  Maximize2,
  Info,
  ShieldCheck,
  Package,
  Edit2
} from 'lucide-react';
import { ShelfItem, InventoryItem, AntennaItem } from '../../types';

interface WarehouseLayoutViewProps {
  shelves: ShelfItem[];
  items: InventoryItem[];
  antennas: AntennaItem[];
  onSelectShelf?: (shelfCode: string) => void;
  onEditShelf?: (shelf: ShelfItem) => void;
}

export const WarehouseLayoutView: React.FC<WarehouseLayoutViewProps> = ({
  shelves,
  items,
  antennas,
  onSelectShelf,
  onEditShelf
}) => {
  const [selectedShelfCode, setSelectedShelfCode] = useState<string>(shelves[0]?.shelf_code || 'SHELF_A');

  const selectedShelf = shelves.find((s) => s.shelf_code === selectedShelfCode) || shelves[0];
  const itemsOnSelected = items.filter((i) => i.expected_shelf_code === selectedShelfCode || i.observed_shelf_code === selectedShelfCode);
  const misplacedOnSelected = items.filter((i) => i.observed_shelf_code === selectedShelfCode && i.expected_shelf_code !== selectedShelfCode);
  const assignedAntenna = antennas.find((a) => a.shelf_id === selectedShelf?.id) || antennas[0];

  return (
    <div className="space-y-6 text-xs text-slate-800">
      
      {/* Top Banner */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Layers className="w-5 h-5 text-blue-600" />
            <h3 className="text-base font-bold text-slate-900">Interactive 2D Warehouse Spatial Layout</h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
              Overhead UHF Portal Matrix
            </span>
          </div>
          <p className="text-slate-500 text-[11px] mt-1">
            Real-time physical spatial map showing fixed portal antenna beam cones, storage shelf coordinates, and RFID tag cluster positions.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5 text-slate-600 font-mono text-[11px]">
            <span className="w-3 h-3 rounded bg-blue-600 inline-block"></span>
            <span>Shelf</span>
          </div>
          <div className="flex items-center space-x-1.5 text-slate-600 font-mono text-[11px]">
            <span className="w-3 h-3 rounded bg-emerald-500 inline-block"></span>
            <span>Antenna Beam</span>
          </div>
          <div className="flex items-center space-x-1.5 text-slate-600 font-mono text-[11px]">
            <span className="w-3 h-3 rounded bg-amber-500 inline-block"></span>
            <span>Misplaced Item</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Interactive 2D Canvas & Side Shelf Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Interactive 2D Floor Plan Canvas (8 Cols) */}
        <div className="lg:col-span-8 bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <span className="font-bold text-slate-900 text-sm flex items-center space-x-2">
              <Cpu className="w-4 h-4 text-blue-600" />
              <span>Zone A & Zone B Facility Floor Plan (Elevation & Truss Overlay)</span>
            </span>
            <span className="text-[11px] font-mono text-slate-500">Scale: 1m grid spacing</span>
          </div>

          {/* Interactive SVG/CSS Floor Plan */}
          <div className="relative bg-slate-900 rounded-2xl p-6 text-white overflow-hidden min-h-[460px] flex flex-col justify-between border border-slate-800">
            
            {/* Background Grid Pattern */}
            <div
              className="absolute inset-0 opacity-15"
              style={{
                backgroundImage: 'radial-gradient(circle, #38bdf8 1px, transparent 1px)',
                backgroundSize: '24px 24px'
              }}
            />

            {/* Overhead Reader Portal Truss Mount */}
            <div className="relative z-10 flex flex-col items-center">
              <div className="bg-slate-800/90 border border-cyan-500/50 px-4 py-1.5 rounded-full flex items-center space-x-2 shadow-lg shadow-cyan-500/20">
                <Radio className="w-4 h-4 text-cyan-400 animate-pulse" />
                <span className="font-mono font-bold text-xs text-cyan-300">Overhead Reader Truss: Impinj Speedway R420 (RDR-01)</span>
                <span className="px-1.5 py-0.2 bg-emerald-500/20 text-emerald-400 text-[10px] rounded font-mono font-bold">ONLINE</span>
              </div>
              <div className="w-0.5 h-6 bg-gradient-to-b from-cyan-500/50 to-transparent" />
            </div>

            {/* Antennas Row with Beam Cones */}
            <div className="relative z-10 grid grid-cols-4 gap-4 my-2">
              {[
                { port: 1, code: 'ANT-01', shelf: 'SHELF_A', pwr: '30 dBm' },
                { port: 2, code: 'ANT-02', shelf: 'SHELF_B', pwr: '30 dBm' },
                { port: 3, code: 'ANT-03', shelf: 'SHELF_C', pwr: '30 dBm' },
                { port: 4, code: 'ANT-04', shelf: 'SHELF_D', pwr: '30 dBm' },
              ].map((ant) => (
                <div key={ant.port} className="flex flex-col items-center space-y-1">
                  <div className="bg-emerald-950/80 border border-emerald-500/60 text-emerald-300 px-3 py-1 rounded-xl text-center shadow-md flex items-center space-x-1.5">
                    <Radio className="w-3.5 h-3.5 text-emerald-400" />
                    <div>
                      <div className="font-bold text-[11px] font-mono">{ant.code}</div>
                      <div className="text-[9px] text-emerald-400/80 font-mono">Port {ant.port} • {ant.pwr}</div>
                    </div>
                  </div>
                  {/* Visual Beam Cone Projection */}
                  <div
                    className="w-full h-16 bg-gradient-to-b from-emerald-500/25 via-emerald-500/10 to-transparent rounded-b-2xl border-x border-emerald-500/20"
                    style={{ clipPath: 'polygon(25% 0%, 75% 0%, 100% 100%, 0% 100%)' }}
                  />
                </div>
              ))}
            </div>

            {/* Shelves Physical Storage Blocks */}
            <div className="relative z-10 grid grid-cols-4 gap-4 pt-2">
              {shelves.map((shelf) => {
                const shelfItems = items.filter((i) => i.expected_shelf_code === shelf.shelf_code);
                const misplacedHere = items.filter((i) => i.observed_shelf_code === shelf.shelf_code && i.expected_shelf_code !== shelf.shelf_code);
                const isSelected = selectedShelfCode === shelf.shelf_code;

                return (
                  <button
                    key={shelf.id}
                    onClick={() => {
                      setSelectedShelfCode(shelf.shelf_code);
                      if (onSelectShelf) onSelectShelf(shelf.shelf_code);
                    }}
                    className={`p-3.5 rounded-2xl border text-left transition-all duration-200 cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'bg-blue-900/60 border-blue-400 ring-2 ring-blue-500/50 shadow-xl shadow-blue-500/30'
                        : 'bg-slate-800/80 border-slate-700/80 hover:border-slate-600 hover:bg-slate-800'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-mono font-bold text-sm text-white">{shelf.shelf_code}</span>
                        {misplacedHere.length > 0 && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">
                            {misplacedHere.length} Misplaced
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-300 font-medium truncate">{shelf.name || 'Pallet Rack'}</p>
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">Coord: ({shelf.coord_x}m, {shelf.coord_y}m)</p>
                    </div>

                    <div className="mt-4 pt-2 border-t border-slate-700/60 space-y-1.5">
                      <div className="flex justify-between text-[10px] text-slate-300">
                        <span>Items:</span>
                        <strong className="text-white font-mono">{shelfItems.length} / {shelf.capacity || 30}</strong>
                      </div>
                      {/* Capacity Bar */}
                      <div className="w-full bg-slate-700 rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-1.5 rounded-full ${
                            misplacedHere.length > 0 ? 'bg-amber-400' : 'bg-blue-400'
                          }`}
                          style={{ width: `${Math.min(100, Math.round((shelfItems.length / (shelf.capacity || 30)) * 100))}%` }}
                        />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Floor Coordinates Footer */}
            <div className="relative z-10 flex justify-between items-center text-[10px] font-mono text-slate-400 pt-4 border-t border-slate-800/80">
              <span>Origin: Zone A Main Bay Dock (0.0, 0.0)</span>
              <span>Portal Frequency Hop: 865.7 - 867.5 MHz (ETSI) / 902-928 MHz (FCC)</span>
            </div>

          </div>
        </div>

        {/* Right Side: Shelf Detail & Stock Inspector (4 Cols) */}
        <div className="lg:col-span-4 bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Inspecting Location</span>
              <h4 className="text-base font-bold text-slate-900 font-mono">{selectedShelf?.shelf_code}</h4>
            </div>
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                {selectedShelf?.name || 'Storage Rack'}
              </span>
              {onEditShelf && selectedShelf && (
                <button
                  onClick={() => onEditShelf(selectedShelf)}
                  className="p-1.5 bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-500 rounded-lg transition"
                  title="Edit Shelf Parameters"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
              <span className="text-[10px] text-slate-400 block">Antenna Port</span>
              <span className="font-bold text-slate-900 font-mono">
                Port {assignedAntenna?.port_number || 1} ({assignedAntenna?.antenna_code || 'ANT-01'})
              </span>
            </div>
            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
              <span className="text-[10px] text-slate-400 block">Baseline Signal</span>
              <span className="font-bold text-emerald-700 font-mono">-42 dBm nominal</span>
            </div>
            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
              <span className="text-[10px] text-slate-400 block">Capacity</span>
              <span className="font-bold text-slate-900 font-mono">{selectedShelf?.capacity || 30} units</span>
            </div>
            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
              <span className="text-[10px] text-slate-400 block">Total Stored</span>
              <span className="font-bold text-blue-700 font-mono">{itemsOnSelected.length} items</span>
            </div>
          </div>

          {/* Misplaced Items Alert if any */}
          {misplacedOnSelected.length > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1.5">
              <div className="flex items-center space-x-1.5 text-amber-900 font-bold text-xs">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>Misplaced Item Detected at this Shelf!</span>
              </div>
              <div className="space-y-1">
                {misplacedOnSelected.map((m) => (
                  <div key={m.id} className="text-[11px] font-mono text-amber-800 bg-white/70 p-1.5 rounded border border-amber-200 flex justify-between">
                    <span>{m.epc}</span>
                    <span className="text-[10px] font-sans">Expected: <strong>{m.expected_shelf_code}</strong></span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Stored Items List */}
          <div className="space-y-2">
            <span className="font-bold text-slate-900 text-xs block">
              Items Currently Detected at {selectedShelf?.shelf_code} ({itemsOnSelected.length}):
            </span>
            <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
              {itemsOnSelected.map((it) => (
                <div key={it.id} className="p-2 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs">
                  <div className="overflow-hidden pr-2">
                    <span className="font-mono font-bold text-slate-900 text-[11px] block">{it.epc}</span>
                    <span className="text-[10px] text-slate-500 truncate block">{it.product_name}</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                    it.expected_shelf_code === selectedShelfCode
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : 'bg-amber-50 text-amber-800 border-amber-200'
                  }`}>
                    {it.expected_shelf_code === selectedShelfCode ? 'IN_PLACE' : 'MISPLACED'}
                  </span>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};

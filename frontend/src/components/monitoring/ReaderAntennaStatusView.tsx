import React, { useState, useEffect } from 'react';
import {
  Server,
  Radio,
  Sliders,
  Wifi,
  WifiOff,
  Zap,
  RotateCcw,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Cpu,
  Layers,
  ShieldCheck
} from 'lucide-react';
import { ReaderItem, AntennaItem, ShelfItem, InventoryItem } from '../../types';
import { api } from '../../services/api';

interface ReaderAntennaStatusViewProps {
  readers: ReaderItem[];
  antennas: AntennaItem[];
  shelves: ShelfItem[];
  onConfigureAntenna: (port: number) => void;
  onRefresh: () => void;
}

export const ReaderAntennaStatusView: React.FC<ReaderAntennaStatusViewProps> = ({
  readers,
  antennas,
  shelves,
  onConfigureAntenna,
  onRefresh
}) => {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [selectedTagToMove, setSelectedTagToMove] = useState('EPC-9001');
  const [targetShelf, setTargetShelf] = useState('SHELF_C');
  const [selectedTagToShadow, setSelectedTagToShadow] = useState('EPC-9004');
  const [simActionMessage, setSimActionMessage] = useState<string | null>(null);
  const [isOutage, setIsOutage] = useState(false);

  // Socket probe state
  const [probingHardware, setProbingHardware] = useState(false);
  const [hardwareProbe, setHardwareProbe] = useState<{
    tested: boolean;
    reachable: boolean;
    latencyMs?: number;
    message?: string;
    operatingMode?: string;
  } | null>(null);

  useEffect(() => {
    api.getInventory().then((inv) => {
      setItems(inv);
      if (inv.length > 0) {
        setSelectedTagToMove(inv[0].epc);
        if (inv.length > 3) {
          setSelectedTagToShadow(inv[3].epc);
        }
      }
    }).catch(console.error);

    api.getSimulatorStatus().then((s) => setIsOutage(s.outage_active)).catch(console.error);
  }, []);

  const handleTestPhysicalReader = async () => {
    setProbingHardware(true);
    try {
      const res = await api.testReaderPhysicalConnection(readers[0]?.id || 1);
      setHardwareProbe({
        tested: true,
        reachable: res.physical_reachable,
        latencyMs: res.latency_ms,
        message: res.message,
        operatingMode: res.operating_mode
      });
    } catch (err: any) {
      setHardwareProbe({
        tested: true,
        reachable: false,
        message: err.message || 'Reader socket probe failed'
      });
    } finally {
      setProbingHardware(false);
    }
  };

  const handleSimAction = async (action: string, epc?: string, shelf?: string, enabled?: boolean) => {
    try {
      const res = await api.executeSimulatorAction(action, epc, shelf, enabled);
      setSimActionMessage(res.message);
      if (action === 'TOGGLE_OUTAGE') {
        setIsOutage(res.outage_active);
      }
      setTimeout(() => setSimActionMessage(null), 4000);
      onRefresh();
    } catch (err: any) {
      alert(`Simulation error: ${err.message}`);
    }
  };

  const activeReader = readers[0] || {
    reader_code: 'RDR-01',
    model: 'Impinj Speedway R420 (4-Port)',
    ip_address: '192.168.1.100',
    port: 5084,
    protocol: 'LLRP Specification',
    status: 'ONLINE'
  };

  return (
    <div className="space-y-6 text-xs text-slate-800">
      
      {/* Top Banner */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Radio className="w-5 h-5 text-blue-600" />
            <h3 className="text-base font-bold text-slate-900">3.1 Reader & Antenna Status</h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
              Impinj LLRP v1.0.1
            </span>
          </div>
          <p className="text-slate-500 text-[11px] mt-1">
            Real-time status of fixed UHF RFID readers, 4-port antenna matrix, RF attenuation and network socket diagnostics.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleTestPhysicalReader}
            disabled={probingHardware}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs transition"
          >
            <Wifi className="w-3.5 h-3.5" />
            <span>{probingHardware ? 'Probing Socket...' : 'Probe Physical Reader (LLRP/TCP)'}</span>
          </button>
        </div>
      </div>

      {/* Reader & 4-Port Matrix Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Reader Hardware Card */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 border border-blue-100 shadow-xs">
                  <Server className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">{activeReader.reader_code}</h3>
                  <p className="text-[10px] text-slate-400">Fixed UHF Reader</p>
                </div>
              </div>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold flex items-center space-x-1.5 ${
                !isOutage
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-rose-50 text-rose-700 border border-rose-200'
              }`}>
                <span className={`w-2 h-2 rounded-full ${!isOutage ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                <span>{!isOutage ? 'ONLINE' : 'OUTAGE'}</span>
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Model:</span>
                <span className="text-slate-800 font-semibold">{activeReader.model}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>IP / Port:</span>
                <span className="font-mono text-slate-700">{activeReader.ip_address}:{activeReader.port}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Communication Protocol:</span>
                <span className="font-mono text-blue-600 font-semibold">{activeReader.protocol}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Uptime:</span>
                <span className="font-mono text-slate-800 font-semibold">12h 24m (99.7%)</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Collector Sweep:</span>
                <span className="font-mono text-emerald-600 font-medium">Active (2.0s loop)</span>
              </div>
            </div>

            {hardwareProbe && hardwareProbe.tested && (
              <div className={`mt-4 p-3 rounded-xl text-xs border ${
                hardwareProbe.reachable
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-amber-50 text-amber-800 border-amber-200'
              }`}>
                <div className="font-semibold flex items-center justify-between">
                  <span>{hardwareProbe.reachable ? '✓ Physical Reader Reachable' : 'Hardware Offline (Socket Refused)'}</span>
                  {hardwareProbe.latencyMs !== undefined && (
                    <span className="font-mono">{hardwareProbe.latencyMs}ms</span>
                  )}
                </div>
                <div className="mt-0.5 text-[11px] text-slate-600">{hardwareProbe.message}</div>
              </div>
            )}
          </div>

          <div className="mt-5 pt-3 border-t border-slate-100 flex justify-between items-center text-xs">
            <span className="text-slate-500">Telemetry Channel</span>
            <span className="font-mono text-blue-600 font-semibold">/ws/rfid-events</span>
          </div>
        </div>

        {/* 4-Port Antennas Matrix */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs lg:col-span-2 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 border border-indigo-100 shadow-xs">
                  <Radio className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">4-Port UHF Antenna Matrix & Shelf Mappings</h3>
                  <p className="text-[10px] text-slate-400">Directional Circular Polarized Antennas</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-xs text-slate-500 font-mono bg-slate-50 px-2 py-1 rounded-lg border border-slate-200">
                  30.0 dBm EIRP
                </span>
                <button
                  onClick={() => onConfigureAntenna(1)}
                  className="flex items-center space-x-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-semibold transition"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Configure Ports</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
              {[1, 2, 3, 4].map((port) => {
                const assignedAnt = antennas.find((a) => a.port_number === port);
                const code = assignedAnt?.antenna_code || `ANT-0${port}`;
                const shelf = shelves.find((s) => s.id === assignedAnt?.shelf_id);
                const shelfCode = assignedAnt?.shelf_code || shelf?.shelf_code || `SHELF_${String.fromCharCode(64 + port)}`;
                const gain = assignedAnt?.gain_dbi ? `${assignedAnt.gain_dbi} dBi` : '6.0 dBi';
                const isActive = assignedAnt ? assignedAnt.is_active : !isOutage;
                const sampleRssi = [-42, -45, -47, -42][port - 1];

                return (
                  <div
                    key={port}
                    onClick={() => onConfigureAntenna(port)}
                    className="bg-slate-50/90 hover:bg-blue-50/50 hover:border-blue-300 border border-slate-200 p-3.5 rounded-xl text-xs space-y-1.5 cursor-pointer transition"
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-slate-900 font-mono text-sm">{code}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-blue-100 text-blue-700 font-mono font-bold">
                        Port {port}
                      </span>
                    </div>
                    <div className="text-xs font-semibold text-emerald-700 flex items-center justify-between">
                      <span>{shelfCode}</span>
                      <span className="font-mono text-slate-600 font-bold">{sampleRssi} dBm</span>
                    </div>
                    <div className="text-slate-500 text-[10px]">Gain: {gain} • 70° Beam</div>
                    <div className="flex items-center space-x-1.5 pt-1 text-[10px] text-slate-600">
                      <span className={`w-2 h-2 rounded-full ${isActive && !isOutage ? 'bg-emerald-500 animate-ping' : 'bg-rose-400'}`} />
                      <span className="font-semibold">{isActive && !isOutage ? 'Online (RF Active)' : 'Offline / Idle'}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-slate-100 text-xs text-slate-500 flex flex-col sm:flex-row justify-between gap-1">
            <span>Antenna radiation pattern: 70° directional beam with cross-reading falloff model.</span>
            <span className="font-mono text-slate-700 font-semibold">Cross-Read Baseline: -68 dBm</span>
          </div>
        </div>

      </div>

      {/* Hardware Simulator Interactive Control Console */}
      <div className="bg-white border border-indigo-200 rounded-2xl p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 border border-indigo-100 shadow-xs">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">UHF Hardware Simulation & RF Test Console</h3>
              <p className="text-xs text-slate-500">Inject real-world RF anomalies and physical disturbances into the live stream</p>
            </div>
          </div>
          <span className="text-[10px] px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 font-bold border border-indigo-200 self-start sm:self-auto">
            PHYSICS PROPAGATION ENGINE ACTIVE
          </span>
        </div>

        {simActionMessage && (
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center space-x-2">
            <Zap className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{simActionMessage}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
          
          {/* Action 1: Misplace Product */}
          <div className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-200 flex flex-col justify-between space-y-2">
            <div>
              <span className="font-bold text-slate-900 block">1. Inject Physical Misplacement</span>
              <p className="text-[11px] text-slate-500 mt-0.5">Move item to different shelf without WMS record.</p>
            </div>
            <div className="space-y-2">
              <select
                value={selectedTagToMove}
                onChange={(e) => setSelectedTagToMove(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-900 font-mono text-[11px] focus:outline-none"
              >
                {items.slice(0, 10).map((i) => (
                  <option key={i.epc} value={i.epc}>
                    {i.epc} (Curr: {i.expected_shelf_code})
                  </option>
                ))}
              </select>
              <div className="flex space-x-2">
                <select
                  value={targetShelf}
                  onChange={(e) => setTargetShelf(e.target.value)}
                  className="bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-slate-900 font-mono text-[11px] flex-1 focus:outline-none"
                >
                  {shelves.map((s) => (
                    <option key={s.id} value={s.shelf_code}>
                      {s.shelf_code} {s.name ? `(${s.name})` : ''}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => handleSimAction('MOVE_TAG', selectedTagToMove, targetShelf)}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-semibold shadow-xs transition"
                >
                  Move
                </button>
              </div>
            </div>
          </div>

          {/* Action 2: RF Shadowing / Obstruction */}
          <div className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-200 flex flex-col justify-between space-y-2">
            <div>
              <span className="font-bold text-slate-900 block">2. Inject RF Shadowing</span>
              <p className="text-[11px] text-slate-500 mt-0.5">Block tag with liquid/metal container (-26 dB loss).</p>
            </div>
            <div className="space-y-2">
              <select
                value={selectedTagToShadow}
                onChange={(e) => setSelectedTagToShadow(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-900 font-mono text-[11px] focus:outline-none"
              >
                {items.slice(0, 10).map((i) => (
                  <option key={i.epc} value={i.epc}>{i.epc} - {i.product_name}</option>
                ))}
              </select>
              <div className="flex space-x-2">
                <button
                  onClick={() => handleSimAction('TOGGLE_SHADOWING', selectedTagToShadow, undefined, true)}
                  className="flex-1 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold shadow-xs transition"
                >
                  Shield
                </button>
                <button
                  onClick={() => handleSimAction('TOGGLE_SHADOWING', selectedTagToShadow, undefined, false)}
                  className="px-2.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-lg font-semibold transition"
                >
                  Clear
                </button>
              </div>
            </div>
          </div>

          {/* Action 3: Power Outage */}
          <div className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-200 flex flex-col justify-between space-y-2">
            <div>
              <span className="font-bold text-slate-900 block">3. Toggle Reader Outage</span>
              <p className="text-[11px] text-slate-500 mt-0.5">Simulate power loss / Ethernet disconnection.</p>
            </div>
            <button
              onClick={() => handleSimAction('TOGGLE_OUTAGE')}
              className={`w-full py-2.5 rounded-xl font-semibold flex items-center justify-center space-x-2 transition shadow-xs ${
                !isOutage
                  ? 'bg-rose-600 hover:bg-rose-700 text-white'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              }`}
            >
              {!isOutage ? <WifiOff className="w-4 h-4" /> : <Wifi className="w-4 h-4" />}
              <span>{!isOutage ? 'Trigger Outage' : 'Restore Online'}</span>
            </button>
          </div>

          {/* Action 4: Reset Ground Truth */}
          <div className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-200 flex flex-col justify-between space-y-2">
            <div>
              <span className="font-bold text-slate-900 block">4. Reset Ground Truth</span>
              <p className="text-[11px] text-slate-500 mt-0.5">Restore all tags back to nominal expected shelves.</p>
            </div>
            <button
              onClick={() => handleSimAction('RESET_GROUND_TRUTH')}
              className="w-full py-2.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 rounded-xl font-semibold flex items-center justify-center space-x-2 transition shadow-xs"
            >
              <RotateCcw className="w-4 h-4 text-blue-600" />
              <span>Reset Simulation</span>
            </button>
          </div>

        </div>
      </div>

    </div>
  );
};

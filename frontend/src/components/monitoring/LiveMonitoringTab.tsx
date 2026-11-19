import React, { useState, useEffect } from 'react';
import {
  Radio,
  Server,
  Zap,
  Activity,
  Sliders,
  RotateCcw,
  Wifi,
  WifiOff,
  Signal
} from 'lucide-react';
import { ReaderItem, AntennaItem, RFIDEvent, InventoryItem, ShelfItem } from '../../types';
import { api } from '../../services/api';
import { LoadingState } from '../common/LoadingState';
import { AssignAntennaModal } from './AssignAntennaModal';

interface LiveMonitoringTabProps {
  readers: ReaderItem[];
  antennas: AntennaItem[];
  liveEvents: RFIDEvent[];
  isLiveConnected: boolean;
  onRefreshData: () => void;
}

export const LiveMonitoringTab: React.FC<LiveMonitoringTabProps> = ({
  readers,
  antennas,
  liveEvents,
  onRefreshData
}) => {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [shelves, setShelves] = useState<ShelfItem[]>([]);
  const [selectedTagToMove, setSelectedTagToMove] = useState('EPC-9001');
  const [targetShelf, setTargetShelf] = useState('SHELF_C');
  const [selectedTagToShadow, setSelectedTagToShadow] = useState('EPC-9004');
  const [simActionMessage, setSimActionMessage] = useState<string | null>(null);
  const [isOutage, setIsOutage] = useState(false);

  // Antenna Modal State
  const [showAssignAntennaModal, setShowAssignAntennaModal] = useState(false);
  const [selectedPortForAntenna, setSelectedPortForAntenna] = useState(1);

  // Hardware Connection Probe State
  const [hardwareProbe, setHardwareProbe] = useState<{
    tested: boolean;
    reachable: boolean;
    latencyMs?: number;
    message?: string;
    operatingMode?: string;
  } | null>(null);
  const [probingHardware, setProbingHardware] = useState(false);

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

    api.getShelves().then((shs) => {
      setShelves(shs);
      if (shs.length > 1) {
        setTargetShelf(shs[1].shelf_code);
      }
    }).catch(console.error);

    api.getSimulatorStatus().then((s) => setIsOutage(s.outage_active)).catch(console.error);
  }, []);

  const handleSimAction = async (action: string, epc?: string, shelf?: string, enabled?: boolean) => {
    try {
      const res = await api.executeSimulatorAction(action, epc, shelf, enabled);
      setSimActionMessage(res.message);
      if (action === 'TOGGLE_OUTAGE') {
        setIsOutage(res.outage_active);
      }
      setTimeout(() => setSimActionMessage(null), 4000);
      onRefreshData();
    } catch (err: any) {
      alert(`Simulation error: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Readers and Antennas Status Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Reader Hardware Card */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                  <Server className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-slate-900">Fixed UHF RFID Reader</h3>
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
                <span>Reader Code:</span>
                <span className="font-mono text-slate-900 font-semibold">{readers[0]?.reader_code || 'READER_01'}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Model:</span>
                <span className="text-slate-800">{readers[0]?.model || 'Impinj Speedway R420 (4-Port)'}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>IP / Port:</span>
                <span className="font-mono text-slate-700">{readers[0] ? `${readers[0].ip_address}:${readers[0].port}` : '192.168.1.100:5084'}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Communication Protocol:</span>
                <span className="font-mono text-blue-600 font-semibold">{readers[0]?.protocol || 'LLRP Specification'}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Collector Buffer Loop:</span>
                <span className="font-mono text-emerald-600">Active (2.0s sweep)</span>
              </div>
            </div>

            {/* Hardware Socket Probe Button */}
            <div className="mt-4 pt-3 border-t border-slate-100">
              <button
                onClick={handleTestPhysicalReader}
                disabled={probingHardware}
                className="w-full py-1.5 px-3 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold flex items-center justify-center space-x-1.5 transition"
              >
                <Wifi className="w-3.5 h-3.5 text-blue-600" />
                <span>{probingHardware ? 'Probing TCP Socket...' : 'Probe Physical Reader (LLRP/TCP)'}</span>
              </button>

              {hardwareProbe && hardwareProbe.tested && (
                <div className={`mt-2 p-2 rounded-lg text-[11px] border ${
                  hardwareProbe.reachable
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-amber-50 text-amber-800 border-amber-200'
                }`}>
                  <div className="font-semibold flex items-center justify-between">
                    <span>{hardwareProbe.reachable ? 'Physical Reader Reachable' : 'Hardware Offline (Unreachable)'}</span>
                    {hardwareProbe.latencyMs !== undefined && (
                      <span className="font-mono">{hardwareProbe.latencyMs}ms</span>
                    )}
                  </div>
                  <div className="mt-0.5 text-[10px] text-slate-600">{hardwareProbe.message}</div>
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center text-xs">
            <span className="text-slate-500">WebSocket Channel</span>
            <span className="font-mono text-blue-600 font-semibold">/ws/rfid-events</span>
          </div>
        </div>

        {/* 4-Port Antennas Matrix */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs lg:col-span-2 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                  <Radio className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-slate-900">4-Port UHF Antenna Array & Shelf Mappings</h3>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-xs text-slate-500 font-mono">30.0 dBm EIRP</span>
                <button
                  onClick={() => {
                    setSelectedPortForAntenna(1);
                    setShowAssignAntennaModal(true);
                  }}
                  className="flex items-center space-x-1.5 px-3 py-1 bg-white hover:bg-slate-50 text-indigo-700 border border-slate-200 rounded-lg text-xs font-semibold shadow-xs transition"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Configure / Assign</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[1, 2, 3, 4].map((port) => {
                const assignedAnt = antennas.find((a) => a.port_number === port);
                const code = assignedAnt?.antenna_code || `ANT-0${port}`;
                const shelfCode = assignedAnt?.shelf_code || (shelves.find((s) => s.id === assignedAnt?.shelf_id)?.shelf_code) || `SHELF_${String.fromCharCode(64 + port)}`;
                const gain = assignedAnt?.gain_dbi ? `${assignedAnt.gain_dbi} dBi` : '6.0 dBi';
                const isActive = assignedAnt ? assignedAnt.is_active : !isOutage;

                return (
                  <div
                    key={port}
                    onClick={() => {
                      setSelectedPortForAntenna(port);
                      setShowAssignAntennaModal(true);
                    }}
                    className="bg-slate-50/80 hover:bg-blue-50/50 hover:border-blue-300 border border-slate-200 p-3 rounded-xl text-xs space-y-1 cursor-pointer transition"
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-slate-900 font-mono">{code}</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-100 text-blue-700 font-mono font-semibold">
                        Port {port}
                      </span>
                    </div>
                    <div className="text-[11px] font-semibold text-emerald-700">{shelfCode}</div>
                    <div className="text-slate-500 text-[10px]">Gain: {gain}</div>
                    <div className="flex items-center space-x-1.5 pt-1 text-[10px] text-slate-600">
                      <span className={`w-1.5 h-1.5 rounded-full ${isActive && !isOutage ? 'bg-emerald-500 animate-ping' : 'bg-rose-400'}`} />
                      <span>{isActive && !isOutage ? 'RF Sweep Active' : 'Offline / Idle'}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-500 flex items-center justify-between">
            <span>Antenna radiation pattern: 70° directional beam with cross-reading falloff model.</span>
            <span className="font-mono text-slate-600">Cross-Read Baseline: -68 dBm</span>
          </div>
        </div>

      </div>

      {/* Hardware Simulator Interactive Control Console */}
      <div className="bg-white border border-indigo-200 rounded-2xl p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">UHF Hardware Simulation & RF Test Console</h3>
              <p className="text-xs text-slate-500">Inject real-world RF anomalies to test AI detection</p>
            </div>
          </div>
          <span className="text-[10px] px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 font-bold border border-indigo-200 self-start sm:self-auto">
            PHYSICS PROPAGATION ENGINE ACTIVE
          </span>
        </div>

        {simActionMessage && (
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center space-x-2 animate-in fade-in">
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

      {/* Live Streaming EPC Observations Feed */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
            <h3 className="text-sm font-bold text-slate-900">Live Streaming RFID Observation Feed</h3>
            <span className="text-[11px] font-mono text-slate-500">WebSocket /ws/rfid-events</span>
          </div>
          <span className="text-xs text-slate-400">Showing last observation frames</span>
        </div>

        <div className="bg-slate-50/60 border border-slate-200 rounded-xl overflow-hidden font-mono text-xs">
          <div className="grid grid-cols-6 py-2.5 px-4 bg-slate-100 border-b border-slate-200 text-slate-600 uppercase font-semibold text-[11px]">
            <span>Event ID</span>
            <span>Tag EPC</span>
            <span>Antenna Port</span>
            <span>Frequency</span>
            <span>Observed RSSI (Signal Power)</span>
            <span className="text-right">Timestamp</span>
          </div>

          <div className="divide-y divide-slate-200/60 max-h-80 overflow-y-auto">
            {liveEvents.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                Listening for live UHF RFID sweep observations...
              </div>
            ) : (
              liveEvents.map((evt, idx) => {
                const rssi = evt.rssi_dbm;
                const pct = Math.max(5, Math.min(100, ((rssi - (-85)) / 50) * 100));
                return (
                  <div key={idx} className="grid grid-cols-6 py-2 px-4 items-center hover:bg-white transition text-slate-700">
                    <span className="text-slate-400 text-[11px]">{evt.event_id}</span>
                    <span className="font-bold text-slate-900">{evt.epc}</span>
                    <span className="text-blue-600 font-semibold">Port {evt.antenna_port || evt.antenna_id || 1}</span>
                    <span className="text-slate-500">{evt.frequency ? `${evt.frequency} MHz` : '866.3 MHz'}</span>
                    <div className="flex items-center space-x-2 pr-4">
                      <span className="w-16 font-semibold text-right text-slate-800">{rssi.toFixed(1)} dBm</span>
                      <div className="flex-1 bg-slate-200 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="h-1.5 rounded-full bg-emerald-500 transition-all duration-300"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-right text-slate-500 text-[11px]">
                      {new Date(evt.observed_at).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="flex justify-between items-center text-xs text-slate-500 pt-1">
          <span>Deduplication & 10s sliding window aggregation active in Python collector service.</span>
          <span className="font-mono text-emerald-700 font-medium">Normalized Schema: EVT Gen2 Valid</span>
        </div>
      </div>

      {/* Assign Antenna Modal */}
      <AssignAntennaModal
        isOpen={showAssignAntennaModal}
        onClose={() => setShowAssignAntennaModal(false)}
        onSuccess={() => {
          onRefreshData();
          api.getShelves().then(setShelves).catch(console.error);
        }}
        shelves={shelves}
        readers={readers}
        initialPort={selectedPortForAntenna}
      />

    </div>
  );
};

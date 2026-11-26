import React, { useState } from 'react';
import {
  Activity,
  Search,
  Filter,
  Pause,
  Play,
  RotateCw,
  Radio,
  Signal,
  CheckCircle2,
  SlidersHorizontal
} from 'lucide-react';
import { RFIDEvent } from '../../types';

interface LiveRFIDReadsViewProps {
  liveEvents: RFIDEvent[];
  isLiveConnected: boolean;
  onRefresh?: () => void;
}

export const LiveRFIDReadsView: React.FC<LiveRFIDReadsViewProps> = ({
  liveEvents,
  isLiveConnected,
  onRefresh
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPort, setSelectedPort] = useState<string>('ALL');
  const [isPaused, setIsPaused] = useState(false);
  const [capturedEvents, setCapturedEvents] = useState<RFIDEvent[]>([]);

  // Dynamically derive active antenna ports present in live stream
  const availablePorts = Array.from(
    new Set(
      liveEvents
        .map((e) => e.antenna_port || e.antenna_id)
        .filter((p): p is number => typeof p === 'number' && p > 0)
    )
  ).sort((a, b) => a - b);

  // When paused, hold the current snapshot
  const displayedEvents = isPaused ? capturedEvents : liveEvents;

  const handleTogglePause = () => {
    if (!isPaused) {
      setCapturedEvents([...liveEvents]);
    }
    setIsPaused(!isPaused);
  };

  const filteredEvents = displayedEvents.filter((evt) => {
    const matchesSearch = evt.epc.toLowerCase().includes(searchQuery.toLowerCase());
    const port = String(evt.antenna_port || evt.antenna_id || 1);
    const matchesPort = selectedPort === 'ALL' || port === selectedPort;
    return matchesSearch && matchesPort;
  });

  return (
    <div className="space-y-6 text-xs text-slate-800">
      
      {/* Top Banner */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Activity className="w-5 h-5 text-emerald-600" />
            <h3 className="text-base font-bold text-slate-900">Live RFID Reads Stream</h3>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border flex items-center space-x-1 ${
              isLiveConnected && !isPaused
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-amber-50 text-amber-700 border-amber-200'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isLiveConnected && !isPaused ? 'bg-emerald-500 animate-ping' : 'bg-amber-500'}`} />
              <span>{isPaused ? 'STREAM PAUSED' : isLiveConnected ? 'LIVE STREAMING' : 'CONNECTING...'}</span>
            </span>
          </div>
          <p className="text-slate-500 text-[11px] mt-1">
            Real-time UHF Gen2 EPC observation frames streaming live from Aperture Fixed Gateway (Reader 100EHH5323020053) via WebSockets.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleTogglePause}
            className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold shadow-xs transition ${
              isPaused
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
            }`}
          >
            {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
            <span>{isPaused ? 'Resume Live Stream' : 'Pause Stream'}</span>
          </button>
          
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-xl transition"
              title="Refresh"
            >
              <RotateCw className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center space-x-3 w-full sm:w-auto flex-1">
          <div className="relative flex-1 sm:max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
            <input
              type="text"
              placeholder="Filter by EPC hex code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200/90 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-blue-500 transition font-mono"
            />
          </div>

          <select
            value={selectedPort}
            onChange={(e) => setSelectedPort(e.target.value)}
            className="bg-slate-50 border border-slate-200/90 rounded-xl px-3 py-1.5 text-xs text-slate-700 focus:bg-white focus:outline-none"
          >
            <option value="ALL">All Antenna Ports</option>
            {availablePorts.map((p) => (
              <option key={p} value={String(p)}>
                Port {p} (Antenna {p})
              </option>
            ))}
          </select>
        </div>

        <div className="text-xs text-slate-500 font-mono">
          Showing {filteredEvents.length} frames • Window: 10s sliding
        </div>
      </div>

      {/* Main Stream Table */}
      <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                <th className="py-3 px-4">Time</th>
                <th className="py-3 px-4">Tag EPC (Gen2)</th>
                <th className="py-3 px-4">Antenna</th>
                <th className="py-3 px-4">RSSI (Signal Power)</th>
                <th className="py-3 px-4">Read Frequency</th>
                <th className="py-3 px-4 text-right">Telemetry Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 font-mono">
              {filteredEvents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 font-sans">
                    {searchQuery ? 'No observations match your search filter.' : 'Listening for UHF RFID sweep observations...'}
                  </td>
                </tr>
              ) : (
                filteredEvents.map((evt, idx) => {
                  const rssi = evt.rssi_dbm;
                  const port = evt.antenna_port || evt.antenna_id || 1;
                  const pct = Math.max(5, Math.min(100, ((rssi - (-85)) / 50) * 100));
                  const timeStr = new Date(evt.observed_at).toLocaleTimeString([], {
                    hour12: false,
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                  });

                  return (
                    <tr key={idx} className="hover:bg-slate-50/80 transition">
                      <td className="py-2.5 px-4 text-slate-500 text-[11px] whitespace-nowrap">
                        {timeStr}
                      </td>
                      <td className="py-2.5 px-4 font-bold text-slate-900">
                        {evt.epc}
                      </td>
                      <td className="py-2.5 px-4 font-semibold text-blue-600">
                        ANT-0{port}
                      </td>
                      <td className="py-2.5 px-4">
                        <div className="flex items-center space-x-2 max-w-xs">
                          <span className="w-16 font-bold text-right text-slate-800">{rssi.toFixed(1)} dBm</span>
                          <div className="flex-1 bg-slate-200 rounded-full h-1.5 overflow-hidden min-w-[60px]">
                            <div
                              className="h-1.5 rounded-full bg-emerald-500 transition-all duration-300"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 px-4 text-slate-600 text-[11px]">
                        {evt.frequency ? `${evt.frequency} MHz` : '866.3 MHz'}
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-sans font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Active EPC
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="py-3 px-4 border-t border-slate-200/80 bg-slate-50/50 flex justify-between items-center text-xs text-slate-500">
          <span>Continuous edge collector aggregation running with deduplication</span>
          <span className="font-mono text-emerald-700 font-semibold">LLRP Specification Port 5084</span>
        </div>
      </div>

    </div>
  );
};

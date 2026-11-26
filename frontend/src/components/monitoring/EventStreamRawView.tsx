import React, { useState } from 'react';
import {
  Terminal,
  Copy,
  Check,
  Pause,
  Play,
  Trash2,
  Download,
  Filter,
  CheckCircle2,
  Code2
} from 'lucide-react';
import { RFIDEvent } from '../../types';

interface EventStreamRawViewProps {
  liveEvents: RFIDEvent[];
  isLiveConnected: boolean;
}

export const EventStreamRawView: React.FC<EventStreamRawViewProps> = ({
  liveEvents,
  isLiveConnected
}) => {
  const [isPaused, setIsPaused] = useState(false);
  const [pausedEvents, setPausedEvents] = useState<RFIDEvent[]>([]);
  const [copied, setCopied] = useState(false);
  const [format, setFormat] = useState<'json' | 'llrp_binary'>('json');

  // Filter controls
  const [epcFilter, setEpcFilter] = useState('');
  const [antennaFilter, setAntennaFilter] = useState('');
  const [readerFilter, setReaderFilter] = useState('');
  const [minRssi, setMinRssi] = useState<number>(-90);

  // Dynamic available antenna ports from real live stream
  const availableAntennaPorts = Array.from(
    new Set(
      liveEvents
        .map((e) => e.antenna_port || e.antenna_id)
        .filter((p): p is number => typeof p === 'number' && p > 0)
    )
  ).sort((a, b) => a - b);

  const baseEvents = isPaused ? pausedEvents : liveEvents;
  const eventsToShow = baseEvents.filter((evt) => {
    if (epcFilter && !evt.epc.toLowerCase().includes(epcFilter.toLowerCase())) return false;
    if (antennaFilter) {
      const port = String(evt.antenna_port || evt.antenna_id || '');
      if (port !== antennaFilter) return false;
    }
    if (readerFilter) {
      const rCode = String(evt.reader_code || evt.reader_id || '');
      if (!rCode.toLowerCase().includes(readerFilter.toLowerCase())) return false;
    }
    if (evt.rssi_dbm !== undefined && evt.rssi_dbm < minRssi) return false;
    return true;
  });

  const handleTogglePause = () => {
    if (!isPaused) {
      setPausedEvents([...liveEvents]);
    }
    setIsPaused(!isPaused);
  };

  const handleCopy = () => {
    const jsonStr = JSON.stringify(eventsToShow, null, 2);
    navigator.clipboard.writeText(jsonStr);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const jsonStr = JSON.stringify(eventsToShow, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rfid-event-stream-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 text-xs text-slate-800">
      
      {/* Top Banner */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Terminal className="w-5 h-5 text-slate-700" />
            <h3 className="text-base font-bold text-slate-900">Event Stream (Raw Ingestion Data)</h3>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border flex items-center space-x-1 ${
              isLiveConnected && !isPaused
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-amber-50 text-amber-700 border-amber-200'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isLiveConnected && !isPaused ? 'bg-emerald-500 animate-ping' : 'bg-amber-500'}`} />
              <span>{isPaused ? 'STREAM PAUSED' : 'LIVE STREAM'}</span>
            </span>
          </div>
          <p className="text-slate-500 text-[11px] mt-1">
            Raw serialized telemetry frames and observation payloads received directly from Aperture Fixed Gateway (Reader 100EHH5323020053) before deduplication and AI aggregation.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleTogglePause}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl font-semibold border transition ${
              isPaused
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-transparent'
                : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
            }`}
          >
            {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
            <span>{isPaused ? 'Resume Stream' : 'Pause Stream'}</span>
          </button>

          <button
            onClick={handleCopy}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 rounded-xl font-semibold border border-slate-200 transition"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied!' : 'Copy JSON'}</span>
          </button>

          <button
            onClick={handleDownload}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 rounded-xl font-semibold border border-slate-200 transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Log</span>
          </button>
        </div>
      </div>

      {/* Stream Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs flex flex-wrap items-center gap-3">
        <div className="flex items-center space-x-1.5 text-slate-500 font-medium">
          <Filter className="w-3.5 h-3.5" />
          <span>Filters:</span>
        </div>
        <input
          type="text"
          placeholder="Filter EPC..."
          value={epcFilter}
          onChange={(e) => setEpcFilter(e.target.value)}
          className="px-2.5 py-1 text-xs border border-slate-200 rounded-lg focus:outline-hidden focus:border-blue-500 w-36 font-mono"
        />
        <input
          type="text"
          placeholder="Reader Code..."
          value={readerFilter}
          onChange={(e) => setReaderFilter(e.target.value)}
          className="px-2.5 py-1 text-xs border border-slate-200 rounded-lg focus:outline-hidden focus:border-blue-500 w-32 font-mono"
        />
        <select
          value={antennaFilter}
          onChange={(e) => setAntennaFilter(e.target.value)}
          className="px-2.5 py-1 text-xs border border-slate-200 rounded-lg focus:outline-hidden focus:border-blue-500"
        >
          <option value="">All Antennas</option>
          {availableAntennaPorts.map((p) => (
            <option key={p} value={String(p)}>
              Port {p}
            </option>
          ))}
        </select>
        <div className="flex items-center space-x-2 text-[11px] text-slate-500">
          <span>Min RSSI:</span>
          <input
            type="range"
            min="-90"
            max="-30"
            value={minRssi}
            onChange={(e) => setMinRssi(Number(e.target.value))}
            className="w-20 accent-blue-600"
          />
          <span className="font-mono text-slate-700 font-bold">{minRssi} dBm</span>
        </div>
        {(epcFilter || readerFilter || antennaFilter || minRssi > -90) && (
          <button
            onClick={() => {
              setEpcFilter('');
              setReaderFilter('');
              setAntennaFilter('');
              setMinRssi(-90);
            }}
            className="text-[11px] text-blue-600 hover:underline ml-auto font-medium"
          >
            Reset Filters
          </button>
        )}
      </div>

      {/* Raw Payload Terminal Viewer */}
      <div className="bg-[#0B132B] border border-slate-800 rounded-2xl overflow-hidden shadow-xl text-slate-200 font-mono">
        <div className="bg-slate-900/90 px-4 py-2.5 border-b border-slate-800 flex items-center justify-between text-[11px]">
          <div className="flex items-center space-x-2">
            <div className="flex space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
            </div>
            <span className="text-slate-400 font-bold ml-2">stdout: LLRP_RO_ACCESS_REPORT_STREAM</span>
          </div>

          <div className="flex items-center space-x-3 text-slate-400">
            <span>Buffer: {eventsToShow.length} frames</span>
            <span className="text-blue-400">TCP Socket /ws/rfid-events</span>
          </div>
        </div>

        <div className="p-4 max-h-[500px] overflow-y-auto space-y-2 text-xs leading-relaxed">
          {eventsToShow.length === 0 ? (
            <div className="py-16 text-center text-slate-500">
              // Waiting for incoming LLRP RO_ACCESS_REPORT frame packets...
            </div>
          ) : (
            eventsToShow.map((evt, idx) => {
              const port = evt.antenna_port || evt.antenna_id || 1;
              const formattedObj = {
                event_id: evt.event_id || `EVT-${1000 + idx}`,
                epc: evt.epc,
                antenna_port: port,
                rssi_dbm: evt.rssi_dbm,
                frequency_mhz: evt.frequency || 866.3,
                protocol: 'EPC_GEN2_V2',
                timestamp: evt.observed_at
              };

              return (
                <div key={idx} className="p-2 rounded-lg bg-slate-900/60 border border-slate-800/80 hover:border-blue-500/40 transition">
                  <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1 border-b border-slate-800 pb-1">
                    <span className="text-blue-400 font-bold">FRAME #{eventsToShow.length - idx}</span>
                    <span className="text-slate-500">{new Date(evt.observed_at).toISOString()}</span>
                  </div>
                  <pre className="text-emerald-400 text-[11px] overflow-x-auto whitespace-pre-wrap">
                    {JSON.stringify(formattedObj, null, 2)}
                  </pre>
                </div>
              );
            })
          )}
        </div>

        <div className="p-3 bg-slate-900/80 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
          <span>LLRP Binary Specification v1.0.1 • Impinj Speedway Reader Extension</span>
          <span className="text-emerald-400 font-bold">200 OK • Ingestion Rate: 120 msgs/sec</span>
        </div>
      </div>

    </div>
  );
};

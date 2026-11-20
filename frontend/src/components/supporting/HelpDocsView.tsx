import React from 'react';
import {
  HelpCircle,
  BookOpen,
  FileCode,
  Radio,
  ExternalLink,
  ShieldCheck,
  Cpu,
  Layers,
  Terminal,
  Activity
} from 'lucide-react';

export const HelpDocsView: React.FC = () => {
  return (
    <div className="space-y-6 text-xs text-slate-800">
      
      {/* Top Banner */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <BookOpen className="w-5 h-5 text-blue-600" />
            <h3 className="text-base font-bold text-slate-900">S3. Help, Documentation & System Architecture</h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
              Technical Reference
            </span>
          </div>
          <p className="text-slate-500 text-[11px] mt-1">
            Complete architectural blueprint, hardware integration guide, OpenAPI Swagger reference, and RF troubleshooting manuals.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <a
            href="/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold shadow-xs transition"
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>Interactive API Docs (/docs)</span>
            <ExternalLink className="w-3 h-3 ml-1" />
          </a>
        </div>
      </div>

      {/* Architecture Blueprint Card */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs space-y-4">
        <h4 className="font-bold text-slate-900 text-sm">Autonomous AIoT Warehouse System Architecture</h4>
        <p className="text-slate-500 text-xs">
          High-performance distributed pipeline connecting edge RFID hardware to calibrated machine learning inferences and WMS reconciliation:
        </p>

        {/* Architecture Flowchart Block */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 pt-2">
          
          <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl text-center space-y-2">
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center mx-auto font-bold font-mono">1</div>
            <strong className="text-slate-900 block text-xs">Physical Layer</strong>
            <p className="text-[11px] text-slate-500">Impinj Speedway R420 + 4 UHF Antennas + Passive Gen2 EPC Tags</p>
          </div>

          <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl text-center space-y-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center mx-auto font-bold font-mono">2</div>
            <strong className="text-slate-900 block text-xs">Edge Collector</strong>
            <p className="text-[11px] text-slate-500">LLRP Socket Ingestion, Deduplication, & 10s Window Aggregator</p>
          </div>

          <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl text-center space-y-2">
            <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center mx-auto font-bold font-mono">3</div>
            <strong className="text-slate-900 block text-xs">AI Inference Engine</strong>
            <p className="text-[11px] text-slate-500">Read-Reliability Predictor + TreeSHAP Root Cause Explanation</p>
          </div>

          <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl text-center space-y-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto font-bold font-mono">4</div>
            <strong className="text-slate-900 block text-xs">Reconciliation Engine</strong>
            <p className="text-[11px] text-slate-500">3-Way Truth Verification (WMS Expected vs AI vs Handheld Scan)</p>
          </div>

          <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl text-center space-y-2">
            <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center mx-auto font-bold font-mono">5</div>
            <strong className="text-slate-900 block text-xs">React 18 Dashboard</strong>
            <p className="text-[11px] text-slate-500">24 Structured Pages, Live WebSockets, Dynamic Configuration</p>
          </div>

        </div>
      </div>

      {/* Guide Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Hardware Guide */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-3">
          <div className="flex items-center space-x-2">
            <Radio className="w-4 h-4 text-blue-600" />
            <h4 className="font-bold text-slate-900 text-sm">Fixed UHF RFID Setup (Impinj Speedway R420)</h4>
          </div>
          <p className="text-slate-500 text-[11px]">
            To connect physical reader hardware to the production system:
          </p>
          <ol className="list-decimal pl-4 space-y-1.5 text-slate-600 text-[11px]">
            <li>Connect reader Ethernet cable to local warehouse LAN on subnet `192.168.1.0/24`.</li>
            <li>Configure static IP address `192.168.1.100` and default LLRP port `5084`.</li>
            <li>Connect Antenna 1 (Shelf A), Antenna 2 (Shelf B), Antenna 3 (Shelf C), Antenna 4 (Shelf D).</li>
            <li>Navigate to <strong>3.1 Reader & Antenna Status</strong> and click <strong>Probe Physical Reader (LLRP/TCP)</strong>.</li>
            <li>The system will discover reader capabilities and automatically switch from SIMULATION to PHYSICAL mode.</li>
          </ol>
        </div>

        {/* API & Developer Reference */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-3">
          <div className="flex items-center space-x-2">
            <Terminal className="w-4 h-4 text-indigo-600" />
            <h4 className="font-bold text-slate-900 text-sm">Backend API & WebSocket Specifications</h4>
          </div>
          <p className="text-slate-500 text-[11px]">
            Key RESTful endpoints and real-time streaming sockets:
          </p>
          <div className="space-y-2 font-mono text-[11px]">
            <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg">
              <span className="text-blue-600 font-bold">GET</span> <span className="text-slate-800">/api/v1/dashboard/summary</span>
              <p className="text-[10px] text-slate-500 font-sans mt-0.5">Cached instantaneous KPI telemetry metrics (&lt;5ms)</p>
            </div>
            <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg">
              <span className="text-emerald-600 font-bold">WS</span> <span className="text-slate-800">/ws/rfid-events</span>
              <p className="text-[10px] text-slate-500 font-sans mt-0.5">Real-time WebSocket feed of Gen2 EPC sweep observations</p>
            </div>
            <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg">
              <span className="text-purple-600 font-bold">POST</span> <span className="text-slate-800">/api/v1/handheld/sessions</span>
              <p className="text-[10px] text-slate-500 font-sans mt-0.5">Trigger mobile reader ground-truth verification session</p>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
};

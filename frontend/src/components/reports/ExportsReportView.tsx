import React, { useState } from 'react';
import {
  Download,
  FileSpreadsheet,
  FileText,
  FileCode,
  CheckCircle2,
  Calendar,
  Layers,
  ArrowRight,
  Clock
} from 'lucide-react';

export const ExportsReportView: React.FC = () => {
  const [reportType, setReportType] = useState('inventory-reconciliation');
  const [format, setFormat] = useState<'CSV' | 'XLSX' | 'PDF' | 'JSON'>('CSV');
  const [downloading, setDownloading] = useState(false);
  const [recentExports, setRecentExports] = useState([
    { name: 'Reconciliation_Audit_20261119.csv', type: 'CSV', date: 'Today, 10:14 AM', size: '248 KB' },
    { name: 'AI_Discrepancies_Weekly_Report.xlsx', type: 'XLSX', date: 'Yesterday, 18:30 PM', size: '1.2 MB' },
    { name: 'LLRP_Raw_Telemetry_Stream.json', type: 'JSON', date: 'Nov 18, 2026', size: '4.8 MB' },
  ]);

  const handleExport = () => {
    setDownloading(true);
    // Direct trigger to backend export endpoint
    const endpointType = reportType === 'inventory-reconciliation' ? 'reconciliation' : 'exceptions';
    window.open(`/api/v1/reports/export/${endpointType}`, '_blank');
    
    // Add to recent list
    setTimeout(() => {
      setRecentExports([
        {
          name: `${reportType}_${new Date().toISOString().slice(0, 10)}.${format.toLowerCase()}`,
          type: format,
          date: 'Just now',
          size: '320 KB'
        },
        ...recentExports
      ]);
      setDownloading(false);
    }, 1000);
  };

  return (
    <div className="space-y-6 text-xs text-slate-800">
      
      {/* Top Banner */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Download className="w-5 h-5 text-blue-600" />
            <h3 className="text-base font-bold text-slate-900">5.5 Data Exports & Audit Archives</h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
              Multi-Format Export Engine
            </span>
          </div>
          <p className="text-slate-500 text-[11px] mt-1">
            Export compliance ledgers, AI discrepancy diagnostic logs, and raw RFID telemetry in standardized formats.
          </p>
        </div>
      </div>

      {/* Export Configuration Card */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs space-y-6 max-w-2xl">
        <h4 className="font-bold text-slate-900 text-sm">Configure Export Package</h4>

        <div className="space-y-4">
          <div>
            <label className="text-slate-700 font-semibold block mb-1.5">Select Report Type</label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:bg-white focus:outline-none"
            >
              <option value="inventory-reconciliation">Inventory Reconciliation & Accuracy Ledger</option>
              <option value="ai-exceptions">AI Discrepancy & Root Cause Diagnostic History</option>
              <option value="hardware-telemetry">Raw UHF RFID Telemetry & LLRP Sweep Frames</option>
              <option value="model-metrics">AI Model Evaluation & Cross-Validation Metrics</option>
            </select>
          </div>

          <div>
            <label className="text-slate-700 font-semibold block mb-1.5">Export Format</label>
            <div className="grid grid-cols-4 gap-3">
              {(['CSV', 'XLSX', 'PDF', 'JSON'] as const).map((fmt) => (
                <button
                  key={fmt}
                  type="button"
                  onClick={() => setFormat(fmt)}
                  className={`py-2.5 px-3 rounded-xl border text-center font-bold text-xs transition ${
                    format === fmt
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {fmt}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
          <span className="text-[11px] text-slate-400">Includes complete ISO timestamp provenance</span>
          <button
            onClick={handleExport}
            disabled={downloading}
            className="flex items-center space-x-1.5 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-xs transition"
          >
            <Download className="w-4 h-4" />
            <span>{downloading ? 'Preparing Archive...' : 'Download Export Report'}</span>
          </button>
        </div>
      </div>

      {/* Recent Exports Table */}
      <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-xs max-w-2xl">
        <div className="p-4 border-b border-slate-100">
          <h4 className="font-bold text-slate-900 text-xs">Recently Generated Archives</h4>
        </div>

        <div className="divide-y divide-slate-100">
          {recentExports.map((f, idx) => (
            <div key={idx} className="p-3.5 flex items-center justify-between hover:bg-slate-50 transition">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 border border-blue-100">
                  <FileSpreadsheet className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-mono font-bold text-slate-900 block text-xs">{f.name}</span>
                  <span className="text-[10px] text-slate-400">{f.date} • {f.size}</span>
                </div>
              </div>

              <button
                onClick={() => handleExport()}
                className="px-3 py-1 bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-600 rounded-lg text-xs font-semibold border border-slate-200 transition"
              >
                Re-download
              </button>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};

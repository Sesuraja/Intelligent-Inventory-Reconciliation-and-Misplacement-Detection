import React, { useState } from 'react';
import { X, Upload, Smartphone, CheckCircle2, FileText, AlertCircle } from 'lucide-react';
import { api } from '../../services/api';

interface HandheldBatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const HandheldBatchModal: React.FC<HandheldBatchModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  if (!isOpen) return null;

  const [deviceCode, setDeviceCode] = useState('HH-01');
  const [operatorName, setOperatorName] = useState('Alex Rivera');
  const [targetShelf, setTargetShelf] = useState('SHELF_A');
  const [csvContent, setCsvContent] = useState(
    'epc,shelf_code,rssi_dbm,barcode\nEPC-9001,SHELF_A,-48.2,QR-SHELF-A\nEPC-9002,SHELF_C,-44.5,QR-SHELF-C\nEPC-9003,SHELF_B,-52.1,QR-SHELF-B\nEPC-9004,SHELF_B,-49.0,QR-SHELF-B'
  );
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setCsvContent(event.target?.result as string);
      };
      reader.readAsText(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setStatusMessage(null);
    try {
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const formData = new FormData();
      formData.append('file', blob, 'handheld_scans.csv');

      const baseUrl = localStorage.getItem('app_api_host')
        ? localStorage.getItem('app_api_host')!.replace(/\/+$/, '') + '/api/v1'
        : '/api/v1';

      const res = await fetch(`${baseUrl}/handheld/sync`, {
        method: 'POST',
        body: formData
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || 'Batch upload failed');
      }

      const data = await res.json();
      setStatusMessage(`Success: Imported ${data.total_scans_imported} physical scans across ${data.unique_epcs} unique tags.`);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1200);
    } catch (err: any) {
      alert(`Upload failed: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-xs p-4">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4 text-xs text-slate-800">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div className="flex items-center space-x-2">
            <Smartphone className="w-5 h-5 text-blue-600" />
            <div>
              <h2 className="text-base font-bold text-slate-900">Import Handheld Scan Batch (CSV)</h2>
              <p className="text-[11px] text-slate-500">Upload physical ground-truth scans captured offline or from handheld cradles</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {statusMessage && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center space-x-2 font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{statusMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="font-semibold block mb-1">Handheld Device:</label>
              <input
                type="text"
                value={deviceCode}
                onChange={(e) => setDeviceCode(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 font-mono"
              />
            </div>
            <div>
              <label className="font-semibold block mb-1">Operator Name:</label>
              <input
                type="text"
                value={operatorName}
                onChange={(e) => setOperatorName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 font-sans"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-semibold">CSV Scan Data Payload:</label>
              <label className="text-[11px] text-blue-600 hover:text-blue-800 cursor-pointer font-medium flex items-center space-x-1">
                <Upload className="w-3 h-3" />
                <span>Upload .CSV File</span>
                <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
              </label>
            </div>
            <textarea
              rows={6}
              value={csvContent}
              onChange={(e) => setCsvContent(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-mono text-[11px] text-slate-900 focus:bg-white focus:outline-none focus:border-blue-500"
            />
            <p className="text-[10px] text-slate-400 mt-1">Columns: epc, shelf_code, rssi_dbm, barcode (optional)</p>
          </div>

          <div className="pt-2 flex justify-end space-x-2 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition flex items-center space-x-1.5 shadow-xs"
            >
              <Upload className="w-4 h-4" />
              <span>{submitting ? 'Importing Batch...' : 'Import Physical Batch'}</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};

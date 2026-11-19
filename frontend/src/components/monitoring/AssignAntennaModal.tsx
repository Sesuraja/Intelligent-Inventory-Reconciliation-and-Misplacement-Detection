import React, { useState } from 'react';
import { X, Radio, Check, Layers, Sliders, Cpu } from 'lucide-react';
import { ShelfItem, ReaderItem } from '../../types';
import { api } from '../../services/api';

interface AssignAntennaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  shelves: ShelfItem[];
  readers: ReaderItem[];
  initialPort?: number;
}

export const AssignAntennaModal: React.FC<AssignAntennaModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  shelves,
  readers,
  initialPort = 1
}) => {
  const [readerId, setReaderId] = useState<number>(readers[0]?.id || 1);
  const [portNumber, setPortNumber] = useState<number>(initialPort);
  const [shelfId, setShelfId] = useState<number>(shelves[0]?.id || 1);
  const [antennaCode, setAntennaCode] = useState(`ANT-0${initialPort}`);
  const [txPower, setTxPower] = useState('30.0');
  const [gain, setGain] = useState('6.0');
  const [purpose, setPurpose] = useState('PRIMARY_DETECTION');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handlePortChange = (port: number) => {
    setPortNumber(port);
    setAntennaCode(`ANT-0${port}`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api.assignAntenna({
        reader_id: readerId,
        port_number: portNumber,
        shelf_id: shelfId,
        antenna_code: antennaCode.trim().toUpperCase(),
        tx_power_dbm: parseFloat(txPower) || 30.0,
        gain_dbi: parseFloat(gain) || 6.0,
        purpose: purpose
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to map antenna to shelf and reader');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/80 w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-700">
              <Radio className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Map Antenna to Shelf & Reader</h3>
              <p className="text-[11px] text-slate-500">Configure RF sweep port, target storage shelf, and transmit power</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-[11px]">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Target Fixed Reader</label>
              <select
                value={readerId}
                onChange={(e) => setReaderId(parseInt(e.target.value))}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white transition"
              >
                {readers.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.reader_code} ({r.model})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Reader Port Number</label>
              <div className="grid grid-cols-4 gap-1.5">
                {[1, 2, 3, 4].map((port) => (
                  <button
                    key={port}
                    type="button"
                    onClick={() => handlePortChange(port)}
                    className={`py-1.5 rounded-lg font-mono font-bold text-xs border transition ${
                      portNumber === port
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Port {port}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Assigned Warehouse Shelf <span className="text-rose-500">*</span>
              </label>
              <select
                value={shelfId}
                onChange={(e) => setShelfId(parseInt(e.target.value))}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white transition"
              >
                {shelves.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.shelf_code} {s.name ? `(${s.name})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Antenna Code / Identifier</label>
              <input
                type="text"
                value={antennaCode}
                onChange={(e) => setAntennaCode(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white transition"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Tx Power (dBm)</label>
              <select
                value={txPower}
                onChange={(e) => setTxPower(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white transition"
              >
                <option value="20.0">20.0 dBm (0.1 W)</option>
                <option value="24.0">24.0 dBm (0.25 W)</option>
                <option value="27.0">27.0 dBm (0.5 W)</option>
                <option value="30.0">30.0 dBm (1.0 W - Full)</option>
                <option value="31.5">31.5 dBm (Max Boost)</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Gain (dBi)</label>
              <input
                type="number"
                step="0.5"
                value={gain}
                onChange={(e) => setGain(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white transition"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Antenna Role</label>
              <select
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white transition"
              >
                <option value="PRIMARY_DETECTION">Primary Detection</option>
                <option value="CROSS_AISLE_MONITOR">Cross-Aisle Leakage</option>
                <option value="PORTAL_GATEWAY">Portal Gateway</option>
              </select>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold shadow-xs flex items-center space-x-1.5 transition disabled:opacity-50"
            >
              {submitting ? <span>Saving...</span> : <><Check className="w-3.5 h-3.5" /><span>Save Antenna Mapping</span></>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};


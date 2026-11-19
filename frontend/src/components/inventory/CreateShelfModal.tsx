import React, { useState } from 'react';
import { X, Layers, Plus, Check } from 'lucide-react';
import { api } from '../../services/api';

interface CreateShelfModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const CreateShelfModal: React.FC<CreateShelfModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [shelfCode, setShelfCode] = useState('');
  const [shelfName, setShelfName] = useState('');
  const [capacity, setCapacity] = useState('30');
  const [categoryRestriction, setCategoryRestriction] = useState('ALL');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shelfCode.trim()) {
      setError('Shelf code is required (e.g. SHELF_E or BAY_05)');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await api.createShelf({
        shelf_code: shelfCode.trim().toUpperCase(),
        name: shelfName.trim() || `Shelf ${shelfCode.trim().toUpperCase()}`,
        capacity: parseInt(capacity) || 30,
        category_restriction: categoryRestriction === 'ALL' ? undefined : categoryRestriction,
        zone_id: 1
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create shelf location');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/80 w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-700">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Create Warehouse Shelf</h3>
              <p className="text-[11px] text-slate-500">Add a new storage location for RFID tracking</p>
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

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Shelf Identifier Code <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. SHELF_E, BAY_05"
              value={shelfCode}
              onChange={(e) => setShelfCode(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white transition"
              required
            />
            <span className="text-[10px] text-slate-400 mt-1 block">
              Auto-converted to uppercase; used in antenna mapping and WMS routing.
            </span>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Display Name / Description</label>
            <input
              type="text"
              placeholder="e.g. Shelf E - High Velocity Rack"
              value={shelfName}
              onChange={(e) => setShelfName(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white transition"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Storage Capacity (Units)</label>
              <input
                type="number"
                min="5"
                max="200"
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white transition"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Category Restriction</label>
              <select
                value={categoryRestriction}
                onChange={(e) => setCategoryRestriction(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white transition"
              >
                <option value="ALL">Any Category</option>
                <option value="Electronics">Electronics</option>
                <option value="Batteries">Batteries</option>
                <option value="Industrial">Industrial</option>
                <option value="Networking">Networking</option>
                <option value="Automation">Automation</option>
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
              {submitting ? <span>Creating...</span> : <><Check className="w-3.5 h-3.5" /><span>Create Shelf</span></>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};


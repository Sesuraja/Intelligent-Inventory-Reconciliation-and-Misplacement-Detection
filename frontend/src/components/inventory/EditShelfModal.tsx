import React, { useState, useEffect } from 'react';
import { X, Layers, Save, Trash2 } from 'lucide-react';
import { ShelfItem } from '../../types';
import { api } from '../../services/api';

interface EditShelfModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  shelf: ShelfItem | null;
  onDelete?: (id: number) => void;
}

export const EditShelfModal: React.FC<EditShelfModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  shelf,
  onDelete
}) => {
  const [shelfName, setShelfName] = useState('');
  const [capacity, setCapacity] = useState('30');
  const [categoryRestriction, setCategoryRestriction] = useState('ALL');
  const [coordX, setCoordX] = useState('0');
  const [coordY, setCoordY] = useState('0');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (shelf) {
      setShelfName(shelf.name || `Shelf ${shelf.shelf_code}`);
      setCapacity(String(shelf.capacity || 30));
      setCategoryRestriction(shelf.category_restriction || 'ALL');
      setCoordX(String(shelf.coord_x || 0));
      setCoordY(String(shelf.coord_y || 0));
    }
  }, [shelf]);

  if (!isOpen || !shelf) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api.updateShelf(shelf.id, {
        name: shelfName.trim() || `Shelf ${shelf.shelf_code}`,
        capacity: parseInt(capacity) || 30,
        category_restriction: categoryRestriction === 'ALL' ? undefined : categoryRestriction,
        coord_x: parseFloat(coordX) || 0,
        coord_y: parseFloat(coordY) || 0
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to update shelf location');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Are you sure you want to delete shelf ${shelf.shelf_code}?`)) return;
    setSubmitting(true);
    try {
      await api.deleteShelf(shelf.id);
      onDelete?.(shelf.id);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to delete shelf');
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
            <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-700">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Edit Shelf: {shelf.shelf_code}</h3>
              <p className="text-[11px] text-slate-500">Configure storage dimensions, limits, and spatial positioning</p>
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
            <label className="block font-semibold text-slate-700 mb-1">Shelf Friendly Name</label>
            <input
              type="text"
              value={shelfName}
              onChange={(e) => setShelfName(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white transition"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Max Capacity (Units)</label>
              <input
                type="number"
                min="1"
                max="500"
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white transition"
                required
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Category Lock</label>
              <select
                value={categoryRestriction}
                onChange={(e) => setCategoryRestriction(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white transition"
              >
                <option value="ALL">Any Category</option>
                <option value="Electronics">Electronics</option>
                <option value="Automotive">Automotive</option>
                <option value="Footwear">Footwear</option>
                <option value="Apparel">Apparel</option>
                <option value="Industrial">Industrial</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">X Coordinate (m)</label>
              <input
                type="number"
                step="0.5"
                value={coordX}
                onChange={(e) => setCoordX(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white transition"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Y Coordinate (m)</label>
              <input
                type="number"
                step="0.5"
                value={coordY}
                onChange={(e) => setCoordY(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white transition"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={handleDelete}
              disabled={submitting}
              className="flex items-center space-x-1.5 px-3 py-2 text-rose-600 hover:bg-rose-50 rounded-xl text-xs font-medium transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Shelf</span>
            </button>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl text-xs font-medium hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex items-center space-x-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs transition disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{submitting ? 'Saving...' : 'Save'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

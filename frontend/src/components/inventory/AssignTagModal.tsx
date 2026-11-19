import React, { useState } from 'react';
import { X, Tag, Check, Package, Layers, ShieldAlert } from 'lucide-react';
import { ProductItem, ShelfItem } from '../../types';
import { api } from '../../services/api';

interface AssignTagModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  products: ProductItem[];
  shelves: ShelfItem[];
}

export const AssignTagModal: React.FC<AssignTagModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  products,
  shelves
}) => {
  const [epc, setEpc] = useState('');
  const [productId, setProductId] = useState<number>(products[0]?.id || 1);
  const [shelfId, setShelfId] = useState<number>(shelves[0]?.id || 1);
  const [packagingClass, setPackagingClass] = useState('CARDBOARD');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!epc.trim()) {
      setError('EPC Identifier is required (e.g. EPC-9025)');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await api.assignTagToProduct({
        epc: epc.trim().toUpperCase(),
        product_id: productId,
        expected_shelf_id: shelfId,
        packaging_class: packagingClass,
        tag_type: 'EPC_GEN2_UHF'
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to assign tag to product');
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
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700">
              <Tag className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Assign RFID Tag to Product</h3>
              <p className="text-[11px] text-slate-500">Map serialized EPC to master SKU and designate storage shelf</p>
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
              Select Master Product (SKU) <span className="text-rose-500">*</span>
            </label>
            <select
              value={productId}
              onChange={(e) => setProductId(parseInt(e.target.value))}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white transition"
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.sku} — {p.name} (${p.unit_cost?.toFixed(2)})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Serialized Tag EPC (Gen2 UHF) <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. EPC-9025 or 3034257BF400B7800004FB12"
              value={epc}
              onChange={(e) => setEpc(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white transition"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Expected Storage Shelf <span className="text-rose-500">*</span>
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
              <label className="block font-semibold text-slate-700 mb-1">Packaging RF Profile</label>
              <select
                value={packagingClass}
                onChange={(e) => setPackagingClass(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white transition"
              >
                <option value="CARDBOARD">Cardboard (Nominal)</option>
                <option value="PLASTIC">Plastic Enclosure</option>
                <option value="METAL_SHIELDED">Metal / Foil Shielded (-26 dB)</option>
                <option value="LIQUID_PROXIMITY">Liquid Proximity Container</option>
              </select>
            </div>
          </div>

          {/* AI Helper Banner */}
          <div className="p-3 bg-blue-50 border border-blue-200/80 rounded-xl flex items-start space-x-2 text-[11px] text-blue-800">
            <ShieldAlert className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <span>
              Setting a metallic/liquid packaging class informs the Read-Reliability AI to classify non-detections as <strong>RF Shadowing</strong> rather than triggering false shrinkage alarms.
            </span>
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
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold shadow-xs flex items-center space-x-1.5 transition disabled:opacity-50"
            >
              {submitting ? <span>Assigning...</span> : <><Check className="w-3.5 h-3.5" /><span>Assign Tag</span></>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};


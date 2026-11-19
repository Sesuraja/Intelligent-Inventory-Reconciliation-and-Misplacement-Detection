import React, { useState } from 'react';
import { X, CheckCircle2, AlertTriangle, EyeOff, Radio, ShieldCheck } from 'lucide-react';
import { DiscrepancyItem, ShelfItem } from '../../types';

interface VerificationModalProps {
  discrepancy: DiscrepancyItem | null;
  shelves: ShelfItem[];
  isOpen: boolean;
  onClose: () => void;
  onSubmitVerification: (discrepancyId: number, result: string, actualShelfId: number | null, notes: string) => Promise<void>;
}

export const VerificationModal: React.FC<VerificationModalProps> = ({
  discrepancy,
  shelves,
  isOpen,
  onClose,
  onSubmitVerification
}) => {
  if (!isOpen || !discrepancy) return null;

  const [selectedResult, setSelectedResult] = useState<string>('CONFIRMED_MISPLACED');
  const [actualShelfId, setActualShelfId] = useState<number>(
    discrepancy.observed_location_id || discrepancy.expected_location_id || 1
  );
  const [operatorNotes, setOperatorNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSubmitVerification(discrepancy.id, selectedResult, actualShelfId, operatorNotes);
      onClose();
    } catch (err: any) {
      alert(`Verification failed: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-xs p-4">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-5 text-xs text-slate-800">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            <h2 className="text-base font-bold text-slate-900">Physical Shelf Ground Truth Verification</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Item Summary Banner */}
        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1">
          <div className="flex justify-between items-center">
            <span className="font-mono font-bold text-slate-900 text-sm">{discrepancy.epc}</span>
            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
              {discrepancy.discrepancy_type}
            </span>
          </div>
          <p className="text-slate-700 font-medium">{discrepancy.product_name} ({discrepancy.product_sku})</p>
          <div className="flex items-center space-x-3 text-slate-500 pt-1 text-[11px]">
            <span>Expected: <strong className="text-blue-700 font-mono">{discrepancy.expected_shelf_code}</strong></span>
            <span>Observed: <strong className="text-amber-700 font-mono">{discrepancy.observed_shelf_code || 'None'}</strong></span>
          </div>
        </div>

        {/* Verification Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          
          <div>
            <label className="text-slate-800 font-semibold block mb-2">Physical Condition Confirmed by Operator:</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'CONFIRMED_MISPLACED', label: 'Confirmed Misplaced', icon: AlertTriangle, desc: 'Found at different shelf' },
                { id: 'CONFIRMED_PRESENT', label: 'Confirmed In-Place', icon: CheckCircle2, desc: 'Found at expected shelf (false alarm)' },
                { id: 'CONFIRMED_MISSED_READ', label: 'RFID Missed Read', icon: Radio, desc: 'Present but shielded/shadowed' },
                { id: 'CONFIRMED_MISSING', label: 'Confirmed Missing', icon: EyeOff, desc: 'Genuinely absent / shrinkage' },
              ].map((opt) => {
                const Icon = opt.icon;
                const isSelected = selectedResult === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSelectedResult(opt.id)}
                    className={`p-3 rounded-xl border text-left flex flex-col justify-between transition ${
                      isSelected
                        ? 'bg-blue-50/80 border-blue-500 text-blue-950 shadow-xs'
                        : 'bg-slate-50/60 border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center space-x-1.5 mb-1">
                      <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-blue-600' : 'text-slate-400'}`} />
                      <span className="font-semibold text-xs text-slate-900">{opt.label}</span>
                    </div>
                    <span className="text-[10px] text-slate-500">{opt.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {selectedResult === 'CONFIRMED_MISPLACED' && (
            <div>
              <label className="text-slate-800 font-semibold block mb-1">Actual Physical Shelf Confirmed:</label>
              <select
                value={actualShelfId}
                onChange={(e) => setActualShelfId(Number(e.target.value))}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-mono focus:bg-white focus:outline-none focus:border-blue-500"
              >
                {shelves.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.shelf_code} - {s.name || 'Shelf'}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-slate-500 mt-1">
                Selecting this shelf will log an authorized reconciliation movement and update official WMS stock.
              </p>
            </div>
          )}

          <div>
            <label className="text-slate-800 font-semibold block mb-1">Operator Audit Notes:</label>
            <textarea
              rows={2}
              placeholder="e.g. Physically inspected bin. Carton placed behind metal partition on Shelf C."
              value={operatorNotes}
              onChange={(e) => setOperatorNotes(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-blue-500"
            />
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
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold transition flex items-center space-x-1.5 shadow-xs"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{submitting ? 'Recording Truth...' : 'Submit Verification'}</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};

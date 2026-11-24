import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, AlertTriangle, EyeOff, Radio, ShieldCheck, Smartphone, QrCode, Battery } from 'lucide-react';
import { DiscrepancyItem, ShelfItem } from '../../types';
import { api } from '../../services/api';

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

  const [mode, setMode] = useState<'handheld' | 'override'>('handheld');
  const [selectedResult, setSelectedResult] = useState<string>('CONFIRMED_MISPLACED');
  const [actualShelfId, setActualShelfId] = useState<number>(
    discrepancy.observed_location_id || discrepancy.expected_location_id || (shelves[0]?.id || 1)
  );
  const [operatorNotes, setOperatorNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [handheldReaders, setHandheldReaders] = useState<any[]>([]);
  const [selectedDeviceCode, setSelectedDeviceCode] = useState<string>('HH-01');
  const [scannedBarcode, setScannedBarcode] = useState<string>('');

  // Supervisor Manual Override fields
  const [overrideState, setOverrideState] = useState<string>('present_ok');
  const [overrideConfirmed, setOverrideConfirmed] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const [supervisorName, setSupervisorName] = useState('Warehouse Supervisor');

  useEffect(() => {
    api.getHandheldReaders()
      .then((readers) => {
        setHandheldReaders(readers);
        if (readers.length > 0) {
          setSelectedDeviceCode(readers[0].device_code);
        }
      })
      .catch(() => {});
  }, []);

  const selectedShelfObj = shelves.find((s) => s.id === actualShelfId);

  const simulateBarcodeScan = () => {
    const code = selectedShelfObj ? `QR-${selectedShelfObj.shelf_code}` : 'QR-SHELF-A';
    setScannedBarcode(code);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (mode === 'override') {
        if (!overrideConfirmed) {
          alert('You must check the supervisor confirmation box before submitting manual override.');
          setSubmitting(false);
          return;
        }
        await api.overrideException(discrepancy.id, {
          override_state: overrideState,
          confirmation: true,
          reason: overrideReason || 'Supervisor physically verified bin presence',
          supervisor_name: supervisorName
        });
        await onSubmitVerification(discrepancy.id, overrideState, actualShelfId, overrideReason);
      } else {
        const shelfCode = selectedShelfObj ? selectedShelfObj.shelf_code : (discrepancy.observed_shelf_code || 'SHELF_A');
        await api.submitGroundTruthVerification({
          discrepancy_id: discrepancy.id,
          epc: discrepancy.epc,
          actual_shelf_code: shelfCode,
          verification_status: selectedResult,
          device_code: selectedDeviceCode,
          barcode_scanned: scannedBarcode || `QR-${shelfCode}`,
          notes: operatorNotes || `Verified via ${selectedDeviceCode}`
        });
        await onSubmitVerification(discrepancy.id, selectedResult, actualShelfId, operatorNotes);
      }
      onClose();
    } catch (err: any) {
      alert(`Verification failed: ${err.message}`);
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
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            <div>
              <h2 className="text-base font-bold text-slate-900">Physical Ground Truth Verification</h2>
              <p className="text-[11px] text-slate-500">Handheld UHF scan overrides fixed-reader predictions unconditionally</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Selector Tabs */}
        <div className="flex border border-slate-200 rounded-xl overflow-hidden bg-slate-50 p-0.5">
          <button
            type="button"
            onClick={() => setMode('handheld')}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition ${
              mode === 'handheld' ? 'bg-white shadow-2xs text-slate-900' : 'text-slate-500'
            }`}
          >
            Handheld Ground Truth Scan
          </button>
          <button
            type="button"
            onClick={() => setMode('override')}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition ${
              mode === 'override' ? 'bg-white shadow-2xs text-slate-900' : 'text-slate-500'
            }`}
          >
            Supervisor Manual Override
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
          {mode === 'override' ? (
            <div className="space-y-3 bg-amber-50/50 p-4 rounded-xl border border-amber-200">
              <div className="font-bold text-slate-900 text-xs flex items-center space-x-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>Supervisor Manual Override (SHA-256 Audit Chained)</span>
              </div>
              <p className="text-[11px] text-slate-600">
                Directly force-resolves exception state and logs a cryptographically sealed supervisor override event.
              </p>

              <div>
                <label className="text-slate-800 font-semibold block mb-1">Target Classification State:</label>
                <select
                  value={overrideState}
                  onChange={(e) => setOverrideState(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-900 font-medium"
                >
                  <option value="present_ok">present_ok (Physically verified in correct location)</option>
                  <option value="likely_unread">likely_unread (Confirmed present but RF unread)</option>
                  <option value="likely_absent_or_misplaced">likely_absent_or_misplaced (Confirmed missing/misplaced)</option>
                  <option value="uncertain_verify">uncertain_verify (Flagged for rescan)</option>
                </select>
              </div>

              <div>
                <label className="text-slate-800 font-semibold block mb-1">Supervisor Name / ID:</label>
                <input
                  type="text"
                  value={supervisorName}
                  onChange={(e) => setSupervisorName(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-900 font-medium"
                />
              </div>

              <div>
                <label className="text-slate-800 font-semibold block mb-1">Physical Verification Reason / Justification:</label>
                <textarea
                  rows={2}
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="e.g. Supervisor physically inspected Bay A and confirmed presence behind metal divider..."
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-900 placeholder-slate-400"
                />
              </div>

              <label className="flex items-start space-x-2 pt-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={overrideConfirmed}
                  onChange={(e) => setOverrideConfirmed(e.target.checked)}
                  className="mt-0.5 rounded text-amber-600 focus:ring-amber-500"
                />
                <span className="text-[11px] font-bold text-slate-900">
                  I confirm that I have physically inspected this bin/shelf and take operational responsibility for overriding AI state.
                </span>
              </label>
            </div>
          ) : (
            <>
              {/* Handheld Device Selection */}
              <div className="bg-blue-50/50 p-3 rounded-xl border border-blue-100 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-slate-800 font-semibold flex items-center space-x-1.5">
                    <Smartphone className="w-3.5 h-3.5 text-blue-600" />
                    <span>Handheld RFID Reader:</span>
                  </label>
                  {handheldReaders.length > 0 && (
                    <span className="flex items-center space-x-1 text-[10px] text-emerald-700 font-medium bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      <Battery className="w-3 h-3 text-emerald-600" />
                      <span>{handheldReaders.find(r => r.device_code === selectedDeviceCode)?.battery_level ?? 94}% Battery</span>
                    </span>
                  )}
                </div>
                <select
                  value={selectedDeviceCode}
                  onChange={(e) => setSelectedDeviceCode(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-900 font-medium focus:outline-none focus:border-blue-500"
                >
                  {handheldReaders.map((r) => (
                    <option key={r.id} value={r.device_code}>
                      {r.device_code} - {r.model} ({r.assigned_operator})
                    </option>
                  ))}
                </select>
              </div>

              {/* Result Buttons */}
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
                        className={`p-2.5 rounded-xl border text-left flex flex-col justify-between transition ${
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
                </div>
              )}

              {/* Barcode / QR Scan verification */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-800 font-semibold flex items-center space-x-1">
                    <QrCode className="w-3.5 h-3.5 text-slate-600" />
                    <span>Location Barcode / QR Scan:</span>
                  </label>
                  <button
                    type="button"
                    onClick={simulateBarcodeScan}
                    className="text-[10px] text-blue-600 hover:text-blue-800 font-medium underline"
                  >
                    Auto-Scan Shelf QR
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="Scan shelf QR code with handheld camera..."
                  value={scannedBarcode}
                  onChange={(e) => setScannedBarcode(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 font-mono text-slate-900 focus:bg-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-slate-800 font-semibold block mb-1">Operator Audit Notes:</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Scanned bin with Zebra RFD40. Confirmed carton placed behind metal partition."
                  value={operatorNotes}
                  onChange={(e) => setOperatorNotes(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </>
          )}

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
              className={`px-4 py-2 rounded-xl font-semibold transition flex items-center space-x-1.5 shadow-xs text-white ${
                mode === 'override' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {submitting
                  ? 'Recording...'
                  : mode === 'override'
                  ? 'Execute Supervisor Override'
                  : 'Confirm Ground Truth'}
              </span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};

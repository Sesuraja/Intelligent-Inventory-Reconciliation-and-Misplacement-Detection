import React, { useState } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  RotateCw,
  Smartphone,
  ArrowRight,
  Layers,
  Clock,
  UserCheck,
  HelpCircle,
  FileCheck2,
  AlertCircle
} from 'lucide-react';
import { DiscrepancyItem, ShelfItem } from '../../types';
import { api } from '../../services/api';
import { useAppSettings } from '../../context/SettingsContext';

interface VerificationActionsViewProps {
  selectedException: DiscrepancyItem | null;
  shelves: ShelfItem[];
  onRefresh: () => void;
  onOpenVerificationModal?: () => void;
}

export const VerificationActionsView: React.FC<VerificationActionsViewProps> = ({
  selectedException,
  shelves,
  onRefresh,
  onOpenVerificationModal
}) => {
  const { settings } = useAppSettings();
  const [resolving, setResolving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!selectedException) {
    return (
      <div className="bg-white border border-slate-200/90 rounded-2xl p-12 text-center text-slate-500 shadow-xs">
        <ShieldCheck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <h3 className="text-base font-bold text-slate-800">No Exception Selected</h3>
        <p className="text-xs text-slate-400 mt-1">
          Select an inventory discrepancy to verify ground-truth observations and commit inventory reconciliation.
        </p>
      </div>
    );
  }

  const handleUpdateLocation = async () => {
    setResolving(true);
    try {
      await api.resolveException(selectedException.id, {
        resolution_action: 'UPDATE_WMS_LOCATION',
        notes: `Reconciled location to ${selectedException.observed_shelf_code || 'UNASSIGNED'} by ${settings.currentUser.name} (${settings.currentUser.role})`
      });
      setSuccessMessage('WMS Master inventory location updated successfully to match physical shelf.');
      onRefresh();
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      alert(`Error updating location: ${err.message}`);
    } finally {
      setResolving(false);
    }
  };

  const handleMarkResolved = async () => {
    setResolving(true);
    try {
      await api.resolveException(selectedException.id, {
        resolution_action: 'MARK_RESOLVED',
        notes: `Exception marked as resolved by ${settings.currentUser.name} (${settings.currentUser.role})`
      });
      setSuccessMessage('Exception marked as resolved in reconciliation audit ledger.');
      onRefresh();
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      alert(`Error marking resolved: ${err.message}`);
    } finally {
      setResolving(false);
    }
  };

  return (
    <div className="space-y-6 text-xs text-slate-800">
      
      {/* Top Banner */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            <h3 className="text-base font-bold text-slate-900">Verification & Action Management</h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              Closed-Loop Reconciliation
            </span>
          </div>
          <p className="text-slate-500 text-[11px] mt-1">
            Authorize WMS inventory adjustments, log manual or handheld physical checks, and clear false-positive RF anomalies.
          </p>
        </div>
      </div>

      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 flex items-center space-x-2 text-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Action Decision Card */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-mono text-base font-bold text-slate-900">{selectedException.epc}</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                {selectedException.discrepancy_type}
              </span>
            </div>
            <p className="text-slate-500 text-xs mt-1">
              Expected: <strong className="text-slate-900 font-mono">{selectedException.expected_shelf_code}</strong> | Observed: <strong className="text-blue-600 font-mono">{selectedException.observed_shelf_code || selectedException.expected_shelf_code}</strong>
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleUpdateLocation}
              disabled={resolving}
              className="flex items-center space-x-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold shadow-xs transition"
            >
              <FileCheck2 className="w-3.5 h-3.5" />
              <span>Update Location (WMS)</span>
            </button>

            <button
              onClick={handleMarkResolved}
              disabled={resolving}
              className="flex items-center space-x-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold shadow-xs transition"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Mark as Resolved</span>
            </button>
          </div>
        </div>

        {/* Verification History Table */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-slate-900 text-xs">Verification History & Audit Log</h4>
            <span className="text-[10px] font-mono text-slate-400">Immutable Audit Trail</span>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold text-[10px]">
                <tr>
                  <th className="py-2.5 px-4">Verification Type</th>
                  <th className="py-2.5 px-4">Observed Location</th>
                  <th className="py-2.5 px-4">Result Status</th>
                  <th className="py-2.5 px-4">Verifier / Source</th>
                  <th className="py-2.5 px-4 text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 font-mono">
                <tr className="hover:bg-slate-50/50">
                  <td className="py-2.5 px-4 font-sans font-semibold text-indigo-700 flex items-center space-x-1.5">
                    <Smartphone className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Handheld Scan</span>
                  </td>
                  <td className="py-2.5 px-4 font-bold text-slate-900">{selectedException.observed_shelf_code || selectedException.expected_shelf_code}</td>
                  <td className="py-2.5 px-4 font-sans">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Confirmed
                    </span>
                  </td>
                  <td className="py-2.5 px-4 font-sans text-slate-600">Marcus Vance (HH-01)</td>
                  <td className="py-2.5 px-4 font-sans text-right text-slate-500 text-[11px]">10:42 AM</td>
                </tr>

                <tr className="hover:bg-slate-50/50">
                  <td className="py-2.5 px-4 font-sans font-semibold text-blue-700 flex items-center space-x-1.5">
                    <Clock className="w-3.5 h-3.5 text-blue-600" />
                    <span>System (AI Engine)</span>
                  </td>
                  <td className="py-2.5 px-4 font-bold text-slate-900">{selectedException.observed_shelf_code || selectedException.expected_shelf_code}</td>
                  <td className="py-2.5 px-4 font-sans">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                      Predicted
                    </span>
                  </td>
                  <td className="py-2.5 px-4 font-sans text-slate-600">Aperture UHF Fixed Gateway</td>
                  <td className="py-2.5 px-4 font-sans text-right text-slate-500 text-[11px]">10:30 AM</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

    </div>
  );
};

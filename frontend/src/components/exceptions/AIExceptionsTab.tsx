import React, { useState, useEffect } from 'react';
import {
  Search,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  MapPin,
  Check,
  Filter,
  Smartphone
} from 'lucide-react';
import { DiscrepancyItem, ShelfItem } from '../../types';
import { api } from '../../services/api';
import { VerificationModal } from './VerificationModal';
import { HandheldBatchModal } from './HandheldBatchModal';
import { StatusBadge } from '../common/StatusBadge';
import { LoadingState } from '../common/LoadingState';
import { EmptyState } from '../common/EmptyState';
import { useAppSettings } from '../../context/SettingsContext';

interface AIExceptionsTabProps {
  initialFilter?: string;
  shelves: ShelfItem[];
  onRefreshData: () => void;
}

export const AIExceptionsTab: React.FC<AIExceptionsTabProps> = ({
  initialFilter,
  shelves,
  onRefreshData
}) => {
  const { settings } = useAppSettings();
  const [exceptions, setExceptions] = useState<DiscrepancyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>(initialFilter || 'ALL');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Selected exception for deep AI inspection drawer
  const [selectedException, setSelectedException] = useState<DiscrepancyItem | null>(null);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);

  useEffect(() => {
    loadExceptions();
  }, []);

  useEffect(() => {
    if (initialFilter) {
      setFilterType(initialFilter);
    }
  }, [initialFilter]);

  const loadExceptions = async () => {
    setLoading(true);
    try {
      const data = await api.getExceptions();
      setExceptions(data);
      if (data.length > 0 && !selectedException) {
        setSelectedException(data[0]);
      }
    } catch (err) {
      console.error('Error fetching exceptions:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifySubmit = async (
    discrepancyId: number,
    result: string,
    actualShelfId: number | null,
    notes: string
  ) => {
    await api.verifyException(discrepancyId, {
      verification_result: result,
      actual_location_id: actualShelfId,
      notes,
      verified_by_name: `${settings.currentUser.name} (${settings.currentUser.role})`
    });
    await loadExceptions();
    onRefreshData();
  };

  const handleResolve = async (discrepancyId: number) => {
    await api.resolveException(discrepancyId, {
      resolution_action: 'UPDATE_WMS_LOCATION',
      notes: `Resolution confirmed by ${settings.currentUser.name} (${settings.currentUser.role})`
    });
    await loadExceptions();
    onRefreshData();
  };

  const filteredExceptions = exceptions.filter((exc) => {
    const matchesFilter = filterType === 'ALL' || exc.discrepancy_type === filterType;
    const matchesSearch =
      exc.epc.toLowerCase().includes(searchQuery.toLowerCase()) ||
      exc.product_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      exc.product_sku.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const getCauseBadge = (cause: string | null) => {
    if (!cause) return <span className="text-slate-400 italic text-[11px]">Evaluating</span>;
    return (
      <span className="font-mono text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
        {cause.replace(/_/g, ' ')}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      
      {/* Filter Tabs & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200/90 p-4 rounded-2xl shadow-xs">
        
        {/* Pills */}
        <div className="flex flex-wrap gap-1.5 text-xs font-semibold">
          {[
            { id: 'ALL', label: 'All Discrepancies', count: exceptions.length },
            { id: 'MISPLACED', label: 'Misplaced', count: exceptions.filter(e => e.discrepancy_type === 'MISPLACED').length },
            { id: 'LIKELY_MISSING', label: 'Likely Missing', count: exceptions.filter(e => e.discrepancy_type === 'LIKELY_MISSING').length },
            { id: 'POSSIBLE_UNREAD', label: 'RF Unread (Shadowed)', count: exceptions.filter(e => e.discrepancy_type === 'POSSIBLE_UNREAD').length },
            { id: 'AMBIGUOUS', label: 'Ambiguous', count: exceptions.filter(e => e.discrepancy_type === 'AMBIGUOUS').length },
          ].map((pill) => {
            const active = filterType === pill.id;
            return (
              <button
                key={pill.id}
                onClick={() => setFilterType(pill.id)}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl transition ${
                  active
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                }`}
              >
                <span>{pill.label}</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${active ? 'bg-blue-800 text-white' : 'bg-white text-slate-700'}`}>
                  {pill.count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => setShowBatchModal(true)}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-semibold shadow-xs transition"
          >
            <Smartphone className="w-3.5 h-3.5 text-blue-600" />
            <span>+ Handheld Batch (CSV)</span>
          </button>

          {/* Search */}
          <div className="relative w-full sm:w-60">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search exceptions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white transition"
            />
          </div>
        </div>

      </div>

      {/* Main Split Layout: Exceptions List & AI Inspection Drawer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Side: Exceptions List (7 Cols) */}
        <div className="lg:col-span-7 bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto max-h-[640px] overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 z-10 shadow-xs">
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                  <th className="py-3 px-3.5">EPC / Product</th>
                  <th className="py-3 px-3">Type</th>
                  <th className="py-3 px-3">Expected vs Observed</th>
                  <th className="py-3 px-3">AI Root-Cause</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-12">
                      <LoadingState message="Fetching active AI exceptions..." />
                    </td>
                  </tr>
                ) : filteredExceptions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12">
                      <EmptyState
                        title="No Exceptions in this Queue"
                        description="All items in this category are reconciled or verified."
                        actionLabel="Show All Discrepancies"
                        onAction={() => setFilterType('ALL')}
                      />
                    </td>
                  </tr>
                ) : (
                  filteredExceptions.map((exc) => {
                    const isSelected = selectedException?.id === exc.id;
                    return (
                      <tr
                        key={exc.id}
                        onClick={() => setSelectedException(exc)}
                        className={`cursor-pointer transition ${
                          isSelected ? 'bg-blue-50/70 border-l-4 border-blue-600' : 'hover:bg-slate-50/70'
                        }`}
                      >
                        <td className="py-3 px-3.5">
                          <span className="font-mono font-bold text-slate-900 block">{exc.epc}</span>
                          <span className="text-[11px] text-slate-500 truncate max-w-[150px] block">
                            {exc.product_name}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <StatusBadge status={exc.discrepancy_type} />
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center space-x-1.5 font-mono text-[11px]">
                            <span className="text-blue-600 font-bold">{exc.expected_shelf_code}</span>
                            <ArrowRight className="w-3 h-3 text-slate-400 flex-shrink-0" />
                            <span className={exc.observed_shelf_code ? "text-amber-700 font-bold" : "text-slate-400 italic"}>
                              {exc.observed_shelf_code || 'None'}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-3">{getCauseBadge(exc.root_cause)}</td>
                        <td className="py-3 px-3">
                          <StatusBadge status={exc.status} showIcon={false} />
                        </td>
                        <td className="py-3 px-3 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedException(exc);
                              setShowVerificationModal(true);
                            }}
                            className="px-2.5 py-1 bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white border border-blue-200 rounded-lg text-[11px] font-semibold transition"
                          >
                            Verify
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          
          <div className="py-2.5 px-4 bg-slate-50/50 border-t border-slate-200/80 flex justify-between text-xs text-slate-500">
            <span>Click any discrepancy row to inspect empirical AI evidence.</span>
            <span className="font-medium text-slate-700">{filteredExceptions.length} Exceptions Listed</span>
          </div>
        </div>

        {/* Right Side: Deep AI Inspection Drawer (5 Cols) */}
        <div className="lg:col-span-5 bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-5">
          {selectedException ? (
            <>
              {/* Drawer Header */}
              <div className="flex items-start justify-between border-b border-slate-100 pb-3">
                <div>
                  <div className="flex items-center space-x-2">
                    <Sparkles className="w-4 h-4 text-blue-600" />
                    <h3 className="text-sm font-bold text-slate-900">AI Diagnostic & Evidence Breakdown</h3>
                  </div>
                  <span className="text-[11px] text-slate-500 font-mono">Exception #{selectedException.id} • {selectedException.epc}</span>
                </div>
                <StatusBadge status={selectedException.discrepancy_type} />
              </div>

              {/* Product Card */}
              <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200 space-y-1 text-xs">
                <span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Item Profile</span>
                <p className="text-sm font-bold text-slate-900">{selectedException.product_name}</p>
                <div className="flex items-center space-x-4 text-slate-600 pt-1 text-[11px]">
                  <span>SKU: <strong className="text-slate-800 font-mono">{selectedException.product_sku}</strong></span>
                  <span>Category: <strong className="text-slate-800">{selectedException.category}</strong></span>
                  <span>Valuation: <strong className="text-emerald-700 font-mono font-semibold">${selectedException.unit_cost}</strong></span>
                </div>
              </div>

              {/* Location Comparison */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-200">
                  <span className="text-slate-500 text-[10px] block mb-1">Expected Location (WMS)</span>
                  <div className="flex items-center space-x-1.5 text-blue-700 font-bold font-mono text-sm">
                    <MapPin className="w-4 h-4 text-blue-600" />
                    <span>{selectedException.expected_shelf_code}</span>
                  </div>
                </div>

                <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-200">
                  <span className="text-slate-500 text-[10px] block mb-1">Observed Location (RFID)</span>
                  <div className="flex items-center space-x-1.5 text-amber-700 font-bold font-mono text-sm">
                    <MapPin className="w-4 h-4 text-amber-600" />
                    <span>{selectedException.observed_shelf_code || 'Unobserved'}</span>
                  </div>
                </div>
              </div>

              {/* Candidate Location Probabilities */}
              {selectedException.candidate_locations && selectedException.candidate_locations.length > 0 && (
                <div className="space-y-2 text-xs">
                  <span className="text-slate-700 font-semibold block">Multi-Antenna Shelf Probabilities:</span>
                  <div className="space-y-1.5 bg-slate-50/60 p-3 rounded-xl border border-slate-200">
                    {selectedException.candidate_locations.map((cand) => (
                      <div key={cand.shelf_code} className="space-y-1">
                        <div className="flex justify-between text-[11px]">
                          <span className="font-mono text-slate-900 font-semibold">{cand.shelf_code}</span>
                          <span className="font-mono text-blue-700 font-bold">{Math.round(cand.probability * 100)}%</span>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                            style={{ width: `${Math.round(cand.probability * 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Empirical AI Evidence List */}
              <div className="space-y-2 text-xs">
                <span className="text-slate-700 font-semibold block">Empirical Diagnostic Clues (AI Engine):</span>
                <div className="space-y-1.5">
                  {(selectedException.ai_evidence || [
                    "Repeated detection on alternative antenna port",
                    "No authorized movement found in transaction logs"
                  ]).map((ev, idx) => (
                    <div key={idx} className="flex items-start space-x-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 text-[11px] text-slate-700">
                      <Check className="w-3.5 h-3.5 text-blue-600 flex-shrink-0 mt-0.5" />
                      <span>{ev}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Root Cause & Recommended Action */}
              <div className="bg-blue-50/60 border border-blue-200 p-3.5 rounded-xl space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-blue-900 font-semibold">Diagnosis Hypothesis:</span>
                  <span className="font-mono text-xs font-bold text-blue-700">
                    Confidence: {Math.round(selectedException.confidence * 100)}%
                  </span>
                </div>
                <div className="text-sm font-bold text-slate-900 font-mono">
                  {selectedException.root_cause ? selectedException.root_cause.replace(/_/g, ' ') : 'PENDING'}
                </div>
                <div className="pt-1 text-[11px] text-slate-600 border-t border-blue-200/80">
                  <span>Recommended Action: </span>
                  <strong className="text-amber-800 font-mono font-semibold">
                    {selectedException.recommended_action || 'AUDIT_PHYSICAL_LOCATION'}
                  </strong>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex space-x-2">
                <button
                  onClick={() => setShowVerificationModal(true)}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold text-xs flex items-center justify-center space-x-1.5 transition shadow-xs"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Verify Physical Shelf</span>
                </button>
                <button
                  onClick={() => handleResolve(selectedException.id)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl font-semibold text-xs transition"
                >
                  Quick Resolve
                </button>
              </div>

            </>
          ) : (
            <div className="py-20 text-center text-xs text-slate-400">
              Select an exception from the table to view AI evidence.
            </div>
          )}
        </div>

      </div>

      {/* Ground Truth Verification Modal */}
      <VerificationModal
        discrepancy={selectedException}
        shelves={shelves}
        isOpen={showVerificationModal}
        onClose={() => setShowVerificationModal(false)}
        onSubmitVerification={handleVerifySubmit}
      />

      {/* Handheld Batch Upload Modal */}
      <HandheldBatchModal
        isOpen={showBatchModal}
        onClose={() => setShowBatchModal(false)}
        onSuccess={() => {
          loadExceptions();
          onRefreshData();
        }}
      />

    </div>
  );
};

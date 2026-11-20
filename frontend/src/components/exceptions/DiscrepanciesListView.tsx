import React, { useState } from 'react';
import {
  AlertTriangle,
  Search,
  Filter,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  HelpCircle,
  Eye
} from 'lucide-react';
import { DiscrepancyItem } from '../../types';
import { StatusBadge } from '../common/StatusBadge';
import { LoadingState } from '../common/LoadingState';

interface DiscrepanciesListViewProps {
  exceptions: DiscrepancyItem[];
  loading: boolean;
  selectedException: DiscrepancyItem | null;
  onSelectException: (exc: DiscrepancyItem) => void;
  onNavigateDetail?: (tabId: string) => void;
}

export const DiscrepanciesListView: React.FC<DiscrepanciesListViewProps> = ({
  exceptions,
  loading,
  selectedException,
  onSelectException,
  onNavigateDetail
}) => {
  const [filterType, setFilterType] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredExceptions = exceptions.filter((exc) => {
    const matchesFilter = filterType === 'ALL' || exc.discrepancy_type === filterType;
    const matchesSearch =
      exc.epc.toLowerCase().includes(searchQuery.toLowerCase()) ||
      exc.product_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      exc.product_sku.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const countFor = (type: string) => {
    if (type === 'ALL') return exceptions.length;
    return exceptions.filter((e) => e.discrepancy_type === type).length;
  };

  return (
    <div className="space-y-6 text-xs text-slate-800">
      
      {/* Top Banner */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            <h3 className="text-base font-bold text-slate-900">AI Discrepancies & Anomalies</h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
              Autonomous Exception Detection
            </span>
          </div>
          <p className="text-slate-500 text-[11px] mt-1">
            Real-time discrepancies flagged by comparing expected WMS states against probabilistic UHF antenna observations.
          </p>
        </div>

        <div className="flex items-center space-x-2 text-xs font-mono">
          <span className="text-slate-500">Unresolved Exceptions:</span>
          <span className="font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200">
            {exceptions.length} Active
          </span>
        </div>
      </div>

      {/* Filter Pills & Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex items-center space-x-1.5 bg-slate-100 p-1 rounded-xl">
          {[
            { id: 'ALL', label: 'All Exceptions' },
            { id: 'MISPLACED', label: 'Misplaced' },
            { id: 'LIKELY_MISSING', label: 'Missing' },
            { id: 'UNCERTAIN', label: 'Uncertain' },
          ].map((pill) => {
            const count = countFor(pill.id);
            const active = filterType === pill.id;
            return (
              <button
                key={pill.id}
                onClick={() => setFilterType(pill.id)}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  active
                    ? 'bg-white text-slate-900 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>{pill.label}</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${active ? 'bg-slate-100 text-slate-800' : 'text-slate-400'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
          <input
            type="text"
            placeholder="Search exceptions by EPC, SKU or product name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-slate-200/90 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 shadow-xs"
          />
        </div>
      </div>

      {/* Discrepancy Table */}
      <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                <th className="py-3 px-4">Tag EPC</th>
                <th className="py-3 px-4">Product / SKU</th>
                <th className="py-3 px-4">Discrepancy Type</th>
                <th className="py-3 px-4">Antenna</th>
                <th className="py-3 px-4">Expected</th>
                <th className="py-3 px-4">Observed</th>
                <th className="py-3 px-4">AI Confidence</th>
                <th className="py-3 px-4">Unit Cost</th>
                <th className="py-3 px-4 text-right">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12">
                    <LoadingState message="Fetching active inventory discrepancies..." />
                  </td>
                </tr>
              ) : filteredExceptions.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400 font-sans">
                    No exceptions match the selected filter. Inventory state is fully reconciled.
                  </td>
                </tr>
              ) : (
                filteredExceptions.map((exc) => {
                  const isSelected = selectedException?.id === exc.id;
                  return (
                    <tr
                      key={exc.id}
                      onClick={() => onSelectException(exc)}
                      className={`hover:bg-blue-50/40 cursor-pointer transition ${
                        isSelected ? 'bg-blue-50/60 font-semibold' : ''
                      }`}
                    >
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        {exc.epc}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-slate-900 block">{exc.product_name}</span>
                        <span className="text-[10px] text-slate-400 font-mono">{exc.product_sku}</span>
                      </td>
                      <td className="py-3 px-4">
                        <StatusBadge status={exc.discrepancy_type} />
                      </td>
                      <td className="py-3 px-4 font-mono text-blue-600 font-semibold">
                        ANT-0{exc.observed_antenna_id || 1}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-700">
                        {exc.expected_shelf_code}
                      </td>
                      <td className="py-3 px-4 font-mono">
                        {exc.observed_shelf_code ? (
                          <span className={exc.observed_shelf_code === exc.expected_shelf_code ? 'text-emerald-700 font-bold' : 'text-amber-700 font-bold'}>
                            {exc.observed_shelf_code}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">Unread</span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-800">
                        {Math.round(exc.confidence * 100)}%
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600">
                        ${exc.unit_cost?.toFixed(2) || '0.00'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectException(exc);
                            onNavigateDetail?.('exceptions-root-cause');
                          }}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-blue-600 hover:text-white text-slate-600 rounded-lg text-[11px] font-semibold transition"
                        >
                          Root Cause →
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="py-3 px-4 border-t border-slate-200/80 bg-slate-50/50 flex justify-between items-center text-xs text-slate-500">
          <span>Showing {filteredExceptions.length} of {exceptions.length} exceptions</span>
          <span className="font-mono text-blue-700 font-medium">Auto-refreshed via periodic sweep loop</span>
        </div>
      </div>

    </div>
  );
};

import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  Brain,
  ShieldCheck,
  Layers,
  Cpu
} from 'lucide-react';
import { DiscrepancyItem, ShelfItem } from '../../types';
import { api } from '../../services/api';
import { DiscrepanciesListView } from './DiscrepanciesListView';
import { RootCauseAnalysisView } from './RootCauseAnalysisView';
import { VerificationActionsView } from './VerificationActionsView';
import { SessionGroundTruthView } from './SessionGroundTruthView';
import { AIModelInsightsView } from './AIModelInsightsView';
import { VerificationModal } from './VerificationModal';
import { HandheldBatchModal } from './HandheldBatchModal';

interface AIExceptionsTabProps {
  initialFilter?: string;
  shelves: ShelfItem[];
  onRefreshData: () => void;
  subPage?: string;
  onNavigateSubPage?: (subPageId: string) => void;
}

export const AIExceptionsTab: React.FC<AIExceptionsTabProps> = ({
  initialFilter,
  shelves,
  onRefreshData,
  subPage,
  onNavigateSubPage
}) => {
  const [exceptions, setExceptions] = useState<DiscrepancyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedException, setSelectedException] = useState<DiscrepancyItem | null>(null);
  const [activeSubView, setActiveSubView] = useState<'discrepancies' | 'root-cause' | 'actions' | 'ground-truth' | 'insights'>('discrepancies');

  // Modals
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);

  useEffect(() => {
    loadExceptions();
  }, []);

  useEffect(() => {
    if (subPage === 'exceptions-root-cause') setActiveSubView('root-cause');
    else if (subPage === 'exceptions-actions') setActiveSubView('actions');
    else if (subPage === 'exceptions-ground-truth') setActiveSubView('ground-truth');
    else if (subPage === 'exceptions-insights') setActiveSubView('insights');
    else if (subPage === 'exceptions-discrepancies') setActiveSubView('discrepancies');
  }, [subPage]);

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

  const handleSubNav = (view: 'discrepancies' | 'root-cause' | 'actions' | 'ground-truth' | 'insights', id: string) => {
    setActiveSubView(view);
    onNavigateSubPage?.(id);
  };

  return (
    <div className="space-y-6">
      
      {/* 5-Page Subnavigation Tabs */}
      <div className="bg-white border border-slate-200/90 p-3 rounded-2xl shadow-xs flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => handleSubNav('discrepancies', 'exceptions-discrepancies')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeSubView === 'discrepancies'
                ? 'bg-white text-slate-900 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
            <span>Discrepancies ({exceptions.length})</span>
          </button>

          <button
            onClick={() => handleSubNav('root-cause', 'exceptions-root-cause')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeSubView === 'root-cause'
                ? 'bg-white text-indigo-900 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Brain className="w-3.5 h-3.5 text-indigo-600" />
            <span>Root Cause Analysis</span>
          </button>

          <button
            onClick={() => handleSubNav('actions', 'exceptions-actions')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeSubView === 'actions'
                ? 'bg-white text-emerald-900 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Verification & Actions</span>
          </button>

          <button
            onClick={() => handleSubNav('ground-truth', 'exceptions-ground-truth')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeSubView === 'ground-truth'
                ? 'bg-white text-purple-900 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-purple-600" />
            <span>Session & Ground Truth</span>
          </button>

          <button
            onClick={() => handleSubNav('insights', 'exceptions-insights')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeSubView === 'insights'
                ? 'bg-white text-blue-900 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Cpu className="w-3.5 h-3.5 text-blue-600" />
            <span>AI Model Insights</span>
          </button>
        </div>

        <div className="flex items-center space-x-2 text-xs text-slate-500 font-mono">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <span>TreeSHAP Inference Engine Active</span>
        </div>
      </div>

      {/* Render Sub-Page View */}
      {activeSubView === 'discrepancies' && (
        <DiscrepanciesListView
          exceptions={exceptions}
          loading={loading}
          selectedException={selectedException}
          onSelectException={setSelectedException}
          onNavigateDetail={(subId) => {
            if (subId === 'exceptions-root-cause') handleSubNav('root-cause', 'exceptions-root-cause');
            else if (subId === 'exceptions-actions') handleSubNav('actions', 'exceptions-actions');
          }}
        />
      )}

      {activeSubView === 'root-cause' && (
        <RootCauseAnalysisView
          selectedException={selectedException}
          onNavigateVerify={() => handleSubNav('actions', 'exceptions-actions')}
        />
      )}

      {activeSubView === 'actions' && (
        <VerificationActionsView
          selectedException={selectedException}
          shelves={shelves}
          onRefresh={() => {
            loadExceptions();
            onRefreshData();
          }}
          onOpenVerificationModal={() => setShowVerificationModal(true)}
        />
      )}

      {activeSubView === 'ground-truth' && (
        <SessionGroundTruthView
          onRefresh={() => {
            loadExceptions();
            onRefreshData();
          }}
        />
      )}

      {activeSubView === 'insights' && (
        <AIModelInsightsView />
      )}

      {/* Verification Modal */}
      {selectedException && (
        <VerificationModal
          isOpen={showVerificationModal}
          onClose={() => setShowVerificationModal(false)}
          discrepancy={selectedException}
          shelves={shelves}
          onSubmitVerification={async (id: number, result: string, shelfId: number | null, notes: string) => {
            await api.verifyException(id, {
              verification_result: result,
              actual_location_id: shelfId,
              notes
            });
            await loadExceptions();
            onRefreshData();
          }}
        />
      )}

      {/* Handheld Batch Modal */}
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

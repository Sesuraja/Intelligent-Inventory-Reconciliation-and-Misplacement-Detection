import React, { useState, useEffect } from 'react';
import {
  Layers,
  Cpu,
  Server,
  TrendingUp,
  Download,
  FileText
} from 'lucide-react';
import { api } from '../../services/api';
import { AIModelItem } from '../../types';
import { InventoryReconciliationReportView } from './InventoryReconciliationReportView';
import { ModelPerformanceReportView } from './ModelPerformanceReportView';
import { ReaderPerformanceReportView } from './ReaderPerformanceReportView';
import { CycleCountForecastView } from './CycleCountForecastView';
import { ExportsReportView } from './ExportsReportView';
import { DatedTestReportView } from './DatedTestReportView';

interface ReportsTabProps {
  subPage?: string;
  onNavigateSubPage?: (subPageId: string) => void;
}

export const ReportsTab: React.FC<ReportsTabProps> = ({ subPage, onNavigateSubPage }) => {
  const [activeSubView, setActiveSubView] = useState<'reconciliation' | 'performance' | 'reader' | 'forecast' | 'exports' | 'dated-report'>('reconciliation');
  const [reconciliationRows, setReconciliationRows] = useState<any[]>([]);
  const [accuracyStats, setAccuracyStats] = useState<any>(null);
  const [models, setModels] = useState<AIModelItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReportsData();
  }, []);

  useEffect(() => {
    if (subPage === 'reports-performance') setActiveSubView('performance');
    else if (subPage === 'reports-reader') setActiveSubView('reader');
    else if (subPage === 'reports-forecast') setActiveSubView('forecast');
    else if (subPage === 'reports-exports') setActiveSubView('exports');
    else if (subPage === 'reports-dated-report') setActiveSubView('dated-report');
    else if (subPage === 'reports-reconciliation') setActiveSubView('reconciliation');
  }, [subPage]);

  const loadReportsData = async () => {
    setLoading(true);
    try {
      const [recon, acc, mods] = await Promise.all([
        api.getReconciliationReport(),
        api.getAccuracyReport(),
        api.getAIModels()
      ]);
      setReconciliationRows(recon.records || []);
      setAccuracyStats(acc);
      setModels(mods);
    } catch (err) {
      console.error('Error fetching reports data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubNav = (view: 'reconciliation' | 'performance' | 'reader' | 'forecast' | 'exports' | 'dated-report', id: string) => {
    setActiveSubView(view);
    onNavigateSubPage?.(id);
  };

  return (
    <div className="space-y-6">
      
      {/* 5-Page Subnavigation Tabs */}
      <div className="bg-white border border-slate-200/90 p-3 rounded-2xl shadow-xs flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => handleSubNav('reconciliation', 'reports-reconciliation')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeSubView === 'reconciliation'
                ? 'bg-white text-blue-900 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-blue-600" />
            <span>Inventory Reconciliation</span>
          </button>

          <button
            onClick={() => handleSubNav('performance', 'reports-performance')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeSubView === 'performance'
                ? 'bg-white text-indigo-900 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Cpu className="w-3.5 h-3.5 text-indigo-600" />
            <span>Model Performance</span>
          </button>

          <button
            onClick={() => handleSubNav('reader', 'reports-reader')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeSubView === 'reader'
                ? 'bg-white text-emerald-900 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Server className="w-3.5 h-3.5 text-emerald-600" />
            <span>Reader Performance</span>
          </button>

          <button
            onClick={() => handleSubNav('forecast', 'reports-forecast')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeSubView === 'forecast'
                ? 'bg-white text-purple-900 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5 text-purple-600" />
            <span>Cycle Count & Forecast</span>
          </button>

          <button
            onClick={() => handleSubNav('exports', 'reports-exports')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeSubView === 'exports'
                ? 'bg-white text-slate-900 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Download className="w-3.5 h-3.5 text-slate-700" />
            <span>Exports</span>
          </button>

          <button
            onClick={() => handleSubNav('dated-report', 'reports-dated-report')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeSubView === 'dated-report'
                ? 'bg-white text-indigo-900 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText className="w-3.5 h-3.5 text-indigo-600" />
            <span>Dated Test Report</span>
          </button>
        </div>

        <div className="flex items-center space-x-2 text-xs text-slate-500 font-mono">
          <span className="w-2 h-2 rounded-full bg-blue-500" />
          <span>Audit Provenance Ledger Valid</span>
        </div>
      </div>

      {/* Render Sub-Page View */}
      {activeSubView === 'reconciliation' && (
        <InventoryReconciliationReportView
          reconciliationRows={reconciliationRows}
          accuracyStats={accuracyStats}
          loading={loading}
          onRefresh={loadReportsData}
        />
      )}

      {activeSubView === 'performance' && (
        <ModelPerformanceReportView models={models} />
      )}

      {activeSubView === 'reader' && (
        <ReaderPerformanceReportView />
      )}

      {activeSubView === 'forecast' && (
        <CycleCountForecastView />
      )}

      {activeSubView === 'exports' && (
        <ExportsReportView />
      )}

      {activeSubView === 'dated-report' && (
        <DatedTestReportView />
      )}

    </div>
  );
};

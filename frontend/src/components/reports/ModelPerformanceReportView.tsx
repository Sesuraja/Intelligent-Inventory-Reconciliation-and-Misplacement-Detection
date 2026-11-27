import React, { useState, useEffect } from 'react';
import { Cpu, RefreshCw } from 'lucide-react';
import { AIModelItem } from '../../types';
import { api } from '../../services/api';

interface ModelPerformanceReportViewProps {
  models: AIModelItem[];
}

export const ModelPerformanceReportView: React.FC<ModelPerformanceReportViewProps> = ({ models }) => {
  const [evalData, setEvalData] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);

  const loadEval = () => {
    setLoading(true);
    api.getAIEvaluation()
      .then(setEvalData)
      .catch(() => setEvalData(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadEval();
  }, []);

  const matrixRows: Array<{ actual: string; predicted: number[] }> = evalData?.confusion_matrix
    ? evalData.confusion_matrix
    : [];

  return (
    <div className="space-y-6 text-xs text-slate-800">
      {/* Top Banner */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Cpu className="w-5 h-5 text-indigo-600" />
            <h3 className="text-base font-bold text-slate-900">AI Model Performance & Evaluation</h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
              {models.length} Registered Models
            </span>
          </div>
          <p className="text-slate-500 text-[11px] mt-1">
            Live registered model registry metrics and backend evaluation results.
          </p>
        </div>

        <button
          onClick={loadEval}
          className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold transition cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Evaluation</span>
        </button>
      </div>

      {/* Model Metrics Table */}
      <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h4 className="font-bold text-slate-900 text-xs">Registered Model Accuracy Summary</h4>
          <span className="text-[10px] font-mono text-slate-400">Live Model Registry</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold text-[10px]">
              <tr>
                <th className="py-3 px-4">Model Pipeline</th>
                <th className="py-3 px-4 text-center">Version</th>
                <th className="py-3 px-4 text-center">Precision</th>
                <th className="py-3 px-4 text-center">Recall</th>
                <th className="py-3 px-4 text-center">F1-Score</th>
                <th className="py-3 px-4 text-right">Deployment Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 font-mono">
              {models.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center font-sans text-slate-400">
                    No AI models registered in the backend yet.
                  </td>
                </tr>
              ) : (
                models.map((m) => {
                  const precision = m.metrics?.precision;
                  const recall = m.metrics?.recall;
                  const f1 = m.metrics?.f1_score ?? m.metrics?.f1;
                  const isActive = m.status?.toUpperCase() === 'ACTIVE' || m.status?.toUpperCase() === 'PRODUCTION';
                  return (
                  <tr key={m.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-4 font-sans font-bold text-slate-900">{m.model_name}</td>
                    <td className="py-3 px-4 text-center text-slate-600">{m.version}</td>
                    <td className="py-3 px-4 text-center font-bold text-slate-800">
                      {precision !== undefined && precision !== null ? Number(precision).toFixed(2) : '—'}
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-slate-800">
                      {recall !== undefined && recall !== null ? Number(recall).toFixed(2) : '—'}
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-emerald-600 bg-emerald-50/40">
                      {f1 !== undefined && f1 !== null ? Number(f1).toFixed(2) : '—'}
                    </td>
                    <td className="py-3 px-4 text-right font-sans">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                        isActive
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}>
                        {m.status || 'STANDBY'}
                      </span>
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Live Evaluation Summary */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-bold text-slate-900 text-sm">Backend AI Evaluation Summary</h4>
            <p className="text-[11px] text-slate-400">Live metrics returned by /api/v1/ai/evaluation</p>
          </div>
          {evalData?.f1_score !== undefined && (
            <span className="text-[10px] font-mono text-emerald-700 font-bold bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
              F1 Score: {(Number(evalData.f1_score) * 100).toFixed(1)}%
            </span>
          )}
        </div>

        {matrixRows.length > 0 ? (
          <div className="max-w-md mx-auto pt-4">
            <div className="grid grid-cols-4 gap-2 text-center text-xs font-mono">
              <div className="p-2 font-sans text-slate-400 font-bold text-[10px] uppercase flex items-center justify-center">Actual \ Pred</div>
              <div className="p-2 bg-slate-100 rounded-lg text-slate-700 font-bold">Present</div>
              <div className="p-2 bg-slate-100 rounded-lg text-slate-700 font-bold">Unread</div>
              <div className="p-2 bg-slate-100 rounded-lg text-slate-700 font-bold">Missing</div>
              {matrixRows.map((row, rIdx) => (
                <React.Fragment key={row.actual}>
                  <div className="p-2 bg-slate-100 rounded-lg font-sans font-bold text-slate-700 flex items-center justify-center">
                    {row.actual}
                  </div>
                  {row.predicted.map((val, colIdx) => (
                    <div
                      key={colIdx}
                      className={`p-3 rounded-xl font-bold flex flex-col items-center justify-center border ${
                        rIdx === colIdx
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                          : 'bg-slate-50 border-slate-100 text-slate-500'
                      }`}
                    >
                      <span>{val}</span>
                    </div>
                  ))}
                </React.Fragment>
              ))}
            </div>
          </div>
        ) : (
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-slate-500 text-xs">
            {evalData ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
                <div><span className="text-slate-400 block text-[10px]">Accuracy</span><strong>{evalData.accuracy ?? '—'}</strong></div>
                <div><span className="text-slate-400 block text-[10px]">Precision</span><strong>{evalData.precision ?? '—'}</strong></div>
                <div><span className="text-slate-400 block text-[10px]">Recall</span><strong>{evalData.recall ?? '—'}</strong></div>
                <div><span className="text-slate-400 block text-[10px]">Sample Size</span><strong>{evalData.sample_size ?? '—'}</strong></div>
              </div>
            ) : (
              'No evaluation dataset run recorded yet.'
            )}
          </div>
        )}
      </div>
    </div>
  );
};

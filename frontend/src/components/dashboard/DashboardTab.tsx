import React from 'react';
import {
  Package,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  EyeOff,
  Radio,
  TrendingUp,
  Layers,
  ArrowRight,
  ShieldCheck,
  Server,
  BarChart as BarChartIcon
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  AreaChart,
  Area
} from 'recharts';
import { DashboardSummary, NavigationTab } from '../../types';
import { LoadingState } from '../common/LoadingState';
import { useAppSettings } from '../../context/SettingsContext';

interface DashboardTabProps {
  summary: DashboardSummary | null;
  onNavigateTab: (tab: NavigationTab, filter?: string) => void;
  onSelectDiscrepancy: (discrepancyId: number) => void;
}

export const DashboardTab: React.FC<DashboardTabProps> = ({
  summary,
  onNavigateTab
}) => {
  const { settings } = useAppSettings();

  if (!summary) {
    return <LoadingState message="Loading warehouse overview KPIs and AI discrepancy feeds..." />;
  }

  const {
    kpis,
    status_distribution,
    discrepancy_trends,
    shelf_distribution,
    latest_verifications
  } = summary;

  const readerOnline = kpis.readers_online > 0;

  return (
    <div className="space-y-6">
      
      {/* Top Warehouse Overview Banner */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className={`w-2.5 h-2.5 rounded-full ${readerOnline ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">{settings.companyName || 'Main Logistics Distribution Facility #4'}</h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Automatic UHF RFID inventory reconciliation running with Scikit-learn AI location inference and root-cause diagnostics.
          </p>
        </div>

        <div className="flex items-center space-x-3 text-xs">
          <div className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 flex items-center space-x-2">
            <Server className={`w-4 h-4 ${readerOnline ? 'text-emerald-600' : 'text-rose-600'}`} />
            <span className="font-mono font-medium">READER_01: {readerOnline ? 'ONLINE' : 'OUTAGE'}</span>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 font-semibold flex items-center space-x-1.5">
            <Radio className="w-4 h-4 text-blue-600" />
            <span>4 Ports Active</span>
          </div>
        </div>
      </div>

      {/* KPI Summary Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        
        {/* Total Registered */}
        <div className="bg-white border border-slate-200/90 p-4 rounded-xl shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">Registered Tags</span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900 font-mono tracking-tight">{kpis.total_tags}</div>
            <p className="text-[11px] text-slate-500 mt-0.5">{kpis.total_products} Master SKUs</p>
          </div>
        </div>

        {/* Correctly Located */}
        <div className="bg-white border border-slate-200/90 p-4 rounded-xl shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">In-Place</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-emerald-600 font-mono tracking-tight">{kpis.correctly_located}</div>
            <p className="text-[11px] text-emerald-700 font-medium mt-0.5">{kpis.accuracy_percentage}% Accuracy</p>
          </div>
        </div>

        {/* Suspected Misplaced - Interactive */}
        <div
          onClick={() => onNavigateTab('exceptions', 'MISPLACED')}
          className="bg-white border border-amber-200/90 hover:border-amber-400 p-4 rounded-xl shadow-xs flex flex-col justify-between cursor-pointer transition transform hover:-translate-y-0.5 group"
        >
          <div className="flex items-center justify-between text-amber-700">
            <span className="text-[11px] font-bold uppercase tracking-wider">Misplaced</span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600 group-hover:bg-amber-100 transition">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-amber-600 font-mono tracking-tight">{kpis.misplaced}</div>
            <div className="flex items-center text-[11px] text-amber-700 font-semibold mt-0.5 space-x-1">
              <span>View exceptions</span>
              <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition" />
            </div>
          </div>
        </div>

        {/* Suspected Missing */}
        <div
          onClick={() => onNavigateTab('exceptions', 'LIKELY_MISSING')}
          className="bg-white border border-rose-200/90 hover:border-rose-400 p-4 rounded-xl shadow-xs flex flex-col justify-between cursor-pointer transition transform hover:-translate-y-0.5 group"
        >
          <div className="flex items-center justify-between text-rose-700">
            <span className="text-[11px] font-bold uppercase tracking-wider">Missing</span>
            <div className="w-7 h-7 rounded-lg bg-rose-50 flex items-center justify-center text-rose-600 group-hover:bg-rose-100 transition">
              <EyeOff className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-rose-600 font-mono tracking-tight">{kpis.likely_missing}</div>
            <p className="text-[11px] text-rose-600 font-medium mt-0.5">High Shrinkage Risk</p>
          </div>
        </div>

        {/* RF Missed Read / Shadowed */}
        <div
          onClick={() => onNavigateTab('exceptions', 'POSSIBLE_UNREAD')}
          className="bg-white border border-indigo-200/90 hover:border-indigo-400 p-4 rounded-xl shadow-xs flex flex-col justify-between cursor-pointer transition transform hover:-translate-y-0.5 group"
        >
          <div className="flex items-center justify-between text-indigo-700">
            <span className="text-[11px] font-bold uppercase tracking-wider">RF Unread</span>
            <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 group-hover:bg-indigo-100 transition">
              <Radio className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-indigo-600 font-mono tracking-tight">{kpis.possible_unread}</div>
            <p className="text-[11px] text-indigo-600 font-medium mt-0.5">RF Attenuation / Metal</p>
          </div>
        </div>

        {/* Ambiguous Multi-Antenna */}
        <div
          onClick={() => onNavigateTab('exceptions', 'AMBIGUOUS')}
          className="bg-white border border-purple-200/90 hover:border-purple-400 p-4 rounded-xl shadow-xs flex flex-col justify-between cursor-pointer transition transform hover:-translate-y-0.5 group"
        >
          <div className="flex items-center justify-between text-purple-700">
            <span className="text-[11px] font-bold uppercase tracking-wider">Ambiguous</span>
            <div className="w-7 h-7 rounded-lg bg-purple-50 flex items-center justify-center text-purple-600 group-hover:bg-purple-100 transition">
              <HelpCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-purple-600 font-mono tracking-tight">{kpis.ambiguous}</div>
            <p className="text-[11px] text-purple-600 font-medium mt-0.5">Multi-Beam Overlap</p>
          </div>
        </div>

      </div>

      {/* Main Analytics Row: Donut Chart & Shelf Distribution BarChart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Status Breakdown Donut */}
        <div className="bg-white border border-slate-200/90 p-5 rounded-2xl shadow-xs flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
              <Layers className="w-4 h-4 text-blue-600" />
              <span>Inventory Status Breakdown</span>
            </h3>
            <span className="text-xs text-slate-500 font-mono">{kpis.accuracy_percentage}% In-Place</span>
          </div>

          <div className="h-56 relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={status_distribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={65}
                  outerRadius={88}
                  paddingAngle={3}
                  dataKey="count"
                >
                  {status_distribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '8px', color: '#0f172a', fontSize: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-bold text-slate-900 font-mono leading-none">{kpis.total_tags}</span>
              <span className="text-[10px] text-slate-400 uppercase tracking-widest mt-1">Tags</span>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            {status_distribution.map((item) => (
              <div key={item.name} className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                <span className="text-slate-600 text-[11px] truncate">{item.name}:</span>
                <span className="font-bold text-slate-900 font-mono text-[11px]">{item.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Shelf-Wise Inventory Distribution */}
        <div className="bg-white border border-slate-200/90 p-5 rounded-2xl shadow-xs flex flex-col lg:col-span-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
              <BarChartIcon className="w-4 h-4 text-indigo-600" />
              <span>Shelf Distribution: Expected vs Observed</span>
            </h3>
            <div className="flex items-center space-x-3 text-xs">
              <div className="flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 bg-blue-500 rounded" />
                <span className="text-slate-600">Expected</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 bg-emerald-500 rounded" />
                <span className="text-slate-600">Observed</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 bg-amber-500 rounded" />
                <span className="text-slate-600">Misplaced</span>
              </div>
            </div>
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={shelf_distribution} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="shelf_code" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '8px', color: '#0f172a', fontSize: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="expected_count" name="Expected" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="observed_count" name="Observed" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="misplaced_count" name="Misplaced" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* Second Row: Discrepancy Timeline & Physical Ground Truth Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Timeline Area Chart */}
        <div className="bg-white border border-slate-200/90 p-5 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              <span>Shift Discrepancy Timeline</span>
            </h3>
            <span className="text-xs text-slate-400">Shift Checkpoints (08:00 - Present)</span>
          </div>

          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={discrepancy_trends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorInPlace" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorMisplaced" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="timestamp" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '8px', color: '#0f172a', fontSize: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Area type="monotone" dataKey="in_place" name="In-Place" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorInPlace)" />
                <Area type="monotone" dataKey="misplaced" name="Misplaced" stroke="#f59e0b" strokeWidth={2} fillOpacity={1} fill="url(#colorMisplaced)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Physical Ground Truth Verification Activity */}
        <div className="bg-white border border-slate-200/90 p-5 rounded-2xl shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                <ShieldCheck className="w-4 h-4 text-cyan-600" />
                <span>Physical Ground Truth Verification Feed</span>
              </h3>
              <button
                onClick={() => onNavigateTab('exceptions')}
                className="text-xs text-blue-600 hover:text-blue-800 font-semibold"
              >
                Inspect All
              </button>
            </div>

            <div className="space-y-2.5">
              {latest_verifications.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-400">
                  No manual shelf audits logged yet today. Discrepancies await operator verification.
                </div>
              ) : (
                latest_verifications.map((v) => (
                  <div key={v.id} className="bg-slate-50 p-3 rounded-xl border border-slate-200/70 text-xs flex items-center justify-between">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-mono font-bold text-slate-900">{v.epc}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                          {v.result}
                        </span>
                      </div>
                      <p className="text-slate-600 text-[11px] mt-1">{v.notes || 'Audited and confirmed by operator.'}</p>
                    </div>
                    <div className="text-right text-[11px] text-slate-500">
                      <span className="font-medium text-slate-700">{v.verified_by}</span>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {new Date(v.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Verified shelf truth automatically updates WMS master records.</span>
            <span className="font-mono text-emerald-600 font-semibold">Supervised AI Feedback: ON</span>
          </div>
        </div>

      </div>

    </div>
  );
};

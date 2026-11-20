import React, { useState, useEffect } from 'react';
import {
  History,
  Search,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
  RotateCw,
  Filter,
  CheckCircle2,
  Calendar,
  Layers
} from 'lucide-react';
import { api } from '../../services/api';
import { ShelfItem } from '../../types';

interface InventoryHistoryViewProps {
  shelves?: ShelfItem[];
}

export const InventoryHistoryView: React.FC<InventoryHistoryViewProps> = ({ shelves = [] }) => {
  const [movements, setMovements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('ALL');
  const [selectedShelf, setSelectedShelf] = useState('ALL');

  useEffect(() => {
    loadMovements();
  }, []);

  const loadMovements = async () => {
    setLoading(true);
    try {
      const data = await api.getMovements();
      setMovements(data);
    } catch (err) {
      console.error('Error loading inventory movements:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredMovements = movements.filter((m) => {
    const matchesSearch = !searchQuery || (m.epc && m.epc.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (m.notes && m.notes.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (m.authorized_by && m.authorized_by.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesType = selectedType === 'ALL' || m.movement_type === selectedType;
    const matchesShelf = selectedShelf === 'ALL' || m.to_shelf_code === selectedShelf || m.from_shelf_code === selectedShelf;
    return matchesSearch && matchesType && matchesShelf;
  });

  return (
    <div className="space-y-6 text-xs text-slate-800">
      
      {/* Header Banner */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <History className="w-5 h-5 text-blue-600" />
            <h3 className="text-base font-bold text-slate-900">Inventory Movement & Reconciliation History</h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
              Immutable Audit Trail
            </span>
          </div>
          <p className="text-slate-500 text-[11px] mt-1">
            Complete sequential log of physical stock transfers, WMS putaways, autonomous reconciliations, and unauthorized movement alerts.
          </p>
        </div>

        <button
          onClick={loadMovements}
          className="flex items-center space-x-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold transition self-start sm:self-auto"
        >
          <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh History</span>
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        
        {/* Pills */}
        <div className="flex flex-wrap gap-1.5">
          {['ALL', 'RECONCILED', 'RECEIPT', 'AUTHORIZED_MOVE', 'TRANSFER', 'UNAUTHORIZED_MOVE'].map((t) => (
            <button
              key={t}
              onClick={() => setSelectedType(t)}
              className={`px-3 py-1.5 rounded-xl font-semibold transition ${
                selectedType === t
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:text-slate-900'
              }`}
            >
              {t === 'ALL' ? 'All Movements' : t.replace(/_/g, ' ')}
            </button>
          ))}
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto">
          {/* Shelf Selector */}
          <select
            value={selectedShelf}
            onChange={(e) => setSelectedShelf(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 font-mono focus:outline-none focus:border-blue-500"
          >
            <option value="ALL">All Shelves</option>
            {shelves.map((s) => (
              <option key={s.id} value={s.shelf_code}>{s.shelf_code}</option>
            ))}
          </select>

          {/* Search */}
          <div className="relative w-full sm:w-56">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search EPC or notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white transition"
            />
          </div>
        </div>

      </div>

      {/* Audit Table */}
      <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
          <table className="w-full text-left">
            <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 z-10 font-semibold text-slate-500 text-[11px] uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">EPC Tag</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Physical Trajectory</th>
                <th className="py-3 px-4">Authorization</th>
                <th className="py-3 px-4">Operator / System</th>
                <th className="py-3 px-4">Audit Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-slate-700">
              {filteredMovements.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 font-sans">
                    No historical movements matching filter criteria.
                  </td>
                </tr>
              ) : (
                filteredMovements.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50/60 transition">
                    <td className="py-3 px-4 text-slate-500 text-[11px] font-mono whitespace-nowrap">
                      {m.timestamp ? new Date(m.timestamp).toLocaleString() : 'N/A'}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900">{m.epc}</td>
                    <td className="py-3 px-4 font-sans">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                        m.movement_type === 'RECONCILED'
                          ? 'bg-purple-50 text-purple-800 border-purple-200'
                          : m.movement_type === 'RECEIPT'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : m.movement_type === 'AUTHORIZED_MOVE'
                          ? 'bg-blue-50 text-blue-800 border-blue-200'
                          : 'bg-amber-50 text-amber-800 border-amber-200'
                      }`}>
                        {m.movement_type}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-1.5 text-xs">
                        <span className="text-slate-500 font-semibold">{m.from_shelf_code || 'Dock / Supplier'}</span>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        <span className="text-blue-700 font-bold">{m.to_shelf_code || 'Outbound'}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-sans">
                      {m.authorized === 1 ? (
                        <span className="flex items-center space-x-1 text-emerald-700 font-medium text-[11px]">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Authorized</span>
                        </span>
                      ) : (
                        <span className="flex items-center space-x-1 text-rose-700 font-medium text-[11px]">
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                          <span>Unauthorized</span>
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-sans text-slate-600 text-xs">{m.authorized_by || 'SYSTEM'}</td>
                    <td className="py-3 px-4 font-sans text-slate-500 text-[11px] max-w-xs truncate" title={m.notes}>
                      {m.notes || '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="py-3 px-4 bg-slate-50/50 border-t border-slate-200/80 flex justify-between items-center text-xs text-slate-500">
          <span>Showing {filteredMovements.length} audit trail records</span>
          <span className="font-mono text-blue-700 font-medium">PostgreSQL / SQLite Event Persistence</span>
        </div>
      </div>

    </div>
  );
};

import React, { useState, useEffect } from 'react';
import {
  Boxes,
  Database,
  ArrowRightLeft,
  Truck,
  RotateCw,
  AlertTriangle,
  CheckCircle2,
  Package,
  Layers,
  Sparkles,
  Play,
  FileText
} from 'lucide-react';
import { api } from '../../services/api';
import { ShelfItem } from '../../types';

interface WMSSandboxViewProps {
  shelves: ShelfItem[];
  onDataChanged: () => void;
}

export const WMSSandboxView: React.FC<WMSSandboxViewProps> = ({ shelves, onDataChanged }) => {
  const [wmsItems, setWmsItems] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [activeModal, setActiveModal] = useState<'RECEIVE' | 'MOVE' | 'INJECT_ERROR' | null>(null);
  const [lastMessage, setLastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form states
  const [receiveSku, setReceiveSku] = useState('SKU-1001');
  const [receiveQty, setReceiveQty] = useState(1);
  const [receiveShelf, setReceiveShelf] = useState(shelves[0]?.shelf_code || 'SHELF_A');
  const [receiveLot, setReceiveLot] = useState('LOT-2026-INB');

  const [moveEpc, setMoveEpc] = useState('');
  const [moveShelf, setMoveShelf] = useState(shelves[0]?.shelf_code || 'SHELF_A');
  const [moveReason, setMoveReason] = useState('Standard stock replenishment');

  const [injectType, setInjectType] = useState('MISPLACE');
  const [injectEpc, setInjectEpc] = useState('');
  const [injectShelf, setInjectShelf] = useState('SHELF_C');

  useEffect(() => {
    loadWMSData();
  }, []);

  const loadWMSData = async () => {
    setLoading(true);
    try {
      const [inv, txs] = await Promise.all([
        api.getWMSInventory(),
        api.getWMSTransactions(25)
      ]);
      setWmsItems(inv);
      setTransactions(txs);
      if (inv.length > 0 && !moveEpc) {
        setMoveEpc(inv[0].epc);
        setInjectEpc(inv[0].epc);
      }
    } catch (err: any) {
      console.error('Error loading WMS sandbox:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleReceive = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const res = await api.wmsReceive({
        sku: receiveSku,
        quantity: receiveQty,
        target_shelf_code: receiveShelf,
        lot_number: receiveLot
      });
      setLastMessage({ type: 'success', text: `Received ${res.quantity_received} units of ${res.sku} at ${res.target_shelf}` });
      setActiveModal(null);
      await loadWMSData();
      onDataChanged();
    } catch (err: any) {
      setLastMessage({ type: 'error', text: err.message || 'Receive failed' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleMove = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      await api.wmsMove({
        epc: moveEpc,
        to_shelf_code: moveShelf,
        reason: moveReason
      });
      setLastMessage({ type: 'success', text: `Authorized transfer of ${moveEpc} to ${moveShelf} logged in WMS.` });
      setActiveModal(null);
      await loadWMSData();
      onDataChanged();
    } catch (err: any) {
      setLastMessage({ type: 'error', text: err.message || 'Move failed' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleInjectError = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const res = await api.wmsInjectError({
        error_type: injectType,
        epc: injectEpc,
        target_shelf_code: injectShelf
      });
      setLastMessage({ type: 'success', text: res.injection_report.message });
      setActiveModal(null);
      await loadWMSData();
      onDataChanged();
    } catch (err: any) {
      setLastMessage({ type: 'error', text: err.message || 'Error injection failed' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleTriggerReconcile = async () => {
    setActionLoading(true);
    try {
      const res = await api.triggerReconciliation();
      setLastMessage({
        type: 'success',
        text: `Autonomous reconciliation complete: ${res.summary.reconciled_items} evaluated, ${res.summary.new_exceptions} new exceptions flagged.`
      });
      await loadWMSData();
      onDataChanged();
    } catch (err: any) {
      setLastMessage({ type: 'error', text: err.message || 'Reconciliation trigger failed' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleSyncWMS = async () => {
    setActionLoading(true);
    try {
      const res = await api.wmsSync();
      setLastMessage({ type: 'success', text: `WMS Expected baseline synced: ${res.records_synchronized} records aligned.` });
      await loadWMSData();
      onDataChanged();
    } catch (err: any) {
      setLastMessage({ type: 'error', text: err.message || 'Sync failed' });
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6 text-xs text-slate-800">
      
      {/* Alert banner if message */}
      {lastMessage && (
        <div className={`p-3.5 rounded-xl border flex items-center justify-between ${
          lastMessage.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          <div className="flex items-center space-x-2">
            {lastMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 text-red-600" />}
            <span className="font-medium">{lastMessage.text}</span>
          </div>
          <button onClick={() => setLastMessage(null)} className="text-slate-400 hover:text-slate-600 text-[11px]">Dismiss</button>
        </div>
      )}

      {/* Control Banner */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <Database className="w-5 h-5 text-blue-600" />
              <h3 className="text-sm font-bold text-slate-900">WMS Expected Inventory & Simulation Sandbox</h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                Authoritative System of Record
              </span>
            </div>
            <p className="text-slate-500 text-[11px]">
              Simulates enterprise Warehouse Management System operations. Discrepancies are computed dynamically by comparing WMS expected states with physical RFID tag observations.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setActiveModal('RECEIVE')}
              className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-semibold flex items-center space-x-1.5 shadow-xs transition"
            >
              <Package className="w-3.5 h-3.5 text-emerald-400" />
              <span>+ Inbound Receipt</span>
            </button>

            <button
              onClick={() => setActiveModal('MOVE')}
              className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl font-semibold flex items-center space-x-1.5 shadow-xs transition"
            >
              <ArrowRightLeft className="w-3.5 h-3.5 text-blue-600" />
              <span>Authorized Transfer</span>
            </button>

            <button
              onClick={() => setActiveModal('INJECT_ERROR')}
              className="px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-xl font-semibold flex items-center space-x-1.5 shadow-xs transition"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              <span>Inject Test Discrepancy</span>
            </button>

            <button
              onClick={handleSyncWMS}
              disabled={actionLoading}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold flex items-center space-x-1 transition"
              title="Resync WMS expected shelf to reconciliation baseline"
            >
              <RotateCw className={`w-3.5 h-3.5 ${actionLoading ? 'animate-spin' : ''}`} />
              <span>Resync</span>
            </button>

            <button
              onClick={handleTriggerReconcile}
              disabled={actionLoading}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold flex items-center space-x-1.5 shadow-xs transition"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Run AI Reconciliation</span>
            </button>
          </div>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
            <span className="text-slate-500 text-[11px] block">WMS Expected Items</span>
            <span className="text-lg font-bold text-slate-900 font-mono">{wmsItems.length}</span>
          </div>
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
            <span className="text-slate-500 text-[11px] block">Available for Picking</span>
            <span className="text-lg font-bold text-emerald-700 font-mono">
              {wmsItems.filter(i => i.status === 'AVAILABLE').length}
            </span>
          </div>
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
            <span className="text-slate-500 text-[11px] block">Allocated / In-Transit</span>
            <span className="text-lg font-bold text-blue-700 font-mono">
              {wmsItems.filter(i => i.status === 'ALLOCATED' || i.status === 'IN_TRANSIT').length}
            </span>
          </div>
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
            <span className="text-slate-500 text-[11px] block">WMS Transactions</span>
            <span className="text-lg font-bold text-slate-700 font-mono">{transactions.length}</span>
          </div>
        </div>
      </div>

      {/* Main Grid: WMS Table & Transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* WMS Inventory Table */}
        <div className="lg:col-span-2 bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-slate-900 text-sm">WMS Inventory Master Records</h4>
            <span className="text-[11px] text-slate-500">{wmsItems.length} registered items</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 text-[11px] font-semibold">
                  <th className="pb-2.5">EPC / Tag</th>
                  <th className="pb-2.5">SKU & Description</th>
                  <th className="pb-2.5">Expected Shelf</th>
                  <th className="pb-2.5">Lot #</th>
                  <th className="pb-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {wmsItems.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/60 transition">
                    <td className="py-2.5 font-bold text-slate-900">{item.epc}</td>
                    <td className="py-2.5 font-sans">
                      <div className="font-semibold text-slate-800">{item.sku}</div>
                      <div className="text-[10px] text-slate-400">{item.product_name}</div>
                    </td>
                    <td className="py-2.5">
                      <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-800 font-semibold border border-blue-200 text-[11px]">
                        {item.expected_shelf_code}
                      </span>
                    </td>
                    <td className="py-2.5 text-slate-500 text-[11px]">{item.lot_number}</td>
                    <td className="py-2.5 font-sans">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                        item.status === 'AVAILABLE'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : item.status === 'SHIPPED'
                          ? 'bg-slate-100 text-slate-600 border-slate-200'
                          : 'bg-blue-50 text-blue-800 border-blue-200'
                      }`}>
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Transactions Sidebar */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-slate-900 text-sm flex items-center space-x-1.5">
              <FileText className="w-4 h-4 text-slate-600" />
              <span>WMS Transaction Audit</span>
            </h4>
            <span className="text-[10px] text-slate-400">Live Log</span>
          </div>

          <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
            {transactions.map((tx) => (
              <div key={tx.id} className="p-2.5 rounded-xl border border-slate-100 bg-slate-50/70 space-y-1">
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    tx.transaction_type === 'RECEIPT'
                      ? 'bg-emerald-100 text-emerald-800'
                      : tx.transaction_type === 'PUTAWAY' || tx.transaction_type === 'MOVE'
                      ? 'bg-blue-100 text-blue-800'
                      : tx.transaction_type === 'SHIP'
                      ? 'bg-purple-100 text-purple-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}>
                    {tx.transaction_type}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {tx.timestamp ? new Date(tx.timestamp).toLocaleTimeString() : ''}
                  </span>
                </div>
                <div className="font-mono text-[11px] font-bold text-slate-900">{tx.epc || tx.sku}</div>
                <div className="text-[11px] text-slate-600 flex items-center justify-between">
                  <span>
                    {tx.from_shelf_code ? `${tx.from_shelf_code} → ` : ''}
                    <strong>{tx.to_shelf_code || 'Outbound'}</strong>
                  </span>
                  <span className="text-[10px] text-slate-500 font-sans">{tx.user_name}</span>
                </div>
                {tx.notes && <p className="text-[10px] text-slate-500 italic">{tx.notes}</p>}
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Inbound Receipt Modal */}
      {activeModal === 'RECEIVE' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-xs p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
              <Package className="w-5 h-5 text-emerald-600" />
              <span>Inbound Goods Receipt</span>
            </h3>
            <form onSubmit={handleReceive} className="space-y-3">
              <div>
                <label className="font-semibold block mb-1">SKU:</label>
                <input
                  type="text"
                  value={receiveSku}
                  onChange={(e) => setReceiveSku(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-mono"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold block mb-1">Quantity:</label>
                  <input
                    type="number"
                    min="1"
                    value={receiveQty}
                    onChange={(e) => setReceiveQty(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="font-semibold block mb-1">Receiving Shelf:</label>
                  <select
                    value={receiveShelf}
                    onChange={(e) => setReceiveShelf(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-mono"
                  >
                    {shelves.map((s) => (
                      <option key={s.id} value={s.shelf_code}>{s.shelf_code}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="font-semibold block mb-1">Lot / Batch Number:</label>
                <input
                  type="text"
                  value={receiveLot}
                  onChange={(e) => setReceiveLot(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-mono"
                />
              </div>
              <div className="flex justify-end space-x-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-4 py-2 bg-slate-100 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-semibold"
                >
                  Receive Goods
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Authorized Transfer Modal */}
      {activeModal === 'MOVE' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-xs p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
              <ArrowRightLeft className="w-5 h-5 text-blue-600" />
              <span>Authorized Internal Transfer</span>
            </h3>
            <form onSubmit={handleMove} className="space-y-3">
              <div>
                <label className="font-semibold block mb-1">Target EPC:</label>
                <select
                  value={moveEpc}
                  onChange={(e) => setMoveEpc(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-mono"
                >
                  {wmsItems.map((i) => (
                    <option key={i.id} value={i.epc}>{i.epc} ({i.sku} @ {i.expected_shelf_code})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="font-semibold block mb-1">New Destination Shelf:</label>
                <select
                  value={moveShelf}
                  onChange={(e) => setMoveShelf(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-mono"
                >
                  {shelves.map((s) => (
                    <option key={s.id} value={s.shelf_code}>{s.shelf_code} - {s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="font-semibold block mb-1">Reason / Notes:</label>
                <input
                  type="text"
                  value={moveReason}
                  onChange={(e) => setMoveReason(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                />
              </div>
              <div className="flex justify-end space-x-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-4 py-2 bg-slate-100 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-xl font-semibold"
                >
                  Confirm Authorized Transfer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Inject Test Anomaly Modal */}
      {activeModal === 'INJECT_ERROR' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-xs p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              <span>Inject Test Discrepancy Anomaly</span>
            </h3>
            <p className="text-[11px] text-slate-500">
              Create an intentional delta between WMS expected inventory and physical RFID reality to test the autonomous reconciliation and AI diagnostic engine.
            </p>
            <form onSubmit={handleInjectError} className="space-y-3">
              <div>
                <label className="font-semibold block mb-1">Anomaly Type:</label>
                <select
                  value={injectType}
                  onChange={(e) => setInjectType(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-medium"
                >
                  <option value="MISPLACE">MISPLACE: Physical tag moved without WMS record</option>
                  <option value="WMS_DESYNC">WMS_DESYNC: WMS record changed without physical move</option>
                  <option value="SHRINKAGE">SHRINKAGE: Tag physically missing / lost</option>
                  <option value="SHADOW">SHADOW: Tag present but RF-shadowed by metal/liquid</option>
                </select>
              </div>
              <div>
                <label className="font-semibold block mb-1">Target EPC:</label>
                <select
                  value={injectEpc}
                  onChange={(e) => setInjectEpc(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-mono"
                >
                  {wmsItems.map((i) => (
                    <option key={i.id} value={i.epc}>{i.epc} ({i.sku} @ {i.expected_shelf_code})</option>
                  ))}
                </select>
              </div>
              {injectType === 'MISPLACE' && (
                <div>
                  <label className="font-semibold block mb-1">Physical Destination Shelf:</label>
                  <select
                    value={injectShelf}
                    onChange={(e) => setInjectShelf(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-mono"
                  >
                    {shelves.map((s) => (
                      <option key={s.id} value={s.shelf_code}>{s.shelf_code}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="flex justify-end space-x-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-4 py-2 bg-slate-100 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-amber-600 text-white rounded-xl font-semibold"
                >
                  Inject Anomaly
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

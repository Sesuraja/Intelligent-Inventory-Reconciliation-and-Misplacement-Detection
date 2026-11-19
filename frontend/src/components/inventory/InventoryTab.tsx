import React, { useState, useEffect } from 'react';
import {
  Boxes,
  Plus,
  Search,
  ArrowRightLeft,
  CheckCircle2,
  AlertTriangle,
  Radio,
  EyeOff,
  HelpCircle,
  Shield,
  Layers,
  MapPin,
  Tag,
  Package,
  Check
} from 'lucide-react';
import { InventoryItem, ProductItem, ShelfItem } from '../../types';
import { api } from '../../services/api';
import { StatusBadge } from '../common/StatusBadge';
import { LoadingState } from '../common/LoadingState';
import { EmptyState } from '../common/EmptyState';
import { CreateShelfModal } from './CreateShelfModal';
import { AssignTagModal } from './AssignTagModal';
import { CreateProductModal } from './CreateProductModal';
import { useAppSettings } from '../../context/SettingsContext';

export const InventoryTab: React.FC = () => {
  const { settings } = useAppSettings();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [shelves, setShelves] = useState<ShelfItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [selectedShelf, setSelectedShelf] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [activeSubView, setActiveSubView] = useState<'inventory' | 'shelves' | 'catalog'>('inventory');

  // Modals
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [showCreateShelfModal, setShowCreateShelfModal] = useState(false);
  const [showAssignTagModal, setShowAssignTagModal] = useState(false);
  const [showCreateProductModal, setShowCreateProductModal] = useState(false);

  // Movement Modal State
  const [moveEpc, setMoveEpc] = useState('');
  const [targetShelfId, setTargetShelfId] = useState<number>(1);
  const [moveNotes, setMoveNotes] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [invData, prodData, shelfData] = await Promise.all([
        api.getInventory(),
        api.getProducts(),
        api.getShelves()
      ]);
      setItems(invData);
      setProducts(prodData);
      setShelves(shelfData);
      if (shelfData.length > 0) {
        setTargetShelfId(shelfData[0].id);
      }
    } catch (err) {
      console.error('Error loading inventory data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!moveEpc) return;
    try {
      await api.recordMovement({
        epc: moveEpc,
        to_shelf_id: targetShelfId,
        movement_type: 'AUTHORIZED_MOVE',
        authorized_by: settings.currentUser.name || 'Warehouse Operator',
        notes: moveNotes || 'Stock transfer initiated via WMS console'
      });
      setShowMoveModal(false);
      setMoveNotes('');
      await loadData();
    } catch (err: any) {
      alert(`Error recording movement: ${err.message}`);
    }
  };

  const filteredItems = items.filter((item) => {
    const matchesSearch =
      item.epc.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.product_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.product_sku.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesShelf = selectedShelf === 'ALL' || item.expected_shelf_code === selectedShelf;
    const matchesStatus = selectedStatus === 'ALL' || item.status === selectedStatus;
    return matchesSearch && matchesShelf && matchesStatus;
  });

  const filteredProducts = products.filter((prod) => {
    const q = productSearchQuery.toLowerCase();
    return (
      prod.sku.toLowerCase().includes(q) ||
      prod.name.toLowerCase().includes(q) ||
      prod.category.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      
      {/* Header with Subviews & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200/90 p-4 rounded-2xl shadow-xs">
        <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setActiveSubView('inventory')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeSubView === 'inventory'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Tracked Stock & EPC Records
          </button>
          <button
            onClick={() => setActiveSubView('shelves')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeSubView === 'shelves'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Warehouse Shelves Map
          </button>
          <button
            onClick={() => setActiveSubView('catalog')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeSubView === 'catalog'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Master Product Catalog ({products.length})
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowCreateProductModal(true)}
            className="flex items-center justify-center space-x-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-xs transition"
          >
            <Package className="w-3.5 h-3.5 text-emerald-400" />
            <span>+ Add Product</span>
          </button>

          <button
            onClick={() => setShowAssignTagModal(true)}
            className="flex items-center justify-center space-x-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs transition"
          >
            <Tag className="w-3.5 h-3.5" />
            <span>+ Assign Tag to Product</span>
          </button>

          <button
            onClick={() => setShowCreateShelfModal(true)}
            className="flex items-center justify-center space-x-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold shadow-xs transition"
          >
            <Layers className="w-3.5 h-3.5 text-blue-600" />
            <span>+ New Shelf</span>
          </button>

          <button
            onClick={() => {
              if (filteredItems.length > 0) {
                setMoveEpc(filteredItems[0].epc);
              }
              setShowMoveModal(true);
            }}
            className="flex items-center justify-center space-x-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs transition"
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            <span>Log Movement</span>
          </button>
        </div>
      </div>

      {/* View: Warehouse Shelves Map */}
      {activeSubView === 'shelves' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {shelves.map((s) => {
            const shelfItems = items.filter((i) => i.expected_shelf_code === s.shelf_code);
            const misplacedHere = items.filter((i) => i.observed_shelf_code === s.shelf_code && i.expected_shelf_code !== s.shelf_code);
            const inPlaceCount = shelfItems.filter((i) => i.status === 'IN_PLACE').length;
            const utilization = Math.min(100, Math.round((shelfItems.length / s.capacity) * 100));

            return (
              <div key={s.id} className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-base font-bold text-slate-900">{s.shelf_code}</span>
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-semibold border border-blue-200">
                      {s.assigned_antenna_code || 'ANT Mapped'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{s.name || 'Pallet Rack'}</p>

                  <div className="mt-4 space-y-2 text-xs">
                    <div className="flex justify-between text-slate-600">
                      <span>Expected Stock:</span>
                      <strong className="text-slate-900 font-mono">{shelfItems.length} items</strong>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Confirmed In-Place:</span>
                      <strong className="text-emerald-600 font-mono">{inPlaceCount}</strong>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Misplaced Detections:</span>
                      <strong className={misplacedHere.length > 0 ? "text-amber-600 font-mono font-bold" : "text-slate-400 font-mono"}>
                        {misplacedHere.length}
                      </strong>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Capacity Utilization:</span>
                      <strong className="text-slate-800 font-mono">{utilization}%</strong>
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-slate-100">
                  <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                      style={{ width: `${utilization}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}

          {/* Add Shelf Action Card */}
          <button
            onClick={() => setShowCreateShelfModal(true)}
            className="border-2 border-dashed border-slate-200 hover:border-blue-400 bg-slate-50/50 hover:bg-blue-50/30 rounded-2xl p-5 flex flex-col items-center justify-center text-center space-y-2 text-slate-500 hover:text-blue-600 transition min-h-[220px]"
          >
            <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 group-hover:text-blue-600 shadow-xs">
              <Plus className="w-5 h-5 text-blue-600" />
            </div>
            <span className="font-bold text-xs text-slate-900">Add Warehouse Shelf</span>
            <span className="text-[11px] text-slate-400 max-w-[180px]">
              Provision a new physical bay for antenna coverage
            </span>
          </button>
        </div>
      )}

      {/* View: Master Product Catalog */}
      {activeSubView === 'catalog' && (
        <div className="space-y-4">
          {/* Catalog Metrics & Actions Bar */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center space-x-4 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-80">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
                <input
                  type="text"
                  placeholder="Filter products by SKU, title or category..."
                  value={productSearchQuery}
                  onChange={(e) => setProductSearchQuery(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200/90 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-blue-500 transition"
                />
              </div>
              <span className="text-xs text-slate-500 font-medium hidden md:inline">
                {filteredProducts.length} of {products.length} SKUs Listed
              </span>
            </div>

            <div className="flex items-center space-x-3 w-full sm:w-auto justify-end">
              <div className="text-right hidden sm:block">
                <div className="text-xs font-bold text-slate-900 font-mono">
                  ${products.reduce((acc, p) => acc + (p.unit_cost || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-[10px] text-slate-400 uppercase tracking-wider">Catalog Valuation</div>
              </div>
              <button
                onClick={() => setShowCreateProductModal(true)}
                className="flex items-center space-x-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs transition"
              >
                <Package className="w-3.5 h-3.5" />
                <span>+ Register New SKU</span>
              </button>
            </div>
          </div>

          {/* Master Product Catalog Table */}
          <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                    <th className="py-3 px-4">Master SKU</th>
                    <th className="py-3 px-4">Product Name</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Unit Valuation</th>
                    <th className="py-3 px-4">Safety Stock (Min)</th>
                    <th className="py-3 px-4">Active RFID Tags</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="py-12">
                        <LoadingState message="Loading master product database catalog..." />
                      </td>
                    </tr>
                  ) : filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12">
                        <EmptyState
                          title="No Master Products Found"
                          description={productSearchQuery ? "No products matched your search term." : "Your warehouse product database has no registered master SKUs yet."}
                          actionLabel="+ Register First SKU"
                          onAction={() => setShowCreateProductModal(true)}
                        />
                      </td>
                    </tr>
                  ) : (
                    filteredProducts.map((p) => {
                      const boundTags = items.filter((i) => i.product_sku === p.sku);
                      return (
                        <tr key={p.id} className="hover:bg-slate-50/70 transition">
                          <td className="py-3 px-4 font-mono font-bold text-slate-900">
                            {p.sku}
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-semibold text-slate-900 block">{p.name}</span>
                            {p.description && (
                              <span className="text-[11px] text-slate-400 line-clamp-1">{p.description}</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-medium text-[11px] border border-slate-200">
                              {p.category}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono font-semibold text-slate-900">
                            ${p.unit_cost.toFixed(2)}
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-600">
                            {p.min_stock} {p.unit || 'units'}
                          </td>
                          <td className="py-3 px-4">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-mono font-semibold ${
                              boundTags.length > 0
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-slate-100 text-slate-500'
                            }`}>
                              {boundTags.length} Serialized Tags
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={() => setShowAssignTagModal(true)}
                              className="px-2.5 py-1 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 text-slate-600 border border-slate-200 rounded-lg text-[11px] font-semibold transition"
                            >
                              + Assign Tag
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
              <span>Showing {filteredProducts.length} of {products.length} master catalog items</span>
              <span className="font-mono text-blue-700 font-medium">PostgreSQL / SQLite Catalog</span>
            </div>
          </div>
        </div>
      )}

      {/* View: Tracked Stock & EPC Records Table */}
      {activeSubView === 'inventory' && (
        <div className="space-y-4">
          
          {/* Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                placeholder="Search by EPC, SKU, or Product Name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-slate-200/90 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 shadow-xs"
              />
            </div>

            <div className="flex items-center space-x-2">
              <select
                value={selectedShelf}
                onChange={(e) => setSelectedShelf(e.target.value)}
                className="bg-white border border-slate-200/90 rounded-xl px-3 py-2 text-xs text-slate-700 focus:outline-none shadow-xs"
              >
                <option value="ALL">All Shelves ({shelves.length})</option>
                {shelves.map((s) => (
                  <option key={s.id} value={s.shelf_code}>
                    {s.shelf_code} {s.name ? `(${s.name})` : ''}
                  </option>
                ))}
              </select>

              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="bg-white border border-slate-200/90 rounded-xl px-3 py-2 text-xs text-slate-700 focus:outline-none shadow-xs"
              >
                <option value="ALL">All Statuses</option>
                <option value="IN_PLACE">In-Place</option>
                <option value="MISPLACED">Misplaced</option>
                <option value="LIKELY_MISSING">Likely Missing</option>
                <option value="POSSIBLE_UNREAD">RF Unread</option>
                <option value="AMBIGUOUS">Ambiguous</option>
              </select>
            </div>
          </div>

          {/* Main Inventory Table */}
          <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                    <th className="py-3 px-4">Tag EPC</th>
                    <th className="py-3 px-4">SKU / Product</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Expected Shelf</th>
                    <th className="py-3 px-4">Observed Shelf</th>
                    <th className="py-3 px-4">Reconciliation Status</th>
                    <th className="py-3 px-4">Confidence</th>
                    <th className="py-3 px-4">Unit Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="py-12">
                        <LoadingState message="Fetching registered EPC items from database..." />
                      </td>
                    </tr>
                  ) : filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12">
                        <EmptyState
                          title="No Inventory Found"
                          description="No tracked inventory items matched your active search or shelf filters."
                          actionLabel="Reset Filters"
                          onAction={() => {
                            setSearchQuery('');
                            setSelectedShelf('ALL');
                            setSelectedStatus('ALL');
                          }}
                        />
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/70 transition">
                        <td className="py-3 px-4 font-mono font-semibold text-slate-900">
                          {item.epc}
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-semibold text-slate-900 block">{item.product_name}</span>
                          <span className="text-[10px] text-slate-400 font-mono">{item.product_sku}</span>
                        </td>
                        <td className="py-3 px-4 text-slate-600">{item.category}</td>
                        <td className="py-3 px-4 font-mono font-bold text-blue-600">
                          {item.expected_shelf_code}
                        </td>
                        <td className="py-3 px-4 font-mono">
                          {item.observed_shelf_code ? (
                            <span className={item.observed_shelf_code === item.expected_shelf_code ? "text-emerald-700 font-bold" : "text-amber-700 font-bold"}>
                              {item.observed_shelf_code}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">None (0 reads)</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <StatusBadge status={item.status} />
                        </td>
                        <td className="py-3 px-4 font-mono font-semibold text-slate-800">
                          {Math.round(item.confidence * 100)}%
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-600">
                          ${item.unit_cost.toFixed(2)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            
            <div className="py-3 px-4 border-t border-slate-200/80 bg-slate-50/50 flex justify-between items-center text-xs text-slate-500">
              <span>Showing {filteredItems.length} of {items.length} registered items</span>
              <span className="font-mono text-emerald-700 font-medium">WMS Master Records Synchronized</span>
            </div>
          </div>

        </div>
      )}

      {/* Movement Modal */}
      {showMoveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-xs p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4 text-xs">
            <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
              <ArrowRightLeft className="w-4 h-4 text-blue-600" />
              <span>Record Authorized Inventory Movement</span>
            </h3>
            <p className="text-slate-500">
              Logging an authorized movement updates expected WMS locations and prevents false misplacement alerts.
            </p>
            <form onSubmit={handleCreateMovement} className="space-y-3 pt-2">
              <div>
                <label className="text-slate-700 font-semibold block mb-1">Select Tag EPC</label>
                <select
                  value={moveEpc}
                  onChange={(e) => setMoveEpc(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-mono focus:bg-white focus:outline-none"
                >
                  {items.map((i) => (
                    <option key={i.epc} value={i.epc}>
                      {i.epc} - {i.product_name} (Current: {i.expected_shelf_code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-700 font-semibold block mb-1">Destination Shelf</label>
                <select
                  value={targetShelfId}
                  onChange={(e) => setTargetShelfId(Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:bg-white focus:outline-none"
                >
                  {shelves.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.shelf_code} ({s.name || 'Shelf'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-700 font-semibold block mb-1">Authorization Notes / Work Order</label>
                <input
                  type="text"
                  placeholder="e.g. Work Order WO-4491 Pick & Relocate"
                  value={moveNotes}
                  onChange={(e) => setMoveNotes(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:bg-white focus:outline-none"
                />
              </div>

              <div className="pt-3 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowMoveModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-semibold hover:bg-slate-200 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 shadow-xs transition"
                >
                  Authorize Movement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Shelf Modal */}
      <CreateShelfModal
        isOpen={showCreateShelfModal}
        onClose={() => setShowCreateShelfModal(false)}
        onSuccess={loadData}
      />

      {/* Create Product Modal */}
      <CreateProductModal
        isOpen={showCreateProductModal}
        onClose={() => setShowCreateProductModal(false)}
        onSuccess={loadData}
      />

      {/* Assign Tag Modal */}
      <AssignTagModal
        isOpen={showAssignTagModal}
        onClose={() => setShowAssignTagModal(false)}
        onSuccess={loadData}
        products={products}
        shelves={shelves}
      />

    </div>
  );
};

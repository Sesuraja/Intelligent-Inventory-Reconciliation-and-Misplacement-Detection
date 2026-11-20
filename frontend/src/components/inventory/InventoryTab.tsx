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
import { InventoryItem, ProductItem, ShelfItem, AntennaItem } from '../../types';
import { api } from '../../services/api';
import { StatusBadge } from '../common/StatusBadge';
import { LoadingState } from '../common/LoadingState';
import { EmptyState } from '../common/EmptyState';
import { CreateShelfModal } from './CreateShelfModal';
import { AssignTagModal } from './AssignTagModal';
import { CreateProductModal } from './CreateProductModal';
import { EditProductModal } from './EditProductModal';
import { EditShelfModal } from './EditShelfModal';
import { WMSSandboxView } from './WMSSandboxView';
import { WarehouseLayoutView } from './WarehouseLayoutView';
import { InventoryHistoryView } from './InventoryHistoryView';
import { useAppSettings } from '../../context/SettingsContext';
import { Edit2, Trash2 } from 'lucide-react';

interface InventoryTabProps {
  subPage?: string;
  onNavigateSubPage?: (subPageId: string) => void;
}

export const InventoryTab: React.FC<InventoryTabProps> = ({ subPage, onNavigateSubPage }) => {
  const { settings } = useAppSettings();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [shelves, setShelves] = useState<ShelfItem[]>([]);
  const [antennas, setAntennas] = useState<AntennaItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [selectedShelf, setSelectedShelf] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [activeSubView, setActiveSubView] = useState<'products' | 'tags' | 'layout' | 'wms' | 'history'>('products');

  useEffect(() => {
    if (subPage === 'inventory-tags') setActiveSubView('tags');
    else if (subPage === 'inventory-layout') setActiveSubView('layout');
    else if (subPage === 'inventory-wms') setActiveSubView('wms');
    else if (subPage === 'inventory-history') setActiveSubView('history');
    else if (subPage === 'inventory-products') setActiveSubView('products');
  }, [subPage]);

  // Modals
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [showCreateShelfModal, setShowCreateShelfModal] = useState(false);
  const [showAssignTagModal, setShowAssignTagModal] = useState(false);
  const [showCreateProductModal, setShowCreateProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductItem | null>(null);
  const [editingShelf, setEditingShelf] = useState<ShelfItem | null>(null);

  // Movement Modal State
  const [moveEpc, setMoveEpc] = useState('');
  const [targetShelfId, setTargetShelfId] = useState<number>(1);
  const [moveNotes, setMoveNotes] = useState('');

  const handleDeleteProduct = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this master product?')) return;
    try {
      await api.deleteProduct(id);
      loadData();
    } catch (err: any) {
      alert(`Error deleting product: ${err.message}`);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [invData, prodData, shelfData, antData] = await Promise.all([
        api.getInventory(),
        api.getProducts(),
        api.getShelves(),
        api.getAntennas()
      ]);
      setItems(invData);
      setProducts(prodData);
      setShelves(shelfData);
      setAntennas(antData);
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
        <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => { setActiveSubView('products'); onNavigateSubPage?.('inventory-products'); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeSubView === 'products'
                ? 'bg-white text-slate-900 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Products & SKUs ({products.length})
          </button>
          <button
            onClick={() => { setActiveSubView('tags'); onNavigateSubPage?.('inventory-tags'); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeSubView === 'tags'
                ? 'bg-white text-slate-900 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            EPC / Tags ({items.length})
          </button>
          <button
            onClick={() => { setActiveSubView('layout'); onNavigateSubPage?.('inventory-layout'); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeSubView === 'layout'
                ? 'bg-white text-slate-900 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Warehouse Layout
          </button>
          <button
            onClick={() => { setActiveSubView('wms'); onNavigateSubPage?.('inventory-wms'); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeSubView === 'wms'
                ? 'bg-white text-blue-900 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            WMS & Sync
          </button>
          <button
            onClick={() => { setActiveSubView('history'); onNavigateSubPage?.('inventory-history'); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeSubView === 'history'
                ? 'bg-white text-purple-900 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Inventory History
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

      {/* View: 2.1 Products & SKUs (Master Catalog) */}
      {activeSubView === 'products' && (
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
                          <td className="py-3 px-4 text-right space-x-1.5">
                            <button
                              onClick={() => setEditingProduct(p)}
                              className="p-1.5 bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-500 rounded-lg transition"
                              title="Edit Master SKU"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteProduct(p.id)}
                              className="p-1.5 bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-500 rounded-lg transition"
                              title="Delete Master SKU"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
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

      {/* View: 2.2 EPC / Tags (Tracked Stock & EPC Records Table) */}
      {activeSubView === 'tags' && (
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

      {/* View: Warehouse Layout */}
      {activeSubView === 'layout' && (
        <WarehouseLayoutView
          shelves={shelves}
          items={items}
          antennas={antennas}
          onEditShelf={(s) => setEditingShelf(s)}
        />
      )}

      {/* View: 2.4 WMS & Sync */}
      {activeSubView === 'wms' && (
        <WMSSandboxView shelves={shelves} onDataChanged={loadData} />
      )}

      {/* View: 2.5 Inventory History */}
      {activeSubView === 'history' && (
        <InventoryHistoryView shelves={shelves} />
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

      {/* Edit Product Modal */}
      <EditProductModal
        isOpen={!!editingProduct}
        onClose={() => setEditingProduct(null)}
        onSuccess={loadData}
        product={editingProduct}
      />

      {/* Edit Shelf Modal */}
      <EditShelfModal
        isOpen={!!editingShelf}
        onClose={() => setEditingShelf(null)}
        onSuccess={loadData}
        shelf={editingShelf}
      />

    </div>
  );
};

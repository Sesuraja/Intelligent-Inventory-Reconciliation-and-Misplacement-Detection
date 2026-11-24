import React, { useState, useEffect } from 'react';
import { X, Building2, MapPin, Plus, Trash2, Edit2, Check, Save } from 'lucide-react';
import { api } from '../../services/api';

interface WarehouseConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const WarehouseConfigModal: React.FC<WarehouseConfigModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const [warehouseId, setWarehouseId] = useState<number>(1);
  const [warehouseName, setWarehouseName] = useState('Central Logistics Hub');
  const [warehouseCode, setWarehouseCode] = useState('WH-CENTRAL-01');
  const [warehouseDesc, setWarehouseDesc] = useState('Primary UHF RFID Multi-Zone Smart Distribution Facility');
  const [zones, setZones] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New Zone State
  const [newZoneName, setNewZoneName] = useState('');
  const [newZoneCode, setNewZoneCode] = useState('');
  const [editingZoneId, setEditingZoneId] = useState<number | null>(null);
  const [editZoneName, setEditZoneName] = useState('');
  const [editZoneCode, setEditZoneCode] = useState('');

  const loadWarehouseData = async () => {
    setLoading(true);
    try {
      const locations = await api.getLocations();
      if (locations && locations.length > 0) {
        const wh = locations[0];
        setWarehouseId(wh.id);
        setWarehouseName(wh.name || 'Central Logistics Hub');
        setWarehouseCode(wh.code || 'WH-CENTRAL-01');
        setWarehouseDesc(wh.description || 'Primary UHF RFID Multi-Zone Smart Distribution Facility');
      }
      const zonesData = await api.getZones();
      setZones(zonesData || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch warehouse layout configuration');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadWarehouseData();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleUpdateWarehouse = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api.updateWarehouse(warehouseId, {
        name: warehouseName.trim(),
        code: warehouseCode.trim().toUpperCase(),
        description: warehouseDesc.trim()
      });
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to update warehouse details');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateZone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newZoneName.trim() || !newZoneCode.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.createZone({
        name: newZoneName.trim(),
        code: newZoneCode.trim().toUpperCase(),
        warehouse_id: warehouseId
      });
      setNewZoneName('');
      setNewZoneCode('');
      await loadWarehouseData();
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to create zone');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveZoneEdit = async (zoneId: number) => {
    if (!editZoneName.trim() || !editZoneCode.trim()) return;
    setSubmitting(true);
    try {
      await api.updateZone(zoneId, {
        name: editZoneName.trim(),
        code: editZoneCode.trim().toUpperCase()
      });
      setEditingZoneId(null);
      await loadWarehouseData();
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to update zone');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteZone = async (zoneId: number, zoneName: string) => {
    if (!window.confirm(`Are you sure you want to delete zone "${zoneName}"? Shelves in this zone will be deleted or unassigned.`)) return;
    setSubmitting(true);
    try {
      await api.deleteZone(zoneId);
      await loadWarehouseData();
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to delete zone');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/80 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-700">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Customize Warehouse Facility & Layout</h3>
              <p className="text-[11px] text-slate-500">Configure warehouse facility metadata, zone boundaries, and storage bays</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-[11px]">
              {error}
            </div>
          )}

          {/* Section 1: Facility Details */}
          <form onSubmit={handleUpdateWarehouse} className="space-y-3.5 bg-slate-50/80 p-4 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-slate-900 text-xs flex items-center space-x-1.5">
                <Building2 className="w-3.5 h-3.5 text-blue-600" />
                <span>Warehouse Facility Profile</span>
              </h4>
              <button
                type="submit"
                disabled={submitting}
                className="flex items-center space-x-1 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Facility</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Facility Name</label>
                <input
                  type="text"
                  value={warehouseName}
                  onChange={(e) => setWarehouseName(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:border-blue-500 transition"
                  required
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Facility Code</label>
                <input
                  type="text"
                  value={warehouseCode}
                  onChange={(e) => setWarehouseCode(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-blue-500 transition"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Facility Description</label>
              <input
                type="text"
                value={warehouseDesc}
                onChange={(e) => setWarehouseDesc(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-blue-500 transition"
              />
            </div>
          </form>

          {/* Section 2: Warehouse Zones Management */}
          <div className="space-y-3.5 bg-slate-50/80 p-4 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-slate-900 text-xs flex items-center space-x-1.5">
                  <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Warehouse Zones & Bays ({zones.length})</span>
                </h4>
                <p className="text-[10px] text-slate-500">Logical warehouse sectors grouping physical shelves and antenna coverage</p>
              </div>
            </div>

            {/* List Existing Zones */}
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {zones.map((z) => {
                const isEditing = editingZoneId === z.id;
                return (
                  <div
                    key={z.id}
                    className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between"
                  >
                    {isEditing ? (
                      <div className="flex items-center space-x-2 flex-1 mr-2">
                        <input
                          type="text"
                          value={editZoneName}
                          onChange={(e) => setEditZoneName(e.target.value)}
                          className="flex-1 bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs font-semibold"
                          placeholder="Zone Name"
                        />
                        <input
                          type="text"
                          value={editZoneCode}
                          onChange={(e) => setEditZoneCode(e.target.value)}
                          className="w-24 bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs font-mono font-bold"
                          placeholder="Code"
                        />
                        <button
                          onClick={() => handleSaveZoneEdit(z.id)}
                          className="p-1 bg-emerald-600 text-white rounded hover:bg-emerald-700"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setEditingZoneId(null)}
                          className="p-1 bg-slate-200 text-slate-700 rounded hover:bg-slate-300"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-3">
                        <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {z.code}
                        </span>
                        <div>
                          <span className="font-semibold text-slate-900 text-xs block">{z.name}</span>
                          <span className="text-[10px] text-slate-400">Zone ID #{z.id}</span>
                        </div>
                      </div>
                    )}

                    {!isEditing && (
                      <div className="flex items-center space-x-1.5">
                        <button
                          onClick={() => {
                            setEditingZoneId(z.id);
                            setEditZoneName(z.name);
                            setEditZoneCode(z.code);
                          }}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                          title="Edit Zone"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteZone(z.id, z.name)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                          title="Delete Zone"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Add New Zone Form */}
            <form onSubmit={handleCreateZone} className="pt-2 border-t border-slate-200/80 flex items-center space-x-2">
              <input
                type="text"
                placeholder="New Zone Name (e.g. Inbound Dock Bay)"
                value={newZoneName}
                onChange={(e) => setNewZoneName(e.target.value)}
                className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                required
              />
              <input
                type="text"
                placeholder="Code (e.g. ZONE_C)"
                value={newZoneCode}
                onChange={(e) => setNewZoneCode(e.target.value)}
                className="w-28 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-blue-500"
                required
              />
              <button
                type="submit"
                disabled={submitting}
                className="flex items-center space-x-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Zone</span>
              </button>
            </form>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-semibold transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

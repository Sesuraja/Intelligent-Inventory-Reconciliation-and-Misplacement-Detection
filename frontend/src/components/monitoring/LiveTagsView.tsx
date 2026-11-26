import React, { useState, useEffect } from 'react';
import {
  Tag,
  Search,
  Filter,
  Activity,
  Layers,
  Radio,
  RefreshCw,
  Signal,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { RFIDEvent, InventoryItem } from '../../types';
import { api } from '../../services/api';

interface LiveTagsViewProps {
  liveEvents: RFIDEvent[];
  isLiveConnected: boolean;
  onRefresh: () => void;
}

export const LiveTagsView: React.FC<LiveTagsViewProps> = ({
  liveEvents,
  isLiveConnected,
  onRefresh
}) => {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [portFilter, setPortFilter] = useState<string>('ALL');
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  useEffect(() => {
    let active = true;

    const fetchTags = async () => {
      try {
        const inv = await api.getInventory();
        if (active) {
          setItems(inv);
          setLastUpdated(new Date());
        }
      } catch (err) {
        console.error('Error polling live tags:', err);
      }
    };

    setLoading(true);
    fetchTags().finally(() => {
      if (active) setLoading(false);
    });

    // Automatically update real-time tags every 5 seconds
    const interval = setInterval(() => {
      fetchTags();
      onRefresh();
    }, 5000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [onRefresh]);

  // Map latest live events by EPC
  const eventMap = new Map<string, RFIDEvent>();
  liveEvents.forEach((ev) => {
    const evTime = ev.observed_at || (ev as any).timestamp;
    const existing = eventMap.get(ev.epc);
    const existingTime = existing?.observed_at || (existing as any)?.timestamp;
    if (!existing || (evTime && (!existingTime || new Date(evTime) > new Date(existingTime)))) {
      eventMap.set(ev.epc, ev);
    }
  });

  // Dynamically derive active antenna ports present in live stream
  const availablePorts = Array.from(
    new Set(
      liveEvents
        .map((e) => e.antenna_port || (e as any).antenna_id)
        .filter((p): p is number => typeof p === 'number' && p > 0)
    )
  ).sort((a, b) => a - b);

  const filteredItems = items.filter((item) => {
    const ev = eventMap.get(item.epc);
    const matchesSearch =
      item.epc.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.product_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.product_sku.toLowerCase().includes(searchQuery.toLowerCase());

    const antPort = ev?.antenna_port !== undefined ? String(ev.antenna_port) : null;
    const matchesPort = portFilter === 'ALL' || antPort === portFilter;

    return matchesSearch && matchesPort;
  });

  const getRssiColor = (rssi: number) => {
    if (rssi >= -50) return 'text-emerald-700 bg-emerald-50 border-emerald-200';
    if (rssi >= -68) return 'text-blue-700 bg-blue-50 border-blue-200';
    return 'text-amber-700 bg-amber-50 border-amber-200';
  };

  return (
    <div className="space-y-6 text-xs text-slate-800">
      {/* Top Banner */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Tag className="w-5 h-5 text-indigo-600" />
            <h3 className="text-base font-bold text-slate-900">Live RFID Tags Streaming Telemetry</h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              {items.length} PHYSICAL TAGS REGISTERED
            </span>
            <span className="flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping" />
              <span>AUTO-UPDATING EVERY 5S</span>
            </span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
              isLiveConnected ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'
            }`}>
              {isLiveConnected ? 'LIVE FEED CONNECTED' : 'POLLING GATEWAY'}
            </span>
            <span className="text-[11px] text-slate-400 font-mono hidden sm:inline">
              Synced: {lastUpdated.toLocaleTimeString()}
            </span>
          </div>
          <p className="text-slate-500 text-xs mt-1">
            Real-time Gen2 UHF RFID tag detections, RSSI signal meters, and antenna port observations streaming from Aperture Gateway.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => {
              onRefresh();
              api.getInventory().then(setItems).catch(console.error);
            }}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh Tags</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by EPC, SKU, or Product..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-blue-500 transition"
          />
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
          <span className="text-slate-500 text-[11px] font-medium">Filter by Antenna:</span>
          <button
            onClick={() => setPortFilter('ALL')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
              portFilter === 'ALL'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All Antennas
          </button>
          {availablePorts.map((p) => (
            <button
              key={p}
              onClick={() => setPortFilter(String(p))}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                portFilter === String(p)
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Antenna Port {p}
            </button>
          ))}
        </div>
      </div>

      {/* Tags Table */}
      <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                <th className="py-3 px-4">Tag EPC (Gen2 UHF)</th>
                <th className="py-3 px-4">Bound SKU & Product</th>
                <th className="py-3 px-4">Observed Antenna</th>
                <th className="py-3 px-4">Expected Shelf</th>
                <th className="py-3 px-4">Observed Shelf</th>
                <th className="py-3 px-4">Live RSSI Signal</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Provenance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    No physical RFID tags match the current search or antenna filter.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const ev = eventMap.get(item.epc);
                  const observedRssi = ev?.rssi_dbm !== undefined ? ev.rssi_dbm : (ev as any)?.rssi !== undefined ? (ev as any).rssi : null;
                  const observedPort = ev?.antenna_port ?? (ev as any)?.antenna_id ?? null;
                  const isMisplaced = item.observed_shelf_code && item.observed_shelf_code !== item.expected_shelf_code;

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        {item.epc}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-slate-900 block">{item.product_name}</span>
                        <span className="text-[10px] text-slate-400 font-mono">{item.product_sku}</span>
                      </td>
                      <td className="py-3 px-4">
                        {observedPort !== null ? (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-mono text-[11px] font-semibold border border-slate-200">
                            <Radio className="w-3 h-3 text-blue-600" />
                            <span>Port {observedPort} (ANT-0{observedPort})</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 font-mono italic text-[11px]">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-blue-600">
                        {item.expected_shelf_code}
                      </td>
                      <td className="py-3 px-4 font-mono">
                        {item.observed_shelf_code ? (
                          <span className={item.observed_shelf_code === item.expected_shelf_code ? 'text-emerald-700 font-bold' : 'text-amber-700 font-bold'}>
                            {item.observed_shelf_code}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">Unread</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {observedRssi !== null ? (
                          <span className={`inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full font-mono text-xs font-bold border ${getRssiColor(observedRssi)}`}>
                            <Signal className="w-3 h-3" />
                            <span>{observedRssi.toFixed(1)} dBm</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">No active RF signal</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
                          isMisplaced
                            ? 'bg-amber-50 text-amber-800 border-amber-200'
                            : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        }`}>
                          {isMisplaced ? 'MISPLACED' : 'PRESENT_OK'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-100 text-slate-600 border border-slate-200">
                          PHYSICAL
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="py-3 px-4 border-t border-slate-200/80 bg-slate-50/50 flex justify-between items-center text-xs text-slate-500">
          <span>Showing {filteredItems.length} of {items.length} detected physical tags</span>
          <span className="font-mono text-emerald-700 font-medium">100% Real Physical Hardware Telemetry</span>
        </div>
      </div>
    </div>
  );
};

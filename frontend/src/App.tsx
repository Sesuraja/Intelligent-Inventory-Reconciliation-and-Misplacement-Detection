import React, { useState, useEffect, useRef } from 'react';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { Footer } from './components/layout/Footer';
import { SettingsModal } from './components/layout/SettingsModal';
import { DashboardTab } from './components/dashboard/DashboardTab';
import { InventoryTab } from './components/inventory/InventoryTab';
import { LiveMonitoringTab } from './components/monitoring/LiveMonitoringTab';
import { AIExceptionsTab } from './components/exceptions/AIExceptionsTab';
import { ReportsTab } from './components/reports/ReportsTab';
import {
  NavigationTab,
  DashboardSummary,
  ReaderItem,
  AntennaItem,
  ShelfItem,
  AIModelItem,
  RFIDEvent
} from './types';
import { api } from './services/api';
import { WifiOff } from 'lucide-react';

const pathToTab = (pathname: string): NavigationTab => {
  const clean = pathname.replace(/^\/+/, '').split('/')[0].toLowerCase();
  if (clean === 'inventory') return 'inventory';
  if (clean === 'monitoring' || clean === 'live' || clean === 'live-monitoring') return 'monitoring';
  if (clean === 'exceptions' || clean === 'ai-exceptions') return 'exceptions';
  if (clean === 'reports' || clean === 'audit') return 'reports';
  return 'dashboard';
};

const tabToTitle: Record<NavigationTab, string> = {
  dashboard: 'Warehouse Dashboard | Intelligent Inventory Reconciliation & Misplacement Detection',
  inventory: 'Inventory & Shelf Stock Records | Intelligent Inventory Reconciliation',
  monitoring: 'Live UHF RFID Monitoring & Antenna Port Matrix | Intelligent Inventory Reconciliation',
  exceptions: 'AI Discrepancy & Root Cause Analysis | Intelligent Inventory Reconciliation',
  reports: 'Inventory Audit & AI Performance Reports | Intelligent Inventory Reconciliation',
};

export function App() {
  const [currentTab, setCurrentTab] = useState<NavigationTab>(() => {
    if (typeof window !== 'undefined') {
      return pathToTab(window.location.pathname);
    }
    return 'dashboard';
  });
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [readers, setReaders] = useState<ReaderItem[]>([]);
  const [antennas, setAntennas] = useState<AntennaItem[]>([]);
  const [shelves, setShelves] = useState<ShelfItem[]>([]);
  const [models, setModels] = useState<AIModelItem[]>([]);
  const [liveEvents, setLiveEvents] = useState<RFIDEvent[]>([]);
  const [isLiveConnected, setIsLiveConnected] = useState<boolean>(false);
  const [exceptionsFilter, setExceptionsFilter] = useState<string | undefined>(undefined);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    loadBaseData();
    initWebSocket();

    const initialTab = pathToTab(window.location.pathname);
    setCurrentTab(initialTab);
    document.title = tabToTitle[initialTab] || tabToTitle.dashboard;

    const handlePopState = () => {
      const tab = pathToTab(window.location.pathname);
      setCurrentTab(tab);
      document.title = tabToTitle[tab] || tabToTitle.dashboard;
    };

    window.addEventListener('popstate', handlePopState);

    // Periodic KPI polling fallback (every 8s)
    const interval = setInterval(() => {
      loadSummary();
    }, 8000);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      clearInterval(interval);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const loadBaseData = async () => {
    try {
      // 1. Fetch KPI summary immediately for instantaneous dashboard render
      const sum = await api.getDashboardSummary();
      setSummary(sum);
      if (sum.recent_events) {
        setLiveEvents(sum.recent_events);
      }

      // 2. Fetch auxiliary config concurrently in background
      const [rds, ants, shs] = await Promise.all([
        api.getReaders(),
        api.getAntennas(),
        api.getShelves()
      ]);
      setReaders(rds);
      setAntennas(ants);
      setShelves(shs);
    } catch (err) {
      console.error('Error loading warehouse data:', err);
    }
  };

  const loadSummary = async () => {
    try {
      // Fast polling only hits the cached summary endpoint (< 5ms)
      const sum = await api.getDashboardSummary();
      setSummary(sum);
    } catch (err) {
      console.error('Error refreshing summary:', err);
    }
  };

  const handleOpenSettings = async () => {
    setIsSettingsOpen(true);
    if (models.length === 0) {
      try {
        const mods = await api.getAIModels();
        setModels(mods);
      } catch (err) {
        console.error('Error loading AI models:', err);
      }
    }
  };

  const initWebSocket = () => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/rfid-events`;

    try {
      const socket = new WebSocket(wsUrl);
      wsRef.current = socket;

      socket.onopen = () => {
        setIsLiveConnected(true);
      };

      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === 'RFID_OBSERVATIONS' && payload.events) {
            setLiveEvents((prev) => [...payload.events, ...prev.slice(0, 40)]);
          }
        } catch (e) {
          console.error('Error parsing WS message:', e);
        }
      };

      socket.onclose = () => {
        setIsLiveConnected(false);
        setTimeout(initWebSocket, 5000);
      };

      socket.onerror = () => {
        setIsLiveConnected(false);
      };
    } catch (err) {
      console.error('WebSocket connection error:', err);
    }
  };

  const handleNavigateTab = (tab: NavigationTab, filter?: string) => {
    if (filter) {
      setExceptionsFilter(filter);
    } else {
      setExceptionsFilter(undefined);
    }
    setCurrentTab(tab);
    const targetPath = tab === 'dashboard' ? '/' : `/${tab}`;
    if (window.location.pathname !== targetPath) {
      window.history.pushState({ tab }, '', targetPath);
    }
    document.title = tabToTitle[tab] || tabToTitle.dashboard;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleRetrainModel = async (id: number) => {
    try {
      await api.retrainModel(id);
      const mods = await api.getAIModels();
      setModels(mods);
    } catch (err: any) {
      alert(`Retraining failed: ${err.message}`);
    }
  };

  const readerOnline = summary?.kpis ? summary.kpis.readers_online > 0 : true;
  const openExceptions = summary?.kpis ? (summary.kpis.misplaced + summary.kpis.likely_missing + summary.kpis.possible_unread + summary.kpis.ambiguous) : 0;
  const accuracyPct = summary?.kpis ? summary.kpis.accuracy_percentage : 94.2;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex font-sans antialiased">
      
      {/* Dark Navy Sidebar (Left Navigation) */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={handleNavigateTab}
        openExceptionsCount={openExceptions}
        readerOnline={readerOnline}
        onOpenSettings={handleOpenSettings}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main Content Area (Offset by sidebar width on lg screens) */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-64">
        
        {/* Top Header */}
        <Header
          currentTab={currentTab}
          onOpenMobileMenu={() => setIsMobileSidebarOpen(true)}
          onOpenSettings={handleOpenSettings}
          isLiveConnected={isLiveConnected}
          readerOnline={readerOnline}
          accuracyPercentage={accuracyPct}
          onRefresh={loadSummary}
        />

        {/* Reader Outage Warning Banner if Offline */}
        {!readerOnline && (
          <div className="bg-rose-50 border-b border-rose-200 px-6 py-2.5 flex items-center justify-between text-xs text-rose-800">
            <div className="flex items-center space-x-2">
              <WifiOff className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span>
                <strong>Fixed Reader Outage Active (READER_01):</strong> RF scanning suspended. Missing tag exceptions temporarily held in unread state per warehouse policy.
              </span>
            </div>
            <button
              onClick={() => handleNavigateTab('monitoring')}
              className="font-bold underline text-rose-700 hover:text-rose-900"
            >
              Hardware Console
            </button>
          </div>
        )}

        {/* Tab Content Page */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {currentTab === 'dashboard' && (
            <DashboardTab
              summary={summary}
              onNavigateTab={handleNavigateTab}
              onSelectDiscrepancy={(id) => handleNavigateTab('exceptions')}
            />
          )}

          {currentTab === 'inventory' && (
            <InventoryTab />
          )}

          {currentTab === 'monitoring' && (
            <LiveMonitoringTab
              readers={readers}
              antennas={antennas}
              liveEvents={liveEvents}
              isLiveConnected={isLiveConnected}
              onRefreshData={loadSummary}
            />
          )}

          {currentTab === 'exceptions' && (
            <AIExceptionsTab
              initialFilter={exceptionsFilter}
              shelves={shelves}
              onRefreshData={loadSummary}
            />
          )}

          {currentTab === 'reports' && (
            <ReportsTab />
          )}
        </main>

        {/* Responsive Clean Footer */}
        <Footer />

      </div>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        models={models}
        onRetrainModel={handleRetrainModel}
        readers={readers}
        antennas={antennas}
        shelves={shelves}
      />

    </div>
  );
}

export default App;

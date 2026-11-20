import React, { useState, useEffect, useRef } from 'react';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { Footer } from './components/layout/Footer';
import { SettingsModal } from './components/layout/SettingsModal';
import { UserRolesView } from './components/supporting/UserRolesView';
import { HelpDocsView } from './components/supporting/HelpDocsView';
import { DashboardTab } from './components/dashboard/DashboardTab';
import { InventoryTab } from './components/inventory/InventoryTab';
import { LiveMonitoringTab } from './components/monitoring/LiveMonitoringTab';
import { AIExceptionsTab } from './components/exceptions/AIExceptionsTab';
import { ReportsTab } from './components/reports/ReportsTab';
import {
  NavigationTab,
  SubPageId,
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
  if (clean === 'users' || clean === 'roles') return 'users';
  if (clean === 'help' || clean === 'docs') return 'help';
  if (clean === 'settings') return 'settings';
  return 'dashboard';
};

const tabToTitle: Record<NavigationTab, string> = {
  dashboard: 'Warehouse Dashboard | Intelligent Inventory Reconciliation & Misplacement Detection',
  inventory: 'Inventory & Shelf Stock Records | Intelligent Inventory Reconciliation',
  monitoring: 'Live UHF RFID Monitoring & Antenna Port Matrix | Intelligent Inventory Reconciliation',
  exceptions: 'AI Discrepancy & Root Cause Analysis | Intelligent Inventory Reconciliation',
  reports: 'Inventory Audit & AI Performance Reports | Intelligent Inventory Reconciliation',
  users: 'User Roles & Access Control | Intelligent Inventory Reconciliation',
  help: 'Help, Documentation & System Architecture | Intelligent Inventory Reconciliation',
  settings: 'System Configuration & Settings | Intelligent Inventory Reconciliation',
};

export function App() {
  const [currentTab, setCurrentTab] = useState<NavigationTab>(() => {
    if (typeof window !== 'undefined') {
      return pathToTab(window.location.pathname);
    }
    return 'dashboard';
  });
  const [currentSubPage, setCurrentSubPage] = useState<SubPageId>('dashboard-home');
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
  const eventBufferRef = useRef<RFIDEvent[]>([]);
  const flushTimerRef = useRef<number | null>(null);

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
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
      }
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
            // Buffer events and throttle root state updates to max once per 600ms
            eventBufferRef.current = [...payload.events, ...eventBufferRef.current].slice(0, 50);
            if (!flushTimerRef.current) {
              flushTimerRef.current = window.setTimeout(() => {
                setLiveEvents([...eventBufferRef.current]);
                flushTimerRef.current = null;
              }, 600);
            }
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

  const handleNavigateTab = (tab: NavigationTab, subPageId?: SubPageId, filter?: string) => {
    if (filter) {
      setExceptionsFilter(filter);
    } else {
      setExceptionsFilter(undefined);
    }
    setCurrentTab(tab);
    if (subPageId) {
      setCurrentSubPage(subPageId);
    }
    const targetPath = tab === 'dashboard' ? '/' : `/${tab}`;
    if (window.location.pathname !== targetPath) {
      window.history.pushState({ tab, subPageId }, '', targetPath);
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
        currentSubPage={currentSubPage}
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
              onClick={() => handleNavigateTab('monitoring', 'monitoring-readers')}
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
              onNavigateTab={(tab, filter) => handleNavigateTab(tab, undefined, filter)}
              onSelectDiscrepancy={(id) => handleNavigateTab('exceptions', 'exceptions-discrepancies')}
              onOpenSettings={handleOpenSettings}
            />
          )}

          {currentTab === 'inventory' && (
            <InventoryTab
              subPage={currentSubPage}
              onNavigateSubPage={(subId) => handleNavigateTab('inventory', subId as SubPageId)}
            />
          )}

          {currentTab === 'monitoring' && (
            <LiveMonitoringTab
              readers={readers}
              antennas={antennas}
              liveEvents={liveEvents}
              isLiveConnected={isLiveConnected}
              onRefreshData={loadSummary}
              subPage={currentSubPage}
              onNavigateSubPage={(subId) => handleNavigateTab('monitoring', subId as SubPageId)}
            />
          )}

          {currentTab === 'exceptions' && (
            <AIExceptionsTab
              initialFilter={exceptionsFilter}
              shelves={shelves}
              onRefreshData={loadSummary}
              subPage={currentSubPage}
              onNavigateSubPage={(subId) => handleNavigateTab('exceptions', subId as SubPageId)}
            />
          )}

          {currentTab === 'reports' && (
            <ReportsTab
              subPage={currentSubPage}
              onNavigateSubPage={(subId) => handleNavigateTab('reports', subId as SubPageId)}
            />
          )}

          {currentTab === 'users' && (
            <UserRolesView />
          )}

          {currentTab === 'help' && (
            <HelpDocsView />
          )}

          {currentTab === 'settings' && (
            <div className="bg-white border border-slate-200/90 rounded-2xl p-8 shadow-xs space-y-4 max-w-2xl mx-auto text-center">
              <h2 className="text-lg font-bold text-slate-900">S1. System Settings & Hardware Parameters</h2>
              <p className="text-xs text-slate-500">
                Configure global facility parameters, WMS API hosts, model thresholds, and physical reader addresses.
              </p>
              <button
                onClick={handleOpenSettings}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs transition"
              >
                Launch Settings Configuration Modal
              </button>
            </div>
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

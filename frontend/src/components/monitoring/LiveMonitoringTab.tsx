import React, { useState, useEffect } from 'react';
import {
  Radio,
  Server,
  Activity,
  Smartphone,
  Sliders,
  Terminal,
  Bell
} from 'lucide-react';
import { ReaderItem, AntennaItem, RFIDEvent, ShelfItem } from '../../types';
import { api } from '../../services/api';
import { ReaderStatusView } from './ReaderStatusView';
import { AntennaStatusView } from './AntennaStatusView';
import { LiveTagsView } from './LiveTagsView';
import { HandheldScansView } from './HandheldScansView';
import { EventStreamRawView } from './EventStreamRawView';
import { AlertsManagementView } from './AlertsManagementView';
import { AssignAntennaModal } from './AssignAntennaModal';

interface LiveMonitoringTabProps {
  readers: ReaderItem[];
  antennas: AntennaItem[];
  liveEvents: RFIDEvent[];
  isLiveConnected: boolean;
  onRefreshData: () => void;
  onDeleteAntenna?: (antennaId: number) => void;
  subPage?: string;
  onNavigateSubPage?: (subPageId: string) => void;
}

export const LiveMonitoringTab: React.FC<LiveMonitoringTabProps> = ({
  readers,
  antennas,
  liveEvents,
  isLiveConnected,
  onRefreshData,
  onDeleteAntenna,
  subPage,
  onNavigateSubPage
}) => {
  const [shelves, setShelves] = useState<ShelfItem[]>([]);
  const [activeSubView, setActiveSubView] = useState<'readers' | 'antennas' | 'tags' | 'handheld' | 'stream' | 'alerts'>('readers');

  // Antenna Modal
  const [showAssignAntennaModal, setShowAssignAntennaModal] = useState(false);
  const [selectedPortForAntenna, setSelectedPortForAntenna] = useState(1);

  useEffect(() => {
    api.getShelves().then(setShelves).catch(console.error);
  }, []);

  useEffect(() => {
    if (subPage === 'monitoring-readers') setActiveSubView('readers');
    else if (subPage === 'monitoring-antennas') setActiveSubView('antennas');
    else if (subPage === 'monitoring-tags' || subPage === 'monitoring-reads') setActiveSubView('tags');
    else if (subPage === 'monitoring-handheld') setActiveSubView('handheld');
    else if (subPage === 'monitoring-stream') setActiveSubView('stream');
    else if (subPage === 'monitoring-alerts') setActiveSubView('alerts');
  }, [subPage]);

  const handleSubNav = (view: 'readers' | 'antennas' | 'tags' | 'handheld' | 'stream' | 'alerts', id: string) => {
    setActiveSubView(view);
    onNavigateSubPage?.(id);
  };

  return (
    <div className="space-y-6">
      
      {/* 6-View Dedicated Subnavigation Tabs */}
      <div className="bg-white border border-slate-200/90 p-3 rounded-2xl shadow-xs flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => handleSubNav('readers', 'monitoring-readers')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeSubView === 'readers'
                ? 'bg-white text-blue-900 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Server className="w-3.5 h-3.5 text-blue-600" />
            <span>Readers</span>
          </button>

          <button
            onClick={() => handleSubNav('antennas', 'monitoring-antennas')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeSubView === 'antennas'
                ? 'bg-white text-emerald-900 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Radio className="w-3.5 h-3.5 text-emerald-600" />
            <span>Antennas</span>
          </button>

          <button
            onClick={() => handleSubNav('tags', 'monitoring-tags')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeSubView === 'tags'
                ? 'bg-white text-indigo-900 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Activity className="w-3.5 h-3.5 text-indigo-600" />
            <span>Tags</span>
          </button>

          <button
            onClick={() => handleSubNav('handheld', 'monitoring-handheld')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeSubView === 'handheld'
                ? 'bg-white text-purple-900 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5 text-purple-600" />
            <span>Handheld Scans</span>
          </button>

          <button
            onClick={() => handleSubNav('stream', 'monitoring-stream')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeSubView === 'stream'
                ? 'bg-white text-slate-900 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Terminal className="w-3.5 h-3.5 text-slate-700" />
            <span>Event Stream (Raw)</span>
          </button>

          <button
            onClick={() => handleSubNav('alerts', 'monitoring-alerts')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeSubView === 'alerts'
                ? 'bg-white text-rose-900 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Bell className="w-3.5 h-3.5 text-rose-600" />
            <span>Alerts & Faults</span>
          </button>
        </div>

        <div className="flex items-center space-x-2 text-xs text-slate-500 font-mono">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
          <span>Aperture 2-Port UHF Gateway Active</span>
        </div>
      </div>

      {/* Render Active Sub-Page */}
      {activeSubView === 'readers' && (
        <ReaderStatusView
          readers={readers}
          onRefresh={onRefreshData}
        />
      )}

      {activeSubView === 'antennas' && (
        <AntennaStatusView
          antennas={antennas}
          shelves={shelves}
          liveEvents={liveEvents}
          onConfigureAntenna={(port) => {
            setSelectedPortForAntenna(port);
            setShowAssignAntennaModal(true);
          }}
          onDeleteAntenna={onDeleteAntenna}
          onRefresh={onRefreshData}
        />
      )}

      {activeSubView === 'tags' && (
        <LiveTagsView
          liveEvents={liveEvents}
          isLiveConnected={isLiveConnected}
          onRefresh={onRefreshData}
        />
      )}

      {activeSubView === 'handheld' && (
        <HandheldScansView
          shelves={shelves}
          onRefresh={onRefreshData}
        />
      )}

      {activeSubView === 'stream' && (
        <EventStreamRawView
          liveEvents={liveEvents}
          isLiveConnected={isLiveConnected}
        />
      )}

      {activeSubView === 'alerts' && (
        <AlertsManagementView />
      )}

      {/* Assign Antenna Modal */}
      <AssignAntennaModal
        isOpen={showAssignAntennaModal}
        onClose={() => setShowAssignAntennaModal(false)}
        onSuccess={() => {
          onRefreshData();
          api.getShelves().then(setShelves).catch(console.error);
        }}
        shelves={shelves}
        readers={readers}
        initialPort={selectedPortForAntenna}
      />

    </div>
  );
};

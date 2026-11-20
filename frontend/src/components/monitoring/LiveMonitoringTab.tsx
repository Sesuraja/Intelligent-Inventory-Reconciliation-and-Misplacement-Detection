import React, { useState, useEffect } from 'react';
import {
  Radio,
  Server,
  Activity,
  Smartphone,
  Sliders,
  Terminal
} from 'lucide-react';
import { ReaderItem, AntennaItem, RFIDEvent, ShelfItem } from '../../types';
import { api } from '../../services/api';
import { ReaderAntennaStatusView } from './ReaderAntennaStatusView';
import { LiveRFIDReadsView } from './LiveRFIDReadsView';
import { HandheldScansView } from './HandheldScansView';
import { CalibrationHealthView } from './CalibrationHealthView';
import { EventStreamRawView } from './EventStreamRawView';
import { AssignAntennaModal } from './AssignAntennaModal';

interface LiveMonitoringTabProps {
  readers: ReaderItem[];
  antennas: AntennaItem[];
  liveEvents: RFIDEvent[];
  isLiveConnected: boolean;
  onRefreshData: () => void;
  subPage?: string;
  onNavigateSubPage?: (subPageId: string) => void;
}

export const LiveMonitoringTab: React.FC<LiveMonitoringTabProps> = ({
  readers,
  antennas,
  liveEvents,
  isLiveConnected,
  onRefreshData,
  subPage,
  onNavigateSubPage
}) => {
  const [shelves, setShelves] = useState<ShelfItem[]>([]);
  const [activeSubView, setActiveSubView] = useState<'readers' | 'reads' | 'handheld' | 'calibration' | 'stream'>('readers');

  // Antenna Modal
  const [showAssignAntennaModal, setShowAssignAntennaModal] = useState(false);
  const [selectedPortForAntenna, setSelectedPortForAntenna] = useState(1);

  useEffect(() => {
    api.getShelves().then(setShelves).catch(console.error);
  }, []);

  useEffect(() => {
    if (subPage === 'monitoring-reads') setActiveSubView('reads');
    else if (subPage === 'monitoring-handheld') setActiveSubView('handheld');
    else if (subPage === 'monitoring-calibration') setActiveSubView('calibration');
    else if (subPage === 'monitoring-stream') setActiveSubView('stream');
    else if (subPage === 'monitoring-readers') setActiveSubView('readers');
  }, [subPage]);

  const handleSubNav = (view: 'readers' | 'reads' | 'handheld' | 'calibration' | 'stream', id: string) => {
    setActiveSubView(view);
    onNavigateSubPage?.(id);
  };

  return (
    <div className="space-y-6">
      
      {/* 5-Page Subnavigation Tabs */}
      <div className="bg-white border border-slate-200/90 p-3 rounded-2xl shadow-xs flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => handleSubNav('readers', 'monitoring-readers')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeSubView === 'readers'
                ? 'bg-white text-slate-900 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Server className="w-3.5 h-3.5 text-blue-600" />
            <span>3.1 Reader & Antenna Status</span>
          </button>

          <button
            onClick={() => handleSubNav('reads', 'monitoring-reads')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeSubView === 'reads'
                ? 'bg-white text-emerald-900 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Activity className="w-3.5 h-3.5 text-emerald-600" />
            <span>3.2 Live RFID Reads</span>
          </button>

          <button
            onClick={() => handleSubNav('handheld', 'monitoring-handheld')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeSubView === 'handheld'
                ? 'bg-white text-indigo-900 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5 text-indigo-600" />
            <span>3.3 Handheld Scans</span>
          </button>

          <button
            onClick={() => handleSubNav('calibration', 'monitoring-calibration')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeSubView === 'calibration'
                ? 'bg-white text-purple-900 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sliders className="w-3.5 h-3.5 text-purple-600" />
            <span>3.4 Calibration & Health</span>
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
            <span>3.5 Event Stream (Raw Data)</span>
          </button>
        </div>

        <div className="flex items-center space-x-2 text-xs text-slate-500 font-mono">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
          <span>LLRP Speedway 4-Port Portal Active</span>
        </div>
      </div>

      {/* Render Active Sub-Page */}
      {activeSubView === 'readers' && (
        <ReaderAntennaStatusView
          readers={readers}
          antennas={antennas}
          shelves={shelves}
          onConfigureAntenna={(port) => {
            setSelectedPortForAntenna(port);
            setShowAssignAntennaModal(true);
          }}
          onRefresh={onRefreshData}
        />
      )}

      {activeSubView === 'reads' && (
        <LiveRFIDReadsView
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

      {activeSubView === 'calibration' && (
        <CalibrationHealthView
          antennas={antennas}
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

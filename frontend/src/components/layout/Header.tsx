import React from 'react';
import {
  Menu,
  Search,
  Sliders,
  Radio,
  Zap,
  Bell,
  RefreshCw,
  CheckCircle2,
  Building2,
  UserCheck
} from 'lucide-react';
import { NavigationTab } from '../../types';
import { useAppSettings } from '../../context/SettingsContext';

interface HeaderProps {
  currentTab: NavigationTab;
  onOpenMobileMenu: () => void;
  onOpenSettings: () => void;
  isLiveConnected: boolean;
  readerOnline: boolean;
  accuracyPercentage?: number;
  onRefresh?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onOpenMobileMenu,
  onOpenSettings,
  isLiveConnected,
  readerOnline,
  accuracyPercentage,
  onRefresh
}) => {
  const { settings } = useAppSettings();

  const getTabTitle = () => {
    switch (currentTab) {
      case 'dashboard':
        return { title: 'Warehouse Intelligence Dashboard', desc: 'Real-time UHF RFID reconciliation, inventory accuracy and anomaly alerts' };
      case 'inventory':
        return { title: 'Inventory & WMS Master Records', desc: 'Tracked products, serialized EPC tags, shelf mappings and authorized movements' };
      case 'monitoring':
        return { title: 'Live RFID Hardware Monitoring', desc: '4-Port antenna sweeps, raw telemetry observations, RSSI meters and physics simulator' };
      case 'exceptions':
        return { title: 'AI Discrepancy & Root-Cause Exceptions', desc: 'Automated misplacement detection, empirical evidence analysis and operator ground-truth audit' };
      case 'reports':
        return { title: 'Inventory Audits, Demand & Cycle Counting', desc: 'Full reconciliation logs, accuracy trends, P1 demand forecasting and risk prioritizer' };
      default:
        return { title: 'Warehouse Operations', desc: 'Intelligent Inventory Reconciliation' };
    }
  };

  const { title, desc } = getTabTitle();

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200/90 shadow-xs">
      <div className="px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between gap-4">
        
        {/* Left: Mobile Menu Toggle & Title */}
        <div className="flex items-center space-x-3">
          <button
            onClick={onOpenMobileMenu}
            className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 lg:hidden"
            title="Open Menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          
          <div>
            <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight leading-tight">
              {title}
            </h1>
            <p className="text-xs text-slate-500 hidden sm:block mt-0.5">{desc}</p>
          </div>
        </div>

        {/* Right: Telemetry Badges & Quick Action Controls */}
        <div className="flex items-center space-x-3">
          
          {/* Live WebSocket Status Pill */}
          <div className="hidden md:flex items-center space-x-2 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200 text-xs">
            <span className={`w-2 h-2 rounded-full ${isLiveConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
            <span className="font-semibold text-slate-700 font-mono text-[11px]">
              {isLiveConnected ? 'LIVE TELEMETRY' : 'CONNECTING'}
            </span>
          </div>

          {/* Accuracy Score Indicator */}
          {accuracyPercentage !== undefined && (
            <div className="hidden xl:flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Accuracy: <strong className="font-mono text-emerald-700">{accuracyPercentage}%</strong></span>
            </div>
          )}

          {/* Quick Refresh Button */}
          {onRefresh && (
            <button
              onClick={onRefresh}
              title="Refresh Data"
              className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}

          {/* Dynamic Facility & Active User Badge */}
          <div
            onClick={onOpenSettings}
            className="hidden lg:flex items-center space-x-2 px-3 py-1.5 rounded-full bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs cursor-pointer transition"
            title="Active Facility & Operator Profile"
          >
            <Building2 className="w-3.5 h-3.5 text-blue-600" />
            <span className="font-semibold text-slate-700">{settings.facilityCode || 'FACILITY'}</span>
            <span className="text-slate-300">•</span>
            <span className="text-slate-600">{settings.currentUser.name}</span>
          </div>

          {/* Settings Trigger */}
          <button
            onClick={onOpenSettings}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Settings</span>
          </button>

        </div>

      </div>
    </header>
  );
};


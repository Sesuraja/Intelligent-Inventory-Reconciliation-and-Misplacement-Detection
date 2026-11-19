import React from 'react';
import {
  LayoutDashboard,
  Boxes,
  Radio,
  AlertTriangle,
  BarChart3,
  Settings,
  Cpu,
  User,
  Activity
} from 'lucide-react';
import { NavigationTab } from '../../types';

interface NavbarProps {
  currentTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
  openExceptionsCount: number;
  onOpenSettings: () => void;
  isLiveConnected: boolean;
  readerOnline: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
  openExceptionsCount,
  onOpenSettings,
  isLiveConnected,
  readerOnline
}) => {
  const navItems = [
    { id: 'dashboard' as NavigationTab, label: '1. Dashboard', icon: LayoutDashboard },
    { id: 'inventory' as NavigationTab, label: '2. Inventory', icon: Boxes },
    { id: 'monitoring' as NavigationTab, label: '3. Live Monitoring', icon: Radio },
    { id: 'exceptions' as NavigationTab, label: '4. AI Exceptions', icon: AlertTriangle, badge: openExceptionsCount },
    { id: 'reports' as NavigationTab, label: '5. Reports', icon: BarChart3 },
  ];

  return (
    <header className="sticky top-0 z-50 bg-slate-900/95 backdrop-blur border-b border-slate-800 shadow-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => onSelectTab('dashboard')}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-400 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Cpu className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-lg text-white tracking-tight">Inventory Intelligence</span>
                <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
                  UHF AIoT
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium">Reconciliation & Misplacement Detection</p>
            </div>
          </div>

          {/* 5 Primary Navigation Tabs */}
          <nav className="flex space-x-1 lg:space-x-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectTab(item.id)}
                  className={`relative flex items-center space-x-2 px-3.5 py-2 rounded-lg text-sm font-semibold transition-all duration-150 ${
                    isActive
                      ? 'bg-blue-600/20 text-blue-400 border border-blue-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-blue-400' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="ml-1.5 px-1.5 py-0.2 rounded-full text-[11px] font-bold bg-amber-500 text-slate-950 animate-pulse">
                      {item.badge}
                    </span>
                  )}
                  {isActive && (
                    <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-blue-500 rounded-full" />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Right Status & Profile Controls */}
          <div className="flex items-center space-x-3">
            {/* Live Telemetry Pill */}
            <div className="hidden md:flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-slate-800/80 border border-slate-700/60 text-xs">
              <span className={`w-2 h-2 rounded-full ${isLiveConnected ? 'bg-emerald-400 animate-ping' : 'bg-rose-500'}`} />
              <span className="text-slate-300 font-mono">
                {readerOnline ? 'READER ONLINE' : 'READER OUTAGE'}
              </span>
            </div>

            {/* Settings Modal Button */}
            <button
              onClick={onOpenSettings}
              title="System Settings & Hardware Config"
              className="p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition"
            >
              <Settings className="w-5 h-5" />
            </button>

            {/* User Profile Badge */}
            <div
              onClick={onOpenSettings}
              className="flex items-center space-x-2 pl-2 border-l border-slate-800 cursor-pointer hover:opacity-90"
            >
              <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-blue-400 text-xs font-bold">
                SJ
              </div>
              <div className="hidden xl:block text-left">
                <p className="text-xs font-semibold text-slate-200 leading-none">Sarah Jenkins</p>
                <p className="text-[10px] text-slate-500 uppercase mt-0.5">Admin</p>
              </div>
            </div>

          </div>

        </div>
      </div>
    </header>
  );
};


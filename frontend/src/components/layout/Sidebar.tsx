import React, { useState } from 'react';
import {
  LayoutDashboard,
  Boxes,
  Radio,
  AlertTriangle,
  BarChart3,
  Settings,
  Cpu,
  ChevronDown,
  ChevronRight,
  Shield,
  Check,
  CheckCircle2,
  Users,
  BookOpen,
  Server,
  Layers
} from 'lucide-react';
import { NavigationTab, SubPageId } from '../../types';
import { useAppSettings } from '../../context/SettingsContext';

interface SidebarProps {
  currentTab: NavigationTab;
  currentSubPage?: SubPageId;
  onSelectTab: (tab: NavigationTab, subPageId?: SubPageId) => void;
  openExceptionsCount: number;
  readerOnline?: boolean;
  onOpenSettings: () => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  currentSubPage,
  onSelectTab,
  openExceptionsCount,
  onOpenSettings,
  isMobileOpen = false,
  onCloseMobile
}) => {
  const { settings } = useAppSettings();

  // Collapsible state for each section - default open for active section
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    dashboard: true,
    inventory: true,
    monitoring: true,
    exceptions: true,
    reports: true
  });

  const toggleSection = (sectionKey: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedSections((prev) => ({
      ...prev,
      [sectionKey]: !prev[sectionKey]
    }));
  };

  const navSections = [
    {
      id: 'dashboard' as NavigationTab,
      label: '1. Dashboard',
      pageCount: '1 Page',
      icon: LayoutDashboard,
      color: 'text-blue-400',
      subPages: [
        { id: 'dashboard-home' as SubPageId, label: '1.1 Dashboard (Home)' }
      ]
    },
    {
      id: 'inventory' as NavigationTab,
      label: '2. Inventory',
      pageCount: '5 Pages',
      icon: Boxes,
      color: 'text-purple-400',
      subPages: [
        { id: 'inventory-products' as SubPageId, label: '2.1 Products & SKUs' },
        { id: 'inventory-tags' as SubPageId, label: '2.2 EPC / Tags' },
        { id: 'inventory-layout' as SubPageId, label: '2.3 Warehouse Layout' },
        { id: 'inventory-wms' as SubPageId, label: '2.4 WMS & Sync' },
        { id: 'inventory-history' as SubPageId, label: '2.5 Inventory History' }
      ]
    },
    {
      id: 'monitoring' as NavigationTab,
      label: '3. Live Monitoring',
      pageCount: '5 Pages',
      icon: Radio,
      color: 'text-emerald-400',
      subPages: [
        { id: 'monitoring-readers' as SubPageId, label: '3.1 Reader & Antenna Status' },
        { id: 'monitoring-reads' as SubPageId, label: '3.2 Live RFID Reads' },
        { id: 'monitoring-handheld' as SubPageId, label: '3.3 Handheld Scans' },
        { id: 'monitoring-calibration' as SubPageId, label: '3.4 Calibration & Health' },
        { id: 'monitoring-stream' as SubPageId, label: '3.5 Event Stream (Raw Data)' }
      ]
    },
    {
      id: 'exceptions' as NavigationTab,
      label: '4. AI Exceptions',
      pageCount: '5 Pages',
      icon: AlertTriangle,
      color: 'text-amber-400',
      badge: openExceptionsCount,
      subPages: [
        { id: 'exceptions-discrepancies' as SubPageId, label: '4.1 Discrepancies' },
        { id: 'exceptions-root-cause' as SubPageId, label: '4.2 Root Cause Analysis' },
        { id: 'exceptions-actions' as SubPageId, label: '4.3 Verification & Actions' },
        { id: 'exceptions-ground-truth' as SubPageId, label: '4.4 Session & Ground Truth' },
        { id: 'exceptions-insights' as SubPageId, label: '4.5 AI Model Insights' }
      ]
    },
    {
      id: 'reports' as NavigationTab,
      label: '5. Reports',
      pageCount: '5 Pages',
      icon: BarChart3,
      color: 'text-sky-400',
      subPages: [
        { id: 'reports-reconciliation' as SubPageId, label: '5.1 Inventory Reconciliation' },
        { id: 'reports-performance' as SubPageId, label: '5.2 Model Performance' },
        { id: 'reports-reader' as SubPageId, label: '5.3 Reader Performance' },
        { id: 'reports-forecast' as SubPageId, label: '5.4 Cycle Count & Forecast' },
        { id: 'reports-exports' as SubPageId, label: '5.5 Exports' }
      ]
    }
  ];

  const handleNavClick = (tab: NavigationTab, subPageId?: SubPageId) => {
    onSelectTab(tab, subPageId);
    if (onCloseMobile) onCloseMobile();
  };

  const userRolesList = [
    'Admin (Full Access)',
    'Warehouse Supervisor',
    'Operator',
    'Analyst / Data Scientist',
    'Viewer (Read Only)'
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-xs lg:hidden"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-[#0B132B] border-r border-slate-800/80 flex flex-col justify-between transition-transform duration-300 ease-in-out lg:translate-x-0 text-slate-300 ${
          isMobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Scrollable Navigation Tree */}
        <div className="flex flex-col flex-1 overflow-y-auto sidebar-scroll">

          {/* Brand Header */}
          <div className="p-4 border-b border-slate-800/80">
            <div
              className="flex items-center space-x-3 cursor-pointer"
              onClick={() => handleNavClick('dashboard', 'dashboard-home')}
            >
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/20 flex-shrink-0">
                <Radio className="w-5 h-5 text-white" />
              </div>
              <div className="overflow-hidden">
                <div className="flex items-center space-x-1.5">
                  <span className="font-bold text-white text-base tracking-tight truncate">Inventory AIoT</span>
                </div>
                <p className="text-[10px] text-blue-400 font-medium truncate">UHF RFID • AI • Reconciliation</p>
              </div>
            </div>
          </div>

          {/* Section Header */}
          <div className="px-4 pt-3 pb-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
              Application Navigation
            </span>
          </div>

          {/* 5 Collapsible Main Navigation Sections */}
          <div className="px-2.5 py-1 space-y-1">
            {navSections.map((sec) => {
              const Icon = sec.icon;
              const isTabActive = currentTab === sec.id;
              const isExpanded = expandedSections[sec.id] ?? true;

              return (
                <div key={sec.id} className="space-y-0.5">
                  {/* Main Section Header */}
                  <div
                    onClick={() => handleNavClick(sec.id, sec.subPages[0].id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer transition ${
                      isTabActive
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="flex items-center space-x-2.5 min-w-0">
                      <Icon className={`w-4 h-4 flex-shrink-0 ${isTabActive ? 'text-white' : sec.color}`} />
                      <span className="truncate">{sec.label}</span>
                    </div>

                    <div className="flex items-center space-x-1.5 flex-shrink-0">
                      {sec.badge !== undefined && sec.badge > 0 && (
                        <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-amber-500 text-slate-950">
                          {sec.badge}
                        </span>
                      )}
                      <button
                        onClick={(e) => toggleSection(sec.id, e)}
                        className="p-0.5 text-slate-400 hover:text-white"
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Subpages Tree */}
                  {isExpanded && (
                    <div className="pl-6 pr-1 py-0.5 space-y-0.5">
                      {sec.subPages.map((sub) => {
                        const isSubActive = currentSubPage === sub.id;
                        return (
                          <button
                            key={sub.id}
                            onClick={() => handleNavClick(sec.id, sub.id)}
                            className={`w-full text-left px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition block truncate ${
                              isSubActive
                                ? 'bg-blue-500/20 text-blue-300 font-bold border-l-2 border-blue-400 pl-2'
                                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                            }`}
                          >
                            {sub.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Pages Overview Widget (Exact 24-page Donut) */}
          <div className="mx-3 my-3 p-3.5 bg-slate-900/90 rounded-2xl border border-slate-800/90 space-y-3">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Pages Overview
            </span>

            <div className="flex items-center space-x-3">
              {/* Circular Indicator */}
              <div className="relative w-14 h-14 flex items-center justify-center flex-shrink-0">
                <svg viewBox="0 0 36 36" className="w-14 h-14 -rotate-90">
                  <path
                    className="text-slate-800"
                    strokeWidth="3.5"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  {/* Dashboard (1/24 = 4.1%) */}
                  <path
                    className="text-blue-500"
                    strokeDasharray="4.1, 100"
                    strokeWidth="3.5"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  {/* Inventory (5/24 = 20.8%) */}
                  <path
                    className="text-purple-500"
                    strokeDasharray="20.8, 100"
                    strokeDashoffset="-4.1"
                    strokeWidth="3.5"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  {/* Monitoring (5/24 = 20.8%) */}
                  <path
                    className="text-emerald-500"
                    strokeDasharray="20.8, 100"
                    strokeDashoffset="-24.9"
                    strokeWidth="3.5"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  {/* Exceptions (5/24 = 20.8%) */}
                  <path
                    className="text-amber-500"
                    strokeDasharray="20.8, 100"
                    strokeDashoffset="-45.7"
                    strokeWidth="3.5"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  {/* Reports (5/24 = 20.8%) */}
                  <path
                    className="text-sky-400"
                    strokeDasharray="20.8, 100"
                    strokeDashoffset="-66.5"
                    strokeWidth="3.5"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <div className="absolute text-center">
                  <span className="text-xs font-bold text-white block leading-none font-mono">24</span>
                  <span className="text-[8px] text-slate-400 uppercase">Pages</span>
                </div>
              </div>

              {/* Legend */}
              <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[10px] text-slate-400 flex-1">
                <div className="flex items-center space-x-1">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  <span>Dashboard: <strong>1</strong></span>
                </div>
                <div className="flex items-center space-x-1">
                  <span className="w-2 h-2 rounded-full bg-purple-500" />
                  <span>Inventory: <strong>5</strong></span>
                </div>
                <div className="flex items-center space-x-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span>Monitoring: <strong>5</strong></span>
                </div>
                <div className="flex items-center space-x-1">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <span>Exceptions: <strong>5</strong></span>
                </div>
                <div className="flex items-center space-x-1">
                  <span className="w-2 h-2 rounded-full bg-sky-400" />
                  <span>Reports: <strong>5</strong></span>
                </div>
                <div className="flex items-center space-x-1">
                  <span className="w-2 h-2 rounded-full bg-slate-500" />
                  <span>Supporting: <strong>3</strong></span>
                </div>
              </div>
            </div>
          </div>

          {/* User Roles Widget (Checklist Style) */}
          <div className="mx-3 mb-3 p-3.5 bg-slate-900/90 rounded-2xl border border-slate-800/90 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                User Roles
              </span>
              <button
                onClick={() => handleNavClick('users', 'supporting-users')}
                className="text-[10px] text-blue-400 hover:underline"
              >
                RBAC
              </button>
            </div>

            <div className="space-y-1.5 text-[11px]">
              {userRolesList.map((role) => {
                const isSelected = settings.currentUser.role.toLowerCase().includes(role.split(' ')[0].toLowerCase());
                return (
                  <div key={role} className="flex items-center space-x-2 text-slate-300">
                    <Check className={`w-3.5 h-3.5 ${isSelected ? 'text-blue-400 font-bold' : 'text-emerald-500'}`} />
                    <span className={isSelected ? 'text-white font-semibold' : 'text-slate-400'}>{role}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Supporting Pages Links (S1, S2, S3) */}
          <div className="px-3 pb-3 space-y-1">
            <span className="px-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
              Supporting Pages (3)
            </span>

            <button
              onClick={onOpenSettings}
              className={`w-full flex items-center space-x-2.5 px-3 py-1.5 rounded-xl text-xs font-medium transition ${
                currentTab === 'settings'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Settings className="w-3.5 h-3.5 text-slate-400" />
              <span>S1. Settings</span>
            </button>

            <button
              onClick={() => handleNavClick('users', 'supporting-users')}
              className={`w-full flex items-center space-x-2.5 px-3 py-1.5 rounded-xl text-xs font-medium transition ${
                currentTab === 'users'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Users className="w-3.5 h-3.5 text-blue-400" />
              <span>S2. User & Roles</span>
            </button>

            <button
              onClick={() => handleNavClick('help', 'supporting-help')}
              className={`w-full flex items-center space-x-2.5 px-3 py-1.5 rounded-xl text-xs font-medium transition ${
                currentTab === 'help'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
              <span>S3. Help & Documentation</span>
            </button>
          </div>

        </div>

        {/* Bottom Current User Section */}
        <div className="p-3 border-t border-slate-800/80 bg-slate-950/70">
          <div
            className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-800/60 transition cursor-pointer"
            onClick={onOpenSettings}
          >
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-full bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400 text-xs font-bold font-mono">
                {settings.currentUser.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="text-left overflow-hidden">
                <p className="text-xs font-semibold text-white truncate leading-tight">{settings.currentUser.name}</p>
                <p className="text-[10px] text-slate-400 truncate">{settings.currentUser.role}</p>
              </div>
            </div>
            <Settings className="w-4 h-4 text-slate-400 hover:text-white" />
          </div>
        </div>

      </aside>
    </>
  );
};

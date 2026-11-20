import React from 'react';
import {
  LayoutDashboard,
  Boxes,
  Radio,
  AlertTriangle,
  BarChart3,
  Settings,
  Users,
  BookOpen
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
  onSelectTab,
  openExceptionsCount,
  onOpenSettings,
  isMobileOpen = false,
  onCloseMobile
}) => {
  const { settings } = useAppSettings();

  const navItems = [
    {
      id: 'dashboard' as NavigationTab,
      label: 'Dashboard',
      icon: LayoutDashboard,
      color: 'text-blue-400'
    },
    {
      id: 'inventory' as NavigationTab,
      label: 'Inventory',
      icon: Boxes,
      color: 'text-purple-400'
    },
    {
      id: 'monitoring' as NavigationTab,
      label: 'Live Monitoring',
      icon: Radio,
      color: 'text-emerald-400'
    },
    {
      id: 'exceptions' as NavigationTab,
      label: 'AI Exceptions',
      icon: AlertTriangle,
      color: 'text-amber-400',
      badge: openExceptionsCount
    },
    {
      id: 'reports' as NavigationTab,
      label: 'Reports',
      icon: BarChart3,
      color: 'text-sky-400'
    }
  ];

  const handleNavClick = (tab: NavigationTab) => {
    onSelectTab(tab);
    if (onCloseMobile) onCloseMobile();
  };

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
              onClick={() => handleNavClick('dashboard')}
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

          {/* Main Navigation Section */}
          <div className="px-4 pt-4 pb-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
              Application Navigation
            </span>
          </div>

          {/* Primary Navigation Menu */}
          <nav className="px-2.5 py-1 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isTabActive = currentTab === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition ${
                    isTabActive
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center space-x-3 min-w-0">
                    <Icon className={`w-4 h-4 flex-shrink-0 ${isTabActive ? 'text-white' : item.color}`} />
                    <span className="truncate">{item.label}</span>
                  </div>

                  {item.badge !== undefined && item.badge > 0 && (
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      isTabActive
                        ? 'bg-white text-blue-900 font-black'
                        : 'bg-amber-500 text-slate-950'
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Supporting Pages Links */}
          <div className="px-3 pt-6 pb-3 space-y-1 mt-auto">
            <span className="px-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">
              Supporting Pages
            </span>

            <button
              onClick={() => {
                onOpenSettings();
                if (onCloseMobile) onCloseMobile();
              }}
              className={`w-full flex items-center space-x-3 px-3 py-2 rounded-xl text-xs font-medium transition ${
                currentTab === 'settings'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Settings className="w-4 h-4 text-slate-400" />
              <span>Settings</span>
            </button>

            <button
              onClick={() => handleNavClick('users')}
              className={`w-full flex items-center space-x-3 px-3 py-2 rounded-xl text-xs font-medium transition ${
                currentTab === 'users'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Users className="w-4 h-4 text-blue-400" />
              <span>User & Roles</span>
            </button>

            <button
              onClick={() => handleNavClick('help')}
              className={`w-full flex items-center space-x-3 px-3 py-2 rounded-xl text-xs font-medium transition ${
                currentTab === 'help'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <BookOpen className="w-4 h-4 text-emerald-400" />
              <span>Help & Documentation</span>
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

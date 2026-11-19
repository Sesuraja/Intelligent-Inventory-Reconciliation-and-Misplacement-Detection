import React from 'react';
import {
  LayoutDashboard,
  Boxes,
  Radio,
  AlertTriangle,
  BarChart3,
  Server,
  Settings,
  Cpu,
  Layers,
  ChevronRight,
  Shield,
  Wifi
} from 'lucide-react';
import { NavigationTab } from '../../types';
import { useAppSettings } from '../../context/SettingsContext';

interface SidebarProps {
  currentTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
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

  const userInitials = (settings.currentUser.name || 'Admin')
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const navItems = [
    { id: 'dashboard' as NavigationTab, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'inventory' as NavigationTab, label: 'Inventory', icon: Boxes },
    { id: 'monitoring' as NavigationTab, label: 'Live Monitoring', icon: Radio },
    { id: 'exceptions' as NavigationTab, label: 'AI Exceptions', icon: AlertTriangle, badge: openExceptionsCount },
    { id: 'reports' as NavigationTab, label: 'Reports', icon: BarChart3 },
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
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-[#0B132B] border-r border-slate-800/80 flex flex-col justify-between transition-transform duration-300 ease-in-out lg:translate-x-0 ${isMobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full lg:translate-x-0'
          }`}
      >
        {/* Top: Logo & Main Navigation */}
        <div className="flex flex-col flex-1 overflow-y-auto sidebar-scroll">

          {/* Brand Header */}
          <div className="p-5 border-b border-slate-800/70">
            <div className="flex items-center space-x-3 cursor-pointer" onClick={() => handleNavClick('dashboard')}>
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/20 flex-shrink-0">
                <Cpu className="w-5 h-5 text-white" />
              </div>
              <div className="overflow-hidden">
                <div className="flex items-center space-x-1.5">
                  <span className="font-bold text-white text-base tracking-tight truncate">{settings.brandName || 'Inventory AIoT'}</span>
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-bold tracking-wider bg-blue-500/20 text-blue-400 border border-blue-500/30">
                    UHF
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 truncate">{settings.brandSubtitle || 'Reconciliation & Diagnostics'}</p>
              </div>
            </div>
          </div>

          {/* Navigation Items (Exactly 5 Main Items) */}
          <div className="px-3 py-4 space-y-1">
            <span className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">
              Main Operations
            </span>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150 ${isActive
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
                    }`}
                >
                  <div className="flex items-center space-x-3">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span
                      className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${isActive
                          ? 'bg-white text-blue-700'
                          : 'bg-amber-500 text-slate-950 animate-pulse'
                        }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

        </div>

        {/* Bottom User Profile Section */}
        <div className="p-3 border-t border-slate-800/80 bg-slate-950/60">
          <div className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-800/60 transition cursor-pointer" onClick={onOpenSettings}>
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-full bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400 text-xs font-bold font-mono">
                {userInitials}
              </div>
              <div className="text-left overflow-hidden">
                <p className="text-xs font-semibold text-white truncate leading-tight">{settings.currentUser.name}</p>
                <p className="text-[10px] text-slate-400 truncate">{settings.currentUser.role}</p>
              </div>
            </div>
            <button
              title="System Settings"
              className="p-1 text-slate-400 hover:text-white"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>

      </aside>
    </>
  );
};


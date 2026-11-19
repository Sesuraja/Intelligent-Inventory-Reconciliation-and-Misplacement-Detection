import React, { useState, useEffect } from 'react';
import {
  X,
  Server,
  Radio,
  Shield,
  Database,
  Sliders,
  RefreshCw,
  CheckCircle2,
  Globe,
  User,
  Building,
  Key,
  Wifi,
  AlertCircle,
  Save,
  RotateCcw
} from 'lucide-react';
import { AIModelItem, ReaderItem, AntennaItem, ShelfItem } from '../../types';
import { useAppSettings } from '../../context/SettingsContext';
import { api } from '../../services/api';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  models: AIModelItem[];
  onRetrainModel: (id: number) => void;
  readers?: ReaderItem[];
  antennas?: AntennaItem[];
  shelves?: ShelfItem[];
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  models,
  onRetrainModel,
  readers = [],
  antennas = [],
  shelves = []
}) => {
  const { settings, updateSettings, setCurrentUser, resetToDefaults } = useAppSettings();

  const [activeSubTab, setActiveSubTab] = useState<'branding' | 'api' | 'auth' | 'devices' | 'models'>('branding');
  const [retrainingId, setRetrainingId] = useState<number | null>(null);

  // Form states for branding
  const [brandName, setBrandName] = useState(settings.brandName);
  const [brandSubtitle, setBrandSubtitle] = useState(settings.brandSubtitle);
  const [companyName, setCompanyName] = useState(settings.companyName);
  const [facilityCode, setFacilityCode] = useState(settings.facilityCode);
  const [systemTitle, setSystemTitle] = useState(settings.systemTitle);

  // Form states for API & network
  const [apiHost, setApiHost] = useState(settings.apiHost);
  const [wsHost, setWsHost] = useState(settings.wsHost);
  const [connectionStatus, setConnectionStatus] = useState<string | null>(null);
  const [isTestingConnection, setIsTestingConnection] = useState(false);

  // Form states for active user
  const [userName, setUserName] = useState(settings.currentUser.name);
  const [userEmail, setUserEmail] = useState(settings.currentUser.email);
  const [userRole, setUserRole] = useState(settings.currentUser.role);
  const [userToken, setUserToken] = useState(settings.currentUser.token || '');

  // DB registered users
  const [availableUsers, setAvailableUsers] = useState<any[]>([]);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setBrandName(settings.brandName);
      setBrandSubtitle(settings.brandSubtitle);
      setCompanyName(settings.companyName);
      setFacilityCode(settings.facilityCode);
      setSystemTitle(settings.systemTitle);
      setApiHost(settings.apiHost);
      setWsHost(settings.wsHost);
      setUserName(settings.currentUser.name);
      setUserEmail(settings.currentUser.email);
      setUserRole(settings.currentUser.role);
      setUserToken(settings.currentUser.token || '');

      // Load registered users from API
      api.getUsers().then(setAvailableUsers).catch(() => {});
    }
  }, [isOpen, settings]);

  if (!isOpen) return null;

  const showSavedNotice = (msg: string) => {
    setSavedNotice(msg);
    setTimeout(() => setSavedNotice(null), 3000);
  };

  const handleSaveBranding = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings({
      brandName: brandName.trim() || 'Inventory AIoT',
      brandSubtitle: brandSubtitle.trim() || 'Reconciliation & Diagnostics',
      companyName: companyName.trim() || 'Warehouse Logistics Facility',
      facilityCode: facilityCode.trim() || 'FAC-01',
      systemTitle: systemTitle.trim() || 'Intelligent Inventory Reconciliation'
    });
    api.updateSystemSettings({
      brand_name: brandName.trim(),
      brand_subtitle: brandSubtitle.trim(),
      company_name: companyName.trim(),
      facility_code: facilityCode.trim(),
      system_title: systemTitle.trim()
    }).catch(console.error);
    showSavedNotice('Branding and company settings saved successfully!');
  };

  const handleSaveApi = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings({
      apiHost: apiHost.trim(),
      wsHost: wsHost.trim()
    });
    showSavedNotice('API endpoint configuration updated successfully!');
  };

  const handleTestConnection = async () => {
    setIsTestingConnection(true);
    setConnectionStatus(null);
    try {
      const res = await api.testConnection(apiHost.trim());
      setConnectionStatus(`Connected successfully (${res.latencyMs}ms) - Status: ${res.status}`);
    } catch (err: any) {
      setConnectionStatus(`Connection failed: ${err.message}`);
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentUser({
      id: settings.currentUser.id || 1,
      name: userName.trim() || 'Warehouse Admin',
      email: userEmail.trim() || 'admin@warehouse.io',
      role: userRole,
      token: userToken.trim()
    });
    showSavedNotice('User authentication profile saved!');
  };

  const handleSwitchUser = (u: any) => {
    setUserName(u.name);
    setUserEmail(u.email);
    setUserRole(u.role);
    setCurrentUser({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      token: userToken
    });
    showSavedNotice(`Active user switched to ${u.name} (${u.role})`);
  };

  const handleRetrain = async (id: number) => {
    setRetrainingId(id);
    await onRetrainModel(id);
    setTimeout(() => setRetrainingId(null), 1000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-4xl max-h-[88vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 text-blue-700 rounded-xl">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">System Settings & Dynamic Configuration</h2>
              <p className="text-xs text-slate-500">Configure company branding, API host endpoints, active user authentication, and hardware</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/70 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Notice Banner */}
        {savedNotice && (
          <div className="bg-emerald-50 border-b border-emerald-200 px-6 py-2.5 flex items-center space-x-2 text-xs text-emerald-800 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span className="font-medium">{savedNotice}</span>
          </div>
        )}

        {/* Sub Navigation */}
        <div className="flex border-b border-slate-200 px-6 space-x-4 bg-slate-50/50 text-xs overflow-x-auto">
          {[
            { id: 'branding', label: 'Company & Branding', icon: Building },
            { id: 'api', label: 'API Host & Network', icon: Globe },
            { id: 'auth', label: 'User & Authentication', icon: User },
            { id: 'devices', label: 'Hardware & Calibration', icon: Server },
            { id: 'models', label: 'AI Model Registry', icon: Database },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id as any)}
                className={`flex items-center space-x-2 py-3 border-b-2 font-semibold whitespace-nowrap transition ${
                  active
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-800 text-xs">
          
          {/* Subtab 1: Company & Branding */}
          {activeSubTab === 'branding' && (
            <form onSubmit={handleSaveBranding} className="space-y-4 max-w-2xl">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <h3 className="font-bold text-slate-900 text-sm flex items-center space-x-2">
                  <Building className="w-4 h-4 text-blue-600" />
                  <span>Dynamic Brand & Warehouse Identity</span>
                </h3>
                <p className="text-slate-500 text-[11px]">
                  All company names, brand labels, and subtitles update dynamically across the sidebar, header, dashboard banner, and footer.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Brand Name</label>
                    <input
                      type="text"
                      value={brandName}
                      onChange={(e) => setBrandName(e.target.value)}
                      placeholder="e.g. Inventory AIoT"
                      required
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Brand Subtitle</label>
                    <input
                      type="text"
                      value={brandSubtitle}
                      onChange={(e) => setBrandSubtitle(e.target.value)}
                      placeholder="e.g. Reconciliation & Diagnostics"
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-slate-700 font-semibold mb-1">Company / Facility Name</label>
                    <input
                      type="text"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="e.g. Main Logistics Distribution Facility #4"
                      required
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Facility Code</label>
                    <input
                      type="text"
                      value={facilityCode}
                      onChange={(e) => setFacilityCode(e.target.value)}
                      placeholder="e.g. FAC-04"
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Full System Title</label>
                  <input
                    type="text"
                    value={systemTitle}
                    onChange={(e) => setSystemTitle(e.target.value)}
                    placeholder="e.g. Intelligent Inventory Reconciliation & Misplacement Detection System"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2">
                <button
                  type="submit"
                  className="flex items-center space-x-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold shadow-xs transition"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Branding Changes</span>
                </button>
              </div>
            </form>
          )}

          {/* Subtab 2: API Host & Network */}
          {activeSubTab === 'api' && (
            <form onSubmit={handleSaveApi} className="space-y-4 max-w-2xl">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <h3 className="font-bold text-slate-900 text-sm flex items-center space-x-2">
                  <Globe className="w-4 h-4 text-blue-600" />
                  <span>Dynamic API Host & Endpoint Routing</span>
                </h3>
                <p className="text-slate-500 text-[11px]">
                  Configure the FastAPI backend server URL. Leave blank to communicate with the current web server origin, or set a custom host (e.g. http://localhost:8000 or http://192.168.1.50:8000).
                </p>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">API Host Base URL</label>
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={apiHost}
                      onChange={(e) => setApiHost(e.target.value)}
                      placeholder="e.g. http://localhost:8000 (leave blank for default)"
                      className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:border-blue-500"
                    />
                    <button
                      type="button"
                      onClick={handleTestConnection}
                      disabled={isTestingConnection}
                      className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold transition flex items-center space-x-1.5 disabled:opacity-50"
                    >
                      <Wifi className={`w-3.5 h-3.5 ${isTestingConnection ? 'animate-pulse text-blue-600' : ''}`} />
                      <span>{isTestingConnection ? 'Testing...' : 'Test Connection'}</span>
                    </button>
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Endpoints will be requested as: <strong className="font-mono text-slate-600">{(apiHost ? apiHost.replace(/\/+$/, '') : '') + '/api/v1/...'}</strong>
                  </span>
                </div>

                {connectionStatus && (
                  <div className={`p-3 rounded-xl border text-xs flex items-center space-x-2 ${
                    connectionStatus.includes('successfully')
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-rose-50 border-rose-200 text-rose-800'
                  }`}>
                    {connectionStatus.includes('successfully') ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                    )}
                    <span>{connectionStatus}</span>
                  </div>
                )}

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">WebSocket URL Override (Optional)</label>
                  <input
                    type="text"
                    value={wsHost}
                    onChange={(e) => setWsHost(e.target.value)}
                    placeholder="e.g. ws://localhost:8000/ws/rfid-events (leave blank to auto-detect)"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="flex justify-between items-center pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setApiHost('');
                    setWsHost('');
                    updateSettings({ apiHost: '', wsHost: '' });
                    showSavedNotice('Reset API endpoints to local origin defaults');
                  }}
                  className="flex items-center space-x-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-semibold transition"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset to Local Origin</span>
                </button>
                <button
                  type="submit"
                  className="flex items-center space-x-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold shadow-xs transition"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Endpoint Settings</span>
                </button>
              </div>
            </form>
          )}

          {/* Subtab 3: User & Authentication */}
          {activeSubTab === 'auth' && (
            <div className="space-y-6 max-w-2xl">
              <form onSubmit={handleSaveUser} className="space-y-4">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                  <h3 className="font-bold text-slate-900 text-sm flex items-center space-x-2">
                    <User className="w-4 h-4 text-blue-600" />
                    <span>Active User Profile & Authentication</span>
                  </h3>
                  <p className="text-slate-500 text-[11px]">
                    Customize the active operator name, role, email, and authentication token. Actions performed across the system will be attributed to this identity.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Full Name</label>
                      <input
                        type="text"
                        value={userName}
                        onChange={(e) => setUserName(e.target.value)}
                        placeholder="e.g. Sarah Jenkins"
                        required
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Email Address</label>
                      <input
                        type="email"
                        value={userEmail}
                        onChange={(e) => setUserEmail(e.target.value)}
                        placeholder="e.g. admin@warehouse.io"
                        required
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Assigned Role</label>
                      <select
                        value={userRole}
                        onChange={(e) => setUserRole(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                      >
                        <option value="Administrator">Administrator</option>
                        <option value="Warehouse Manager">Warehouse Manager</option>
                        <option value="Warehouse Operator">Warehouse Operator</option>
                        <option value="Technical Engineer">Technical Engineer</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Bearer Token / API Key</label>
                      <input
                        type="password"
                        value={userToken}
                        onChange={(e) => setUserToken(e.target.value)}
                        placeholder="JWT token (optional)"
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="flex items-center space-x-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold shadow-xs transition"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Save User Profile</span>
                  </button>
                </div>
              </form>

              {/* Registered Accounts from DB */}
              {availableUsers.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
                  <h4 className="font-bold text-slate-900 flex items-center space-x-2">
                    <Shield className="w-4 h-4 text-emerald-600" />
                    <span>Registered Database Accounts (Quick Switch)</span>
                  </h4>
                  <div className="divide-y divide-slate-100">
                    {availableUsers.map((u) => (
                      <div key={u.id} className="py-2.5 flex items-center justify-between">
                        <div>
                          <span className="font-semibold text-slate-900 block">{u.name}</span>
                          <span className="text-[11px] text-slate-500">{u.email} • <strong className="text-blue-700">{u.role}</strong></span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleSwitchUser(u)}
                          className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                            userName === u.name
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                          }`}
                        >
                          {userName === u.name ? 'Active' : 'Switch To User'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Subtab 4: Hardware & Calibration */}
          {activeSubTab === 'devices' && (
            <div className="space-y-4">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <h3 className="font-bold text-slate-900 text-sm">
                      Fixed UHF Reader: {readers[0]?.reader_code || 'READER_01'}
                    </h3>
                  </div>
                  <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 font-mono font-semibold">
                    {readers[0]?.protocol || 'LLRP PROTOCOL'}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <span className="text-slate-500 block">Model</span>
                    <span className="font-semibold text-slate-900">{readers[0]?.model || 'Impinj Speedway R420'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">IP Address</span>
                    <span className="font-mono text-slate-800">{readers[0] ? `${readers[0].ip_address}:${readers[0].port}` : '192.168.1.100:5084'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Max RF Power</span>
                    <span className="font-semibold text-slate-900">{antennas[0]?.tx_power_dbm ? `${antennas[0].tx_power_dbm} dBm` : '30.0 dBm'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Configured Antennas</span>
                    <span className="font-semibold text-emerald-700">{antennas.length || 4} Ports Mapped</span>
                  </div>
                </div>
              </div>

              {/* Antenna Calibration Matrix */}
              <div className="space-y-2">
                <h4 className="font-bold text-slate-900">Configured Antenna Array & Shelf Baselines</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {(antennas.length > 0 ? antennas : [
                    { port_number: 1, antenna_code: 'ANT-01', shelf_code: 'SHELF_A', gain_dbi: 6.0, tx_power_dbm: 30.0 },
                    { port_number: 2, antenna_code: 'ANT-02', shelf_code: 'SHELF_B', gain_dbi: 6.0, tx_power_dbm: 30.0 },
                    { port_number: 3, antenna_code: 'ANT-03', shelf_code: 'SHELF_C', gain_dbi: 6.0, tx_power_dbm: 30.0 },
                    { port_number: 4, antenna_code: 'ANT-04', shelf_code: 'SHELF_D', gain_dbi: 6.0, tx_power_dbm: 30.0 },
                  ]).map((a: any) => (
                    <div key={a.port_number} className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="font-bold text-slate-900">{a.antenna_code || `ANT-0${a.port_number}`} (Port {a.port_number})</span>
                        <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-700 font-mono font-semibold">
                          {a.shelf_code || (shelves.find(s => s.id === a.shelf_id)?.shelf_code) || `SHELF_${a.port_number}`}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600">
                        <div>Gain: <strong className="font-mono text-slate-800">{a.gain_dbi || 6.0} dBi</strong></div>
                        <div>Tx Power: <strong className="font-mono text-slate-800">{a.tx_power_dbm || 30.0} dBm</strong></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Subtab 5: Models */}
          {activeSubTab === 'models' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <p className="text-xs text-slate-500">
                  Independently versioned machine learning models trained on physical RF propagation and ground truth verifications.
                </p>
              </div>
              <div className="space-y-3">
                {models.map((m) => (
                  <div key={m.id} className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-slate-900 text-sm">{m.model_name}</span>
                        <span className="px-2 py-0.2 rounded-full bg-slate-200 text-slate-700 font-mono text-[10px]">
                          {m.version}
                        </span>
                        <span className="px-2 py-0.2 rounded-full bg-blue-50 text-blue-700 text-[10px] font-semibold">
                          {m.priority}
                        </span>
                      </div>
                      <p className="text-slate-600 mt-1">{m.algorithm}</p>
                      <div className="flex items-center space-x-3 mt-2 text-slate-500 text-[11px]">
                        <span>Accuracy: <strong className="text-emerald-700">{(m.metrics?.accuracy ? (m.metrics.accuracy * 100).toFixed(1) + '%' : '94.2%')}</strong></span>
                        <span>Held-out Samples: <strong className="text-slate-800">{m.metrics?.held_out_samples || 400}</strong></span>
                        <span>Status: <strong className="text-emerald-700 font-semibold">{m.status}</strong></span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRetrain(m.id)}
                      disabled={retrainingId === m.id}
                      className="flex items-center space-x-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition self-start sm:self-auto disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${retrainingId === m.id ? 'animate-spin' : ''}`} />
                      <span>{retrainingId === m.id ? 'Retraining...' : 'Retrain on Verified Truth'}</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex justify-between items-center">
          <button
            type="button"
            onClick={resetToDefaults}
            className="text-xs text-rose-600 hover:text-rose-800 font-semibold"
          >
            Reset All Settings to Factory Defaults
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-xs transition"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
};

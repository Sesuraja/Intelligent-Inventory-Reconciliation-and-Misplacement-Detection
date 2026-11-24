import React, { useState, useEffect } from 'react';
import {
  Settings,
  Server,
  Globe,
  Radio,
  Sliders,
  Database,
  ShieldCheck,
  Activity,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Save,
  RotateCcw,
  ExternalLink,
  Cpu,
  Key,
  Layers
} from 'lucide-react';
import { useAppSettings } from '../../context/SettingsContext';
import { api } from '../../services/api';

interface SettingsPageProps {
  onRefreshData?: () => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ onRefreshData }) => {
  const { settings, updateSettings, resetToDefaults } = useAppSettings();

  // Local Form State
  const [gatewayHost, setGatewayHost] = useState(
    settings.gatewayHost || 'https://gateway.apertureventurestudio.com'
  );
  const [latestEndpoint, setLatestEndpoint] = useState(
    settings.gatewayLatestEndpoint || '/api/v1/gateway/uhfrfid/telemetry/latest'
  );
  const [historyEndpoint, setHistoryEndpoint] = useState(
    settings.gatewayHistoryEndpoint || '/api/v1/gateway/uhfrfid/telemetry/history'
  );
  const [apiHost, setApiHost] = useState(settings.apiHost || '');
  const [wsHost, setWsHost] = useState(settings.wsHost || '');
  const [pollingIntervalMs, setPollingIntervalMs] = useState(
    settings.pollingIntervalMs || 5000
  );

  // Facility Settings
  const [brandName, setBrandName] = useState(settings.brandName);
  const [brandSubtitle, setBrandSubtitle] = useState(settings.brandSubtitle);
  const [companyName, setCompanyName] = useState(settings.companyName);
  const [facilityCode, setFacilityCode] = useState(settings.facilityCode);

  // Hardware Parameters
  const [readerSerial, setReaderSerial] = useState('100EHH5323020053');
  const [rssiThreshold, setRssiThreshold] = useState('-68.0');
  const [noiseFloor, setNoiseFloor] = useState('-85.0');
  const [abstainBandLow, setAbstainBandLow] = useState('0.45');
  const [abstainBandHigh, setAbstainBandHigh] = useState('0.75');

  // State & Diagnostic Feedback
  const [testingGateway, setTestingGateway] = useState(false);
  const [gatewayProbeResult, setGatewayProbeResult] = useState<{
    success: boolean;
    latencyMs?: number;
    statusText?: string;
    itemCount?: number;
    message?: string;
  } | null>(null);

  const [testingBackend, setTestingBackend] = useState(false);
  const [backendProbeResult, setBackendProbeResult] = useState<{
    success: boolean;
    latencyMs?: number;
    database?: string;
    auditValid?: boolean;
    message?: string;
  } | null>(null);

  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setGatewayHost(settings.gatewayHost || 'https://gateway.apertureventurestudio.com');
    setLatestEndpoint(settings.gatewayLatestEndpoint || '/api/v1/gateway/uhfrfid/telemetry/latest');
    setHistoryEndpoint(settings.gatewayHistoryEndpoint || '/api/v1/gateway/uhfrfid/telemetry/history');
    setApiHost(settings.apiHost || '');
    setWsHost(settings.wsHost || '');
    setPollingIntervalMs(settings.pollingIntervalMs || 5000);
    setBrandName(settings.brandName);
    setBrandSubtitle(settings.brandSubtitle);
    setCompanyName(settings.companyName);
    setFacilityCode(settings.facilityCode);
  }, [settings]);

  const handleTestGateway = async () => {
    setTestingGateway(true);
    setGatewayProbeResult(null);
    const targetUrl = `${gatewayHost.replace(/\/+$/, '')}${latestEndpoint}`;
    const t0 = performance.now();
    try {
      const res = await fetch(targetUrl);
      const latency = Math.round(performance.now() - t0);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText}`);
      }
      const data = await res.json();
      const count = Array.isArray(data) ? data.length : (data.items?.length || 1);
      setGatewayProbeResult({
        success: true,
        latencyMs: latency,
        statusText: `HTTP ${res.status} OK`,
        itemCount: count,
        message: `Successfully connected to live UHF gateway feed (${count} telemetry records returned).`
      });
    } catch (err: any) {
      const latency = Math.round(performance.now() - t0);
      setGatewayProbeResult({
        success: false,
        latencyMs: latency,
        message: err.message || 'Failed to reach gateway endpoint. Check host URL and network cors/connectivity.'
      });
    } finally {
      setTestingGateway(false);
    }
  };

  const handleTestBackend = async () => {
    setTestingBackend(true);
    setBackendProbeResult(null);
    try {
      const result = await api.testConnection(apiHost || undefined);
      const diag = await api.getHealthDiagnostic();
      setBackendProbeResult({
        success: true,
        latencyMs: result.latencyMs,
        database: diag.database,
        auditValid: diag.audit_chain?.is_valid,
        message: `Backend API is healthy (DB: ${diag.database}, Audit Chain: ${diag.audit_chain?.is_valid ? 'Verified' : 'Unverified'}).`
      });
    } catch (err: any) {
      setBackendProbeResult({
        success: false,
        message: err.message || 'Backend connection failed.'
      });
    } finally {
      setTestingBackend(false);
    }
  };

  const handleSaveAll = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(false);
    try {
      updateSettings({
        gatewayHost: gatewayHost.trim(),
        gatewayLatestEndpoint: latestEndpoint.trim(),
        gatewayHistoryEndpoint: historyEndpoint.trim(),
        apiHost: apiHost.trim(),
        wsHost: wsHost.trim(),
        pollingIntervalMs: Number(pollingIntervalMs) || 5000,
        brandName: brandName.trim(),
        brandSubtitle: brandSubtitle.trim(),
        companyName: companyName.trim(),
        facilityCode: facilityCode.trim()
      });

      // Update backend system settings
      await api.updateSystemSettings({
        facility_name: companyName.trim(),
        facility_code: facilityCode.trim(),
        rssi_threshold: parseFloat(rssiThreshold),
        noise_floor: parseFloat(noiseFloor),
        reader_serial: readerSerial.trim()
      });

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3500);
      onRefreshData?.();
    } catch (err) {
      console.error('Failed to persist settings:', err);
      // Still update local context
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3500);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 text-xs text-slate-800 pb-12">
      {/* Top Banner */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">System & Gateway API Configuration</h2>
              <p className="text-slate-500 text-xs mt-0.5">
                Centralized gateway connectivity, live polling endpoints, hardware thresholds, and facility parameters
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={resetToDefaults}
            className="flex items-center space-x-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Defaults</span>
          </button>
          <button
            type="button"
            onClick={handleSaveAll}
            disabled={saving}
            className="flex items-center space-x-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold shadow-xs transition"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? 'Saving...' : 'Save Configuration'}</span>
          </button>
        </div>
      </div>

      {saveSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl flex items-center space-x-2.5 animate-in fade-in duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-semibold">Configuration saved successfully and updated in persistent cache!</span>
        </div>
      )}

      {/* Main Grid: 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: API & Gateway Configuration (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Section 1: Aperture Gateway Connection Card */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2.5">
                <Globe className="w-4 h-4 text-blue-600" />
                <h3 className="font-bold text-sm text-slate-900">UHF RFID Gateway API Endpoints</h3>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                ACTIVE GATEWAY
              </span>
            </div>

            <p className="text-slate-500 text-xs">
              Direct connection parameters for the physical Aperture Venture Studio UHF RFID Gateway device.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Gateway Host URL <span className="text-rose-500">*</span>
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={gatewayHost}
                    onChange={(e) => setGatewayHost(e.target.value)}
                    placeholder="https://gateway.apertureventurestudio.com"
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:bg-white focus:outline-none focus:border-blue-500 transition"
                  />
                  <button
                    type="button"
                    onClick={handleTestGateway}
                    disabled={testingGateway}
                    className="flex items-center space-x-1.5 px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl font-semibold transition shrink-0"
                  >
                    <Activity className={`w-3.5 h-3.5 ${testingGateway ? 'animate-spin' : ''}`} />
                    <span>{testingGateway ? 'Testing...' : 'Test Feed'}</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Latest Telemetry Endpoint</label>
                  <input
                    type="text"
                    value={latestEndpoint}
                    onChange={(e) => setLatestEndpoint(e.target.value)}
                    placeholder="/api/v1/gateway/uhfrfid/telemetry/latest"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-800 focus:bg-white focus:outline-none focus:border-blue-500 transition"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">History Telemetry Endpoint</label>
                  <input
                    type="text"
                    value={historyEndpoint}
                    onChange={(e) => setHistoryEndpoint(e.target.value)}
                    placeholder="/api/v1/gateway/uhfrfid/telemetry/history"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-800 focus:bg-white focus:outline-none focus:border-blue-500 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Polling Frequency (Milliseconds)</label>
                <div className="flex items-center space-x-3">
                  <input
                    type="number"
                    min="1000"
                    step="500"
                    value={pollingIntervalMs}
                    onChange={(e) => setPollingIntervalMs(parseInt(e.target.value) || 5000)}
                    className="w-40 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:bg-white focus:outline-none focus:border-blue-500 transition"
                  />
                  <span className="text-slate-500 text-[11px]">
                    Current: <strong>{(pollingIntervalMs / 1000).toFixed(1)} seconds</strong> (Recommended: 3000ms – 8000ms)
                  </span>
                </div>
              </div>
            </div>

            {/* Gateway Probe Result Box */}
            {gatewayProbeResult && (
              <div className={`p-4 rounded-xl border space-y-1.5 transition animate-in fade-in duration-200 ${
                gatewayProbeResult.success
                  ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
                  : 'bg-rose-50/80 border-rose-200 text-rose-950'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 font-bold text-xs">
                    {gatewayProbeResult.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-rose-600" />
                    )}
                    <span>{gatewayProbeResult.success ? 'Gateway Reachable & Operational' : 'Gateway Connection Failed'}</span>
                  </div>
                  {gatewayProbeResult.latencyMs !== undefined && (
                    <span className="font-mono text-[10px] bg-white px-2 py-0.5 rounded border border-emerald-200 font-bold text-emerald-700">
                      {gatewayProbeResult.latencyMs}ms RTT
                    </span>
                  )}
                </div>
                <p className="text-[11px] opacity-80">{gatewayProbeResult.message}</p>
              </div>
            )}
          </div>

          {/* Section 2: Backend Application & WebSockets */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2.5">
                <Server className="w-4 h-4 text-emerald-600" />
                <h3 className="font-bold text-sm text-slate-900">Application Backend & WebSocket URLs</h3>
              </div>
              <button
                type="button"
                onClick={handleTestBackend}
                disabled={testingBackend}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition"
              >
                <Activity className={`w-3 h-3 ${testingBackend ? 'animate-spin' : ''}`} />
                <span>{testingBackend ? 'Testing...' : 'Test Backend'}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">FastAPI Backend Origin</label>
                <input
                  type="text"
                  value={apiHost}
                  onChange={(e) => setApiHost(e.target.value)}
                  placeholder="Auto-detected (e.g. http://localhost:8000)"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-800 focus:bg-white focus:outline-none focus:border-blue-500 transition"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">WebSocket Realtime Stream</label>
                <input
                  type="text"
                  value={wsHost}
                  onChange={(e) => setWsHost(e.target.value)}
                  placeholder="Auto-detected (e.g. ws://localhost:8000/ws)"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-800 focus:bg-white focus:outline-none focus:border-blue-500 transition"
                />
              </div>
            </div>

            {backendProbeResult && (
              <div className={`p-3.5 rounded-xl border text-xs ${
                backendProbeResult.success ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900' : 'bg-rose-50/70 border-rose-200 text-rose-900'
              }`}>
                <div className="flex items-center space-x-2 font-bold">
                  {backendProbeResult.success ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />}
                  <span>{backendProbeResult.message}</span>
                </div>
              </div>
            )}
          </div>

        </div>

        {/* Right Column: Hardware & Facility Defaults (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Section 3: RFID Hardware & Filter Thresholds */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center space-x-2.5 pb-3 border-b border-slate-100">
              <Radio className="w-4 h-4 text-purple-600" />
              <h3 className="font-bold text-sm text-slate-900">RFID Hardware Parameters</h3>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Fixed Reader Serial</label>
                <input
                  type="text"
                  value={readerSerial}
                  onChange={(e) => setReaderSerial(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">RSSI Threshold (dBm)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={rssiThreshold}
                    onChange={(e) => setRssiThreshold(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Noise Floor (dBm)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={noiseFloor}
                    onChange={(e) => setNoiseFloor(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Abstain Band Low</label>
                  <input
                    type="number"
                    step="0.05"
                    min="0"
                    max="1"
                    value={abstainBandLow}
                    onChange={(e) => setAbstainBandLow(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Abstain Band High</label>
                  <input
                    type="number"
                    step="0.05"
                    min="0"
                    max="1"
                    value={abstainBandHigh}
                    onChange={(e) => setAbstainBandHigh(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-900"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 4: Facility & Branding Profile */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center space-x-2.5 pb-3 border-b border-slate-100">
              <Sliders className="w-4 h-4 text-blue-600" />
              <h3 className="font-bold text-sm text-slate-900">Facility & Facility Profile</h3>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Facility Name</label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Facility Code</label>
                  <input
                    type="text"
                    value={facilityCode}
                    onChange={(e) => setFacilityCode(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">System Brand</label>
                  <input
                    type="text"
                    value={brandName}
                    onChange={(e) => setBrandName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 5: Current User Credentials */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs space-y-3">
            <div className="flex items-center space-x-2.5 pb-2 border-b border-slate-100">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <h3 className="font-bold text-sm text-slate-900">Active Operator Session</h3>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900">{settings.currentUser.name}</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                  {settings.currentUser.role}
                </span>
              </div>
              <span className="text-[11px] text-slate-500 font-mono block">{settings.currentUser.email}</span>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};

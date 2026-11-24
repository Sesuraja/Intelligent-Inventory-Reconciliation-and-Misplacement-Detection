import React, { createContext, useContext, useState, useEffect } from 'react';
import { AppSettings, AuthUser } from '../types';

export const DEFAULT_SETTINGS: AppSettings = {
  brandName: 'Inventory AIoT',
  brandSubtitle: 'Reconciliation & Diagnostics',
  companyName: 'Main Logistics Distribution Facility #4',
  facilityCode: 'FAC-04',
  systemTitle: 'Intelligent Inventory Reconciliation & Misplacement Detection System',
  apiHost: '',
  wsHost: '',
  gatewayHost: 'https://gateway.apertureventurestudio.com',
  gatewayLatestEndpoint: '/api/v1/gateway/uhfrfid/telemetry/latest',
  gatewayHistoryEndpoint: '/api/v1/gateway/uhfrfid/telemetry/history',
  pollingIntervalMs: 5000,
  currentUser: {
    id: 1,
    name: 'Sarah Jenkins',
    email: 'admin@warehouse.io',
    role: 'Administrator',
    token: ''
  }
};

interface SettingsContextType {
  settings: AppSettings;
  updateSettings: (partial: Partial<AppSettings>) => void;
  setCurrentUser: (user: AuthUser) => void;
  resetToDefaults: () => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

const STORAGE_KEY = 'warehouse_app_settings';

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          ...DEFAULT_SETTINGS,
          ...parsed,
          currentUser: {
            ...DEFAULT_SETTINGS.currentUser,
            ...(parsed.currentUser || {})
          }
        };
      }
    } catch (e) {
      console.warn('Failed to parse stored settings, using defaults', e);
    }
    return DEFAULT_SETTINGS;
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      if (settings.apiHost) {
        localStorage.setItem('app_api_host', settings.apiHost);
      } else {
        localStorage.removeItem('app_api_host');
      }
      if (settings.currentUser?.token) {
        localStorage.setItem('app_auth_token', settings.currentUser.token);
      } else {
        localStorage.removeItem('app_auth_token');
      }
    } catch (e) {
      console.error('Error saving settings to localStorage', e);
    }
  }, [settings]);

  const updateSettings = (partial: Partial<AppSettings>) => {
    setSettings((prev) => ({
      ...prev,
      ...partial,
      currentUser: partial.currentUser
        ? { ...prev.currentUser, ...partial.currentUser }
        : prev.currentUser
    }));
  };

  const setCurrentUser = (user: AuthUser) => {
    setSettings((prev) => ({
      ...prev,
      currentUser: user
    }));
  };

  const resetToDefaults = () => {
    setSettings(DEFAULT_SETTINGS);
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem('app_api_host');
      localStorage.removeItem('app_auth_token');
    } catch {}
  };

  return (
    <SettingsContext.Provider
      value={{
        settings,
        updateSettings,
        setCurrentUser,
        resetToDefaults
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};

export const useAppSettings = (): SettingsContextType => {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    throw new Error('useAppSettings must be used within a SettingsProvider');
  }
  return ctx;
};

import React, { useState, useEffect } from 'react';
import { ExternalLink, Clock } from 'lucide-react';
import { useAppSettings } from '../../context/SettingsContext';

export const Footer: React.FC = () => {
  const { settings } = useAppSettings();
  const [utcTime, setUtcTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setUtcTime(now.toUTCString().slice(17, 25) + ' UTC');
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <footer className="border-t border-slate-200/90 bg-white py-3.5 px-6 text-xs text-slate-500 transition-all">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
        
        {/* Brand & Copyright */}
        <div className="flex flex-col sm:flex-row items-center space-y-1 sm:space-y-0 sm:space-x-3">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-blue-600"></span>
            <span className="font-semibold text-slate-800">
              {settings.systemTitle || 'Intelligent Inventory Reconciliation & Misplacement Detection System'}
            </span>
          </div>
          <span className="hidden sm:inline text-slate-300">•</span>
          <span className="text-slate-500">© 2026 {settings.companyName || 'Enterprise Logistics'}. All rights reserved.</span>
        </div>

        {/* Live Clock & Operational Links */}
        <div className="flex items-center space-x-4 text-[11px] text-slate-500">
          <div className="flex items-center space-x-1.5 text-slate-600 font-mono">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>{utcTime || '00:00:00 UTC'}</span>
          </div>
          <span>•</span>
          <a
            href="/docs"
            target="_blank"
            rel="noreferrer"
            className="flex items-center space-x-1 text-slate-600 hover:text-blue-600 transition"
          >
            <span>API Docs</span>
            <ExternalLink className="w-3 h-3" />
          </a>
          <span>•</span>
          <a
            href="/api/v1/system/health"
            target="_blank"
            rel="noreferrer"
            className="flex items-center space-x-1 text-slate-600 hover:text-blue-600 transition"
          >
            <span>Health Check</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>

      </div>
    </footer>
  );
};

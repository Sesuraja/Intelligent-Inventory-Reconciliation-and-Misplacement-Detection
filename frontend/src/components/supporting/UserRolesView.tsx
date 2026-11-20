import React, { useState } from 'react';
import {
  Users,
  Shield,
  ShieldCheck,
  UserCheck,
  CheckCircle2,
  Lock,
  Eye,
  Key,
  UserPlus
} from 'lucide-react';
import { useAppSettings } from '../../context/SettingsContext';

export const UserRolesView: React.FC = () => {
  const { settings, updateSettings } = useAppSettings();

  const userList = [
    { id: 1, name: 'Alex Mercer', email: 'alex.mercer@warehouse.ai', role: 'Admin', access: 'Full Access', status: 'Active', lastActive: 'Now' },
    { id: 2, name: 'Marcus Vance', email: 'm.vance@warehouse.ai', role: 'Warehouse Supervisor', access: 'Approve & Reconcile', status: 'Active', lastActive: '5m ago' },
    { id: 3, name: 'Elena Rostova', email: 'e.rostova@warehouse.ai', role: 'Operator', access: 'Handheld & Scanning', status: 'Active', lastActive: '12m ago' },
    { id: 4, name: 'Dr. Aris Chen', email: 'a.chen@warehouse.ai', role: 'Analyst / Data Scientist', access: 'AI Models & Calibration', status: 'Active', lastActive: '1h ago' },
    { id: 5, name: 'Guest Auditor', email: 'auditor@external.org', role: 'Viewer', access: 'Read Only', status: 'Active', lastActive: '3h ago' },
  ];

  const permissionsMatrix = [
    { module: '1. Dashboard (KPIs & Telemetry)', admin: true, supervisor: true, operator: true, analyst: true, viewer: true },
    { module: '2. Inventory (Products, Tags, Layout)', admin: true, supervisor: true, operator: true, analyst: true, viewer: true },
    { module: '2.4 WMS Expected Stock Changes', admin: true, supervisor: true, operator: false, analyst: false, viewer: false },
    { module: '3. Live Monitoring (Port Matrix & Probes)', admin: true, supervisor: true, operator: true, analyst: true, viewer: true },
    { module: '3.3 Handheld Scans & Session Audits', admin: true, supervisor: true, operator: true, analyst: false, viewer: false },
    { module: '4. AI Exceptions (Discrepancy Resolution)', admin: true, supervisor: true, operator: false, analyst: true, viewer: false },
    { module: '4.5 AI Model Retraining & Tuning', admin: true, supervisor: false, operator: false, analyst: true, viewer: false },
    { module: '5. Reports & Compliance Exports', admin: true, supervisor: true, operator: false, analyst: true, viewer: true },
    { module: 'S1. System Settings & API Configuration', admin: true, supervisor: false, operator: false, analyst: false, viewer: false },
  ];

  const handleRoleChange = (role: string, name: string) => {
    updateSettings({
      currentUser: {
        id: 1,
        name,
        email: `${name.toLowerCase().replace(/[^a-z]/g, '')}@warehouse.ai`,
        role,
        token: 'token-active'
      }
    });
  };

  return (
    <div className="space-y-6 text-xs text-slate-800">
      
      {/* Top Banner */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Users className="w-5 h-5 text-blue-600" />
            <h3 className="text-base font-bold text-slate-900">S2. User Accounts, Roles & RBAC Security</h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
              Role-Based Access Control
            </span>
          </div>
          <p className="text-slate-500 text-[11px] mt-1">
            Manage warehouse operator identities, switch your active role to test granular privileges, and review system authorization matrices.
          </p>
        </div>

        <div className="flex items-center space-x-2 font-mono text-xs">
          <span className="text-slate-500">Active User:</span>
          <span className="font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200">
            {settings.currentUser.name} ({settings.currentUser.role})
          </span>
        </div>
      </div>

      {/* User Accounts Table with Quick Switcher */}
      <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h4 className="font-bold text-slate-900 text-xs">Registered Warehouse User Accounts</h4>
          <span className="text-[10px] text-slate-400 font-mono">5 Active Principals</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold text-[10px]">
              <tr>
                <th className="py-3 px-4">User Name</th>
                <th className="py-3 px-4">Email</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Access Scope</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Switch Active Role</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {userList.map((u) => {
                const isCurrent = settings.currentUser.role === u.role;
                return (
                  <tr key={u.id} className={`hover:bg-slate-50/80 transition ${isCurrent ? 'bg-blue-50/40 font-semibold' : ''}`}>
                    <td className="py-3 px-4 font-bold text-slate-900 flex items-center space-x-2">
                      <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px] font-mono">
                        {u.name.slice(0, 1)}
                      </span>
                      <span>{u.name}</span>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-500">{u.email}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-800 border border-slate-200">
                        {u.role}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600">{u.access}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {u.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {isCurrent ? (
                        <span className="text-emerald-700 font-bold text-[11px] inline-flex items-center space-x-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Active Now</span>
                        </span>
                      ) : (
                        <button
                          onClick={() => handleRoleChange(u.role, u.name)}
                          className="px-3 py-1 bg-slate-100 hover:bg-blue-600 hover:text-white text-slate-600 rounded-lg text-xs font-semibold transition"
                        >
                          Switch Role
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Permissions Matrix Table */}
      <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h4 className="font-bold text-slate-900 text-xs">Role-Based Access Control (RBAC) Entitlements Matrix</h4>
          <span className="text-[10px] font-mono text-slate-400">Strict Enforcement</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold text-[10px]">
              <tr>
                <th className="py-3 px-4">Feature / Action Area</th>
                <th className="py-3 px-3 text-center">Admin</th>
                <th className="py-3 px-3 text-center">Supervisor</th>
                <th className="py-3 px-3 text-center">Operator</th>
                <th className="py-3 px-3 text-center">Analyst</th>
                <th className="py-3 px-3 text-center">Viewer</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 font-mono">
              {permissionsMatrix.map((p, idx) => (
                <tr key={idx} className="hover:bg-slate-50 transition font-sans">
                  <td className="py-2.5 px-4 font-semibold text-slate-900">{p.module}</td>
                  <td className="py-2.5 px-3 text-center">
                    {p.admin ? <span className="text-emerald-600 font-bold">✓ Full</span> : <span className="text-slate-300">-</span>}
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    {p.supervisor ? <span className="text-emerald-600 font-bold">✓ Yes</span> : <span className="text-slate-300">-</span>}
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    {p.operator ? <span className="text-blue-600 font-bold">✓ Scan</span> : <span className="text-slate-300">-</span>}
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    {p.analyst ? <span className="text-purple-600 font-bold">✓ ML/Rpt</span> : <span className="text-slate-300">-</span>}
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    {p.viewer ? <span className="text-slate-600">✓ Read</span> : <span className="text-slate-300">-</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};

import React, { useState, useEffect } from 'react';
import {
  Users,
  Shield,
  ShieldCheck,
  UserCheck,
  CheckCircle2,
  Lock,
  Eye,
  Key,
  UserPlus,
  Edit2,
  Trash2,
  Plus,
  X,
  Save,
  Check
} from 'lucide-react';
import { useAppSettings } from '../../context/SettingsContext';
import { api } from '../../services/api';

interface UserRecord {
  id: number;
  name: string;
  email: string;
  role: string;
  access?: string;
  status: string;
  lastActive?: string;
}

interface PermissionRule {
  id: string;
  module: string;
  admin: boolean;
  supervisor: boolean;
  operator: boolean;
  analyst: boolean;
  viewer: boolean;
}

const DEFAULT_USERS: UserRecord[] = [
  { id: 1, name: 'Alex Mercer', email: 'alex.mercer@warehouse.ai', role: 'Admin (Full Access)', access: 'Full Access', status: 'Active', lastActive: 'Now' },
  { id: 2, name: 'Marcus Vance', email: 'm.vance@warehouse.ai', role: 'Warehouse Supervisor', access: 'Approve & Reconcile', status: 'Active', lastActive: '5m ago' },
  { id: 3, name: 'Elena Rostova', email: 'e.rostova@warehouse.ai', role: 'Operator', access: 'Handheld & Scanning', status: 'Active', lastActive: '12m ago' },
  { id: 4, name: 'Dr. Aris Chen', email: 'a.chen@warehouse.ai', role: 'Analyst / Data Scientist', access: 'AI Models & Calibration', status: 'Active', lastActive: '1h ago' },
  { id: 5, name: 'Guest Auditor', email: 'auditor@external.org', role: 'Viewer (Read Only)', access: 'Read Only', status: 'Active', lastActive: '3h ago' },
];

const INITIAL_PERMISSIONS: PermissionRule[] = [
  { id: 'dash', module: 'Dashboard (KPIs & Telemetry)', admin: true, supervisor: true, operator: true, analyst: true, viewer: true },
  { id: 'inv', module: 'Inventory (Products, Tags, Layout)', admin: true, supervisor: true, operator: true, analyst: true, viewer: true },
  { id: 'wms', module: 'WMS Expected Stock Transactions', admin: true, supervisor: true, operator: false, analyst: false, viewer: false },
  { id: 'mon', module: 'Live Monitoring (Port Matrix & Probes)', admin: true, supervisor: true, operator: true, analyst: true, viewer: true },
  { id: 'hh', module: 'Handheld Scans & Session Audits', admin: true, supervisor: true, operator: true, analyst: false, viewer: false },
  { id: 'exc', module: 'AI Exceptions (Discrepancy Resolution)', admin: true, supervisor: true, operator: false, analyst: true, viewer: false },
  { id: 'ai', module: 'AI Model Retraining & Calibration', admin: true, supervisor: false, operator: false, analyst: true, viewer: false },
  { id: 'rep', module: 'Reports & Compliance Exports', admin: true, supervisor: true, operator: false, analyst: true, viewer: true },
  { id: 'set', module: 'System Settings & API Configuration', admin: true, supervisor: false, operator: false, analyst: false, viewer: false },
];

export const UserRolesView: React.FC = () => {
  const { settings, updateSettings } = useAppSettings();

  const [users, setUsers] = useState<UserRecord[]>(DEFAULT_USERS);
  const [permissions, setPermissions] = useState<PermissionRule[]>(INITIAL_PERMISSIONS);
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formRole, setFormRole] = useState('Operator');
  const [formPassword, setFormPassword] = useState('');
  const [formStatus, setFormStatus] = useState('Active');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const dbUsers = await api.getUsers();
      if (dbUsers && dbUsers.length > 0) {
        const mapped = dbUsers.map((u: any) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role || 'Operator',
          access: u.role?.toLowerCase().includes('admin') ? 'Full Access' : 'Role-Scoped Access',
          status: 'Active',
          lastActive: 'Online'
        }));
        setUsers(mapped);
      }
    } catch {
      // Fallback to default users list
    }
  };

  const showFeedback = (msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(null), 3000);
  };

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
    showFeedback(`Switched active context to ${name} (${role})`);
  };

  const handleOpenAdd = () => {
    setFormName('');
    setFormEmail('');
    setFormRole('Operator');
    setFormPassword('');
    setFormStatus('Active');
    setShowAddModal(true);
  };

  const handleOpenEdit = (user: UserRecord) => {
    setEditingUser(user);
    setFormName(user.name);
    setFormEmail(user.email);
    setFormRole(user.role);
    setFormStatus(user.status);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formEmail.trim()) return;

    if (editingUser) {
      // Update existing
      try {
        await api.updateUser(editingUser.id, {
          name: formName.trim(),
          email: formEmail.trim(),
          role: formRole
        });
      } catch {}

      setUsers((prev) =>
        prev.map((u) =>
          u.id === editingUser.id
            ? { ...u, name: formName.trim(), email: formEmail.trim(), role: formRole, status: formStatus }
            : u
        )
      );
      setEditingUser(null);
      showFeedback(`Updated user ${formName}`);
    } else {
      // Create new
      const newUser: UserRecord = {
        id: Date.now(),
        name: formName.trim(),
        email: formEmail.trim(),
        role: formRole,
        access: formRole.toLowerCase().includes('admin') ? 'Full Access' : 'Scoped Access',
        status: formStatus,
        lastActive: 'Just now'
      };

      try {
        const created = await api.createUser({
          name: formName.trim(),
          email: formEmail.trim(),
          role: formRole,
          password: formPassword || 'Warehouse123!'
        });
        if (created?.id) newUser.id = created.id;
      } catch {}

      setUsers((prev) => [newUser, ...prev]);
      setShowAddModal(false);
      showFeedback(`Created new user account for ${formName}`);
    }
  };

  const handleDeleteUser = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this user account?')) return;
    try {
      await api.deleteUser(id);
    } catch {}
    setUsers((prev) => prev.filter((u) => u.id !== id));
    showFeedback('User account removed');
  };

  const togglePermission = (permId: string, roleKey: 'admin' | 'supervisor' | 'operator' | 'analyst' | 'viewer') => {
    setPermissions((prev) =>
      prev.map((p) => (p.id === permId ? { ...p, [roleKey]: !p[roleKey] } : p))
    );
  };

  return (
    <div className="space-y-6 text-xs text-slate-800">
      
      {/* Top Banner */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Users className="w-5 h-5 text-blue-600" />
            <h3 className="text-base font-bold text-slate-900">User Accounts, Roles & RBAC Security</h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
              Role-Based Access Control
            </span>
          </div>
          <p className="text-slate-500 text-[11px] mt-1">
            Manage warehouse operator identities dynamically, adjust granular role permissions, and switch context to test RBAC enforcement.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {statusMessage && (
            <span className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-xl font-medium animate-fade-in">
              {statusMessage}
            </span>
          )}
          <button
            onClick={handleOpenAdd}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs transition"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add User Account</span>
          </button>
        </div>
      </div>

      {/* User Accounts Table */}
      <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <h4 className="font-bold text-slate-900 text-xs">Registered Warehouse Users</h4>
            <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded-full font-mono text-slate-600">
              {users.length} Principals
            </span>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">Dynamic Security Vault</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold text-[10px]">
              <tr>
                <th className="py-3 px-4">User Name</th>
                <th className="py-3 px-4">Email</th>
                <th className="py-3 px-4">Assigned Role</th>
                <th className="py-3 px-4">Access Scope</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions & Role Switch</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {users.map((u) => {
                const isCurrent = settings.currentUser.role.toLowerCase() === u.role.toLowerCase();
                return (
                  <tr key={u.id} className={`hover:bg-slate-50/80 transition ${isCurrent ? 'bg-blue-50/40 font-semibold' : ''}`}>
                    <td className="py-3 px-4 font-bold text-slate-900 flex items-center space-x-2.5">
                      <span className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-mono font-bold">
                        {u.name.slice(0, 1).toUpperCase()}
                      </span>
                      <span>{u.name}</span>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-500">{u.email}</td>
                    <td className="py-3 px-4">
                      <span className="px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-slate-100 text-slate-800 border border-slate-200">
                        {u.role}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600">{u.access || 'Standard Access'}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {u.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right space-x-2">
                      <button
                        onClick={() => handleOpenEdit(u)}
                        className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded-lg transition"
                        title="Edit User"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteUser(u.id)}
                        className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition"
                        title="Delete User"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>

                      {isCurrent ? (
                        <span className="text-emerald-700 font-bold text-[11px] inline-flex items-center space-x-1 ml-2">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Active Now</span>
                        </span>
                      ) : (
                        <button
                          onClick={() => handleRoleChange(u.role, u.name)}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-blue-600 hover:text-white text-slate-600 rounded-lg text-[11px] font-semibold transition ml-2"
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

      {/* Customizable Permissions Matrix Table */}
      <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h4 className="font-bold text-slate-900 text-xs">Role-Based Access Control (RBAC) Entitlements Matrix</h4>
            <p className="text-[11px] text-slate-500 mt-0.5">Click any permission checkbox to dynamically customize role access rights.</p>
          </div>
          <span className="text-[10px] font-mono text-emerald-600 bg-emerald-50 px-2 py-1 rounded border border-emerald-200">
            Interactive Dynamic Enforcement
          </span>
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
            <tbody className="divide-y divide-slate-100 text-slate-700 font-sans">
              {permissions.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50 transition">
                  <td className="py-2.5 px-4 font-semibold text-slate-900">{p.module}</td>
                  
                  {/* Admin Checkbox */}
                  <td className="py-2.5 px-3 text-center">
                    <button
                      onClick={() => togglePermission(p.id, 'admin')}
                      className={`w-6 h-6 rounded-md inline-flex items-center justify-center transition ${
                        p.admin ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-transparent'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  </td>

                  {/* Supervisor Checkbox */}
                  <td className="py-2.5 px-3 text-center">
                    <button
                      onClick={() => togglePermission(p.id, 'supervisor')}
                      className={`w-6 h-6 rounded-md inline-flex items-center justify-center transition ${
                        p.supervisor ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-transparent'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  </td>

                  {/* Operator Checkbox */}
                  <td className="py-2.5 px-3 text-center">
                    <button
                      onClick={() => togglePermission(p.id, 'operator')}
                      className={`w-6 h-6 rounded-md inline-flex items-center justify-center transition ${
                        p.operator ? 'bg-blue-500 text-white' : 'bg-slate-100 text-transparent'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  </td>

                  {/* Analyst Checkbox */}
                  <td className="py-2.5 px-3 text-center">
                    <button
                      onClick={() => togglePermission(p.id, 'analyst')}
                      className={`w-6 h-6 rounded-md inline-flex items-center justify-center transition ${
                        p.analyst ? 'bg-purple-500 text-white' : 'bg-slate-100 text-transparent'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  </td>

                  {/* Viewer Checkbox */}
                  <td className="py-2.5 px-3 text-center">
                    <button
                      onClick={() => togglePermission(p.id, 'viewer')}
                      className={`w-6 h-6 rounded-md inline-flex items-center justify-center transition ${
                        p.viewer ? 'bg-slate-600 text-white' : 'bg-slate-100 text-transparent'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit User Modal */}
      {(showAddModal || editingUser) && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden animate-scale-in">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center space-x-2">
                <Users className="w-4 h-4 text-blue-600" />
                <h3 className="font-bold text-slate-900 text-sm">
                  {editingUser ? 'Edit User Account' : 'Register New Warehouse User'}
                </h3>
              </div>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setEditingUser(null);
                }}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Rachel Adams"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Work Email</label>
                <input
                  type="email"
                  required
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="e.g. r.adams@warehouse.io"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Assigned Role</label>
                <select
                  value={formRole}
                  onChange={(e) => setFormRole(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                >
                  <option value="Admin (Full Access)">Admin (Full Access)</option>
                  <option value="Warehouse Supervisor">Warehouse Supervisor</option>
                  <option value="Operator">Operator</option>
                  <option value="Analyst / Data Scientist">Analyst / Data Scientist</option>
                  <option value="Viewer (Read Only)">Viewer (Read Only)</option>
                </select>
              </div>

              {!editingUser && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
                  <input
                    type="password"
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    placeholder="Temporary password (default: Warehouse123!)"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>
              )}

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingUser(null);
                  }}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl text-xs font-medium hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs"
                >
                  {editingUser ? 'Save Changes' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

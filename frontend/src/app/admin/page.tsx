"use client";
import { useState, useEffect, useCallback } from "react";
import { ShieldCheck, UserPlus, Search, Trash2, KeyRound, Power, ChevronDown } from "lucide-react";
import { apiFetch, apiPost, apiPatch, apiDelete } from "@/lib/api";
import { Card, Badge } from "@/components/ui/Card";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
  quota: number;
  is_active: boolean;
  is_superuser: boolean;
  created_at: string;
}

const ROLE_OPTIONS = [
  { value: "sales_rep", label: "Sales Rep", color: "primary" },
  { value: "presales", label: "Presales", color: "accent" },
  { value: "sales_manager", label: "Sales Manager", color: "success" },
  { value: "superadmin", label: "Super Admin", color: "danger" },
];

const roleLabel = (role: string) => ROLE_OPTIONS.find((r) => r.value === role)?.label ?? role;
const roleColor = (role: string) => ROLE_OPTIONS.find((r) => r.value === role)?.color ?? "muted";

export default function AdminPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [showPasswordReset, setShowPasswordReset] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiFetch<AdminUser[]>("/admin/users");
      setUsers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat data user");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      setActionError(null);
      await apiPatch<AdminUser>(`/admin/users/${userId}`, { role: newRole });
      await fetchUsers();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Gagal mengubah role");
    }
  };

  const handleToggleActive = async (user: AdminUser) => {
    try {
      setActionError(null);
      await apiPatch<AdminUser>(`/admin/users/${user.id}`, { is_active: !user.is_active });
      await fetchUsers();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Gagal mengubah status");
    }
  };

  const handlePasswordReset = async (userId: string, newPassword: string) => {
    try {
      setActionError(null);
      await apiPatch(`/admin/users/${userId}`, { password: newPassword });
      setShowPasswordReset(null);
      await fetchUsers();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Gagal reset password");
    }
  };

  const handleDelete = async (userId: string) => {
    try {
      setActionError(null);
      await apiDelete(`/admin/users/${userId}`);
      setConfirmDelete(null);
      await fetchUsers();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Gagal menghapus user");
    }
  };

  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.role.toLowerCase().includes(search.toLowerCase())
  );

  const activeCount = users.filter((u) => u.is_active).length;
  const superadminCount = users.filter((u) => u.is_superuser || u.role === "superadmin").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ShieldCheck size={28} className="text-accent" />
            Admin Panel
          </h1>
          <p className="text-sm text-muted mt-1">
            Kelola user, role, dan hak akses — RBAC (Role-Based Access Control)
          </p>
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
        >
          <UserPlus size={18} />
          Tambah User
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <p className="text-xs text-muted uppercase tracking-wider">Total User</p>
          <p className="text-2xl font-bold text-white mt-2">{users.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted uppercase tracking-wider">Aktif</p>
          <p className="text-2xl font-bold text-success mt-2">{activeCount}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted uppercase tracking-wider">Nonaktif</p>
          <p className="text-2xl font-bold text-danger mt-2">{users.length - activeCount}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted uppercase tracking-wider">Super Admin</p>
          <p className="text-2xl font-bold text-accent mt-2">{superadminCount}</p>
        </Card>
      </div>

      {/* Error */}
      {actionError && (
        <div className="bg-danger/10 border border-danger/30 rounded-lg px-4 py-3 flex items-center justify-between">
          <p className="text-sm text-danger">{actionError}</p>
          <button onClick={() => setActionError(null)} className="text-danger hover:opacity-70 text-sm">✕</button>
        </div>
      )}
      {error && (
        <div className="bg-danger/10 border border-danger/30 rounded-lg px-4 py-3">
          <p className="text-sm text-danger">{error}</p>
        </div>
      )}

      {/* Search */}
      <div className="relative max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input
          type="text"
          placeholder="Cari nama, email, atau role..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-background border border-border rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-muted focus:outline-none focus:border-primary"
        />
      </div>

      {/* User Table */}
      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-background/50">
                <th className="text-left text-xs font-medium text-muted uppercase tracking-wider px-4 py-3">User</th>
                <th className="text-left text-xs font-medium text-muted uppercase tracking-wider px-4 py-3">Role</th>
                <th className="text-left text-xs font-medium text-muted uppercase tracking-wider px-4 py-3">Status</th>
                <th className="text-left text-xs font-medium text-muted uppercase tracking-wider px-4 py-3 hidden md:table-cell">Quota</th>
                <th className="text-left text-xs font-medium text-muted uppercase tracking-wider px-4 py-3 hidden lg:table-cell">Dibuat</th>
                <th className="text-right text-xs font-medium text-muted uppercase tracking-wider px-4 py-3">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center text-muted py-8 text-sm">Memuat...</td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center text-muted py-8 text-sm">Tidak ada user ditemukan</td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const isSelf = u.id === currentUser?.id;
                  return (
                    <tr key={u.id} className="border-b border-border/50 hover:bg-border/20 transition-colors">
                      {/* User */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0",
                            u.is_superuser || u.role === "superadmin" ? "bg-accent" : "bg-primary"
                          )}>
                            {u.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-white truncate">
                              {u.name}
                              {isSelf && <span className="text-xs text-muted ml-1">(Anda)</span>}
                            </p>
                            <p className="text-xs text-muted truncate">{u.email}</p>
                          </div>
                        </div>
                      </td>

                      {/* Role */}
                      <td className="px-4 py-3">
                        {isSelf && u.is_superuser ? (
                          <Badge label={roleLabel(u.role)} color={roleColor(u.role)} />
                        ) : (
                          <RoleSelector
                            currentRole={u.role}
                            onChange={(r) => handleRoleChange(u.id, r)}
                          />
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <span className={cn(
                          "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium",
                          u.is_active
                            ? "bg-success/20 text-success"
                            : "bg-danger/20 text-danger"
                        )}>
                          <span className={cn(
                            "w-1.5 h-1.5 rounded-full",
                            u.is_active ? "bg-success" : "bg-danger"
                          )} />
                          {u.is_active ? "Aktif" : "Nonaktif"}
                        </span>
                      </td>

                      {/* Quota */}
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className="text-sm text-muted">
                          {u.role === "sales_rep" || u.role === "sales_manager"
                            ? `Rp ${(u.quota / 1000000).toFixed(0)}M`
                            : "—"}
                        </span>
                      </td>

                      {/* Created */}
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <span className="text-xs text-muted">
                          {new Date(u.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {/* Toggle Active */}
                          <button
                            onClick={() => handleToggleActive(u)}
                            disabled={isSelf}
                            title={u.is_active ? "Nonaktifkan" : "Aktifkan"}
                            className={cn(
                              "p-1.5 rounded-lg transition-colors",
                              u.is_active ? "text-warning hover:bg-warning/10" : "text-success hover:bg-success/10",
                              isSelf && "opacity-30 cursor-not-allowed"
                            )}
                          >
                            <Power size={16} />
                          </button>

                          {/* Reset Password */}
                          <button
                            onClick={() => setShowPasswordReset(u.id)}
                            disabled={isSelf}
                            title="Reset Password"
                            className={cn(
                              "p-1.5 rounded-lg text-muted hover:text-primary hover:bg-primary/10 transition-colors",
                              isSelf && "opacity-30 cursor-not-allowed"
                            )}
                          >
                            <KeyRound size={16} />
                          </button>

                          {/* Delete */}
                          <button
                            onClick={() => setConfirmDelete(u.id)}
                            disabled={isSelf}
                            title="Hapus User"
                            className={cn(
                              "p-1.5 rounded-lg text-muted hover:text-danger hover:bg-danger/10 transition-colors",
                              isSelf && "opacity-30 cursor-not-allowed"
                            )}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Create User Modal */}
      {showCreateForm && (
        <CreateUserModal
          onClose={() => setShowCreateForm(false)}
          onCreated={async () => {
            setShowCreateForm(false);
            await fetchUsers();
          }}
        />
      )}

      {/* Password Reset Modal */}
      {showPasswordReset && (
        <PasswordResetModal
          userId={showPasswordReset}
          onClose={() => setShowPasswordReset(null)}
          onReset={handlePasswordReset}
        />
      )}

      {/* Delete Confirmation */}
      {confirmDelete && (
        <DeleteConfirmModal
          userName={users.find((u) => u.id === confirmDelete)?.name ?? ""}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => handleDelete(confirmDelete)}
        />
      )}
    </div>
  );
}

// ── Role Selector Dropdown ──
function RoleSelector({ currentRole, onChange }: { currentRole: string; onChange: (role: string) => void }) {
  const [open, setOpen] = useState(false);
  const current = ROLE_OPTIONS.find((r) => r.value === currentRole);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors",
          current?.color === "primary" && "bg-primary/20 text-primary",
          current?.color === "accent" && "bg-accent/20 text-accent",
          current?.color === "success" && "bg-success/20 text-success",
          current?.color === "danger" && "bg-danger/20 text-danger",
          "hover:opacity-80"
        )}
      >
        {current?.label ?? currentRole}
        <ChevronDown size={12} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full mt-1 left-0 z-50 bg-card border border-border rounded-lg shadow-xl overflow-hidden min-w-[160px]">
            {ROLE_OPTIONS.map((r) => (
              <button
                key={r.value}
                onClick={() => {
                  onChange(r.value);
                  setOpen(false);
                }}
                className={cn(
                  "w-full text-left px-3 py-2 text-sm hover:bg-border/50 transition-colors",
                  r.value === currentRole ? "text-white font-medium" : "text-muted"
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Create User Modal ──
function CreateUserModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("sales_rep");
  const [quota, setQuota] = useState(0);
  const [isSuperuser, setIsSuperuser] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await apiPost("/admin/users", {
        name,
        email,
        password,
        role,
        quota: role === "sales_rep" || role === "sales_manager" ? quota : 0,
        is_active: true,
        is_superuser: isSuperuser || role === "superadmin",
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal membuat user");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Tambah User Baru</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs text-muted uppercase tracking-wider">Nama</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary mt-1"
            />
          </div>
          <div>
            <label className="text-xs text-muted uppercase tracking-wider">Email</label>
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary mt-1"
            />
          </div>
          <div>
            <label className="text-xs text-muted uppercase tracking-wider">Password</label>
            <input
              required
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary mt-1"
            />
          </div>
          <div>
            <label className="text-xs text-muted uppercase tracking-wider">Role</label>
            <select
              value={role}
              onChange={(e) => {
                setRole(e.target.value);
                setIsSuperuser(e.target.value === "superadmin");
              }}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary mt-1"
            >
              {ROLE_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
          {(role === "sales_rep" || role === "sales_manager") && (
            <div>
              <label className="text-xs text-muted uppercase tracking-wider">Quota (Rp)</label>
              <input
                type="number"
                value={quota}
                onChange={(e) => setQuota(Number(e.target.value))}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary mt-1"
              />
            </div>
          )}
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-border/50 text-white px-4 py-2 rounded-lg text-sm hover:bg-border transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-primary text-white px-4 py-2 rounded-lg text-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {loading ? "Menyimpan..." : "Simpan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Password Reset Modal ──
function PasswordResetModal({
  userId,
  onClose,
  onReset,
}: {
  userId: string;
  onClose: () => void;
  onReset: (userId: string, password: string) => void;
}) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      setError("Password minimal 6 karakter");
      return;
    }
    if (password !== confirm) {
      setError("Password tidak cocok");
      return;
    }
    onReset(userId, password);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-sm p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Reset Password</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs text-muted uppercase tracking-wider">Password Baru</label>
            <input
              required
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary mt-1"
            />
          </div>
          <div>
            <label className="text-xs text-muted uppercase tracking-wider">Konfirmasi Password</label>
            <input
              required
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary mt-1"
            />
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-border/50 text-white px-4 py-2 rounded-lg text-sm hover:bg-border transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              className="flex-1 bg-primary text-white px-4 py-2 rounded-lg text-sm hover:bg-primary/90 transition-colors"
            >
              Reset
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Delete Confirmation Modal ──
function DeleteConfirmModal({
  userName,
  onCancel,
  onConfirm,
}: {
  userName: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-danger/20 flex items-center justify-center flex-shrink-0">
            <Trash2 size={20} className="text-danger" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Hapus User?</h2>
            <p className="text-sm text-muted">{userName}</p>
          </div>
        </div>
        <p className="text-sm text-muted mb-6">
          User akan dihapus permanen. Semua data terkait user ini juga akan terhapus. Tindakan ini tidak dapat dibatalkan.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 bg-border/50 text-white px-4 py-2 rounded-lg text-sm hover:bg-border transition-colors"
          >
            Batal
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 bg-danger text-white px-4 py-2 rounded-lg text-sm hover:bg-danger/90 transition-colors"
          >
            Hapus
          </button>
        </div>
      </div>
    </div>
  );
}

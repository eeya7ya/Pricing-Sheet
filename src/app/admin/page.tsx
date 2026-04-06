"use client";

import { useState, useEffect } from "react";
import {
  ShieldCheck,
  Users,
  Inbox,
  CheckCircle2,
  Clock,
  Plus,
  Loader2,
  AlertCircle,
  Factory,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AccountRequest {
  id: number;
  fullName: string;
  email: string;
  company: string;
  message: string;
  status: string;
  createdAt: string;
}

interface Manufacturer {
  id: number;
  name: string;
}

interface UserRecord {
  id: number;
  email: string;
  fullName: string;
  role: string;
  manufacturerId: number | null;
  createdAt: string;
}

interface CreateForm {
  requestId: number | null;
  fullName: string;
  email: string;
  password: string;
  role: "user" | "admin";
  manufacturerMode: "existing" | "new";
  manufacturerId: string;
  manufacturerName: string;
}

const EMPTY_FORM: CreateForm = {
  requestId: null,
  fullName: "",
  email: "",
  password: "",
  role: "user",
  manufacturerMode: "new",
  manufacturerId: "",
  manufacturerName: "",
};

export default function AdminPage() {
  const [tab, setTab] = useState<"requests" | "users">("requests");
  const [requests, setRequests] = useState<AccountRequest[]>([]);
  const [userList, setUserList] = useState<UserRecord[]>([]);
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([]);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CreateForm>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [reqRes, usrRes, mfgRes] = await Promise.all([
        fetch("/api/admin/requests"),
        fetch("/api/admin/users"),
        fetch("/api/manufacturers"),
      ]);
      if (reqRes.ok) setRequests(await reqRes.json());
      if (usrRes.ok) setUserList(await usrRes.json());
      if (mfgRes.ok) setManufacturers(await mfgRes.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openFormForRequest = (req: AccountRequest) => {
    setForm({
      ...EMPTY_FORM,
      requestId: req.id,
      fullName: req.fullName,
      email: req.email,
      manufacturerName: req.company || req.fullName,
    });
    setFormError(null);
    setFormSuccess(null);
    setShowForm(true);
  };

  const openBlankForm = () => {
    setForm(EMPTY_FORM);
    setFormError(null);
    setFormSuccess(null);
    setShowForm(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      const body: Record<string, any> = {
        email: form.email,
        password: form.password,
        fullName: form.fullName,
        role: form.role,
        requestId: form.requestId,
      };

      if (form.manufacturerMode === "existing" && form.manufacturerId) {
        body.manufacturerId = parseInt(form.manufacturerId);
      } else if (form.manufacturerMode === "new" && form.manufacturerName.trim()) {
        body.manufacturerName = form.manufacturerName.trim();
      }

      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error ?? "Failed to create account.");
        return;
      }
      setFormSuccess(
        `Account created for ${form.email}. Credentials email sent.`
      );
      setShowForm(false);
      await loadData();
    } finally {
      setSubmitting(false);
    }
  };

  const pendingRequests = requests.filter((r) => r.status === "pending");
  const approvedRequests = requests.filter((r) => r.status !== "pending");

  const mfgNameById = Object.fromEntries(
    manufacturers.map((m) => [m.id, m.name])
  );

  return (
    <div className="mx-auto max-w-screen-xl px-4 py-10 sm:px-6">
      {/* Header */}
      <div className="mb-8">
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-cyan-600">
          <ShieldCheck className="h-3.5 w-3.5" />
          Admin Panel
        </div>
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
          <button
            onClick={openBlankForm}
            className="flex items-center gap-2 rounded-xl bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-cyan-400 transition-colors shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Create Account
          </button>
        </div>
      </div>

      {/* Success banner */}
      {formSuccess && (
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-emerald-500" />
          <p className="text-sm text-emerald-700">{formSuccess}</p>
          <button onClick={() => setFormSuccess(null)} className="ml-auto text-emerald-400 hover:text-emerald-600">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="mb-6 flex gap-1 rounded-xl border border-gray-200 bg-gray-50 p-1 w-fit">
        {(["requests", "users"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
              tab === t
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            )}
          >
            {t === "requests" ? (
              <Inbox className="h-4 w-4" />
            ) : (
              <Users className="h-4 w-4" />
            )}
            {t === "requests" ? "Account Requests" : "Users"}
            {t === "requests" && pendingRequests.length > 0 && (
              <span className="ml-1 rounded-full bg-cyan-500 px-1.5 py-0.5 text-xs font-semibold text-white">
                {pendingRequests.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-gray-200 border-t-cyan-500" />
        </div>
      ) : tab === "requests" ? (
        /* Account Requests */
        <div className="space-y-4">
          {requests.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 py-16 text-center">
              <Inbox className="mb-3 h-8 w-8 text-gray-300" />
              <p className="text-sm text-gray-500">No account requests yet</p>
            </div>
          ) : (
            <>
              {pendingRequests.length > 0 && (
                <div>
                  <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-500">
                    Pending ({pendingRequests.length})
                  </h2>
                  <div className="space-y-3">
                    {pendingRequests.map((req) => (
                      <div
                        key={req.id}
                        className="flex flex-col gap-3 rounded-2xl border border-amber-100 bg-amber-50/50 p-5 sm:flex-row sm:items-start sm:justify-between"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Clock className="h-3.5 w-3.5 flex-shrink-0 text-amber-500" />
                            <span className="text-xs font-semibold text-amber-600 uppercase tracking-wide">Pending</span>
                          </div>
                          <p className="font-semibold text-gray-900">{req.fullName}</p>
                          <p className="text-sm text-gray-600">{req.email}</p>
                          {req.company && (
                            <p className="text-sm text-gray-500">{req.company}</p>
                          )}
                          {req.message && (
                            <p className="mt-1.5 text-sm text-gray-500 italic">"{req.message}"</p>
                          )}
                          <p className="mt-1 text-xs text-gray-400">
                            {new Date(req.createdAt).toLocaleString()}
                          </p>
                        </div>
                        <button
                          onClick={() => openFormForRequest(req)}
                          className="flex-shrink-0 flex items-center gap-2 rounded-xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-400 transition-colors"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          Create Account
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {approvedRequests.length > 0 && (
                <div className="mt-6">
                  <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-500">
                    Approved ({approvedRequests.length})
                  </h2>
                  <div className="space-y-2">
                    {approvedRequests.map((req) => (
                      <div
                        key={req.id}
                        className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white px-4 py-3"
                      >
                        <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-500" />
                        <span className="font-medium text-gray-800">{req.fullName}</span>
                        <span className="text-sm text-gray-500">{req.email}</span>
                        <span className="ml-auto text-xs text-gray-400">
                          {new Date(req.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        /* Users list */
        <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
          {userList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Users className="mb-3 h-8 w-8 text-gray-300" />
              <p className="text-sm text-gray-500">No users yet</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Email</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Role</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Manufacturer</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {userList.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3 font-medium text-gray-900">{u.fullName}</td>
                    <td className="px-5 py-3 text-gray-600">{u.email}</td>
                    <td className="px-5 py-3">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
                          u.role === "admin"
                            ? "bg-purple-50 text-purple-700"
                            : "bg-cyan-50 text-cyan-700"
                        )}
                      >
                        {u.role === "admin" ? (
                          <ShieldCheck className="mr-1 h-3 w-3" />
                        ) : (
                          <Users className="mr-1 h-3 w-3" />
                        )}
                        {u.role}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-600">
                      {u.manufacturerId ? (
                        <span className="flex items-center gap-1.5">
                          <Factory className="h-3.5 w-3.5 text-gray-400" />
                          {mfgNameById[u.manufacturerId] ?? `#${u.manufacturerId}`}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-gray-400 text-xs">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Create Account Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-gray-200 bg-white p-8 shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Create Account</h2>
              <button
                onClick={() => setShowForm(false)}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              {/* Full name */}
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Full Name</label>
                <input
                  type="text"
                  value={form.fullName}
                  onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                  required
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 focus:border-cyan-400 focus:bg-white focus:outline-none"
                />
              </div>

              {/* Email */}
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  required
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 focus:border-cyan-400 focus:bg-white focus:outline-none"
                />
              </div>

              {/* Password */}
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Password</label>
                <input
                  type="text"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  placeholder="Min 8 characters"
                  required
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 font-mono focus:border-cyan-400 focus:bg-white focus:outline-none"
                />
              </div>

              {/* Role */}
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Role</label>
                <div className="flex gap-3">
                  {(["user", "admin"] as const).map((r) => (
                    <label key={r} className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer">
                      <input
                        type="radio"
                        name="role"
                        value={r}
                        checked={form.role === r}
                        onChange={() => setForm((f) => ({ ...f, role: r }))}
                        className="accent-cyan-500"
                      />
                      {r === "admin" ? "Admin" : "User"}
                    </label>
                  ))}
                </div>
              </div>

              {/* Manufacturer — only relevant for user role */}
              {form.role === "user" && <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Manufacturer Access</label>
                <div className="mb-2 flex gap-3">
                  {(["new", "existing"] as const).map((mode) => (
                    <label key={mode} className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer">
                      <input
                        type="radio"
                        name="mfgMode"
                        value={mode}
                        checked={form.manufacturerMode === mode}
                        onChange={() => setForm((f) => ({ ...f, manufacturerMode: mode }))}
                        className="accent-cyan-500"
                      />
                      {mode === "new" ? "Create new manufacturer" : "Assign existing"}
                    </label>
                  ))}
                </div>

                {form.manufacturerMode === "new" ? (
                  <input
                    type="text"
                    placeholder="Manufacturer name"
                    value={form.manufacturerName}
                    onChange={(e) => setForm((f) => ({ ...f, manufacturerName: e.target.value }))}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 focus:border-cyan-400 focus:bg-white focus:outline-none"
                  />
                ) : (
                  <select
                    value={form.manufacturerId}
                    onChange={(e) => setForm((f) => ({ ...f, manufacturerId: e.target.value }))}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 focus:border-cyan-400 focus:bg-white focus:outline-none"
                  >
                    <option value="">— select manufacturer —</option>
                    {manufacturers.map((m) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                )}
              </div>}

              {formError && (
                <div className="flex items-start gap-2 rounded-xl border border-rose-100 bg-rose-50 px-3 py-2.5">
                  <AlertCircle className="h-4 w-4 flex-shrink-0 text-rose-500 mt-0.5" />
                  <p className="text-sm text-rose-600">{formError}</p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-cyan-500 py-2.5 text-sm font-semibold text-white hover:bg-cyan-400 disabled:opacity-60"
                >
                  {submitting ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Creating…</>
                  ) : (
                    "Create Account"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

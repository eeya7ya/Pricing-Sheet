"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Calculator, ShieldCheck, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

export default function SetupPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "", fullName: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Setup failed.");
        return;
      }
      setDone(true);
      setTimeout(() => router.push("/login"), 2000);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-64px)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-50 ring-2 ring-purple-200">
            <ShieldCheck className="h-7 w-7 text-purple-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Admin Setup</h1>
          <p className="mt-1 text-sm text-gray-500">Create your admin account to get started</p>
        </div>

        <div className="rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
          {done ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <CheckCircle2 className="h-10 w-10 text-emerald-500" />
              <p className="font-semibold text-gray-800">Admin account created!</p>
              <p className="text-sm text-gray-500">Redirecting to login…</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Full Name</label>
                <input
                  type="text"
                  required
                  value={form.fullName}
                  onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                  placeholder="Your name"
                  className={cn(
                    "w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm",
                    "focus:border-purple-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-400/20"
                  )}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Email</label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="you@gmail.com"
                  className={cn(
                    "w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm",
                    "focus:border-purple-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-400/20"
                  )}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Password</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  placeholder="Min 8 characters"
                  className={cn(
                    "w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm",
                    "focus:border-purple-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-400/20"
                  )}
                />
              </div>

              {error && (
                <div className="flex items-start gap-2 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3">
                  <AlertCircle className="h-4 w-4 flex-shrink-0 text-rose-500 mt-0.5" />
                  <p className="text-sm text-rose-600">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className={cn(
                  "flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold",
                  "bg-purple-600 text-white hover:bg-purple-500 transition-colors",
                  "disabled:opacity-60 disabled:cursor-not-allowed"
                )}
              >
                {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating…</> : "Create Admin Account"}
              </button>
            </form>
          )}
        </div>
        <p className="mt-4 text-center text-xs text-gray-400">
          This page only works once — when no admin exists yet.
        </p>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import {
  ShieldCheck,
  Activity,
  Trash2,
  ArrowRight,
  Lock,
} from "lucide-react";

/**
 * Single-tenant admin hub. The app now runs with exactly one account
 * (admin / admin123), so user management and account-request flows have
 * been removed. This page surfaces the remaining admin-only utilities.
 */
export default function AdminPage() {
  return (
    <div className="mx-auto max-w-screen-lg px-4 py-10 sm:px-6">
      {/* Header */}
      <div className="mb-10">
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-cyan-600">
          <ShieldCheck className="h-3.5 w-3.5" />
          Admin Panel
        </div>
        <h1 className="text-3xl font-bold text-gray-900">Admin Tools</h1>
        <p className="mt-2 text-sm text-gray-500">
          Single-tenant mode: all manufacturers and projects are owned by the
          built-in admin account.
        </p>
      </div>

      {/* Account notice */}
      <div className="mb-8 flex items-start gap-3 rounded-2xl border border-gray-200 bg-gray-50 px-5 py-4">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-white ring-1 ring-gray-200">
          <Lock className="h-4 w-4 text-gray-500" />
        </div>
        <div className="text-sm">
          <p className="font-semibold text-gray-800">Single admin account</p>
          <p className="mt-0.5 text-gray-500">
            Sign in with{" "}
            <code className="rounded bg-white px-1.5 py-0.5 font-mono text-xs text-gray-700 ring-1 ring-gray-200">
              admin
            </code>{" "}
            /{" "}
            <code className="rounded bg-white px-1.5 py-0.5 font-mono text-xs text-gray-700 ring-1 ring-gray-200">
              admin123
            </code>
            . No additional users can be created.
          </p>
        </div>
      </div>

      {/* Tool cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/admin/logs"
          className="group flex items-center justify-between rounded-2xl border border-gray-200 bg-white p-5 transition-all hover:border-cyan-200 hover:shadow-lg hover:shadow-gray-200"
        >
          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-50 ring-1 ring-cyan-200">
              <Activity className="h-5 w-5 text-cyan-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-900">Activity Logs</p>
              <p className="text-xs text-gray-500">
                Review recent admin actions
              </p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-gray-300 transition-colors group-hover:text-cyan-600" />
        </Link>

        <Link
          href="/trash"
          className="group flex items-center justify-between rounded-2xl border border-gray-200 bg-white p-5 transition-all hover:border-cyan-200 hover:shadow-lg hover:shadow-gray-200"
        >
          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-50 ring-1 ring-rose-200">
              <Trash2 className="h-5 w-5 text-rose-500" />
            </div>
            <div>
              <p className="font-semibold text-gray-900">Trash Bin</p>
              <p className="text-xs text-gray-500">
                Restore or permanently delete removed items
              </p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-gray-300 transition-colors group-hover:text-cyan-600" />
        </Link>
      </div>
    </div>
  );
}

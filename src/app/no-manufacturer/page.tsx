"use client";

import { Factory, MailCheck, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";

export default function NoManufacturerPage() {
  const router = useRouter();

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md rounded-3xl border border-gray-200 bg-white p-10 shadow-sm text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 ring-1 ring-amber-200">
          <Factory className="h-8 w-8 text-amber-500" />
        </div>
        <h1 className="mb-2 text-2xl font-bold text-gray-900">
          No Manufacturer Assigned
        </h1>
        <p className="mb-6 text-sm text-gray-500">
          Your account has been created but hasn&apos;t been linked to a
          manufacturer yet. Please contact the administrator to get access.
        </p>
        <div className="mb-8 flex items-start gap-3 rounded-xl border border-cyan-100 bg-cyan-50 px-4 py-3 text-left">
          <MailCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-cyan-600" />
          <p className="text-sm text-cyan-700">
            The admin will assign you to a manufacturer. You&apos;ll be able to
            log back in once your access is configured.
          </p>
        </div>
        <button
          onClick={handleLogout}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </div>
  );
}

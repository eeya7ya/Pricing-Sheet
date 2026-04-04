"use client";

import { useState } from "react";
import { UserPlus, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface FormState {
  fullName: string;
  email: string;
  company: string;
  message: string;
}

const EMPTY: FormState = { fullName: "", email: "", company: "", message: "" };

export default function RequestAccessPage() {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [emailWarning, setEmailWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const set = (key: keyof FormState) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.fullName.trim() || !form.email.trim()) {
      setError("Please fill in your full name and email address.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/request-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
      } else {
        setSuccess(true);
        setEmailWarning(data.emailWarning ?? null);
        setForm(EMPTY);
      }
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-screen-xl px-4 py-10 sm:px-6">
      {/* Page header */}
      <div className="mb-10">
        <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-cyan-600">
          <UserPlus className="h-3.5 w-3.5" />
          Account Access
        </div>
        <h1 className="text-4xl font-bold text-gray-900 tracking-tight">
          Request an Account
        </h1>
        <p className="mt-2 text-sm text-gray-500 max-w-lg">
          Fill out the form below to request access to Smart Pricing Sheet. You
          will receive your login credentials by email once your request is
          reviewed.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Form card */}
        <div className="rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
          {success ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className={cn("mb-5 flex h-16 w-16 items-center justify-center rounded-2xl ring-1", emailWarning ? "bg-amber-50 ring-amber-200" : "bg-emerald-50 ring-emerald-200")}>
                {emailWarning ? <AlertCircle className="h-8 w-8 text-amber-500" /> : <CheckCircle2 className="h-8 w-8 text-emerald-500" />}
              </div>
              <h2 className="mb-2 text-xl font-semibold text-gray-800">
                Request Submitted!
              </h2>
              {emailWarning ? (
                <p className="mb-6 text-sm text-amber-600 max-w-xs bg-amber-50 rounded-xl px-4 py-3 border border-amber-200">
                  {emailWarning}
                </p>
              ) : (
              <p className="mb-6 text-sm text-gray-500 max-w-xs">
                Your request has been received. You will get your account
                credentials by email shortly.
              </p>
              )}
              <button
                type="button"
                onClick={() => { setSuccess(false); setEmailWarning(null); }}
                className="rounded-xl border border-gray-200 px-5 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Submit another request
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              {/* Full Name */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Your full name"
                  value={form.fullName}
                  onChange={set("fullName")}
                  required
                  className={cn(
                    "w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-800 placeholder-gray-400",
                    "focus:border-cyan-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-400/20 transition-colors"
                  )}
                />
              </div>

              {/* Email */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Email Address <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  placeholder="you@company.com"
                  value={form.email}
                  onChange={set("email")}
                  required
                  className={cn(
                    "w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-800 placeholder-gray-400",
                    "focus:border-cyan-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-400/20 transition-colors"
                  )}
                />
              </div>

              {/* Company */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Company / Organization
                  <span className="ml-1 text-xs font-normal text-gray-400">
                    (optional)
                  </span>
                </label>
                <input
                  type="text"
                  placeholder="Your company name"
                  value={form.company}
                  onChange={set("company")}
                  className={cn(
                    "w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-800 placeholder-gray-400",
                    "focus:border-cyan-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-400/20 transition-colors"
                  )}
                />
              </div>

              {/* Message */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Message
                  <span className="ml-1 text-xs font-normal text-gray-400">
                    (optional)
                  </span>
                </label>
                <textarea
                  rows={4}
                  placeholder="Tell us a bit about how you plan to use the pricing sheet…"
                  value={form.message}
                  onChange={set("message")}
                  className={cn(
                    "w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-800 placeholder-gray-400",
                    "focus:border-cyan-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-400/20 transition-colors"
                  )}
                />
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-start gap-2 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3">
                  <AlertCircle className="h-4 w-4 flex-shrink-0 text-rose-500 mt-0.5" />
                  <p className="text-sm text-rose-600">{error}</p>
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={submitting}
                className={cn(
                  "flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold",
                  "bg-cyan-500 text-white transition-all hover:bg-cyan-400",
                  "shadow-sm focus:outline-none focus:ring-2 focus:ring-cyan-400/40",
                  "disabled:opacity-60 disabled:cursor-not-allowed"
                )}
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Submitting…
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4" />
                    Submit Request
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        {/* Info panel */}
        <div className="flex flex-col gap-6">
          <div className="rounded-3xl border border-gray-200 bg-gray-50 p-8">
            <h3 className="mb-4 text-base font-semibold text-gray-800">
              How it works
            </h3>
            <ol className="space-y-4">
              {[
                {
                  step: "1",
                  title: "Submit your request",
                  desc: "Fill in the form with your details and submit. Your request is logged instantly.",
                },
                {
                  step: "2",
                  title: "Admin review",
                  desc: "The admin receives a notification email and reviews your request.",
                },
                {
                  step: "3",
                  title: "Receive credentials",
                  desc: "You will receive your username and password by email, along with access to your dedicated pricing workspace.",
                },
              ].map(({ step, title, desc }) => (
                <li key={step} className="flex gap-4">
                  <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-cyan-100 text-xs font-bold text-cyan-600 ring-1 ring-cyan-200">
                    {step}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-700">
                      {title}
                    </p>
                    <p className="text-sm text-gray-500">{desc}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <div className="rounded-3xl border border-cyan-100 bg-cyan-50 p-6">
            <p className="text-sm text-cyan-700">
              <span className="font-semibold">Already have an account?</span>{" "}
              Go to the{" "}
              <a
                href="/"
                className="underline underline-offset-2 hover:text-cyan-900 transition-colors"
              >
                Dashboard
              </a>{" "}
              to get started with your pricing sheets.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

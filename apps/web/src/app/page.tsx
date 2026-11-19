'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../context/auth-context';
import Link from 'next/link';
import { ArrowRight, Sparkles, Send, Kanban, Users, ShieldCheck } from 'lucide-react';

export default function HomePage() {
  const { user, loading, loginDemo } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.push('/contacts');
    }
  }, [user, loading, router]);

  const handleDemo = async () => {
    try {
      await loginDemo();
      router.push('/contacts');
    } catch (err: any) {
      alert(err.message || 'Demo login failed. Please ensure backend is running.');
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100 flex flex-col justify-between">
      {/* Top Navbar */}
      <header className="px-6 py-4 flex items-center justify-between border-b border-slate-200 bg-white/80 backdrop-blur sticky top-0 z-10">
        <div className="flex items-center space-x-2">
          <div className="h-9 w-9 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold shadow-md shadow-indigo-200">
            RF
          </div>
          <span className="text-xl font-bold tracking-tight text-slate-900">ReachFlow</span>
          <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-semibold border border-indigo-200">
            Outbound CRM
          </span>
        </div>
        <div className="flex items-center space-x-3">
          <Link
            href="/login"
            className="text-sm font-medium text-slate-600 hover:text-slate-900 px-3 py-2 rounded-md hover:bg-slate-100 transition"
          >
            Sign In
          </Link>
          <Link
            href="/signup"
            className="text-sm font-medium bg-slate-900 text-white px-4 py-2 rounded-lg hover:bg-slate-800 transition shadow-sm"
          >
            Create Workspace
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-5xl mx-auto px-6 py-16 text-center flex flex-col items-center">
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-semibold mb-6">
          <Sparkles className="h-3.5 w-3.5" />
          <span>Production-Grade B2B Outbound Engine</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold text-slate-900 tracking-tight leading-tight max-w-3xl">
          Automate Outbound Sequences, Close High-Value Deals.
        </h1>

        <p className="mt-5 text-lg text-slate-600 max-w-2xl leading-relaxed">
          ReachFlow is a multi-tenant sales engagement CRM. Personalize multi-step email drips, track replies automatically, and drive pipeline on a real-time Kanban board.
        </p>

        {/* CTA Group */}
        <div className="mt-8 flex flex-col sm:flex-row items-center gap-4">
          <button
            onClick={handleDemo}
            className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-6 py-3.5 rounded-xl shadow-lg shadow-indigo-200 hover:shadow-indigo-300 transition text-base"
          >
            <span>Try Demo Workspace</span>
            <ArrowRight className="h-4 w-4" />
          </button>

          <Link
            href="/login"
            className="w-full sm:w-auto inline-flex items-center justify-center bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold px-6 py-3.5 rounded-xl shadow-sm transition text-base"
          >
            Sign in with Credentials
          </Link>
        </div>

        {/* Feature Highlights Grid */}
        <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-6 text-left w-full">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="h-10 w-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center mb-4">
              <Users className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-slate-900 text-base">Contact Management & Tags</h3>
            <p className="mt-1 text-sm text-slate-500">
              Workspace-scoped contacts with deduplicated emails, custom tags, and cursor-based pagination.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="h-10 w-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center mb-4">
              <Send className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-slate-900 text-base">Idempotent Sequence Drips</h3>
            <p className="mt-1 text-sm text-slate-500">
              Automated multi-step outbound engine with simulated reply stoppage and zero duplicate sends.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="h-10 w-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center mb-4">
              <Kanban className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-slate-900 text-base">Drag & Drop Kanban Pipeline</h3>
            <p className="mt-1 text-sm text-slate-500">
              Visual deal board across 6 stages from Lead to Won with real-time value aggregations.
            </p>
          </div>
        </div>

        {/* Zero Trust Callout */}
        <div className="mt-10 inline-flex items-center space-x-2 text-xs text-slate-500 bg-slate-100 px-4 py-2 rounded-full">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          <span>Strict Zero-Trust Tenant Isolation with Rotating Refresh Token Security</span>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 py-6 px-6 text-center text-xs text-slate-400">
        ReachFlow Outbound Sales CRM — Portfolio Edition for SDE Intern (Full Stack)
      </footer>
    </div>
  );
}

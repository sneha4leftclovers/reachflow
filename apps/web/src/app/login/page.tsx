'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/auth-context';
import Link from 'next/link';
import { Sparkles, ArrowRight, Lock, Mail, AlertCircle } from 'lucide-react';

export default function LoginPage() {
  const { login, loginDemo } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await login(email, password);
      router.push('/contacts');
    } catch (err: any) {
      setError(err.message || 'Invalid credentials. Please verify your email and password.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemo = async () => {
    setError(null);
    setDemoLoading(true);
    try {
      await loginDemo();
      router.push('/contacts');
    } catch (err: any) {
      setError(err.message || 'Demo workspace login failed. Please ensure the database is seeded.');
    } finally {
      setDemoLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Logo / Header */}
        <div className="text-center mb-8">
          <div className="inline-flex h-12 w-12 bg-indigo-600 rounded-xl items-center justify-center text-white font-bold text-xl shadow-lg shadow-indigo-200 mb-3">
            RF
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Sign in to ReachFlow</h2>
          <p className="mt-1 text-sm text-slate-500">Access your outbound workspace and active sequences</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
          {/* 1-Click Demo Callout */}
          <div className="mb-6 bg-gradient-to-r from-indigo-50 to-indigo-100/60 border border-indigo-200 rounded-xl p-4">
            <div className="flex items-start justify-between">
              <div>
                <span className="inline-flex items-center text-xs font-bold text-indigo-700 uppercase tracking-wider">
                  <Sparkles className="h-3 w-3 mr-1" /> Recruiter & Demo Mode
                </span>
                <p className="mt-1 text-xs text-slate-600">
                  Pre-seeded with realistic contacts, active sequences, and Kanban deals.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleDemo}
              disabled={demoLoading || loading}
              className="mt-3 w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-3 rounded-lg text-xs flex items-center justify-center space-x-1.5 transition disabled:opacity-60 shadow-sm"
            >
              <span>{demoLoading ? 'Loading Demo Workspace...' : 'Try Demo Workspace (1-Click)'}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-3 text-slate-400 font-medium">Or continue with credentials</span>
            </div>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="mb-4 bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-start space-x-2 text-rose-700 text-sm">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="alex@company.com"
                  className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || demoLoading}
              className="w-full mt-2 bg-slate-900 hover:bg-slate-800 text-white font-medium py-2.5 rounded-lg text-sm transition disabled:opacity-60 shadow-sm"
            >
              {loading ? 'Authenticating...' : 'Sign In'}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-slate-500">
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="text-indigo-600 hover:text-indigo-700 font-semibold">
              Create a workspace
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

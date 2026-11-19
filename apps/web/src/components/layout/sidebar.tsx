'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth, Workspace } from '../../context/auth-context';
import { Users, Kanban, Send, LogOut, ChevronDown, Check, Building2 } from 'lucide-react';
import { useState } from 'react';

export function Sidebar() {
  const pathname = usePathname();
  const { user, workspaces, activeWorkspace, switchWorkspace, logout } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const navigation = [
    { name: 'Contacts', href: '/contacts', icon: Users },
    { name: 'Deals (Kanban)', href: '/deals', icon: Kanban },
    { name: 'Sequences', href: '/sequences', icon: Send },
  ];

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col justify-between border-r border-slate-800 flex-shrink-0 select-none">
      {/* Top: Logo & Workspace Switcher */}
      <div>
        <div className="p-4 border-b border-slate-800 flex items-center space-x-2.5">
          <div className="h-8 w-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-sm shadow-md shadow-indigo-500/20">
            RF
          </div>
          <div>
            <div className="font-bold text-white text-sm leading-tight tracking-tight">ReachFlow</div>
            <div className="text-[10px] text-indigo-400 font-medium">B2B Outbound CRM</div>
          </div>
        </div>

        {/* Workspace Switcher */}
        <div className="p-3 border-b border-slate-800 relative">
          <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider px-2 mb-1">
            Active Workspace
          </div>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-750 border border-slate-700/60 transition text-left text-xs font-semibold text-white"
          >
            <div className="flex items-center space-x-2 truncate">
              <Building2 className="h-4 w-4 text-indigo-400 flex-shrink-0" />
              <span className="truncate">{activeWorkspace?.name || 'Select Workspace'}</span>
            </div>
            <div className="flex items-center space-x-1 flex-shrink-0 text-slate-400">
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-300 font-mono">
                {activeWorkspace?.role || 'MEMBER'}
              </span>
              <ChevronDown className="h-3.5 w-3.5" />
            </div>
          </button>

          {dropdownOpen && (
            <div className="absolute left-3 right-3 top-16 bg-slate-800 border border-slate-700 rounded-xl shadow-xl z-50 py-1 overflow-hidden">
              <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-700">
                Switch Workspace
              </div>
              {workspaces.map((ws) => (
                <button
                  key={ws.id}
                  onClick={() => {
                    switchWorkspace(ws);
                    setDropdownOpen(false);
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 text-xs text-slate-200 hover:bg-indigo-600 hover:text-white transition text-left"
                >
                  <span className="truncate">{ws.name}</span>
                  {ws.id === activeWorkspace?.id && <Check className="h-3.5 w-3.5 text-emerald-400" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Nav Links */}
        <nav className="p-3 space-y-1">
          <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider px-2 py-1">
            Navigation
          </div>
          {navigation.map((item) => {
            const isActive = pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center space-x-2.5 px-3 py-2 rounded-lg text-xs font-medium transition ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/80'
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Bottom: User Profile & Logout */}
      <div className="p-3 border-t border-slate-800">
        <div className="flex items-center justify-between px-2 py-2 rounded-lg bg-slate-800/60 border border-slate-800">
          <div className="flex items-center space-x-2 truncate">
            <div className="h-7 w-7 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center font-bold text-xs flex-shrink-0">
              {user?.firstName?.[0] || 'U'}
            </div>
            <div className="truncate">
              <div className="text-xs font-semibold text-white truncate">
                {user?.firstName} {user?.lastName}
              </div>
              <div className="text-[10px] text-slate-400 truncate">{user?.email}</div>
            </div>
          </div>
          <button
            onClick={() => logout()}
            title="Log out"
            className="text-slate-400 hover:text-rose-400 p-1.5 rounded-md hover:bg-slate-700/50 transition flex-shrink-0"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}

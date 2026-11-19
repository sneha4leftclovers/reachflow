'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../../context/auth-context';
import { apiRequest } from '../../../lib/api';
import { Plus, Search, Tag as TagIcon, Trash2, Mail, Phone, Building, User, AlertCircle, RefreshCw } from 'lucide-react';

interface Contact {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  company?: string | null;
  title?: string | null;
  phone?: string | null;
  status: string;
  tags: string[];
  createdAt: string;
}

export default function ContactsPage() {
  const { accessToken, activeWorkspace } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Pagination
  const [search, setSearch] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  // Create Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [formEmail, setFormEmail] = useState('');
  const [formFirstName, setFormFirstName] = useState('');
  const [formLastName, setFormLastName] = useState('');
  const [formCompany, setFormCompany] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formTags, setFormTags] = useState('');
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchContacts = useCallback(async (isLoadMore = false, cursor?: string | null) => {
    if (!activeWorkspace || !accessToken) return;

    if (isLoadMore) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set('limit', '25');
      if (search.trim()) params.set('search', search.trim());
      if (selectedTag) params.set('tag', selectedTag);
      if (cursor) params.set('cursor', cursor);

      const res = await apiRequest<Contact[]>(`/contacts?${params.toString()}`, {
        token: accessToken,
        workspaceId: activeWorkspace.id,
      });

      if (isLoadMore) {
        setContacts((prev) => [...prev, ...res]);
      } else {
        setContacts(res);
      }
      // Note: meta cursor will be set if available
      setNextCursor(res.length >= 25 ? res[res.length - 1].id : null);
    } catch (err: any) {
      setError(err.message || 'Failed to load contacts');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [activeWorkspace, accessToken, search, selectedTag]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchContacts();
    }, 200);
    return () => clearTimeout(timer);
  }, [fetchContacts]);

  const handleCreateContact = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSubmitting(true);

    try {
      const tagsArray = formTags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      await apiRequest('/contacts', {
        method: 'POST',
        token: accessToken,
        workspaceId: activeWorkspace?.id,
        body: JSON.stringify({
          email: formEmail,
          firstName: formFirstName,
          lastName: formLastName,
          company: formCompany || undefined,
          title: formTitle || undefined,
          phone: formPhone || undefined,
          tags: tagsArray,
        }),
      });

      // Reset form and refresh list
      setModalOpen(false);
      setFormEmail('');
      setFormFirstName('');
      setFormLastName('');
      setFormCompany('');
      setFormTitle('');
      setFormPhone('');
      setFormTags('');
      fetchContacts();
    } catch (err: any) {
      setFormError(err.message || 'Failed to create contact');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDeleteContact = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete ${name}?`)) return;

    try {
      await apiRequest(`/contacts/${id}`, {
        method: 'DELETE',
        token: accessToken,
        workspaceId: activeWorkspace?.id,
      });
      setContacts((prev) => prev.filter((c) => c.id !== id));
    } catch (err: any) {
      alert(err.message || 'Failed to delete contact');
    }
  };

  // Collect all unique tags from contacts
  const allTags = Array.from(new Set(contacts.flatMap((c) => c.tags)));

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Contacts & Accounts</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage prospects and track engagement across {activeWorkspace?.name}
          </p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center space-x-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-sm transition"
        >
          <Plus className="h-4 w-4" />
          <span>New Contact</span>
        </button>
      </div>

      {/* Filter / Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, company..."
            className="w-full pl-9 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Tag Filters */}
        <div className="flex items-center space-x-1.5 overflow-x-auto w-full sm:w-auto">
          <span className="text-[10px] uppercase font-bold text-slate-400 mr-1 flex items-center">
            <TagIcon className="h-3 w-3 mr-1" /> Tags:
          </span>
          <button
            onClick={() => setSelectedTag(null)}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
              selectedTag === null
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All
          </button>
          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                selectedTag === tag
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-center justify-between text-rose-700 text-xs">
          <div className="flex items-center space-x-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => fetchContacts()}
            className="flex items-center space-x-1 text-xs font-semibold underline"
          >
            <RefreshCw className="h-3 w-3" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* Table Container */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          /* Loading State: Skeletons */
          <div className="p-6 space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center space-x-4 animate-pulse">
                <div className="h-8 w-8 bg-slate-200 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-slate-200 rounded w-1/4" />
                  <div className="h-3 bg-slate-100 rounded w-1/3" />
                </div>
                <div className="h-4 bg-slate-100 rounded w-20" />
              </div>
            ))}
          </div>
        ) : contacts.length === 0 ? (
          /* Empty State */
          <div className="py-16 text-center px-4">
            <div className="mx-auto h-12 w-12 text-slate-300 bg-slate-100 rounded-full flex items-center justify-center mb-3">
              <User className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-semibold text-slate-800">No contacts found</h3>
            <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
              {search || selectedTag
                ? 'No contacts match your current search or tag filters.'
                : 'Get started by creating your first sales prospect in this workspace.'}
            </p>
            {!search && !selectedTag && (
              <button
                onClick={() => setModalOpen(true)}
                className="mt-4 inline-flex items-center space-x-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-2 rounded-lg text-xs font-semibold shadow-sm transition"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Contact</span>
              </button>
            )}
          </div>
        ) : (
          /* Contacts Table */
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3">Company & Title</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Tags</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {contacts.map((contact) => (
                  <tr key={contact.id} className="hover:bg-slate-50/80 transition">
                    <td className="px-4 py-3.5">
                      <div className="flex items-center space-x-3">
                        <div className="h-8 w-8 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xs flex-shrink-0">
                          {contact.firstName[0]}
                          {contact.lastName[0]}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900">
                            {contact.firstName} {contact.lastName}
                          </div>
                          <div className="text-slate-400 flex items-center space-x-1 mt-0.5">
                            <Mail className="h-3 w-3" />
                            <span>{contact.email}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="font-medium text-slate-800">{contact.company || '—'}</div>
                      <div className="text-slate-400 text-[11px]">{contact.title || '—'}</div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {contact.status}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex flex-wrap gap-1">
                        {contact.tags.length > 0
                          ? contact.tags.map((t) => (
                              <span
                                key={t}
                                className="px-1.5 py-0.5 bg-slate-100 text-slate-600 border border-slate-200 rounded text-[10px]"
                              >
                                {t}
                              </span>
                            ))
                          : '—'}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-slate-400 text-[11px]">
                      {new Date(contact.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <button
                        onClick={() =>
                          handleDeleteContact(contact.id, `${contact.firstName} ${contact.lastName}`)
                        }
                        className="text-slate-400 hover:text-rose-600 p-1 rounded transition"
                        title="Delete Contact"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Cursor Pagination Button */}
        {nextCursor && !loading && (
          <div className="p-4 border-t border-slate-100 text-center bg-slate-50">
            <button
              onClick={() => fetchContacts(true, nextCursor)}
              disabled={loadingMore}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 transition disabled:opacity-50"
            >
              {loadingMore ? 'Loading more contacts...' : 'Load More Contacts ↓'}
            </button>
          </div>
        )}
      </div>

      {/* New Contact Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Add New Prospect</h3>
              <button
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="mt-4 bg-rose-50 border border-rose-200 rounded-xl p-3 text-rose-700 text-xs">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateContact} className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">
                    First Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formFirstName}
                    onChange={(e) => setFormFirstName(e.target.value)}
                    placeholder="Alex"
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">
                    Last Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formLastName}
                    onChange={(e) => setFormLastName(e.target.value)}
                    placeholder="Morgan"
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="alex.morgan@enterprise.io"
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">
                    Company
                  </label>
                  <input
                    type="text"
                    value={formCompany}
                    onChange={(e) => setFormCompany(e.target.value)}
                    placeholder="Innovate Tech"
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">
                    Job Title
                  </label>
                  <input
                    type="text"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="VP of Growth"
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">
                  Phone (Optional)
                </label>
                <input
                  type="text"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  placeholder="+1 (555) 000-0000"
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">
                  Tags (comma separated)
                </label>
                <input
                  type="text"
                  value={formTags}
                  onChange={(e) => setFormTags(e.target.value)}
                  placeholder="Enterprise, Outbound, Q4 Lead"
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-3.5 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-xs font-semibold shadow-sm transition disabled:opacity-50"
                >
                  {formSubmitting ? 'Saving...' : 'Create Contact'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

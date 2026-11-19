'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../../context/auth-context';
import { apiRequest } from '../../../lib/api';
import { Plus, DollarSign, Building, User, AlertCircle, RefreshCw, GripVertical } from 'lucide-react';
import { DealStage } from '@reachflow/shared';

interface Deal {
  id: string;
  title: string;
  value: number;
  stage: DealStage;
  position: number;
  company?: string | null;
  contact?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
  createdAt: string;
}

interface ContactOption {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

const STAGES: { stage: DealStage; label: string; color: string }[] = [
  { stage: DealStage.LEAD, label: 'Lead', color: 'border-t-slate-400 bg-slate-50/50' },
  { stage: DealStage.QUALIFIED, label: 'Qualified', color: 'border-t-blue-500 bg-blue-50/30' },
  { stage: DealStage.DEMO, label: 'Demo Scheduled', color: 'border-t-indigo-500 bg-indigo-50/30' },
  { stage: DealStage.NEGOTIATION, label: 'Negotiation', color: 'border-t-amber-500 bg-amber-50/30' },
  { stage: DealStage.WON, label: 'Closed Won', color: 'border-t-emerald-500 bg-emerald-50/30' },
  { stage: DealStage.LOST, label: 'Closed Lost', color: 'border-t-rose-400 bg-rose-50/30' },
];

export default function DealsPage() {
  const { accessToken, activeWorkspace } = useAuth();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [contacts, setContacts] = useState<ContactOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dragging state
  const [draggedDealId, setDraggedDealId] = useState<string | null>(null);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formValue, setFormValue] = useState('');
  const [formStage, setFormStage] = useState<DealStage>(DealStage.LEAD);
  const [formCompany, setFormCompany] = useState('');
  const [formContactId, setFormContactId] = useState('');
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!activeWorkspace || !accessToken) return;
    setLoading(true);
    setError(null);

    try {
      const [dealsRes, contactsRes] = await Promise.all([
        apiRequest<Deal[]>('/deals', {
          token: accessToken,
          workspaceId: activeWorkspace.id,
        }),
        apiRequest<ContactOption[]>('/contacts?limit=100', {
          token: accessToken,
          workspaceId: activeWorkspace.id,
        }),
      ]);

      setDeals(dealsRes);
      setContacts(contactsRes);
    } catch (err: any) {
      setError(err.message || 'Failed to load pipeline deals');
    } finally {
      setLoading(false);
    }
  }, [activeWorkspace, accessToken]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle Drag & Drop
  const handleDragStart = (e: React.DragEvent, dealId: string) => {
    setDraggedDealId(dealId);
    e.dataTransfer.setData('text/plain', dealId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent, targetStage: DealStage) => {
    e.preventDefault();
    const dealId = draggedDealId || e.dataTransfer.getData('text/plain');
    if (!dealId) return;

    const currentDeal = deals.find((d) => d.id === dealId);
    if (!currentDeal || currentDeal.stage === targetStage) {
      setDraggedDealId(null);
      return;
    }

    // Optimistic Update
    const previousDeals = [...deals];
    setDeals((prev) =>
      prev.map((d) => (d.id === dealId ? { ...d, stage: targetStage } : d))
    );
    setDraggedDealId(null);

    try {
      await apiRequest(`/deals/${dealId}/stage`, {
        method: 'PATCH',
        token: accessToken,
        workspaceId: activeWorkspace?.id,
        body: JSON.stringify({ stage: targetStage }),
      });
    } catch (err: any) {
      // Rollback on failure
      setDeals(previousDeals);
      alert(err.message || 'Failed to update deal stage');
    }
  };

  const handleCreateDeal = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSubmitting(true);

    try {
      const created = await apiRequest<Deal>('/deals', {
        method: 'POST',
        token: accessToken,
        workspaceId: activeWorkspace?.id,
        body: JSON.stringify({
          title: formTitle,
          value: Number(formValue) || 0,
          stage: formStage,
          company: formCompany || undefined,
          contactId: formContactId || undefined,
        }),
      });

      setDeals((prev) => [...prev, created]);
      setModalOpen(false);
      setFormTitle('');
      setFormValue('');
      setFormCompany('');
      setFormContactId('');
      setFormStage(DealStage.LEAD);
    } catch (err: any) {
      setFormError(err.message || 'Failed to create deal');
    } finally {
      setFormSubmitting(false);
    }
  };

  const totalPipelineValue = deals
    .filter((d) => d.stage !== DealStage.LOST)
    .reduce((sum, d) => sum + d.value, 0);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Deals Pipeline</h1>
            <span className="text-xs bg-emerald-50 text-emerald-700 font-semibold px-2.5 py-1 rounded-full border border-emerald-200">
              Active Pipeline: ${totalPipelineValue.toLocaleString()}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Drag and drop deals across stages to manage sales conversions
          </p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center space-x-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-sm transition"
        >
          <Plus className="h-4 w-4" />
          <span>New Deal</span>
        </button>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-center justify-between text-rose-700 text-xs">
          <div className="flex items-center space-x-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => fetchData()} className="flex items-center space-x-1 text-xs font-semibold underline">
            <RefreshCw className="h-3 w-3" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* Kanban Board Container */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-6 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 h-96 animate-pulse">
              <div className="h-4 bg-slate-200 rounded w-1/2 mb-4" />
              <div className="space-y-3">
                <div className="h-20 bg-slate-100 rounded-lg" />
                <div className="h-20 bg-slate-100 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-4 items-start">
          {STAGES.map(({ stage, label, color }) => {
            const columnDeals = deals.filter((d) => d.stage === stage);
            const columnValue = columnDeals.reduce((sum, d) => sum + d.value, 0);

            return (
              <div
                key={stage}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, stage)}
                className={`bg-white rounded-xl border border-slate-200 border-t-4 shadow-sm p-3 min-h-[500px] flex flex-col ${color}`}
              >
                {/* Column Header */}
                <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-100">
                  <div>
                    <h3 className="font-bold text-xs text-slate-800">{label}</h3>
                    <div className="text-[10px] text-slate-500 font-medium">
                      ${columnValue.toLocaleString()}
                    </div>
                  </div>
                  <span className="text-[10px] bg-white border border-slate-200 px-2 py-0.5 rounded-full font-bold text-slate-600">
                    {columnDeals.length}
                  </span>
                </div>

                {/* Cards List */}
                <div className="space-y-2.5 flex-1">
                  {columnDeals.length === 0 ? (
                    <div className="h-32 border-2 border-dashed border-slate-200 rounded-lg flex items-center justify-center text-[11px] text-slate-400">
                      Drop deals here
                    </div>
                  ) : (
                    columnDeals.map((deal) => (
                      <div
                        key={deal.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, deal.id)}
                        className={`bg-white p-3 rounded-lg border border-slate-200 shadow-sm hover:shadow-md transition cursor-grab active:cursor-grabbing select-none ${
                          draggedDealId === deal.id ? 'opacity-40 border-indigo-400' : ''
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <h4 className="font-semibold text-xs text-slate-900 leading-snug line-clamp-2">
                            {deal.title}
                          </h4>
                          <GripVertical className="h-3.5 w-3.5 text-slate-300 flex-shrink-0 ml-1" />
                        </div>

                        <div className="mt-2 text-xs font-bold text-indigo-600 flex items-center">
                          <DollarSign className="h-3.5 w-3.5" />
                          <span>{deal.value.toLocaleString()}</span>
                        </div>

                        {deal.company && (
                          <div className="mt-2 flex items-center text-[11px] text-slate-500 space-x-1">
                            <Building className="h-3 w-3 text-slate-400" />
                            <span className="truncate">{deal.company}</span>
                          </div>
                        )}

                        {deal.contact && (
                          <div className="mt-1 flex items-center text-[10px] text-slate-400 space-x-1">
                            <User className="h-3 w-3 text-slate-300" />
                            <span className="truncate">
                              {deal.contact.firstName} {deal.contact.lastName}
                            </span>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* New Deal Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Create Pipeline Deal</h3>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-600 text-sm font-semibold">
                ✕
              </button>
            </div>

            {formError && (
              <div className="mt-4 bg-rose-50 border border-rose-200 rounded-xl p-3 text-rose-700 text-xs">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateDeal} className="mt-4 space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">
                  Deal Title *
                </label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="Enterprise License - CloudScale"
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">
                    Value ($)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="500"
                    value={formValue}
                    onChange={(e) => setFormValue(e.target.value)}
                    placeholder="25000"
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">
                    Initial Stage
                  </label>
                  <select
                    value={formStage}
                    onChange={(e) => setFormStage(e.target.value as DealStage)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white"
                  >
                    {STAGES.map((s) => (
                      <option key={s.stage} value={s.stage}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">
                  Company
                </label>
                <input
                  type="text"
                  value={formCompany}
                  onChange={(e) => setFormCompany(e.target.value)}
                  placeholder="Cyberdyne Systems"
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">
                  Associated Contact
                </label>
                <select
                  value={formContactId}
                  onChange={(e) => setFormContactId(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white"
                >
                  <option value="">No Contact Linked</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.firstName} {c.lastName} ({c.email})
                    </option>
                  ))}
                </select>
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
                  {formSubmitting ? 'Saving...' : 'Add Deal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

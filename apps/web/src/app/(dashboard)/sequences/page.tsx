'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../../context/auth-context';
import { apiRequest } from '../../../lib/api';
import {
  Plus,
  Send,
  Clock,
  UserPlus,
  MessageSquare,
  Play,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Mail,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';
import { EnrollmentStatus } from '@reachflow/shared';

interface SequenceStep {
  id: string;
  stepOrder: number;
  delayHours: number;
  subject: string;
  body: string;
}

interface EmailMessage {
  id: string;
  idempotencyKey: string;
  subject: string;
  body: string;
  sentAt: string;
}

interface Enrollment {
  id: string;
  contactId: string;
  currentStepOrder: number;
  status: EnrollmentStatus;
  nextRunAt: string;
  contact: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    company?: string | null;
  };
  emailMessages: EmailMessage[];
}

interface Sequence {
  id: string;
  name: string;
  status: string;
  steps: SequenceStep[];
  enrollments?: Enrollment[];
  _count?: {
    enrollments: number;
  };
  createdAt: string;
}

interface ContactOption {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export default function SequencesPage() {
  const { accessToken, activeWorkspace } = useAuth();
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [selectedSequence, setSelectedSequence] = useState<Sequence | null>(null);
  const [contacts, setContacts] = useState<ContactOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // New Sequence Modal State
  const [newSeqOpen, setNewSeqOpen] = useState(false);
  const [seqName, setSeqName] = useState('');
  const [steps, setSteps] = useState<
    Array<{ stepOrder: number; delayHours: number; subject: string; body: string }>
  >([
    {
      stepOrder: 1,
      delayHours: 0,
      subject: 'Quick question regarding {{company}}',
      body: 'Hi {{firstName}},\n\nNoticed {{company}} is scaling out sales. How are you currently managing outbound deliverability?\n\nBest,\nReachFlow Team',
    },
    {
      stepOrder: 2,
      delayHours: 48,
      subject: 'Following up on my previous note',
      body: 'Hi {{firstName}},\n\nJust following up to see if you had a quick 5 minutes this week?\n\nCheers,\nReachFlow Team',
    },
  ]);
  const [submittingSeq, setSubmittingSeq] = useState(false);

  // Enroll Modal State
  const [enrollModalOpen, setEnrollModalOpen] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState('');
  const [enrolling, setEnrolling] = useState(false);

  const fetchSequences = useCallback(async () => {
    if (!activeWorkspace || !accessToken) return;
    setLoading(true);
    setError(null);

    try {
      const [seqs, conts] = await Promise.all([
        apiRequest<Sequence[]>('/sequences', {
          token: accessToken,
          workspaceId: activeWorkspace.id,
        }),
        apiRequest<ContactOption[]>('/contacts?limit=100', {
          token: accessToken,
          workspaceId: activeWorkspace.id,
        }),
      ]);

      setSequences(seqs);
      setContacts(conts);

      if (seqs.length > 0) {
        // Fetch full details of the first sequence
        const detailed = await apiRequest<Sequence>(`/sequences/${seqs[0].id}`, {
          token: accessToken,
          workspaceId: activeWorkspace.id,
        });
        setSelectedSequence(detailed);
      } else {
        setSelectedSequence(null);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load sequences');
    } finally {
      setLoading(false);
    }
  }, [activeWorkspace, accessToken]);

  useEffect(() => {
    fetchSequences();
  }, [fetchSequences]);

  const selectSequence = async (id: string) => {
    try {
      const detailed = await apiRequest<Sequence>(`/sequences/${id}`, {
        token: accessToken,
        workspaceId: activeWorkspace?.id,
      });
      setSelectedSequence(detailed);
    } catch (err: any) {
      alert(err.message || 'Failed to load sequence details');
    }
  };

  const handleCreateSequence = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingSeq(true);

    try {
      const created = await apiRequest<Sequence>('/sequences', {
        method: 'POST',
        token: accessToken,
        workspaceId: activeWorkspace?.id,
        body: JSON.stringify({
          name: seqName,
          steps,
        }),
      });

      setNewSeqOpen(false);
      setSeqName('');
      fetchSequences();
      setSelectedSequence(created);
    } catch (err: any) {
      alert(err.message || 'Failed to create sequence');
    } finally {
      setSubmittingSeq(false);
    }
  };

  const handleEnrollContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSequence || !selectedContactId) return;
    setEnrolling(true);

    try {
      await apiRequest(`/sequences/${selectedSequence.id}/enroll`, {
        method: 'POST',
        token: accessToken,
        workspaceId: activeWorkspace?.id,
        body: JSON.stringify({ contactId: selectedContactId }),
      });

      setEnrollModalOpen(false);
      setSelectedContactId('');
      selectSequence(selectedSequence.id);
      setActionMessage('Contact enrolled successfully! Step 1 will execute on next cycle.');
      setTimeout(() => setActionMessage(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Failed to enroll contact');
    } finally {
      setEnrolling(false);
    }
  };

  const handleSimulateReply = async (enrollmentId: string) => {
    try {
      await apiRequest(`/sequences/enrollments/${enrollmentId}/simulate-reply`, {
        method: 'POST',
        token: accessToken,
        workspaceId: activeWorkspace?.id,
      });

      if (selectedSequence) {
        selectSequence(selectedSequence.id);
      }
      setActionMessage('Inbound reply recorded! Sequence progression halted for this contact.');
      setTimeout(() => setActionMessage(null), 5000);
    } catch (err: any) {
      alert(err.message || 'Failed to simulate reply');
    }
  };

  const handleProcessDueNow = async () => {
    try {
      const res = await apiRequest<{ processed: number; sent: number; completed: number }>(
        '/sequences/process-due',
        {
          method: 'POST',
          token: accessToken,
          workspaceId: activeWorkspace?.id,
        }
      );

      if (selectedSequence) {
        selectSequence(selectedSequence.id);
      }
      setActionMessage(`Engine Ran: ${res.sent} email(s) sent, ${res.completed} completed.`);
      setTimeout(() => setActionMessage(null), 5000);
    } catch (err: any) {
      alert(err.message || 'Failed to process due enrollments');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Email Sequences</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Automate multi-step outbound email drips with personalized merge variables
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={handleProcessDueNow}
            className="inline-flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-xl text-xs font-semibold shadow-sm transition"
            title="Trigger sequence engine execution immediately"
          >
            <Play className="h-3.5 w-3.5" />
            <span>Process Due Steps Now</span>
          </button>

          <button
            onClick={() => setNewSeqOpen(true)}
            className="inline-flex items-center space-x-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-sm transition"
          >
            <Plus className="h-4 w-4" />
            <span>New Sequence</span>
          </button>
        </div>
      </div>

      {/* Action Notification */}
      {actionMessage && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center space-x-2 text-emerald-800 text-xs">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
          <span>{actionMessage}</span>
        </div>
      )}

      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-center justify-between text-rose-700 text-xs">
          <div className="flex items-center space-x-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => fetchSequences()} className="flex items-center space-x-1 text-xs font-semibold underline">
            <RefreshCw className="h-3 w-3" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* Main Two-Column Layout */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl border border-slate-200 p-4 h-96 animate-pulse" />
          <div className="md:col-span-2 bg-white rounded-xl border border-slate-200 p-4 h-96 animate-pulse" />
        </div>
      ) : sequences.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <div className="h-12 w-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Send className="h-6 w-6" />
          </div>
          <h3 className="font-bold text-slate-800 text-base">No sequences created yet</h3>
          <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
            Build your first multi-step automated email sequence to start engaging prospects.
          </p>
          <button
            onClick={() => setNewSeqOpen(true)}
            className="mt-4 inline-flex items-center space-x-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-sm transition"
          >
            <Plus className="h-4 w-4" />
            <span>Create Sequence</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          {/* Left Column: Sequence List */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                All Sequences ({sequences.length})
              </span>
            </div>
            <div className="divide-y divide-slate-100">
              {sequences.map((seq) => {
                const isSelected = selectedSequence?.id === seq.id;
                return (
                  <button
                    key={seq.id}
                    onClick={() => selectSequence(seq.id)}
                    className={`w-full p-4 text-left transition flex items-center justify-between ${
                      isSelected ? 'bg-indigo-50/70 border-l-4 border-indigo-600' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div>
                      <div className="font-semibold text-xs text-slate-900">{seq.name}</div>
                      <div className="mt-1 flex items-center space-x-2 text-[11px] text-slate-500">
                        <span>{seq.steps.length} Steps</span>
                        <span>•</span>
                        <span>{seq._count?.enrollments || 0} Enrolled</span>
                      </div>
                    </div>
                    <ChevronRight className={`h-4 w-4 ${isSelected ? 'text-indigo-600' : 'text-slate-300'}`} />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Column: Sequence Details, Steps & Enrollments */}
          {selectedSequence && (
            <div className="md:col-span-2 space-y-6">
              {/* Sequence Header Card */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                  <div>
                    <div className="flex items-center space-x-2">
                      <h2 className="text-lg font-bold text-slate-900">{selectedSequence.name}</h2>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {selectedSequence.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Idempotent background engine dispatches due steps and handles simulated replies
                    </p>
                  </div>

                  <button
                    onClick={() => setEnrollModalOpen(true)}
                    className="inline-flex items-center space-x-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-2 rounded-xl text-xs font-semibold shadow-sm transition"
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    <span>Enroll Prospect</span>
                  </button>
                </div>

                {/* Steps Timeline */}
                <div className="mt-6">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                    Outbound Steps ({selectedSequence.steps.length})
                  </h3>
                  <div className="space-y-3">
                    {selectedSequence.steps.map((step) => (
                      <div
                        key={step.id}
                        className="bg-slate-50 rounded-xl p-4 border border-slate-200/80 relative"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <span className="h-5 w-5 bg-indigo-600 text-white rounded-full flex items-center justify-center font-bold text-[10px]">
                              {step.stepOrder}
                            </span>
                            <span className="font-semibold text-xs text-slate-900">
                              {step.subject}
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-500 font-medium flex items-center">
                            <Clock className="h-3 w-3 mr-1 text-slate-400" />
                            {step.delayHours === 0 ? 'Immediately' : `Wait ${step.delayHours}h`}
                          </span>
                        </div>
                        <div className="text-xs text-slate-600 font-mono bg-white p-2.5 rounded-lg border border-slate-200 whitespace-pre-wrap">
                          {step.body}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Active Enrollments & Reply Simulation Card */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Prospect Enrollments</h3>
                    <p className="text-xs text-slate-400">
                      Track execution status and simulate inbound replies
                    </p>
                  </div>
                  <span className="text-xs text-slate-500 font-medium">
                    Total: {selectedSequence.enrollments?.length || 0}
                  </span>
                </div>

                {!selectedSequence.enrollments || selectedSequence.enrollments.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
                    No contacts currently enrolled in this sequence.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-100 text-left text-xs">
                      <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-semibold">
                        <tr>
                          <th className="px-3 py-2.5">Prospect</th>
                          <th className="px-3 py-2.5">Current Step</th>
                          <th className="px-3 py-2.5">Status</th>
                          <th className="px-3 py-2.5">Sent Emails</th>
                          <th className="px-3 py-2.5 text-right">Simulation</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedSequence.enrollments.map((enr) => (
                          <tr key={enr.id} className="hover:bg-slate-50/60 transition">
                            <td className="px-3 py-3">
                              <div className="font-semibold text-slate-900">
                                {enr.contact.firstName} {enr.contact.lastName}
                              </div>
                              <div className="text-[11px] text-slate-400">{enr.contact.email}</div>
                            </td>
                            <td className="px-3 py-3 font-medium text-slate-700">
                              Step {enr.currentStepOrder} of {selectedSequence.steps.length}
                            </td>
                            <td className="px-3 py-3">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                  enr.status === EnrollmentStatus.REPLIED
                                    ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                    : enr.status === EnrollmentStatus.COMPLETED
                                    ? 'bg-slate-100 text-slate-600'
                                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                }`}
                              >
                                {enr.status}
                              </span>
                            </td>
                            <td className="px-3 py-3 text-slate-600">
                              <div className="flex items-center space-x-1">
                                <Mail className="h-3.5 w-3.5 text-slate-400" />
                                <span>{enr.emailMessages.length} sent</span>
                              </div>
                            </td>
                            <td className="px-3 py-3 text-right">
                              {enr.status === EnrollmentStatus.ACTIVE ? (
                                <button
                                  onClick={() => handleSimulateReply(enr.id)}
                                  className="inline-flex items-center space-x-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition"
                                  title="Simulate prospect replying to stop future sequence emails"
                                >
                                  <MessageSquare className="h-3 w-3" />
                                  <span>Simulate Reply</span>
                                </button>
                              ) : (
                                <span className="text-[11px] text-slate-400 italic">
                                  {enr.status === EnrollmentStatus.REPLIED
                                    ? 'Halted (Replied)'
                                    : 'Completed'}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* New Sequence Modal */}
      {newSeqOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Create Outbound Sequence</h3>
              <button onClick={() => setNewSeqOpen(false)} className="text-slate-400 hover:text-slate-600 text-sm font-semibold">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSequence} className="mt-4 space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">
                  Sequence Name *
                </label>
                <input
                  type="text"
                  required
                  value={seqName}
                  onChange={(e) => setSeqName(e.target.value)}
                  placeholder="Founder Outbound 3-Step Drip"
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              {/* Dynamic Steps */}
              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                    Sequence Steps
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setSteps((prev) => [
                        ...prev,
                        {
                          stepOrder: prev.length + 1,
                          delayHours: 72,
                          subject: 'Quick resource for {{company}}',
                          body: 'Hi {{firstName}},\n\nSharing a quick resource on outbound pipelines.\n\nBest,\nReachFlow',
                        },
                      ])
                    }
                    className="text-xs text-indigo-600 hover:text-indigo-700 font-semibold"
                  >
                    + Add Step
                  </button>
                </div>

                {steps.map((st, idx) => (
                  <div key={idx} className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800">Step {st.stepOrder}</span>
                      <div className="flex items-center space-x-1 text-xs">
                        <label className="text-[11px] text-slate-500">Wait (hours):</label>
                        <input
                          type="number"
                          min="0"
                          value={st.delayHours}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setSteps((prev) =>
                              prev.map((s, i) => (i === idx ? { ...s, delayHours: val } : s))
                            );
                          }}
                          className="w-16 px-2 py-1 border border-slate-200 rounded text-xs bg-white"
                        />
                      </div>
                    </div>

                    <input
                      type="text"
                      required
                      value={st.subject}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSteps((prev) =>
                          prev.map((s, i) => (i === idx ? { ...s, subject: val } : s))
                        );
                      }}
                      placeholder="Subject template..."
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none"
                    />

                    <textarea
                      required
                      rows={3}
                      value={st.body}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSteps((prev) =>
                          prev.map((s, i) => (i === idx ? { ...s, body: val } : s))
                        );
                      }}
                      placeholder="Email body template with {{firstName}}, {{company}}..."
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-mono bg-white focus:outline-none"
                    />
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-end space-x-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setNewSeqOpen(false)}
                  className="px-3.5 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingSeq}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-xs font-semibold shadow-sm transition disabled:opacity-50"
                >
                  {submittingSeq ? 'Creating...' : 'Save Sequence'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Enroll Contact Modal */}
      {enrollModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Enroll Prospect in Sequence</h3>
              <button onClick={() => setEnrollModalOpen(false)} className="text-slate-400 hover:text-slate-600 text-sm font-semibold">
                ✕
              </button>
            </div>

            <form onSubmit={handleEnrollContact} className="mt-4 space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">
                  Select Contact *
                </label>
                <select
                  required
                  value={selectedContactId}
                  onChange={(e) => setSelectedContactId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Choose a prospect...</option>
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
                  onClick={() => setEnrollModalOpen(false)}
                  className="px-3.5 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={enrolling || !selectedContactId}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-xs font-semibold shadow-sm transition disabled:opacity-50"
                >
                  {enrolling ? 'Enrolling...' : 'Confirm Enrollment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

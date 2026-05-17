'use client';

import { useEffect, useState } from 'react';

export type AdminTimelineEntry = {
  createdAt: string;
  createdByName: string;
  id: string;
  kind: 'event' | 'note';
  note: string;
};

type AdminTimelineActionResult = {
  error?: string;
  message?: string;
  timeline?: AdminTimelineEntry[];
};

type AdminTimelinePanelProps = {
  addNoteAction: (formData: FormData) => Promise<AdminTimelineActionResult>;
  deleteNoteAction: (formData: FormData) => Promise<AdminTimelineActionResult>;
  disabledMessage?: string;
  editNoteAction: (formData: FormData) => Promise<AdminTimelineActionResult>;
  noteAddedMessage?: string;
  notePlaceholder?: string;
  noteUpdatedMessage?: string;
  recordId: string | null;
  timeline: AdminTimelineEntry[];
  title?: string;
};

function formatNoteDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-BD', {
    day: 'numeric',
    hour: 'numeric',
    hour12: true,
    minute: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function formatTimelineEvent(note: string) {
  if (note === 'upgraded the PO Draft to a PO') {
    return 'submitted the PO Draft to PO';
  }
  return note;
}

function formatTimelineActor(name: string) {
  return `@${name.trim() || 'Admin'}`;
}

function PencilIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v5" />
      <path d="M14 11v5" />
    </svg>
  );
}

export default function AdminTimelinePanel({
  addNoteAction,
  deleteNoteAction,
  disabledMessage = 'Save this record before adding notes.',
  editNoteAction,
  noteAddedMessage = 'Note added.',
  notePlaceholder = 'Add a new note',
  noteUpdatedMessage = 'Note updated.',
  recordId,
  timeline: initialTimeline,
  title = 'Timeline',
}: AdminTimelinePanelProps) {
  const [currentRecordId, setCurrentRecordId] = useState(recordId);
  const [noteDraft, setNoteDraft] = useState('');
  const [timeline, setTimeline] = useState(initialTimeline);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteText, setEditingNoteText] = useState('');
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);
  const canAddNote = Boolean(currentRecordId) && noteDraft.trim().length > 0 && !isSaving;
  const canSaveEditedNote = editingNoteText.trim().length > 0 && !isEditingNote;

  useEffect(() => {
    setCurrentRecordId(recordId);
  }, [recordId]);

  useEffect(() => {
    setTimeline(initialTimeline);
  }, [initialTimeline]);

  useEffect(() => {
    function handleDraftSaved(event: Event) {
      if (!(event instanceof CustomEvent)) return;
      const draftId = event.detail?.draftId;
      if (typeof draftId === 'string' && draftId) {
        setCurrentRecordId((current) => current ?? draftId);
        if (Array.isArray(event.detail?.timeline)) {
          setTimeline(event.detail.timeline);
        }
        setError('');
      }
    }

    window.addEventListener('purchase-order-draft-saved', handleDraftSaved);
    return () =>
      window.removeEventListener('purchase-order-draft-saved', handleDraftSaved);
  }, []);

  function addNote() {
    if (!currentRecordId) {
      setError(disabledMessage);
      setMessage('');
      return;
    }

    const note = noteDraft.trim();
    if (!note) return;

    const formData = new FormData();
    formData.set('recordId', currentRecordId);
    formData.set('note', note);

    setIsSaving(true);
    void addNoteAction(formData)
      .then((result) => {
        if (result.error) {
          setError(result.error);
          setMessage('');
          return;
        }

        if (result.timeline) setTimeline(result.timeline);
        setNoteDraft('');
        setError('');
        setMessage(result.message ?? noteAddedMessage);
      })
      .catch(() => {
        setError('Failed to add note.');
        setMessage('');
      })
      .finally(() => {
        setIsSaving(false);
      });
  }

  function beginEditNote(entry: AdminTimelineEntry) {
    setEditingNoteId(entry.id);
    setEditingNoteText(entry.note);
    setError('');
    setMessage('');
  }

  function cancelEditNote() {
    setEditingNoteId(null);
    setEditingNoteText('');
    setError('');
  }

  function saveEditedNote() {
    const noteId = editingNoteId;
    const note = editingNoteText.trim();
    if (!noteId || !note) return;

    const formData = new FormData();
    formData.set('noteId', noteId);
    formData.set('note', note);

    setIsEditingNote(true);
    void editNoteAction(formData)
      .then((result) => {
        if (result.error) {
          setError(result.error);
          setMessage('');
          return;
        }

        if (result.timeline) setTimeline(result.timeline);
        setEditingNoteId(null);
        setEditingNoteText('');
        setError('');
        setMessage(result.message ?? noteUpdatedMessage);
      })
      .catch(() => {
        setError('Failed to update note.');
        setMessage('');
      })
      .finally(() => {
        setIsEditingNote(false);
      });
  }

  function deleteNote(entry: AdminTimelineEntry) {
    const confirmed = window.confirm('Delete this note?');
    if (!confirmed) return;

    const formData = new FormData();
    formData.set('noteId', entry.id);

    setDeletingNoteId(entry.id);
    void deleteNoteAction(formData)
      .then((result) => {
        if (result.error) {
          setError(result.error);
          setMessage('');
          return;
        }

        if (result.timeline) setTimeline(result.timeline);
        if (editingNoteId === entry.id) {
          setEditingNoteId(null);
          setEditingNoteText('');
        }
        setError('');
        setMessage(result.message ?? 'Note deleted.');
      })
      .catch(() => {
        setError('Failed to delete note.');
        setMessage('');
      })
      .finally(() => {
        setDeletingNoteId(null);
      });
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <label className="mt-3 block text-sm font-medium text-slate-700">
        <textarea
          rows={4}
          placeholder={currentRecordId ? notePlaceholder : disabledMessage}
          value={noteDraft}
          disabled={!currentRecordId || isSaving}
          onChange={(event) => setNoteDraft(event.target.value)}
          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-300 disabled:bg-slate-100 disabled:text-slate-500"
        />
      </label>
      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="text-xs font-semibold">
          {message ? <span className="text-emerald-700">{message}</span> : null}
          {error ? <span className="text-rose-700">{error}</span> : null}
        </div>
        <button
          type="button"
          disabled={!canAddNote}
          onClick={addNote}
          className="rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {isSaving ? 'Adding Note...' : 'Add Note'}
        </button>
      </div>

      {timeline.length > 0 ? (
        <div className="mt-4 space-y-3">
          {timeline.map((entry) =>
            entry.kind === 'event' ? (
              <div
                key={entry.id}
                className="mx-auto w-fit max-w-full rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-center"
              >
                <p className="text-xs font-medium text-blue-950">
                  {formatTimelineActor(entry.createdByName)}{' '}
                  {formatTimelineEvent(entry.note)}.
                </p>
              </div>
            ) : (
              <div
                key={entry.id}
                className="relative rounded-lg border border-slate-200 bg-slate-50 p-3 pb-5 pr-20"
              >
                <div className="mb-1 text-[11px] text-slate-500">
                  <span className="font-medium text-slate-700">
                    {entry.createdByName}
                  </span>
                </div>
                {editingNoteId === entry.id ? null : (
                  <div className="absolute right-2 top-2 flex gap-1.5">
                    <button
                      type="button"
                      aria-label="Edit note"
                      title="Edit note"
                      onClick={() => beginEditNote(entry)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
                    >
                      <PencilIcon />
                    </button>
                    <button
                      type="button"
                      aria-label="Delete note"
                      title="Delete note"
                      disabled={deletingNoteId === entry.id}
                      onClick={() => deleteNote(entry)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-rose-200 bg-white text-rose-600 transition hover:bg-rose-50 hover:text-rose-700 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300"
                    >
                      <TrashIcon />
                    </button>
                  </div>
                )}
                {editingNoteId === entry.id ? (
                  <div className="space-y-2">
                    <textarea
                      rows={3}
                      value={editingNoteText}
                      disabled={isEditingNote}
                      onChange={(event) => setEditingNoteText(event.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 outline-none transition focus:border-blue-300 disabled:bg-slate-100 disabled:text-slate-500"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        disabled={isEditingNote}
                        onClick={cancelEditNote}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={!canSaveEditedNote}
                        onClick={saveEditedNote}
                        className="rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:bg-slate-300"
                      >
                        {isEditingNote ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap text-xs text-slate-800">
                    {entry.note}
                    <span className="absolute bottom-1.5 right-3 whitespace-nowrap text-[9px] font-medium leading-none text-slate-400">
                      {formatNoteDate(entry.createdAt)}
                    </span>
                  </p>
                )}
              </div>
            ),
          )}
        </div>
      ) : (
        <p className="mt-4 text-xs font-medium text-slate-500">
          No lifecycle entries or notes yet.
        </p>
      )}
    </section>
  );
}

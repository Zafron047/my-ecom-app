'use client';

import { useEffect, useMemo, useState } from 'react';

type SectionRow = {
  id: string;
  title: string;
};

type HomepageSectionsReorderManagerProps = {
  sections: SectionRow[];
  reorderAction: (formData: FormData) => Promise<void>;
};

export default function HomepageSectionsReorderManager({
  sections,
  reorderAction,
}: HomepageSectionsReorderManagerProps) {
  const [ordered, setOrdered] = useState(sections);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const maxSerial = ordered.length;
  const sectionIds = useMemo(() => new Set(ordered.map((section) => section.id)), [ordered]);

  useEffect(() => {
    setOrdered(sections);
  }, [sections]);

  function moveSection(sectionId: string, targetIndex: number) {
    setOrdered((current) => {
      const sourceIndex = current.findIndex((item) => item.id === sectionId);
      if (sourceIndex < 0) return current;

      const boundedTargetIndex = Math.max(0, Math.min(targetIndex, current.length - 1));
      if (sourceIndex === boundedTargetIndex) return current;

      const next = [...current];
      const [moved] = next.splice(sourceIndex, 1);
      next.splice(boundedTargetIndex, 0, moved);
      return next;
    });
  }

  return (
    <div>
      <form action={reorderAction}>
        <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
          <div className="grid grid-cols-[5rem_minmax(0,1fr)_8rem] gap-3 border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <span>Serial</span>
            <span>Section</span>
            <span className="text-right">Move</span>
          </div>

          {ordered.length === 0 ? (
            <p className="px-3 py-4 text-sm text-slate-500">No sections to order yet.</p>
          ) : (
            ordered.map((section, index) => (
              <div
                key={section.id}
                draggable
                onDragStart={() => setDraggingId(section.id)}
                onDragEnd={() => setDraggingId(null)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => {
                  if (!draggingId || draggingId === section.id || !sectionIds.has(draggingId)) {
                    return;
                  }
                  moveSection(draggingId, index);
                  setDraggingId(null);
                }}
                className="grid cursor-grab grid-cols-[5rem_minmax(0,1fr)_8rem] items-center gap-3 border-b border-slate-200 px-3 py-2 last:border-b-0"
              >
                <input type="hidden" name="orderedSectionIds" value={section.id} />
                <label className="sr-only" htmlFor={`section-serial-${section.id}`}>
                  Serial for {section.title}
                </label>
                <input
                  id={`section-serial-${section.id}`}
                  type="number"
                  min={1}
                  max={maxSerial}
                  value={index + 1}
                  onChange={(event) => {
                    const nextSerial = Number.parseInt(event.target.value, 10);
                    if (!Number.isFinite(nextSerial)) return;
                    moveSection(section.id, nextSerial - 1);
                  }}
                  className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-slate-900"
                />
                <p className="truncate text-sm font-medium text-slate-900">{section.title}</p>
                <div className="flex justify-end gap-1">
                  <button
                    type="button"
                    onClick={() => moveSection(section.id, index - 1)}
                    disabled={index === 0}
                    className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label={`Move ${section.title} up`}
                    title="Move up"
                  >
                    Up
                  </button>
                  <button
                    type="button"
                    onClick={() => moveSection(section.id, index + 1)}
                    disabled={index === ordered.length - 1}
                    className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label={`Move ${section.title} down`}
                    title="Move down"
                  >
                    Down
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <button
          type="submit"
          disabled={ordered.length === 0}
          className="mt-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-semibold text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Save Order
        </button>
      </form>
    </div>
  );
}

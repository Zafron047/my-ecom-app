'use client';

import { useState } from 'react';

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

  return (
    <div>
      <form action={reorderAction}>
        <div className="mt-4 space-y-2">
          {ordered.map((section, index) => (
            <div
              key={section.id}
              draggable
              onDragStart={() => setDraggingId(section.id)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => {
                if (!draggingId || draggingId === section.id) return;
                const sourceIndex = ordered.findIndex((item) => item.id === draggingId);
                const targetIndex = ordered.findIndex((item) => item.id === section.id);
                if (sourceIndex < 0 || targetIndex < 0) return;
                const next = [...ordered];
                const [moved] = next.splice(sourceIndex, 1);
                next.splice(targetIndex, 0, moved);
                setOrdered(next);
                setDraggingId(null);
              }}
              className="flex cursor-grab items-center justify-between rounded-lg border border-slate-200 px-3 py-2"
            >
              <input type="hidden" name="orderedSectionIds" value={section.id} />
              <p className="text-sm font-medium text-slate-900">
                {index + 1}. {section.title}
              </p>
              <span className="inline-flex items-center gap-1 text-slate-500">
                <span className="text-base leading-none">↑</span>
                <span className="text-base leading-none">↓</span>
              </span>
            </div>
          ))}
        </div>

        <button
          type="submit"
          className="mt-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
        >
          Save Order
        </button>
      </form>
    </div>
  );
}

'use client';

import { useState } from 'react';

export type CategoryStatCard = {
  id: string;
  items: {
    badge?: string;
    imagePath?: string;
    primary: string;
    secondary?: string;
  }[];
  label: string;
  value: string;
};

type CategoryStatCardsProps = {
  cards: CategoryStatCard[];
};

export default function CategoryStatCards({ cards }: CategoryStatCardsProps) {
  const [openCardIds, setOpenCardIds] = useState<string[]>([]);

  function toggleCard(cardId: string) {
    setOpenCardIds((current) =>
      current.includes(cardId)
        ? current.filter((id) => id !== cardId)
        : [...current, cardId],
    );
  }

  return (
    <div className="grid gap-3 md:grid-cols-4">
      {cards.map((card) => {
        const isOpen = openCardIds.includes(card.id);

        return (
          <div
            key={card.id}
            className="rounded-xl border border-slate-200 bg-slate-50"
          >
            <button
              type="button"
              aria-expanded={isOpen}
              onClick={() => toggleCard(card.id)}
              className={`w-full px-4 py-3 text-left transition hover:bg-white ${
                isOpen ? 'bg-white' : ''
              }`}
            >
              <span>
                <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {card.label}
                </span>
                <span className="mt-2 block text-2xl font-semibold text-slate-950">
                  {card.value}
                </span>
              </span>
            </button>

            {isOpen && (
              <div className="border-t border-slate-200 bg-white px-4 py-3">
                {card.items.length > 0 ? (
                  <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                    {card.items.map((item, index) => (
                      <div
                        key={`${item.primary}-${index}`}
                        className="flex items-start justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-white text-[9px] font-semibold uppercase text-slate-400">
                            {item.imagePath ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={item.imagePath}
                                alt=""
                                className="h-full w-full object-contain p-0.5"
                              />
                            ) : (
                              'Img'
                            )}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold text-slate-800">
                              {item.primary}
                            </span>
                            {item.secondary ? (
                              <span className="block truncate text-xs text-slate-500">
                                {item.secondary}
                              </span>
                            ) : null}
                          </span>
                        </span>
                        {item.badge ? (
                          <span className="shrink-0 rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
                            {item.badge}
                          </span>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">Nothing to show.</p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

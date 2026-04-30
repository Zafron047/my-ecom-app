'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type ProductOption = {
  id: string;
  image: string;
  name: string;
  usedIn: string[];
};

type ProductMultiSelectDropdownProps = {
  name: string;
  options: ProductOption[];
  selectedIds?: string[];
};

export default function ProductMultiSelectDropdown({
  name,
  options,
  selectedIds = [],
}: ProductMultiSelectDropdownProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set(selectedIds));

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return options;
    return options.filter((item) => item.name.toLowerCase().includes(normalized));
  }, [options, query]);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      const target = event.target as Node;
      if (wrapperRef.current?.contains(target)) return;
      setIsOpen(false);
    }

    document.addEventListener('pointerdown', handleOutsideClick);
    return () => document.removeEventListener('pointerdown', handleOutsideClick);
  }, []);

  return (
    <div ref={wrapperRef} className="relative">
      {Array.from(selected).map((id) => (
        <input key={id} type="hidden" name={name} value={id} />
      ))}

      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="flex w-full items-center justify-between rounded-lg border border-slate-300 px-3 py-2 text-left text-sm text-slate-800"
      >
        <span className="truncate">
          {selected.size > 0
            ? `${selected.size} selected`
            : 'Select products'}
        </span>
        <span className="text-slate-500">{isOpen ? '▴' : '▾'}</span>
      </button>

      {isOpen ? (
        <div className="absolute z-40 mt-2 w-full rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search products..."
            className="mb-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <div className="max-h-72 space-y-1 overflow-auto">
            {filtered.map((product) => (
              <label
                key={product.id}
                className="flex items-center gap-3 rounded-lg border border-slate-200 px-2 py-2"
              >
                <input
                  type="checkbox"
                  checked={selected.has(product.id)}
                  onChange={(event) => {
                    setSelected((current) => {
                      const next = new Set(current);
                      if (event.target.checked) next.add(product.id);
                      else next.delete(product.id);
                      return next;
                    });
                  }}
                />
                <img
                  src={product.image || '/next.svg'}
                  alt={product.name}
                  className="h-8 w-8 rounded border border-slate-200 object-cover"
                />
                <span className="text-sm text-slate-800">{product.name}</span>
                {product.usedIn.length > 0 ? (
                  <span className="ml-auto text-[11px] text-amber-700">
                    Used in: {product.usedIn.join(', ')}
                  </span>
                ) : null}
              </label>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

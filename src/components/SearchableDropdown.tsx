'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useId } from 'react';
import { createPortal } from 'react-dom';

type SearchableDropdownProps = {
  value: string;
  options:
    | string[]
    | {
        heading: string;
        options: string[];
      }[];
  placeholder: string;
  disabled?: boolean;
  className?: string;
  onSelect: (value: string) => void;
  onBlur?: () => void;
};

export default function SearchableDropdown({
  value,
  options,
  placeholder,
  disabled = false,
  className = '',
  onSelect,
  onBlur,
}: SearchableDropdownProps) {
  const dropdownId = useId();
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [menuStyle, setMenuStyle] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  const normalizedGroups = useMemo(() => {
    if (options.length === 0) return [];
    if (typeof options[0] === 'string') {
      return [
        {
          heading: '',
          options: options as string[],
        },
      ];
    }
    return options as { heading: string; options: string[] }[];
  }, [options]);

  const filteredGroups = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return normalizedGroups;

    return normalizedGroups
      .map((group) => ({
        heading: group.heading,
        options: group.options.filter((option) => option.toLowerCase().includes(normalized)),
      }))
      .filter((group) => group.options.length > 0);
  }, [normalizedGroups, query]);

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
    }
  }, [isOpen]);

  useEffect(() => {
    function handleOtherDropdownOpen(event: Event) {
      const customEvent = event as CustomEvent<string>;
      if (customEvent.detail !== dropdownId) {
        setIsOpen(false);
      }
    }

    window.addEventListener('searchable-dropdown-open', handleOtherDropdownOpen);
    return () => {
      window.removeEventListener('searchable-dropdown-open', handleOtherDropdownOpen);
    };
  }, [dropdownId]);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      const target = event.target as Node;
      if (wrapperRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setIsOpen(false);
      onBlur?.();
    }

    document.addEventListener('pointerdown', handleOutsideClick);
    return () => document.removeEventListener('pointerdown', handleOutsideClick);
  }, [onBlur]);

  function handleInputFocus() {
    if (disabled) return;
    setIsOpen(true);
    window.dispatchEvent(
      new CustomEvent('searchable-dropdown-open', { detail: dropdownId }),
    );
  }

  function handleOptionSelect(option: string) {
    onSelect(option);
    setIsOpen(false);
    setQuery('');
  }

  useEffect(() => {
    if (!isOpen) return;

    function updateMenuPosition() {
      if (!wrapperRef.current) return;
      const rect = wrapperRef.current.getBoundingClientRect();
      setMenuStyle({
        top: rect.bottom + 5,
        left: rect.left,
        width: rect.width,
      });
    }

    updateMenuPosition();
    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', updateMenuPosition, true);

    return () => {
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', updateMenuPosition, true);
    };
  }, [isOpen]);

  const inputValue = isOpen ? query : value;

  return (
    <div
      ref={wrapperRef}
      className={`relative ${isOpen ? 'z-[120]' : 'z-auto'}`}
    >
      <input
        type="text"
        value={inputValue}
        placeholder={placeholder}
        disabled={disabled}
        onFocus={handleInputFocus}
        onChange={(event) => {
          setQuery(event.target.value);
          if (!isOpen) setIsOpen(true);
        }}
        className={className}
      />

      {isOpen &&
        !disabled &&
        menuStyle &&
        createPortal(
          <div
            ref={menuRef}
            style={{
              position: 'fixed',
              top: menuStyle.top,
              left: menuStyle.left,
              width: menuStyle.width,
              zIndex: 2147483647,
            }}
            className="max-h-56 overflow-auto rounded-xl border border-slate-200 bg-white shadow-lg"
          >
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => handleOptionSelect('')}
              className="block w-full border-b border-slate-100 px-3 py-2 text-left text-sm text-slate-500 hover:bg-slate-50"
            >
              {placeholder}
            </button>
            {filteredGroups.length > 0 ? (
              filteredGroups.map((group) => (
                <div key={group.heading || 'default-group'}>
                  {group.heading ? (
                    <p className="sticky top-0 z-10 border-t border-slate-200 border-b border-b-sky-300/70 bg-sky-50 px-3 py-2 text-xs font-bold uppercase tracking-[0.1em] text-sky-800">
                      {group.heading}
                    </p>
                  ) : null}
                  {group.options.map((option) => (
                    <button
                      key={`${group.heading}-${option}`}
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => handleOptionSelect(option)}
                      className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                    >
                      {option}
                    </button>
                  ))}
                </div>
              ))
            ) : (
              <p className="px-3 py-2 text-sm text-slate-500">No matches found.</p>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}

"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";

export interface TagOption {
  value: string;
  /** Shown on the tag and in the suggestions, e.g. "MW-05". */
  code: string;
  label: string;
  hint?: string;
}

/**
 * One input that suggests matching options as you type; a picked option
 * becomes a removable tag. Nothing is listed until something is typed.
 * Each tag submits as a hidden `name` field, like a ticked checkbox.
 */
export function TagPicker({
  name,
  options,
  defaultValue,
  placeholder,
  label,
  noMatch,
}: {
  name: string;
  options: TagOption[];
  defaultValue: string[];
  placeholder: string;
  label: string;
  /** Said when nothing matches what was typed. */
  noMatch: string;
}) {
  const [picked, setPicked] = useState(() => defaultValue.filter((v) => options.some((o) => o.value === v)));
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [focused, setFocused] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();

  const q = query.trim().toLowerCase();
  // Closed when the input loses focus, so it never covers Save or Cancel.
  const open = focused && q.length > 0;
  const matches = q
    ? options.filter((o) => !picked.includes(o.value) && `${o.code} ${o.label}`.toLowerCase().includes(q))
    : [];
  const byValue = new Map(options.map((o) => [o.value, o]));

  function add(value: string) {
    setPicked((p) => (p.includes(value) ? p : [...p, value]));
    setQuery("");
    setActive(0);
    input.current?.focus();
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" && matches.length) {
      e.preventDefault();
      setActive((a) => (a + 1) % matches.length);
    } else if (e.key === "ArrowUp" && matches.length) {
      e.preventDefault();
      setActive((a) => (a - 1 + matches.length) % matches.length);
    } else if (e.key === "Enter") {
      // Enter picks a suggestion; it never submits the form from here.
      e.preventDefault();
      if (matches[active]) add(matches[active].value);
    } else if (e.key === "Escape") {
      setQuery("");
    } else if (e.key === "Backspace" && !query && picked.length) {
      setPicked((p) => p.slice(0, -1));
    }
  }

  return (
    <div className="relative">
      {picked.map((v) => (
        <input key={v} type="hidden" name={name} value={v} />
      ))}
      <div
        className="flex min-h-[2.75rem] flex-wrap items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2 py-1.5 focus-within:border-brand-500 focus-within:ring-3 focus-within:ring-brand-500/20"
        onClick={() => input.current?.focus()}
      >
        {picked.map((v) => {
          const o = byValue.get(v)!;
          return (
            <span key={v} className="inline-flex items-center gap-1 rounded-md bg-brand-50 py-0.5 pr-1 pl-2 text-sm text-brand-800 ring-1 ring-brand-600/20 ring-inset">
              <span className="font-semibold">{o.code}</span> {o.label}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setPicked((p) => p.filter((x) => x !== v));
                }}
                aria-label={`Remove ${o.code} ${o.label}`}
                className="ml-0.5 rounded px-1 text-brand-700 hover:bg-brand-100"
              >
                ×
              </button>
            </span>
          );
        })}
        <input
          ref={input}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={picked.length ? "Add another…" : placeholder}
          aria-label={label}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          className="min-w-[12rem] flex-1 border-0 bg-transparent px-1 py-1 text-sm outline-none"
        />
      </div>
      {open ? (
        <ul id={listId} role="listbox" className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
          {matches.length ? (
            matches.map((o, i) => (
              <li
                key={o.value}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => {
                  // Keeps focus in the input, so the list doesn't close before the click lands.
                  e.preventDefault();
                  add(o.value);
                }}
                onMouseEnter={() => setActive(i)}
                className={`cursor-pointer px-3 py-2 text-sm ${i === active ? "bg-brand-50 text-brand-800" : "text-slate-700"}`}
              >
                <span className="font-semibold">{o.code}</span> {o.label}
                {o.hint ? <span className="text-xs text-slate-400"> · {o.hint}</span> : null}
              </li>
            ))
          ) : (
            <li className="px-3 py-2 text-sm text-slate-500">{noMatch} &ldquo;{query.trim()}&rdquo;</li>
          )}
        </ul>
      ) : null}
    </div>
  );
}

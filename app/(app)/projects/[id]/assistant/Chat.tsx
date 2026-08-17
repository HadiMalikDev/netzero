"use client";

import { useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { BotIcon } from "@/components/icons";
import type { Answer } from "@/lib/assistant/answer";
import { ask } from "./actions";

interface Turn {
  role: "user" | "assistant";
  text: string;
  answer?: Answer;
}

const QUICK = [
  "What's remaining?",
  "What evidence is missing?",
  "What's the status of HC-10?",
  "What's in progress vs not started?",
];

function isCreditCode(seg: string): boolean {
  return /^[A-Z]{1,3}-\d{1,2}$/.test(seg);
}

function taskHref(projectId: string, href: string): string | null {
  const prefix = `/projects/${projectId}/credits/`;
  if (!href.startsWith(prefix)) return null;
  return href;
}

function linkCodes(text: string, projectId: string, key: string): ReactNode[] {
  return text.split(/(\b[A-Z]{1,3}-\d{1,2}\b)/g).map((seg, i) =>
    isCreditCode(seg) ? (
      <Link
        key={`${key}-${i}`}
        href={`/projects/${projectId}/credits/${seg}`}
        className="font-medium text-brand-700 underline-offset-2 hover:underline"
      >
        {seg}
      </Link>
    ) : (
      <span key={`${key}-${i}`}>{seg}</span>
    ),
  );
}

function renderInline(text: string, projectId: string): ReactNode[] {
  return text.split(/(\[[^\]]+\]\([^)]+\)|\*\*[^*]+\*\*)/g).flatMap((seg, j) => {
    const md = seg.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (md) {
      const href = taskHref(projectId, md[2]);
      if (href)
        return [
          <Link
            key={j}
            href={href}
            className="font-medium text-brand-700 underline-offset-2 hover:underline"
          >
            {md[1]}
          </Link>,
        ];
      return [<span key={j}>{seg}</span>];
    }
    if (seg.startsWith("**") && seg.endsWith("**"))
      return [
        <strong key={j}>{linkCodes(seg.slice(2, -2), projectId, `${j}b`)}</strong>,
      ];
    return linkCodes(seg, projectId, String(j));
  });
}

/** Very small markdown-ish renderer (bold, links, bullets) — no external deps. */
function renderText(text: string, projectId: string) {
  return text.split("\n").map((line, i) => {
    const bulleted = line.startsWith("- ");
    const content = bulleted ? line.slice(2) : line;
    return (
      <p
        key={i}
        className={bulleted ? "ml-4 list-item list-disc" : line ? "" : "h-2"}
      >
        {renderInline(content, projectId)}
      </p>
    );
  });
}

export function Chat({ projectId }: { projectId: string }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [pending, startTransition] = useTransition();

  function send(question: string) {
    const q = question.trim();
    if (!q || pending) return;
    setInput("");
    setTurns((t) => [...t, { role: "user", text: q }]);
    startTransition(async () => {
      try {
        const answer = await ask(projectId, q);
        setTurns((t) => [
          ...t,
          { role: "assistant", text: answer.answer, answer },
        ]);
      } catch {
        setTurns((t) => [
          ...t,
          {
            role: "assistant",
            text: "Something went wrong answering that. Please try again.",
          },
        ]);
      }
    });
  }

  return (
    <div className="flex h-[calc(100vh-16rem)] flex-col rounded-xl border border-slate-200 bg-white">
      <div className="flex-1 overflow-y-auto p-5">
        {turns.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              <BotIcon width={24} height={24} />
            </span>
            <h3 className="mt-3 font-semibold text-slate-800">
              Grounded project assistant
            </h3>
            <p className="mt-1 max-w-md text-sm text-slate-500">
              Answers come only from this project&rsquo;s confirmed credits and
              requirements, with citations. It won&rsquo;t invent credits, points,
              or limits.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {QUICK.map((q) => (
                <button
                  key={q}
                  onClick={() => send(q)}
                  className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {turns.map((t, i) => (
              <div
                key={i}
                className={t.role === "user" ? "flex justify-end" : ""}
              >
                <div
                  className={
                    t.role === "user"
                      ? "max-w-[80%] rounded-2xl rounded-br-sm bg-brand-600 px-4 py-2.5 text-sm text-white"
                      : "max-w-[85%] rounded-2xl rounded-bl-sm bg-slate-50 px-4 py-3 text-sm text-slate-700 ring-1 ring-slate-100"
                  }
                >
                  <div className="space-y-0.5">
                    {renderText(t.text, projectId)}
                  </div>
                  {t.answer && t.answer.citations.length > 0 ? (
                    <div className="mt-3 border-t border-slate-200 pt-2">
                      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        Citations
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {t.answer.citations.map((c) => (
                          <a
                            key={c.code}
                            href={`/projects/${projectId}/credits/${c.code}`}
                            className="rounded-md bg-white px-2 py-0.5 text-xs font-medium text-brand-700 ring-1 ring-brand-600/20 hover:bg-brand-50"
                            title={c.title}
                          >
                            {c.ref}
                          </a>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {t.answer ? (
                    <div className="mt-2 text-[10px] uppercase tracking-wider text-slate-300">
                      grounded · {t.answer.via}
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
            {pending ? (
              <div className="text-sm text-slate-400">Thinking…</div>
            ) : null}
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex gap-2 border-t border-slate-100 p-4"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask what's left, what's missing, or a credit's status…"
          className="input flex-1"
        />
        <button
          type="submit"
          disabled={pending || !input.trim()}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          Ask
        </button>
      </form>
    </div>
  );
}

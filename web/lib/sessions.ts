"use client";

import { useSyncExternalStore } from "react";

export interface ChatSession {
  id: string;
  /** Display title, derived from the first user message. */
  title: string;
  /** The Pi model id the conversation was created with, e.g. "anthropic/claude-opus-5". */
  model?: string;
  createdAt: number;
}

const STORAGE_KEY = "flue-chat-sessions";
const listeners = new Set<() => void>();
let cache: ChatSession[] | null = null;

function read(): ChatSession[] {
  if (cache) return cache;
  if (typeof window === "undefined") return [];
  try {
    cache = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    cache = [];
  }
  return cache!;
}

function write(sessions: ChatSession[]) {
  cache = sessions;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const EMPTY: ChatSession[] = [];

export function useChatSessions(): ChatSession[] {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

export function getSession(id: string): ChatSession | undefined {
  return read().find((session) => session.id === id);
}

export function saveSession(session: ChatSession) {
  write([session, ...read().filter((s) => s.id !== session.id)]);
}

export function removeSession(id: string) {
  write(read().filter((s) => s.id !== id));
}

export function newSessionId(): string {
  return `chat-${crypto.randomUUID().slice(0, 13)}`;
}

/** First line of a message, trimmed to a sidebar-friendly length. */
export function chatTitle(text: string): string {
  const line = text.trim().split("\n", 1)[0];
  return line.length > 60 ? `${line.slice(0, 60).trimEnd()}…` : line || "New chat";
}

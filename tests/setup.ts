import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(cleanup);

const storage = new Map<string, unknown>();
Object.defineProperty(globalThis, "chrome", { configurable: true, value: {
  runtime: { getURL: (path: string) => `chrome-extension://test/${path}`, onMessage: { addListener: () => undefined }, sendMessage: async () => ({ ok: true }) },
  storage: {
    local: { get: async (key: string) => ({ [key]: storage.get(key) }), set: async (values: Record<string, unknown>) => { Object.entries(values).forEach(([key, value]) => storage.set(key, value)); } },
    session: { get: async (key: string) => ({ [key]: storage.get(key) }), set: async (values: Record<string, unknown>) => { Object.entries(values).forEach(([key, value]) => storage.set(key, value)); }, remove: async (key: string) => { storage.delete(key); } },
  },
  tabs: { create: async () => undefined, query: async () => [] },
} });

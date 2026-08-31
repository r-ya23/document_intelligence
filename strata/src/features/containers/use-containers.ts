// In-memory container/extraction store — UI-only, resets on page reload. Deliberately not
// react-query/Supabase backed: containers aren't a DB concept yet (see types.ts). Uses a tiny
// external-store pattern (subscribe/getSnapshot) so multiple components stay in sync without
// prop-drilling or context, the same way useSyncExternalStore-based libraries work.
import { useSyncExternalStore } from "react";
import type { Container, Extraction, NewContainerInput, NewExtractionInput } from "./types";

interface StoreState {
  containers: Container[];
  extractions: Extraction[];
}

function seedState(): StoreState {
  const now = Date.now();
  return {
    containers: [
      {
        id: "c1",
        name: "Vendor invoices",
        docType: "invoice",
        defaultMode: "auto",
        createdAt: new Date(now - 60 * 86400_000).toISOString(),
      },
      {
        id: "c2",
        name: "Employee records",
        docType: "resume",
        defaultMode: "manual",
        createdAt: new Date(now - 20 * 86400_000).toISOString(),
      },
    ],
    extractions: [
      {
        id: "e1",
        containerId: "c1",
        label: "Batch — 4 Aug",
        docCount: 12,
        createdAt: new Date(now - 2 * 3600_000).toISOString(),
        status: "published",
        documentIds: [],
      },
      {
        id: "e2",
        containerId: "c1",
        label: "Batch — 19 Jul",
        docCount: 9,
        createdAt: new Date(now - 42 * 86400_000).toISOString(),
        status: "published",
        documentIds: [],
      },
      {
        id: "e3",
        containerId: "c2",
        label: "Backend role — batch 1",
        docCount: 28,
        createdAt: new Date(now - 3 * 86400_000).toISOString(),
        status: "published",
        documentIds: [],
      },
    ],
  };
}

let state: StoreState = seedState();
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return state;
}

function createContainer(input: NewContainerInput): Container {
  const container: Container = {
    id: `c${Date.now()}`,
    name: input.name,
    docType: input.docType,
    defaultMode: input.defaultMode,
    createdAt: new Date().toISOString(),
  };
  state = { ...state, containers: [container, ...state.containers] };
  emit();
  return container;
}

function recordExtraction(input: NewExtractionInput): Extraction {
  const extraction: Extraction = {
    id: `e${Date.now()}`,
    containerId: input.containerId,
    label: `Batch — ${new Date().toLocaleDateString(undefined, { day: "2-digit", month: "short" })}`,
    docCount: input.docCount,
    createdAt: new Date().toISOString(),
    status: "published",
    documentIds: input.documentIds,
  };
  state = { ...state, extractions: [...state.extractions, extraction] };
  emit();
  return extraction;
}

export const containerStore = {
  subscribe,
  getSnapshot,
  createContainer,
  recordExtraction,
};

export function useContainers() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot);
  return snapshot.containers;
}

export function useContainer(containerId: string | undefined) {
  const containers = useContainers();
  return containers.find((c) => c.id === containerId);
}

export function useAllExtractions() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot);
  return snapshot.extractions;
}

export function useExtractions(containerId: string | undefined) {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot);
  if (!containerId) return [];
  return snapshot.extractions
    .filter((e) => e.containerId === containerId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

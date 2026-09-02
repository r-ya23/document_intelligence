import { describe, it, expect, beforeEach, vi } from "vitest";
import { containerStore } from "@/features/containers/use-containers";

// The containerStore is a module-level singleton. Reset it between tests
// by re-importing the module fresh via resetModules, OR just work with the
// live store and assert relative changes. We use the latter here: capture
// the count before and after each mutating call.
//
// NOTE: Because the store is a singleton, test order matters if tests mutate
// state without resetting. We capture "before" snapshots in each test to
// isolate assertions from the seed data already present.

describe("containerStore", () => {
  // ── subscribe / notify ───────────────────────────────────────────────────

  describe("subscribe", () => {
    it("calls the listener when a mutation occurs", () => {
      const listener = vi.fn();
      const unsub = containerStore.subscribe(listener);

      containerStore.createContainer({
        name: "Test Container",
        docType: "invoice",
        defaultMode: "auto",
      });

      expect(listener).toHaveBeenCalledTimes(1);
      unsub();
    });

    it("returns an unsubscribe function that stops future notifications", () => {
      const listener = vi.fn();
      const unsub = containerStore.subscribe(listener);
      unsub();

      containerStore.createContainer({
        name: "After unsub",
        docType: "contract",
        defaultMode: "manual",
      });

      expect(listener).not.toHaveBeenCalled();
    });
  });

  // ── createContainer ──────────────────────────────────────────────────────

  describe("createContainer", () => {
    it("adds a new container to the front of the list", () => {
      const before = containerStore.getSnapshot().containers.length;

      containerStore.createContainer({
        name: "New Container",
        docType: "resume",
        defaultMode: "manual",
      });

      const { containers } = containerStore.getSnapshot();
      expect(containers).toHaveLength(before + 1);
      // createContainer prepends, so the new one is first
      expect(containers[0].name).toBe("New Container");
    });

    it("creates a container with the correct shape", () => {
      const input = {
        name: "Shape Test",
        docType: "other" as const,
        defaultMode: "auto" as const,
      };
      const result = containerStore.createContainer(input);

      expect(result).toMatchObject({
        name: input.name,
        docType: input.docType,
        defaultMode: input.defaultMode,
      });
      expect(typeof result.id).toBe("string");
      expect(result.id.length).toBeGreaterThan(0);
      expect(typeof result.createdAt).toBe("string");
    });

    it("returns the newly created container", () => {
      const result = containerStore.createContainer({
        name: "Returned Container",
        docType: "invoice",
        defaultMode: "auto",
      });

      expect(result.name).toBe("Returned Container");
    });
  });

  // ── recordExtraction ─────────────────────────────────────────────────────

  describe("recordExtraction", () => {
    it("appends the extraction to the list", () => {
      const container = containerStore.createContainer({
        name: "Container for Extraction",
        docType: "invoice",
        defaultMode: "auto",
      });

      const before = containerStore.getSnapshot().extractions.length;

      containerStore.recordExtraction({
        containerId: container.id,
        docCount: 5,
        mode: "auto",
        documentIds: ["doc-a", "doc-b"],
      });

      const after = containerStore.getSnapshot().extractions.length;
      expect(after).toBe(before + 1);
    });

    it("stores the correct containerId, docCount, and documentIds", () => {
      const container = containerStore.createContainer({
        name: "Container for Fields Test",
        docType: "contract",
        defaultMode: "manual",
      });

      const result = containerStore.recordExtraction({
        containerId: container.id,
        docCount: 12,
        mode: "manual",
        documentIds: ["x1", "x2", "x3"],
      });

      expect(result.containerId).toBe(container.id);
      expect(result.docCount).toBe(12);
      expect(result.documentIds).toEqual(["x1", "x2", "x3"]);
      expect(result.status).toBe("published");
    });

    it("notifies listeners after recording an extraction", () => {
      const container = containerStore.createContainer({
        name: "Listener Container",
        docType: "other",
        defaultMode: "auto",
      });
      const listener = vi.fn();
      const unsub = containerStore.subscribe(listener);

      containerStore.recordExtraction({
        containerId: container.id,
        docCount: 1,
        mode: "auto",
        documentIds: [],
      });

      expect(listener).toHaveBeenCalledTimes(1);
      unsub();
    });
  });

  // ── getSnapshot immutability ─────────────────────────────────────────────

  describe("getSnapshot", () => {
    it("returns the same reference until a mutation occurs (reference equality)", () => {
      const snap1 = containerStore.getSnapshot();
      const snap2 = containerStore.getSnapshot();
      expect(snap1).toBe(snap2);
    });

    it("returns a NEW reference after a mutation", () => {
      const before = containerStore.getSnapshot();

      containerStore.createContainer({
        name: "Trigger mutation",
        docType: "invoice",
        defaultMode: "auto",
      });

      const after = containerStore.getSnapshot();
      expect(after).not.toBe(before);
    });
  });
});

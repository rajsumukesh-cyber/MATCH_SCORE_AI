import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import {
  beginScreeningRun,
  completeScreeningRun,
  screenQueuedCandidate,
} from "@/lib/screening.functions";

export type QueueItemStatus = "queued" | "running" | "done" | "failed" | "cancelled";

export interface QueueItem {
  resumeId: string;
  title: string;
  index: number;
  status: QueueItemStatus;
  attempts: number;
  score?: number;
  selected?: boolean;
  error?: string;
}

const MAX_ATTEMPTS = 3;
const CONCURRENCY = 2;

export interface StartQueueInput {
  jobDescriptionId: string;
  cutoff: number;
  anonymize: boolean;
  resumes: { id: string; title: string }[];
}

/**
 * Runs a batch screening as a client-driven queue: each resume is scored by
 * its own server call, so the UI can show live progress, automatic retries
 * and per-candidate retry buttons instead of one opaque request.
 */
export function useScreeningQueue() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [screeningId, setScreeningId] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const cancelled = useRef(false);
  const redacted = useRef(0);

  const patch = useCallback((resumeId: string, next: Partial<QueueItem>) => {
    setItems((prev) => prev.map((i) => (i.resumeId === resumeId ? { ...i, ...next } : i)));
  }, []);

  const processOne = useCallback(
    async (runId: string, item: QueueItem, attempt: number): Promise<boolean> => {
      patch(item.resumeId, { status: "running", attempts: attempt, error: undefined });
      try {
        const result = await screenQueuedCandidate({
          data: { screeningId: runId, resumeId: item.resumeId, index: item.index },
        });
        redacted.current += result.redactedCount ?? 0;
        patch(item.resumeId, {
          status: "done",
          score: result.score,
          selected: result.selected,
        });
        return true;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Scoring failed.";
        if (attempt < MAX_ATTEMPTS && !cancelled.current) {
          await new Promise((r) => setTimeout(r, 800 * attempt));
          return processOne(runId, item, attempt + 1);
        }
        patch(item.resumeId, { status: "failed", error: message, attempts: attempt });
        return false;
      }
    },
    [patch],
  );

  const start = useCallback(
    async (input: StartQueueInput) => {
      cancelled.current = false;
      redacted.current = 0;
      setFinished(false);
      setRunning(true);
      setScreeningId(null);

      const queue: QueueItem[] = input.resumes.map((r, index) => ({
        resumeId: r.id,
        title: r.title,
        index,
        status: "queued",
        attempts: 0,
      }));
      setItems(queue);

      let runId: string;
      try {
        const run = await beginScreeningRun({
          data: {
            jobDescriptionId: input.jobDescriptionId,
            cutoff: input.cutoff,
            anonymize: input.anonymize,
            candidateCount: queue.length,
          },
        });
        runId = run.screeningId;
        setScreeningId(runId);
      } catch (error) {
        setRunning(false);
        toast.error(error instanceof Error ? error.message : "Could not start the screening.");
        return null;
      }

      let cursor = 0;
      let failures = 0;
      const worker = async () => {
        while (cursor < queue.length && !cancelled.current) {
          const item = queue[cursor++]!;
          const ok = await processOne(runId, item, 1);
          if (!ok) failures += 1;
        }
      };
      await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker));

      if (cancelled.current) {
        setItems((prev) =>
          prev.map((i) => (i.status === "queued" ? { ...i, status: "cancelled" } : i)),
        );
      }

      await completeScreeningRun({
        data: { screeningId: runId, failedCount: failures, redactedFields: redacted.current },
      }).catch(() => null);

      setRunning(false);
      setFinished(true);
      return runId;
    },
    [processOne],
  );

  const retryOne = useCallback(
    async (resumeId: string) => {
      if (!screeningId) return;
      const item = items.find((i) => i.resumeId === resumeId);
      if (!item) return;
      cancelled.current = false;
      const ok = await processOne(screeningId, item, 1);
      const remainingFailures = items.filter(
        (i) => i.status === "failed" && i.resumeId !== resumeId,
      ).length;
      await completeScreeningRun({
        data: {
          screeningId,
          failedCount: remainingFailures + (ok ? 0 : 1),
          redactedFields: redacted.current,
        },
      }).catch(() => null);
    },
    [items, processOne, screeningId],
  );

  const retryFailed = useCallback(async () => {
    const failed = items.filter((i) => i.status === "failed");
    for (const item of failed) await retryOne(item.resumeId);
  }, [items, retryOne]);

  const cancel = useCallback(() => {
    cancelled.current = true;
  }, []);

  const reset = useCallback(() => {
    setItems([]);
    setScreeningId(null);
    setFinished(false);
  }, []);

  const done = items.filter((i) => i.status === "done").length;
  const failed = items.filter((i) => i.status === "failed").length;
  const total = items.length;
  const progress = total === 0 ? 0 : Math.round(((done + failed) / total) * 100);

  return {
    items,
    start,
    retryOne,
    retryFailed,
    cancel,
    reset,
    running,
    finished,
    screeningId,
    done,
    failed,
    total,
    progress,
  };
}

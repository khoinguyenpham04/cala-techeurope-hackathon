import { PROPAGATE_HZ } from "../lib/orbit/constants";
import { prepareSatrec, propagateVisible, type PreparedSat } from "../lib/orbit/propagate";
import type { ObserverLocation, OrbitWorkerIn, OrbitWorkerOut, SlimOmm } from "../lib/orbit/types";

let catalog: PreparedSat[] = [];
let observer: ObserverLocation | null = null;
/** null means wall clock; a number pins propagation to a fixed epoch (fixtures). */
let epochMs: number | null = null;
let timer: ReturnType<typeof setInterval> | null = null;

function emit(message: OrbitWorkerOut) {
  self.postMessage(message);
}

function tick() {
  if (!observer || catalog.length === 0) return;
  const date = new Date(epochMs ?? Date.now());
  try {
    const satellites = propagateVisible(catalog, date, observer);
    emit({ type: "visible", epochMs: date.getTime(), satellites });
  } catch (cause) {
    emit({
      type: "error",
      message: cause instanceof Error ? cause.message : "Propagation failed.",
    });
  }
}

function ensureTimer() {
  if (timer) return;
  tick();
  timer = setInterval(tick, 1000 / PROPAGATE_HZ);
}

function ingestCatalog(records: SlimOmm[]) {
  const next: PreparedSat[] = [];
  for (const record of records) {
    const prepared = prepareSatrec(record);
    if (prepared) next.push(prepared);
  }
  catalog = next;
}

self.onmessage = (event: MessageEvent<OrbitWorkerIn>) => {
  const message = event.data;
  switch (message.type) {
    case "catalog":
      ingestCatalog(message.records);
      ensureTimer();
      tick();
      break;
    case "observer":
      observer = message.observer;
      ensureTimer();
      tick();
      break;
    case "clock":
      epochMs = message.epochMs;
      tick();
      break;
    default:
      break;
  }
};

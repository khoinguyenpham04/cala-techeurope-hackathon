import { PROPAGATE_HZ } from "../lib/orbit/constants";
import { prepareSatrec, propagateVisibleInto, type PreparedSat } from "../lib/orbit/propagate";
import { createVisibleBuffers, VISIBLE_FLOAT_STRIDE } from "../lib/orbit/sample-buffer";
import type { ObserverLocation, OrbitWorkerIn, OrbitWorkerOut, SlimOmm } from "../lib/orbit/types";

/** satrec from json2satrec, built once per catalog ingest — never per tick. */
let catalog: PreparedSat[] = [];
let observer: ObserverLocation | null = null;
/** null means wall clock; a number pins propagation to a fixed epoch (fixtures). */
let epochMs: number | null = null;
/** Cinematic default is the full catalog shell; HUD "Above city" posts true. */
let horizonOnly = false;
let timer: ReturnType<typeof setInterval> | null = null;
const tickBuffers = createVisibleBuffers();

function emit(message: OrbitWorkerOut) {
  self.postMessage(message);
}

function tick() {
  if (!observer || catalog.length === 0) return;
  const date = new Date(epochMs ?? Date.now());
  try {
    const count = propagateVisibleInto(catalog, date, observer, { horizonOnly }, tickBuffers);
    emit({
      type: "visible",
      epochMs: date.getTime(),
      count,
      floats: tickBuffers.floats.subarray(0, count * VISIBLE_FLOAT_STRIDE),
      noradIds: tickBuffers.noradIds.subarray(0, count),
      names: tickBuffers.names,
      objectIds: tickBuffers.objectIds,
    });
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
    case "filter":
      horizonOnly = message.horizonOnly;
      tick();
      break;
    default:
      break;
  }
};

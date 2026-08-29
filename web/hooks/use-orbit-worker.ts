"use client";

import type { ObserverLocation, OrbitWorkerIn, OrbitWorkerOut, SlimOmm, VisibleSatellite } from "@/lib/orbit/types";
import { startTransition, useEffect, useRef, useState } from "react";

export function useOrbitWorker(
  records: SlimOmm[] | undefined,
  observer: ObserverLocation,
) {
  const workerRef = useRef<Worker | null>(null);
  const [visible, setVisible] = useState<VisibleSatellite[]>([]);
  const [epochMs, setEpochMs] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const worker = new Worker(new URL("../workers/orbit.worker.ts", import.meta.url), {
      type: "module",
    });
    workerRef.current = worker;
    worker.onmessage = (event: MessageEvent<OrbitWorkerOut>) => {
      const message = event.data;
      if (message.type === "visible") {
        startTransition(() => {
          setVisible(message.satellites);
          setEpochMs(message.epochMs);
          setError(null);
        });
        return;
      }
      setError(message.message);
    };
    worker.onerror = (event) => {
      setError(event.message || "Orbit worker failed.");
    };
    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const worker = workerRef.current;
    if (!worker) return;
    const message: OrbitWorkerIn = { type: "observer", observer };
    worker.postMessage(message);
  }, [observer, observer.latitudeDeg, observer.longitudeDeg, observer.heightKm]);

  useEffect(() => {
    const worker = workerRef.current;
    if (!worker || !records) return;
    const message: OrbitWorkerIn = { type: "catalog", records };
    worker.postMessage(message);
  }, [records]);

  return { visible, epochMs, error };
}

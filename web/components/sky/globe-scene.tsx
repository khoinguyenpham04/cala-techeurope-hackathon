"use client";

import "@/components/sky/cobe-globe.css";

import { SatelliteIcon } from "@/components/sky/satellite-icon";
import {
  CITY_MARKER_ID,
  LOOK_ARC_ID,
  cobeArcStyle,
  cobeMarkerStyle,
  lerpAngle,
  locationToAngles,
  lookArcStations,
  markerIdForNorad,
} from "@/lib/orbit/cobe-view";
import {
  COBE_CITY_MARKER_SIZE,
  COBE_HIT_TARGET_MAX,
  COBE_MAX_MARKERS,
  COBE_SAT_MARKER_SIZE,
  COBE_SAT_SELECTED_MARKER_SIZE,
} from "@/lib/orbit/constants";
import { cssColorToRgb } from "@/lib/orbit/css-color";
import { overlayFor, resolveDotColor } from "@/lib/orbit/overlay";
import {
  getOrbitSamplePair,
  lerpSampleGeodetic,
  sampleAlpha,
  type GeodeticScratch,
} from "@/lib/orbit/sample-buffer";
import type { City } from "@/lib/geo/cities";
import type { SatelliteOverlayMap, VisibleSatellite } from "@/lib/orbit/types";
import createGlobe, { type Arc, type COBEOptions, type Marker } from "cobe";
import { useTheme } from "next-themes";
import { useEffect, useMemo, useRef } from "react";

const SELECTED_RGB: [number, number, number] = [0.29, 0.871, 0.502];
const SELECTED_CSS = "rgb(74 222 128)";
const CITY_RGB: [number, number, number] = [0.2, 0.4, 1];
const ARC_RGB: [number, number, number] = [0.35, 0.55, 1];
const geoScratch: GeodeticScratch = { latitudeDeg: 0, longitudeDeg: 0, altitudeKm: 0 };

type CobeLook = Pick<
  COBEOptions,
  | "dark"
  | "diffuse"
  | "mapBrightness"
  | "mapBaseBrightness"
  | "baseColor"
  | "glowColor"
  | "markerColor"
>;

const LIGHT_LOOK: CobeLook = {
  dark: 0,
  diffuse: 1.2,
  mapBrightness: 6,
  mapBaseBrightness: 0.02,
  baseColor: [1, 1, 1],
  glowColor: [1, 1, 1],
  markerColor: CITY_RGB,
};

const DARK_LOOK: CobeLook = {
  dark: 1,
  diffuse: 1.2,
  mapBrightness: 6,
  mapBaseBrightness: 0.05,
  baseColor: [0.42, 0.48, 0.62],
  glowColor: [0.12, 0.16, 0.24],
  markerColor: CITY_RGB,
};

function lookForTheme(resolvedTheme: string | undefined): CobeLook {
  return resolvedTheme === "light" ? LIGHT_LOOK : DARK_LOOK;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function GlobeScene({
  city,
  visible,
  overlay,
  selectedNoradId,
  onSelect,
}: {
  city: City;
  visible: VisibleSatellite[];
  overlay: SatelliteOverlayMap;
  selectedNoradId: string | null;
  onSelect: (noradId: string | null) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cityRef = useRef(city);
  const overlayRef = useRef(overlay);
  const visibleRef = useRef(visible);
  const selectedRef = useRef(selectedNoradId);
  const onSelectRef = useRef(onSelect);
  const focusRef = useRef(locationToAngles(city.latitudeDeg, city.longitudeDeg));
  const { resolvedTheme } = useTheme();
  const lookRef = useRef(lookForTheme(resolvedTheme));
  cityRef.current = city;
  overlayRef.current = overlay;
  visibleRef.current = visible;
  selectedRef.current = selectedNoradId;
  onSelectRef.current = onSelect;
  lookRef.current = lookForTheme(resolvedTheme);

  const hits = useMemo(() => {
    const seen = new Set<string>();
    const rows: Array<{ noradId: string; name: string; color: string; selected: boolean }> = [];
    const selected = visible.find((sat) => sat.noradId === selectedNoradId);
    if (selected) {
      rows.push({
        noradId: selected.noradId,
        name: selected.name,
        color: SELECTED_CSS,
        selected: true,
      });
      seen.add(selected.noradId);
    }
    for (const sat of visible) {
      if (rows.length >= COBE_HIT_TARGET_MAX) break;
      if (seen.has(sat.noradId)) continue;
      seen.add(sat.noradId);
      rows.push({
        noradId: sat.noradId,
        name: sat.name,
        color: resolveDotColor(overlayFor(overlay, sat.noradId)),
        selected: false,
      });
    }
    return rows;
  }, [visible, selectedNoradId, overlay]);

  const selected = selectedNoradId
    ? visible.find((sat) => sat.noradId === selectedNoradId)
    : undefined;

  useEffect(() => {
    focusRef.current = locationToAngles(city.latitudeDeg, city.longitudeDeg);
  }, [city.id, city.latitudeDeg, city.longitudeDeg]);

  useEffect(() => {
    if (!selectedNoradId) return;
    const sat = visibleRef.current.find((row) => row.noradId === selectedNoradId);
    if (!sat) return;
    focusRef.current = locationToAngles(sat.latitudeDeg, sat.longitudeDeg);
  }, [selectedNoradId]);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = locationToAngles(cityRef.current.latitudeDeg, cityRef.current.longitudeDeg);
    let phi = start.phi;
    let theta = start.theta;
    let scale = 1.05;
    let dragging = false;
    let moved = false;
    let pointerId: number | null = null;
    let lastX = 0;
    let lastY = 0;
    let raf = 0;
    const markers: Marker[] = [];
    const arcs: Arc[] = [];

    const pixelSize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const width = Math.max(16, wrap.clientWidth);
      const height = Math.max(16, wrap.clientHeight);
      return { width: width * dpr, height: height * dpr, dpr };
    };

    const size = pixelSize();
    const globe = createGlobe(canvas, {
      devicePixelRatio: size.dpr,
      width: size.width,
      height: size.height,
      phi,
      theta,
      ...lookRef.current,
      mapSamples: 16_000,
      markers: [],
      arcs: [],
      arcColor: ARC_RGB,
      arcWidth: 0.5,
      arcHeight: 0.62,
      markerElevation: 0.02,
      scale,
      opacity: 1,
      offset: [0, 0],
      context: { alpha: true, antialias: true, preserveDrawingBuffer: false },
    });

    const fillMarkers = () => {
      const pair = getOrbitSamplePair();
      const t = sampleAlpha(performance.now() - pair.curr.arrivedAtMs);
      const overlayMap = overlayRef.current;
      const selectedId = selectedRef.current;
      const cityNow = cityRef.current;
      const count = Math.min(pair.curr.count, COBE_MAX_MARKERS);
      markers.length = 0;
      arcs.length = 0;

      markers.push({
        id: CITY_MARKER_ID,
        location: [cityNow.latitudeDeg, cityNow.longitudeDeg],
        size: COBE_CITY_MARKER_SIZE,
        color: CITY_RGB,
      });

      let selectedLocation: [number, number] | null = null;
      for (let index = 0; index < count; index += 1) {
        lerpSampleGeodetic(geoScratch, pair, index, t);
        const noradId = String(pair.curr.noradIds[index]!);
        const isSelected = noradId === selectedId;
        const location: [number, number] = [geoScratch.latitudeDeg, geoScratch.longitudeDeg];
        if (isSelected) selectedLocation = location;
        markers.push({
          id: markerIdForNorad(noradId),
          location,
          size: isSelected ? COBE_SAT_SELECTED_MARKER_SIZE : COBE_SAT_MARKER_SIZE,
          color: isSelected
            ? SELECTED_RGB
            : cssColorToRgb(resolveDotColor(overlayFor(overlayMap, noradId))),
        });
      }

      if (selectedId && !selectedLocation) {
        for (let index = count; index < pair.curr.count; index += 1) {
          if (String(pair.curr.noradIds[index]!) !== selectedId) continue;
          lerpSampleGeodetic(geoScratch, pair, index, t);
          selectedLocation = [geoScratch.latitudeDeg, geoScratch.longitudeDeg];
          markers.push({
            id: markerIdForNorad(selectedId),
            location: selectedLocation,
            size: COBE_SAT_SELECTED_MARKER_SIZE,
            color: SELECTED_RGB,
          });
          break;
        }
      }

      if (selectedLocation) {
        const stations = lookArcStations(
          cityNow.latitudeDeg,
          cityNow.longitudeDeg,
          selectedLocation[0],
          selectedLocation[1],
        );
        for (let index = 0; index < stations.length - 1; index += 1) {
          arcs.push({
            id: index === 0 ? LOOK_ARC_ID : undefined,
            from: stations[index]!,
            to: stations[index + 1]!,
            color: SELECTED_RGB,
          });
        }
      }
    };

    const tick = () => {
      const target = focusRef.current;
      if (!dragging) {
        phi = lerpAngle(phi, target.phi, reducedMotion ? 1 : 0.08);
        theta = lerpAngle(theta, target.theta, reducedMotion ? 1 : 0.08);
      }

      fillMarkers();
      const size = pixelSize();
      globe.update({
        devicePixelRatio: size.dpr,
        width: size.width,
        height: size.height,
        phi,
        theta,
        scale,
        markers,
        arcs,
        ...lookRef.current,
      });
      raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);

    const onPointerDown = (event: PointerEvent) => {
      dragging = true;
      moved = false;
      pointerId = event.pointerId;
      lastX = event.clientX;
      lastY = event.clientY;
      canvas.setPointerCapture(event.pointerId);
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!dragging || event.pointerId !== pointerId) return;
      const dx = event.clientX - lastX;
      const dy = event.clientY - lastY;
      if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
      lastX = event.clientX;
      lastY = event.clientY;
      phi += dx / 220;
      theta = clamp(theta + dy / 220, -0.9, 0.9);
      focusRef.current = { phi, theta };
    };
    const endPointer = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) return;
      dragging = false;
      pointerId = null;
      if (!moved) onSelectRef.current(null);
    };

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      scale = clamp(scale - event.deltaY * 0.001, 0.72, 1.55);
    };

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", endPointer);
    canvas.addEventListener("pointercancel", endPointer);
    canvas.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      window.cancelAnimationFrame(raf);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", endPointer);
      canvas.removeEventListener("pointercancel", endPointer);
      canvas.removeEventListener("wheel", onWheel);
      globe.destroy();
    };
  }, []);

  return (
    <div className="sky-cobe" ref={wrapRef}>
      <canvas
        aria-label="Satellite globe"
        ref={canvasRef}
      />
      <div className="sky-cobe-label" style={cobeMarkerStyle(CITY_MARKER_ID)}>
        {city.name}
      </div>
      {selected ? (
        <div
          className="sky-cobe-label"
          style={cobeMarkerStyle(markerIdForNorad(selected.noradId))}
        >
          {selected.name}
        </div>
      ) : null}
      {selected ? (
        <div className="sky-cobe-label" style={cobeArcStyle(LOOK_ARC_ID)}>
          {city.name} → {selected.name}
        </div>
      ) : null}
      {hits.map((hit) => (
        <button
          aria-label={hit.name}
          className="sky-cobe-hit"
          data-selected={hit.selected ? "true" : undefined}
          key={hit.noradId}
          onClick={(event) => {
            event.stopPropagation();
            onSelect(hit.noradId);
          }}
          style={{
            ...cobeMarkerStyle(markerIdForNorad(hit.noradId)),
            color: hit.color,
          }}
          type="button"
        >
          <SatelliteIcon className="size-full" />
        </button>
      ))}
    </div>
  );
}

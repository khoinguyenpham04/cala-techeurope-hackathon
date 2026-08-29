"use client";

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { Button } from "@/components/ui/button";
import type { VisibleSatellite } from "@/lib/orbit/types";
import { useEffect, useMemo, useState } from "react";

const MATCH_LIMIT = 40;

function filterVisible(visible: VisibleSatellite[], query: string): VisibleSatellite[] {
  const q = query.trim().toLowerCase();
  const matches: VisibleSatellite[] = [];
  for (const sat of visible) {
    if (
      !q ||
      sat.name.toLowerCase().includes(q) ||
      sat.noradId.includes(q) ||
      sat.objectId.toLowerCase().includes(q)
    ) {
      matches.push(sat);
      if (matches.length >= MATCH_LIMIT) break;
    }
  }
  return matches;
}

export function SatelliteSearch({
  visible,
  selected,
  onSelect,
  onDemoPick,
}: {
  visible: VisibleSatellite[];
  selected: VisibleSatellite | null;
  onSelect: (noradId: string | null) => void;
  onDemoPick: () => void;
}) {
  const [query, setQuery] = useState("");
  const matches = useMemo(() => filterVisible(visible, query), [query, visible]);

  useEffect(() => {
    setQuery(selected?.name ?? "");
  }, [selected?.name, selected?.noradId]);

  return (
    <div className="flex max-w-full items-center gap-2">
      <Combobox
        autoHighlight
        inputValue={query}
        isItemEqualToValue={(item, value) => item.noradId === value?.noradId}
        items={matches}
        itemToStringLabel={(sat) => sat.name}
        onInputValueChange={(value) => setQuery(value)}
        onValueChange={(sat) => {
          onSelect(sat?.noradId ?? null);
          setQuery(sat ? sat.name : "");
        }}
        value={selected}
      >
        <ComboboxInput
          aria-label="Filter tracked satellites by name or NORAD ID"
          className="w-[min(100%,16.5rem)] bg-black/35"
          placeholder="Name or NORAD ID"
          showClear={Boolean(selected || query)}
        />
        <ComboboxContent align="start" className="w-(--anchor-width)">
          <ComboboxEmpty>No tracked match</ComboboxEmpty>
          <ComboboxList>
            {matches.map((sat) => (
              <ComboboxItem key={sat.noradId} value={sat}>
                <span className="min-w-0 flex-1 truncate">{sat.name}</span>
                <span className="ml-auto font-mono text-[10px] text-sky-400 tabular-nums">
                  #{sat.noradId}
                </span>
              </ComboboxItem>
            ))}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
      <Button
        className="border-white/10 bg-black/35 text-sky-100 hover:bg-white/10"
        onClick={onDemoPick}
        size="sm"
        title="Open a source-backed Sentinel example"
        variant="outline"
      >
        Demo pick
      </Button>
    </div>
  );
}

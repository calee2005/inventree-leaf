import { useEffect, useState } from "react";
import { listStockLocations, readError } from "../api";
import { Notice } from "../Notice";
import type { CommandFailure, LookupHit } from "../types";
import { SelectField } from "./SelectField";

type Props = {
  serverId: string;
  label: string;
  hint?: string;
  value: LookupHit | null;
  onChange: (value: LookupHit | null) => void;
};

export function LocationSelect({ serverId, label, hint, value, onChange }: Props) {
  const [options, setOptions] = useState<LookupHit[]>([]);
  const [error, setError] = useState<CommandFailure | null>(null);

  useEffect(() => {
    let active = true;
    loadLocations(serverId)
      .then((items) => {
        if (!active) {
          return;
        }
        setOptions(items);
        setError(null);
      })
      .catch((reason: unknown) => {
        if (active) {
          setError(readError(reason));
        }
      });
    return () => {
      active = false;
    };
  }, [serverId]);

  return (
    <div className="cascade">
      <Notice error={error} />
      <SelectField
        label={label}
        hint={hint}
        value={value ? String(value.pk) : ""}
        options={options.map((item) => ({
          value: String(item.pk),
          label: item.pathstring.trim() || item.name,
        }))}
        onChange={(raw) => onChange(options.find((item) => String(item.pk) === raw) ?? null)}
      />
    </div>
  );
}

async function loadLocations(serverId: string): Promise<LookupHit[]> {
  const hits: LookupHit[] = [];
  let offset = 0;
  for (;;) {
    const page = await listStockLocations(serverId, offset);
    hits.push(...page.results);
    offset += page.results.length;
    if (page.results.length === 0 || offset >= page.count) {
      return hits;
    }
  }
}

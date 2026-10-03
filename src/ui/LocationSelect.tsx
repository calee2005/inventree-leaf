import { useEffect, useState } from "react";
import { Picker } from "antd-mobile";
import "antd-mobile/es/components/picker/picker.css";
import "antd-mobile/es/components/picker-view/picker-view.css";
import "antd-mobile/es/components/popup/popup.css";
import "antd-mobile/es/components/mask/mask.css";
import "antd-mobile/es/components/safe-area/safe-area.css";
import { listStockLocations, readError } from "../api";
import { Notice } from "../Notice";
import type { CommandFailure, LookupHit } from "../types";
import { PickerTrigger } from "./CategorySelect";

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
    <>
      <Notice error={error} />
      <Picker
        columns={[
          options.map((item) => ({
            label: item.pathstring.trim() || item.name,
            value: String(item.pk),
          })),
        ]}
        value={value ? [String(value.pk)] : []}
        title={label}
        confirmText="确定"
        cancelText="取消"
        onConfirm={(next) => {
          const picked = next[0];
          onChange(options.find((item) => String(item.pk) === picked) ?? null);
        }}
      >
        {(items, actions) => (
          <PickerTrigger
            label={label}
            hint={hint}
            text={items[0]?.label ? String(items[0].label) : ""}
            onOpen={actions.open}
            onClear={
              value
                ? () => {
                    onChange(null);
                  }
                : undefined
            }
          />
        )}
      </Picker>
    </>
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

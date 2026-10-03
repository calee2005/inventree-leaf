import { useEffect, useMemo, useRef, useState } from "react";
import Cascader from "antd-mobile/es/components/cascader";
import type { CascaderOption } from "antd-mobile/es/components/cascader-view";
import { getPartCategory, listPartCategories, readError } from "../api";
import { Notice } from "../Notice";
import type { CommandFailure, LookupHit } from "../types";

type Props = {
  serverId: string;
  label: string;
  hint?: string;
  value: LookupHit | null;
  onChange: (value: LookupHit | null) => void;
};

const rootKey = "";

export function CategorySelect({ serverId, label, hint, value, onChange }: Props) {
  const cache = useRef<Record<string, LookupHit[] | null>>({});
  const pending = useRef(new Set<string>());
  const [loaded, setLoaded] = useState<Record<string, LookupHit[] | null>>({});
  const [chosen, setChosen] = useState<string[]>([]);
  const [error, setError] = useState<CommandFailure | null>(null);

  const options = useMemo(() => buildOptions(loaded, rootKey), [loaded]);

  useEffect(() => {
    let active = true;
    const selected = value?.pk ?? null;
    (async () => {
      await fetchLevel(serverId, rootKey, cache, pending, setLoaded, setError);
      if (!selected) {
        return;
      }
      const chain = await categoryChain(serverId, selected);
      for (const node of chain) {
        await fetchLevel(serverId, String(node.pk), cache, pending, setLoaded, setError);
      }
      if (active) {
        setChosen(chain.map((node) => String(node.pk)));
      }
    })().catch((reason: unknown) => {
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
      <Cascader
        options={options}
        value={chosen}
        title={label}
        confirmText="确定"
        cancelText="取消"
        placeholder="请选择"
        onSelect={(next) => {
          const last = next[next.length - 1];
          if (last !== undefined && last !== null) {
            void fetchLevel(serverId, String(last), cache, pending, setLoaded, setError);
          }
        }}
        onConfirm={(next) => {
          const ids = next.map(String);
          setChosen(ids);
          onChange(findHit(loaded, ids));
        }}
      >
        {(items, actions) => (
          <PickerTrigger
            label={label}
            hint={hint}
            text={items.flatMap((item) => (item?.label ? [String(item.label)] : [])).join(" / ")}
            onOpen={actions.open}
            onClear={
              chosen.length > 0
                ? () => {
                    setChosen([]);
                    onChange(null);
                  }
                : undefined
            }
          />
        )}
      </Cascader>
    </>
  );
}

function buildOptions(loaded: Record<string, LookupHit[] | null>, key: string): CascaderOption[] {
  const level = loaded[key];
  if (level === null) {
    return [];
  }
  if (level === undefined) {
    return Cascader.optionSkeleton;
  }
  return level.map((item) => {
    const childKey = String(item.pk);
    const children = loaded[childKey];
    return {
      value: childKey,
      label: item.name,
      children: children === null ? undefined : children === undefined ? Cascader.optionSkeleton : buildOptions(loaded, childKey),
    };
  });
}

async function fetchLevel(
  serverId: string,
  key: string,
  cache: { current: Record<string, LookupHit[] | null> },
  pending: { current: Set<string> },
  setLoaded: (value: Record<string, LookupHit[] | null>) => void,
  setError: (value: CommandFailure | null) => void,
) {
  if (key in cache.current || pending.current.has(key)) {
    return;
  }
  pending.current.add(key);
  try {
    const items = await loadCategoryLevel(serverId, key === rootKey ? null : Number(key));
    cache.current = { ...cache.current, [key]: items.length > 0 ? items : null };
    setLoaded(cache.current);
    setError(null);
  } catch (reason: unknown) {
    setError(readError(reason));
  } finally {
    pending.current.delete(key);
  }
}

function findHit(loaded: Record<string, LookupHit[] | null>, ids: string[]): LookupHit | null {
  let key = rootKey;
  let found: LookupHit | null = null;
  for (const id of ids) {
    const level = loaded[key];
    found = Array.isArray(level) ? level.find((item) => String(item.pk) === id) ?? null : null;
    if (!found) {
      return null;
    }
    key = id;
  }
  return found;
}

async function categoryChain(serverId: string, pk: number): Promise<LookupHit[]> {
  const chain: LookupHit[] = [];
  let current: number | null = pk;
  while (current && chain.length < 12) {
    const category = await getPartCategory(serverId, current);
    const pathstring = category.parentPath ? `${category.parentPath}/${category.name}` : category.name;
    chain.unshift({ pk: category.pk, name: category.name, pathstring });
    current = category.parentId;
  }
  return chain;
}

async function loadCategoryLevel(serverId: string, parent: number | null): Promise<LookupHit[]> {
  const hits: LookupHit[] = [];
  let offset = 0;
  for (;;) {
    const page = await listPartCategories(serverId, parent, offset);
    hits.push(
      ...page.results.map((item) => ({
        pk: item.pk,
        name: item.name,
        pathstring: item.pathstring,
      })),
    );
    offset += page.results.length;
    if (page.results.length === 0 || offset >= page.count) {
      return hits;
    }
  }
}

export function PickerTrigger({
  label,
  hint,
  text,
  onOpen,
  onClear,
}: {
  label: string;
  hint?: string;
  text: string;
  onOpen: () => void;
  onClear?: () => void;
}) {
  return (
    <div className="field">
      <span>{label}</span>
      <div className="picker-line">
        <div
          className={text ? "field-input picker-trigger" : "field-input picker-trigger is-empty"}
          role="button"
          tabIndex={0}
          onClick={onOpen}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onOpen();
            }
          }}
        >
          {text || "未选择"}
        </div>
        {onClear ? (
          <button className="picker-clear" type="button" onClick={onClear}>
            清除
          </button>
        ) : null}
      </div>
      {hint ? <small className="field-hint">{hint}</small> : null}
    </div>
  );
}

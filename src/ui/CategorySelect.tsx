import { useEffect, useState } from "react";
import { getPartCategory, listPartCategories, readError } from "../api";
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

export function CategorySelect({ serverId, label, hint, value, onChange }: Props) {
  const [levels, setLevels] = useState<LookupHit[][]>([]);
  const [path, setPath] = useState<LookupHit[]>([]);
  const [error, setError] = useState<CommandFailure | null>(null);

  useEffect(() => {
    let active = true;
    const selected = value?.pk ?? null;
    loadCascade(serverId, selected)
      .then((next) => {
        if (!active) {
          return;
        }
        setLevels(next.levels);
        setPath(next.path);
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

  async function pick(level: number, raw: string) {
    const chosen = levels[level]?.find((item) => String(item.pk) === raw) ?? null;
    const nextPath = chosen ? [...path.slice(0, level), chosen] : path.slice(0, level);
    setPath(nextPath);
    onChange(nextPath[nextPath.length - 1] ?? null);
    if (!chosen) {
      setLevels((current) => current.slice(0, level + 1));
      return;
    }
    try {
      const children = await loadCategoryLevel(serverId, chosen.pk);
      setLevels((current) => [...current.slice(0, level + 1), ...(children.length > 0 ? [children] : [])]);
      setError(null);
    } catch (reason: unknown) {
      setError(readError(reason));
    }
  }

  return (
    <div className="cascade">
      <Notice error={error} />
      {levels.map((options, index) => (
        <SelectField
          key={path[index - 1]?.pk ?? "root"}
          label={index === 0 ? label : "子类别"}
          hint={index === 0 ? hint : undefined}
          value={path[index] ? String(path[index].pk) : ""}
          options={options.map((item) => ({ value: String(item.pk), label: item.name }))}
          onChange={(raw) => void pick(index, raw)}
        />
      ))}
    </div>
  );
}

async function loadCascade(serverId: string, selected: number | null) {
  const roots = await loadCategoryLevel(serverId, null);
  const chain = selected ? await categoryChain(serverId, selected) : [];
  const levels = [roots];
  for (const node of chain) {
    const children = await loadCategoryLevel(serverId, node.pk);
    if (children.length === 0) {
      break;
    }
    levels.push(children);
  }
  return { levels, path: chain };
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

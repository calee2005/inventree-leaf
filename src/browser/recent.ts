import type { CompanySummary, PartSummary } from "../types";

const STORAGE_KEY = "leaf-access";
const LIMIT = 50;

type Entry = { at: number; item: unknown };

function readAll(): Record<string, Record<string, Entry>> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null) {
      return {};
    }
    return parsed as Record<string, Record<string, Entry>>;
  } catch {
    return {};
  }
}

function writeAll(value: Record<string, Record<string, Entry>>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // 本地空间不足时，选择列表仍可以走服务器分页。
  }
}

function remember(serverId: string, kind: string, item: { pk: number }) {
  const all = readAll();
  const bucket = { ...(all[`${serverId}:${kind}`] ?? {}) };
  bucket[String(item.pk)] = { at: Date.now(), item };
  const kept = Object.entries(bucket)
    .sort((left, right) => right[1].at - left[1].at)
    .slice(0, LIMIT);
  all[`${serverId}:${kind}`] = Object.fromEntries(kept);
  writeAll(all);
}

function recent<T extends { pk: number }>(serverId: string, kind: string, accept: (value: unknown) => T | null): T[] {
  const bucket = readAll()[`${serverId}:${kind}`] ?? {};
  return Object.values(bucket)
    .sort((left, right) => right.at - left.at)
    .flatMap((entry) => {
      const item = accept(entry.item);
      return item ? [item] : [];
    });
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  return value as Record<string, unknown>;
}

function partSummary(value: unknown): PartSummary | null {
  const record = asRecord(value);
  const pk = record?.pk;
  if (!record || typeof pk !== "number" || pk <= 0 || typeof record.name !== "string") {
    return null;
  }
  return {
    pk,
    name: record.name,
    ipn: typeof record.ipn === "string" ? record.ipn : "",
    description: typeof record.description === "string" ? record.description : "",
    inStock: typeof record.inStock === "number" ? record.inStock : 0,
    units: typeof record.units === "string" ? record.units : "",
    thumbnail: typeof record.thumbnail === "string" ? record.thumbnail : "",
  };
}

function companySummary(value: unknown): CompanySummary | null {
  const record = asRecord(value);
  const pk = record?.pk;
  if (!record || typeof pk !== "number" || pk <= 0 || typeof record.name !== "string") {
    return null;
  }
  return {
    pk,
    name: record.name,
    description: typeof record.description === "string" ? record.description : "",
    thumbnail: typeof record.thumbnail === "string" ? record.thumbnail : "",
    active: record.active !== false,
  };
}

export function rememberPart(serverId: string, item: PartSummary) {
  remember(serverId, "part", item);
}

export function rememberCompany(serverId: string, item: CompanySummary) {
  remember(serverId, "company", item);
}

export function recentParts(serverId: string): PartSummary[] {
  return recent(serverId, "part", partSummary);
}

export function recentCompanies(serverId: string): CompanySummary[] {
  return recent(serverId, "company", companySummary);
}

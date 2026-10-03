import { useEffect, useRef, useState, type ReactNode } from "react";
import Popup from "antd-mobile/es/components/popup";
import { listCompanies, listParts, listSupplierParts, readError, rememberCompany, rememberPart, recentCompanies, recentParts } from "../api";
import { InfiniteScroll } from "../MobileList";
import { Notice } from "../Notice";
import type { CommandFailure, CompanySummary, PartSummary, SupplierPartSummary } from "../types";
import { PartCard } from "./PartCard";
import { TextField } from "./TextField";
import { formatStock } from "./quantity";

type Page<T> = { results: T[]; count: number };

type Props<T> = {
  label: string;
  hint?: string;
  selectedLabel: string;
  selectedKey?: string;
  searchPlaceholder: string;
  emptyText: string;
  loadPage: (query: string, offset: number) => Promise<Page<T>>;
  recentItems: () => T[];
  itemKey: (item: T) => string;
  renderItem: (item: T, selected: boolean, select: () => void) => ReactNode;
  onSelect: (item: T) => void;
};

function mergeUnique<T>(current: T[], incoming: T[], itemKey: (item: T) => string) {
  const seen = new Set(current.map(itemKey));
  const next = [...current];
  for (const item of incoming) {
    const key = itemKey(item);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    next.push(item);
  }
  return next;
}

export function LookupSheet<T>({
  label,
  hint,
  selectedLabel,
  selectedKey = "",
  searchPlaceholder,
  emptyText,
  loadPage,
  recentItems,
  itemKey,
  renderItem,
  onSelect,
}: Props<T>) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<T[]>([]);
  const [error, setError] = useState<CommandFailure | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const loadRef = useRef(loadPage);
  const recentRef = useRef(recentItems);
  const itemKeyRef = useRef(itemKey);
  const serverOffset = useRef(0);
  const queryRef = useRef("");
  const generation = useRef(0);
  loadRef.current = loadPage;
  recentRef.current = recentItems;
  itemKeyRef.current = itemKey;

  useEffect(() => {
    if (!open) {
      return;
    }
    const text = query.trim();
    const ticket = generation.current + 1;
    generation.current = ticket;
    queryRef.current = text;
    let active = true;
    setLoading(true);
    setError(null);
    setHasMore(false);
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const page = await loadRef.current(text, 0);
          if (!active || generation.current !== ticket) {
            return;
          }
          const first = text ? page.results : mergeUnique(recentRef.current(), page.results, itemKeyRef.current);
          setItems(first);
          serverOffset.current = page.results.length;
          setHasMore(serverOffset.current < page.count);
          setError(null);
        } catch (reason: unknown) {
          if (active && generation.current === ticket) {
            setItems([]);
            setHasMore(false);
            setError(readError(reason));
          }
        } finally {
          if (active && generation.current === ticket) {
            setLoading(false);
          }
        }
      })();
    }, text ? 300 : 0);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [open, query]);

  async function loadMore() {
    const ticket = generation.current;
    const text = queryRef.current;
    const page = await loadRef.current(text, serverOffset.current);
    if (generation.current !== ticket) {
      return;
    }
    if (page.results.length === 0) {
      setHasMore(false);
      return;
    }
    serverOffset.current += page.results.length;
    setItems((current) => mergeUnique(current, page.results, itemKeyRef.current));
    setHasMore(serverOffset.current < page.count);
  }

  function choose(item: T) {
    onSelect(item);
    setOpen(false);
    setQuery("");
    setItems([]);
    setHasMore(false);
  }

  return (
    <>
      <div className="field">
        <span>{label}</span>
        <div
          className={selectedLabel ? "field-input picker-trigger" : "field-input picker-trigger is-empty"}
          role="button"
          tabIndex={0}
          onClick={() => setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              setOpen(true);
            }
          }}
        >
          {selectedLabel || "点击选择"}
        </div>
        {hint ? <small className="field-hint">{hint}</small> : null}
      </div>
      <Popup
        visible={open}
        position="bottom"
        closeOnMaskClick
        destroyOnClose
        onMaskClick={() => setOpen(false)}
        bodyStyle={{ borderRadius: "16px 16px 0 0", background: "#f4f5f7" }}
      >
        <div className="lookup-sheet">
          <TextField variant="search" placeholder={searchPlaceholder} value={query} onChange={setQuery} />
          <Notice error={error} />
          {loading && items.length === 0 ? <p className="muted">正在查找…</p> : null}
          {!loading && items.length === 0 && !error ? <p className="muted">{emptyText}</p> : null}
          <div className="lookup-scroll">
            <ul className="part-list lookup-results">
              {items.map((item) => renderItem(item, itemKey(item) === selectedKey, () => choose(item)))}
            </ul>
            {items.length > 0 || hasMore ? (
              <InfiniteScroll
                loadMore={async () => {
                  try {
                    await loadMore();
                  } catch (reason: unknown) {
                    setError(readError(reason));
                    throw reason;
                  }
                }}
                hasMore={hasMore}
              />
            ) : null}
          </div>
        </div>
      </Popup>
    </>
  );
}

export function SupplierLookup({
  serverId,
  label,
  hint,
  value,
  onChange,
}: {
  serverId: string;
  label: string;
  hint?: string;
  value: { pk: number; name: string } | null;
  onChange: (company: CompanySummary) => void;
}) {
  return (
    <LookupSheet
      label={label}
      hint={hint}
      selectedLabel={value?.name ?? ""}
      selectedKey={value ? String(value.pk) : ""}
      searchPlaceholder="搜索供应商"
      emptyText="没有匹配的供应商"
      recentItems={() => recentCompanies(serverId)}
      loadPage={(query, offset) => listCompanies(serverId, offset, { supplier: true, search: query })}
      itemKey={(company) => String(company.pk)}
      onSelect={(company) => {
        rememberCompany(serverId, company);
        onChange(company);
      }}
      renderItem={(company, selected, select) => (
        <PartCard
          serverId={serverId}
          thumbnail={company.thumbnail}
          title={company.name || "未命名"}
          detail={company.description || undefined}
          selected={selected}
          onClick={select}
        />
      )}
    />
  );
}

export function PartLookup({
  serverId,
  label,
  hint,
  value,
  onChange,
}: {
  serverId: string;
  label: string;
  hint?: string;
  value: { pk: number; name: string } | null;
  onChange: (part: PartSummary) => void;
}) {
  return (
    <LookupSheet
      label={label}
      hint={hint}
      selectedLabel={value?.name ?? ""}
      selectedKey={value ? String(value.pk) : ""}
      searchPlaceholder="搜索零件"
      emptyText="没有匹配的零件"
      recentItems={() => recentParts(serverId)}
      loadPage={(query, offset) =>
        listParts(serverId, null, query, offset, { ordering: "-creation_date", allCategories: true })
      }
      itemKey={(part) => String(part.pk)}
      onSelect={(part) => {
        rememberPart(serverId, part);
        onChange(part);
      }}
      renderItem={(part, selected, select) => (
        <PartCard
          serverId={serverId}
          thumbnail={part.thumbnail}
          title={part.name}
          detail={part.description || part.ipn || undefined}
          trailing={formatStock(part.inStock, part.units)}
          selected={selected}
          onClick={select}
        />
      )}
    />
  );
}

export function SupplierPartLookup({
  serverId,
  partId,
  label,
  hint,
  value,
  onChange,
}: {
  serverId: string;
  partId: number | null;
  label: string;
  hint?: string;
  value: { pk: number; sku: string; supplierName: string } | null;
  onChange: (item: SupplierPartSummary) => void;
}) {
  const selected = value ? [value.supplierName, value.sku].filter(Boolean).join(" · ") : "";
  return (
    <LookupSheet
      label={label}
      hint={hint}
      selectedLabel={selected}
      selectedKey={value ? String(value.pk) : ""}
      searchPlaceholder="搜索供应商零件"
      emptyText="没有匹配的供应商零件"
      recentItems={() => []}
      loadPage={(query, offset) =>
        listSupplierParts(serverId, offset, { part: partId && partId > 0 ? partId : undefined, search: query })
      }
      itemKey={(item) => String(item.pk)}
      onSelect={onChange}
      renderItem={(item, selectedItem, select) => (
        <PartCard
          serverId={serverId}
          thumbnail={item.supplierImage || item.partThumbnail}
          title={item.sku || "未编号"}
          detail={[item.supplierName, item.partName].filter(Boolean).join(" · ") || undefined}
          selected={selectedItem}
          onClick={select}
        />
      )}
    />
  );
}

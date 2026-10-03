import { useEffect, useState, type ReactNode } from "react";
import { Popup } from "antd-mobile";
import "antd-mobile/es/components/popup/popup.css";
import "antd-mobile/es/components/mask/mask.css";
import { listParts, readError } from "../api";
import { Notice } from "../Notice";
import type { CommandFailure, PartSummary } from "../types";
import { PartCard } from "./PartCard";
import { TextField } from "./TextField";
import { formatStock } from "./quantity";

type Props<T> = {
  label: string;
  hint?: string;
  selectedLabel: string;
  selectedKey?: string;
  searchPlaceholder: string;
  idleText: string;
  emptyText: string;
  search: (query: string) => Promise<T[]>;
  itemKey: (item: T) => string;
  renderItem: (item: T, selected: boolean, select: () => void) => ReactNode;
  onSelect: (item: T) => void;
};

export function LookupSheet<T>({
  label,
  hint,
  selectedLabel,
  selectedKey = "",
  searchPlaceholder,
  idleText,
  emptyText,
  search,
  itemKey,
  renderItem,
  onSelect,
}: Props<T>) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<T[]>([]);
  const [error, setError] = useState<CommandFailure | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }
    const text = query.trim();
    if (!text) {
      setItems([]);
      setLoading(false);
      setError(null);
      return;
    }
    let active = true;
    setLoading(true);
    const timer = window.setTimeout(() => {
      search(text)
        .then((next) => {
          if (!active) {
            return;
          }
          setItems(next);
          setError(null);
        })
        .catch((reason: unknown) => {
          if (active) {
            setItems([]);
            setError(readError(reason));
          }
        })
        .finally(() => {
          if (active) {
            setLoading(false);
          }
        });
    }, 300);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [open, query]);

  function choose(item: T) {
    onSelect(item);
    setOpen(false);
    setQuery("");
    setItems([]);
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
          {loading ? <p className="muted">正在查找…</p> : null}
          {!loading && !query.trim() ? <p className="muted">{idleText}</p> : null}
          {!loading && query.trim() && items.length === 0 && !error ? <p className="muted">{emptyText}</p> : null}
          <ul className="part-list lookup-results">
            {items.map((item) => renderItem(item, itemKey(item) === selectedKey, () => choose(item)))}
          </ul>
        </div>
      </Popup>
    </>
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
      idleText="输入关键词开始查找"
      emptyText="没有匹配的零件"
      search={async (query) => (await listParts(serverId, null, query, 0)).results}
      itemKey={(part) => String(part.pk)}
      onSelect={onChange}
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

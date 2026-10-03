import { useEffect, useRef, useState, type MouseEvent } from "react";
import { listRecords, readError } from "../api";
import { InfiniteScroll, PullToRefresh } from "../MobileList";
import { Notice } from "../Notice";
import { useShell } from "../shell/AppShell";
import type { CommandFailure, RecordSummary } from "../types";

type Props = {
  kind: string;
  emptyText: string;
};

export function RecordListScreen({ kind, emptyText }: Props) {
  const { serverId } = useShell();
  const [searchInput, setSearchInput] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const [records, setRecords] = useState<RecordSummary[]>([]);
  const [error, setError] = useState<CommandFailure | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const offsetRef = useRef(0);

  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(searchInput.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  async function loadPage(offset: number, replace: boolean) {
    const page = await listRecords(serverId, kind, query, offset);
    if (replace) {
      setRecords(page.results);
    } else {
      setRecords((current) => [...current, ...page.results]);
    }
    const nextOffset = offset + page.results.length;
    offsetRef.current = nextOffset;
    setHasMore(nextOffset < page.count);
  }

  async function reload() {
    setError(null);
    offsetRef.current = 0;
    setHasMore(false);
    try {
      await loadPage(0, true);
    } catch (reason: unknown) {
      setError(readError(reason));
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setLoading(true);
    setRecords([]);
    setHasMore(false);
    void reload();
  }, [serverId, kind, query]);

  async function loadMore() {
    try {
      await loadPage(offsetRef.current, false);
    } catch (reason: unknown) {
      setError(readError(reason));
      throw reason;
    }
  }

  function toggleSearch(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    setSearchOpen((open) => {
      const next = !open;
      if (next) {
        window.setTimeout(() => searchRef.current?.focus(), 0);
      }
      return next;
    });
  }

  return (
    <div className="parts-view">
      <div className="crumb-row">
        <div className="crumb-tools record-tools">
          <button
            className={searchOpen ? "icon-button is-on" : "icon-button"}
            type="button"
            aria-label="检索"
            aria-expanded={searchOpen}
            onClick={toggleSearch}
          >
            <SearchIcon />
          </button>
        </div>
      </div>
      {searchOpen ? (
        <input
          ref={searchRef}
          className="part-search"
          type="search"
          placeholder="输入关键词检索"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          enterKeyHint="search"
        />
      ) : null}
      <Notice error={error} />
      {loading ? <p className="muted">正在读取…</p> : null}
      {!loading && records.length === 0 && !error ? <p className="muted">{emptyText}</p> : null}
      <PullToRefresh onRefresh={reload}>
        <ul className="part-list">
          {records.map((record) => (
            <li className="part-card record-card" key={record.pk}>
              <div className="part-body">
                <strong>{record.title || "未命名"}</strong>
                {record.detail ? <small>{record.detail}</small> : null}
                {record.trailing ? <span className="part-qty">{record.trailing}</span> : null}
              </div>
            </li>
          ))}
        </ul>
        {records.length > 0 || hasMore ? <InfiniteScroll loadMore={loadMore} hasMore={hasMore} /> : null}
      </PullToRefresh>
    </div>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="10.5" cy="10.5" r="5.5" />
      <path d="M15 15l4 4" />
    </svg>
  );
}

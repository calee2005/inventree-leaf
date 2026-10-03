import { useEffect, useRef, useState, type MouseEvent } from "react";
import { listCompanies, readError } from "../api";
import { InfiniteScroll, PullToRefresh } from "../MobileList";
import { Notice } from "../Notice";
import { usePageStack } from "../shell/pageStack";
import { useShell } from "../shell/AppShell";
import type { CommandFailure, CompanySummary } from "../types";
import { PartCard } from "../ui/PartCard";
import { TextField } from "../ui/TextField";

export function CustomerListScreen() {
  const { serverId } = useShell();
  const stack = usePageStack();
  const [searchInput, setSearchInput] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const [companies, setCompanies] = useState<CompanySummary[]>([]);
  const [error, setError] = useState<CommandFailure | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const offsetRef = useRef(0);

  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(searchInput.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  async function loadPage(offset: number, replace: boolean) {
    const page = await listCompanies(serverId, offset, { customer: true, search: query });
    setCompanies((current) => (replace ? page.results : [...current, ...page.results]));
    offsetRef.current = offset + page.results.length;
    setHasMore(offsetRef.current < page.count);
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
    setCompanies([]);
    setHasMore(false);
    void reload();
  }, [serverId, query]);

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
        <TextField
          ref={searchRef}
          variant="search"
          placeholder="搜索客户"
          value={searchInput}
          onChange={setSearchInput}
          enterKeyHint="search"
        />
      ) : null}
      <Notice error={error} />
      {loading ? <p className="muted">正在读取客户…</p> : null}
      {!loading && companies.length === 0 && !error ? <p className="muted">这里还没有客户。</p> : null}
      <PullToRefresh onRefresh={reload}>
        <ul className="part-list">
          {companies.map((company) => (
            <PartCard
              key={company.pk}
              serverId={serverId}
              thumbnail={company.thumbnail}
              title={company.name || "未命名"}
              detail={[company.active ? "" : "未激活", company.description].filter(Boolean).join(" · ") || undefined}
              onClick={() => stack.push(`/customer/${company.pk}`)}
            />
          ))}
        </ul>
        {companies.length > 0 || hasMore ? (
          <InfiniteScroll
            loadMore={async () => {
              try {
                await loadPage(offsetRef.current, false);
              } catch (reason: unknown) {
                setError(readError(reason));
                throw reason;
              }
            }}
            hasMore={hasMore}
          />
        ) : null}
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

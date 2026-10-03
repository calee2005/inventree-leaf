import { useEffect, useRef, useState, type MouseEvent } from "react";
import { listParts, readError } from "../api";
import { InfiniteScroll, PullToRefresh } from "../MobileList";
import { Notice } from "../Notice";
import { useShell } from "../shell/AppShell";
import { usePageStack } from "../shell/pageStack";
import type { CategorySummary, CommandFailure, PartSummary } from "../types";
import { PartCard } from "../ui/PartCard";
import { formatStock } from "../ui/quantity";
import { CategoryPath } from "./CategoryPath";

export function PartsScreen() {
  const { serverId, panel, setPanel, setActions } = useShell();
  const stack = usePageStack();
  const [trail, setTrail] = useState<CategorySummary[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const [parts, setParts] = useState<PartSummary[]>([]);
  const [error, setError] = useState<CommandFailure | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [blocked, setBlocked] = useState<string | null>(null);
  const offsetRef = useRef(0);

  useEffect(() => {
    setActions([
      {
        id: "create-part",
        label: "创建新零件",
        onSelect: () => setBlocked("创建零件还不能提交。"),
      },
      {
        id: "create-category",
        label: "创建零件类别",
        onSelect: () => setBlocked("创建零件类别还不能提交。"),
      },
    ]);
    return () => setActions([]);
  }, [setActions]);

  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(searchInput.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const categoryId = trail.length > 0 ? trail[trail.length - 1].pk : null;

  async function loadPage(offset: number, replace: boolean) {
    const partsPage = await listParts(serverId, categoryId, query, offset);
    if (replace) {
      setParts(partsPage.results);
    } else {
      setParts((current) => [...current, ...partsPage.results]);
    }
    const nextOffset = offset + partsPage.results.length;
    offsetRef.current = nextOffset;
    setHasMore(nextOffset < partsPage.count);
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
    setParts([]);
    setHasMore(false);
    void reload();
  }, [serverId, categoryId, query]);

  function openTrail(next: CategorySummary[]) {
    setPanel(null);
    setTrail(next);
  }

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
    setPanel(null);
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
        <CategoryPath serverId={serverId} trail={trail} onOpen={openTrail} />
        <div className="crumb-tools">
          <button
            className="icon-button"
            type="button"
            aria-label="筛选"
            onClick={(event) => {
              event.stopPropagation();
              setSearchOpen(false);
              setPanel(panel === "filter" ? null : "filter");
            }}
          >
            <FilterIcon />
          </button>
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
        {panel === "filter" ? (
          <div className="popover filter-menu" onClick={(event) => event.stopPropagation()}>
            <p>筛选尚未开放</p>
          </div>
        ) : null}
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
      {blocked ? <p className="muted">{blocked}</p> : null}
      {loading ? <p className="muted">正在读取零件…</p> : null}
      {!loading && parts.length === 0 && !error ? (
        <p className="muted">{query ? "没有匹配的零件。" : "这里还没有零件。"}</p>
      ) : null}
      <PullToRefresh onRefresh={reload}>
      <ul className="part-list">
        {parts.map((part) => (
          <PartCard
            key={part.pk}
            serverId={serverId}
            thumbnail={part.thumbnail}
            title={part.name}
            trailing={formatStock(part.inStock, part.units)}
            onClick={() => stack.push(`/parts/${part.pk}`, part)}
          />
        ))}
      </ul>
      {parts.length > 0 || hasMore ? <InfiniteScroll loadMore={loadMore} hasMore={hasMore} /> : null}
      </PullToRefresh>
    </div>
  );
}

function FilterIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 6h16l-6 7v5l-4 2v-7z" />
    </svg>
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

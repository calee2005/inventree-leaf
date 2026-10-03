import { useEffect, useRef, useState, type MouseEvent } from "react";
import { useParams } from "react-router";
import {
  getBuildLine,
  getBuildOrder,
  listBuildAllocations,
  listBuildLines,
  listBuildOrders,
  listBuildOutputs,
  readError,
} from "../api";
import { InfiniteScroll, PullToRefresh } from "../MobileList";
import { Notice } from "../Notice";
import { usePageStack } from "../shell/pageStack";
import { useShell } from "../shell/AppShell";
import type { BuildAllocation, BuildDetail, BuildLine, CommandFailure, OrderSummary, PartStockItem } from "../types";
import { DetailGroup } from "../ui/DetailGroup";
import { DetailHeading } from "../ui/DetailHeading";
import { DetailRow } from "../ui/DetailRow";
import { PartCard } from "../ui/PartCard";
import { SectionLabel } from "../ui/SectionLabel";
import { TextField } from "../ui/TextField";
import { openLink } from "../ui/openLink";
import { formatQty } from "../ui/quantity";

export function BuildListScreen() {
  const { serverId } = useShell();
  const stack = usePageStack();
  const search = useOrderSearch();
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [error, setError] = useState<CommandFailure | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const offsetRef = useRef(0);

  async function loadPage(offset: number, replace: boolean) {
    const page = await listBuildOrders(serverId, search.query, offset);
    setOrders((current) => (replace ? page.results : [...current, ...page.results]));
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
    setOrders([]);
    setHasMore(false);
    void reload();
  }, [serverId, search.query]);

  return (
    <OrderList
      search={search}
      placeholder="搜索生产订单"
      loadingText="正在读取生产订单…"
      emptyText="这里还没有生产订单。"
      error={error}
      loading={loading}
      orders={orders}
      hasMore={hasMore}
      onRefresh={reload}
      onOpen={(pk) => stack.push(`/build/${pk}`)}
      serverId={serverId}
      onMore={async () => {
        try {
          await loadPage(offsetRef.current, false);
        } catch (reason: unknown) {
          setError(readError(reason));
          throw reason;
        }
      }}
    />
  );
}

export function BuildDetailScreen() {
  const { serverId } = useShell();
  const stack = usePageStack();
  const params = useParams();
  const buildId = Number(params.buildId);
  const invalid = !Number.isInteger(buildId) || buildId <= 0;
  const [order, setOrder] = useState<BuildDetail | null>(null);
  const [lines, setLines] = useState<BuildLine[]>([]);
  const [error, setError] = useState<CommandFailure | null>(null);
  const [lineError, setLineError] = useState<CommandFailure | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const offsetRef = useRef(0);

  async function loadLines(offset: number, replace: boolean) {
    const page = await listBuildLines(serverId, buildId, offset);
    setLines((current) => (replace ? page.results : [...current, ...page.results]));
    offsetRef.current = offset + page.results.length;
    setHasMore(offsetRef.current < page.count);
  }

  async function load() {
    if (invalid) {
      setError({ kind: "invalid", message: "生产订单不存在" });
      setLoading(false);
      return;
    }
    setError(null);
    setLineError(null);
    try {
      setOrder(await getBuildOrder(serverId, buildId));
      await loadLines(0, true);
    } catch (reason: unknown) {
      setOrder(null);
      setError(readError(reason));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setLoading(true);
    setLines([]);
    void load();
  }, [serverId, buildId]);

  const progress = order && order.quantity > 0 ? Math.max(0, Math.min(1, order.completed / order.quantity)) : 0;

  return (
    <div className="part-detail">
      <Notice error={error} />
      {loading ? <p className="muted">正在读取生产订单…</p> : null}
      <PullToRefresh onRefresh={load}>
        {order ? (
          <div className="detail-stack">
            <DetailHeading title={order.reference || "未编号"} detail={order.title || undefined} aside={order.statusText || undefined} />
            <DetailGroup>
              {order.partName ? (
                <DetailRow
                  title="零件"
                  detail={order.partName}
                  onClick={order.partId ? () => stack.push(`/parts/${order.partId}`) : undefined}
                />
              ) : null}
              <DetailRow title="数量" aside={`${formatQty(order.completed)} / ${formatQty(order.quantity)}`} meter={progress} />
              <DetailRow title="已分配库存" onClick={() => stack.push(`/build/${order.pk}/allocations`)} />
              <DetailRow title="构建输出" onClick={() => stack.push(`/build/${order.pk}/outputs`)} />
              {order.batch ? <DetailRow title="批次" aside={order.batch} /> : null}
              {order.external ? <DetailRow title="外部生产" detail="此生产订单由外部完成" /> : null}
              {order.sourceName ? (
                <DetailRow
                  title="来源地点"
                  detail={order.sourceName}
                  onClick={order.sourceId ? () => stack.push(`/stock/location/${order.sourceId}`) : undefined}
                />
              ) : null}
              {order.destinationName ? (
                <DetailRow
                  title="目的地"
                  detail={order.destinationName}
                  onClick={order.destinationId ? () => stack.push(`/stock/location/${order.destinationId}`) : undefined}
                />
              ) : null}
              {order.salesOrderId ? (
                <DetailRow title="销售订单" onClick={() => stack.push(`/sales/${order.salesOrderId}`)} />
              ) : null}
              {order.creationDate ? <DetailRow title="创建日期" aside={order.creationDate} /> : null}
              {order.startDate ? <DetailRow title="起始日期" aside={order.startDate} /> : null}
              {order.targetDate ? <DetailRow title="预计日期" aside={order.targetDate} /> : null}
              {order.completionDate ? <DetailRow title="完成日期" aside={order.completionDate} /> : null}
              {order.link ? <DetailRow title="链接" detail={order.link} onClick={() => openLink(order.link)} /> : null}
              {order.notes ? <DetailRow title="注释" detail={order.notes} note /> : null}
            </DetailGroup>
            {lines.length > 0 ? <SectionLabel>所需零件</SectionLabel> : null}
            <Notice error={lineError} />
            <ul className="part-list">
              {lines.map((line) => (
                <PartCard
                  key={line.pk}
                  square
                  serverId={serverId}
                  thumbnail={line.thumbnail}
                  title={line.partName || "未命名零件"}
                  detail={line.reference || undefined}
                  trailing={`${formatQty(line.allocated)} / ${formatQty(line.quantity)}`}
                  onClick={() => stack.push(`/build/line/${line.pk}`)}
                />
              ))}
            </ul>
            {lines.length > 0 || hasMore ? (
              <InfiniteScroll
                loadMore={async () => {
                  try {
                    await loadLines(offsetRef.current, false);
                  } catch (reason: unknown) {
                    setLineError(readError(reason));
                    throw reason;
                  }
                }}
                hasMore={hasMore}
              />
            ) : null}
          </div>
        ) : null}
      </PullToRefresh>
    </div>
  );
}

export function BuildLineScreen() {
  const { serverId } = useShell();
  const stack = usePageStack();
  const params = useParams();
  const lineId = Number(params.lineId);
  const invalid = !Number.isInteger(lineId) || lineId <= 0;
  const [line, setLine] = useState<BuildLine | null>(null);
  const [error, setError] = useState<CommandFailure | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    if (invalid) {
      setError({ kind: "invalid", message: "物料行不存在" });
      setLoading(false);
      return;
    }
    setError(null);
    try {
      setLine(await getBuildLine(serverId, lineId));
    } catch (reason: unknown) {
      setLine(null);
      setError(readError(reason));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setLoading(true);
    void load();
  }, [serverId, lineId]);

  const meter = line && line.quantity > 0 ? Math.max(0, Math.min(1, line.allocated / line.quantity)) : 0;

  return (
    <div className="part-detail">
      <Notice error={error} />
      {loading ? <p className="muted">正在读取物料行…</p> : null}
      <PullToRefresh onRefresh={load}>
        {line ? (
          <div className="detail-stack">
            <DetailHeading title={line.partName || "未命名零件"} detail={line.reference || undefined} />
            <DetailGroup>
              <DetailRow
                title="零件"
                detail={line.partName || undefined}
                onClick={line.partId ? () => stack.push(`/parts/${line.partId}`) : undefined}
              />
              <DetailRow title="数量" aside={formatQty(line.quantity)} />
              <DetailRow title="已分配" aside={`${formatQty(line.allocated)} / ${formatQty(line.quantity)}`} meter={meter} />
              {line.consumed > 0 ? <DetailRow title="已消耗" aside={formatQty(line.consumed)} /> : null}
              {line.reference ? <DetailRow title="参考" detail={line.reference} /> : null}
              {line.notes ? <DetailRow title="注释" detail={line.notes} note /> : null}
            </DetailGroup>
          </div>
        ) : null}
      </PullToRefresh>
    </div>
  );
}

export function BuildAllocationScreen() {
  const { serverId } = useShell();
  const stack = usePageStack();
  const params = useParams();
  const buildId = Number(params.buildId);
  const [items, setItems] = useState<BuildAllocation[]>([]);
  const [error, setError] = useState<CommandFailure | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!Number.isInteger(buildId) || buildId <= 0) {
      setError({ kind: "invalid", message: "生产订单不存在" });
      setLoading(false);
      return;
    }
    setError(null);
    try {
      setItems(await listBuildAllocations(serverId, buildId));
    } catch (reason: unknown) {
      setError(readError(reason));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setLoading(true);
    void load();
  }, [serverId, buildId]);

  return (
    <div className="part-detail">
      <Notice error={error} />
      {loading ? <p className="muted">正在读取已分配库存…</p> : null}
      <PullToRefresh onRefresh={load}>
        {!loading && items.length === 0 && !error ? <p className="muted">这里还没有已分配库存。</p> : null}
        <ul className="part-list">
          {items.map((item) => (
            <PartCard
              key={item.pk}
              square
              serverId={serverId}
              thumbnail={item.thumbnail}
              title={item.partName || "未命名零件"}
              detail={item.location || undefined}
              trailing={formatQty(item.quantity)}
              onClick={item.stockItemId ? () => stack.push(`/stock/item/${item.stockItemId}`) : undefined}
            />
          ))}
        </ul>
      </PullToRefresh>
    </div>
  );
}

export function BuildOutputScreen() {
  const { serverId } = useShell();
  const stack = usePageStack();
  const params = useParams();
  const buildId = Number(params.buildId);
  const [items, setItems] = useState<PartStockItem[]>([]);
  const [error, setError] = useState<CommandFailure | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const offsetRef = useRef(0);

  async function loadPage(offset: number, replace: boolean) {
    const page = await listBuildOutputs(serverId, buildId, offset);
    setItems((current) => (replace ? page.results : [...current, ...page.results]));
    offsetRef.current = offset + page.results.length;
    setHasMore(offsetRef.current < page.count);
  }

  async function load() {
    if (!Number.isInteger(buildId) || buildId <= 0) {
      setError({ kind: "invalid", message: "生产订单不存在" });
      setLoading(false);
      return;
    }
    setError(null);
    try {
      await loadPage(0, true);
    } catch (reason: unknown) {
      setError(readError(reason));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setLoading(true);
    void load();
  }, [serverId, buildId]);

  return (
    <div className="part-detail">
      <Notice error={error} />
      {loading ? <p className="muted">正在读取构建输出…</p> : null}
      <PullToRefresh onRefresh={load}>
        {!loading && items.length === 0 && !error ? <p className="muted">这里还没有构建输出。</p> : null}
        <ul className="part-list">
          {items.map((item) => (
            <PartCard
              key={item.pk}
              square
              serverId={serverId}
              thumbnail={item.thumbnail}
              title={item.partName || "未命名零件"}
              detail={item.location || undefined}
              trailing={item.quantity || undefined}
              onClick={() => stack.push(`/stock/item/${item.pk}`)}
            />
          ))}
        </ul>
        {items.length > 0 || hasMore ? (
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

function OrderList({
  search,
  placeholder,
  loadingText,
  emptyText,
  error,
  loading,
  orders,
  hasMore,
  serverId,
  onRefresh,
  onOpen,
  onMore,
}: {
  search: ReturnType<typeof useOrderSearch>;
  placeholder: string;
  loadingText: string;
  emptyText: string;
  error: CommandFailure | null;
  loading: boolean;
  orders: OrderSummary[];
  hasMore: boolean;
  serverId: string;
  onRefresh: () => Promise<void>;
  onOpen: (pk: number) => void;
  onMore: () => Promise<void>;
}) {
  return (
    <div className="parts-view">
      <div className="crumb-row">
        <div className="crumb-tools record-tools">
          <button
            className={search.searchOpen ? "icon-button is-on" : "icon-button"}
            type="button"
            aria-label="检索"
            aria-expanded={search.searchOpen}
            onClick={search.toggle}
          >
            <SearchIcon />
          </button>
        </div>
      </div>
      {search.searchOpen ? (
        <TextField
          ref={search.searchRef}
          variant="search"
          placeholder={placeholder}
          value={search.searchInput}
          onChange={search.setSearchInput}
          enterKeyHint="search"
        />
      ) : null}
      <Notice error={error} />
      {loading ? <p className="muted">{loadingText}</p> : null}
      {!loading && orders.length === 0 && !error ? <p className="muted">{emptyText}</p> : null}
      <PullToRefresh onRefresh={onRefresh}>
        <ul className="part-list">
          {orders.map((order) => (
            <PartCard
              key={order.pk}
              serverId={serverId}
              thumbnail={order.thumbnail}
              title={order.reference || "未编号"}
              detail={order.description || order.detail || undefined}
              trailing={order.statusText || undefined}
              onClick={() => onOpen(order.pk)}
            />
          ))}
        </ul>
        {orders.length > 0 || hasMore ? <InfiniteScroll loadMore={onMore} hasMore={hasMore} /> : null}
      </PullToRefresh>
    </div>
  );
}

function useOrderSearch() {
  const [searchInput, setSearchInput] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(searchInput.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);
  function toggle(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    setSearchOpen((open) => {
      const next = !open;
      if (next) {
        window.setTimeout(() => searchRef.current?.focus(), 0);
      }
      return next;
    });
  }
  return { searchInput, setSearchInput, searchOpen, query, searchRef, toggle };
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="10.5" cy="10.5" r="5.5" />
      <path d="M15 15l4 4" />
    </svg>
  );
}

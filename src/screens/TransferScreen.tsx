import { useEffect, useRef, useState, type MouseEvent } from "react";
import { useParams } from "react-router";
import { getTransferLine, getTransferOrder, listTransferAllocations, listTransferLines, listTransferOrders, readError } from "../api";
import { InfiniteScroll, PullToRefresh } from "../MobileList";
import { Notice } from "../Notice";
import { usePageStack } from "../shell/pageStack";
import { useShell } from "../shell/AppShell";
import type { CommandFailure, OrderSummary, TransferAllocation, TransferLine, TransferOrderDetail } from "../types";
import { DetailGroup } from "../ui/DetailGroup";
import { DetailHeading } from "../ui/DetailHeading";
import { DetailRow } from "../ui/DetailRow";
import { PartCard } from "../ui/PartCard";
import { SectionLabel } from "../ui/SectionLabel";
import { TextField } from "../ui/TextField";
import { openLink } from "../ui/openLink";
import { formatQty } from "../ui/quantity";

export function TransferListScreen() {
  const { serverId } = useShell();
  const stack = usePageStack();
  const [searchInput, setSearchInput] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [error, setError] = useState<CommandFailure | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const offsetRef = useRef(0);

  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(searchInput.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  async function loadPage(offset: number, replace: boolean) {
    const page = await listTransferOrders(serverId, query, offset);
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
          <button className={searchOpen ? "icon-button is-on" : "icon-button"} type="button" aria-label="检索" aria-expanded={searchOpen} onClick={toggleSearch}>
            <SearchIcon />
          </button>
        </div>
      </div>
      {searchOpen ? (
        <TextField ref={searchRef} variant="search" placeholder="搜索调拨单" value={searchInput} onChange={setSearchInput} enterKeyHint="search" />
      ) : null}
      <Notice error={error} />
      {loading ? <p className="muted">正在读取调拨单…</p> : null}
      {!loading && orders.length === 0 && !error ? <p className="muted">这里还没有调拨单。</p> : null}
      <PullToRefresh onRefresh={reload}>
        <ul className="part-list">
          {orders.map((order) => (
            <PartCard
              key={order.pk}
              serverId={serverId}
              thumbnail=""
              title={order.reference || "未编号"}
              detail={order.description || undefined}
              trailing={order.statusText || undefined}
              onClick={() => stack.push(`/transfer/${order.pk}`)}
            />
          ))}
        </ul>
        {orders.length > 0 || hasMore ? (
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

export function TransferDetailScreen() {
  const { serverId } = useShell();
  const stack = usePageStack();
  const params = useParams();
  const orderId = Number(params.orderId);
  const invalid = !Number.isInteger(orderId) || orderId <= 0;
  const [order, setOrder] = useState<TransferOrderDetail | null>(null);
  const [lines, setLines] = useState<TransferLine[]>([]);
  const [error, setError] = useState<CommandFailure | null>(null);
  const [lineError, setLineError] = useState<CommandFailure | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const offsetRef = useRef(0);

  async function loadLines(offset: number, replace: boolean) {
    const page = await listTransferLines(serverId, orderId, offset);
    setLines((current) => (replace ? page.results : [...current, ...page.results]));
    offsetRef.current = offset + page.results.length;
    setHasMore(offsetRef.current < page.count);
  }

  async function load() {
    if (invalid) {
      setError({ kind: "invalid", message: "调拨单不存在" });
      setLoading(false);
      return;
    }
    setError(null);
    setLineError(null);
    try {
      setOrder(await getTransferOrder(serverId, orderId));
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
  }, [serverId, orderId]);

  const progress = order && order.lineCount > 0 ? `${order.completedLines} / ${order.lineCount}` : "";

  return (
    <div className="part-detail">
      <Notice error={error} />
      {loading ? <p className="muted">正在读取调拨单…</p> : null}
      <PullToRefresh onRefresh={load}>
        {order ? (
          <div className="detail-stack">
            <DetailHeading title={order.reference || "未编号"} detail={order.description || undefined} aside={order.statusText || undefined} />
            <DetailGroup>
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
              {order.consume ? <DetailRow title="消耗" detail="分配的库存将被消耗，不通过调拨" /> : null}
              {progress ? <DetailRow title="行项目" aside={progress} /> : null}
              {order.creationDate ? <DetailRow title="创建日期" aside={order.creationDate} /> : null}
              {order.startDate ? <DetailRow title="起始日期" aside={order.startDate} /> : null}
              {order.targetDate ? <DetailRow title="预计日期" aside={order.targetDate} /> : null}
              {order.completionDate ? <DetailRow title="完成日期" aside={order.completionDate} /> : null}
              {order.link ? <DetailRow title="链接" detail={order.link} onClick={() => openLink(order.link)} /> : null}
              {order.notes ? <DetailRow title="注释" detail={order.notes} note /> : null}
            </DetailGroup>
            {lines.length > 0 ? <SectionLabel>零件</SectionLabel> : null}
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
                  trailing={`${formatQty(line.transferred)} / ${formatQty(line.quantity)}`}
                  onClick={() => stack.push(`/transfer/line/${line.pk}`)}
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

export function TransferLineScreen() {
  const { serverId } = useShell();
  const stack = usePageStack();
  const params = useParams();
  const lineId = Number(params.lineId);
  const invalid = !Number.isInteger(lineId) || lineId <= 0;
  const [line, setLine] = useState<TransferLine | null>(null);
  const [error, setError] = useState<CommandFailure | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    if (invalid) {
      setError({ kind: "invalid", message: "调拨行不存在" });
      setLoading(false);
      return;
    }
    setError(null);
    try {
      setLine(await getTransferLine(serverId, lineId));
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

  const meter = line && line.quantity > 0 ? Math.max(0, Math.min(1, line.transferred / line.quantity)) : 0;

  return (
    <div className="part-detail">
      <Notice error={error} />
      {loading ? <p className="muted">正在读取调拨行…</p> : null}
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
              <DetailRow title="调拨" aside={`${formatQty(line.transferred)} / ${formatQty(line.quantity)}`} meter={meter} />
              <DetailRow
                title="已分配库存"
                aside={formatQty(line.allocated)}
                onClick={() => stack.push(`/transfer/line/${line.pk}/allocations`)}
              />
              {line.reference ? <DetailRow title="参考" detail={line.reference} /> : null}
              {line.targetDate ? <DetailRow title="预计日期" aside={line.targetDate} /> : null}
              {line.notes ? <DetailRow title="注释" detail={line.notes} note /> : null}
            </DetailGroup>
          </div>
        ) : null}
      </PullToRefresh>
    </div>
  );
}

export function TransferAllocationScreen() {
  const { serverId } = useShell();
  const stack = usePageStack();
  const params = useParams();
  const lineId = Number(params.lineId);
  const [items, setItems] = useState<TransferAllocation[]>([]);
  const [error, setError] = useState<CommandFailure | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!Number.isInteger(lineId) || lineId <= 0) {
      setError({ kind: "invalid", message: "调拨行不存在" });
      setLoading(false);
      return;
    }
    setError(null);
    try {
      setItems(await listTransferAllocations(serverId, lineId));
    } catch (reason: unknown) {
      setError(readError(reason));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setLoading(true);
    void load();
  }, [serverId, lineId]);

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
              title={item.partName || item.serial || "库存项"}
              detail={item.location || item.serial || undefined}
              trailing={formatQty(item.quantity)}
              onClick={item.stockItemId ? () => stack.push(`/stock/item/${item.stockItemId}`) : undefined}
            />
          ))}
        </ul>
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

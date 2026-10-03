import { useEffect, useRef, useState, type MouseEvent } from "react";
import { useParams } from "react-router";
import { getPurchaseOrder, listPurchaseOrderExtraLines, listPurchaseOrderLines, listPurchaseOrders, readError } from "../api";
import { InfiniteScroll, PullToRefresh } from "../MobileList";
import { Notice } from "../Notice";
import { usePageStack } from "../shell/pageStack";
import { useShell } from "../shell/AppShell";
import type { CommandFailure, PurchaseOrderDetail, PurchaseOrderExtraLine, PurchaseOrderLine, PurchaseOrderSummary } from "../types";
import { DetailGroup } from "../ui/DetailGroup";
import { DetailHeading } from "../ui/DetailHeading";
import { DetailRow } from "../ui/DetailRow";
import { PartCard } from "../ui/PartCard";
import { SectionLabel } from "../ui/SectionLabel";
import { TextField } from "../ui/TextField";
import { openLink } from "../ui/openLink";
import { formatQty } from "../ui/quantity";

export function PurchaseOrderListScreen() {
  const { serverId } = useShell();
  const stack = usePageStack();
  const [searchInput, setSearchInput] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const [orders, setOrders] = useState<PurchaseOrderSummary[]>([]);
  const [error, setError] = useState<CommandFailure | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const offsetRef = useRef(0);

  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(searchInput.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  async function loadPage(offset: number, replace: boolean) {
    const page = await listPurchaseOrders(serverId, null, query, offset);
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
        <TextField ref={searchRef} variant="search" placeholder="搜索采购订单" value={searchInput} onChange={setSearchInput} enterKeyHint="search" />
      ) : null}
      <Notice error={error} />
      {loading ? <p className="muted">正在读取采购订单…</p> : null}
      {!loading && orders.length === 0 && !error ? <p className="muted">这里还没有采购订单。</p> : null}
      <PullToRefresh onRefresh={reload}>
        <ul className="part-list">
          {orders.map((order) => (
            <PartCard
              key={order.pk}
              serverId={serverId}
              thumbnail={order.thumbnail}
              title={order.reference || "未编号"}
              detail={order.description || order.supplierName || undefined}
              trailing={order.statusText || undefined}
              onClick={() => stack.push(`/purchase/${order.pk}`)}
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

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="10.5" cy="10.5" r="5.5" />
      <path d="M15 15l4 4" />
    </svg>
  );
}

export function PurchaseOrderDetailScreen() {
  const { serverId } = useShell();
  const stack = usePageStack();
  const params = useParams();
  const orderId = Number(params.orderId);
  const invalid = !Number.isInteger(orderId) || orderId <= 0;
  const [order, setOrder] = useState<PurchaseOrderDetail | null>(null);
  const [lines, setLines] = useState<PurchaseOrderLine[]>([]);
  const [extra, setExtra] = useState<PurchaseOrderExtraLine[]>([]);
  const [error, setError] = useState<CommandFailure | null>(null);
  const [loading, setLoading] = useState(true);
  const [lineError, setLineError] = useState<CommandFailure | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const offsetRef = useRef(0);

  async function loadLines(offset: number, replace: boolean) {
    const page = await listPurchaseOrderLines(serverId, orderId, offset);
    setLines((current) => (replace ? page.results : [...current, ...page.results]));
    offsetRef.current = offset + page.results.length;
    setHasMore(offsetRef.current < page.count);
  }

  async function load() {
    if (invalid) {
      setError({ kind: "invalid", message: "采购订单不存在" });
      setLoading(false);
      return;
    }
    setError(null);
    setLineError(null);
    try {
      const [next, extras] = await Promise.all([
        getPurchaseOrder(serverId, orderId),
        listPurchaseOrderExtraLines(serverId, orderId).catch(() => []),
      ]);
      setOrder(next);
      setExtra(extras);
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
    setExtra([]);
    void load();
  }, [serverId, orderId]);

  const price = order ? [order.totalPrice, order.currency].filter(Boolean).join(" ") : "";
  const progress = order && order.lineCount > 0 ? `${order.completedLines} / ${order.lineCount}` : "";

  return (
    <div className="part-detail">
      <Notice error={error} />
      {loading ? <p className="muted">正在读取采购订单…</p> : null}
      <PullToRefresh onRefresh={load}>
        {order ? (
          <div className="detail-stack">
            <DetailHeading title={order.reference || "未编号"} detail={order.description || undefined} aside={order.statusText || undefined} />
            <DetailGroup>
              {order.supplierName ? (
                <DetailRow
                  title="供应商"
                  detail={order.supplierName}
                  onClick={order.supplierId ? () => stack.push(`/supplier/${order.supplierId}`) : undefined}
                />
              ) : null}
              {order.supplierReference ? <DetailRow title="供应商参考" detail={order.supplierReference} /> : null}
              {progress ? <DetailRow title="行项目" aside={progress} /> : null}
              {price ? <DetailRow title="总价" aside={price} /> : null}
              {order.issueDate ? <DetailRow title="签发日期" aside={order.issueDate} /> : null}
              {order.startDate ? <DetailRow title="起始日期" aside={order.startDate} /> : null}
              {order.targetDate ? <DetailRow title="预计日期" aside={order.targetDate} /> : null}
              {order.completeDate ? <DetailRow title="完成日期" aside={order.completeDate} /> : null}
              {order.link ? <DetailRow title="链接" detail={order.link} onClick={() => openLink(order.link)} /> : null}
              {order.notes ? <DetailRow title="注释" detail={order.notes} note /> : null}
            </DetailGroup>
            {lines.length > 0 ? <SectionLabel>行项目</SectionLabel> : null}
            <Notice error={lineError} />
            <ul className="part-list">
              {lines.map((line) => (
                <PartCard
                  key={line.pk}
                  square
                  serverId={serverId}
                  thumbnail=""
                  title={line.sku || line.partName || "未命名"}
                  detail={[line.sku ? line.partName : "", line.price].filter(Boolean).join(" · ") || undefined}
                  trailing={`${formatQty(line.received)} / ${formatQty(line.quantity)}`}
                  onClick={line.supplierPartId ? () => stack.push(`/parts/supplier/${line.supplierPartId}`) : undefined}
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
            {extra.length > 0 ? <SectionLabel>额外行项目</SectionLabel> : null}
            {extra.length > 0 ? (
              <DetailGroup>
                {extra.map((line) => (
                  <DetailRow key={line.pk} title={line.description || "额外行"} aside={line.price || undefined} />
                ))}
              </DetailGroup>
            ) : null}
          </div>
        ) : null}
      </PullToRefresh>
    </div>
  );
}


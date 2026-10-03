import { useEffect, useRef, useState, type MouseEvent } from "react";
import { useParams } from "react-router";
import {
  getSalesOrder,
  getSalesOrderShipment,
  listSalesOrderExtraLines,
  listSalesOrderLines,
  listSalesOrderShipments,
  listSalesOrders,
  readError,
} from "../api";
import { InfiniteScroll, PullToRefresh } from "../MobileList";
import { Notice } from "../Notice";
import { usePageStack } from "../shell/pageStack";
import { useShell } from "../shell/AppShell";
import type {
  CommandFailure,
  PurchaseOrderExtraLine,
  SalesOrderDetail,
  SalesOrderLine,
  SalesOrderShipment,
  SalesOrderSummary,
} from "../types";
import { DetailGroup } from "../ui/DetailGroup";
import { DetailHeading } from "../ui/DetailHeading";
import { DetailRow } from "../ui/DetailRow";
import { PartCard } from "../ui/PartCard";
import { SectionLabel } from "../ui/SectionLabel";
import { TextField } from "../ui/TextField";
import { openLink } from "../ui/openLink";
import { formatQty } from "../ui/quantity";

export function SalesOrderListScreen() {
  const { serverId } = useShell();
  const stack = usePageStack();
  const params = useParams();
  const customerId = params.companyId ? Number(params.companyId) : null;
  const [searchInput, setSearchInput] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const [orders, setOrders] = useState<SalesOrderSummary[]>([]);
  const [error, setError] = useState<CommandFailure | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const offsetRef = useRef(0);

  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(searchInput.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  async function loadPage(offset: number, replace: boolean) {
    const page = await listSalesOrders(serverId, customerId, query, offset);
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
  }, [serverId, customerId, query]);

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
          placeholder="搜索销售订单"
          value={searchInput}
          onChange={setSearchInput}
          enterKeyHint="search"
        />
      ) : null}
      <Notice error={error} />
      {loading ? <p className="muted">正在读取销售订单…</p> : null}
      {!loading && orders.length === 0 && !error ? <p className="muted">这里还没有销售订单。</p> : null}
      <PullToRefresh onRefresh={reload}>
        <ul className="part-list">
          {orders.map((order) => (
            <PartCard
              key={order.pk}
              serverId={serverId}
              thumbnail={order.thumbnail}
              title={order.reference || "未编号"}
              detail={order.description || order.customerName || undefined}
              trailing={order.statusText || undefined}
              onClick={() => stack.push(`/sales/${order.pk}`)}
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

export function SalesOrderDetailScreen() {
  const { serverId } = useShell();
  const stack = usePageStack();
  const params = useParams();
  const orderId = Number(params.orderId);
  const invalid = !Number.isInteger(orderId) || orderId <= 0;
  const [order, setOrder] = useState<SalesOrderDetail | null>(null);
  const [lines, setLines] = useState<SalesOrderLine[]>([]);
  const [extra, setExtra] = useState<PurchaseOrderExtraLine[]>([]);
  const [error, setError] = useState<CommandFailure | null>(null);
  const [lineError, setLineError] = useState<CommandFailure | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const offsetRef = useRef(0);

  async function loadLines(offset: number, replace: boolean) {
    const page = await listSalesOrderLines(serverId, orderId, offset);
    setLines((current) => (replace ? page.results : [...current, ...page.results]));
    offsetRef.current = offset + page.results.length;
    setHasMore(offsetRef.current < page.count);
  }

  async function load() {
    if (invalid) {
      setError({ kind: "invalid", message: "销售订单不存在" });
      setLoading(false);
      return;
    }
    setError(null);
    setLineError(null);
    try {
      const [next, extras] = await Promise.all([
        getSalesOrder(serverId, orderId),
        listSalesOrderExtraLines(serverId, orderId).catch(() => []),
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
  const shipments =
    order && order.shipmentCount > 0 ? `${order.completedShipments} / ${order.shipmentCount}` : "";

  return (
    <div className="part-detail">
      <Notice error={error} />
      {loading ? <p className="muted">正在读取销售订单…</p> : null}
      <PullToRefresh onRefresh={load}>
        {order ? (
          <div className="detail-stack">
            <DetailHeading
              title={order.reference || "未编号"}
              detail={order.description || undefined}
              aside={order.statusText || undefined}
            />
            <DetailGroup>
              {order.customerName ? (
                <DetailRow
                  title="客户"
                  detail={order.customerName}
                  onClick={order.customerId ? () => stack.push(`/customer/${order.customerId}`) : undefined}
                />
              ) : null}
              {order.customerReference ? <DetailRow title="客户指引" detail={order.customerReference} /> : null}
              {progress ? <DetailRow title="行项目" aside={progress} /> : null}
              {shipments ? (
                <DetailRow
                  title="配送"
                  aside={shipments}
                  onClick={() => stack.push(`/sales/${order.pk}/shipments`)}
                />
              ) : null}
              {price ? <DetailRow title="总价" aside={price} /> : null}
              {order.issueDate ? <DetailRow title="签发日期" aside={order.issueDate} /> : null}
              {order.startDate ? <DetailRow title="起始日期" aside={order.startDate} /> : null}
              {order.targetDate ? <DetailRow title="预计日期" aside={order.targetDate} /> : null}
              {order.shipmentDate ? <DetailRow title="完成日期" aside={order.shipmentDate} /> : null}
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
                  thumbnail={line.thumbnail}
                  title={line.partName || "未命名零件"}
                  detail={line.price || undefined}
                  trailing={`${formatQty(line.shipped)} / ${formatQty(line.quantity)}`}
                  onClick={line.partId ? () => stack.push(`/parts/${line.partId}`) : undefined}
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

export function SalesShipmentListScreen() {
  const { serverId } = useShell();
  const stack = usePageStack();
  const params = useParams();
  const orderId = Number(params.orderId);
  const invalid = !Number.isInteger(orderId) || orderId <= 0;
  const [items, setItems] = useState<SalesOrderShipment[]>([]);
  const [error, setError] = useState<CommandFailure | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    if (invalid) {
      setError({ kind: "invalid", message: "销售订单不存在" });
      setLoading(false);
      return;
    }
    setError(null);
    try {
      setItems(await listSalesOrderShipments(serverId, orderId));
    } catch (reason: unknown) {
      setError(readError(reason));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setLoading(true);
    void load();
  }, [serverId, orderId]);

  return (
    <div className="part-detail">
      <Notice error={error} />
      {loading ? <p className="muted">正在读取配送…</p> : null}
      <PullToRefresh onRefresh={load}>
        {!loading && items.length === 0 && !error ? <p className="muted">这里还没有配送。</p> : null}
        <ul className="part-list">
          {items.map((item) => (
            <PartCard
              key={item.pk}
              square
              serverId={serverId}
              thumbnail=""
              title={item.reference || "未编号"}
              detail={item.trackingNumber || item.invoiceNumber || undefined}
              trailing={item.deliveryDate ? "已交货" : item.shipmentDate ? "已发货" : "未发货"}
              onClick={() => stack.push(`/sales/shipment/${item.pk}`)}
            />
          ))}
        </ul>
      </PullToRefresh>
    </div>
  );
}

export function SalesShipmentScreen() {
  const { serverId } = useShell();
  const stack = usePageStack();
  const params = useParams();
  const shipmentId = Number(params.shipmentId);
  const invalid = !Number.isInteger(shipmentId) || shipmentId <= 0;
  const [item, setItem] = useState<SalesOrderShipment | null>(null);
  const [error, setError] = useState<CommandFailure | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    if (invalid) {
      setError({ kind: "invalid", message: "配送不存在" });
      setLoading(false);
      return;
    }
    setError(null);
    try {
      setItem(await getSalesOrderShipment(serverId, shipmentId));
    } catch (reason: unknown) {
      setItem(null);
      setError(readError(reason));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setLoading(true);
    void load();
  }, [serverId, shipmentId]);

  const shipped = Boolean(item?.shipmentDate);
  const delivered = Boolean(item?.deliveryDate);

  return (
    <div className="part-detail">
      <Notice error={error} />
      {loading ? <p className="muted">正在读取配送…</p> : null}
      <PullToRefresh onRefresh={load}>
        {item ? (
          <div className="detail-stack">
            <DetailHeading title={item.reference || "未编号"} />
            <DetailGroup>
              {item.orderId ? (
                <DetailRow title="销售订单" onClick={() => stack.push(`/sales/${item.orderId}`)} />
              ) : null}
              <DetailRow title="参考编号" aside={item.reference || "未编号"} />
              {item.invoiceNumber ? <DetailRow title="发票号码" aside={item.invoiceNumber} /> : null}
              {item.trackingNumber ? <DetailRow title="运单号" aside={item.trackingNumber} /> : null}
              <DetailRow title="已核对" aside={item.checked ? "是" : "否"} />
              <DetailRow title="发货日期" aside={shipped ? item.shipmentDate : "不适用"} />
              <DetailRow title="交货日期" aside={delivered ? item.deliveryDate : "不适用"} />
              {item.link ? <DetailRow title="链接" detail={item.link} onClick={() => openLink(item.link)} /> : null}
              {item.notes ? <DetailRow title="注释" detail={item.notes} note /> : null}
            </DetailGroup>
          </div>
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

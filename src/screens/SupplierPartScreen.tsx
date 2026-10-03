import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router";
import { getSupplierPart, listSupplierParts, readError } from "../api";
import { InfiniteScroll, PullToRefresh } from "../MobileList";
import { Notice } from "../Notice";
import { usePageStack } from "../shell/pageStack";
import { useShell } from "../shell/AppShell";
import type { CommandFailure, SupplierPartDetail, SupplierPartSummary } from "../types";
import { PartThumb } from "./PartsScreen";

function formatQty(value: number): string {
  if (!Number.isFinite(value)) {
    return "0";
  }
  if (Number.isInteger(value)) {
    return String(value);
  }
  return String(Math.round(value * 1000) / 1000);
}

export function SupplierPartListScreen() {
  const { serverId } = useShell();
  const stack = usePageStack();
  const params = useParams();
  const partPk = Number(params.partId);
  const invalid = !Number.isInteger(partPk) || partPk <= 0;
  const [items, setItems] = useState<SupplierPartSummary[]>([]);
  const [error, setError] = useState<CommandFailure | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const offsetRef = useRef(0);

  async function loadPage(offset: number, replace: boolean) {
    const page = await listSupplierParts(serverId, partPk, offset);
    setItems((current) => (replace ? page.results : [...current, ...page.results]));
    offsetRef.current = offset + page.results.length;
    setHasMore(offsetRef.current < page.count);
  }

  useEffect(() => {
    if (invalid) {
      setLoading(false);
      setError({ kind: "invalid", message: "零件不存在" });
      return;
    }
    let active = true;
    setLoading(true);
    listSupplierParts(serverId, partPk, 0)
      .then((page) => {
        if (!active) {
          return;
        }
        setItems(page.results);
        offsetRef.current = page.results.length;
        setHasMore(page.results.length < page.count);
        setError(null);
      })
      .catch((reason: unknown) => {
        if (active) {
          setError(readError(reason));
          setHasMore(false);
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [serverId, partPk, invalid]);

  return (
    <div className="part-detail subpage-top">
      <Notice error={error} />
      {loading ? <p className="muted">正在读取供应商零件…</p> : null}
      <PullToRefresh
        onRefresh={async () => {
          if (!invalid) {
            await loadPage(0, true);
          }
        }}
      >
        {!loading && items.length === 0 && !error ? <p className="muted">这里还没有供应商零件。</p> : null}
        <ul className="part-list">
          {items.map((item) => (
            <li key={item.pk}>
              <button
                className="part-card stock-card"
                type="button"
                onClick={() => stack.push(`/parts/supplier/${item.pk}`)}
              >
                <PartThumb serverId={serverId} thumbnail={item.supplierImage} />
                <div className="part-body">
                  <strong>{item.sku || "未编号"}</strong>
                  {item.supplierName ? <small>{item.supplierName}</small> : null}
                  <span className="part-qty">{formatQty(item.inStock)}</span>
                </div>
              </button>
            </li>
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

export function SupplierPartDetailScreen() {
  const { serverId } = useShell();
  const stack = usePageStack();
  const params = useParams();
  const supplierPartId = Number(params.supplierPartId);
  const invalid = !Number.isInteger(supplierPartId) || supplierPartId <= 0;
  const [item, setItem] = useState<SupplierPartDetail | null>(null);
  const [error, setError] = useState<CommandFailure | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    if (invalid) {
      setError({ kind: "invalid", message: "供应商零件不存在" });
      setLoading(false);
      return;
    }
    setError(null);
    try {
      setItem(await getSupplierPart(serverId, supplierPartId));
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
  }, [serverId, supplierPartId]);

  return (
    <div className="part-detail subpage-top">
      <Notice error={error} />
      {loading ? <p className="muted">正在读取供应商零件…</p> : null}
      <PullToRefresh onRefresh={load}>
        {item ? (
          <div className="detail-stack">
            <div className="detail-heading">
              <strong>{item.sku || "未编号"}</strong>
              {item.supplierName ? <p className="detail-spec">{item.supplierName}</p> : null}
            </div>
            <div className="detail-group">
              {!item.active ? <InfoRow title="未激活" detail="此供应商零件已停用" danger /> : null}
              <button
                className="detail-row"
                type="button"
                onClick={() => {
                  if (item.partId > 0) {
                    stack.push(`/parts/${item.partId}`);
                  }
                }}
              >
                <span className="detail-copy">
                  <strong>内部零件</strong>
                  {item.partName ? <small>{item.partName}</small> : null}
                </span>
                <Chevron />
              </button>
              <InfoRow title="主供应商" aside={item.primary ? "是" : "否"} />
              <InfoRow title="可用库存" aside={formatQty(item.inStock)} />
              {item.supplierName ? <InfoRow title="供应商" detail={item.supplierName} /> : null}
              <InfoRow title="供应商零件编号" detail={item.sku || "未编号"} />
              {item.manufacturerName ? <InfoRow title="制造商" detail={item.manufacturerName} /> : null}
              {item.mpn ? <InfoRow title="制造商零件" detail={item.mpn} /> : null}
              {item.packaging || item.packQuantity ? (
                <InfoRow title="包装" detail={item.packaging} aside={item.packQuantity} />
              ) : null}
              {item.link ? (
                <button className="detail-row" type="button" onClick={() => openLink(item.link)}>
                  <span className="detail-copy">
                    <strong>外部链接</strong>
                    <small>{item.link}</small>
                  </span>
                  <Chevron />
                </button>
              ) : null}
              {item.note ? <InfoRow title="注释" detail={item.note} note /> : null}
            </div>
          </div>
        ) : null}
      </PullToRefresh>
    </div>
  );
}

function InfoRow({
  title,
  detail,
  aside,
  danger,
  note,
}: {
  title: string;
  detail?: string;
  aside?: string;
  danger?: boolean;
  note?: boolean;
}) {
  return (
    <div className={danger ? "detail-row is-danger" : "detail-row"}>
      <span className="detail-copy">
        <strong>{title}</strong>
        {detail ? <small className={note ? "detail-notes" : undefined}>{detail}</small> : null}
      </span>
      {aside ? <span className="detail-aside">{aside}</span> : null}
    </div>
  );
}

function Chevron() {
  return (
    <svg className="row-chevron" viewBox="0 0 24 24" aria-hidden="true">
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

function openLink(url: string) {
  if (!/^https?:\/\//i.test(url)) {
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

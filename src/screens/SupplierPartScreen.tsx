import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router";
import { getSupplierPart, listSupplierParts, readError } from "../api";
import { InfiniteScroll, PullToRefresh } from "../MobileList";
import { Notice } from "../Notice";
import { usePageStack } from "../shell/pageStack";
import { useShell } from "../shell/AppShell";
import type { CommandFailure, SupplierPartDetail, SupplierPartSummary } from "../types";
import { DetailGroup } from "../ui/DetailGroup";
import { DetailHeading } from "../ui/DetailHeading";
import { DetailRow } from "../ui/DetailRow";
import { PartCard } from "../ui/PartCard";
import { openLink } from "../ui/openLink";
import { formatQty } from "../ui/quantity";

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
    <div className="part-detail">
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
            <PartCard
              key={item.pk}
              square
              serverId={serverId}
              thumbnail={item.supplierImage}
              title={item.sku || "未编号"}
              detail={item.supplierName || undefined}
              trailing={formatQty(item.inStock)}
              onClick={() => stack.push(`/parts/supplier/${item.pk}`)}
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
    <div className="part-detail">
      <Notice error={error} />
      {loading ? <p className="muted">正在读取供应商零件…</p> : null}
      <PullToRefresh onRefresh={load}>
        {item ? (
          <div className="detail-stack">
            <DetailHeading title={item.sku || "未编号"} detail={item.supplierName || undefined} />
            <DetailGroup>
              {!item.active ? <DetailRow title="未激活" detail="此供应商零件已停用" danger /> : null}
              <DetailRow
                title="内部零件"
                detail={item.partName || undefined}
                onClick={item.partId > 0 ? () => stack.push(`/parts/${item.partId}`) : undefined}
              />
              <DetailRow title="主供应商" aside={item.primary ? "是" : "否"} />
              <DetailRow title="可用库存" aside={formatQty(item.inStock)} />
              {item.supplierName ? <DetailRow title="供应商" detail={item.supplierName} /> : null}
              <DetailRow title="供应商零件编号" detail={item.sku || "未编号"} />
              {item.manufacturerName ? <DetailRow title="制造商" detail={item.manufacturerName} /> : null}
              {item.mpn ? <DetailRow title="制造商零件" detail={item.mpn} /> : null}
              {item.packaging || item.packQuantity ? (
                <DetailRow title="包装" detail={item.packaging || undefined} aside={item.packQuantity || undefined} />
              ) : null}
              {item.link ? <DetailRow title="外部链接" detail={item.link} onClick={() => openLink(item.link)} /> : null}
              {item.note ? <DetailRow title="注释" detail={item.note} note /> : null}
            </DetailGroup>
          </div>
        ) : null}
      </PullToRefresh>
    </div>
  );
}

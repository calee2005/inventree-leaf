import { useEffect, useRef, useState } from "react";
import { useLocation, useParams } from "react-router";
import { getPart, listPartStock, loadPartImage, loadPartThumbnail, readError } from "../api";
import { watchPartImage } from "./PartImageScreen";
import { InfiniteScroll, PullToRefresh } from "../MobileList";
import { Notice } from "../Notice";
import { usePageStack } from "../shell/pageStack";
import { useShell } from "../shell/AppShell";
import type { CommandFailure, PartDetail, PartStockItem, PartSummary } from "../types";
import { DetailHeading } from "../ui/DetailHeading";
import { DetailRow as Row } from "../ui/DetailRow";
import { PartCard } from "../ui/PartCard";
import { SegmentTabs } from "../ui/SegmentTabs";
import { openLink } from "../ui/openLink";
import { formatQty, formatStock } from "../ui/quantity";

type Tab = "detail" | "stock";

function readPreview(state: unknown, pk: number): PartSummary | null {
  if (typeof state !== "object" || state === null || !("pk" in state) || !("name" in state)) {
    return null;
  }
  const preview = state as PartSummary;
  return preview.pk === pk ? preview : null;
}

export function PartDetailScreen() {
  const { serverId, setActions } = useShell();
  const stack = usePageStack();
  const params = useParams();
  const location = useLocation();
  const partPk = Number(params.partId);
  const preview = readPreview(location.state, partPk);
  const [tab, setTab] = useState<Tab>("detail");
  const [part, setPart] = useState<PartDetail | null>(null);
  const [error, setError] = useState<CommandFailure | null>(null);
  const [loading, setLoading] = useState(true);
  const [stock, setStock] = useState<PartStockItem[]>([]);
  const [stockError, setStockError] = useState<CommandFailure | null>(null);
  const [stockLoading, setStockLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const offsetRef = useRef(0);

  async function reload() {
    setError(null);
    try {
      setPart(await getPart(serverId, partPk));
    } catch (reason: unknown) {
      setError(readError(reason));
    }
  }

  useEffect(() => {
    if (!Number.isInteger(partPk) || partPk <= 0) {
      return;
    }
    return watchPartImage(partPk, () => {
      void getPart(serverId, partPk).then(setPart).catch(() => undefined);
    });
  }, [serverId, partPk]);

  useEffect(() => {
    if (!Number.isInteger(partPk) || partPk <= 0) {
      setLoading(false);
      setPart(null);
      setError({ kind: "invalid", message: "零件不存在" });
      return;
    }
    let active = true;
    setLoading(true);
    setPart(null);
    setTab("detail");
    setStock([]);
    setHasMore(false);
    offsetRef.current = 0;
    getPart(serverId, partPk)
      .then((next) => {
        if (active) {
          setPart(next);
          setError(null);
        }
      })
      .catch((reason: unknown) => {
        if (active) {
          setError(readError(reason));
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
  }, [serverId, partPk]);

  async function loadStock(offset: number, replace: boolean) {
    const page = await listPartStock(serverId, partPk, offset);
    if (replace) {
      setStock(page.results);
    } else {
      setStock((current) => [...current, ...page.results]);
    }
    const nextOffset = offset + page.results.length;
    offsetRef.current = nextOffset;
    setHasMore(nextOffset < page.count);
  }

  async function reloadStock() {
    setStockError(null);
    offsetRef.current = 0;
    setHasMore(false);
    try {
      await loadStock(0, true);
    } catch (reason: unknown) {
      setStockError(readError(reason));
      setHasMore(false);
    }
  }

  useEffect(() => {
    if (tab !== "stock" || !Number.isInteger(partPk) || partPk <= 0) {
      return;
    }
    let active = true;
    setStockLoading(true);
    setStockError(null);
    listPartStock(serverId, partPk, 0)
      .then((page) => {
        if (!active) {
          return;
        }
        setStock(page.results);
        offsetRef.current = page.results.length;
        setHasMore(page.results.length < page.count);
      })
      .catch((reason: unknown) => {
        if (active) {
          setStockError(readError(reason));
          setHasMore(false);
        }
      })
      .finally(() => {
        if (active) {
          setStockLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [tab, serverId, partPk]);

  async function loadMore() {
    try {
      await loadStock(offsetRef.current, false);
    } catch (reason: unknown) {
      setStockError(readError(reason));
      throw reason;
    }
  }

  const stackRef = useRef(stack);
  stackRef.current = stack;

  useEffect(() => {
    if (!part) {
      setActions([]);
      return;
    }
    const pk = part.pk;
    const actions = [
      {
        id: "edit-part",
        label: "编辑零件",
        onSelect: () => stackRef.current.push(`/parts/${pk}/edit`),
      },
      {
        id: "duplicate-part",
        label: "复制零件",
        onSelect: () => stackRef.current.push(`/parts/${pk}/duplicate`),
      },
    ];
    if (tab === "stock") {
      const locationId = part.locationId;
      const locationName = part.location;
      const partName = part.name;
      const units = part.units;
      const trackable = part.trackable;
      actions.push({
        id: "add-stock",
        label: "添加库存",
        onSelect: () =>
          stackRef.current.push("/stock/item/new", {
            partId: pk,
            partName,
            units,
            trackable,
            locationId,
            locationName,
          }),
      });
    }
    setActions(actions);
    return () => setActions([]);
  }, [part, tab, setActions]);

  const title = part?.fullName || part?.name || preview?.name || "零件";
  const description = part?.description || preview?.description || "";
  const thumbnail = part?.thumbnail || "";
  const stockLabel = part
    ? formatStock(part.inStock, part.units)
    : preview
      ? formatStock(preview.inStock, preview.units)
      : "";

  return (
    <div className="part-detail">
      <SegmentTabs
        value={tab}
        options={[
          { id: "detail", label: "详细信息" },
          { id: "stock", label: "库存" },
        ]}
        onChange={setTab}
      />
      <Notice error={tab === "stock" ? stockError : error} />
      <PullToRefresh
        onRefresh={async () => {
          if (tab === "stock") {
            await reloadStock();
            return;
          }
          await reload();
        }}
      >
        <article className="detail-hero">
          <DetailPhoto
            serverId={serverId}
            image={part?.image || ""}
            thumbnail={thumbnail}
            onOpen={Number.isInteger(partPk) && partPk > 0 ? () => stack.push(`/parts/${partPk}/image`) : undefined}
          />
          <DetailHeading title={title} detail={description || undefined} aside={stockLabel || undefined} />
        </article>
        {tab === "detail" ? (
          <>
            {loading && !part ? <p className="muted">正在读取零件…</p> : null}
            {part ? (
              <DetailRows
                part={part}
                onOpenTemplate={(pk) => stack.push(`/parts/${pk}`)}
                onOpenCategory={(id) =>
                  stack.push(id ? `/parts/category/${id}` : "/parts/category/root")
                }
                onOpenPricing={() => stack.push(`/parts/${part.pk}/pricing`)}
                onOpenSuppliers={() => stack.push(`/parts/${part.pk}/suppliers`)}
                onOpenBom={() => stack.push(`/parts/${part.pk}/bom`)}
                onOpenUsedIn={() => stack.push(`/parts/${part.pk}/used-in`)}
              />
            ) : null}
          </>
        ) : (
          <>
            {stockLoading && stock.length === 0 ? <p className="muted">正在读取库存…</p> : null}
            {!stockLoading && stock.length === 0 && !stockError ? (
              <p className="muted">这里还没有库存。</p>
            ) : null}
            <ul className="part-list">
              {stock.map((item) => (
                <PartCard
                  key={item.pk}
                  square
                  serverId={serverId}
                  thumbnail={item.thumbnail}
                  title={item.partName || title}
                  detail={item.location || "未设置位置"}
                  trailing={item.quantity || undefined}
                  onClick={() => stack.push(`/stock/item/${item.pk}`)}
                />
              ))}
            </ul>
            {stock.length > 0 || hasMore ? <InfiniteScroll loadMore={loadMore} hasMore={hasMore} /> : null}
          </>
        )}
      </PullToRefresh>
    </div>
  );
}

function DetailRows({
  part,
  onOpenTemplate,
  onOpenCategory,
  onOpenPricing,
  onOpenSuppliers,
  onOpenBom,
  onOpenUsedIn,
}: {
  part: PartDetail;
  onOpenTemplate: (pk: number) => void;
  onOpenCategory: (id: number | null) => void;
  onOpenPricing: () => void;
  onOpenSuppliers: () => void;
  onOpenBom: () => void;
  onOpenUsedIn: () => void;
}) {
  return (
    <div className="detail-group">
      {!part.active ? (
        <Row title="未激活" detail="此零件已停用" danger icon={<AlertIcon />} />
      ) : null}
      {part.templatePk ? (
        <Row
          title="上级模板"
          detail={part.templateName || "模板零件"}
          icon={<VersionsIcon />}
          onClick={() => onOpenTemplate(part.templatePk as number)}
        />
      ) : null}
      <Row
        title="零件类别"
        detail={part.categoryName || "未分类"}
        icon={<SitemapIcon />}
        onClick={() => onOpenCategory(part.categoryId)}
      />
      {part.variantCount > 0 ? (
        <Row title="变体" aside={String(part.variantCount)} icon={<VersionsIcon />} />
      ) : null}
      <Row
        title="可用库存"
        detail="当前可使用的数量"
        aside={formatStock(part.inStock, part.units)}
        icon={<PackagesIcon />}
      />
      {part.location ? <Row title="默认位置" detail={part.location} icon={<PinIcon />} /> : null}
      {part.assembly && (part.building > 0 || part.scheduledToBuild > 0) ? (
        <Row
          title="正在生产"
          aside={`${formatQty(part.building)} / ${formatQty(part.scheduledToBuild)}`}
          icon={<ToolIcon />}
          meter={ratio(part.building, part.scheduledToBuild)}
        />
      ) : null}
      {part.assembly && part.active && part.canBuild !== null ? (
        <Row title="可以生产" detail="按现有库存能组装的数量" aside={formatQty(part.canBuild)} icon={<CheckIcon />} />
      ) : null}
      {part.allocatedToBuild > 0 || part.requiredForBuild > 0 ? (
        <Row
          title="分配给生产订单"
          aside={`${formatQty(part.allocatedToBuild)} / ${formatQty(part.requiredForBuild)}`}
          icon={<ToolIcon />}
          meter={ratio(part.allocatedToBuild, part.requiredForBuild)}
        />
      ) : null}
      {part.salable && (part.allocatedToSales > 0 || part.requiredForSales > 0) ? (
        <Row
          title="分配给销售订单"
          aside={`${formatQty(part.allocatedToSales)} / ${formatQty(part.requiredForSales)}`}
          icon={<TruckIcon />}
          meter={ratio(part.allocatedToSales, part.requiredForSales)}
        />
      ) : null}
      {part.purchaseable && part.ordering > 0 ? (
        <Row title="在途订购" detail="当前订购数量" aside={formatQty(part.ordering)} icon={<CartIcon />} />
      ) : null}
      {part.priceLabel !== null ? (
        <Row
          title="价格"
          detail={part.priceLabel || "暂无价格"}
          icon={<PriceIcon />}
          onClick={onOpenPricing}
        />
      ) : null}
      {part.assembly ? (
        <Row title="物料清单" aside={String(part.bomCount)} icon={<TreeIcon />} onClick={onOpenBom} />
      ) : null}
      {part.component && part.usedInCount > 0 ? (
        <Row
          title="用于装配"
          detail="需要此零件的装配体"
          aside={String(part.usedInCount)}
          icon={<StackIcon />}
          onClick={onOpenUsedIn}
        />
      ) : null}
      {part.keywords ? <Row title="关键词" detail={part.keywords} icon={<TagIcon />} /> : null}
      {part.link ? (
        <Row title="外部链接" detail={part.link} icon={<LinkIcon />} onClick={() => openLink(part.link)} />
      ) : null}
      {part.purchaseable && part.supplierCount > 0 ? (
        <Row
          title="供应商"
          aside={String(part.supplierCount)}
          icon={<FactoryIcon />}
          onClick={onOpenSuppliers}
        />
      ) : null}
      <Row title="注释" detail={part.notes || "没有注释"} icon={<NoteIcon />} note />
      {part.parameters.length > 0 ? (
        <>
          <Row title="参数" aside={String(part.parameters.length)} icon={<ListIcon />} />
          {part.parameters.map((item, index) => (
            <div className="param-line" key={`${item.name}-${index}`}>
              <span>{item.name}</span>
              <span>{[item.value, item.units].filter((text) => text.trim()).join(" ")}</span>
            </div>
          ))}
        </>
      ) : null}
      <Row
        title="附件"
        aside={part.attachmentCount > 0 ? String(part.attachmentCount) : undefined}
        icon={<FileIcon />}
      />
    </div>
  );
}

function DetailPhoto({
  serverId,
  image,
  thumbnail,
  onOpen,
}: {
  serverId: string;
  image: string;
  thumbnail: string;
  onOpen?: () => void;
}) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    const full = image.trim();
    const thumb = thumbnail.trim();
    if (!full && !thumb) {
      setSrc(null);
      return;
    }
    let active = true;
    const load = full
      ? loadPartImage(serverId, full).catch(() => (thumb ? loadPartThumbnail(serverId, thumb) : Promise.reject()))
      : loadPartThumbnail(serverId, thumb);
    load
      .then((url) => {
        if (active) {
          setSrc(url);
        }
      })
      .catch(() => {
        if (active) {
          setSrc(null);
        }
      });
    return () => {
      active = false;
    };
  }, [serverId, image, thumbnail]);

  const picture = src ? <img alt="" src={src} /> : <PhotoIcon />;
  if (!onOpen) {
    return <div className="detail-photo">{picture}</div>;
  }
  return (
    <button className="detail-photo" type="button" aria-label="零件图片" onClick={onOpen}>
      {picture}
    </button>
  );
}

function PhotoIcon() {
  return (
    <svg className="detail-photo-fallback" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4" y="5" width="16" height="14" rx="2" />
      <circle cx="9" cy="10" r="1.2" />
      <path d="M7 16l3.2-3.2 2.2 2.2L16 11.5 19 15" />
    </svg>
  );
}

function ratio(current: number, maximum: number) {
  if (maximum <= 0) {
    return current > 0 ? 1 : 0;
  }
  return Math.max(0, Math.min(1, current / maximum));
}

function AlertIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v5" />
      <path d="M12 16.5h.01" />
    </svg>
  );
}

function VersionsIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="7" y="7" width="11" height="11" rx="2" />
      <path d="M6 16.5H5.5A1.5 1.5 0 0 1 4 15V5.5A1.5 1.5 0 0 1 5.5 4H15a1.5 1.5 0 0 1 1.5 1.5V6" />
    </svg>
  );
}

function SitemapIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="9" y="3.5" width="6" height="4" rx="1" />
      <rect x="3.5" y="16.5" width="6" height="4" rx="1" />
      <rect x="14.5" y="16.5" width="6" height="4" rx="1" />
      <path d="M12 7.5v4M6.5 16.5v-2.5h11V12" />
    </svg>
  );
}

function PackagesIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3.5 20 8v8l-8 4.5L4 16V8z" />
      <path d="M12 12.5 20 8M12 12.5 4 8M12 12.5V20" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 21s6-5.2 6-10a6 6 0 1 0-12 0c0 4.8 6 10 6 10z" />
      <circle cx="12" cy="11" r="1.6" />
    </svg>
  );
}

function ToolIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M14.5 5.5a4 4 0 0 0-5.2 4.8L4 15.6 8.4 20l5.3-5.3a4 4 0 0 0 4.8-5.2L16 12l-4-4z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8" />
      <path d="m8.5 12.2 2.4 2.4 4.6-5" />
    </svg>
  );
}

function TruckIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 7h11v8H3z" />
      <path d="M14 10h4l3 3v2h-7" />
      <circle cx="7" cy="17.5" r="1.4" />
      <circle cx="17" cy="17.5" r="1.4" />
    </svg>
  );
}

function CartIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 6h2l1.4 9h10.2l1.6-6H8" />
      <circle cx="10" cy="19" r="1.2" />
      <circle cx="17" cy="19" r="1.2" />
    </svg>
  );
}

function PriceIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8" />
      <path d="M12 7.5v9M9.5 9.2c.6-.8 1.4-1.1 2.5-1.1 1.4 0 2.3.7 2.3 1.8S13.4 11.6 12 12s-2.4.7-2.4 1.9 1 1.9 2.4 1.9c1.1 0 1.9-.3 2.5-1" />
    </svg>
  );
}

function TreeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 5h5M6 12h5M6 19h5" />
      <path d="M4 5h.01M4 12h.01M4 19h.01M11 5v14M11 12h4" />
    </svg>
  );
}

function StackIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m12 4 8 4-8 4-8-4z" />
      <path d="m4 12 8 4 8-4" />
      <path d="m4 16 8 4 8-4" />
    </svg>
  );
}

function TagIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 12.5V5h7.5L20 13.5 13.5 20z" />
      <circle cx="8.2" cy="8.2" r="1" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M10 13a4 4 0 0 0 5.7.3l2.3-2.3a4 4 0 0 0-5.7-5.6L11 6.7" />
      <path d="M14 11a4 4 0 0 0-5.7-.3L6 13a4 4 0 0 0 5.7 5.6l1.3-1.3" />
    </svg>
  );
}

function FactoryIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 20V10l5 3V10l5 3V8l8 4v8z" />
      <path d="M7 20v-3h3v3M14 20v-3h3v3" />
    </svg>
  );
}

function NoteIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 4.5h8l4 4V19.5H7z" />
      <path d="M15 4.5V9h4M9.5 13h6M9.5 16.5h4" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 7h10M9 12h10M9 17h10" />
      <path d="M5 7h.01M5 12h.01M5 17h.01" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 3.5h7l5 5V20.5H7z" />
      <path d="M14 3.5V9h5" />
    </svg>
  );
}

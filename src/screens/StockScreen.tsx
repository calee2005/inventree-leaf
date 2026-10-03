import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router";
import {
  deleteStockItem,
  deleteStockLocation,
  getStockItem,
  getStockLocation,
  listLocationStock,
  listStockLocationLevel,
  readError,
} from "../api";
import { InfiniteScroll, PullToRefresh } from "../MobileList";
import { Notice } from "../Notice";
import { usePageStack } from "../shell/pageStack";
import { useShell } from "../shell/AppShell";
import type {
  CommandFailure,
  StockItemDetail,
  StockLocationDetail,
  StockLocationSummary,
} from "../types";
import { DetailGroup } from "../ui/DetailGroup";
import { DetailHeading } from "../ui/DetailHeading";
import { DetailRow } from "../ui/DetailRow";
import { PartCard } from "../ui/PartCard";
import { SectionLabel } from "../ui/SectionLabel";
import { SegmentTabs } from "../ui/SegmentTabs";
import { TextField } from "../ui/TextField";
import { openLink } from "../ui/openLink";
import { formatStock } from "../ui/quantity";

type Tab = "detail" | "items";

export function StockLocationScreen() {
  const { serverId, setActions } = useShell();
  const stack = usePageStack();
  const stackRef = useRef(stack);
  stackRef.current = stack;
  const params = useParams();
  const rawId = params.locationId;
  const isRoot = !rawId || rawId === "root";
  const locationPk = isRoot ? null : Number(rawId);
  const invalid = !isRoot && (!Number.isInteger(locationPk) || (locationPk ?? 0) <= 0);
  const [tab, setTab] = useState<Tab>("detail");
  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState<StockLocationDetail | null>(null);
  const [error, setError] = useState<CommandFailure | null>(null);
  const [loading, setLoading] = useState(!isRoot);
  const [children, setChildren] = useState<StockLocationSummary[]>([]);
  const [childError, setChildError] = useState<CommandFailure | null>(null);
  const [childLoading, setChildLoading] = useState(true);
  const [childHasMore, setChildHasMore] = useState(false);
  const childOffset = useRef(0);
  const [items, setItems] = useState<StockItemDetail[]>([]);
  const [itemError, setItemError] = useState<CommandFailure | null>(null);
  const [itemLoading, setItemLoading] = useState(false);
  const [itemHasMore, setItemHasMore] = useState(false);
  const itemOffset = useRef(0);

  const removeLocationRef = useRef<(pk: number) => void>(() => {});

  useEffect(() => {
    if (isRoot) {
      setActions([
        {
          id: "create-location",
          label: "新建仓储位置",
          onSelect: () => stackRef.current.push("/stock/location/new"),
        },
        {
          id: "create-item",
          label: "新建库存项",
          onSelect: () => stackRef.current.push("/stock/item/new"),
        },
      ]);
      return () => setActions([]);
    }
    if (!location) {
      setActions([]);
      return;
    }
    const placeId = location.pk;
    const placeName = location.name;
    const placePath = location.pathstring || location.name;
    setActions([
      {
        id: "create-location",
        label: "新建仓储位置",
        onSelect: () => stackRef.current.push("/stock/location/new", { parentId: placeId, parentName: placeName }),
      },
      {
        id: "create-item",
        label: "新建库存项",
        onSelect: () => stackRef.current.push("/stock/item/new", { locationId: placeId, locationName: placePath }),
      },
      {
        id: "edit-location",
        label: "编辑位置",
        onSelect: () => stackRef.current.push(`/stock/location/${placeId}/edit`),
      },
      {
        id: "delete-location",
        label: "删除位置",
        onSelect: () => removeLocationRef.current(placeId),
      },
    ]);
    return () => setActions([]);
  }, [isRoot, location, setActions]);

  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(searchInput.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setTab("detail");
    setLocation(null);
    setChildren([]);
    setItems([]);
    childOffset.current = 0;
    itemOffset.current = 0;
    if (invalid) {
      setLoading(false);
      setError({ kind: "invalid", message: "库存地点不存在" });
      return;
    }
    let active = true;
    if (isRoot || locationPk === null) {
      setLoading(false);
      setError(null);
    } else {
      setLoading(true);
      getStockLocation(serverId, locationPk)
        .then((next) => {
          if (active) {
            setLocation(next);
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
    }
    setChildLoading(true);
    listStockLocationLevel(serverId, locationPk, 0, query)
      .then((page) => {
        if (!active) {
          return;
        }
        setChildren(page.results);
        childOffset.current = page.results.length;
        setChildHasMore(page.results.length < page.count);
        setChildError(null);
      })
      .catch((reason: unknown) => {
        if (active) {
          setChildError(readError(reason));
          setChildHasMore(false);
        }
      })
      .finally(() => {
        if (active) {
          setChildLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [serverId, isRoot, locationPk, invalid, query]);

  useEffect(() => {
    if (tab !== "items" || invalid) {
      return;
    }
    let active = true;
    setItemLoading(true);
    setItems([]);
    itemOffset.current = 0;
    listLocationStock(serverId, locationPk, 0, query)
      .then((page) => {
        if (!active) {
          return;
        }
        setItems(page.results);
        itemOffset.current = page.results.length;
        setItemHasMore(page.results.length < page.count);
        setItemError(null);
      })
      .catch((reason: unknown) => {
        if (active) {
          setItemError(readError(reason));
          setItemHasMore(false);
        }
      })
      .finally(() => {
        if (active) {
          setItemLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [tab, serverId, locationPk, invalid, query]);

  const title = isRoot ? "顶级库存地点" : location?.name || "库存地点";
  removeLocationRef.current = removeLocation;

  return (
    <div className="part-detail">
      <TextField placeholder="搜索地点或库存项" value={searchInput} onChange={setSearchInput} />
      <SegmentTabs
        value={tab}
        options={[
          { id: "detail", label: "详细信息" },
          { id: "items", label: "库存项" },
        ]}
        onChange={setTab}
      />
      <Notice error={tab === "items" ? itemError : error ?? childError} />
      <PullToRefresh
        onRefresh={async () => {
          if (invalid) {
            return;
          }
          if (tab === "items") {
            const page = await listLocationStock(serverId, locationPk, 0, query);
            setItems(page.results);
            itemOffset.current = page.results.length;
            setItemHasMore(page.results.length < page.count);
            return;
          }
          if (!isRoot && locationPk !== null) {
            setLocation(await getStockLocation(serverId, locationPk));
          }
          const page = await listStockLocationLevel(serverId, locationPk, 0, query);
          setChildren(page.results);
          childOffset.current = page.results.length;
          setChildHasMore(page.results.length < page.count);
        }}
      >
        {tab === "detail" ? (
          <div className="detail-stack">
            <DetailHeading title={title} detail={location?.description || undefined} />
            {loading ? <p className="muted">正在读取地点…</p> : null}
            {!isRoot && location ? (
              <DetailGroup>
                <DetailRow
                  title="上级地点"
                  detail={location.parentPath || "顶级库存地点"}
                  onClick={() =>
                    stack.push(location.parentId ? `/stock/location/${location.parentId}` : "/stock/location/root")
                  }
                />
              </DetailGroup>
            ) : null}
            <SectionLabel>次级位置</SectionLabel>
            {childLoading && children.length === 0 ? <p className="muted">正在读取次级位置…</p> : null}
            {!childLoading && children.length === 0 && !childError ? <p className="muted">没有次级位置。</p> : null}
            {children.length > 0 ? (
              <DetailGroup>
                {children.map((item) => (
                  <DetailRow
                    key={item.pk}
                    title={item.name || "未命名地点"}
                    detail={item.pathstring && item.pathstring !== item.name ? item.pathstring : item.description || undefined}
                    aside={String(item.itemCount)}
                    onClick={() => stack.push(`/stock/location/${item.pk}`)}
                  />
                ))}
              </DetailGroup>
            ) : null}
            {children.length > 0 || childHasMore ? (
              <InfiniteScroll
                loadMore={async () => {
                  const page = await listStockLocationLevel(serverId, locationPk, childOffset.current, query);
                  setChildren((current) => [...current, ...page.results]);
                  childOffset.current += page.results.length;
                  setChildHasMore(childOffset.current < page.count);
                }}
                hasMore={childHasMore}
              />
            ) : null}
          </div>
        ) : (
          <>
            {itemLoading && items.length === 0 ? <p className="muted">正在读取库存项…</p> : null}
            {!itemLoading && items.length === 0 && !itemError ? <p className="muted">这里还没有库存项。</p> : null}
            <ul className="part-list">
              {items.map((item) => (
                <PartCard
                  key={item.pk}
                  square
                  serverId={serverId}
                  thumbnail={item.partThumbnail}
                  title={item.partName || "未命名零件"}
                  detail={item.serial ? `序列号 ${item.serial}` : item.location || "未设置位置"}
                  trailing={stockQuantity(item)}
                  onClick={() => stack.push(`/stock/item/${item.pk}`)}
                />
              ))}
            </ul>
            {items.length > 0 || itemHasMore ? (
              <InfiniteScroll
                loadMore={async () => {
                  const page = await listLocationStock(serverId, locationPk, itemOffset.current, query);
                  setItems((current) => [...current, ...page.results]);
                  itemOffset.current += page.results.length;
                  setItemHasMore(itemOffset.current < page.count);
                }}
                hasMore={itemHasMore}
              />
            ) : null}
          </>
        )}
      </PullToRefresh>
    </div>
  );

  async function removeLocation(pk: number) {
    if (!window.confirm("删除这个库存地点？")) {
      return;
    }
    setError(null);
    try {
      await deleteStockLocation(serverId, pk);
      stack.pop();
    } catch (reason: unknown) {
      setError(readError(reason));
    }
  }
}

export function StockItemScreen() {
  const { serverId, setActions } = useShell();
  const stack = usePageStack();
  const stackRef = useRef(stack);
  stackRef.current = stack;
  const removeItemRef = useRef<(pk: number) => void>(() => {});
  const params = useParams();
  const itemPk = Number(params.itemId);
  const [item, setItem] = useState<StockItemDetail | null>(null);
  const [error, setError] = useState<CommandFailure | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!Number.isInteger(itemPk) || itemPk <= 0) {
      setError({ kind: "invalid", message: "库存项不存在" });
      return;
    }
    setError(null);
    setItem(await getStockItem(serverId, itemPk));
  }

  useEffect(() => {
    if (!Number.isInteger(itemPk) || itemPk <= 0) {
      setActions([]);
      return;
    }
    setActions([
      {
        id: "edit-item",
        label: "编辑库存项",
        onSelect: () => stackRef.current.push(`/stock/item/${itemPk}/edit`),
      },
      {
        id: "delete-item",
        label: "删除库存项",
        onSelect: () => removeItemRef.current(itemPk),
      },
    ]);
    return () => setActions([]);
  }, [itemPk, setActions]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    load()
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
  }, [serverId, itemPk]);

  removeItemRef.current = removeItem;

  return (
    <div className="part-detail">
      <Notice error={error} />
      {loading ? <p className="muted">正在读取库存项…</p> : null}
      {item ? (
        <PullToRefresh onRefresh={load}>
          <div className="detail-stack">
            <DetailHeading
              title={item.partName || "库存项"}
              detail={item.partDescription || undefined}
              aside={item.serial ? `SN ${item.serial}` : item.inStock ? stockQuantity(item) : "不可用"}
            />
            <DetailGroup>
              {!item.inStock ? <DetailRow title="不可用" detail="此库存项已不在库" danger /> : null}
              {item.partId > 0 ? (
                <DetailRow title="零件" detail={item.partName || "未命名零件"} onClick={() => stack.push(`/parts/${item.partId}`)} />
              ) : null}
              <DetailRow
                title="库存地点"
                detail={item.location || "未设置位置"}
                onClick={item.locationId ? () => stack.push(`/stock/location/${item.locationId}`) : undefined}
              />
              {item.serial ? (
                <DetailRow title="序列号" detail={item.serial} />
              ) : (
                <DetailRow title="数量" aside={stockQuantity(item)} />
              )}
              {item.statusText ? <DetailRow title="状态" aside={item.statusText} /> : null}
              {item.batch ? <DetailRow title="批号" detail={item.batch} /> : null}
              {item.packaging ? <DetailRow title="包装" detail={item.packaging} /> : null}
              {item.supplierPartId ? (
                <DetailRow
                  title="供应商零件"
                  detail={item.supplierSku || "供应商零件"}
                  onClick={() => stack.push(`/parts/supplier/${item.supplierPartId}`)}
                />
              ) : null}
              {item.link ? <DetailRow title="外部链接" detail={item.link} onClick={() => openLink(item.link)} /> : null}
              {item.updated ? <DetailRow title="最近更新" aside={item.updated} /> : null}
              {item.stocktakeDate ? <DetailRow title="最近盘点" aside={item.stocktakeDate} /> : null}
            </DetailGroup>
          </div>
        </PullToRefresh>
      ) : null}
    </div>
  );

  async function removeItem(pk: number) {
    if (!window.confirm("删除这个库存项？")) {
      return;
    }
    setError(null);
    try {
      await deleteStockItem(serverId, pk);
      stack.pop();
    } catch (reason: unknown) {
      setError(readError(reason));
    }
  }
}

function stockQuantity(item: StockItemDetail) {
  return item.serial ? `SN ${item.serial}` : formatStock(item.quantity, item.units);
}

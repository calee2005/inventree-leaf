import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router";
import { defaultCurrency, getPartCategory, listPartCategories, listParts, readError } from "../api";
import { InfiniteScroll, PullToRefresh } from "../MobileList";
import { Notice } from "../Notice";
import { usePageStack } from "../shell/pageStack";
import { useShell } from "../shell/AppShell";
import type { CategorySummary, CommandFailure, PartCategory, PartSummary } from "../types";
import { DetailGroup } from "../ui/DetailGroup";
import { DetailHeading } from "../ui/DetailHeading";
import { DetailRow } from "../ui/DetailRow";
import { PartCard } from "../ui/PartCard";
import { SectionLabel } from "../ui/SectionLabel";
import { SegmentTabs } from "../ui/SegmentTabs";
import { formatStock, stockValueLabel } from "../ui/quantity";

type Tab = "detail" | "parts";

export function CategoryScreen() {
  const { serverId } = useShell();
  const [currency, setCurrency] = useState("");
  const stack = usePageStack();
  const params = useParams();
  const rawId = params.categoryId ?? "root";
  const isRoot = rawId === "root";
  const categoryPk = isRoot ? null : Number(rawId);
  const invalid = !isRoot && (!Number.isInteger(categoryPk) || (categoryPk ?? 0) <= 0);
  const [tab, setTab] = useState<Tab>("detail");
  const [category, setCategory] = useState<PartCategory | null>(null);
  const [error, setError] = useState<CommandFailure | null>(null);
  const [loading, setLoading] = useState(!isRoot);
  const [children, setChildren] = useState<CategorySummary[]>([]);
  const [childError, setChildError] = useState<CommandFailure | null>(null);
  const [childLoading, setChildLoading] = useState(true);
  const [childHasMore, setChildHasMore] = useState(false);
  const childOffset = useRef(0);
  const [parts, setParts] = useState<PartSummary[]>([]);
  const [partError, setPartError] = useState<CommandFailure | null>(null);
  const [partLoading, setPartLoading] = useState(false);
  const [partHasMore, setPartHasMore] = useState(false);
  const partOffset = useRef(0);

  useEffect(() => {
    let active = true;
    defaultCurrency(serverId).then((code) => {
      if (active) {
        setCurrency(code);
      }
    });
    return () => {
      active = false;
    };
  }, [serverId]);

  useEffect(() => {
    setTab("detail");
    setCategory(null);
    setChildren([]);
    setParts([]);
    childOffset.current = 0;
    partOffset.current = 0;
    if (invalid) {
      setLoading(false);
      setError({ kind: "invalid", message: "类别不存在" });
      return;
    }
    let active = true;
    if (isRoot || categoryPk === null) {
      setLoading(false);
      setError(null);
    } else {
      setLoading(true);
      getPartCategory(serverId, categoryPk)
        .then((next) => {
          if (active) {
            setCategory(next);
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
    listPartCategories(serverId, categoryPk, 0)
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
  }, [serverId, rawId, isRoot, categoryPk, invalid]);

  useEffect(() => {
    if (tab !== "parts" || invalid) {
      return;
    }
    let active = true;
    setPartLoading(true);
    listParts(serverId, categoryPk, "", 0)
      .then((page) => {
        if (!active) {
          return;
        }
        setParts(page.results);
        partOffset.current = page.results.length;
        setPartHasMore(page.results.length < page.count);
        setPartError(null);
      })
      .catch((reason: unknown) => {
        if (active) {
          setPartError(readError(reason));
          setPartHasMore(false);
        }
      })
      .finally(() => {
        if (active) {
          setPartLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [tab, serverId, categoryPk, invalid]);

  async function loadMoreChildren() {
    const page = await listPartCategories(serverId, categoryPk, childOffset.current);
    setChildren((current) => [...current, ...page.results]);
    childOffset.current += page.results.length;
    setChildHasMore(childOffset.current < page.count);
  }

  async function loadMoreParts() {
    const page = await listParts(serverId, categoryPk, "", partOffset.current);
    setParts((current) => [...current, ...page.results]);
    partOffset.current += page.results.length;
    setPartHasMore(partOffset.current < page.count);
  }

  const title = isRoot ? "上一级零件类别" : category?.name || "零件类别";
  const description = category?.description.trim() ?? "";

  return (
    <div className="part-detail">
      <SegmentTabs
        value={tab}
        options={[
          { id: "detail", label: "详细信息" },
          { id: "parts", label: "零件" },
        ]}
        onChange={setTab}
      />
      <Notice error={tab === "parts" ? partError : error ?? childError} />
      <PullToRefresh
        onRefresh={async () => {
          if (invalid) {
            return;
          }
          if (tab === "parts") {
            const page = await listParts(serverId, categoryPk, "", 0);
            setParts(page.results);
            partOffset.current = page.results.length;
            setPartHasMore(page.results.length < page.count);
            return;
          }
          const [nextCategory, nextChildren] = await Promise.all([
            isRoot || categoryPk === null ? Promise.resolve(null) : getPartCategory(serverId, categoryPk),
            listPartCategories(serverId, categoryPk, 0),
          ]);
          setCategory(nextCategory);
          setChildren(nextChildren.results);
          childOffset.current = nextChildren.results.length;
          setChildHasMore(nextChildren.results.length < nextChildren.count);
        }}
      >
        {tab === "detail" ? (
          <div className="detail-stack">
            <DetailHeading title={title} detail={description || undefined} />
            {loading ? <p className="muted">正在读取类别…</p> : null}
            {!isRoot && category ? (
              <DetailGroup>
                <DetailRow
                  title="上级类别"
                  detail={category.parentPath || "上一级零件类别"}
                  onClick={() =>
                    stack.push(
                      category.parentId ? `/parts/category/${category.parentId}` : "/parts/category/root",
                    )
                  }
                />
              </DetailGroup>
            ) : null}
            <SectionLabel>子类别</SectionLabel>
            {childLoading && children.length === 0 ? <p className="muted">正在读取子类别…</p> : null}
            {!childLoading && children.length === 0 && !childError ? (
              <p className="muted">没有子类别。</p>
            ) : null}
            {children.length > 0 ? (
              <DetailGroup>
                {children.map((item) => (
                  <DetailRow
                    key={item.pk}
                    title={item.name || "未命名类别"}
                    detail={item.pathstring && item.pathstring !== item.name ? item.pathstring : undefined}
                    aside={String(item.partCount)}
                    onClick={() => stack.push(`/parts/category/${item.pk}`)}
                  />
                ))}
              </DetailGroup>
            ) : null}
            {children.length > 0 || childHasMore ? (
              <InfiniteScroll
                loadMore={async () => {
                  try {
                    await loadMoreChildren();
                  } catch (reason: unknown) {
                    setChildError(readError(reason));
                    throw reason;
                  }
                }}
                hasMore={childHasMore}
              />
            ) : null}
          </div>
        ) : (
          <>
            {partLoading && parts.length === 0 ? <p className="muted">正在读取零件…</p> : null}
            {!partLoading && parts.length === 0 && !partError ? (
              <p className="muted">这里还没有零件。</p>
            ) : null}
            <ul className="part-list">
              {parts.map((part) => (
                <PartCard
                  key={part.pk}
                  serverId={serverId}
                  thumbnail={part.thumbnail}
                  title={part.name}
                  trailing={formatStock(part.inStock, part.units)}
                  value={stockValueLabel(part.inStock, part.pricingMin, part.pricingMax, currency)}
                  onClick={() => stack.push(`/parts/${part.pk}`, part)}
                />
              ))}
            </ul>
            {parts.length > 0 || partHasMore ? (
              <InfiniteScroll
                loadMore={async () => {
                  try {
                    await loadMoreParts();
                  } catch (reason: unknown) {
                    setPartError(readError(reason));
                    throw reason;
                  }
                }}
                hasMore={partHasMore}
              />
            ) : null}
          </>
        )}
      </PullToRefresh>
    </div>
  );
}

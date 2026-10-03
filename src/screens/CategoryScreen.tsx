import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router";
import { getPartCategory, listPartCategories, listParts, readError } from "../api";
import { InfiniteScroll, PullToRefresh } from "../MobileList";
import { Notice } from "../Notice";
import { usePageStack } from "../shell/pageStack";
import { useShell } from "../shell/AppShell";
import type { CategorySummary, CommandFailure, PartCategory, PartSummary } from "../types";
import { PartThumb } from "./PartsScreen";

type Tab = "detail" | "parts";

function formatStock(part: PartSummary): string {
  const value = part.inStock;
  const qty = Number.isInteger(value) ? String(value) : String(Math.round(value * 1000) / 1000);
  const units = part.units.trim();
  return units ? `${qty} ${units}` : qty;
}

export function CategoryScreen() {
  const { serverId } = useShell();
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
      <div className="detail-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "detail"}
          className={tab === "detail" ? "is-on" : ""}
          onClick={() => setTab("detail")}
        >
          详细信息
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "parts"}
          className={tab === "parts" ? "is-on" : ""}
          onClick={() => setTab("parts")}
        >
          零件
        </button>
      </div>
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
            <div className="detail-heading">
              <strong>{title}</strong>
              {description ? <p className="detail-spec">{description}</p> : null}
            </div>
            {loading ? <p className="muted">正在读取类别…</p> : null}
            {!isRoot && category ? (
              <div className="detail-group">
                <button
                  className="detail-row"
                  type="button"
                  onClick={() =>
                    stack.push(
                      category.parentId ? `/parts/category/${category.parentId}` : "/parts/category/root",
                    )
                  }
                >
                  <span className="detail-copy">
                    <strong>上级类别</strong>
                    <small>{category.parentPath || "上一级零件类别"}</small>
                  </span>
                  <RowChevron />
                </button>
              </div>
            ) : null}
            <p className="section-label">子类别</p>
            {childLoading && children.length === 0 ? <p className="muted">正在读取子类别…</p> : null}
            {!childLoading && children.length === 0 && !childError ? (
              <p className="muted">没有子类别。</p>
            ) : null}
            {children.length > 0 ? (
              <div className="detail-group">
                {children.map((item) => (
                  <button
                    className="detail-row"
                    type="button"
                    key={item.pk}
                    onClick={() => stack.push(`/parts/category/${item.pk}`)}
                  >
                    <span className="detail-copy">
                      <strong>{item.name || "未命名类别"}</strong>
                      {item.pathstring && item.pathstring !== item.name ? <small>{item.pathstring}</small> : null}
                    </span>
                    <span className="detail-aside">{item.partCount}</span>
                    <RowChevron />
                  </button>
                ))}
              </div>
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
                <li key={part.pk}>
                  <button
                    className="part-card"
                    type="button"
                    onClick={() => stack.push(`/parts/${part.pk}`, part)}
                  >
                    <PartThumb serverId={serverId} thumbnail={part.thumbnail} />
                    <div className="part-body">
                      <strong>{part.name}</strong>
                      <span className="part-qty">{formatStock(part)}</span>
                    </div>
                  </button>
                </li>
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

function RowChevron() {
  return (
    <svg className="row-chevron" viewBox="0 0 24 24" aria-hidden="true">
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

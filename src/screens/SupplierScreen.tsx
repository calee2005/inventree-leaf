import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { useParams } from "react-router";
import {
  countOutstandingPurchaseOrders,
  getCompany,
  getManufacturerPart,
  listCompanies,
  listManufacturerParts,
  listPurchaseOrders,
  listSupplierParts,
  readError,
} from "../api";
import { InfiniteScroll, PullToRefresh } from "../MobileList";
import { Notice } from "../Notice";
import { usePageStack } from "../shell/pageStack";
import { useShell } from "../shell/AppShell";
import type {
  CommandFailure,
  CompanyDetail,
  CompanySummary,
  ManufacturerPartDetail,
  ManufacturerPartSummary,
  PurchaseOrderSummary,
  SupplierPartSummary,
} from "../types";
import { DetailGroup } from "../ui/DetailGroup";
import { DetailHeading } from "../ui/DetailHeading";
import { DetailRow } from "../ui/DetailRow";
import { PartCard } from "../ui/PartCard";
import { TextField } from "../ui/TextField";
import { openLink } from "../ui/openLink";
import { formatQty } from "../ui/quantity";

export function SupplierListScreen() {
  const { serverId } = useShell();
  const stack = usePageStack();
  const search = useSearch();
  const [companies, setCompanies] = useState<CompanySummary[]>([]);
  const [error, setError] = useState<CommandFailure | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const offsetRef = useRef(0);

  async function loadPage(offset: number, replace: boolean) {
    const page = await listCompanies(serverId, offset, { supplier: true, search: search.query });
    setCompanies((current) => (replace ? page.results : [...current, ...page.results]));
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
    setCompanies([]);
    setHasMore(false);
    void reload();
  }, [serverId, search.query]);

  return (
    <div className="parts-view">
      <SearchRow search={search} placeholder="搜索供应商" />
      <Notice error={error} />
      {loading ? <p className="muted">正在读取供应商…</p> : null}
      {!loading && companies.length === 0 && !error ? <p className="muted">这里还没有供应商。</p> : null}
      <PullToRefresh onRefresh={reload}>
        <ul className="part-list">
          {companies.map((company) => (
            <PartCard
              key={company.pk}
              serverId={serverId}
              thumbnail={company.thumbnail}
              title={company.name || "未命名"}
              detail={
                [company.active ? "" : "未激活", company.description].filter(Boolean).join(" · ") || undefined
              }
              onClick={() => stack.push(`/supplier/${company.pk}`)}
            />
          ))}
        </ul>
        {companies.length > 0 || hasMore ? (
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

export function CompanyDetailScreen() {
  const { serverId } = useShell();
  const stack = usePageStack();
  const params = useParams();
  const companyId = Number(params.companyId);
  const invalid = !Number.isInteger(companyId) || companyId <= 0;
  const [company, setCompany] = useState<CompanyDetail | null>(null);
  const [outstanding, setOutstanding] = useState(0);
  const [error, setError] = useState<CommandFailure | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    if (invalid) {
      setError({ kind: "invalid", message: "公司不存在" });
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const [next, orders] = await Promise.all([
        getCompany(serverId, companyId),
        countOutstandingPurchaseOrders(serverId, companyId).catch(() => 0),
      ]);
      setCompany(next);
      setOutstanding(next.isSupplier ? orders : 0);
    } catch (reason: unknown) {
      setCompany(null);
      setError(readError(reason));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setLoading(true);
    void load();
  }, [serverId, companyId]);

  const roles = company
    ? [
        company.isSupplier ? "供应商" : "",
        company.isManufacturer ? "制造商" : "",
        company.isCustomer ? "客户" : "",
      ].filter(Boolean)
    : [];

  return (
    <div className="part-detail">
      <Notice error={error} />
      {loading ? <p className="muted">正在读取公司…</p> : null}
      <PullToRefresh onRefresh={load}>
        {company ? (
          <div className="detail-stack">
            <DetailHeading title={company.name || "未命名"} detail={company.description || undefined} />
            <DetailGroup>
              {!company.active ? <DetailRow title="未激活" detail="此公司已停用" danger /> : null}
              {roles.length > 0 ? <DetailRow title="类型" detail={roles.join("、")} /> : null}
              {company.currency ? <DetailRow title="币种" aside={company.currency} /> : null}
              {company.contact ? <DetailRow title="联系人" detail={company.contact} /> : null}
              {company.website ? (
                <DetailRow title="网站" detail={company.website} onClick={() => openExternal(company.website)} />
              ) : null}
              {company.email ? (
                <DetailRow title="电子邮件" detail={company.email} onClick={() => openExternal(`mailto:${company.email}`)} />
              ) : null}
              {company.phone ? (
                <DetailRow title="电话" detail={company.phone} onClick={() => openExternal(`tel:${company.phone}`)} />
              ) : null}
              {company.link ? <DetailRow title="链接" detail={company.link} onClick={() => openExternal(company.link)} /> : null}
              {company.address ? <DetailRow title="地址" detail={company.address} /> : null}
              {company.taxId ? <DetailRow title="税号" detail={company.taxId} /> : null}
              {company.notes ? <DetailRow title="注释" detail={company.notes} note /> : null}
            </DetailGroup>
            <DetailGroup>
              {company.isSupplier && company.partsSupplied > 0 ? (
                <DetailRow
                  title="供应商零件"
                  aside={String(company.partsSupplied)}
                  onClick={() => stack.push(`/supplier/${company.pk}/parts`)}
                />
              ) : null}
              {company.isSupplier ? (
                <DetailRow
                  title="采购订单"
                  aside={String(outstanding)}
                  onClick={() => stack.push(`/supplier/${company.pk}/orders`)}
                />
              ) : null}
              {company.isManufacturer && company.partsManufactured > 0 ? (
                <DetailRow
                  title="制造商零件"
                  aside={String(company.partsManufactured)}
                  onClick={() => stack.push(`/supplier/${company.pk}/manufacturer-parts`)}
                />
              ) : null}
            </DetailGroup>
          </div>
        ) : null}
      </PullToRefresh>
    </div>
  );
}

export function CompanyPartListScreen() {
  const { serverId } = useShell();
  const stack = usePageStack();
  const params = useParams();
  const companyId = Number(params.companyId);
  const search = useSearch();
  return (
    <PagedCards
      serverId={serverId}
      query={search.query}
      placeholder="搜索供应商零件"
      search={search}
      emptyText="这里还没有供应商零件。"
      loadingText="正在读取供应商零件…"
      load={(offset) => listSupplierParts(serverId, offset, { supplier: companyId, search: search.query })}
      card={(item: SupplierPartSummary) => (
        <PartCard
          key={item.pk}
          square
          serverId={serverId}
          thumbnail={item.partThumbnail || item.supplierImage}
          title={item.sku || "未编号"}
          detail={item.partName || undefined}
          trailing={formatQty(item.inStock)}
          onClick={() => stack.push(`/parts/supplier/${item.pk}`)}
        />
      )}
    />
  );
}

export function CompanyOrderListScreen() {
  const { serverId } = useShell();
  const stack = usePageStack();
  const params = useParams();
  const companyId = Number(params.companyId);
  const search = useSearch();
  return (
    <PagedCards
      serverId={serverId}
      query={search.query}
      placeholder="搜索采购订单"
      search={search}
      emptyText="这里还没有采购订单。"
      loadingText="正在读取采购订单…"
      load={(offset) => listPurchaseOrders(serverId, companyId, search.query, offset)}
      card={(item: PurchaseOrderSummary) => (
        <PartCard
          key={item.pk}
          serverId={serverId}
          thumbnail={item.thumbnail}
          title={item.reference || "未编号"}
          detail={item.description || item.supplierName || undefined}
          trailing={item.statusText || undefined}
          onClick={() => stack.push(`/purchase/${item.pk}`)}
        />
      )}
    />
  );
}

export function ManufacturerPartListScreen() {
  const { serverId } = useShell();
  const stack = usePageStack();
  const params = useParams();
  const companyId = Number(params.companyId);
  const search = useSearch();
  return (
    <PagedCards
      serverId={serverId}
      query={search.query}
      placeholder="搜索制造商零件"
      search={search}
      emptyText="这里还没有制造商零件。"
      loadingText="正在读取制造商零件…"
      load={(offset) => listManufacturerParts(serverId, companyId, search.query, offset)}
      card={(item: ManufacturerPartSummary) => (
        <PartCard
          key={item.pk}
          square
          serverId={serverId}
          thumbnail={item.thumbnail}
          title={item.mpn || "未编号"}
          detail={item.partName || undefined}
          onClick={() => stack.push(`/supplier/manufacturer-part/${item.pk}`)}
        />
      )}
    />
  );
}

export function ManufacturerPartScreen() {
  const { serverId } = useShell();
  const stack = usePageStack();
  const params = useParams();
  const manufacturerPartId = Number(params.manufacturerPartId);
  const invalid = !Number.isInteger(manufacturerPartId) || manufacturerPartId <= 0;
  const [item, setItem] = useState<ManufacturerPartDetail | null>(null);
  const [error, setError] = useState<CommandFailure | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    if (invalid) {
      setError({ kind: "invalid", message: "制造商零件不存在" });
      setLoading(false);
      return;
    }
    setError(null);
    try {
      setItem(await getManufacturerPart(serverId, manufacturerPartId));
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
  }, [serverId, manufacturerPartId]);

  return (
    <div className="part-detail">
      <Notice error={error} />
      {loading ? <p className="muted">正在读取制造商零件…</p> : null}
      <PullToRefresh onRefresh={load}>
        {item ? (
          <div className="detail-stack">
            <DetailHeading title={item.mpn || "未编号"} detail={item.manufacturerName || undefined} />
            <DetailGroup>
              <DetailRow
                title="内部零件"
                detail={item.partName || undefined}
                onClick={item.partId > 0 ? () => stack.push(`/parts/${item.partId}`) : undefined}
              />
              {item.manufacturerName ? (
                <DetailRow
                  title="制造商"
                  detail={item.manufacturerName}
                  onClick={item.manufacturerId > 0 ? () => stack.push(`/supplier/${item.manufacturerId}`) : undefined}
                />
              ) : null}
              <DetailRow title="制造商零件编号" detail={item.mpn || "未编号"} />
              {item.description ? <DetailRow title="描述" detail={item.description} /> : null}
              {item.link ? <DetailRow title="链接" detail={item.link} onClick={() => openExternal(item.link)} /> : null}
              {item.notes ? <DetailRow title="注释" detail={item.notes} note /> : null}
            </DetailGroup>
          </div>
        ) : null}
      </PullToRefresh>
    </div>
  );
}

function PagedCards<T extends { pk: number }>({
  query,
  placeholder,
  search,
  emptyText,
  loadingText,
  load,
  card,
}: {
  serverId: string;
  query: string;
  placeholder: string;
  search: SearchState;
  emptyText: string;
  loadingText: string;
  load: (offset: number) => Promise<{ count: number; results: T[] }>;
  card: (item: T) => ReactNode;
}) {
  const [items, setItems] = useState<T[]>([]);
  const [error, setError] = useState<CommandFailure | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const offsetRef = useRef(0);

  async function loadPage(offset: number, replace: boolean) {
    const page = await load(offset);
    setItems((current) => (replace ? page.results : [...current, ...page.results]));
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
    setItems([]);
    setHasMore(false);
    void reload();
  }, [query]);

  return (
    <div className="parts-view">
      <SearchRow search={search} placeholder={placeholder} />
      <Notice error={error} />
      {loading ? <p className="muted">{loadingText}</p> : null}
      {!loading && items.length === 0 && !error ? <p className="muted">{emptyText}</p> : null}
      <PullToRefresh onRefresh={reload}>
        <ul className="part-list">{items.map((item) => card(item))}</ul>
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

type SearchState = ReturnType<typeof useSearch>;

function useSearch() {
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

function SearchRow({ search, placeholder }: { search: SearchState; placeholder: string }) {
  return (
    <>
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
    </>
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

function openExternal(url: string) {
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed)) {
    openLink(trimmed);
    return;
  }
  if (/^(mailto|tel):/i.test(trimmed)) {
    window.location.href = trimmed;
    return;
  }
  if (/^[\w.-]+\.[a-z]{2,}/i.test(trimmed)) {
    openLink(`https://${trimmed}`);
  }
}

import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router";
import {
  createBomItem,
  createBomSubstitute,
  deleteBomItem,
  deleteBomSubstitute,
  getBomItem,
  listBom,
  listParts,
  readError,
  updateBomItem,
  validateBomItem,
} from "../api";
import { InfiniteScroll, PullToRefresh } from "../MobileList";
import { Notice } from "../Notice";
import { usePageStack } from "../shell/pageStack";
import { useShell } from "../shell/AppShell";
import type { BomItemWrite, BomLine, CommandFailure, PartSummary } from "../types";
import { DetailGroup } from "../ui/DetailGroup";
import { DetailHeading } from "../ui/DetailHeading";
import { DetailRow } from "../ui/DetailRow";
import { PartCard } from "../ui/PartCard";
import { SectionLabel } from "../ui/SectionLabel";
import { formatQty } from "../ui/quantity";

export function BomListScreen({ usedIn }: { usedIn: boolean }) {
  const { serverId } = useShell();
  const stack = usePageStack();
  const params = useParams();
  const partPk = Number(params.partId);
  const invalid = !Number.isInteger(partPk) || partPk <= 0;
  const [items, setItems] = useState<BomLine[]>([]);
  const [error, setError] = useState<CommandFailure | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const offsetRef = useRef(0);

  async function loadPage(offset: number, replace: boolean) {
    const page = await listBom(serverId, partPk, usedIn, offset);
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
    listBom(serverId, partPk, usedIn, 0)
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
  }, [serverId, partPk, usedIn, invalid]);

  return (
    <div className="part-detail subpage-top">
      <Notice error={error} />
      {!usedIn ? (
        <button className="form-primary" type="button" onClick={() => stack.push(`/parts/${partPk}/bom/new`)}>
          添加物料
        </button>
      ) : null}
      {loading ? <p className="muted">正在读取物料清单…</p> : null}
      <PullToRefresh
        onRefresh={async () => {
          if (!invalid) {
            await loadPage(0, true);
          }
        }}
      >
        {!loading && items.length === 0 && !error ? (
          <p className="muted">{usedIn ? "没有装配体使用这个零件。" : "物料清单还是空的。"}</p>
        ) : null}
        <ul className="part-list">
          {items.map((item) => {
            const partId = usedIn ? item.partId : item.subPartId;
            const name = usedIn ? item.partName : item.subPartName;
            const thumbnail = usedIn ? item.partThumbnail : item.subPartThumbnail;
            return (
              <PartCard
                key={item.pk}
                square
                serverId={serverId}
                thumbnail={thumbnail}
                title={name || "未命名零件"}
                detail={item.reference || undefined}
                trailing={formatQty(item.quantity)}
                onClick={() => (usedIn ? stack.push(`/parts/${partId}`) : stack.push(`/parts/bom/${item.pk}`))}
              />
            );
          })}
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

export function BomLineScreen() {
  const { serverId } = useShell();
  const stack = usePageStack();
  const params = useParams();
  const bomId = Number(params.bomId);
  const invalid = !Number.isInteger(bomId) || bomId <= 0;
  const [line, setLine] = useState<BomLine | null>(null);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<CommandFailure | null>(null);
  const [loading, setLoading] = useState(true);
  const [substituteQuery, setSubstituteQuery] = useState("");
  const [substituteHits, setSubstituteHits] = useState<PartSummary[]>([]);

  async function reload() {
    if (invalid) {
      setError({ kind: "invalid", message: "物料行不存在" });
      setLoading(false);
      return;
    }
    setError(null);
    try {
      setLine(await getBomItem(serverId, bomId));
    } catch (reason: unknown) {
      setLine(null);
      setError(readError(reason));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setLoading(true);
    void reload();
  }, [serverId, bomId]);

  useEffect(() => {
    const query = substituteQuery.trim();
    if (!query) {
      setSubstituteHits([]);
      return;
    }
    const timer = window.setTimeout(() => {
      listParts(serverId, null, query, 0)
        .then((page) => setSubstituteHits(page.results))
        .catch(() => setSubstituteHits([]));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [serverId, substituteQuery]);

  async function toggleValid() {
    if (!line) {
      return;
    }
    setError(null);
    try {
      await validateBomItem(serverId, line.pk, !line.validated);
      await reload();
    } catch (reason: unknown) {
      setError(readError(reason));
    }
  }

  async function removeLine() {
    if (!line || !window.confirm("删除这行物料？")) {
      return;
    }
    setError(null);
    try {
      await deleteBomItem(serverId, line.pk);
      stack.pop();
    } catch (reason: unknown) {
      setError(readError(reason));
    }
  }

  async function addSubstitute(partPk: number) {
    if (!line) {
      return;
    }
    setError(null);
    try {
      await createBomSubstitute(serverId, line.pk, partPk);
      setSubstituteQuery("");
      setSubstituteHits([]);
      await reload();
    } catch (reason: unknown) {
      setError(readError(reason));
    }
  }

  async function removeSubstitute(pk: number) {
    setError(null);
    try {
      await deleteBomSubstitute(serverId, pk);
      await reload();
    } catch (reason: unknown) {
      setError(readError(reason));
    }
  }

  return (
    <div className="part-detail subpage-top">
      <Notice error={error} />
      {loading ? <p className="muted">正在读取物料行…</p> : null}
      {line && editing ? (
        <BomEditor
          serverId={serverId}
          initial={line}
          onCancel={() => setEditing(false)}
          onSaved={async () => {
            setEditing(false);
            await reload();
          }}
        />
      ) : null}
      {line && !editing ? (
        <PullToRefresh onRefresh={reload}>
          <div className="detail-stack">
            <DetailHeading title={line.subPartName || "组件"} detail={`数量 ${formatQty(line.quantity)}`} />
            <DetailGroup>
              <DetailRow
                title="组件"
                detail={line.subPartName || "未命名零件"}
                onClick={() => stack.push(`/parts/${line.subPartId}`)}
              />
              <DetailRow
                title="装配体"
                detail={line.partName || "未命名零件"}
                onClick={() => stack.push(`/parts/${line.partId}`)}
              />
              <DetailRow title="参考" detail={line.reference || "没有参考"} />
              <DetailRow title="备注" detail={line.note || "没有备注"} />
              <DetailRow title="允许变体" aside={line.allowVariants ? "是" : "否"} />
              <DetailRow title="变体继承" aside={line.inherited ? "是" : "否"} />
              <DetailRow title="可选" aside={line.optional ? "是" : "否"} />
              <DetailRow title="消耗品" aside={line.consumable ? "是" : "否"} />
              <DetailRow title="准备数量" aside={formatQty(line.setupQuantity)} />
              <DetailRow title="损耗" aside={formatQty(line.attrition)} />
              <DetailRow
                title="取整倍数"
                aside={line.roundingMultiple === null ? "-" : formatQty(line.roundingMultiple)}
              />
              <DetailRow title="已校验" aside={line.validated ? "是" : "否"} />
            </DetailGroup>
            <SectionLabel>替代料</SectionLabel>
            <DetailGroup>
              {line.substitutes.length === 0 ? <DetailRow title="还没有替代料" /> : null}
              {line.substitutes.map((item) => (
                <DetailRow
                  key={item.pk}
                  title={item.partName || "未命名零件"}
                  detail="点此移除"
                  chevron={false}
                  onClick={() => void removeSubstitute(item.pk)}
                />
              ))}
            </DetailGroup>
            <label>
              添加替代料
              <input
                type="search"
                placeholder="搜索零件"
                value={substituteQuery}
                onChange={(event) => setSubstituteQuery(event.target.value)}
              />
            </label>
            <ul className="bom-hits">
              {substituteHits.map((part) => (
                <li key={part.pk}>
                  <button className="bom-hit" type="button" onClick={() => void addSubstitute(part.pk)}>
                    {part.name}
                  </button>
                </li>
              ))}
            </ul>
            <button className="form-primary" type="button" onClick={() => void toggleValid()}>
              {line.validated ? "取消校验" : "标记已校验"}
            </button>
            <button className="form-primary" type="button" onClick={() => setEditing(true)}>
              编辑
            </button>
            <button className="form-danger" type="button" onClick={() => void removeLine()}>
              删除
            </button>
          </div>
        </PullToRefresh>
      ) : null}
    </div>
  );
}

export function BomCreateScreen() {
  const { serverId } = useShell();
  const stack = usePageStack();
  const params = useParams();
  const partPk = Number(params.partId);
  const [error, setError] = useState<CommandFailure | null>(null);

  return (
    <div className="part-detail subpage-top">
      <Notice error={error} />
      <BomEditor
        serverId={serverId}
        assemblyId={partPk}
        onCancel={() => stack.pop()}
        onSaved={() => stack.pop()}
        onError={setError}
      />
    </div>
  );
}

function BomEditor({
  serverId,
  assemblyId,
  initial,
  onCancel,
  onSaved,
  onError,
}: {
  serverId: string;
  assemblyId?: number;
  initial?: BomLine;
  onCancel: () => void;
  onSaved: () => void;
  onError?: (error: CommandFailure | null) => void;
}) {
  const [chosen, setChosen] = useState<{ pk: number; name: string } | null>(
    initial ? { pk: initial.subPartId, name: initial.subPartName } : null,
  );
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<PartSummary[]>([]);
  const [quantity, setQuantity] = useState(initial ? String(initial.quantity) : "1");
  const [reference, setReference] = useState(initial?.reference ?? "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [allowVariants, setAllowVariants] = useState(initial?.allowVariants ?? true);
  const [inherited, setInherited] = useState(initial?.inherited ?? false);
  const [optional, setOptional] = useState(initial?.optional ?? false);
  const [consumable, setConsumable] = useState(initial?.consumable ?? false);
  const [setupQuantity, setSetupQuantity] = useState(initial ? String(initial.setupQuantity) : "0");
  const [attrition, setAttrition] = useState(initial ? String(initial.attrition) : "0");
  const [rounding, setRounding] = useState(
    initial?.roundingMultiple === null || initial?.roundingMultiple === undefined
      ? ""
      : String(initial.roundingMultiple),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<CommandFailure | null>(null);

  useEffect(() => {
    const text = query.trim();
    if (!text) {
      setHits([]);
      return;
    }
    const timer = window.setTimeout(() => {
      listParts(serverId, null, text, 0)
        .then((page) => setHits(page.results))
        .catch(() => setHits([]));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [serverId, query]);

  async function save() {
    const part = initial?.partId ?? assemblyId ?? 0;
    const subPart = chosen?.pk ?? 0;
    const amount = Number(quantity);
    if (part <= 0 || subPart <= 0) {
      setError({ kind: "invalid", message: "请选择组件" });
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setError({ kind: "invalid", message: "数量需要大于 0" });
      return;
    }
    const input: BomItemWrite = {
      part,
      subPart,
      quantity: amount,
      reference: reference.trim(),
      note: note.trim(),
      allowVariants,
      inherited,
      optional,
      consumable,
      setupQuantity: Number(setupQuantity) || 0,
      attrition: Number(attrition) || 0,
      roundingMultiple: rounding.trim() ? Number(rounding) : null,
    };
    setSaving(true);
    setError(null);
    onError?.(null);
    try {
      if (initial) {
        await updateBomItem(serverId, initial.pk, input);
      } else {
        await createBomItem(serverId, input);
      }
      onSaved();
    } catch (reason: unknown) {
      const failure = readError(reason);
      setError(failure);
      onError?.(failure);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      className="bom-form"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <Notice error={error} />
      <label>
        组件
        <input
          type="search"
          placeholder="搜索零件"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      {chosen ? <p className="muted">已选 {chosen.name}</p> : null}
      <ul className="bom-hits">
        {hits.map((part) => (
          <li key={part.pk}>
            <button
              className={chosen?.pk === part.pk ? "bom-hit is-on" : "bom-hit"}
              type="button"
              onClick={() => setChosen({ pk: part.pk, name: part.name })}
            >
              {part.name}
            </button>
          </li>
        ))}
      </ul>
      <label>
        数量
        <input value={quantity} inputMode="decimal" onChange={(event) => setQuantity(event.target.value)} />
      </label>
      <label>
        参考
        <input value={reference} onChange={(event) => setReference(event.target.value)} />
      </label>
      <label>
        备注
        <input value={note} onChange={(event) => setNote(event.target.value)} />
      </label>
      <label>
        准备数量
        <input value={setupQuantity} inputMode="decimal" onChange={(event) => setSetupQuantity(event.target.value)} />
      </label>
      <label>
        损耗
        <input value={attrition} inputMode="decimal" onChange={(event) => setAttrition(event.target.value)} />
      </label>
      <label>
        取整倍数
        <input value={rounding} inputMode="decimal" onChange={(event) => setRounding(event.target.value)} />
      </label>
      <label className="check">
        <input type="checkbox" checked={allowVariants} onChange={(event) => setAllowVariants(event.target.checked)} />
        允许使用变体库存
      </label>
      <label className="check">
        <input type="checkbox" checked={inherited} onChange={(event) => setInherited(event.target.checked)} />
        变体继承此行
      </label>
      <label className="check">
        <input type="checkbox" checked={optional} onChange={(event) => setOptional(event.target.checked)} />
        可选项
      </label>
      <label className="check">
        <input type="checkbox" checked={consumable} onChange={(event) => setConsumable(event.target.checked)} />
        消耗品
      </label>
      <button className="form-primary" type="submit" disabled={saving}>
        {saving ? "正在保存…" : "保存"}
      </button>
      <button className="form-danger" type="button" onClick={onCancel}>
        取消
      </button>
    </form>
  );
}

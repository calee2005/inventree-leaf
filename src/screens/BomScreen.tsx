import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router";
import {
  createBomItem,
  createBomSubstitute,
  deleteBomItem,
  deleteBomSubstitute,
  getBomItem,
  listBom,
  readError,
  updateBomItem,
  validateBomItem,
} from "../api";
import { InfiniteScroll, PullToRefresh } from "../MobileList";
import { Notice } from "../Notice";
import { usePageStack } from "../shell/pageStack";
import { useShell } from "../shell/AppShell";
import type { BomItemWrite, BomLine, CommandFailure } from "../types";
import { CheckField } from "../ui/CheckField";
import { DetailGroup } from "../ui/DetailGroup";
import { DetailHeading } from "../ui/DetailHeading";
import { DetailRow } from "../ui/DetailRow";
import { PartCard } from "../ui/PartCard";
import { PartLookup } from "../ui/LookupSheet";
import { SectionLabel } from "../ui/SectionLabel";
import { TextField } from "../ui/TextField";
import { formatQty, formatStock } from "../ui/quantity";

export function BomListScreen({ usedIn }: { usedIn: boolean }) {
  const { serverId, setActions } = useShell();
  const stack = usePageStack();
  const stackRef = useRef(stack);
  stackRef.current = stack;
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

  useEffect(() => {
    if (usedIn || invalid) {
      setActions([]);
      return;
    }
    setActions([
      {
        id: "add-bom",
        label: "添加物料",
        onSelect: () => stackRef.current.push(`/parts/${partPk}/bom/new`),
      },
    ]);
    return () => setActions([]);
  }, [usedIn, invalid, partPk, setActions]);

  return (
    <div className="part-detail">
      <Notice error={error} />
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
                trailing={formatStock(item.quantity, item.subPartUnits)}
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
  const { serverId, setActions } = useShell();
  const stack = usePageStack();
  const params = useParams();
  const bomId = Number(params.bomId);
  const invalid = !Number.isInteger(bomId) || bomId <= 0;
  const [line, setLine] = useState<BomLine | null>(null);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<CommandFailure | null>(null);
  const [loading, setLoading] = useState(true);

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

  const lineActions = useRef({ toggleValid, removeLine, removeSubstitute });
  lineActions.current = { toggleValid, removeLine, removeSubstitute };

  useEffect(() => {
    if (!line || editing) {
      if (!editing) {
        setActions([]);
      }
      return;
    }
    const validated = line.validated;
    setActions([
      {
        id: "validate-bom",
        label: validated ? "取消校验" : "标记已校验",
        onSelect: () => void lineActions.current.toggleValid(),
      },
      {
        id: "edit-bom",
        label: "编辑",
        onSelect: () => setEditing(true),
      },
      {
        id: "delete-bom",
        label: "删除",
        onSelect: () => void lineActions.current.removeLine(),
      },
      ...line.substitutes.map((item) => ({
        id: `remove-sub-${item.pk}`,
        label: `移除替代料 ${item.partName || "未命名零件"}`,
        onSelect: () => void lineActions.current.removeSubstitute(item.pk),
      })),
    ]);
    return () => setActions([]);
  }, [line, editing, setActions]);

  return (
    <div className="part-detail">
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
            <DetailHeading
              title={line.subPartName || "组件"}
              detail={`数量 ${formatStock(line.quantity, line.subPartUnits)}`}
            />
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
              <DetailRow title="准备数量" aside={formatStock(line.setupQuantity, line.subPartUnits)} />
              <DetailRow title="损耗" aside={formatQty(line.attrition)} />
              <DetailRow
                title="取整倍数"
                aside={line.roundingMultiple === null ? "-" : formatStock(line.roundingMultiple, line.subPartUnits)}
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
                />
              ))}
            </DetailGroup>
            <PartLookup
              serverId={serverId}
              label="添加替代料"
              hint="搜索并添加可替代此组件的零件"
              value={null}
              onChange={(part) => void addSubstitute(part.pk)}
            />
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
    <div className="part-detail">
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
  const { setActions } = useShell();
  const saveRef = useRef<() => void>(() => {});
  const cancelRef = useRef(onCancel);
  cancelRef.current = onCancel;
  const [chosen, setChosen] = useState<{ pk: number; name: string } | null>(
    initial ? { pk: initial.subPartId, name: initial.subPartName } : null,
  );
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
    setActions([
      {
        id: "save-bom",
        label: saving ? "正在保存…" : "保存",
        onSelect: () => saveRef.current(),
      },
      {
        id: "cancel-bom",
        label: "取消",
        onSelect: () => cancelRef.current(),
      },
    ]);
    return () => setActions([]);
  }, [saving, setActions]);

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

  saveRef.current = () => {
    if (!saving) {
      void save();
    }
  };

  return (
    <form
      className="bom-form"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <Notice error={error} />
      <PartLookup
        serverId={serverId}
        label="组件"
        hint="此物料行使用的零件"
        value={chosen}
        onChange={(part) => setChosen({ pk: part.pk, name: part.name })}
      />
      <TextField label="数量" hint="此物料行需要的数量" inputMode="decimal" value={quantity} onChange={setQuantity} />
      <TextField label="参考" hint="物料行的参考位号" value={reference} onChange={setReference} />
      <TextField label="备注" hint="物料行备注" value={note} onChange={setNote} />
      <TextField
        label="准备数量"
        hint="为准备损耗额外预留的数量"
        inputMode="decimal"
        value={setupQuantity}
        onChange={setSetupQuantity}
      />
      <TextField label="损耗" hint="预计损耗，按百分比计算" inputMode="decimal" value={attrition} onChange={setAttrition} />
      <TextField
        label="取整倍数"
        hint="把需求数量向上取整到此倍数"
        inputMode="decimal"
        value={rounding}
        onChange={setRounding}
      />
      <CheckField label="允许使用变体库存" hint="可以用此零件变体的库存代替" checked={allowVariants} onChange={setAllowVariants} />
      <CheckField label="变体继承此行" hint="变体零件的物料清单会继承此行" checked={inherited} onChange={setInherited} />
      <CheckField label="可选项" hint="装配时可以不安装此零件" checked={optional} onChange={setOptional} />
      <CheckField label="消耗品" hint="消耗品不需要追踪库存" checked={consumable} onChange={setConsumable} />
    </form>
  );
}

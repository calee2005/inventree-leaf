import { useEffect, useState } from "react";
import { useLocation, useParams } from "react-router";
import {
  createPart,
  getPart,
  readError,
  updatePart,
} from "../api";
import { Notice } from "../Notice";
import { usePageStack } from "../shell/pageStack";
import { useShell } from "../shell/AppShell";
import type { CommandFailure, LookupHit, PartDetail, PartWrite } from "../types";
import { CheckField } from "../ui/CheckField";
import { CategorySelect } from "../ui/CategorySelect";
import { LocationSelect } from "../ui/LocationSelect";
import { TextField } from "../ui/TextField";

type Mode = "create" | "edit";

const flags: Array<{ key: keyof PartWrite; label: string; hint: string }> = [
  { key: "active", label: "有效", hint: "此零件是否处于有效状态" },
  { key: "assembly", label: "装配件", hint: "此零件能否由其他零件组装而成" },
  { key: "component", label: "元件", hint: "此零件能否用于组装其他零件" },
  { key: "purchaseable", label: "可采购", hint: "此零件能否从外部供应商采购" },
  { key: "salable", label: "可销售", hint: "此零件能否销售给客户" },
  { key: "trackable", label: "可追踪", hint: "此零件是否追踪唯一件" },
  { key: "isTemplate", label: "模板零件", hint: "此零件是否为模板零件" },
  { key: "virtual", label: "虚拟零件", hint: "此零件是否为虚拟零件，例如软件或许可证" },
];

function readCategory(state: unknown): LookupHit | null {
  if (typeof state !== "object" || state === null || !("categoryId" in state)) {
    return null;
  }
  const record = state as { categoryId?: unknown; categoryName?: unknown };
  if (typeof record.categoryId !== "number" || record.categoryId <= 0) {
    return null;
  }
  const name = typeof record.categoryName === "string" ? record.categoryName : "";
  return { pk: record.categoryId, name, pathstring: name };
}

function blankPart(category: LookupHit | null): PartWrite {
  return {
    name: "",
    description: "",
    ipn: "",
    revision: "",
    keywords: "",
    link: "",
    category: category?.pk ?? null,
    defaultLocation: null,
    units: "",
    active: true,
    assembly: false,
    component: true,
    purchaseable: true,
    salable: false,
    trackable: false,
    isTemplate: false,
    virtual: false,
  };
}

function fromDetail(part: PartDetail): PartWrite {
  return {
    name: part.name,
    description: part.description,
    ipn: part.ipn,
    revision: part.revision,
    keywords: part.keywords,
    link: part.link,
    category: part.categoryId,
    defaultLocation: part.locationId,
    units: part.units,
    active: part.active,
    assembly: part.assembly,
    component: part.component,
    purchaseable: part.purchaseable,
    salable: part.salable,
    trackable: part.trackable,
    isTemplate: part.isTemplate,
    virtual: part.virtual,
  };
}

export function PartFormScreen({ mode }: { mode: Mode }) {
  const { serverId } = useShell();
  const stack = usePageStack();
  const location = useLocation();
  const params = useParams();
  const partPk = Number(params.partId);
  const initialCategory = mode === "create" ? readCategory(location.state) : null;
  const [draft, setDraft] = useState<PartWrite>(() => blankPart(initialCategory));
  const [category, setCategory] = useState<LookupHit | null>(initialCategory);
  const [locationHit, setLocationHit] = useState<LookupHit | null>(null);
  const [locked, setLocked] = useState(false);
  const [error, setError] = useState<CommandFailure | null>(null);
  const [loading, setLoading] = useState(mode === "edit");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (mode !== "edit") {
      return;
    }
    if (!Number.isInteger(partPk) || partPk <= 0) {
      setLoading(false);
      setError({ kind: "invalid", message: "零件不存在" });
      return;
    }
    let active = true;
    setLoading(true);
    getPart(serverId, partPk)
      .then((part) => {
        if (!active) {
          return;
        }
        setDraft(fromDetail(part));
        setLocked(part.locked);
        setCategory(
          part.categoryId
            ? { pk: part.categoryId, name: part.categoryName, pathstring: part.categoryName }
            : null,
        );
        setLocationHit(
          part.locationId ? { pk: part.locationId, name: part.location, pathstring: part.location } : null,
        );
        setError(null);
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
  }, [mode, partPk, serverId]);

  function patch(next: Partial<PartWrite>) {
    setDraft((current) => ({ ...current, ...next }));
  }

  async function save() {
    setSaving(true);
    setError(null);
    const input: PartWrite = {
      ...draft,
      category: category?.pk ?? null,
      defaultLocation: locationHit?.pk ?? null,
    };
    try {
      if (mode === "create") {
        const pk = await createPart(serverId, input);
        stack.replace(`/parts/${pk}`);
        return;
      }
      await updatePart(serverId, partPk, input);
      stack.pop();
    } catch (reason: unknown) {
      setError(readError(reason));
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="muted">正在读取零件…</p>;
  }

  return (
    <form
      className="bom-form part-form"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <Notice error={error} />
      {locked ? <p className="muted">此零件已锁定，不能编辑。</p> : null}
      <TextField label="名称" hint="零件名称" value={draft.name} onChange={(value) => patch({ name: value })} />
      <TextField label="描述" hint="零件描述" value={draft.description} onChange={(value) => patch({ description: value })} />
      <TextField
        label="内部零件号"
        hint="用于内部标识的零件编号"
        value={draft.ipn}
        onChange={(value) => patch({ ipn: value })}
      />
      <TextField
        label="版本"
        hint="零件的修订或版本号"
        value={draft.revision}
        onChange={(value) => patch({ revision: value })}
      />
      <TextField
        label="关键词"
        hint="用于提高搜索可见度的关键词"
        value={draft.keywords}
        onChange={(value) => patch({ keywords: value })}
      />
      <TextField
        label="链接"
        hint="指向外部页面的链接"
        type="url"
        inputMode="url"
        value={draft.link}
        onChange={(value) => patch({ link: value })}
      />
      <CategorySelect
        serverId={serverId}
        label="类别"
        hint="零件所属类别"
        value={category}
        onChange={setCategory}
      />
      <LocationSelect
        serverId={serverId}
        label="默认位置"
        hint="此零件通常存放的位置"
        value={locationHit}
        onChange={setLocationHit}
      />
      <TextField label="单位" hint="此零件的计量单位" value={draft.units} onChange={(value) => patch({ units: value })} />
      <p className="section-label">属性</p>
      {flags.map((flag) => (
        <CheckField
          key={flag.key}
          label={flag.label}
          hint={flag.hint}
          checked={Boolean(draft[flag.key])}
          onChange={(checked) => patch({ [flag.key]: checked })}
        />
      ))}
      <button className="form-primary" type="submit" disabled={saving || locked}>
        {saving ? "正在保存…" : mode === "create" ? "创建" : "保存"}
      </button>
    </form>
  );
}

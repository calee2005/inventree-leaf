import { useEffect, useRef, useState, type FormEvent } from "react";
import { useLocation } from "react-router";
import { createSupplierPart, getCompany, getPart, readError } from "../api";
import { Notice } from "../Notice";
import { usePageStack } from "../shell/pageStack";
import { useShell } from "../shell/AppShell";
import type { CommandFailure } from "../types";
import { CheckField } from "../ui/CheckField";
import { PartLookup, SupplierLookup } from "../ui/LookupSheet";
import { TextField } from "../ui/TextField";

function readId(state: unknown, key: string): number | null {
  if (typeof state !== "object" || state === null || !(key in state)) {
    return null;
  }
  const value = (state as Record<string, unknown>)[key];
  return typeof value === "number" && value > 0 ? value : null;
}

export function SupplierPartFormScreen() {
  const { serverId, setActions } = useShell();
  const saveRef = useRef<() => void>(() => {});
  const stack = usePageStack();
  const route = useLocation();
  const presetPart = readId(route.state, "partId");
  const presetSupplier = readId(route.state, "supplierId");
  const [part, setPart] = useState<{ pk: number; name: string } | null>(null);
  const [supplier, setSupplier] = useState<{ pk: number; name: string } | null>(null);
  const [sku, setSku] = useState("");
  const [description, setDescription] = useState("");
  const [packaging, setPackaging] = useState("");
  const [packQuantity, setPackQuantity] = useState("");
  const [link, setLink] = useState("");
  const [note, setNote] = useState("");
  const [active, setActive] = useState(true);
  const [primary, setPrimary] = useState(false);
  const [error, setError] = useState<CommandFailure | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!presetPart) {
      return;
    }
    let activeRequest = true;
    getPart(serverId, presetPart)
      .then((item) => {
        if (activeRequest) {
          setPart({ pk: item.pk, name: item.name });
        }
      })
      .catch(() => undefined);
    return () => {
      activeRequest = false;
    };
  }, [serverId, presetPart]);

  useEffect(() => {
    if (!presetSupplier) {
      return;
    }
    let activeRequest = true;
    getCompany(serverId, presetSupplier)
      .then((item) => {
        if (activeRequest) {
          setSupplier({ pk: item.pk, name: item.name });
        }
      })
      .catch(() => undefined);
    return () => {
      activeRequest = false;
    };
  }, [serverId, presetSupplier]);

  useEffect(() => {
    setActions([
      {
        id: "create-supplier-part",
        label: saving ? "正在保存…" : "创建",
        onSelect: () => saveRef.current(),
      },
    ]);
    return () => setActions([]);
  }, [saving, setActions]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!part || !supplier) {
      setError({ kind: "invalid", message: !part ? "请选择零件" : "请选择供应商" });
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const pk = await createSupplierPart(serverId, {
        part: part.pk,
        supplier: supplier.pk,
        sku,
        description,
        packaging,
        packQuantity,
        link,
        note,
        active,
        primary,
      });
      stack.replace(`/parts/supplier/${pk}`);
    } catch (reason: unknown) {
      setError(readError(reason));
      setSaving(false);
    }
  }

  saveRef.current = () => {
    if (!saving) {
      void submit({ preventDefault() {} } as FormEvent);
    }
  };

  return (
    <form className="part-form" onSubmit={(event) => void submit(event)}>
      <Notice error={error} />
      <PartLookup
        serverId={serverId}
        label="零件"
        hint="选择要关联的内部零件"
        value={part}
        onChange={(item) => setPart({ pk: item.pk, name: item.name })}
      />
      <SupplierLookup
        serverId={serverId}
        label="供应商"
        hint="选择提供此零件的供应商"
        value={supplier}
        onChange={(item) => setSupplier({ pk: item.pk, name: item.name || "未命名" })}
      />
      <TextField
        label="供应商零件编号"
        hint="供应商的库存单位编号"
        value={sku}
        onChange={setSku}
      />
      <TextField
        label="描述"
        hint="供应商零件描述"
        value={description}
        onChange={setDescription}
      />
      <TextField label="包装" hint="零件包装方式" value={packaging} onChange={setPackaging} />
      <TextField
        label="包装数量"
        hint="单包供应的总数量。单件可留空"
        value={packQuantity}
        onChange={setPackQuantity}
        inputMode="decimal"
      />
      <TextField
        label="链接"
        hint="指向外部供应商零件页面的链接"
        type="url"
        inputMode="url"
        value={link}
        onChange={setLink}
      />
      <TextField label="注释" hint="关于此供应商零件的说明" value={note} onChange={setNote} />
      <CheckField label="有效" hint="此供应商零件是否处于有效状态" checked={active} onChange={setActive} />
      <CheckField label="主供应商" hint="这是否是该零件的主供应商零件" checked={primary} onChange={setPrimary} />
    </form>
  );
}

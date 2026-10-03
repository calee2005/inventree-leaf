import { useEffect, useRef, useState } from "react";
import { useLocation, useParams } from "react-router";
import Picker from "antd-mobile/es/components/picker";
import {
  createStockItem,
  createStockLocation,
  getPartSerialNumbers,
  getStockItem,
  getStockLocation,
  readError,
  updateStockItem,
  updateStockLocation,
} from "../api";
import { Notice } from "../Notice";
import { usePageStack } from "../shell/pageStack";
import { useShell } from "../shell/AppShell";
import type { CommandFailure, LookupHit } from "../types";
import { CheckField } from "../ui/CheckField";
import { LocationSelect } from "../ui/LocationSelect";
import { PartLookup } from "../ui/LookupSheet";
import { PickerTrigger } from "../ui/CategorySelect";
import { TextField } from "../ui/TextField";

function quantityHint(part: { units: string } | null) {
  if (!part) {
    return "先选择零件，才能知道数量单位";
  }
  const trimmed = part.units.trim();
  if (!trimmed) {
    return "此零件没有设置单位";
  }
  return `按零件单位「${trimmed}」填写`;
}

const statuses = [
  { value: "10", label: "正常" },
  { value: "50", label: "需要关注" },
  { value: "55", label: "损坏" },
  { value: "60", label: "销毁" },
  { value: "65", label: "拒收" },
  { value: "70", label: "丢失" },
  { value: "75", label: "隔离" },
  { value: "85", label: "退回" },
];

function readPartPreset(state: unknown): { pk: number; name: string; units: string; trackable: boolean } | null {
  if (typeof state !== "object" || state === null || !("partId" in state)) {
    return null;
  }
  const record = state as Record<string, unknown>;
  const pk = record.partId;
  if (typeof pk !== "number" || pk <= 0) {
    return null;
  }
  return {
    pk,
    name: typeof record.partName === "string" ? record.partName : "",
    units: typeof record.units === "string" ? record.units : "",
    trackable: record.trackable === true,
  };
}

function readHit(state: unknown, idKey: string, nameKey: string): LookupHit | null {
  if (typeof state !== "object" || state === null || !(idKey in state)) {
    return null;
  }
  const record = state as Record<string, unknown>;
  const pk = record[idKey];
  if (typeof pk !== "number" || pk <= 0) {
    return null;
  }
  const name = typeof record[nameKey] === "string" ? record[nameKey] : "";
  return { pk, name, pathstring: name };
}

export function StockLocationFormScreen({ mode }: { mode: "create" | "edit" }) {
  const { serverId, setActions } = useShell();
  const saveRef = useRef<() => void>(() => {});
  const stack = usePageStack();
  const route = useLocation();
  const params = useParams();
  const locationPk = Number(params.locationId);
  const preset = mode === "create" ? readHit(route.state, "parentId", "parentName") : null;
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [parent, setParent] = useState<LookupHit | null>(preset);
  const [structural, setStructural] = useState(false);
  const [external, setExternal] = useState(false);
  const [error, setError] = useState<CommandFailure | null>(null);
  const [loading, setLoading] = useState(mode === "edit");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (mode !== "edit") {
      return;
    }
    if (!Number.isInteger(locationPk) || locationPk <= 0) {
      setLoading(false);
      setError({ kind: "invalid", message: "库存地点不存在" });
      return;
    }
    let active = true;
    getStockLocation(serverId, locationPk)
      .then((location) => {
        if (!active) {
          return;
        }
        setName(location.name);
        setDescription(location.description);
        setStructural(location.structural);
        setExternal(location.external);
        setParent(
          location.parentId
            ? { pk: location.parentId, name: location.parentPath || "上级地点", pathstring: location.parentPath }
            : null,
        );
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
  }, [mode, locationPk, serverId]);

  useEffect(() => {
    if (loading) {
      setActions([]);
      return;
    }
    setActions([
      {
        id: "save-location",
        label: saving ? "正在保存…" : mode === "create" ? "创建" : "保存",
        onSelect: () => saveRef.current(),
      },
    ]);
    return () => setActions([]);
  }, [loading, saving, mode, setActions]);

  async function save() {
    setSaving(true);
    setError(null);
    const input = {
      name,
      description,
      parent: parent?.pk ?? null,
      structural,
      external,
    };
    try {
      if (mode === "create") {
        const pk = await createStockLocation(serverId, input);
        stack.replace(`/stock/location/${pk}`);
        return;
      }
      await updateStockLocation(serverId, locationPk, input);
      stack.pop();
    } catch (reason: unknown) {
      setError(readError(reason));
      setSaving(false);
    }
  }

  saveRef.current = () => {
    if (!saving && !loading) {
      void save();
    }
  };

  if (loading) {
    return <p className="muted">正在读取地点…</p>;
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
      <TextField label="名称" hint="地点名称" value={name} onChange={setName} />
      <TextField label="描述" hint="可选说明" value={description} onChange={setDescription} />
      <LocationSelect serverId={serverId} label="上级地点" hint="留空则放在顶级" value={parent} onChange={setParent} />
      <CheckField
        label="结构位置"
        hint="结构位置不能直接存放库存，只能放到下级地点"
        checked={structural}
        onChange={setStructural}
      />
      <CheckField label="外部地点" hint="这是外部库存地点" checked={external} onChange={setExternal} />
    </form>
  );
}

export function StockItemFormScreen({ mode }: { mode: "create" | "edit" }) {
  const { serverId, setActions } = useShell();
  const saveRef = useRef<() => void>(() => {});
  const stack = usePageStack();
  const route = useLocation();
  const params = useParams();
  const itemPk = Number(params.itemId);
  const partPreset = mode === "create" ? readPartPreset(route.state) : null;
  const preset = mode === "create" ? readHit(route.state, "locationId", "locationName") : null;
  const [part, setPart] = useState<{ pk: number; name: string; units: string } | null>(
    partPreset ? { pk: partPreset.pk, name: partPreset.name, units: partPreset.units } : null,
  );
  const [location, setLocation] = useState<LookupHit | null>(preset);
  const [quantity, setQuantity] = useState("1");
  const [serial, setSerial] = useState("");
  const [serialNumbers, setSerialNumbers] = useState("");
  const [status, setStatus] = useState("10");
  const [batch, setBatch] = useState("");
  const [packaging, setPackaging] = useState("");
  const [link, setLink] = useState("");
  const [error, setError] = useState<CommandFailure | null>(null);
  const [loading, setLoading] = useState(mode === "edit");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (mode !== "edit") {
      return;
    }
    if (!Number.isInteger(itemPk) || itemPk <= 0) {
      setLoading(false);
      setError({ kind: "invalid", message: "库存项不存在" });
      return;
    }
    let active = true;
    getStockItem(serverId, itemPk)
      .then((item) => {
        if (!active) {
          return;
        }
        setPart(item.partId ? { pk: item.partId, name: item.partName, units: item.units } : null);
        setLocation(item.locationId ? { pk: item.locationId, name: item.location, pathstring: item.location } : null);
        setQuantity(String(item.quantity));
        setSerial(item.serial);
        setStatus(String(item.status || 10));
        setBatch(item.batch);
        setPackaging(item.packaging);
        setLink(item.link);
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
  }, [mode, itemPk, serverId]);

  const presetPk = partPreset?.pk ?? 0;
  const presetTrackable = partPreset?.trackable === true;

  useEffect(() => {
    if (mode !== "create" || !presetTrackable || presetPk <= 0) {
      return;
    }
    let active = true;
    getPartSerialNumbers(serverId, presetPk)
      .then((info) => {
        if (active) {
          setSerialNumbers(info.next || info.latest);
        }
      })
      .catch(() => {
        // 拿不到下一个序列号时，仍可以手填。
      });
    return () => {
      active = false;
    };
  }, [mode, presetPk, presetTrackable, serverId]);

  useEffect(() => {
    if (loading) {
      setActions([]);
      return;
    }
    setActions([
      {
        id: "save-item",
        label: saving ? "正在保存…" : mode === "create" ? "创建" : "保存",
        onSelect: () => saveRef.current(),
      },
    ]);
    return () => setActions([]);
  }, [loading, saving, mode, setActions]);

  async function save() {
    const amount = Number(quantity);
    if (!part) {
      setError({ kind: "invalid", message: "请选择零件" });
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setError({ kind: "invalid", message: "数量需要大于 0" });
      return;
    }
    setSaving(true);
    setError(null);
    const input = {
      part: part.pk,
      location: location?.pk ?? null,
      quantity: amount,
      serial,
      serialNumbers: partPreset?.trackable ? serialNumbers : undefined,
      status: Number(status) || 10,
      batch,
      packaging,
      link,
    };
    try {
      if (mode === "create") {
        const pk = await createStockItem(serverId, input);
        stack.replace(`/stock/item/${pk}`);
        return;
      }
      await updateStockItem(serverId, itemPk, input);
      stack.pop();
    } catch (reason: unknown) {
      setError(readError(reason));
      setSaving(false);
    }
  }

  saveRef.current = () => {
    if (!saving && !loading) {
      void save();
    }
  };

  if (loading) {
    return <p className="muted">正在读取库存项…</p>;
  }

  const statusLabel = statuses.find((item) => item.value === status)?.label ?? "正常";

  return (
    <form
      className="bom-form"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <Notice error={error} />
      {partPreset ? (
        <div className="field">
          <span>零件</span>
          <div className="field-input">{partPreset.name || "未命名零件"}</div>
          <small className="field-hint">库存将记在这个零件上</small>
        </div>
      ) : (
        <PartLookup
          serverId={serverId}
          label="零件"
          hint="此库存对应的零件"
          value={part}
          onChange={(next) => setPart({ pk: next.pk, name: next.name, units: next.units })}
        />
      )}
      <LocationSelect serverId={serverId} label="库存地点" hint="留空表示尚未入库到地点" value={location} onChange={setLocation} />
      <TextField
        label={part?.units.trim() ? `数量（${part.units.trim()}）` : "数量"}
        hint={quantityHint(part)}
        inputMode="decimal"
        value={quantity}
        onChange={setQuantity}
      />
      {partPreset?.trackable ? (
        <TextField
          label="序列号"
          hint="下一个可用序列号，也可以填写一段号码"
          value={serialNumbers}
          onChange={setSerialNumbers}
        />
      ) : partPreset ? null : (
        <TextField label="序列号" hint="唯一件才需要填写" value={serial} onChange={setSerial} />
      )}
      <Picker
        columns={[statuses]}
        value={[status]}
        title="状态"
        confirmText="确定"
        cancelText="取消"
        onConfirm={(next) => setStatus(String(next[0] ?? "10"))}
      >
        {(_items, actions) => (
          <PickerTrigger label="状态" hint="库存项当前状态" text={statusLabel} onOpen={actions.open} />
        )}
      </Picker>
      <TextField label="批号" hint="批次编号" value={batch} onChange={setBatch} />
      <TextField label="包装" hint="存放这批库存的包装" value={packaging} onChange={setPackaging} />
      <TextField label="链接" hint="指向外部页面的链接" type="url" inputMode="url" value={link} onChange={setLink} />
    </form>
  );
}

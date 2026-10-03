import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router";
import Picker from "antd-mobile/es/components/picker";
import { createCompany, getCompany, readError, updateCompany } from "../api";
import { Notice } from "../Notice";
import { usePageStack } from "../shell/pageStack";
import { useShell } from "../shell/AppShell";
import type { CommandFailure, CompanyWrite } from "../types";
import { PickerTrigger } from "../ui/CategorySelect";
import { CheckField } from "../ui/CheckField";
import { TextField } from "../ui/TextField";

const currencies = ["CNY", "USD", "EUR", "GBP", "JPY", "AUD", "CAD", "NZD"].map((code) => ({
  label: code,
  value: code,
}));

function blankCompany(role: "supplier" | "customer"): CompanyWrite {
  return {
    name: "",
    description: "",
    website: "",
    phone: "",
    email: "",
    contact: "",
    link: "",
    currency: "CNY",
    taxId: "",
    notes: "",
    active: true,
    isSupplier: role === "supplier",
    isManufacturer: false,
    isCustomer: role === "customer",
  };
}

export function CompanyFormScreen({ mode, role }: { mode: "create" | "edit"; role: "supplier" | "customer" }) {
  const { serverId, setActions } = useShell();
  const saveRef = useRef<() => void>(() => {});
  const stack = usePageStack();
  const params = useParams();
  const companyId = Number(params.companyId);
  const [draft, setDraft] = useState<CompanyWrite>(() => blankCompany(role));
  const [error, setError] = useState<CommandFailure | null>(null);
  const [loading, setLoading] = useState(mode === "edit");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (mode !== "edit") {
      return;
    }
    if (!Number.isInteger(companyId) || companyId <= 0) {
      setLoading(false);
      setError({ kind: "invalid", message: "公司不存在" });
      return;
    }
    let active = true;
    getCompany(serverId, companyId)
      .then((company) => {
        if (!active) {
          return;
        }
        setDraft({
          name: company.name,
          description: company.description,
          website: company.website,
          phone: company.phone,
          email: company.email,
          contact: company.contact,
          link: company.link,
          currency: company.currency || "CNY",
          taxId: company.taxId,
          notes: company.notes,
          active: company.active,
          isSupplier: company.isSupplier,
          isManufacturer: company.isManufacturer,
          isCustomer: company.isCustomer,
        });
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
  }, [mode, companyId, serverId]);

  useEffect(() => {
    if (loading) {
      setActions([]);
      return;
    }
    setActions([
      {
        id: "save-company",
        label: saving ? "正在保存…" : mode === "create" ? "创建" : "保存",
        onSelect: () => saveRef.current(),
      },
    ]);
    return () => setActions([]);
  }, [loading, saving, mode, setActions]);

  function patch(next: Partial<CompanyWrite>) {
    setDraft((current) => ({ ...current, ...next }));
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      if (mode === "create") {
        const pk = await createCompany(serverId, draft);
        stack.replace(`/${role}/${pk}`);
        return;
      }
      await updateCompany(serverId, companyId, draft);
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
    return <p className="muted">正在读取公司…</p>;
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
      <TextField label="名称" hint="公司名称" value={draft.name} onChange={(value) => patch({ name: value })} />
      <TextField label="描述" hint="公司简介" value={draft.description} onChange={(value) => patch({ description: value })} />
      <TextField
        label="网站"
        hint="公司网站地址"
        type="url"
        inputMode="url"
        value={draft.website}
        onChange={(value) => patch({ website: value })}
      />
      <TextField label="电话" hint="联系电话" value={draft.phone} onChange={(value) => patch({ phone: value })} />
      <TextField
        label="电子邮件"
        hint="联系邮箱"
        type="text"
        inputMode="email"
        value={draft.email}
        onChange={(value) => patch({ email: value })}
      />
      <TextField label="联系人" hint="对接人" value={draft.contact} onChange={(value) => patch({ contact: value })} />
      <TextField
        label="链接"
        hint="指向外部公司信息的链接"
        type="url"
        inputMode="url"
        value={draft.link}
        onChange={(value) => patch({ link: value })}
      />
      <Picker
        columns={[currencies]}
        value={[draft.currency]}
        onConfirm={(value) => {
          const next = value[0];
          if (typeof next === "string") {
            patch({ currency: next });
          }
        }}
      >
        {(_items, actions) => (
          <PickerTrigger label="币种" hint="与此公司交易时使用的默认币种" text={draft.currency} onOpen={actions.open} />
        )}
      </Picker>
      <TextField label="税号" hint="公司税号" value={draft.taxId} onChange={(value) => patch({ taxId: value })} />
      <TextField label="注释" hint="补充说明" value={draft.notes} onChange={(value) => patch({ notes: value })} />
      <CheckField label="有效" hint="此公司是否处于有效状态" checked={draft.active} onChange={(checked) => patch({ active: checked })} />
      <CheckField
        label="供应商"
        hint="是否向此公司采购"
        checked={draft.isSupplier}
        onChange={(checked) => patch({ isSupplier: checked })}
      />
      <CheckField
        label="制造商"
        hint="此公司是否生产零件"
        checked={draft.isManufacturer}
        onChange={(checked) => patch({ isManufacturer: checked })}
      />
      <CheckField
        label="客户"
        hint="是否向此公司销售"
        checked={draft.isCustomer}
        onChange={(checked) => patch({ isCustomer: checked })}
      />
    </form>
  );
}

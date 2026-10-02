import { useState, type FormEvent } from "react";
import { readError, saveServer } from "../api";
import { Notice } from "../Notice";
import type { CommandFailure, ServerView } from "../types";

type Props = {
  server: ServerView | null;
  onCancel: () => void;
  onSaved: (server: ServerView) => void;
};

export function ServerFormScreen({ server, onCancel, onSaved }: Props) {
  const [name, setName] = useState(server?.name ?? "");
  const [address, setAddress] = useState(server?.server ?? "");
  const [trustedCertificate, setTrustedCertificate] = useState(
    server?.trustedCertificate ?? false,
  );
  const [error, setError] = useState<CommandFailure | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const saved = await saveServer({
        id: server?.id ?? null,
        name,
        server: address,
        trustedCertificate,
      });
      onSaved(saved);
    } catch (reason: unknown) {
      setError(readError(reason));
      setSaving(false);
    }
  }

  return (
    <form className="stack" onSubmit={(event) => void onSubmit(event)}>
      <header>
        <div>
          <h1>{server ? "编辑服务器" : "新增服务器"}</h1>
          <p className="muted">地址需要包含 http:// 或 https://。</p>
        </div>
      </header>
      <label>
        显示名
        <input value={name} onChange={(event) => setName(event.target.value)} type="text" />
      </label>
      <label>
        服务器地址
        <input
          value={address}
          onChange={(event) => setAddress(event.target.value)}
          type="text"
          inputMode="url"
          placeholder="http://192.168.1.20:8000"
        />
      </label>
      <label className="check">
        <input
          checked={trustedCertificate}
          onChange={(event) => setTrustedCertificate(event.target.checked)}
          type="checkbox"
        />
        信任无效证书
      </label>
      <Notice error={error} />
      <button className="primary" type="submit" disabled={saving}>
        {saving ? "正在保存…" : "保存"}
      </button>
      <button className="ghost" type="button" onClick={onCancel}>
        返回
      </button>
    </form>
  );
}

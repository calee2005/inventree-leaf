import { useEffect, useState, type FormEvent } from "react";
import { listServers, login, logout, readError, saveServer, testConnection } from "../api";
import { Notice } from "../Notice";
import type { CommandFailure, ServerInfo, ServerView, SessionUser } from "../types";

type Props = {
  serverId: string;
  onBack: () => void;
  onLoggedIn: (user: SessionUser) => void;
  onOpenParts: () => void;
};

export function ConnectScreen({ serverId, onBack, onLoggedIn, onOpenParts }: Props) {
  const [server, setServer] = useState<ServerView | null>(null);
  const [info, setInfo] = useState<ServerInfo | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<CommandFailure | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    listServers()
      .then((items) => {
        if (!active) {
          return;
        }
        setServer(items.find((item) => item.id === serverId) ?? null);
      })
      .catch((reason: unknown) => {
        if (active) {
          setError(readError(reason));
        }
      });
    return () => {
      active = false;
    };
  }, [serverId]);

  async function onTest() {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      setInfo(await testConnection(serverId));
    } catch (reason: unknown) {
      setError(readError(reason));
    } finally {
      setBusy(false);
    }
  }

  async function onTrustChange(trustedCertificate: boolean) {
    if (!server) {
      return;
    }
    setError(null);
    try {
      const saved = await saveServer({
        id: server.id,
        name: server.name,
        server: server.server,
        trustedCertificate,
      });
      setServer(saved);
    } catch (reason: unknown) {
      setError(readError(reason));
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const user = await login(serverId, username, password);
      onLoggedIn(user);
    } catch (reason: unknown) {
      setError(readError(reason));
      setBusy(false);
    }
  }

  async function onLogout() {
    setBusy(true);
    setError(null);
    try {
      await logout(serverId);
      setServer((current) => (current ? { ...current, hasToken: false } : current));
    } catch (reason: unknown) {
      setError(readError(reason));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="stack" onSubmit={(event) => void onSubmit(event)}>
      <header>
        <div>
          <h1>{server?.name ?? "连接"}</h1>
          <p className="muted">{server?.server ?? ""}</p>
        </div>
      </header>
      <button className="secondary" type="button" disabled={busy || !server} onClick={() => void onTest()}>
        {busy ? "请稍候…" : "测试连接"}
      </button>
      {info ? (
        <p className="success">
          已连通 {info.instance ? `${info.instance} · ` : ""}
          {info.version}（API {info.apiVersion}）
        </p>
      ) : null}
      <label className="check">
        <input
          checked={server?.trustedCertificate ?? false}
          onChange={(event) => void onTrustChange(event.target.checked)}
          type="checkbox"
          disabled={!server}
        />
        信任无效证书
      </label>
      <Notice error={error} />
      <label>
        用户名
        <input value={username} onChange={(event) => setUsername(event.target.value)} type="text" autoComplete="username" />
      </label>
      <label>
        密码
        <input
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          type="password"
          autoComplete="current-password"
        />
      </label>
      <button className="primary" type="submit" disabled={busy || !server}>
        登录
      </button>
      {server?.hasToken ? (
        <>
          <button className="secondary" type="button" onClick={onOpenParts}>
            查看零件
          </button>
          <button className="danger" type="button" disabled={busy} onClick={() => void onLogout()}>
            退出登录
          </button>
        </>
      ) : null}
      <button className="ghost" type="button" onClick={onBack}>
        返回
      </button>
    </form>
  );
}

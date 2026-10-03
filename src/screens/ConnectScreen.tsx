import { useEffect, useState, type FormEvent } from "react";
import { listServers, login, logout, readError, testConnection } from "../api";
import { Notice } from "../Notice";
import type { CommandFailure, ServerInfo, ServerView, SessionUser } from "../types";
import { TextField } from "../ui/TextField";

type Props = {
  serverId: string;
  onBack: () => void;
  onLoggedIn: (user: SessionUser) => void;
};

export function ConnectScreen({ serverId, onBack, onLoggedIn }: Props) {
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

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const secret = password;
    setPassword("");
    try {
      const user = await login(serverId, username, secret);
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
    <form className="stack" method="post" action="#" onSubmit={(event) => void onSubmit(event)}>
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
      <Notice error={error} />
      <TextField
        label="用户名"
        name="username"
        value={username}
        onChange={setUsername}
        autoComplete="username"
      />
      <TextField
        label="密码"
        name="password"
        type="password"
        value={password}
        onChange={setPassword}
        autoComplete="current-password"
      />
      <button className="primary" type="submit" disabled={busy || !server}>
        登录
      </button>
      {server?.hasToken ? (
        <button className="danger" type="button" disabled={busy} onClick={() => void onLogout()}>
          退出登录
        </button>
      ) : null}
      <button className="ghost" type="button" onClick={onBack}>
        返回
      </button>
    </form>
  );
}

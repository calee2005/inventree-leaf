import { useEffect, useState } from "react";
import { listParts, logout, readError } from "../api";
import { Notice } from "../Notice";
import type { CommandFailure, PartPage, SessionUser } from "../types";

type Props = {
  serverId: string;
  user: SessionUser | null;
  onBack: () => void;
  onLoggedOut: () => void;
};

function formatQty(value: number): string {
  if (Number.isInteger(value)) {
    return String(value);
  }
  return String(Math.round(value * 1000) / 1000);
}

export function PartsScreen({ serverId, user, onBack, onLoggedOut }: Props) {
  const [page, setPage] = useState<PartPage | null>(null);
  const [error, setError] = useState<CommandFailure | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    listParts(serverId)
      .then((result) => {
        if (active) {
          setPage(result);
        }
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
  }, [serverId]);

  async function onLogout() {
    try {
      await logout(serverId);
      onLoggedOut();
    } catch (reason: unknown) {
      setError(readError(reason));
    }
  }

  const results = page?.results ?? [];

  return (
    <section className="stack">
      <header>
        <div>
          <h1>零件</h1>
          <p className="muted">{user ? user.username : "已登录"}</p>
        </div>
      </header>
      <Notice error={error} />
      {loading ? <p className="muted">正在读取零件…</p> : null}
      {page ? (
        <p className="muted">
          共 {page.count} 个，本页 {results.length} 个
          {page.count > results.length ? "。只显示第一页。" : "。"}
        </p>
      ) : null}
      {!loading && results.length === 0 && !error ? <p className="muted">这台服务器上还没有零件。</p> : null}
      <ul className="part-list">
        {results.map((part) => (
          <li className="part" key={part.pk}>
            <strong>{part.name}</strong>
            {part.ipn ? <small>{part.ipn}</small> : null}
            {part.description ? <small>{part.description}</small> : null}
            <span className="qty">在库 {formatQty(part.inStock)}</span>
          </li>
        ))}
      </ul>
      <button className="danger" type="button" onClick={() => void onLogout()}>
        退出登录
      </button>
      <button className="ghost" type="button" onClick={onBack}>
        返回
      </button>
    </section>
  );
}

import { useEffect, useState } from "react";
import { deleteServer, listServers, readError, selectServer } from "../api";
import { Notice } from "../Notice";
import type { CommandFailure, ServerView } from "../types";

type Props = {
  onCreate: () => void;
  onEdit: (server: ServerView) => void;
  onOpen: (server: ServerView) => void;
};

export function ServersScreen({ onCreate, onEdit, onOpen }: Props) {
  const [servers, setServers] = useState<ServerView[]>([]);
  const [error, setError] = useState<CommandFailure | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    listServers()
      .then((items) => {
        if (active) {
          setServers(items);
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
  }, []);

  async function openServer(server: ServerView) {
    setError(null);
    try {
      const selected = await selectServer(server.id);
      onOpen(selected);
    } catch (reason: unknown) {
      setError(readError(reason));
    }
  }

  async function removeServer(server: ServerView) {
    if (!window.confirm(`删除服务器「${server.name}」？`)) {
      return;
    }
    setError(null);
    try {
      await deleteServer(server.id);
      setServers((current) => current.filter((item) => item.id !== server.id));
    } catch (reason: unknown) {
      setError(readError(reason));
    }
  }

  return (
    <section className="stack">
      <header>
        <div>
          <h1>服务器</h1>
          <p className="muted">添加 InvenTree 地址后测试连接并登录。</p>
        </div>
      </header>
      <button className="primary" type="button" onClick={onCreate}>
        新增服务器
      </button>
      <Notice error={error} />
      {loading ? <p className="muted">正在读取本机档案…</p> : null}
      {!loading && servers.length === 0 ? (
        <p className="muted">还没有服务器。</p>
      ) : null}
      {servers.map((server) => (
        <article className="stack" key={server.id}>
          <button className="server-card" type="button" onClick={() => void openServer(server)}>
            <strong>{server.name}</strong>
            <small>{server.server}</small>
            <span className="badges">
              {server.selected ? <span>当前</span> : null}
              {server.hasToken ? <span>已登录</span> : null}
            </span>
          </button>
          <div className="row-actions">
            <button className="secondary" type="button" onClick={() => onEdit(server)}>
              编辑
            </button>
            <button className="danger" type="button" onClick={() => void removeServer(server)}>
              删除
            </button>
          </div>
        </article>
      ))}
    </section>
  );
}

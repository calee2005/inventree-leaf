import { useEffect, useState } from "react";
import {
  SwipeableList,
  SwipeableListItem,
  SwipeAction,
  TrailingActions,
  Type,
} from "react-swipeable-list";
import "react-swipeable-list/dist/styles.css";
import { deleteServer, listServers, readError, selectServer } from "../api";
import { PullToRefresh } from "../MobileList";
import { Notice } from "../Notice";
import type { CommandFailure, ServerView } from "../types";
import { AppVersion } from "../ui/AppVersion";

type Props = {
  onCreate: () => void;
  onEdit: (server: ServerView) => void;
  onEnter: (server: ServerView) => void;
};

export function ServersScreen({ onCreate, onEdit, onEnter }: Props) {
  const [servers, setServers] = useState<ServerView[]>([]);
  const [error, setError] = useState<CommandFailure | null>(null);
  const [loading, setLoading] = useState(true);

  async function reload() {
    setError(null);
    try {
      setServers(await listServers());
    } catch (reason: unknown) {
      setError(readError(reason));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  async function enterServer(server: ServerView) {
    setError(null);
    try {
      onEnter(await selectServer(server.id));
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
    <section className="server-list">
      <div className="brand">
        <img className="brand-logo" src={`${import.meta.env.BASE_URL}logo.png`} alt="" />
        <p className="brand-name">InvenTree</p>
        <AppVersion />
      </div>
      <button className="primary" type="button" onClick={onCreate}>
        新增服务器
      </button>
      <PullToRefresh onRefresh={reload}>
      <Notice error={error} />
      {loading ? <p className="muted">正在读取本机档案…</p> : null}
      {!loading && servers.length === 0 ? <p className="muted">还没有服务器。</p> : null}
      <SwipeableList className="server-rows" type={Type.IOS} fullSwipe={false}>
        {servers.map((server) => (
          <SwipeableListItem
            key={server.id}
            maxSwipe={0.55}
            trailingActions={
              <TrailingActions>
                <SwipeAction onClick={() => onEdit(server)}>
                  <span className="server-swipe-edit">编辑</span>
                </SwipeAction>
                <SwipeAction onClick={() => void removeServer(server)}>
                  <span className="server-swipe-delete">删除</span>
                </SwipeAction>
              </TrailingActions>
            }
          >
            <div className="server-row-front">
              <div className="server-row-text">
                <strong>{server.name}</strong>
                <small>{server.server}</small>
                {server.username ? <span>{server.username}@{server.name}</span> : null}
              </div>
              <button
                className="server-enter"
                type="button"
                aria-label={`进入${server.name}`}
                onMouseDown={(event) => event.stopPropagation()}
                onTouchStart={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  void enterServer(server);
                }}
              >
                <EnterIcon />
              </button>
            </div>
          </SwipeableListItem>
        ))}
      </SwipeableList>
      </PullToRefresh>
    </section>
  );
}

function EnterIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

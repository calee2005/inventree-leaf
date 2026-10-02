import { useEffect, useState, type CSSProperties, type MouseEvent, type ReactNode } from "react";
import { currentUser, listServers, logout, readError } from "../api";
import { Notice } from "../Notice";
import type { CommandFailure, ServerView, SessionUser } from "../types";

export type ShellAction = {
  id: string;
  label: string;
  onSelect: () => void;
};

export type ShellPanel = "views" | "server" | "actions" | "filter" | null;

export type ShellView = {
  id: string;
  title: string;
  color: string;
};

type Props = {
  serverId: string;
  user: SessionUser | null;
  views: ShellView[];
  activeViewId: string;
  onChangeView: (id: string) => void;
  onLoggedOut: () => void;
  onLeave: () => void;
  children: (shell: {
    panel: ShellPanel;
    setPanel: (panel: ShellPanel) => void;
    setActions: (actions: ShellAction[]) => void;
  }) => ReactNode;
};

export function AppShell({
  serverId,
  user,
  views,
  activeViewId,
  onChangeView,
  onLoggedOut,
  onLeave,
  children,
}: Props) {
  const [server, setServer] = useState<ServerView | null>(null);
  const [sessionName, setSessionName] = useState(user?.username ?? "");
  const [panel, setPanel] = useState<ShellPanel>(null);
  const [actions, setActions] = useState<ShellAction[]>([]);
  const [error, setError] = useState<CommandFailure | null>(null);
  const active = views.find((view) => view.id === activeViewId) ?? views[0];

  useEffect(() => {
    let activeRequest = true;
    listServers()
      .then((items) => {
        if (activeRequest) {
          setServer(items.find((item) => item.id === serverId) ?? null);
        }
      })
      .catch((reason: unknown) => {
        if (activeRequest) {
          setError(readError(reason));
        }
      });
    return () => {
      activeRequest = false;
    };
  }, [serverId]);

  useEffect(() => {
    if (user?.username) {
      setSessionName(user.username);
    }
  }, [user]);

  useEffect(() => {
    if (sessionName || !server?.hasToken) {
      return;
    }
    if (server.username) {
      setSessionName(server.username);
      return;
    }
    let activeRequest = true;
    currentUser(serverId)
      .then((session) => {
        if (activeRequest) {
          setSessionName(session.username);
        }
      })
      .catch((reason: unknown) => {
        if (activeRequest) {
          setError(readError(reason));
        }
      });
    return () => {
      activeRequest = false;
    };
  }, [server, serverId, sessionName]);

  function toggle(next: ShellPanel) {
    return (event: MouseEvent) => {
      event.stopPropagation();
      setPanel((current) => (current === next ? null : next));
    };
  }

  async function onLogout() {
    setPanel(null);
    setError(null);
    try {
      await logout(serverId);
      onLoggedOut();
    } catch (reason: unknown) {
      setError(readError(reason));
    }
  }

  const where = server?.name || "服务器";
  const accountLabel = sessionName ? `${sessionName}@${where}` : where;

  return (
    <div className="app-frame" onClick={() => setPanel(null)}>
      <header className="app-bar">
        <div
          className="app-bar-start"
          style={{ "--view-color": active?.color ?? "#2f78f6" } as CSSProperties}
        >
          <button
            className="view-switch"
            type="button"
            aria-label="切换视图"
            onClick={toggle("views")}
          >
            <span className="view-title">{active?.title ?? "零件"}</span>
          </button>
        </div>
        <AppLogo />
        <button className="server-button" type="button" onClick={toggle("server")}>
          <span className="server-label">
            {accountLabel}
          </span>
          <span className="server-glyph">
            <ServerIcon />
            <span className="status-dot" />
          </span>
        </button>
      </header>
      {panel === "views" ? (
        <div className="popover view-menu" onClick={(event) => event.stopPropagation()}>
          {views.map((view) => (
            <button
              key={view.id}
              className={view.id === activeViewId ? "is-current" : undefined}
              type="button"
              style={{ "--view-color": view.color } as CSSProperties}
              onClick={() => {
                onChangeView(view.id);
                setPanel(null);
              }}
            >
              <span>{view.title}</span>
            </button>
          ))}
        </div>
      ) : null}
      {panel === "server" ? (
        <div className="popover server-menu" onClick={(event) => event.stopPropagation()}>
          <div className="server-summary">
            <strong>{accountLabel}</strong>
            <span>{sessionName || "已登录"}</span>
            <span className="connected">已连接</span>
            {server ? <small>{server.server}</small> : null}
          </div>
          <button type="button" onClick={() => void onLogout()}>
            退出登录
          </button>
          <button
            type="button"
            onClick={() => {
              setPanel(null);
              onLeave();
            }}
          >
            返回服务器列表
          </button>
        </div>
      ) : null}
      <div className="app-body">
        <Notice error={error} />
        {children({ panel, setPanel, setActions })}
      </div>
      {actions.length > 0 ? (
        <div className="action-dock">
          {panel === "actions" ? (
            <div className="popover action-menu" onClick={(event) => event.stopPropagation()}>
              {actions.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  onClick={() => {
                    setPanel(null);
                    action.onSelect();
                  }}
                >
                  {action.label}
                </button>
              ))}
            </div>
          ) : null}
          <button className="action-fab" type="button" onClick={toggle("actions")}>
            <HandIcon />
            行动
          </button>
        </div>
      ) : null}
    </div>
  );
}

function AppLogo() {
  return <img className="app-mark" src="/logo.png" alt="" />;
}

function ServerIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3.5" y="4" width="17" height="6" rx="1.5" />
      <rect x="3.5" y="14" width="17" height="6" rx="1.5" />
      <circle cx="7" cy="7" r="0.9" />
      <circle cx="7" cy="17" r="0.9" />
    </svg>
  );
}

function HandIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8.8 11.2V6.2a1.2 1.2 0 0 1 2.4 0v4.4h.6V4.6a1.2 1.2 0 0 1 2.4 0v6h.6V7.1a1.2 1.2 0 0 1 2.4 0V14c0 3.2-2.1 5.6-5.2 5.6h-1.4c-2.2 0-4-1.1-4.9-2.8l-1.6-2.6a1.3 1.3 0 0 1 2.2-1.4l2.5 2.8V11.2z" />
    </svg>
  );
}

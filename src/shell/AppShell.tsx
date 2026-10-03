import { createContext, useContext, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { useLocation } from "react-router";
import { currentUser, listServers, logout, readError } from "../api";
import type { CommandFailure, ServerView, SessionUser } from "../types";
import { usePageStack } from "./pageStack";

export type ShellAction = {
  id: string;
  label: string;
  onSelect: () => void;
};

export type ShellPanel = "views" | "server" | "actions" | "filter" | null;

export type ShellView = {
  id: string;
  path: string;
  title: string;
  color: string;
};

type ShellApi = {
  serverId: string;
  panel: ShellPanel;
  setPanel: (panel: ShellPanel) => void;
  actions: ShellAction[];
  setActions: (actions: ShellAction[]) => void;
  error: CommandFailure | null;
  views: ShellView[];
  active: ShellView;
  accountLabel: string;
};

const ShellContext = createContext<ShellApi | null>(null);

export function useShell() {
  const value = useContext(ShellContext);
  if (!value) {
    throw new Error("页面需要放在应用框架里");
  }
  return value;
}

type Props = {
  serverId: string;
  user: SessionUser | null;
  views: ShellView[];
  onLoggedOut: () => void;
  onLeave: () => void;
  children: ReactNode;
};

function viewForPath(pathname: string, views: ShellView[]) {
  return (
    views.find((view) => pathname === view.path || pathname.startsWith(`${view.path}/`)) ?? views[0]
  );
}

export function AppShell({ serverId, user, views, onLoggedOut, onLeave, children }: Props) {
  const location = useLocation();
  const stack = usePageStack();
  const [server, setServer] = useState<ServerView | null>(null);
  const [sessionName, setSessionName] = useState(user?.username ?? "");
  const [panel, setPanel] = useState<ShellPanel>(null);
  const [actions, setActions] = useState<ShellAction[]>([]);
  const [error, setError] = useState<CommandFailure | null>(null);
  const active = viewForPath(location.pathname, views);
  const where = server?.name || "服务器";
  const accountLabel = sessionName ? `${sessionName}@${where}` : where;
  const shell = useMemo<ShellApi>(
    () => ({
      serverId,
      panel,
      setPanel,
      actions,
      setActions,
      error,
      views,
      active,
      accountLabel,
    }),
    [serverId, panel, actions, error, views, active, accountLabel],
  );

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

  useEffect(() => {
    setPanel(null);
  }, [location.key]);

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

  return (
    <ShellContext.Provider value={shell}>
      <div className="app-frame" onClick={() => setPanel(null)}>
        <div className="page-stack">{children}</div>
        {panel === "views" ? (
          <div className="view-overlay" onClick={(event) => event.stopPropagation()}>
            {views
              .filter((view) => view.id !== active.id)
              .map((view) => (
                <button
                  key={view.id}
                  type="button"
                  style={{ "--view-color": view.color } as CSSProperties}
                  onClick={() => {
                    stack.replace(view.path);
                    setPanel(null);
                  }}
                >
                  {view.title}
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
            <button
              type="button"
              onClick={() => {
                setPanel(null);
                stack.push("/about");
              }}
            >
              关于
            </button>
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
      </div>
    </ShellContext.Provider>
  );
}

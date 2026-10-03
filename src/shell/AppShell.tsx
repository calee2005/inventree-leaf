import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { useLocation } from "react-router";
import { currentUser, listServers, logout, readError } from "../api";
import type { CommandFailure, ServerView, SessionUser } from "../types";
import { AliveOutlet } from "./AliveOutlet";
import { usePageStack } from "./pageStack";
import { AppVersion } from "../ui/AppVersion";

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

export const ShellContext = createContext<ShellApi | null>(null);

export const ActionRegistryContext = createContext<(key: string, actions: ShellAction[]) => void>(() => {});

const NO_ACTIONS: ShellAction[] = [];

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
};

function viewForPath(pathname: string, views: ShellView[]) {
  return (
    views.find((view) => pathname === view.path || pathname.startsWith(`${view.path}/`)) ?? views[0]
  );
}

export function AppShell({ serverId, user, views, onLoggedOut, onLeave }: Props) {
  const location = useLocation();
  const stack = usePageStack();
  const [server, setServer] = useState<ServerView | null>(null);
  const [sessionName, setSessionName] = useState(user?.username ?? "");
  const [panel, setPanel] = useState<ShellPanel>(null);
  const [actionMap, setActionMap] = useState<Map<string, ShellAction[]>>(() => new Map());
  const [error, setError] = useState<CommandFailure | null>(null);
  const registerActions = useCallback((key: string, next: ShellAction[]) => {
    setActionMap((current) => {
      if (current.get(key) === next) {
        return current;
      }
      const copy = new Map(current);
      copy.set(key, next);
      return copy;
    });
  }, []);
  const actions = actionMap.get(location.key) ?? NO_ACTIONS;
  const locationKey = useRef(location.key);
  locationKey.current = location.key;
  const setActions = useCallback((next: ShellAction[]) => {
    registerActions(locationKey.current, next);
  }, [registerActions]);
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
    [serverId, panel, actions, setActions, error, views, active, accountLabel],
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
      <ActionRegistryContext.Provider value={registerActions}>
      <div className="app-frame" onClick={() => setPanel(null)}>
        <div className="page-stack">
          <AliveOutlet />
        </div>
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
            <AppVersion />
          </div>
        ) : null}
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
            <button
              className="action-fab"
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setPanel(panel === "actions" ? null : "actions");
              }}
            >
              <HandIcon />
              行动
            </button>
          </div>
        ) : null}
      </div>
      </ActionRegistryContext.Provider>
    </ShellContext.Provider>
  );
}

function HandIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8.8 11.2V6.2a1.2 1.2 0 0 1 2.4 0v4.4h.6V4.6a1.2 1.2 0 0 1 2.4 0v6h.6V7.1a1.2 1.2 0 0 1 2.4 0V14c0 3.2-2.1 5.6-5.2 5.6h-1.4c-2.2 0-4-1.1-4.9-2.8l-1.6-2.6a1.3 1.3 0 0 1 2.2-1.4l2.5 2.8V11.2z" />
    </svg>
  );
}

import { useState } from "react";
import { ConnectScreen } from "./screens/ConnectScreen";
import { PartsScreen } from "./screens/PartsScreen";
import { ServerFormScreen } from "./screens/ServerFormScreen";
import { ServersScreen } from "./screens/ServersScreen";
import { RecordListScreen } from "./screens/RecordListScreen";
import { AppShell, type ShellView } from "./shell/AppShell";
import type { ServerView, SessionUser } from "./types";

const signedInViews: ShellView[] = [
  { id: "parts", title: "零件", color: "#2f78f6" },
  { id: "stock", title: "库存", color: "#1f9d6a" },
  { id: "supplier", title: "供应商", color: "#e07a32" },
  { id: "customer", title: "客户", color: "#c43d7a" },
  { id: "build", title: "生产订单", color: "#6f9f2a" },
  { id: "transfer", title: "调拨单", color: "#7c6cf0" },
  { id: "purchase", title: "采购订单", color: "#d64545" },
  { id: "sales", title: "销售订单", color: "#1a9aaa" },
];

const recordViews: Record<string, { kind: string; emptyText: string }> = {
  stock: { kind: "stock", emptyText: "这里还没有库存。" },
  supplier: { kind: "supplier", emptyText: "这里还没有供应商。" },
  customer: { kind: "customer", emptyText: "这里还没有客户。" },
  build: { kind: "build", emptyText: "这里还没有生产订单。" },
  transfer: { kind: "transfer", emptyText: "这里还没有调拨单。" },
  purchase: { kind: "purchase", emptyText: "这里还没有采购订单。" },
  sales: { kind: "sales", emptyText: "这里还没有销售订单。" },
};

type Screen =
  | { name: "list" }
  | { name: "edit"; server: ServerView | null }
  | { name: "connect"; serverId: string }
  | { name: "parts"; serverId: string; user: SessionUser | null };

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: "list" });
  const [viewId, setViewId] = useState("parts");

  return (
    <main className={screen.name === "parts" ? "shell shell-app" : screen.name === "list" ? "shell shell-list" : "shell"}>
      {screen.name === "list" ? (
        <ServersScreen
          onCreate={() => setScreen({ name: "edit", server: null })}
          onEdit={(server) => setScreen({ name: "edit", server })}
          onEnter={(server) =>
            setScreen(
              server.hasToken
                ? {
                    name: "parts",
                    serverId: server.id,
                    user: server.username
                      ? {
                          pk: 0,
                          username: server.username,
                          email: "",
                          firstName: "",
                          lastName: "",
                        }
                      : null,
                  }
                : { name: "connect", serverId: server.id },
            )
          }
        />
      ) : null}
      {screen.name === "edit" ? (
        <ServerFormScreen
          server={screen.server}
          onCancel={() => setScreen({ name: "list" })}
          onSaved={(server) => setScreen({ name: "connect", serverId: server.id })}
        />
      ) : null}
      {screen.name === "connect" ? (
        <ConnectScreen
          serverId={screen.serverId}
          onBack={() => setScreen({ name: "list" })}
          onLoggedIn={(user) => setScreen({ name: "parts", serverId: screen.serverId, user })}
        />
      ) : null}
      {screen.name === "parts" ? (
        <AppShell
          serverId={screen.serverId}
          user={screen.user}
          views={signedInViews}
          activeViewId={viewId}
          onChangeView={setViewId}
          onLoggedOut={() => setScreen({ name: "connect", serverId: screen.serverId })}
          onLeave={() => setScreen({ name: "list" })}
        >
          {(shell) =>
            viewId === "parts" ? (
              <PartsScreen
                serverId={screen.serverId}
                panel={shell.panel}
                onPanel={shell.setPanel}
                setActions={shell.setActions}
              />
            ) : (
              <RecordListScreen
                serverId={screen.serverId}
                kind={recordViews[viewId]?.kind ?? viewId}
                emptyText={recordViews[viewId]?.emptyText ?? "这里还没有记录。"}
              />
            )
          }
        </AppShell>
      ) : null}
    </main>
  );
}

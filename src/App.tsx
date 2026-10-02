import { useState } from "react";
import { ConnectScreen } from "./screens/ConnectScreen";
import { PartsScreen } from "./screens/PartsScreen";
import { ServerFormScreen } from "./screens/ServerFormScreen";
import { ServersScreen } from "./screens/ServersScreen";
import { AppShell, type ShellView } from "./shell/AppShell";
import type { ServerView, SessionUser } from "./types";

const signedInViews: ShellView[] = [{ id: "parts", title: "零件", color: "#2f78f6" }];

type Screen =
  | { name: "list" }
  | { name: "edit"; server: ServerView | null }
  | { name: "connect"; serverId: string }
  | { name: "parts"; serverId: string; user: SessionUser | null };

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: "list" });

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
          activeViewId="parts"
          onChangeView={() => undefined}
          onLoggedOut={() => setScreen({ name: "connect", serverId: screen.serverId })}
          onLeave={() => setScreen({ name: "list" })}
        >
          {(shell) => (
            <PartsScreen
              serverId={screen.serverId}
              panel={shell.panel}
              onPanel={shell.setPanel}
              setActions={shell.setActions}
            />
          )}
        </AppShell>
      ) : null}
    </main>
  );
}

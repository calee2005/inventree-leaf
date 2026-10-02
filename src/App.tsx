import { useState } from "react";
import { ConnectScreen } from "./screens/ConnectScreen";
import { PartsScreen } from "./screens/PartsScreen";
import { ServerFormScreen } from "./screens/ServerFormScreen";
import { ServersScreen } from "./screens/ServersScreen";
import type { ServerView, SessionUser } from "./types";

type Screen =
  | { name: "list" }
  | { name: "edit"; server: ServerView | null }
  | { name: "connect"; serverId: string }
  | { name: "parts"; serverId: string; user: SessionUser | null };

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: "list" });

  return (
    <main className="shell">
      {screen.name === "list" ? (
        <ServersScreen
          onCreate={() => setScreen({ name: "edit", server: null })}
          onEdit={(server) => setScreen({ name: "edit", server })}
          onOpen={(server) => setScreen({ name: "connect", serverId: server.id })}
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
          onOpenParts={() => setScreen({ name: "parts", serverId: screen.serverId, user: null })}
        />
      ) : null}
      {screen.name === "parts" ? (
        <PartsScreen
          serverId={screen.serverId}
          user={screen.user}
          onBack={() => setScreen({ name: "connect", serverId: screen.serverId })}
          onLoggedOut={() => setScreen({ name: "connect", serverId: screen.serverId })}
        />
      ) : null}
    </main>
  );
}

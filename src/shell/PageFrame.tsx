import { type CSSProperties, type MouseEvent, type ReactNode } from "react";
import { Notice } from "../Notice";
import { usePageStack } from "./pageStack";
import { useShell, type ShellPanel } from "./AppShell";

type Props = {
  back?: boolean;
  children: ReactNode;
};

export function PageFrame({ back = false, children }: Props) {
  const shell = useShell();
  const stack = usePageStack();

  function toggle(next: ShellPanel) {
    return (event: MouseEvent) => {
      event.stopPropagation();
      shell.setPanel(shell.panel === next ? null : next);
    };
  }

  return (
    <section className="page-frame">
      <header className="app-bar">
        <div
          className="app-bar-start"
          style={{ "--view-color": shell.active.color } as CSSProperties}
        >
          {back ? (
            <button
              className="back-switch"
              type="button"
              aria-label="返回"
              onClick={(event) => {
                event.stopPropagation();
                stack.pop();
              }}
            >
              <ChevronLeft />
              <span className="view-title">{shell.active.title}</span>
            </button>
          ) : (
            <button className="view-switch" type="button" aria-label="切换视图" onClick={toggle("views")}>
              <span className="view-title">{shell.active.title}</span>
            </button>
          )}
        </div>
        <AppLogo />
        <button className="server-button" type="button" onClick={toggle("server")}>
          <span className="server-label">{shell.accountLabel}</span>
          <span className="server-glyph">
            <ServerIcon />
            <span className="status-dot" />
          </span>
        </button>
      </header>
      <div className="app-body">
        <Notice error={shell.error} />
        {children}
      </div>
      {!back && shell.actions.length > 0 ? (
        <div className="action-dock">
          {shell.panel === "actions" ? (
            <div className="popover action-menu" onClick={(event) => event.stopPropagation()}>
              {shell.actions.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  onClick={() => {
                    shell.setPanel(null);
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
    </section>
  );
}

function AppLogo() {
  return <img className="app-mark" src="/logo.png" alt="" />;
}

function ChevronLeft() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M14.5 6.5 9 12l5.5 5.5" />
    </svg>
  );
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

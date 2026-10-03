import { type CSSProperties, type MouseEvent, type ReactNode } from "react";
import { forceRefresh } from "../browser/release";
import { Notice } from "../Notice";
import { PageContent } from "../ui/PageContent";
import { usePageStack } from "./pageStack";
import { useShell, type ShellPanel } from "./AppShell";

type Props = {
  back?: boolean;
  title?: string;
  children: ReactNode;
};

export function PageFrame({ back = false, title, children }: Props) {
  const shell = useShell();
  const stack = usePageStack();

  function toggle(next: ShellPanel) {
    return (event: MouseEvent) => {
      event.stopPropagation();
      shell.setPanel(shell.panel === next ? null : next);
    };
  }

  return (
    <section className={shell.actions.length > 0 ? "page-frame has-actions" : "page-frame"}>
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
              <span className="view-title">{title || shell.active.title}</span>
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
        <PageContent>{children}</PageContent>
      </div>
    </section>
  );
}

function AppLogo() {
  return (
    <button className="app-mark-button" type="button" aria-label="刷新" onClick={(event) => {
      event.stopPropagation();
      forceRefresh();
    }}>
      <img className="app-mark" src={`${import.meta.env.BASE_URL}logo.png`} alt="" />
    </button>
  );
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

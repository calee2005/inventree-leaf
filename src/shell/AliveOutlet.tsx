import { useCallback, useContext, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  UNSAFE_LocationContext,
  useLocation,
  useNavigationType,
  useOutlet,
  type Location,
  type NavigationType,
} from "react-router";
import { ActionRegistryContext, ShellContext, useShell, type ShellAction } from "./AppShell";

function sameKeys(left: string[], right: string[]) {
  return left.length === right.length && left.every((key, index) => key === right[index]);
}

function nextKeys(prev: string[], key: string, type: NavigationType) {
  const index = prev.lastIndexOf(key);
  if (type === "REPLACE") {
    if (prev.length === 0) {
      return [key];
    }
    if (prev[prev.length - 1] === key) {
      return prev;
    }
    return [...prev.slice(0, -1), key];
  }
  if (index >= 0) {
    return index === prev.length - 1 ? prev : prev.slice(0, index + 1);
  }
  return [...prev, key];
}

function PageScope({ pageKey, children }: { pageKey: string; children: ReactNode }) {
  const parent = useShell();
  const registerActions = useContext(ActionRegistryContext);
  const setActions = useCallback(
    (next: ShellAction[]) => registerActions(pageKey, next),
    [registerActions, pageKey],
  );
  const value = useMemo(() => ({ ...parent, setActions }), [parent, setActions]);
  return <ShellContext.Provider value={value}>{children}</ShellContext.Provider>;
}

function AlivePage({ hidden, children }: { hidden: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const scrollTop = useRef(0);

  useLayoutEffect(() => {
    const body = ref.current?.querySelector(".app-body");
    if (!(body instanceof HTMLElement)) {
      return;
    }
    if (hidden) {
      if (body.scrollTop > 0) {
        scrollTop.current = body.scrollTop;
      }
      return;
    }
    if (body.scrollTop !== scrollTop.current) {
      body.scrollTop = scrollTop.current;
    }
  }, [hidden]);

  useLayoutEffect(() => {
    const root = ref.current;
    if (!root || hidden) {
      return;
    }
    const onScroll = (event: Event) => {
      if (event.target instanceof HTMLElement && event.target.classList.contains("app-body")) {
        scrollTop.current = event.target.scrollTop;
      }
    };
    root.addEventListener("scroll", onScroll, true);
    return () => root.removeEventListener("scroll", onScroll, true);
  }, [hidden]);

  return (
    <div
      ref={ref}
      className={hidden ? "alive-page is-hidden" : "alive-page"}
      inert={hidden}
      aria-hidden={hidden}
    >
      {children}
    </div>
  );
}

export function AliveOutlet() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const outlet = useOutlet();
  const cache = useRef(new Map<string, ReactNode>());
  const locations = useRef(new Map<string, { location: Location; navigationType: NavigationType }>());
  const [stack, setStack] = useState<string[]>(() => [location.key]);
  const [seen, setSeen] = useState({ key: location.key, navigationType });

  let keys = stack;
  if (seen.key !== location.key || seen.navigationType !== navigationType) {
    const pending = nextKeys(stack, location.key, navigationType);
    keys = sameKeys(stack, pending) ? stack : pending;
    setSeen({ key: location.key, navigationType });
    if (keys !== stack) {
      setStack(keys);
    }
  }

  if (outlet) {
    cache.current.set(location.key, outlet);
  }
  const saved = locations.current.get(location.key);
  if (!saved || saved.location !== location || saved.navigationType !== navigationType) {
    locations.current.set(location.key, { location, navigationType });
  }
  for (const key of cache.current.keys()) {
    if (!keys.includes(key)) {
      cache.current.delete(key);
      locations.current.delete(key);
    }
  }

  return keys.map((key) => {
    const hidden = key !== location.key;
    const frozen = locations.current.get(key);
    const node = hidden ? cache.current.get(key) : outlet;
    if (!node || !frozen) {
      return null;
    }
    return (
      <AlivePage key={key} hidden={hidden}>
        <UNSAFE_LocationContext.Provider value={hidden ? frozen : { location, navigationType }}>
          <PageScope pageKey={key}>{node}</PageScope>
        </UNSAFE_LocationContext.Provider>
      </AlivePage>
    );
  });
}

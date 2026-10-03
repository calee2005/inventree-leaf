const CHECK_INTERVAL_MS = 60_000;
const RELOAD_KEY = "leaf-reloaded-script";

export function watchRelease() {
  if (!import.meta.env.PROD) {
    return;
  }
  const current = currentScriptHash();
  if (!current) {
    return;
  }

  let checking = false;
  async function check() {
    if (checking || document.visibilityState === "hidden") {
      return;
    }
    checking = true;
    try {
      const remote = await remoteScriptHash();
      if (!remote || remote === current || sessionStorage.getItem(RELOAD_KEY) === remote) {
        return;
      }
      sessionStorage.setItem(RELOAD_KEY, remote);
      const next = new URL(baseUrl());
      next.searchParams.set("updated", remote);
      window.location.replace(next.href);
    } catch {
      // 暂时读不到新的页面时，继续使用当前版本。
    } finally {
      checking = false;
    }
  }

  window.setInterval(() => void check(), CHECK_INTERVAL_MS);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      void check();
    }
  });
  window.addEventListener("pageshow", () => void check());
  void check();
}

function baseUrl(): string {
  const base = import.meta.env.BASE_URL;
  const normalized = base.endsWith("/") ? base : `${base}/`;
  return new URL(normalized, window.location.origin).href;
}

function currentScriptHash(): string | null {
  const sources = [...document.querySelectorAll("script")].map((script) => script.src);
  for (const source of sources) {
    const hash = scriptHash(source);
    if (hash) {
      return hash;
    }
  }
  return scriptHash(import.meta.url);
}

async function remoteScriptHash(): Promise<string | null> {
  const url = new URL("index.html", baseUrl());
  url.searchParams.set("t", String(Date.now()));
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    return null;
  }
  return scriptHash(await response.text());
}

function scriptHash(source: string): string | null {
  return source.match(/\/assets\/index-([A-Za-z0-9_-]+)\.js/)?.[1] ?? null;
}

import { useEffect, useState } from "react";
import { defaultCurrency, readError, totalStockValue } from "../api";
import { PullToRefresh } from "../MobileList";
import { Notice } from "../Notice";
import { useShell } from "../shell/AppShell";
import type { CommandFailure } from "../types";
import { formatMoney } from "../ui/quantity";

const STORAGE_KEY = "leaf-board";
const STOCK_VALUE = "stock-value";

function readWidgets(serverId: string): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return [];
    }
    const saved = (parsed as Record<string, unknown>)[serverId];
    return Array.isArray(saved) ? saved.filter((item) => item === STOCK_VALUE) : [];
  } catch {
    return [];
  }
}

function writeWidgets(serverId: string, widgets: string[]) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : {};
    const all = typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? parsed : {};
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...all, [serverId]: widgets }));
  } catch {
    // 看板配置写不进去时，这次添加只留在当前页面。
  }
}

export function BoardScreen() {
  const { serverId, setActions } = useShell();
  const [widgets, setWidgets] = useState<string[]>(() => readWidgets(serverId));

  useEffect(() => {
    setWidgets(readWidgets(serverId));
  }, [serverId]);

  useEffect(() => {
    const present = widgets.includes(STOCK_VALUE);
    setActions([
      present
        ? {
            id: "remove-stock-value",
            label: "移除库存总价值",
            onSelect: () => {
              const next = widgets.filter((item) => item !== STOCK_VALUE);
              setWidgets(next);
              writeWidgets(serverId, next);
            },
          }
        : {
            id: "add-stock-value",
            label: "添加库存总价值",
            onSelect: () => {
              const next = [...widgets, STOCK_VALUE];
              setWidgets(next);
              writeWidgets(serverId, next);
            },
          },
    ]);
    return () => setActions([]);
  }, [serverId, setActions, widgets]);

  return (
    <PullToRefresh
      onRefresh={async () => {
        window.dispatchEvent(new CustomEvent("leaf-board-refresh"));
      }}
    >
      {widgets.length === 0 ? <p className="muted">还没有小组件。从行动菜单添加。</p> : null}
      <div className="board-grid">
        {widgets.includes(STOCK_VALUE) ? <StockValueWidget serverId={serverId} /> : null}
      </div>
    </PullToRefresh>
  );
}

function StockValueWidget({ serverId }: { serverId: string }) {
  const [currency, setCurrency] = useState("");
  const [min, setMin] = useState<number | null>(null);
  const [max, setMax] = useState<number | null>(null);
  const [priced, setPriced] = useState(0);
  const [error, setError] = useState<CommandFailure | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const refresh = () => setTick((value) => value + 1);
    window.addEventListener("leaf-board-refresh", refresh);
    return () => window.removeEventListener("leaf-board-refresh", refresh);
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([totalStockValue(serverId), defaultCurrency(serverId)])
      .then(([total, code]) => {
        if (!active) {
          return;
        }
        setMin(total.min);
        setMax(total.max);
        setPriced(total.priced);
        setCurrency(code);
        setError(null);
      })
      .catch((reason: unknown) => {
        if (active) {
          setError(readError(reason));
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [serverId, tick]);

  const label =
    min === null || max === null
      ? ""
      : Math.abs(min - max) < 0.005
        ? formatMoney(min, currency)
        : `${formatMoney(min, currency)} – ${formatMoney(max, currency)}`;

  return (
    <article className="board-widget">
      <span>库存总价值</span>
      <Notice error={error} />
      {loading ? <p className="muted">正在合计在库零件…</p> : <strong>{label || "没有可计价的库存"}</strong>}
      {!loading && !error ? <small>按有价格的在库零件，用数量乘以单价合计。共 {priced} 种。</small> : null}
    </article>
  );
}

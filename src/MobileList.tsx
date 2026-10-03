import { useEffect, useRef, useState, type ReactNode } from "react";
import InfiniteScroll from "antd-mobile/es/components/infinite-scroll";

const slop = 8;
const trigger = 56;
const maxPull = 88;

export function PullToRefresh({ onRefresh, children }: { onRefresh: () => Promise<unknown>; children: ReactNode }) {
  const host = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const startX = useRef(0);
  const tracking = useRef(false);
  const moved = useRef(false);
  const distance = useRef(0);
  const heightRef = useRef(0);
  const refreshing = useRef(false);
  const finishRef = useRef<() => void>(() => {});
  const [height, setHeight] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const node = host.current;
    if (!node) {
      return;
    }
    const onStart = (event: TouchEvent) => {
      const box = scroller.current;
      const touch = event.touches[0];
      if (!box || !touch || refreshing.current || box.scrollTop > 1) {
        tracking.current = false;
        return;
      }
      tracking.current = true;
      moved.current = false;
      startY.current = touch.clientY;
      startX.current = touch.clientX;
    };
    const onMove = (event: TouchEvent) => {
      if (!tracking.current || refreshing.current) {
        return;
      }
      const touch = event.touches[0];
      const box = scroller.current;
      if (!touch || !box || box.scrollTop > 1) {
        tracking.current = false;
        heightRef.current = 0;
        setHeight(0);
        return;
      }
      const dy = touch.clientY - startY.current;
      const dx = touch.clientX - startX.current;
      if (dy <= slop || Math.abs(dx) > Math.abs(dy)) {
        return;
      }
      moved.current = true;
      if (event.cancelable) {
        event.preventDefault();
      }
      distance.current = dy;
      const next = Math.min((dy - slop) * 0.55, maxPull);
      heightRef.current = next;
      setHeight(next);
    };
    const onEnd = () => finishRef.current();
    node.addEventListener("touchstart", onStart, { capture: true, passive: true });
    node.addEventListener("touchmove", onMove, { capture: true, passive: false });
    node.addEventListener("touchend", onEnd);
    node.addEventListener("touchcancel", onEnd);
    return () => {
      node.removeEventListener("touchstart", onStart, { capture: true });
      node.removeEventListener("touchmove", onMove, { capture: true });
      node.removeEventListener("touchend", onEnd);
      node.removeEventListener("touchcancel", onEnd);
    };
  }, []);

  function beginPointer(event: React.PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "touch" || refreshing.current) {
      return;
    }
    const box = scroller.current;
    if (!box || box.scrollTop > 1) {
      return;
    }
    tracking.current = true;
    moved.current = false;
    startY.current = event.clientY;
    startX.current = event.clientX;
  }

  function movePointer(event: React.PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "touch" || !tracking.current || refreshing.current) {
      return;
    }
    const box = scroller.current;
    const dy = event.clientY - startY.current;
    const dx = event.clientX - startX.current;
    if (!box || box.scrollTop > 1 || dy <= slop || Math.abs(dx) > Math.abs(dy)) {
      return;
    }
    moved.current = true;
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    distance.current = dy;
    const next = Math.min((dy - slop) * 0.55, maxPull);
    heightRef.current = next;
    setHeight(next);
  }

  async function endPointer() {
    if (!tracking.current && distance.current === 0) {
      return;
    }
    const pulled = distance.current;
    tracking.current = false;
    distance.current = 0;
    heightRef.current = 0;
    if (refreshing.current) {
      return;
    }
    if (pulled < trigger) {
      setHeight(0);
      return;
    }
    refreshing.current = true;
    setBusy(true);
    setHeight(44);
    try {
      await onRefresh();
    } finally {
      refreshing.current = false;
      setBusy(false);
      setHeight(0);
    }
  }

  finishRef.current = () => {
    void endPointer();
  };

  const label = busy ? "正在刷新…" : distance.current >= trigger || height >= maxPull * 0.7 ? "释放立即刷新" : "下拉刷新";

  return (
    <div
      ref={host}
      className={height > 0 ? "pull-host is-pulling" : "pull-host"}
      onPointerDown={beginPointer}
      onPointerMove={movePointer}
      onPointerUp={() => void endPointer()}
      onPointerCancel={() => void endPointer()}
      onClickCapture={(event) => {
        if (!moved.current) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        moved.current = false;
      }}
    >
      <div className="pull-head" style={{ height }}>
        {height > 0 ? <span>{label}</span> : null}
      </div>
      <div ref={scroller} className="pull-scroller">
        {children}
      </div>
    </div>
  );
}

export { InfiniteScroll };

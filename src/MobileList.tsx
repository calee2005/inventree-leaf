import { useEffect, useRef, type ReactNode } from "react";
import InfiniteScroll from "antd-mobile/es/components/infinite-scroll";
import AntdPullToRefresh from "antd-mobile/es/components/pull-to-refresh";

const pullThreshold = 28;
const dragSlop = 8;

export function PullToRefresh({ onRefresh, children }: { onRefresh: () => Promise<unknown>; children: ReactNode }) {
  const host = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const dragged = useRef(false);

  useEffect(() => {
    const node = host.current;
    if (!node) {
      return;
    }
    const onStart = (event: TouchEvent) => {
      dragged.current = false;
      startY.current = event.touches[0]?.clientY ?? 0;
    };
    const onMove = (event: TouchEvent) => {
      const y = event.touches[0]?.clientY ?? startY.current;
      const delta = y - startY.current;
      if (Math.abs(delta) > dragSlop) {
        dragged.current = true;
      }
      const scroller = node.querySelector(".adm-pull-to-refresh");
      if (!(scroller instanceof HTMLElement) || scroller.scrollTop > 0 || delta < dragSlop) {
        return;
      }
      if (event.cancelable) {
        event.preventDefault();
      }
    };
    node.addEventListener("touchstart", onStart, { passive: true });
    node.addEventListener("touchmove", onMove, { passive: false });
    return () => {
      node.removeEventListener("touchstart", onStart);
      node.removeEventListener("touchmove", onMove);
    };
  }, []);

  return (
    <div
      ref={host}
      className="pull-host"
      onPointerDown={(event) => {
        dragged.current = false;
        startY.current = event.clientY;
      }}
      onPointerMove={(event) => {
        if (Math.abs(event.clientY - startY.current) > dragSlop) {
          dragged.current = true;
        }
      }}
      onClickCapture={(event) => {
        if (!dragged.current) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        dragged.current = false;
      }}
    >
      <AntdPullToRefresh threshold={pullThreshold} onRefresh={onRefresh}>
        {children}
      </AntdPullToRefresh>
    </div>
  );
}

export { InfiniteScroll };

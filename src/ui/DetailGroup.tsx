import type { ReactNode } from "react";

export function DetailGroup({ children }: { children: ReactNode }) {
  return <div className="detail-group">{children}</div>;
}

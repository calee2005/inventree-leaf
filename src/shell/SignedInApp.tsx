import { useState } from "react";
import { Navigate, Outlet, createMemoryRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { CategoryScreen } from "../screens/CategoryScreen";
import { PartDetailScreen } from "../screens/PartDetailScreen";
import { PartPricingScreen } from "../screens/PartPricingScreen";
import { SupplierPartDetailScreen, SupplierPartListScreen } from "../screens/SupplierPartScreen";
import { PartsScreen } from "../screens/PartsScreen";
import { RecordListScreen } from "../screens/RecordListScreen";
import type { SessionUser } from "../types";
import { AppShell, type ShellView } from "./AppShell";
import { PageFrame } from "./PageFrame";

const signedInViews: ShellView[] = [
  { id: "parts", path: "/parts", title: "零件", color: "#2f78f6" },
  { id: "stock", path: "/stock", title: "库存", color: "#1f9d6a" },
  { id: "supplier", path: "/supplier", title: "供应商", color: "#e07a32" },
  { id: "customer", path: "/customer", title: "客户", color: "#c43d7a" },
  { id: "build", path: "/build", title: "生产订单", color: "#6f9f2a" },
  { id: "transfer", path: "/transfer", title: "调拨单", color: "#7c6cf0" },
  { id: "purchase", path: "/purchase", title: "采购订单", color: "#d64545" },
  { id: "sales", path: "/sales", title: "销售订单", color: "#1a9aaa" },
];

const recordViews: Record<string, { kind: string; emptyText: string }> = {
  stock: { kind: "stock", emptyText: "这里还没有库存。" },
  supplier: { kind: "supplier", emptyText: "这里还没有供应商。" },
  customer: { kind: "customer", emptyText: "这里还没有客户。" },
  build: { kind: "build", emptyText: "这里还没有生产订单。" },
  transfer: { kind: "transfer", emptyText: "这里还没有调拨单。" },
  purchase: { kind: "purchase", emptyText: "这里还没有采购订单。" },
  sales: { kind: "sales", emptyText: "这里还没有销售订单。" },
};

type Props = {
  serverId: string;
  user: SessionUser | null;
  onLoggedOut: () => void;
  onLeave: () => void;
};

const signedInChildren = [
  {
    path: "/parts",
    element: (
      <PageFrame>
        <PartsScreen />
      </PageFrame>
    ),
  },
  {
    path: "/parts/category/:categoryId",
    element: (
      <PageFrame back title="零件类别">
        <CategoryScreen />
      </PageFrame>
    ),
  },
  {
    path: "/parts/:partId/suppliers",
    element: (
      <PageFrame back title="供应商零件">
        <SupplierPartListScreen />
      </PageFrame>
    ),
  },
  {
    path: "/parts/supplier/:supplierPartId",
    element: (
      <PageFrame back title="供应商零件">
        <SupplierPartDetailScreen />
      </PageFrame>
    ),
  },
  {
    path: "/parts/:partId/pricing",
    element: (
      <PageFrame back title="零件价格">
        <PartPricingScreen />
      </PageFrame>
    ),
  },
  {
    path: "/parts/:partId",
    element: (
      <PageFrame back title="零件详情">
        <PartDetailScreen />
      </PageFrame>
    ),
  },
  ...Object.entries(recordViews).map(([id, view]) => ({
    path: `/${id}`,
    element: (
      <PageFrame>
        <RecordListScreen kind={view.kind} emptyText={view.emptyText} />
      </PageFrame>
    ),
  })),
  { path: "*", element: <Navigate to="/parts" replace /> },
];

export function SignedInApp({ serverId, user, onLoggedOut, onLeave }: Props) {
  const [router] = useState(() =>
    createMemoryRouter(
      [
        {
          element: (
            <AppShell
              serverId={serverId}
              user={user}
              views={signedInViews}
              onLoggedOut={onLoggedOut}
              onLeave={onLeave}
            >
              <Outlet />
            </AppShell>
          ),
          children: signedInChildren,
        },
      ],
      { initialEntries: ["/parts"] },
    ),
  );

  return <RouterProvider router={router} />;
}

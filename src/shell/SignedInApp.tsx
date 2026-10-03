import { useState } from "react";
import { Navigate, createMemoryRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { BomCreateScreen, BomLineScreen, BomListScreen } from "../screens/BomScreen";
import { CategoryScreen } from "../screens/CategoryScreen";
import { PartDetailScreen } from "../screens/PartDetailScreen";
import { PartFormScreen } from "../screens/PartFormScreen";
import { PartPricingScreen } from "../screens/PartPricingScreen";
import { SupplierPartDetailScreen, SupplierPartListScreen } from "../screens/SupplierPartScreen";
import { AboutScreen } from "../screens/AboutScreen";
import { PartsScreen } from "../screens/PartsScreen";
import { RecordListScreen } from "../screens/RecordListScreen";
import { StockItemFormScreen, StockLocationFormScreen } from "../screens/StockFormScreen";
import { StockItemScreen, StockLocationScreen } from "../screens/StockScreen";
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
    path: "/about",
    element: (
      <PageFrame back title="关于">
        <AboutScreen />
      </PageFrame>
    ),
  },
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
    path: "/parts/:partId/bom/new",
    element: (
      <PageFrame back title="添加物料">
        <BomCreateScreen />
      </PageFrame>
    ),
  },
  {
    path: "/parts/:partId/bom",
    element: (
      <PageFrame back title="物料清单">
        <BomListScreen usedIn={false} />
      </PageFrame>
    ),
  },
  {
    path: "/parts/:partId/used-in",
    element: (
      <PageFrame back title="用于装配">
        <BomListScreen usedIn />
      </PageFrame>
    ),
  },
  {
    path: "/parts/bom/:bomId",
    element: (
      <PageFrame back title="物料行">
        <BomLineScreen />
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
    path: "/parts/new",
    element: (
      <PageFrame back title="新零件">
        <PartFormScreen mode="create" />
      </PageFrame>
    ),
  },
  {
    path: "/parts/:partId/edit",
    element: (
      <PageFrame back title="编辑零件">
        <PartFormScreen mode="edit" />
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
    path: "/stock/location/new",
    element: (
      <PageFrame back title="新建仓储位置">
        <StockLocationFormScreen mode="create" />
      </PageFrame>
    ),
  },
  {
    path: "/stock/location/:locationId/edit",
    element: (
      <PageFrame back title="编辑位置">
        <StockLocationFormScreen mode="edit" />
      </PageFrame>
    ),
  },
  {
    path: "/stock/item/new",
    element: (
      <PageFrame back title="新建库存项">
        <StockItemFormScreen mode="create" />
      </PageFrame>
    ),
  },
  {
    path: "/stock/item/:itemId/edit",
    element: (
      <PageFrame back title="编辑库存项">
        <StockItemFormScreen mode="edit" />
      </PageFrame>
    ),
  },
  {
    path: "/stock/location/:locationId",
    element: (
      <PageFrame back title="库存地点">
        <StockLocationScreen />
      </PageFrame>
    ),
  },
  {
    path: "/stock/item/:itemId",
    element: (
      <PageFrame back title="库存项">
        <StockItemScreen />
      </PageFrame>
    ),
  },
  {
    path: "/stock",
    element: (
      <PageFrame>
        <StockLocationScreen />
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
            />
          ),
          children: signedInChildren,
        },
      ],
      { initialEntries: ["/parts"] },
    ),
  );

  return <RouterProvider router={router} />;
}

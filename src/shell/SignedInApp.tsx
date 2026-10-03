import { useState } from "react";
import { Navigate, createMemoryRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { BomCreateScreen, BomLineScreen, BomListScreen } from "../screens/BomScreen";
import { CategoryScreen } from "../screens/CategoryScreen";
import { PartDetailScreen } from "../screens/PartDetailScreen";
import { PartImageScreen } from "../screens/PartImageScreen";
import { PartFormScreen } from "../screens/PartFormScreen";
import { PartPricingScreen } from "../screens/PartPricingScreen";
import { CompanyFormScreen } from "../screens/CompanyFormScreen";
import { CustomerListScreen } from "../screens/CustomerScreen";
import { PurchaseOrderDetailScreen } from "../screens/PurchaseOrderScreen";
import {
  SalesOrderDetailScreen,
  SalesOrderListScreen,
  SalesShipmentListScreen,
  SalesShipmentScreen,
} from "../screens/SalesOrderScreen";
import { SupplierPartFormScreen } from "../screens/SupplierPartFormScreen";
import { SupplierPartDetailScreen, SupplierPartListScreen, SupplierPartStockScreen } from "../screens/SupplierPartScreen";
import {
  CompanyDetailScreen,
  CompanyOrderListScreen,
  CompanyPartListScreen,
  ManufacturerPartListScreen,
  ManufacturerPartScreen,
  SupplierListScreen,
} from "../screens/SupplierScreen";
import { AboutScreen } from "../screens/AboutScreen";
import { PartsScreen } from "../screens/PartsScreen";
import { BuildAllocationScreen, BuildDetailScreen, BuildLineScreen, BuildListScreen, BuildOutputScreen } from "../screens/BuildScreen";
import { PurchaseOrderListScreen } from "../screens/PurchaseOrderScreen";
import { TransferAllocationScreen, TransferDetailScreen, TransferLineScreen, TransferListScreen } from "../screens/TransferScreen";
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
    path: "/parts/supplier/new",
    element: (
      <PageFrame back title="添加供应商零件">
        <SupplierPartFormScreen />
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
    path: "/parts/:partId/image",
    element: (
      <PageFrame back title="零件图片">
        <PartImageScreen />
      </PageFrame>
    ),
  },
  {
    path: "/parts/:partId/duplicate",
    element: (
      <PageFrame back title="复制零件">
        <PartFormScreen mode="duplicate" />
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
    path: "/customer/new",
    element: (
      <PageFrame back title="添加客户">
        <CompanyFormScreen mode="create" role="customer" />
      </PageFrame>
    ),
  },
  {
    path: "/customer/:companyId/edit",
    element: (
      <PageFrame back title="编辑公司信息">
        <CompanyFormScreen mode="edit" role="customer" />
      </PageFrame>
    ),
  },
  {
    path: "/customer",
    element: (
      <PageFrame>
        <CustomerListScreen />
      </PageFrame>
    ),
  },
  {
    path: "/customer/:companyId/orders",
    element: (
      <PageFrame back title="销售订单">
        <SalesOrderListScreen />
      </PageFrame>
    ),
  },
  {
    path: "/customer/:companyId",
    element: (
      <PageFrame back title="公司">
        <CompanyDetailScreen />
      </PageFrame>
    ),
  },
  {
    path: "/sales/shipment/:shipmentId",
    element: (
      <PageFrame back title="配送">
        <SalesShipmentScreen />
      </PageFrame>
    ),
  },
  {
    path: "/sales/:orderId/shipments",
    element: (
      <PageFrame back title="配送">
        <SalesShipmentListScreen />
      </PageFrame>
    ),
  },
  {
    path: "/sales/:orderId",
    element: (
      <PageFrame back title="销售订单">
        <SalesOrderDetailScreen />
      </PageFrame>
    ),
  },
  {
    path: "/sales",
    element: (
      <PageFrame>
        <SalesOrderListScreen />
      </PageFrame>
    ),
  },
  {
    path: "/supplier/new",
    element: (
      <PageFrame back title="添加新公司">
        <CompanyFormScreen mode="create" role="supplier" />
      </PageFrame>
    ),
  },
  {
    path: "/supplier/:companyId/edit",
    element: (
      <PageFrame back title="编辑公司信息">
        <CompanyFormScreen mode="edit" role="supplier" />
      </PageFrame>
    ),
  },
  {
    path: "/supplier",
    element: (
      <PageFrame>
        <SupplierListScreen />
      </PageFrame>
    ),
  },
  {
    path: "/supplier/part/:supplierPartId/stock",
    element: (
      <PageFrame back title="可用库存">
        <SupplierPartStockScreen />
      </PageFrame>
    ),
  },
  {
    path: "/supplier/manufacturer-part/:manufacturerPartId",
    element: (
      <PageFrame back title="制造商零件">
        <ManufacturerPartScreen />
      </PageFrame>
    ),
  },
  {
    path: "/supplier/:companyId/parts",
    element: (
      <PageFrame back title="供应商零件">
        <CompanyPartListScreen />
      </PageFrame>
    ),
  },
  {
    path: "/supplier/:companyId/manufacturer-parts",
    element: (
      <PageFrame back title="制造商零件">
        <ManufacturerPartListScreen />
      </PageFrame>
    ),
  },
  {
    path: "/supplier/:companyId/orders",
    element: (
      <PageFrame back title="采购订单">
        <CompanyOrderListScreen />
      </PageFrame>
    ),
  },
  {
    path: "/supplier/:companyId",
    element: (
      <PageFrame back title="公司">
        <CompanyDetailScreen />
      </PageFrame>
    ),
  },
  {
    path: "/build/line/:lineId",
    element: (
      <PageFrame back title="行项目">
        <BuildLineScreen />
      </PageFrame>
    ),
  },
  {
    path: "/build/:buildId/allocations",
    element: (
      <PageFrame back title="已分配库存">
        <BuildAllocationScreen />
      </PageFrame>
    ),
  },
  {
    path: "/build/:buildId/outputs",
    element: (
      <PageFrame back title="构建输出">
        <BuildOutputScreen />
      </PageFrame>
    ),
  },
  {
    path: "/build/:buildId",
    element: (
      <PageFrame back title="生产订单">
        <BuildDetailScreen />
      </PageFrame>
    ),
  },
  {
    path: "/build",
    element: (
      <PageFrame>
        <BuildListScreen />
      </PageFrame>
    ),
  },
  {
    path: "/transfer/line/:lineId/allocations",
    element: (
      <PageFrame back title="已分配库存">
        <TransferAllocationScreen />
      </PageFrame>
    ),
  },
  {
    path: "/transfer/line/:lineId",
    element: (
      <PageFrame back title="行项目">
        <TransferLineScreen />
      </PageFrame>
    ),
  },
  {
    path: "/transfer/:orderId",
    element: (
      <PageFrame back title="调拨单">
        <TransferDetailScreen />
      </PageFrame>
    ),
  },
  {
    path: "/transfer",
    element: (
      <PageFrame>
        <TransferListScreen />
      </PageFrame>
    ),
  },
  {
    path: "/purchase",
    element: (
      <PageFrame>
        <PurchaseOrderListScreen />
      </PageFrame>
    ),
  },
  {
    path: "/purchase/:orderId",
    element: (
      <PageFrame back title="采购订单">
        <PurchaseOrderDetailScreen />
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

import type { CommandFailure } from "./types";

export {
  createBomItem,
  clearPartImage,
  createPart,
  createBomSubstitute,
  currentUser,
  deleteBomItem,
  deleteBomSubstitute,
  deleteServer,
  getBomItem,
  getPart,
  getPartCategory,
  getPartPricing,
  getCompany,
  getManufacturerPart,
  getPurchaseOrder,
  getSupplierPart,
  listBom,
  listPartCategories,
  listStockLocations,
  listStockLocationLevel,
  listLocationStock,
  getStockLocation,
  getStockItem,
  createStockItem,
  updateStockItem,
  deleteStockItem,
  createStockLocation,
  updateStockLocation,
  deleteStockLocation,
  searchPartCategories,
  searchStockLocations,
  listPartStock,
  listCompanies,
  listManufacturerParts,
  listParts,
  listRecords,
  listServers,
  countOutstandingPurchaseOrders,
  listPurchaseOrderExtraLines,
  listPurchaseOrderLines,
  listPurchaseOrders,
  listSupplierPartStock,
  listSupplierParts,
  loadPartImage,
  loadPartThumbnail,
  login,
  logout,
  saveServer,
  serverStatus,
  selectServer,
  testConnection,
  updateBomItem,
  updatePart,
  uploadPartImage,
  validateBomItem,
} from "./browser/client";

export function readError(error: unknown): CommandFailure {
  if (typeof error === "object" && error !== null && "message" in error) {
    const record = error as { kind?: unknown; message?: unknown };
    if (typeof record.message === "string") {
      return {
        kind: typeof record.kind === "string" ? record.kind : "unknown",
        message: record.message,
      };
    }
  }
  if (typeof error === "string" && error.length > 0) {
    return { kind: "unknown", message: error };
  }
  return { kind: "unknown", message: "操作失败" };
}

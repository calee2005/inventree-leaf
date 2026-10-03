import { invoke } from "@tauri-apps/api/core";
import type {
  CategoryPage,
  PartCategory,
  CommandFailure,
  PartDetail,
  PartPage,
  PartPriceDetail,
  BomItemWrite,
  BomLine,
  BomPage,
  BomSubstitute,
  PartStockPage,
  SupplierPartDetail,
  SupplierPartPage,
  RecordPage,
  ServerInfo,
  ServerView,
  SessionUser,
} from "./types";

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

export function listServers() {
  return invoke<ServerView[]>("list_servers");
}

export function saveServer(input: {
  id?: string | null;
  name: string;
  server: string;
  trustedCertificate: boolean;
}) {
  return invoke<ServerView>("save_server", {
    id: input.id ?? null,
    name: input.name,
    server: input.server,
    trustedCertificate: input.trustedCertificate,
  });
}

export function deleteServer(id: string) {
  return invoke<void>("delete_server", { id });
}

export function selectServer(id: string) {
  return invoke<ServerView>("select_server", { id });
}

export function testConnection(id: string) {
  return invoke<ServerInfo>("test_connection", { id });
}

export function login(id: string, username: string, password: string) {
  return invoke<SessionUser>("login", { id, username, password });
}

export function logout(id: string) {
  return invoke<void>("logout", { id });
}

export function currentUser(id: string) {
  return invoke<SessionUser>("current_user", { id });
}

export function listParts(id: string, category: number | null, search: string, offset: number) {
  return invoke<PartPage>("list_parts", {
    id,
    category,
    search: search.trim() ? search.trim() : null,
    offset,
  });
}

export function getPartPricing(id: string, pk: number) {
  return invoke<PartPriceDetail>("get_part_pricing", { id, pk });
}

export function getPartCategory(id: string, pk: number) {
  return invoke<PartCategory>("get_part_category", { id, pk });
}

export function getPart(id: string, pk: number) {
  return invoke<PartDetail>("get_part", { id, pk });
}

export function listBom(id: string, part: number, usedIn: boolean, offset: number) {
  return invoke<BomPage>("list_bom", { id, part, usedIn, offset });
}

export function getBomItem(id: string, pk: number) {
  return invoke<BomLine>("get_bom_item", { id, pk });
}

export function createBomItem(id: string, input: BomItemWrite) {
  return invoke<BomLine>("create_bom_item", { id, input });
}

export function updateBomItem(id: string, pk: number, input: BomItemWrite) {
  return invoke<BomLine>("update_bom_item", { id, pk, input });
}

export function deleteBomItem(id: string, pk: number) {
  return invoke<void>("delete_bom_item", { id, pk });
}

export function validateBomItem(id: string, pk: number, valid: boolean) {
  return invoke<void>("validate_bom_item", { id, pk, valid });
}

export function createBomSubstitute(id: string, bomItem: number, part: number) {
  return invoke<BomSubstitute>("create_bom_substitute", { id, bomItem, part });
}

export function deleteBomSubstitute(id: string, pk: number) {
  return invoke<void>("delete_bom_substitute", { id, pk });
}

export function listSupplierParts(id: string, part: number, offset: number) {
  return invoke<SupplierPartPage>("list_supplier_parts", { id, part, offset });
}

export function getSupplierPart(id: string, pk: number) {
  return invoke<SupplierPartDetail>("get_supplier_part", { id, pk });
}

export function listPartStock(id: string, pk: number, offset: number) {
  return invoke<PartStockPage>("list_part_stock", { id, pk, offset });
}

export function listPartCategories(id: string, parent: number | null, offset: number) {
  return invoke<CategoryPage>("list_part_categories", { id, parent, offset });
}

export function listRecords(id: string, kind: string, search: string, offset: number) {
  return invoke<RecordPage>("list_records", {
    id,
    kind,
    search: search.trim() ? search.trim() : null,
    offset,
  });
}

export function loadPartImage(id: string, image: string) {
  return invoke<string>("load_part_image", { id, image });
}

export function loadPartThumbnail(id: string, thumbnail: string) {
  return invoke<string>("load_part_thumbnail", { id, thumbnail });
}

import { invoke } from "@tauri-apps/api/core";
import type {
  CategoryPage,
  CommandFailure,
  PartDetail,
  PartPage,
  PartStockPage,
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

export function getPart(id: string, pk: number) {
  return invoke<PartDetail>("get_part", { id, pk });
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

export function loadPartThumbnail(id: string, thumbnail: string) {
  return invoke<string>("load_part_thumbnail", { id, thumbnail });
}

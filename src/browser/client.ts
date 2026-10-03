import { rememberCompany, rememberPart } from "./recent";
import type {
  CompanyDetail,
  CompanyPage,
  CompanySummary,
  CompanyWrite,
  ManufacturerPartDetail,
  ManufacturerPartSummary,
  PurchaseOrderDetail,
  PurchaseOrderExtraLine,
  PurchaseOrderLine,
  PurchaseOrderSummary,
  SalesOrderDetail,
  SalesOrderLine,
  SalesOrderShipment,
  SalesOrderSummary,
  BuildAllocation,
  BuildDetail,
  BuildLine,
  OrderSummary,
  TransferAllocation,
  TransferLine,
  TransferOrderDetail,
  BomItemWrite,
  BomLine,
  BomPage,
  BomSubstitute,
  CategoryPage,
  CategorySummary,
  PartCategory,
  LookupHit,
  PartDetail,
  PartPage,
  PartWrite,
  PartParameter,
  PartPriceDetail,
  PartStockPage,
  PartSummary,
  RecordPage,
  RecordSummary,
  ServerInfo,
  ServerView,
  SessionUser,
  StockItemDetail,
  StockItemPage,
  StockItemWrite,
  StockLocationDetail,
  StockLocationPage,
  StockLocationSummary,
  StockLocationWrite,
  SupplierPartDetail,
  SupplierPartWrite,
  SupplierPartPage,
  SupplierPartSummary,
} from "../types";

const PAGE_LIMIT = 50;
const MIN_API = 180;
const NEW_USER_API = 490;
const TOKEN_NAME = "inventree-leaf";
const STORE_KEY = "inventree-leaf";
const MAX_THUMB_BYTES = 2 * 1024 * 1024;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

type Fail = { kind: string; message: string };
type Json = Record<string, unknown>;
type ServerRecord = {
  id: string;
  name: string;
  server: string;
  trustedCertificate: boolean;
  selected: boolean;
};
type Disk = {
  servers: ServerRecord[];
  tokens: Record<string, string>;
  usernames: Record<string, string>;
};

function fail(kind: string, message: string): Fail {
  return { kind, message };
}

function readDisk(): Disk {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) {
      return { servers: [], tokens: {}, usernames: {} };
    }
    const parsed = JSON.parse(raw) as Partial<Disk>;
    return {
      servers: Array.isArray(parsed.servers) ? parsed.servers : [],
      tokens: parsed.tokens ?? {},
      usernames: parsed.usernames ?? {},
    };
  } catch {
    return { servers: [], tokens: {}, usernames: {} };
  }
}

function writeDisk(disk: Disk) {
  localStorage.setItem(
    STORE_KEY,
    JSON.stringify({
      servers: disk.servers.map((server) => ({
        id: server.id,
        name: server.name,
        server: server.server,
        trustedCertificate: server.trustedCertificate,
        selected: server.selected,
      })),
      tokens: disk.tokens,
      usernames: disk.usernames,
    }),
  );
}

function viewOf(record: ServerRecord, disk: Disk): ServerView {
  const token = disk.tokens[record.id] ?? "";
  const hasToken = token.length > 0;
  return {
    ...record,
    hasToken,
    username: hasToken ? disk.usernames[record.id] ?? "" : "",
  };
}

function requireServer(id: string): ServerRecord {
  const found = readDisk().servers.find((item) => item.id === id);
  if (!found) {
    throw fail("notFound", "找不到这台服务器");
  }
  return found;
}

function tokenFor(id: string): string {
  const token = readDisk().tokens[id] ?? "";
  if (!token) {
    throw fail("notLoggedIn", "尚未登录这台服务器");
  }
  return token;
}

function clearToken(id: string) {
  const disk = readDisk();
  delete disk.tokens[id];
  delete disk.usernames[id];
  writeDisk(disk);
}

export function normalizeBase(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    throw fail("invalid", "请填写服务器地址");
  }
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw fail("invalid", "地址需要以 http:// 或 https:// 开头");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw fail("invalid", "只支持 http 或 https");
  }
  if (url.username || url.password) {
    throw fail("invalid", "请不要把用户名和密码写在地址里");
  }
  let path = url.pathname.replace(/\/+$/, "");
  if (path.endsWith("/api")) {
    path = path.slice(0, -4);
  }
  url.pathname = path ? `${path}/` : "/";
  url.search = "";
  url.hash = "";
  return url.toString();
}

function apiUrl(base: string, path: string): string {
  return new URL(path.replace(/^\//, ""), normalizeBase(base)).toString();
}

function withQuery(url: string, pairs: Array<[string, string]>): string {
  const next = new URL(url);
  for (const [key, value] of pairs) {
    next.searchParams.append(key, value);
  }
  return next.toString();
}

async function request(
  url: string,
  init: { token?: string; basic?: string; method?: string; json?: unknown; form?: FormData } = {},
): Promise<unknown> {
  const headers = new Headers({ Accept: "application/json" });
  if (init.token) {
    headers.set("Authorization", `Token ${init.token}`);
  }
  if (init.basic) {
    headers.set("Authorization", init.basic);
  }
  if (init.json !== undefined) {
    headers.set("Content-Type", "application/json");
  }
  let response: Response;
  try {
    response = await fetch(url, {
      method: init.method ?? (init.json !== undefined || init.form ? "POST" : "GET"),
      headers,
      body: init.form ?? (init.json !== undefined ? JSON.stringify(init.json) : undefined),
    });
  } catch {
    throw fail("network", "网络错误");
  }
  const text = await response.text();
  if (!response.ok) {
    throw fail(statusKind(response.status), detailMessage(text, response.status));
  }
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw fail("missingData", "服务器响应不是 JSON");
  }
}

function statusKind(status: number): string {
  if (status === 401) {
    return "unauthorized";
  }
  if (status === 403) {
    return "forbidden";
  }
  return "http";
}

function detailMessage(body: string, status: number): string {
  try {
    const parsed = JSON.parse(body) as unknown;
    const lines: string[] = [];
    collectMessages(parsed, lines);
    if (lines.length > 0) {
      return lines.join("\n");
    }
  } catch {
    // 非 JSON 错误正文
  }
  return `服务器返回 ${status}`;
}

function collectMessages(value: unknown, lines: string[]) {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed) {
      lines.push(trimmed);
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectMessages(item, lines));
    return;
  }
  const object = asObject(value);
  if (!object) {
    return;
  }
  const detail = object.detail;
  if (detail !== undefined) {
    collectMessages(detail, lines);
  }
  for (const [key, item] of Object.entries(object)) {
    if (key !== "detail") {
      collectMessages(item, lines);
    }
  }
}

async function authed(id: string, url: string, init: { method?: string; json?: unknown; form?: FormData } = {}) {
  const token = tokenFor(id);
  try {
    return await request(url, { ...init, token });
  } catch (error) {
    if (isFail(error) && error.kind === "unauthorized") {
      clearToken(id);
    }
    throw error;
  }
}

function isFail(error: unknown): error is Fail {
  return typeof error === "object" && error !== null && "kind" in error && "message" in error;
}

function asObject(value: unknown): Json | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Json) : null;
}

function text(value: unknown, key: string): string {
  const item = asObject(value)?.[key];
  return typeof item === "string" ? item : "";
}

function nested(value: unknown, objectKey: string, field: string): string {
  return text(asObject(value)?.[objectKey], field);
}

function firstText(values: string[]): string {
  return values.find((item) => item.trim()) ?? "";
}

function num(value: unknown, key: string): number {
  const item = asObject(value)?.[key];
  if (typeof item === "number" && Number.isFinite(item)) {
    return item;
  }
  if (typeof item === "string") {
    const parsed = Number(item);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function bool(value: unknown, key: string, fallback: boolean): boolean {
  const item = asObject(value)?.[key];
  return typeof item === "boolean" ? item : fallback;
}

function idOf(value: unknown, key: string): number | null {
  const parsed = num(value, key);
  return parsed > 0 ? parsed : null;
}

function pageItems(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }
  const results = asObject(value)?.results;
  return Array.isArray(results) ? results : [];
}

function pageCount(value: unknown, results: unknown[]): number {
  const count = asObject(value)?.count;
  return typeof count === "number" ? count : results.length;
}

function trimDecimal(raw: string): string {
  const textValue = raw.trim();
  if (!textValue.includes(".")) {
    return textValue;
  }
  const trimmed = textValue.replace(/0+$/, "").replace(/\.$/, "");
  return !trimmed || trimmed === "-" ? "0" : trimmed;
}

function decimalText(value: unknown, key: string): string {
  const item = asObject(value)?.[key];
  if (typeof item === "string") {
    return trimDecimal(item);
  }
  if (typeof item === "number") {
    return trimDecimal(String(item));
  }
  return "";
}

function priceRange(min: string, max: string, currency: string): string {
  const left = min.trim();
  const right = max.trim();
  const amount =
    !left && !right ? "" : !left || !right || left === right ? left || right : `${left} – ${right}`;
  if (!amount) {
    return "";
  }
  return currency ? `${currency} ${amount}` : amount;
}

function pricedRange(value: unknown, minKey: string, maxKey: string): string {
  const currency = text(value, "currency").trim();
  return priceRange(decimalText(value, minKey), decimalText(value, maxKey), currency) || "-";
}

export async function listServers(): Promise<ServerView[]> {
  const disk = readDisk();
  return disk.servers.map((server) => viewOf(server, disk));
}

export async function saveServer(input: {
  id?: string | null;
  name: string;
  server: string;
  trustedCertificate: boolean;
}): Promise<ServerView> {
  const name = input.name.trim();
  if (!name) {
    throw fail("invalid", "请填写显示名");
  }
  const server = normalizeBase(input.server);
  const disk = readDisk();
  if (disk.servers.some((item) => item.name === name && item.id !== input.id)) {
    throw fail("invalid", "已经有同名服务器");
  }
  const existing = input.id ? disk.servers.find((item) => item.id === input.id) : undefined;
  if (input.id && !existing) {
    throw fail("notFound", "找不到这台服务器");
  }
  const record: ServerRecord = existing
    ? { ...existing, name, server, trustedCertificate: input.trustedCertificate }
    : {
        id: crypto.randomUUID(),
        name,
        server,
        trustedCertificate: input.trustedCertificate,
        selected: !disk.servers.some((item) => item.selected),
      };
  if (record.selected) {
    disk.servers = disk.servers.map((item) => ({ ...item, selected: false }));
  }
  const index = disk.servers.findIndex((item) => item.id === record.id);
  if (index >= 0) {
    disk.servers[index] = record;
  } else {
    disk.servers.push(record);
  }
  writeDisk(disk);
  return viewOf(record, disk);
}

export async function deleteServer(id: string) {
  const disk = readDisk();
  if (!disk.servers.some((item) => item.id === id)) {
    throw fail("notFound", "找不到这台服务器");
  }
  disk.servers = disk.servers.filter((item) => item.id !== id);
  delete disk.tokens[id];
  delete disk.usernames[id];
  writeDisk(disk);
}

export async function selectServer(id: string): Promise<ServerView> {
  const disk = readDisk();
  if (!disk.servers.some((item) => item.id === id)) {
    throw fail("notFound", "找不到这台服务器");
  }
  disk.servers = disk.servers.map((item) => ({ ...item, selected: item.id === id }));
  writeDisk(disk);
  const record = disk.servers.find((item) => item.id === id);
  if (!record) {
    throw fail("notFound", "找不到这台服务器");
  }
  return viewOf(record, disk);
}

export async function testConnection(id: string): Promise<ServerInfo> {
  return fetchServerInfo(requireServer(id).server);
}

export async function serverStatus(id: string): Promise<ServerInfo> {
  const base = requireServer(id).server;
  const value = await authed(id, apiUrl(base, "api/"));
  return parseServerInfo(value);
}

async function fetchServerInfo(base: string): Promise<ServerInfo> {
  return parseServerInfo(await request(apiUrl(base, "api/")));
}

function parseServerInfo(payload: unknown): ServerInfo {
  const value = asObject(payload);
  const version = text(value, "version").trim();
  if (!version) {
    throw fail("missingData", "响应里没有服务器版本");
  }
  const apiVersion = value?.apiVersion;
  if (typeof apiVersion !== "number") {
    throw fail("missingData", "响应里没有 API 版本");
  }
  if (apiVersion < MIN_API) {
    throw fail("oldApi", `服务器 API 版本 ${apiVersion} 低于最低要求 ${MIN_API}`);
  }
  return {
    version,
    apiVersion,
    instance: text(value, "instance"),
    pluginsEnabled: optionalBool(value, "plugins_enabled"),
    workerRunning: optionalBool(value, "worker_running"),
  };
}

function optionalBool(value: Json | null, key: string): boolean | null {
  const item = value?.[key];
  return typeof item === "boolean" ? item : null;
}

export async function login(id: string, username: string, password: string): Promise<SessionUser> {
  const userName = username.trim();
  const pass = password.trim();
  if (!userName || !pass) {
    throw fail("invalid", "请填写用户名和密码");
  }
  const base = requireServer(id).server;
  const info = await fetchServerInfo(base);
  const tokenPath = info.apiVersion >= NEW_USER_API ? "api/user/me/token/" : "api/user/token/";
  const tokenBody = asObject(
    await request(`${apiUrl(base, tokenPath)}?name=${TOKEN_NAME}`, {
      basic: basicHeader(userName, pass),
    }),
  );
  const token = text(tokenBody, "token").trim();
  if (!token) {
    throw fail("missingData", "登录响应里没有 token");
  }
  const user = await fetchMe(base, token);
  const disk = readDisk();
  disk.tokens[id] = token;
  disk.usernames[id] = user.username;
  writeDisk(disk);
  return user;
}

function basicHeader(username: string, password: string): string {
  const bytes = new TextEncoder().encode(`${username}:${password}`);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return `Basic ${btoa(binary)}`;
}

async function fetchMe(base: string, token: string): Promise<SessionUser> {
  const value = asObject(await request(apiUrl(base, "api/user/me/"), { token }));
  const pk = asObject(value)?.pk;
  if (typeof pk !== "number") {
    throw fail("missingData", "用户信息里没有 pk");
  }
  return {
    pk,
    username: text(value, "username"),
    email: text(value, "email"),
    firstName: text(value, "first_name"),
    lastName: text(value, "last_name"),
  };
}

export async function logout(id: string) {
  clearToken(id);
}

export async function currentUser(id: string): Promise<SessionUser> {
  const base = requireServer(id).server;
  const token = tokenFor(id);
  try {
    const user = await fetchMe(base, token);
    const disk = readDisk();
    disk.tokens[id] = token;
    disk.usernames[id] = user.username;
    writeDisk(disk);
    return user;
  } catch (error) {
    if (isFail(error) && error.kind === "unauthorized") {
      clearToken(id);
    }
    throw error;
  }
}

export async function listParts(
  id: string,
  category: number | null,
  search: string,
  offset: number,
  options?: { ordering?: string; allCategories?: boolean },
): Promise<PartPage> {
  const base = requireServer(id).server;
  const query = search.trim();
  const pairs: Array<[string, string]> = [
    ["limit", String(PAGE_LIMIT)],
    ["offset", String(offset)],
  ];
  if (options?.ordering) {
    pairs.push(["ordering", options.ordering]);
  }
  if (!query && !options?.allCategories) {
    pairs.push(["category", category === null ? "null" : String(category)]);
  } else if (query && category !== null) {
    pairs.push(["category", String(category)], ["cascade", "true"], ["search", query]);
  } else if (query) {
    pairs.push(["search", query]);
  }
  const value = await authed(id, withQuery(apiUrl(base, "api/part/"), pairs));
  const results = pageItems(value).flatMap((item) => {
    const pk = idOf(item, "pk");
    if (!pk) {
      return [];
    }
    const summary: PartSummary = {
      pk,
      name: text(item, "name"),
      ipn: text(item, "IPN"),
      description: text(item, "description"),
      inStock: num(item, "in_stock"),
      units: text(item, "units"),
      thumbnail: text(item, "thumbnail"),
    };
    return [summary];
  });
  return { count: pageCount(value, results), results };
}

export async function listPartCategories(id: string, parent: number | null, offset: number): Promise<CategoryPage> {
  const base = requireServer(id).server;
  const pairs: Array<[string, string]> = [
    ["limit", String(PAGE_LIMIT)],
    ["offset", String(offset)],
    parent === null ? ["top_level", "true"] : ["parent", String(parent)],
  ];
  const value = await authed(id, withQuery(apiUrl(base, "api/part/category/"), pairs));
  const results = pageItems(value).flatMap((item) => {
    const pk = idOf(item, "pk");
    if (!pk) {
      return [];
    }
    const summary: CategorySummary = {
      pk,
      name: text(item, "name"),
      pathstring: text(item, "pathstring"),
      partCount: num(item, "part_count"),
    };
    return [summary];
  });
  return { count: pageCount(value, results), results };
}

export async function getPartCategory(id: string, pk: number): Promise<PartCategory> {
  const base = requireServer(id).server;
  const value = asObject(await authed(id, apiUrl(base, `api/part/category/${pk}/`)));
  const found = idOf(value, "pk");
  if (!found) {
    throw fail("missingData", "类别详情里没有 pk");
  }
  const pathstring = text(value, "pathstring");
  const segments = pathstring.split("/").filter((item) => item.trim());
  segments.pop();
  return {
    pk: found,
    name: text(value, "name"),
    description: text(value, "description"),
    parentId: idOf(value, "parent"),
    parentPath: segments.join("/"),
    partCount: num(value, "part_count"),
    subcategoryCount: num(value, "subcategories"),
  };
}

function parseParameters(value: unknown): PartParameter[] {
  const items = asObject(value)?.parameters;
  if (!Array.isArray(items)) {
    return [];
  }
  return items.flatMap((item) => {
    const name = nested(item, "template_detail", "name");
    if (!name.trim()) {
      return [];
    }
    return [{ name, value: text(item, "data"), units: nested(item, "template_detail", "units") }];
  });
}

function parsePartDetail(value: unknown): PartDetail {
  const pk = idOf(value, "pk");
  if (!pk) {
    throw fail("missingData", "零件详情里没有 pk");
  }
  const name = text(value, "name");
  const fullName = text(value, "full_name").trim() || name;
  const categoryName = text(value, "category_name").trim() || nested(value, "category_detail", "name");
  const location = nested(value, "default_location_detail", "pathstring").trim()
    || nested(value, "default_location_detail", "name");
  return {
    pk,
    name,
    fullName,
    description: text(value, "description"),
    ipn: text(value, "IPN"),
    revision: text(value, "revision"),
    thumbnail: text(value, "thumbnail"),
    image: text(value, "image"),
    units: text(value, "units"),
    active: bool(value, "active", true),
    assembly: bool(value, "assembly", false),
    component: bool(value, "component", false),
    purchaseable: bool(value, "purchaseable", false),
    salable: bool(value, "salable", false),
    inStock: num(value, "in_stock"),
    categoryName,
    categoryId: idOf(value, "category"),
    location,
    locationId: idOf(value, "default_location"),
    trackable: bool(value, "trackable", false),
    virtual: bool(value, "virtual", false),
    locked: bool(value, "locked", false),
    testable: bool(value, "testable", false),
    consumable: bool(value, "consumable", false),
    keywords: text(value, "keywords"),
    link: text(value, "link"),
    notes: text(value, "notes"),
    templatePk: idOf(value, "variant_of"),
    templateName: "",
    templateThumbnail: "",
    variantCount: 0,
    bomCount: 0,
    usedInCount: 0,
    supplierCount: 0,
    attachmentCount: 0,
    building: num(value, "building"),
    scheduledToBuild: num(value, "scheduled_to_build"),
    canBuild: null,
    allocatedToBuild: num(value, "allocated_to_build_orders"),
    requiredForBuild: num(value, "required_for_build_orders"),
    allocatedToSales: num(value, "allocated_to_sales_orders"),
    requiredForSales: num(value, "required_for_sales_orders"),
    ordering: num(value, "ordering"),
    priceLabel: null,
    isTemplate: bool(value, "is_template", false),
    parameters: parseParameters(value),
  };
}

async function optionalJson(id: string, url: string | null): Promise<unknown | null> {
  if (!url) {
    return null;
  }
  try {
    return await request(url, { token: tokenFor(id) });
  } catch {
    return null;
  }
}

async function optionalCount(id: string, url: string | null): Promise<number> {
  const value = await optionalJson(id, url);
  if (!value) {
    return 0;
  }
  const count = asObject(value)?.count;
  if (typeof count === "number") {
    return count;
  }
  return Array.isArray(value) ? value.length : 0;
}

export async function getPart(id: string, pk: number): Promise<PartDetail> {
  const base = requireServer(id).server;
  const detail = parsePartDetail(
    await authed(
      id,
      withQuery(apiUrl(base, `api/part/${pk}/`), [
        ["category_detail", "true"],
        ["location_detail", "true"],
        ["parameters", "true"],
      ]),
    ),
  );
  const countUrl = (path: string, key: string) =>
    withQuery(apiUrl(base, path), [
      ["limit", "1"],
      ["offset", "0"],
      [key, String(pk)],
    ]);
  const [template, variantCount, bomCount, usedInCount, supplierCount, attachmentCount, pricing, requirements] =
    await Promise.all([
      optionalJson(id, detail.templatePk ? apiUrl(base, `api/part/${detail.templatePk}/`) : null),
      optionalCount(id, countUrl("api/part/", "variant_of")),
      detail.assembly ? optionalCount(id, countUrl("api/part/", "in_bom_for")) : 0,
      detail.component ? optionalCount(id, countUrl("api/bom/", "uses")) : 0,
      detail.purchaseable ? optionalCount(id, countUrl("api/company/part/", "part")) : 0,
      optionalCount(
        id,
        withQuery(apiUrl(base, "api/attachment/"), [
          ["limit", "1"],
          ["offset", "0"],
          ["model_type", "part"],
          ["model_id", String(pk)],
        ]),
      ),
      optionalJson(id, apiUrl(base, `api/part/${pk}/pricing/`)),
      optionalJson(id, apiUrl(base, `api/part/${pk}/requirements/`)),
    ]);
  if (template) {
    try {
      const parent = parsePartDetail(template);
      detail.templateName = parent.fullName;
      detail.templateThumbnail = parent.thumbnail;
    } catch {
      // 模板零件拿不到时，详情页仍展示当前零件。
    }
  }
  detail.variantCount = variantCount;
  detail.bomCount = bomCount;
  detail.usedInCount = usedInCount;
  detail.supplierCount = supplierCount;
  detail.attachmentCount = attachmentCount;
  if (pricing) {
    const currency = text(pricing, "currency").trim();
    const label = priceRange(decimalText(pricing, "overall_min"), decimalText(pricing, "overall_max"), currency);
    detail.priceLabel = label || null;
  }
  if (requirements && asObject(requirements)) {
    detail.building = num(requirements, "building");
    detail.scheduledToBuild = num(requirements, "scheduled_to_build");
    detail.canBuild = num(requirements, "can_build");
    detail.ordering = num(requirements, "ordering");
    detail.allocatedToBuild = num(requirements, "allocated_to_build_orders");
    detail.requiredForBuild = num(requirements, "required_for_build_orders");
    detail.allocatedToSales = num(requirements, "allocated_to_sales_orders");
    detail.requiredForSales = num(requirements, "required_for_sales_orders");
  }
  rememberPart(id, {
    pk: detail.pk,
    name: detail.name,
    ipn: detail.ipn,
    description: detail.description,
    inStock: detail.inStock,
    units: detail.units,
    thumbnail: detail.thumbnail,
  });
  return detail;
}

function partBody(input: PartWrite) {
  return {
    name: input.name.trim(),
    description: input.description,
    IPN: input.ipn,
    revision: input.revision,
    keywords: input.keywords,
    link: input.link.trim(),
    category: input.category,
    default_location: input.defaultLocation,
    units: input.units,
    active: input.active,
    assembly: input.assembly,
    component: input.component,
    purchaseable: input.purchaseable,
    salable: input.salable,
    trackable: input.trackable,
    is_template: input.isTemplate,
    virtual: input.virtual,
    testable: input.testable,
    consumable: input.consumable,
    locked: input.locked,
    copy_category_parameters: input.copyCategoryParameters,
    ...(input.duplicate
      ? {
          duplicate: {
            original: input.duplicate.original,
            copy_image: input.duplicate.copyImage,
            copy_bom: input.duplicate.copyBom,
            copy_notes: input.duplicate.copyNotes,
            copy_parameters: input.duplicate.copyParameters,
            copy_tests: input.duplicate.copyTests,
          },
        }
      : {}),
  };
}

function requirePartWrite(input: PartWrite) {
  if (!input.name.trim()) {
    throw fail("invalid", "请填写名称");
  }
  const link = input.link.trim();
  if (link && !/^https?:\/\//i.test(link)) {
    throw fail("invalid", "链接需要以 http:// 或 https:// 开头");
  }
}

export async function createPart(id: string, input: PartWrite): Promise<number> {
  requirePartWrite(input);
  const value = await authed(id, apiUrl(requireServer(id).server, "api/part/"), {
    method: "POST",
    json: partBody(input),
  });
  const pk = idOf(value, "pk");
  if (!pk) {
    throw fail("missingData", "新零件里没有 pk");
  }
  return pk;
}

export async function uploadPartImage(id: string, pk: number, file: Blob, filename: string) {
  if (pk <= 0) {
    throw fail("invalid", "零件不存在");
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw fail("invalid", "图片太大");
  }
  const form = new FormData();
  form.append("image", file, filename);
  await authed(id, apiUrl(requireServer(id).server, `api/part/${pk}/`), { method: "PATCH", form });
}

export async function clearPartImage(id: string, pk: number) {
  if (pk <= 0) {
    throw fail("invalid", "零件不存在");
  }
  await authed(id, apiUrl(requireServer(id).server, `api/part/${pk}/`), {
    method: "PATCH",
    json: { image: null },
  });
}

export async function updatePart(id: string, pk: number, input: PartWrite) {
  if (pk <= 0) {
    throw fail("invalid", "零件不存在");
  }
  requirePartWrite(input);
  await authed(id, apiUrl(requireServer(id).server, `api/part/${pk}/`), {
    method: "PATCH",
    json: partBody(input),
  });
}

export async function listStockLocations(id: string, offset: number): Promise<{ count: number; results: LookupHit[] }> {
  const value = await authed(
    id,
    withQuery(apiUrl(requireServer(id).server, "api/stock/location/"), [
      ["limit", String(PAGE_LIMIT)],
      ["offset", String(offset)],
      ["ordering", "pathstring"],
    ]),
  );
  const results = pageItems(value).flatMap((item) => {
    const pk = idOf(item, "pk");
    if (!pk) {
      return [];
    }
    const hit: LookupHit = {
      pk,
      name: text(item, "name"),
      pathstring: text(item, "pathstring"),
    };
    return [hit];
  });
  return { count: pageCount(value, results), results };
}

export async function listStockLocationLevel(
  id: string,
  parent: number | null,
  offset: number,
  search = "",
): Promise<StockLocationPage> {
  const pairs: Array<[string, string]> = [
    ["limit", String(PAGE_LIMIT)],
    ["offset", String(offset)],
    ["ordering", "name"],
    parent === null ? ["top_level", "true"] : ["parent", String(parent)],
  ];
  if (search.trim()) {
    pairs.push(["search", search.trim()]);
  }
  const value = await authed(id, withQuery(apiUrl(requireServer(id).server, "api/stock/location/"), pairs));
  const results = pageItems(value).flatMap(parseLocationSummary);
  return { count: pageCount(value, results), results };
}

export async function getStockLocation(id: string, pk: number): Promise<StockLocationDetail> {
  const value = asObject(await authed(id, apiUrl(requireServer(id).server, `api/stock/location/${pk}/`)));
  const summary = parseLocationSummary(value)[0];
  if (!summary) {
    throw fail("missingData", "库存地点里没有 pk");
  }
  const pathstring = summary.pathstring;
  const segments = pathstring.split("/").filter((item) => item.trim());
  segments.pop();
  return { ...summary, parentId: idOf(value, "parent"), parentPath: segments.join("/"), structural: bool(value, "structural", false), external: bool(value, "external", false) };
}

export async function listLocationStock(
  id: string,
  location: number | null,
  offset: number,
  search = "",
): Promise<StockItemPage> {
  const pairs: Array<[string, string]> = [
    ["limit", String(PAGE_LIMIT)],
    ["offset", String(offset)],
    ["location", location === null ? "null" : String(location)],
    ["in_stock", "true"],
    ["cascade", "true"],
    ["part_detail", "true"],
    ["location_detail", "true"],
  ];
  if (search.trim()) {
    pairs.push(["search", search.trim()]);
  }
  const value = await authed(id, withQuery(apiUrl(requireServer(id).server, "api/stock/"), pairs));
  const results = pageItems(value).flatMap((item) => {
    const parsed = parseStockItem(item);
    return parsed ? [parsed] : [];
  });
  return { count: pageCount(value, results), results };
}

export async function getStockItem(id: string, pk: number): Promise<StockItemDetail> {
  const value = await authed(
    id,
    withQuery(apiUrl(requireServer(id).server, `api/stock/${pk}/`), [
      ["part_detail", "true"],
      ["location_detail", "true"],
    ]),
  );
  const item = parseStockItem(value);
  if (!item) {
    throw fail("missingData", "库存项里没有 pk");
  }
  return item;
}

export async function createStockLocation(id: string, input: StockLocationWrite): Promise<number> {
  if (!input.name.trim()) {
    throw fail("invalid", "请填写名称");
  }
  const value = await authed(id, apiUrl(requireServer(id).server, "api/stock/location/"), {
    method: "POST",
    json: locationBody(input),
  });
  const pk = idOf(value, "pk");
  if (!pk) {
    throw fail("missingData", "新地点里没有 pk");
  }
  return pk;
}

export async function updateStockLocation(id: string, pk: number, input: StockLocationWrite) {
  if (!input.name.trim()) {
    throw fail("invalid", "请填写名称");
  }
  await authed(id, apiUrl(requireServer(id).server, `api/stock/location/${pk}/`), {
    method: "PATCH",
    json: locationBody(input),
  });
}

export async function deleteStockLocation(id: string, pk: number) {
  await authed(id, apiUrl(requireServer(id).server, `api/stock/location/${pk}/`), { method: "DELETE" });
}

export async function createStockItem(id: string, input: StockItemWrite): Promise<number> {
  if (input.part <= 0) {
    throw fail("invalid", "请选择零件");
  }
  if (input.quantity <= 0) {
    throw fail("invalid", "数量需要大于 0");
  }
  const value = await authed(id, apiUrl(requireServer(id).server, "api/stock/"), {
    method: "POST",
    json: stockItemBody(input),
  });
  const pk = createdPk(value);
  if (!pk) {
    throw fail("missingData", "新库存项里没有 pk");
  }
  return pk;
}

function createdPk(value: unknown): number | null {
  const direct = idOf(value, "pk");
  if (direct) {
    return direct;
  }
  for (const item of pageItems(value)) {
    const pk = idOf(item, "pk");
    if (pk) {
      return pk;
    }
  }
  return null;
}

export async function updateStockItem(id: string, pk: number, input: StockItemWrite) {
  if (input.part <= 0) {
    throw fail("invalid", "请选择零件");
  }
  if (input.quantity <= 0) {
    throw fail("invalid", "数量需要大于 0");
  }
  await authed(id, apiUrl(requireServer(id).server, `api/stock/${pk}/`), {
    method: "PATCH",
    json: stockItemBody(input),
  });
}

export async function deleteStockItem(id: string, pk: number) {
  await authed(id, apiUrl(requireServer(id).server, `api/stock/${pk}/`), { method: "DELETE" });
}

function locationBody(input: StockLocationWrite) {
  return {
    name: input.name.trim(),
    description: input.description,
    parent: input.parent,
    structural: input.structural,
    external: input.external,
  };
}

function stockItemBody(input: StockItemWrite) {
  const serialNumbers = input.serialNumbers?.trim() ?? "";
  return {
    part: input.part,
    location: input.location,
    quantity: input.quantity,
    status: input.status,
    batch: input.batch.trim(),
    packaging: input.packaging.trim(),
    link: input.link.trim(),
    ...(serialNumbers
      ? { serial_numbers: serialNumbers }
      : input.serial.trim()
        ? { serial: input.serial.trim() }
        : {}),
    supplier_part: input.supplierPart,
    purchase_price: input.purchasePrice.trim() || null,
    purchase_price_currency: input.purchasePrice.trim() ? input.purchasePriceCurrency : null,
  };
}

export async function getPartSerialNumbers(id: string, pk: number): Promise<{ next: string; latest: string }> {
  const value = await authed(id, apiUrl(requireServer(id).server, `api/part/${pk}/serial-numbers/`));
  return { next: text(value, "next"), latest: text(value, "latest") };
}

function parseLocationSummary(value: unknown): StockLocationSummary[] {
  const pk = idOf(value, "pk");
  if (!pk) {
    return [];
  }
  return [
    {
      pk,
      name: text(value, "name"),
      description: text(value, "description"),
      pathstring: text(value, "pathstring"),
      itemCount: num(value, "items"),
    },
  ];
}

function parseStockItem(value: unknown): StockItemDetail | null {
  const pk = idOf(value, "pk");
  if (!pk) {
    return null;
  }
  const location = nested(value, "location_detail", "pathstring").trim() || nested(value, "location_detail", "name");
  return {
    pk,
    partId: idOf(value, "part") ?? 0,
    partName: firstText([nested(value, "part_detail", "full_name"), nested(value, "part_detail", "name")]),
    partDescription: nested(value, "part_detail", "description"),
    partThumbnail: nested(value, "part_detail", "thumbnail"),
    quantity: num(value, "quantity"),
    units: nested(value, "part_detail", "units"),
    serial: text(value, "serial"),
    batch: text(value, "batch"),
    statusText: text(value, "status_text"),
    status: typeof asObject(value)?.status === "number" ? (asObject(value)?.status as number) : 10,
    inStock: bool(value, "in_stock", true),
    locationId: idOf(value, "location"),
    location,
    packaging: text(value, "packaging"),
    link: text(value, "link"),
    supplierPartId: idOf(value, "supplier_part"),
    supplierSku: text(value, "SKU"),
    purchasePrice: decimalText(value, "purchase_price"),
    purchasePriceCurrency: text(value, "purchase_price_currency"),
    updated: text(value, "updated"),
    stocktakeDate: text(value, "stocktake_date"),
  };
}

export async function searchPartCategories(id: string, search: string): Promise<LookupHit[]> {
  return searchLookup(id, "api/part/category/", search);
}

export async function searchStockLocations(id: string, search: string): Promise<LookupHit[]> {
  return searchLookup(id, "api/stock/location/", search);
}

async function searchLookup(id: string, path: string, search: string): Promise<LookupHit[]> {
  const value = await authed(
    id,
    withQuery(apiUrl(requireServer(id).server, path), [
      ["limit", "25"],
      ["offset", "0"],
      ["search", search.trim()],
    ]),
  );
  return pageItems(value).flatMap((item) => {
    const pk = idOf(item, "pk");
    if (!pk) {
      return [];
    }
    const hit: LookupHit = {
      pk,
      name: text(item, "name"),
      pathstring: text(item, "pathstring"),
    };
    return [hit];
  });
}

export async function getPartPricing(id: string, pk: number): Promise<PartPriceDetail> {
  const value = await authed(id, apiUrl(requireServer(id).server, `api/part/${pk}/pricing/`));
  if (!asObject(value)) {
    throw fail("missingData", "价格不是 JSON");
  }
  const override = (amountKey: string, currencyKey: string) => {
    const amount = decimalText(value, amountKey);
    if (!amount) {
      return "";
    }
    const currency = text(value, currencyKey).trim();
    return currency ? priceRange(amount, amount, currency) : "-";
  };
  return {
    currency: text(value, "currency").trim(),
    priceRange: pricedRange(value, "overall_min", "overall_max"),
    overrideMin: override("override_min", "override_min_currency"),
    overrideMax: override("override_max", "override_max_currency"),
    internalCost: pricedRange(value, "internal_cost_min", "internal_cost_max"),
    variantCost: pricedRange(value, "variant_cost_min", "variant_cost_max"),
    bomCost: pricedRange(value, "bom_cost_min", "bom_cost_max"),
    purchasePrice: pricedRange(value, "purchase_cost_min", "purchase_cost_max"),
    supplierPrice: pricedRange(value, "supplier_price_min", "supplier_price_max"),
    salePrice: pricedRange(value, "sale_price_min", "sale_price_max"),
    saleHistory: pricedRange(value, "sale_history_min", "sale_history_max"),
  };
}

function parseBomLine(value: unknown): BomLine | null {
  const pk = idOf(value, "pk");
  if (!pk) {
    return null;
  }
  const rounding = asObject(value)?.rounding_multiple;
  const substitutes = asObject(value)?.substitutes;
  return {
    pk,
    quantity: num(value, "quantity"),
    reference: text(value, "reference"),
    note: text(value, "note"),
    allowVariants: bool(value, "allow_variants", true),
    inherited: bool(value, "inherited", false),
    optional: bool(value, "optional", false),
    consumable: bool(value, "consumable", false),
    setupQuantity: num(value, "setup_quantity"),
    attrition: num(value, "attrition"),
    roundingMultiple: rounding === null || rounding === undefined ? null : num(value, "rounding_multiple"),
    validated: bool(value, "validated", false),
    partId: idOf(value, "part") ?? 0,
    partName: firstText([nested(value, "part_detail", "full_name"), nested(value, "part_detail", "name")]),
    partThumbnail: nested(value, "part_detail", "thumbnail"),
    subPartId: idOf(value, "sub_part") ?? 0,
    subPartName: firstText([nested(value, "sub_part_detail", "full_name"), nested(value, "sub_part_detail", "name")]),
    subPartThumbnail: nested(value, "sub_part_detail", "thumbnail"),
    subPartUnits: nested(value, "sub_part_detail", "units"),
    substitutes: Array.isArray(substitutes)
      ? substitutes.flatMap((item) => {
          const substitutePk = idOf(item, "pk");
          if (!substitutePk) {
            return [];
          }
          const substitute: BomSubstitute = {
            pk: substitutePk,
            partId: idOf(item, "part") ?? 0,
            partName: firstText([nested(item, "part_detail", "full_name"), nested(item, "part_detail", "name")]),
          };
          return [substitute];
        })
      : [],
  };
}

function bomQuery(base: string, pk: number): string {
  return withQuery(apiUrl(base, `api/bom/${pk}/`), [
    ["part_detail", "true"],
    ["sub_part_detail", "true"],
    ["substitutes", "true"],
  ]);
}

export async function listBom(id: string, part: number, usedIn: boolean, offset: number): Promise<BomPage> {
  const base = requireServer(id).server;
  const pairs: Array<[string, string]> = [
    ["limit", String(PAGE_LIMIT)],
    ["offset", String(offset)],
    ["part_detail", "true"],
    ["sub_part_detail", "true"],
    [usedIn ? "uses" : "part", String(part)],
  ];
  const value = await authed(id, withQuery(apiUrl(base, "api/bom/"), pairs));
  const results = pageItems(value).flatMap((item) => {
    const line = parseBomLine(item);
    return line ? [line] : [];
  });
  return { count: pageCount(value, results), results };
}

export async function getBomItem(id: string, pk: number): Promise<BomLine> {
  const line = parseBomLine(await authed(id, bomQuery(requireServer(id).server, pk)));
  if (!line) {
    throw fail("missingData", "物料行里没有 pk");
  }
  return line;
}

function bomBody(input: BomItemWrite) {
  return {
    part: input.part,
    sub_part: input.subPart,
    quantity: input.quantity,
    reference: input.reference,
    note: input.note,
    allow_variants: input.allowVariants,
    inherited: input.inherited,
    optional: input.optional,
    consumable: input.consumable,
    setup_quantity: input.setupQuantity,
    attrition: input.attrition,
    rounding_multiple: input.roundingMultiple,
  };
}

export async function createBomItem(id: string, input: BomItemWrite): Promise<BomLine> {
  if (input.part <= 0 || input.subPart <= 0) {
    throw fail("invalid", "请选择装配体和组件");
  }
  if (input.quantity <= 0) {
    throw fail("invalid", "数量需要大于 0");
  }
  const line = parseBomLine(
    await authed(id, apiUrl(requireServer(id).server, "api/bom/"), { method: "POST", json: bomBody(input) }),
  );
  if (!line) {
    throw fail("missingData", "物料行里没有 pk");
  }
  return line;
}

export async function updateBomItem(id: string, pk: number, input: BomItemWrite): Promise<BomLine> {
  if (input.quantity <= 0) {
    throw fail("invalid", "数量需要大于 0");
  }
  const line = parseBomLine(
    await authed(id, apiUrl(requireServer(id).server, `api/bom/${pk}/`), { method: "PATCH", json: bomBody(input) }),
  );
  if (!line) {
    throw fail("missingData", "物料行里没有 pk");
  }
  return line;
}

export async function deleteBomItem(id: string, pk: number) {
  await authed(id, apiUrl(requireServer(id).server, `api/bom/${pk}/`), { method: "DELETE" });
}

export async function validateBomItem(id: string, pk: number, valid: boolean) {
  await authed(id, apiUrl(requireServer(id).server, `api/bom/${pk}/validate/`), {
    method: "PUT",
    json: { valid },
  });
}

export async function createBomSubstitute(id: string, bomItem: number, part: number): Promise<BomSubstitute> {
  if (bomItem <= 0 || part <= 0) {
    throw fail("invalid", "请选择替代零件");
  }
  const value = await authed(id, apiUrl(requireServer(id).server, "api/bom/substitute/"), {
    method: "POST",
    json: { bom_item: bomItem, part },
  });
  const pk = idOf(value, "pk");
  if (!pk) {
    throw fail("missingData", "替代料里没有 pk");
  }
  return {
    pk,
    partId: idOf(value, "part") ?? part,
    partName: firstText([nested(value, "part_detail", "full_name"), nested(value, "part_detail", "name")]),
  };
}

export async function deleteBomSubstitute(id: string, pk: number) {
  await authed(id, apiUrl(requireServer(id).server, `api/bom/substitute/${pk}/`), { method: "DELETE" });
}

export async function listPartStock(id: string, pk: number, offset: number): Promise<PartStockPage> {
  const value = await authed(
    id,
    withQuery(apiUrl(requireServer(id).server, "api/stock/"), [
      ["limit", String(PAGE_LIMIT)],
      ["offset", String(offset)],
      ["part", String(pk)],
      ["part_detail", "true"],
      ["location_detail", "true"],
    ]),
  );
  const results = pageItems(value).flatMap((item) => {
    const itemPk = idOf(item, "pk");
    if (!itemPk) {
      return [];
    }
    const location = nested(item, "location_detail", "pathstring").trim() || nested(item, "location_detail", "name");
    const quantity = num(item, "quantity");
    const units = nested(item, "part_detail", "units");
    return [
      {
        pk: itemPk,
        partName: firstText([nested(item, "part_detail", "full_name"), nested(item, "part_detail", "name")]),
        location,
        quantity: units.trim() ? `${formatQty(quantity)} ${units.trim()}` : formatQty(quantity),
        thumbnail: nested(item, "part_detail", "thumbnail"),
      },
    ];
  });
  return { count: pageCount(value, results), results };
}

function formatQty(value: number): string {
  if (!Number.isFinite(value)) {
    return "0";
  }
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 1000) / 1000);
}

export async function createSupplierPart(id: string, input: SupplierPartWrite): Promise<number> {
  if (input.part <= 0) {
    throw fail("invalid", "请选择零件");
  }
  if (input.supplier <= 0) {
    throw fail("invalid", "请选择供应商");
  }
  const sku = input.sku.trim();
  if (!sku) {
    throw fail("invalid", "请填写供应商零件编号");
  }
  const link = input.link.trim();
  if (link && !/^https?:\/\//i.test(link)) {
    throw fail("invalid", "链接需要以 http:// 或 https:// 开头");
  }
  const body: Record<string, unknown> = {
    part: input.part,
    supplier: input.supplier,
    SKU: sku,
    active: input.active,
    primary: input.primary,
  };
  const description = input.description.trim();
  const packaging = input.packaging.trim();
  const packQuantity = input.packQuantity.trim();
  const note = input.note.trim();
  if (description) {
    body.description = description;
  }
  if (packaging) {
    body.packaging = packaging;
  }
  if (packQuantity) {
    body.pack_quantity = packQuantity;
  }
  if (link) {
    body.link = link;
  }
  if (note) {
    body.note = note.slice(0, 100);
    body.notes = note;
  }
  const value = await authed(id, apiUrl(requireServer(id).server, "api/company/part/"), {
    method: "POST",
    json: body,
  });
  const pk = idOf(value, "pk");
  if (!pk) {
    throw fail("missingData", "新的供应商零件里没有 pk");
  }
  return pk;
}

export async function listSupplierParts(
  id: string,
  offset: number,
  filter: { part?: number; supplier?: number; search?: string },
): Promise<SupplierPartPage> {
  const pairs: Array<[string, string]> = [
    ["limit", String(PAGE_LIMIT)],
    ["offset", String(offset)],
    ["supplier_detail", "true"],
    ["part_detail", "true"],
  ];
  if (filter.part) {
    pairs.push(["part", String(filter.part)]);
  }
  if (filter.supplier) {
    pairs.push(["supplier", String(filter.supplier)]);
  }
  if (filter.search?.trim()) {
    pairs.push(["search", filter.search.trim()]);
  }
  const value = await authed(id, withQuery(apiUrl(requireServer(id).server, "api/company/part/"), pairs));
  const results = pageItems(value).flatMap((item) => {
    const pk = idOf(item, "pk");
    if (!pk) {
      return [];
    }
    const summary: SupplierPartSummary = {
      pk,
      sku: text(item, "SKU"),
      supplierName: nested(item, "supplier_detail", "name"),
      partId: idOf(item, "part") ?? 0,
      partName: firstText([nested(item, "part_detail", "full_name"), nested(item, "part_detail", "name")]),
      partUnits: nested(item, "part_detail", "units"),
      supplierImage: nested(item, "supplier_detail", "thumbnail") || nested(item, "supplier_detail", "image"),
      partThumbnail: nested(item, "part_detail", "thumbnail"),
      inStock: num(item, "in_stock"),
    };
    return [summary];
  });
  return { count: pageCount(value, results), results };
}

export async function getSupplierPart(id: string, pk: number): Promise<SupplierPartDetail> {
  const value = await authed(
    id,
    withQuery(apiUrl(requireServer(id).server, `api/company/part/${pk}/`), [
      ["supplier_detail", "true"],
      ["part_detail", "true"],
      ["manufacturer_detail", "true"],
      ["manufacturer_part_detail", "true"],
    ]),
  );
  const found = idOf(value, "pk");
  if (!found) {
    throw fail("missingData", "供应商零件里没有 pk");
  }
  return {
    pk: found,
    sku: text(value, "SKU"),
    active: bool(value, "active", true),
    primary: bool(value, "primary", false),
    inStock: num(value, "in_stock"),
    partId: idOf(value, "part") ?? 0,
    partName: firstText([nested(value, "part_detail", "full_name"), nested(value, "part_detail", "name")]),
    supplierId: idOf(value, "supplier") ?? 0,
    supplierName: nested(value, "supplier_detail", "name"),
    manufacturerId: idOf(asObject(value)?.manufacturer_detail, "pk") ?? 0,
    manufacturerName: nested(value, "manufacturer_detail", "name"),
    manufacturerPartId: idOf(value, "manufacturer_part"),
    mpn: nested(value, "manufacturer_part_detail", "MPN") || text(value, "MPN"),
    packaging: text(value, "packaging"),
    packQuantity: text(value, "pack_quantity"),
    link: text(value, "link"),
    note: text(value, "note").trim() || text(value, "notes"),
  };
}

function companySummary(value: unknown): CompanySummary | null {
  const pk = idOf(value, "pk");
  if (!pk) {
    return null;
  }
  return {
    pk,
    name: text(value, "name"),
    description: text(value, "description"),
    thumbnail: text(value, "thumbnail") || text(value, "image"),
    active: bool(value, "active", true),
  };
}

function addressLine(value: unknown): string {
  const address = asObject(value)?.primary_address;
  if (!address) {
    return "";
  }
  return [
    text(address, "line1"),
    text(address, "line2"),
    text(address, "postal_city"),
    text(address, "province"),
    text(address, "postal_code"),
    text(address, "country"),
  ]
    .map((item) => item.trim())
    .filter(Boolean)
    .join(" ");
}

export async function listCompanies(
  id: string,
  offset: number,
  filter: { supplier?: boolean; customer?: boolean; search?: string },
): Promise<CompanyPage> {
  const pairs: Array<[string, string]> = [
    ["limit", String(PAGE_LIMIT)],
    ["offset", String(offset)],
    ["ordering", "name"],
  ];
  if (filter.supplier) {
    pairs.push(["is_supplier", "true"]);
  }
  if (filter.customer) {
    pairs.push(["is_customer", "true"]);
  }
  if (filter.search?.trim()) {
    pairs.push(["search", filter.search.trim()]);
  }
  const value = await authed(id, withQuery(apiUrl(requireServer(id).server, "api/company/"), pairs));
  const results = pageItems(value).flatMap((item) => {
    const summary = companySummary(item);
    return summary ? [summary] : [];
  });
  return { count: pageCount(value, results), results };
}

function companyBody(input: CompanyWrite) {
  const name = input.name.trim();
  if (!name) {
    throw fail("invalid", "请填写名称");
  }
  const currency = input.currency.trim();
  if (!currency) {
    throw fail("invalid", "请选择币种");
  }
  const website = input.website.trim();
  const link = input.link.trim();
  const email = input.email.trim();
  if (website && !/^https?:\/\//i.test(website)) {
    throw fail("invalid", "网站需要以 http:// 或 https:// 开头");
  }
  if (link && !/^https?:\/\//i.test(link)) {
    throw fail("invalid", "链接需要以 http:// 或 https:// 开头");
  }
  return {
    name,
    description: input.description.trim(),
    website,
    phone: input.phone.trim(),
    email,
    contact: input.contact.trim(),
    link,
    currency,
    tax_id: input.taxId.trim(),
    notes: input.notes.trim(),
    active: input.active,
    is_supplier: input.isSupplier,
    is_manufacturer: input.isManufacturer,
    is_customer: input.isCustomer,
  };
}

export async function createCompany(id: string, input: CompanyWrite): Promise<number> {
  const value = await authed(id, apiUrl(requireServer(id).server, "api/company/"), {
    method: "POST",
    json: companyBody(input),
  });
  const pk = idOf(value, "pk");
  if (!pk) {
    throw fail("missingData", "新公司里没有 pk");
  }
  return pk;
}

export async function updateCompany(id: string, pk: number, input: CompanyWrite) {
  if (pk <= 0) {
    throw fail("invalid", "公司不存在");
  }
  await authed(id, apiUrl(requireServer(id).server, `api/company/${pk}/`), {
    method: "PATCH",
    json: companyBody(input),
  });
}

export async function getCompany(id: string, pk: number): Promise<CompanyDetail> {
  const value = await authed(id, apiUrl(requireServer(id).server, `api/company/${pk}/`));
  const summary = companySummary(value);
  if (!summary) {
    throw fail("missingData", "公司里没有 pk");
  }
  const detail = {
    ...summary,
    website: text(value, "website"),
    phone: text(value, "phone"),
    email: text(value, "email"),
    link: text(value, "link"),
    currency: text(value, "currency"),
    contact: text(value, "contact"),
    notes: text(value, "notes").trim(),
    taxId: text(value, "tax_id"),
    address: addressLine(value),
    isSupplier: bool(value, "is_supplier", false),
    isManufacturer: bool(value, "is_manufacturer", false),
    isCustomer: bool(value, "is_customer", false),
    partsSupplied: num(value, "parts_supplied"),
    partsManufactured: num(value, "parts_manufactured"),
  };
  if (detail.isSupplier) {
    rememberCompany(id, summary);
  }
  return detail;
}

export async function listManufacturerParts(
  id: string,
  manufacturer: number,
  search: string,
  offset: number,
): Promise<{ count: number; results: ManufacturerPartSummary[] }> {
  const pairs: Array<[string, string]> = [
    ["limit", String(PAGE_LIMIT)],
    ["offset", String(offset)],
    ["manufacturer", String(manufacturer)],
    ["part_detail", "true"],
  ];
  if (search.trim()) {
    pairs.push(["search", search.trim()]);
  }
  const value = await authed(id, withQuery(apiUrl(requireServer(id).server, "api/company/part/manufacturer/"), pairs));
  const results = pageItems(value).flatMap((item) => {
    const pk = idOf(item, "pk");
    if (!pk) {
      return [];
    }
    const summary: ManufacturerPartSummary = {
      pk,
      mpn: text(item, "MPN"),
      partName: firstText([nested(item, "part_detail", "full_name"), nested(item, "part_detail", "name")]),
      thumbnail: nested(item, "part_detail", "thumbnail"),
    };
    return [summary];
  });
  return { count: pageCount(value, results), results };
}

export async function getManufacturerPart(id: string, pk: number): Promise<ManufacturerPartDetail> {
  const value = await authed(
    id,
    withQuery(apiUrl(requireServer(id).server, `api/company/part/manufacturer/${pk}/`), [
      ["manufacturer_detail", "true"],
      ["part_detail", "true"],
    ]),
  );
  const found = idOf(value, "pk");
  if (!found) {
    throw fail("missingData", "制造商零件里没有 pk");
  }
  return {
    pk: found,
    mpn: text(value, "MPN"),
    description: text(value, "description"),
    manufacturerId: idOf(value, "manufacturer") ?? 0,
    manufacturerName: nested(value, "manufacturer_detail", "name"),
    partId: idOf(value, "part") ?? 0,
    partName: firstText([nested(value, "part_detail", "full_name"), nested(value, "part_detail", "name")]),
    link: text(value, "link"),
    notes: text(value, "notes").trim(),
  };
}

export async function listSupplierPartStock(id: string, supplierPart: number, offset: number): Promise<PartStockPage> {
  const value = await authed(
    id,
    withQuery(apiUrl(requireServer(id).server, "api/stock/"), [
      ["limit", String(PAGE_LIMIT)],
      ["offset", String(offset)],
      ["supplier_part", String(supplierPart)],
      ["in_stock", "true"],
      ["part_detail", "true"],
      ["location_detail", "true"],
    ]),
  );
  const results = pageItems(value).flatMap((item) => {
    const itemPk = idOf(item, "pk");
    if (!itemPk) {
      return [];
    }
    const location = nested(item, "location_detail", "pathstring").trim() || nested(item, "location_detail", "name");
    const quantity = num(item, "quantity");
    const units = nested(item, "part_detail", "units");
    return [
      {
        pk: itemPk,
        partName: firstText([nested(item, "part_detail", "full_name"), nested(item, "part_detail", "name")]),
        location,
        quantity: units.trim() ? `${formatQty(quantity)} ${units.trim()}` : formatQty(quantity),
        thumbnail: nested(item, "part_detail", "thumbnail"),
      },
    ];
  });
  return { count: pageCount(value, results), results };
}

export async function countOutstandingPurchaseOrders(id: string, supplier: number): Promise<number> {
  const value = await authed(
    id,
    withQuery(apiUrl(requireServer(id).server, "api/order/po/"), [
      ["limit", "1"],
      ["offset", "0"],
      ["supplier", String(supplier)],
      ["outstanding", "true"],
    ]),
  );
  return pageCount(value, pageItems(value));
}

export async function listPurchaseOrders(
  id: string,
  supplier: number | null,
  search: string,
  offset: number,
): Promise<{ count: number; results: PurchaseOrderSummary[] }> {
  const pairs: Array<[string, string]> = [
    ["limit", String(PAGE_LIMIT)],
    ["offset", String(offset)],
    ["supplier_detail", "true"],
    ["ordering", "-creation_date"],
  ];
  if (supplier) {
    pairs.push(["supplier", String(supplier)]);
  }
  if (search.trim()) {
    pairs.push(["search", search.trim()]);
  }
  const value = await authed(id, withQuery(apiUrl(requireServer(id).server, "api/order/po/"), pairs));
  const results = pageItems(value).flatMap((item) => {
    const pk = idOf(item, "pk");
    if (!pk) {
      return [];
    }
    const summary: PurchaseOrderSummary = {
      pk,
      reference: text(item, "reference"),
      description: text(item, "description"),
      statusText: text(item, "status_text"),
      supplierName: text(item, "supplier_name") || nested(item, "supplier_detail", "name"),
      thumbnail: nested(item, "supplier_detail", "thumbnail") || nested(item, "supplier_detail", "image"),
    };
    return [summary];
  });
  return { count: pageCount(value, results), results };
}

export async function getPurchaseOrder(id: string, pk: number): Promise<PurchaseOrderDetail> {
  const value = await authed(
    id,
    withQuery(apiUrl(requireServer(id).server, `api/order/po/${pk}/`), [["supplier_detail", "true"]]),
  );
  const found = idOf(value, "pk");
  if (!found) {
    throw fail("missingData", "采购订单里没有 pk");
  }
  return {
    pk: found,
    reference: text(value, "reference"),
    description: text(value, "description"),
    statusText: text(value, "status_text"),
    supplierId: idOf(value, "supplier"),
    supplierName: text(value, "supplier_name") || nested(value, "supplier_detail", "name"),
    supplierReference: text(value, "supplier_reference"),
    totalPrice: trimDecimal(text(value, "total_price")),
    currency: text(value, "order_currency") || nested(value, "supplier_detail", "currency"),
    issueDate: text(value, "issue_date"),
    startDate: text(value, "start_date"),
    targetDate: text(value, "target_date"),
    completeDate: text(value, "complete_date"),
    lineCount: num(value, "line_items"),
    completedLines: num(value, "completed_lines"),
    notes: text(value, "notes").trim(),
    link: text(value, "link"),
  };
}

export async function listPurchaseOrderLines(
  id: string,
  order: number,
  offset: number,
): Promise<{ count: number; results: PurchaseOrderLine[] }> {
  const value = await authed(
    id,
    withQuery(apiUrl(requireServer(id).server, "api/order/po-line/"), [
      ["limit", String(PAGE_LIMIT)],
      ["offset", String(offset)],
      ["order", String(order)],
      ["part_detail", "true"],
    ]),
  );
  const results = pageItems(value).flatMap((item) => {
    const pk = idOf(item, "pk");
    if (!pk) {
      return [];
    }
    const currency = text(item, "purchase_price_currency");
    const price = trimDecimal(text(item, "purchase_price"));
    const line: PurchaseOrderLine = {
      pk,
      sku: text(item, "sku") || nested(item, "supplier_part_detail", "SKU"),
      partName: text(item, "internal_part_name"),
      supplierPartId: idOf(item, "part"),
      quantity: num(item, "quantity"),
      received: num(item, "received"),
      price: price ? (currency ? `${price} ${currency}` : price) : "",
      targetDate: text(item, "target_date"),
    };
    return [line];
  });
  return { count: pageCount(value, results), results };
}

export async function countOutstandingSalesOrders(id: string, customer: number): Promise<number> {
  const value = await authed(
    id,
    withQuery(apiUrl(requireServer(id).server, "api/order/so/"), [
      ["limit", "1"],
      ["offset", "0"],
      ["customer", String(customer)],
      ["outstanding", "true"],
    ]),
  );
  return pageCount(value, pageItems(value));
}

export async function listSalesOrders(
  id: string,
  customer: number | null,
  search: string,
  offset: number,
): Promise<{ count: number; results: SalesOrderSummary[] }> {
  const pairs: Array<[string, string]> = [
    ["limit", String(PAGE_LIMIT)],
    ["offset", String(offset)],
    ["customer_detail", "true"],
    ["ordering", "-creation_date"],
  ];
  if (customer) {
    pairs.push(["customer", String(customer)]);
  }
  if (search.trim()) {
    pairs.push(["search", search.trim()]);
  }
  const value = await authed(id, withQuery(apiUrl(requireServer(id).server, "api/order/so/"), pairs));
  const results = pageItems(value).flatMap((item) => {
    const pk = idOf(item, "pk");
    if (!pk) {
      return [];
    }
    const summary: SalesOrderSummary = {
      pk,
      reference: text(item, "reference"),
      description: text(item, "description"),
      statusText: text(item, "status_text"),
      customerName: nested(item, "customer_detail", "name"),
      thumbnail: nested(item, "customer_detail", "thumbnail") || nested(item, "customer_detail", "image"),
    };
    return [summary];
  });
  return { count: pageCount(value, results), results };
}

export async function getSalesOrder(id: string, pk: number): Promise<SalesOrderDetail> {
  const value = await authed(
    id,
    withQuery(apiUrl(requireServer(id).server, `api/order/so/${pk}/`), [["customer_detail", "true"]]),
  );
  const found = idOf(value, "pk");
  if (!found) {
    throw fail("missingData", "销售订单里没有 pk");
  }
  return {
    pk: found,
    reference: text(value, "reference"),
    description: text(value, "description"),
    statusText: text(value, "status_text"),
    customerId: idOf(value, "customer"),
    customerName: nested(value, "customer_detail", "name"),
    customerReference: text(value, "customer_reference"),
    totalPrice: trimDecimal(text(value, "total_price")),
    currency: text(value, "order_currency") || nested(value, "customer_detail", "currency"),
    issueDate: text(value, "issue_date"),
    startDate: text(value, "start_date"),
    targetDate: text(value, "target_date"),
    shipmentDate: text(value, "shipment_date"),
    lineCount: num(value, "line_items"),
    completedLines: num(value, "completed_lines"),
    shipmentCount: num(value, "shipments_count"),
    completedShipments: num(value, "completed_shipments_count"),
    notes: text(value, "notes").trim(),
    link: text(value, "link"),
  };
}

export async function listSalesOrderLines(
  id: string,
  order: number,
  offset: number,
): Promise<{ count: number; results: SalesOrderLine[] }> {
  const value = await authed(
    id,
    withQuery(apiUrl(requireServer(id).server, "api/order/so-line/"), [
      ["limit", String(PAGE_LIMIT)],
      ["offset", String(offset)],
      ["order", String(order)],
      ["part_detail", "true"],
    ]),
  );
  const results = pageItems(value).flatMap((item) => {
    const pk = idOf(item, "pk");
    if (!pk) {
      return [];
    }
    const currency = text(item, "sale_price_currency");
    const price = trimDecimal(text(item, "sale_price"));
    const line: SalesOrderLine = {
      pk,
      partId: idOf(item, "part"),
      partName: firstText([nested(item, "part_detail", "full_name"), nested(item, "part_detail", "name")]),
      thumbnail: nested(item, "part_detail", "thumbnail"),
      quantity: num(item, "quantity"),
      shipped: num(item, "shipped"),
      price: price ? (currency ? `${price} ${currency}` : price) : "",
    };
    return [line];
  });
  return { count: pageCount(value, results), results };
}

export async function listSalesOrderExtraLines(id: string, order: number): Promise<PurchaseOrderExtraLine[]> {
  const value = await authed(
    id,
    withQuery(apiUrl(requireServer(id).server, "api/order/so-extra-line/"), [
      ["limit", String(PAGE_LIMIT)],
      ["offset", "0"],
      ["order", String(order)],
    ]),
  );
  return pageItems(value).flatMap((item) => {
    const pk = idOf(item, "pk");
    if (!pk) {
      return [];
    }
    const currency = text(item, "price_currency");
    const price = trimDecimal(text(item, "price"));
    return [
      {
        pk,
        description: text(item, "description"),
        price: price ? (currency ? `${price} ${currency}` : price) : "",
      },
    ];
  });
}

export async function listSalesOrderShipments(id: string, order: number): Promise<SalesOrderShipment[]> {
  const value = await authed(
    id,
    withQuery(apiUrl(requireServer(id).server, "api/order/so/shipment/"), [
      ["limit", String(PAGE_LIMIT)],
      ["offset", "0"],
      ["order", String(order)],
    ]),
  );
  return pageItems(value).flatMap((item) => {
    const parsed = parseShipment(item);
    return parsed ? [parsed] : [];
  });
}

export async function getSalesOrderShipment(id: string, pk: number): Promise<SalesOrderShipment> {
  const value = await authed(id, apiUrl(requireServer(id).server, `api/order/so/shipment/${pk}/`));
  const parsed = parseShipment(value);
  if (!parsed) {
    throw fail("missingData", "配送里没有 pk");
  }
  return parsed;
}

function parseShipment(value: unknown): SalesOrderShipment | null {
  const pk = idOf(value, "pk");
  if (!pk) {
    return null;
  }
  return {
    pk,
    reference: text(value, "reference"),
    trackingNumber: text(value, "tracking_number"),
    invoiceNumber: text(value, "invoice_number"),
    shipmentDate: text(value, "shipment_date"),
    deliveryDate: text(value, "delivery_date"),
    checked: idOf(value, "checked_by") !== null,
    notes: text(value, "notes").trim(),
    link: text(value, "link"),
    orderId: idOf(value, "order"),
  };
}

export async function listPurchaseOrderExtraLines(
  id: string,
  order: number,
): Promise<PurchaseOrderExtraLine[]> {
  const value = await authed(
    id,
    withQuery(apiUrl(requireServer(id).server, "api/order/po-extra-line/"), [
      ["limit", String(PAGE_LIMIT)],
      ["offset", "0"],
      ["order", String(order)],
    ]),
  );
  return pageItems(value).flatMap((item) => {
    const pk = idOf(item, "pk");
    if (!pk) {
      return [];
    }
    const currency = text(item, "price_currency");
    const price = trimDecimal(text(item, "price"));
    return [
      {
        pk,
        description: text(item, "description"),
        price: price ? (currency ? `${price} ${currency}` : price) : "",
      },
    ];
  });
}

async function placeName(id: string, value: unknown, detailKey: string, idKey: string) {
  const placeId = idOf(value, idKey);
  const nestedName = firstText([nested(value, detailKey, "pathstring"), nested(value, detailKey, "name")]);
  if (nestedName || !placeId) {
    return { id: placeId, name: nestedName };
  }
  try {
    const location = await getStockLocation(id, placeId);
    return { id: placeId, name: location.pathstring || location.name };
  } catch {
    return { id: placeId, name: "" };
  }
}

export async function listBuildOrders(id: string, search: string, offset: number): Promise<{ count: number; results: OrderSummary[] }> {
  const pairs: Array<[string, string]> = [
    ["limit", String(PAGE_LIMIT)],
    ["offset", String(offset)],
    ["part_detail", "true"],
    ["ordering", "-creation_date"],
  ];
  if (search.trim()) {
    pairs.push(["search", search.trim()]);
  }
  const value = await authed(id, withQuery(apiUrl(requireServer(id).server, "api/build/"), pairs));
  const results = pageItems(value).flatMap((item) => {
    const pk = idOf(item, "pk");
    if (!pk) {
      return [];
    }
    const summary: OrderSummary = {
      pk,
      reference: text(item, "reference"),
      description: text(item, "title"),
      statusText: text(item, "status_text"),
      detail: text(item, "part_name") || nested(item, "part_detail", "name"),
      thumbnail: nested(item, "part_detail", "thumbnail"),
    };
    return [summary];
  });
  return { count: pageCount(value, results), results };
}

export async function getBuildOrder(id: string, pk: number): Promise<BuildDetail> {
  const value = await authed(
    id,
    withQuery(apiUrl(requireServer(id).server, `api/build/${pk}/`), [["part_detail", "true"]]),
  );
  const found = idOf(value, "pk");
  if (!found) {
    throw fail("missingData", "生产订单里没有 pk");
  }
  const [source, destination] = await Promise.all([
    placeName(id, value, "take_from_detail", "take_from"),
    placeName(id, value, "destination_detail", "destination"),
  ]);
  return {
    pk: found,
    reference: text(value, "reference"),
    title: text(value, "title"),
    statusText: text(value, "status_text"),
    partId: idOf(value, "part"),
    partName: text(value, "part_name") || firstText([nested(value, "part_detail", "full_name"), nested(value, "part_detail", "name")]),
    partThumbnail: nested(value, "part_detail", "thumbnail"),
    quantity: num(value, "quantity"),
    completed: num(value, "completed"),
    batch: text(value, "batch"),
    external: bool(value, "external", false),
    sourceId: source.id,
    sourceName: source.name,
    destinationId: destination.id,
    destinationName: destination.name,
    salesOrderId: idOf(value, "sales_order"),
    creationDate: text(value, "creation_date"),
    startDate: text(value, "start_date"),
    targetDate: text(value, "target_date"),
    completionDate: text(value, "completion_date"),
    notes: text(value, "notes").trim(),
    link: text(value, "link"),
  };
}

export async function listBuildLines(id: string, build: number, offset: number): Promise<{ count: number; results: BuildLine[] }> {
  const value = await authed(
    id,
    withQuery(apiUrl(requireServer(id).server, "api/build/line/"), [
      ["limit", String(PAGE_LIMIT)],
      ["offset", String(offset)],
      ["build", String(build)],
      ["part_detail", "true"],
    ]),
  );
  const results = pageItems(value).flatMap((item) => {
    const linePk = idOf(item, "pk");
    if (!linePk) {
      return [];
    }
    const line: BuildLine = {
      pk: linePk,
      partId: idOf(item, "part"),
      partName: firstText([nested(item, "part_detail", "full_name"), nested(item, "part_detail", "name")]),
      thumbnail: nested(item, "part_detail", "thumbnail"),
      quantity: num(item, "quantity"),
      allocated: num(item, "allocated"),
      consumed: num(item, "consumed"),
      reference: text(item, "reference"),
      notes: text(item, "notes").trim(),
    };
    return [line];
  });
  return { count: pageCount(value, results), results };
}

export async function getBuildLine(id: string, pk: number): Promise<BuildLine> {
  const value = await authed(
    id,
    withQuery(apiUrl(requireServer(id).server, `api/build/line/${pk}/`), [["part_detail", "true"]]),
  );
  const found = idOf(value, "pk");
  if (!found) {
    throw fail("missingData", "物料行里没有 pk");
  }
  return {
    pk: found,
    partId: idOf(value, "part"),
    partName: firstText([nested(value, "part_detail", "full_name"), nested(value, "part_detail", "name")]),
    thumbnail: nested(value, "part_detail", "thumbnail"),
    quantity: num(value, "quantity"),
    allocated: num(value, "allocated"),
    consumed: num(value, "consumed"),
    reference: text(value, "reference"),
    notes: text(value, "notes").trim(),
  };
}

export async function listBuildAllocations(id: string, build: number): Promise<BuildAllocation[]> {
  const value = await authed(
    id,
    withQuery(apiUrl(requireServer(id).server, "api/build/item/"), [
      ["limit", String(PAGE_LIMIT)],
      ["offset", "0"],
      ["build", String(build)],
      ["part_detail", "true"],
      ["location_detail", "true"],
    ]),
  );
  return pageItems(value).flatMap((item) => {
    const itemPk = idOf(item, "pk");
    if (!itemPk) {
      return [];
    }
    return [
      {
        pk: itemPk,
        stockItemId: idOf(item, "stock_item"),
        partName: firstText([nested(item, "part_detail", "full_name"), nested(item, "part_detail", "name")]),
        thumbnail: nested(item, "part_detail", "thumbnail"),
        location: firstText([nested(item, "location_detail", "pathstring"), nested(item, "location_detail", "name")]),
        quantity: num(item, "quantity"),
      },
    ];
  });
}

export async function listBuildOutputs(id: string, build: number, offset: number): Promise<PartStockPage> {
  const value = await authed(
    id,
    withQuery(apiUrl(requireServer(id).server, "api/stock/"), [
      ["limit", String(PAGE_LIMIT)],
      ["offset", String(offset)],
      ["build", String(build)],
      ["part_detail", "true"],
      ["location_detail", "true"],
    ]),
  );
  const results = pageItems(value).flatMap((item) => {
    const itemPk = idOf(item, "pk");
    if (!itemPk) {
      return [];
    }
    const quantity = num(item, "quantity");
    const units = nested(item, "part_detail", "units");
    return [
      {
        pk: itemPk,
        partName: firstText([nested(item, "part_detail", "full_name"), nested(item, "part_detail", "name")]),
        location: firstText([nested(item, "location_detail", "pathstring"), nested(item, "location_detail", "name")]),
        quantity: units.trim() ? `${formatQty(quantity)} ${units.trim()}` : formatQty(quantity),
        thumbnail: nested(item, "part_detail", "thumbnail"),
      },
    ];
  });
  return { count: pageCount(value, results), results };
}

export async function listTransferOrders(id: string, search: string, offset: number): Promise<{ count: number; results: OrderSummary[] }> {
  const pairs: Array<[string, string]> = [
    ["limit", String(PAGE_LIMIT)],
    ["offset", String(offset)],
    ["ordering", "-creation_date"],
  ];
  if (search.trim()) {
    pairs.push(["search", search.trim()]);
  }
  const value = await authed(id, withQuery(apiUrl(requireServer(id).server, "api/order/transfer-order/"), pairs));
  const results = pageItems(value).flatMap((item) => {
    const pk = idOf(item, "pk");
    if (!pk) {
      return [];
    }
    const summary: OrderSummary = {
      pk,
      reference: text(item, "reference"),
      description: text(item, "description"),
      statusText: text(item, "status_text"),
      detail: "",
      thumbnail: "",
    };
    return [summary];
  });
  return { count: pageCount(value, results), results };
}

export async function getTransferOrder(id: string, pk: number): Promise<TransferOrderDetail> {
  const value = await authed(id, apiUrl(requireServer(id).server, `api/order/transfer-order/${pk}/`));
  const found = idOf(value, "pk");
  if (!found) {
    throw fail("missingData", "调拨单里没有 pk");
  }
  const [source, destination] = await Promise.all([
    placeName(id, value, "take_from_detail", "take_from"),
    placeName(id, value, "destination_detail", "destination"),
  ]);
  return {
    pk: found,
    reference: text(value, "reference"),
    description: text(value, "description"),
    statusText: text(value, "status_text"),
    sourceId: source.id,
    sourceName: source.name,
    destinationId: destination.id,
    destinationName: destination.name,
    consume: bool(value, "consume", false),
    lineCount: num(value, "line_items"),
    completedLines: num(value, "completed_lines"),
    creationDate: text(value, "creation_date"),
    startDate: text(value, "start_date"),
    targetDate: text(value, "target_date"),
    completionDate: text(value, "complete_date"),
    notes: text(value, "notes").trim(),
    link: text(value, "link"),
  };
}

export async function listTransferLines(id: string, order: number, offset: number): Promise<{ count: number; results: TransferLine[] }> {
  const value = await authed(
    id,
    withQuery(apiUrl(requireServer(id).server, "api/order/transfer-order-line/"), [
      ["limit", String(PAGE_LIMIT)],
      ["offset", String(offset)],
      ["order", String(order)],
      ["part_detail", "true"],
    ]),
  );
  const results = pageItems(value).flatMap((item) => {
    const linePk = idOf(item, "pk");
    if (!linePk) {
      return [];
    }
    const line: TransferLine = {
      pk: linePk,
      partId: idOf(item, "part"),
      partName: firstText([nested(item, "part_detail", "full_name"), nested(item, "part_detail", "name")]),
      thumbnail: nested(item, "part_detail", "thumbnail"),
      quantity: num(item, "quantity"),
      transferred: num(item, "transferred"),
      allocated: num(item, "allocated"),
      reference: text(item, "reference"),
      targetDate: text(item, "target_date"),
      notes: text(item, "notes").trim(),
    };
    return [line];
  });
  return { count: pageCount(value, results), results };
}

export async function getTransferLine(id: string, pk: number): Promise<TransferLine> {
  const value = await authed(
    id,
    withQuery(apiUrl(requireServer(id).server, `api/order/transfer-order-line/${pk}/`), [["part_detail", "true"]]),
  );
  const found = idOf(value, "pk");
  if (!found) {
    throw fail("missingData", "调拨行里没有 pk");
  }
  return {
    pk: found,
    partId: idOf(value, "part"),
    partName: firstText([nested(value, "part_detail", "full_name"), nested(value, "part_detail", "name")]),
    thumbnail: nested(value, "part_detail", "thumbnail"),
    quantity: num(value, "quantity"),
    transferred: num(value, "transferred"),
    allocated: num(value, "allocated"),
    reference: text(value, "reference"),
    targetDate: text(value, "target_date"),
    notes: text(value, "notes").trim(),
  };
}

export async function listTransferAllocations(id: string, line: number): Promise<TransferAllocation[]> {
  const value = await authed(
    id,
    withQuery(apiUrl(requireServer(id).server, "api/order/transfer-order-allocation/"), [
      ["limit", String(PAGE_LIMIT)],
      ["offset", "0"],
      ["line", String(line)],
      ["part_detail", "true"],
      ["location_detail", "true"],
      ["item_detail", "true"],
    ]),
  );
  return pageItems(value).flatMap((item) => {
    const itemPk = idOf(item, "pk");
    if (!itemPk) {
      return [];
    }
    return [
      {
        pk: itemPk,
        stockItemId: idOf(item, "item"),
        partName: firstText([nested(item, "part_detail", "full_name"), nested(item, "part_detail", "name")]),
        thumbnail: nested(item, "part_detail", "thumbnail"),
        location: firstText([nested(item, "location_detail", "pathstring"), nested(item, "location_detail", "name")]),
        serial: text(item, "serial"),
        quantity: num(item, "quantity"),
      },
    ];
  });
}

export async function listRecords(id: string, kind: string, search: string, offset: number): Promise<RecordPage> {
  const path = recordPath(kind);
  const pairs: Array<[string, string]> = [
    ["limit", String(PAGE_LIMIT)],
    ["offset", String(offset)],
  ];
  if (search.trim()) {
    pairs.push(["search", search.trim()]);
  }
  if (kind === "stock") {
    pairs.push(["part_detail", "true"]);
  }
  if (kind === "supplier") {
    pairs.push(["is_supplier", "true"]);
  }
  if (kind === "customer") {
    pairs.push(["is_customer", "true"]);
  }
  const value = await authed(id, withQuery(apiUrl(requireServer(id).server, path), pairs));
  const results = pageItems(value).flatMap((item) => {
    const parsed = parseRecord(kind, item);
    return parsed ? [parsed] : [];
  });
  return { count: pageCount(value, results), results };
}

function recordPath(kind: string): string {
  switch (kind) {
    case "stock":
      return "api/stock/";
    case "build":
      return "api/build/";
    case "purchase":
      return "api/order/po/";
    case "sales":
      return "api/order/so/";
    case "transfer":
      return "api/order/transfer-order/";
    case "supplier":
    case "customer":
      return "api/company/";
    default:
      throw fail("invalid", "未知的列表");
  }
}

function parseRecord(kind: string, value: unknown): RecordSummary | null {
  const pk = idOf(value, "pk");
  if (!pk) {
    return null;
  }
  if (kind === "stock") {
    const quantity = num(value, "quantity");
    const units = nested(value, "part_detail", "units");
    return {
      pk,
      title: firstText([nested(value, "part_detail", "full_name"), nested(value, "part_detail", "name"), text(value, "part__name")]),
      detail: firstText([text(value, "serial"), text(value, "batch"), nested(value, "location_detail", "name")]),
      trailing: units.trim() ? `${formatQty(quantity)} ${units.trim()}` : formatQty(quantity),
    };
  }
  if (kind === "build") {
    return {
      pk,
      title: text(value, "reference"),
      detail: firstText([text(value, "title"), text(value, "part_name")]),
      trailing: text(value, "status_text"),
    };
  }
  if (kind === "supplier" || kind === "customer") {
    return { pk, title: text(value, "name"), detail: text(value, "description"), trailing: "" };
  }
  return {
    pk,
    title: text(value, "reference"),
    detail: text(value, "description"),
    trailing: text(value, "status_text"),
  };
}

export async function loadPartImage(id: string, image: string): Promise<string> {
  return loadMedia(id, image, MAX_IMAGE_BYTES);
}

export async function loadPartThumbnail(id: string, thumbnail: string): Promise<string> {
  return loadMedia(id, thumbnail, MAX_THUMB_BYTES);
}

async function loadMedia(id: string, mediaPath: string, maxBytes: number): Promise<string> {
  const server = requireServer(id);
  const token = tokenFor(id);
  const url = resolveMedia(server.server, mediaPath);
  let response: Response;
  try {
    response = await fetch(url, { headers: { Accept: "image/*", Authorization: `Token ${token}` } });
  } catch {
    throw fail("network", "网络错误");
  }
  if (response.status === 401) {
    clearToken(id);
    throw fail("unauthorized", detailMessage(await response.text(), 401));
  }
  if (!response.ok) {
    throw fail(statusKind(response.status), detailMessage(await response.text(), response.status));
  }
  const type = response.headers.get("content-type") ?? "";
  if (!type.startsWith("image/")) {
    throw fail("missingData", "缩略图不是图片");
  }
  const blob = await response.blob();
  if (blob.size > maxBytes) {
    throw fail("invalid", maxBytes > MAX_THUMB_BYTES ? "图片太大" : "缩略图太大");
  }
  return URL.createObjectURL(blob);
}

function resolveMedia(base: string, mediaPath: string): string {
  const thumbnail = mediaPath.trim();
  if (!thumbnail) {
    throw fail("invalid", "没有缩略图");
  }
  const baseUrl = new URL(normalizeBase(base));
  let resolved: URL;
  try {
    resolved = thumbnail.includes("://") ? new URL(thumbnail) : new URL(thumbnail, baseUrl);
  } catch {
    throw fail("invalid", "缩略图地址无效");
  }
  if (resolved.protocol !== "http:" && resolved.protocol !== "https:") {
    throw fail("invalid", "缩略图地址无效");
  }
  if (resolved.host !== baseUrl.host) {
    throw fail("invalid", "缩略图不在这台服务器上");
  }
  return resolved.toString();
}

import type {
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
  SupplierPartDetail,
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
  localStorage.setItem(STORE_KEY, JSON.stringify(disk));
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
  init: { token?: string; basic?: string; method?: string; json?: unknown } = {},
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
      method: init.method ?? (init.json !== undefined ? "POST" : "GET"),
      headers,
      body: init.json !== undefined ? JSON.stringify(init.json) : undefined,
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

async function authed(id: string, url: string, init: { method?: string; json?: unknown } = {}) {
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

async function fetchServerInfo(base: string): Promise<ServerInfo> {
  const value = asObject(await request(apiUrl(base, "api/")));
  const version = text(value, "version").trim();
  if (!version) {
    throw fail("missingData", "响应里没有服务器版本");
  }
  const apiVersion = asObject(value)?.apiVersion;
  if (typeof apiVersion !== "number") {
    throw fail("missingData", "响应里没有 API 版本");
  }
  if (apiVersion < MIN_API) {
    throw fail("oldApi", `服务器 API 版本 ${apiVersion} 低于最低要求 ${MIN_API}`);
  }
  return { version, apiVersion, instance: text(value, "instance") };
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
      basic: `Basic ${btoa(`${userName}:${pass}`)}`,
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
): Promise<PartPage> {
  const base = requireServer(id).server;
  const query = search.trim();
  const pairs: Array<[string, string]> = [
    ["limit", String(PAGE_LIMIT)],
    ["offset", String(offset)],
  ];
  if (!query) {
    pairs.push(["category", category === null ? "null" : String(category)]);
  } else if (category !== null) {
    pairs.push(["category", String(category)], ["cascade", "true"], ["search", query]);
  } else {
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

export async function listSupplierParts(id: string, part: number, offset: number): Promise<SupplierPartPage> {
  const value = await authed(
    id,
    withQuery(apiUrl(requireServer(id).server, "api/company/part/"), [
      ["limit", String(PAGE_LIMIT)],
      ["offset", String(offset)],
      ["part", String(part)],
      ["supplier_detail", "true"],
      ["part_detail", "true"],
    ]),
  );
  const results = pageItems(value).flatMap((item) => {
    const pk = idOf(item, "pk");
    if (!pk) {
      return [];
    }
    const summary: SupplierPartSummary = {
      pk,
      sku: text(item, "SKU"),
      supplierName: nested(item, "supplier_detail", "name"),
      partName: firstText([nested(item, "part_detail", "full_name"), nested(item, "part_detail", "name")]),
      supplierImage: nested(item, "supplier_detail", "thumbnail") || nested(item, "supplier_detail", "image"),
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
    supplierName: nested(value, "supplier_detail", "name"),
    manufacturerName: nested(value, "manufacturer_detail", "name"),
    mpn: text(value, "MPN"),
    packaging: text(value, "packaging"),
    packQuantity: text(value, "pack_quantity"),
    link: text(value, "link"),
    note: text(value, "note").trim() || text(value, "notes"),
  };
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

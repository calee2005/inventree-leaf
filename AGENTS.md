# InvenTree Leaf

非官方的 InvenTree 手机客户端。官方 Flutter 应用在旁边的 `inventree-app` 仓库，只把它当作服务器档案、登录顺序和页面结构的参考。界面和业务请求重新设计，不复制那份实现。

## 技术

- React + TypeScript（Vite），纯浏览器应用
- 页面自己请求 InvenTree。服务器档案和 token 存在 `localStorage`，由 `src/browser/client.ts` 读写；界面只拿到业务数据，不读 token
- 本地用 `npm run dev`。发布到 NAS 用 `npm run test-release`，站点基址写在项目根的 `test-release.local`

## 目录

- `src/`：界面。文案用简体中文，保持薄，方便以后改交互
- `src/browser/client.ts`：URL、认证分支、响应解析、本地档案
- `src/api.ts`：界面调用的函数
- `docs/api/schema.yaml`：InvenTree API 530 的 OpenAPI 快照
- `docs/api/auth.md`：本客户端实际遵守的认证和零件列表约定

## 认证契约

1. `GET {base}api/` 探测服务器。`apiVersion` 低于 180 则拒绝。
2. `GET {base}api/user/me/token/?name=inventree-leaf`，Basic 认证。`apiVersion < 490` 时改打 `{base}api/user/token/`。
3. 保存 token 后，`GET {base}api/user/me/`，请求头 `Authorization: Token <value>`。
4. 零件第一页：`GET {base}api/part/?limit=50&offset=0`，同样带 token。

基址保留子路径：`http://host/inventree` 的 API 根是 `http://host/inventree/api/`。细节以 [docs/api/auth.md](docs/api/auth.md) 为准。新接口先查 [docs/api/schema.yaml](docs/api/schema.yaml)，再写 `src/browser/client.ts` 的解析，不要在界面里拼认证头。

页面和 API 需要能互相访问。部署在 `https://inventree.home.claude.ink/mobile/` 时，服务器地址应填同一站点，浏览器才能直接带上 `Authorization`。

## 接口

`list_servers`、`save_server`、`delete_server`、`select_server`、`test_connection`、`login`、`logout`、`current_user`、`list_parts`、`get_part`、`get_part_category`、`get_part_pricing`、`list_bom`、`get_bom_item`、`create_bom_item`、`update_bom_item`、`delete_bom_item`、`validate_bom_item`、`create_bom_substitute`、`delete_bom_substitute`、`list_part_stock`、`list_supplier_parts`、`get_supplier_part`、`list_part_categories`、`list_records`、`load_part_image`、`load_part_thumbnail`。

错误要带种类，界面据此区分网络失败、401 和 403。证书由浏览器校验，页面无法替用户信任无效证书。

## 不要做的事

- 不要把 `inventree-app` 的页面或 Dart API 封装抄进来
- 不要把 token 返回给界面

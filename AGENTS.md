# InvenTree Leaf

非官方的 InvenTree 手机客户端。官方 Flutter 应用在旁边的 `inventree-app` 仓库，只把它当作服务器档案和登录顺序的参考。界面和业务请求重新设计，不复制那份实现。

## 技术

- Tauri 2 + React + TypeScript（Vite）
- 网络和凭据在 Rust。界面通过 `invoke` 拿结果，不在 WebView 里 `fetch`，也不持有 token
- 产品目标是 iOS。Windows 用 `npm run tauri dev` 验证。Xcode 工程只在 macOS 上生成，见 [docs/ios.md](docs/ios.md)

## 目录

- `src/`：界面。文案用简体中文，保持薄，方便以后改交互
- `src-tauri/src/client.rs`：URL、认证分支、响应解析。纯函数放这里，并带单元测试
- `src-tauri/src/store.rs`：服务器档案与 token。token 用单独的键，退出登录只清 token
- `src-tauri/src/commands.rs`：Tauri 命令。每个命令返回 `Result`，并注册进 `generate_handler!`
- `docs/api/schema.yaml`：InvenTree API 530 的 OpenAPI 快照
- `docs/api/auth.md`：本客户端实际遵守的认证和零件列表约定

## 认证契约

1. `GET {base}api/` 探测服务器。`apiVersion` 低于 180 则拒绝。
2. `GET {base}api/user/me/token/?name=inventree-leaf`，Basic 认证。`apiVersion < 490` 时改打 `{base}api/user/token/`。
3. 保存 token 后，`GET {base}api/user/me/`，请求头 `Authorization: Token <value>`。
4. 零件第一页：`GET {base}api/part/?limit=50&offset=0`，同样带 token。

基址保留子路径：`http://host/inventree` 的 API 根是 `http://host/inventree/api/`。细节以 [docs/api/auth.md](docs/api/auth.md) 为准。新接口先查 [docs/api/schema.yaml](docs/api/schema.yaml)，再写 Rust 解析，不要在界面里拼认证头。

## 命令

`list_servers`、`save_server`、`delete_server`、`select_server`、`test_connection`、`login`、`logout`、`current_user`、`list_parts`、`get_part`、`list_part_stock`、`list_part_categories`、`list_records`、`load_part_thumbnail`。

错误要带种类，界面据此区分证书失败、网络失败、401 和 403。证书失败时由用户显式勾选信任该服务器，再重试。

## 不要做的事

- 不要把 `inventree-app` 的页面或 Dart API 封装抄进来
- 不要把 token 返回给界面
- 不要在 Windows 上执行 `tauri ios init`

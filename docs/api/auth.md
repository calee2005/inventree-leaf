# 认证与本阶段会调用的接口

行为对齐官方 App 的连接顺序：先探测服务器，再用用户名密码换 token，之后只带 token。界面重做，不复制官方界面。

最低 API 版本 **180**（InvenTree 0.14.0）。低于此版本时停止连接。

`apiVersion >= 490` 时用户接口走新路径。schema 530 只记录新路径；旧路径是为了还能登录更老的服务器。

| 用途 | `apiVersion >= 490` | 更旧的服务器 |
| --- | --- | --- |
| 换 token | `GET /api/user/me/token/` | `GET /api/user/token/` |
| 当前用户角色 | `GET /api/user/me/roles/` | `GET /api/user/roles/` |

登录后调用「当前用户」「零件列表」「零件类别」和缩略图。不拉取角色，也不提交创建、编辑或筛选。角色路径保留在客户端里，供以后使用。

## 探测服务器

`GET {base}api/`

不带认证。官方客户端用这个接口判断服务器是否在线。响应模型 `InfoApi`。本阶段读取：

- `version`：服务器版本，空字符串视为无效响应
- `apiVersion`：整数。低于 180 则拒绝
- `instance`：实例名，可空，仅展示

`InfoApi` 还包含 worker、插件、调试模式等字段。未提权调用时服务端可能把部分字段留空。

## 换 token

`GET {base}api/user/me/token/?name=inventree-leaf`

- 请求头：`Authorization: Basic base64(username:password)`，UTF-8
- 查询参数 `name` 会成为服务器上这条 token 的名字。同名旧 token 会被服务端删掉并新建，已有 token 不会再次从 API 读出
- 成功正文（`GetAuthToken`）：`token`、`name`、`expiry`
- 401 / 403：用户名或密码不正确。展示 `detail`，没有 `detail` 时展示状态码
- 2xx 但没有 `token`：响应当成无效

token 写入单独的存储项，不放进服务器档案。

## 确认会话

`GET {base}api/user/me/`

- 请求头：`Authorization: Token <value>`
- 成功模型 `MeUser`。本阶段使用 `pk`、`username`、`email`、`first_name`、`last_name`
- 非 2xx：清掉已保存的 token，回到未登录

## 零件列表

`GET {base}api/part/?limit=50&offset=0`，并按浏览位置加上查询参数。同样使用 `Authorization: Token <value>`。需要 `part` 的查看权限，否则 403。只取第一页。

| 位置 | 查询 |
| --- | --- |
| 「全部」，没有关键词 | `category=null`（只列未分类零件） |
| 某个类别，没有关键词 | `category=<id>`，不带 `cascade` |
| 「全部」里搜索 | `search=<关键词>` |
| 某个类别里搜索 | `category=<id>&cascade=true&search=<关键词>` |

200 的模型是 `PaginatedPartList`，`results` 的元素是 `Part`。个别旧服务器可能直接返回数组。列表行使用：

- `pk`、`name`、`IPN`、`description`
- `in_stock`：可能为 `null`，界面把空值显示为 0
- `units`：库存数字后面的单位，空则只显示数字
- `thumbnail`：图片地址。空、外站或下载失败时，界面保留灰色占位

卡片上只显示名称、缩略图和库存。IPN 与描述仍从响应里解析，当前不展示。不提交创建、编辑，也不实现零件详情。

## 零件类别

`GET {base}api/part/category/?limit=50&offset=0`

- 在「全部」时加 `top_level=true`
- 进入某个类别时改为 `parent=<id>`
- 有关键词时不请求类别，列表只保留零件搜索结果
- 需要类别的查看权限，否则 403
- 200 的模型是 `PaginatedCategoryList`。界面使用 `pk`、`name`
- 面包屑由界面按点击顺序记住，不另请求类别详情

## 缩略图

`thumbnail` 由 Rust 下载，界面只收到 data URL，不接触 token。

- 只接受与服务器相同主机、相同端口的 `http` 或 `https`
- 以 `/` 开头的路径接到站点根。`/media/...` 不挂在 API 子路径下
- 响应需要是 `image/*`，且不超过 2MB
- 空地址、外站地址、非图片或过大时不展示图片

## 档案

每台服务器保存：

- `id`
- `name`：显示名，不能空，也不能重名
- `server`：规范化后的基址
- `trustedCertificate`：为真时，该档案的 TLS 允许无效证书
- `selected`：当前选中的档案

退出登录只删除该档案的 token。

# 认证与本阶段会调用的接口

行为对齐官方 App 的连接顺序：先探测服务器，再用用户名密码换 token，之后只带 token。界面重做，不复制官方界面。

最低 API 版本 **180**（InvenTree 0.14.0）。低于此版本时停止连接。

`apiVersion >= 490` 时用户接口走新路径。schema 530 只记录新路径；旧路径是为了还能登录更老的服务器。

| 用途 | `apiVersion >= 490` | 更旧的服务器 |
| --- | --- | --- |
| 换 token | `GET /api/user/me/token/` | `GET /api/user/token/` |
| 当前用户角色 | `GET /api/user/me/roles/` | `GET /api/user/roles/` |

登录后调用「当前用户」「零件列表」「零件详情」「零件库存」「零件类别」和缩略图。不拉取角色，也不提交创建、编辑或筛选。角色路径保留在客户端里，供以后使用。

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

卡片上只显示名称、缩略图和库存。IPN 与描述仍从响应里解析，当前不展示。不提交创建或编辑。点开一张卡片后读取零件详情。

## 零件详情

`GET {base}api/part/{pk}/?category_detail=true&location_detail=true&parameters=true`

同样使用 `Authorization: Token <value>`。需要零件的查看权限，否则 403。界面使用：

- `pk`、`name`、`full_name`、`description`、`image`、`thumbnail`、`units`、`active`
- 宽图用 `image`。没有原图或原图下载失败时，才退回 `thumbnail`
- `category`：类别 id。详情里的「零件类别」用它打开类别页

类别页读取 `GET {base}api/part/category/{pk}/`，使用 `name`、`description`、`parent`、`pathstring`、`part_count`、`subcategories`。子类别沿用类别列表，`parent=<id>`；该类别下的零件沿用零件列表，`category=<id>`。没有类别时打开上一级，子类别用 `top_level=true`，零件用 `category=null`。
- `assembly`、`component`、`purchaseable`、`salable`
- `in_stock`、`category_name`（空则用 `category_detail.name`）
- `default_location_detail.pathstring`，空则用其中的 `name`
- `keywords`、`link`、`notes`、`variant_of`
- `parameters[].data` 和 `parameters[].template_detail` 的 `name`、`units`

详情加载后还会并行读取这些只用于计数或补充行的接口。其中某一个失败时，对应行留空，不把整页判失败：

| 用途 | 请求 |
| --- | --- |
| 上级模板 | `GET {base}api/part/{variant_of}/`，仅在 `variant_of` 有值时 |
| 变体数量 | `GET {base}api/part/?variant_of={pk}&limit=1` |
| 物料清单数量 | `GET {base}api/part/?in_bom_for={pk}&limit=1`，仅装配件 |
| 用于装配数量 | `GET {base}api/bom/?uses={pk}&limit=1`，仅元器件 |
| 供应商数量 | `GET {base}api/company/part/?part={pk}&limit=1`，仅可采购 |
| 附件数量 | `GET {base}api/attachment/?model_type=part&model_id={pk}&limit=1` |
| 价格区间 | `GET {base}api/part/{pk}/pricing/`，读 `currency`、`overall_min`、`overall_max` |

装配件的「物料清单」打开 `GET {base}api/bom/?part={pk}&part_detail=true&sub_part_detail=true`。组件的「用于装配」改为 `uses={pk}`。点物料行读取 `GET {base}api/bom/{id}/?part_detail=true&sub_part_detail=true&substitutes=true`。维护走 `POST /api/bom/`、`PATCH /api/bom/{id}/`、`DELETE /api/bom/{id}/`、`PUT /api/bom/{id}/validate/`，替代料走 `POST /api/bom/substitute/` 和 `DELETE /api/bom/substitute/{id}/`。

可采购且有供应商零件时，「供应商」打开 `GET {base}api/company/part/?part={pk}&supplier_detail=true&part_detail=true`。点开一条再读 `GET {base}api/company/part/{id}/`，并带上 `supplier_detail`、`part_detail`、`manufacturer_detail`。列表使用 `SKU`、供应商名称和缩略图；详情使用内部零件、是否主供应商、库存、供应商、供应商零件编号、制造商、MPN、包装、链接和备注。

价格行可以打开价格页，仍请求 `GET {base}api/part/{pk}/pricing/`。页面使用币种、总价区间、最低/最高覆盖价，以及内部成本、变体成本、物料清单成本、采购价格、供应商价格、销售价格和销售历史。变体成本只在 `is_template` 时显示，物料清单成本只在装配件显示，采购和供应商价格只在可采购时显示，销售两项只在可销售时显示。
| 需求 | `GET {base}api/part/{pk}/requirements/`，读在产、可生产、分配和在途数量 |

## 零件库存

`GET {base}api/stock/?part={pk}&part_detail=true&location_detail=true&limit=50&offset=0`

详情页的库存页使用。200 的模型是库存分页列表。每一行使用 `pk`、`quantity`、`part_detail` 的名称和缩略图，以及 `location_detail.pathstring`。

## 零件类别

`GET {base}api/part/category/?limit=50&offset=0`

- 在「全部」时加 `top_level=true`
- 进入某个类别时改为 `parent=<id>`
- 有关键词时不请求类别，列表只保留零件搜索结果
- 需要类别的查看权限，否则 403
- 200 的模型是 `PaginatedCategoryList`。界面使用 `pk`、`name`
- 面包屑由界面按点击顺序记住，不另请求类别详情

## 缩略图

`thumbnail` 由浏览器带着 token 下载。界面只收到图片地址，不接触 token。

- 只接受与服务器相同主机、相同端口的 `http` 或 `https`
- 以 `/` 开头的路径接到站点根。`/media/...` 不挂在 API 子路径下
- 响应需要是 `image/*`，且不超过 2MB
- 空地址、外站地址、非图片或过大时不展示图片

## 档案

每台服务器保存：

- `id`
- `name`：显示名，不能空，也不能重名
- `server`：规范化后的基址
- `trustedCertificate`：档案里保留。证书由浏览器校验
- `selected`：当前选中的档案

退出登录只删除该档案的 token。

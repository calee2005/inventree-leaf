# InvenTree API 本地规范

本目录是 InvenTree Leaf 使用的 API 约定。完整机器可读规范在 [schema.yaml](schema.yaml)。

## 版本与来源

- 文档站点：[InvenTree API 概览](https://docs.inventree.org/en/stable/api/)
- Schema 说明：[API Schema](https://docs.inventree.org/en/stable/api/schema/)，对应 **API version 530**
- 文件来源：[inventree/schema `export/530/api.yaml`](https://github.com/inventree/schema/blob/main/export/530/api.yaml)，许可证 MIT
- 拉取地址：`https://raw.githubusercontent.com/inventree/schema/refs/heads/main/export/530/api.yaml`

`schema.yaml` 的 `info.version` 必须保持 `530`。升级服务器支持范围时，更换这份快照并改这里的版本号。

## 客户端怎么用这份规范

- 路径、查询参数、响应字段以 `schema.yaml` 为准。
- 认证顺序和旧服务器分支见 [auth.md](auth.md)。那部分对齐官方移动端的连接流程，schema 530 里已经没有旧的 `/api/user/token/`。
- 业务请求从浏览器发出。token 由 `src/browser/client.ts` 保存，界面不读取。

## 通用约定

- 基址规范化后以 `/` 结尾。接口挂在 `{base}api/`，保留用户填写的子路径。`http://host:8000/inventree` 对应 `http://host:8000/inventree/api/`。
- 列表接口是 Django REST framework 分页。零件列表的响应模型是 `PaginatedPartList`：

```json
{
  "count": 123,
  "next": "http://host/api/part/?limit=50&offset=50",
  "previous": null,
  "results": []
}
```

- `count` 和 `results` 必有。`next` / `previous` 没有下一页或上一页时为 `null`。个别旧服务器可能直接返回数组，客户端要同时接受这两种形态。
- 查询参数 `limit`、`offset` 控制页大小和起点。当前客户端固定 `limit=50`、`offset=0`。
- 认证失败返回 **401**。已登录但角色不够返回 **403**。零件列表需要角色 `part` 的查看权限（OAuth scope `r:view:part`）。
- 错误正文常见字段是 `detail`。客户端把这段原文展示出来。

## 安全方案

`schema.yaml` 的 `securitySchemes`：

| 方案 | 用法 |
| --- | --- |
| `basicAuth` | HTTP Basic。只在换 token 时使用 |
| `tokenAuth` | 请求头 `Authorization: Token <value>`。`Token` 前缀和空格都要保留 |
| `cookieAuth` | 浏览器会话，本客户端不用 |
| `oauth2` | 实验功能，本客户端不用 |

后续接口的字段和参数直接查 `schema.yaml` 里的 `operationId`，不要在这里再抄一整份。

# iOS 构建

仓库按 Tauri 2 移动端方式组织：业务在 `src-tauri/src/lib.rs`，`main.rs` 只转调 `run()`。Windows 上可以 `npm run tauri dev` 做桌面验证。生成 Xcode 工程和签名必须在 macOS 上做。

在 Mac 上，装好 Xcode 与 Rust iOS 目标后：

```bash
rustup target add aarch64-apple-ios aarch64-apple-ios-sim
npm install
npm run tauri ios init
npm run tauri ios dev
```

## 允许访问用户填写的服务器

InvenTree 常部署在局域网 HTTP 或自签 HTTPS 上。请求由 Rust 的 `reqwest` 发出，不经过 WKWebView，因此 ATS 不会拦住这些请求。若以后有 WebView 自己加载的页面或图片，需要在 iOS 工程的 `Info.plist` 里允许任意加载：

```xml
<key>NSAppTransportSecurity</key>
<dict>
  <key>NSAllowsArbitraryLoads</key>
  <true/>
</dict>
```

无效证书只在该服务器档案勾选了「信任无效证书」时放开，不要全局关闭证书校验。

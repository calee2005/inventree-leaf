use base64::Engine;
use reqwest::Url;
use serde::Serialize;
use serde_json::Value;
use std::time::Duration;

pub const MIN_API_VERSION: i64 = 180;
pub const NEW_USER_API_VERSION: i64 = 490;
pub const TOKEN_NAME: &str = "inventree-leaf";
pub const PART_PAGE_LIMIT: u32 = 50;

#[derive(Debug, thiserror::Error)]
pub enum ClientError {
    #[error("{0}")]
    Invalid(String),
    #[error("{0}")]
    Network(String),
    #[error("{0}")]
    Certificate(String),
    #[error("{0}")]
    Unauthorized(String),
    #[error("{0}")]
    Forbidden(String),
    #[error("{0}")]
    Http(String),
    #[error("服务器 API 版本 {api} 低于最低要求 {required}")]
    OldApi { api: i64, required: i64 },
    #[error("{0}")]
    MissingData(String),
    #[error("尚未登录这台服务器")]
    NotLoggedIn,
    #[error("{0}")]
    NotFound(String),
    #[error("{0}")]
    Storage(String),
}

impl ClientError {
    pub fn kind(&self) -> &'static str {
        match self {
            Self::Invalid(_) => "invalid",
            Self::Network(_) => "network",
            Self::Certificate(_) => "certificate",
            Self::Unauthorized(_) => "unauthorized",
            Self::Forbidden(_) => "forbidden",
            Self::Http(_) => "http",
            Self::OldApi { .. } => "oldApi",
            Self::MissingData(_) => "missingData",
            Self::NotLoggedIn => "notLoggedIn",
            Self::NotFound(_) => "notFound",
            Self::Storage(_) => "storage",
        }
    }

    pub fn message(&self) -> String {
        self.to_string()
    }
}

impl Serialize for ClientError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        use serde::ser::SerializeStruct;
        let mut state = serializer.serialize_struct("ClientError", 2)?;
        state.serialize_field("kind", self.kind())?;
        state.serialize_field("message", &self.message())?;
        state.end()
    }
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ServerInfo {
    pub version: String,
    pub api_version: i64,
    pub instance: String,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionUser {
    pub pk: i64,
    pub username: String,
    pub email: String,
    pub first_name: String,
    pub last_name: String,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PartSummary {
    pub pk: i64,
    pub name: String,
    pub ipn: String,
    pub description: String,
    pub in_stock: f64,
    pub units: String,
    pub thumbnail: String,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PartPage {
    pub count: i64,
    pub results: Vec<PartSummary>,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CategorySummary {
    pub pk: i64,
    pub name: String,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CategoryPage {
    pub count: i64,
    pub results: Vec<CategorySummary>,
}

pub const MAX_THUMBNAIL_BYTES: usize = 2 * 1024 * 1024;

pub fn normalize_base(input: &str) -> Result<String, ClientError> {
    let trimmed = input.trim();
    if trimmed.is_empty() {
        return Err(ClientError::Invalid("请填写服务器地址".into()));
    }

    let mut url = Url::parse(trimmed)
        .map_err(|_| ClientError::Invalid("地址需要以 http:// 或 https:// 开头".into()))?;

    if url.scheme() != "http" && url.scheme() != "https" {
        return Err(ClientError::Invalid("只支持 http 或 https".into()));
    }
    if !url.username().is_empty() || url.password().is_some() {
        return Err(ClientError::Invalid(
            "请不要把用户名和密码写在地址里".into(),
        ));
    }
    if url.host_str().is_none() {
        return Err(ClientError::Invalid("地址缺少主机名".into()));
    }

    let mut path = url.path().trim_end_matches('/').to_string();
    if path.ends_with("/api") {
        path.truncate(path.len() - "/api".len());
    }
    if path.is_empty() {
        path = "/".into();
    } else if !path.ends_with('/') {
        path.push('/');
    }

    url.set_path(&path);
    url.set_query(None);
    url.set_fragment(None);
    Ok(url.to_string())
}

pub fn api_url(base: &str, path: &str) -> Result<String, ClientError> {
    let base = normalize_base(base)?;
    Ok(format!("{base}{}", path.trim_start_matches('/')))
}

pub fn token_path(api_version: i64) -> &'static str {
    if api_version >= NEW_USER_API_VERSION {
        "api/user/me/token/"
    } else {
        "api/user/token/"
    }
}

/// 本阶段不请求角色。路径按官方客户端的版本分支留好，避免以后再猜。
#[allow(dead_code)]
pub fn roles_path(api_version: i64) -> &'static str {
    if api_version >= NEW_USER_API_VERSION {
        "api/user/me/roles/"
    } else {
        "api/user/roles/"
    }
}

pub fn token_url(base: &str, api_version: i64) -> Result<String, ClientError> {
    Ok(format!(
        "{}?name={TOKEN_NAME}",
        api_url(base, token_path(api_version))?
    ))
}

pub fn basic_auth_header(username: &str, password: &str) -> String {
    let raw = format!("{username}:{password}");
    let encoded = base64::engine::general_purpose::STANDARD.encode(raw.as_bytes());
    format!("Basic {encoded}")
}

pub fn parse_server_info(body: &str) -> Result<ServerInfo, ClientError> {
    let value: Value = serde_json::from_str(body)
        .map_err(|_| ClientError::MissingData("服务器响应不是 JSON".into()))?;
    let version = value
        .get("version")
        .and_then(Value::as_str)
        .unwrap_or("")
        .trim()
        .to_string();
    if version.is_empty() {
        return Err(ClientError::MissingData("响应里没有服务器版本".into()));
    }
    let api_version = value
        .get("apiVersion")
        .and_then(Value::as_i64)
        .ok_or_else(|| ClientError::MissingData("响应里没有 API 版本".into()))?;
    if api_version < MIN_API_VERSION {
        return Err(ClientError::OldApi {
            api: api_version,
            required: MIN_API_VERSION,
        });
    }
    let instance = value
        .get("instance")
        .and_then(Value::as_str)
        .unwrap_or("")
        .to_string();
    Ok(ServerInfo {
        version,
        api_version,
        instance,
    })
}

pub fn parse_token(body: &str) -> Result<String, ClientError> {
    let value: Value = serde_json::from_str(body)
        .map_err(|_| ClientError::MissingData("登录响应不是 JSON".into()))?;
    let token = value
        .get("token")
        .and_then(Value::as_str)
        .unwrap_or("")
        .trim()
        .to_string();
    if token.is_empty() {
        return Err(ClientError::MissingData("登录响应里没有 token".into()));
    }
    Ok(token)
}

pub fn parse_session_user(body: &str) -> Result<SessionUser, ClientError> {
    let value: Value = serde_json::from_str(body)
        .map_err(|_| ClientError::MissingData("用户信息不是 JSON".into()))?;
    let pk = value
        .get("pk")
        .and_then(Value::as_i64)
        .ok_or_else(|| ClientError::MissingData("用户信息里没有 pk".into()))?;
    Ok(SessionUser {
        pk,
        username: string_field(&value, "username"),
        email: string_field(&value, "email"),
        first_name: string_field(&value, "first_name"),
        last_name: string_field(&value, "last_name"),
    })
}

pub fn parse_part_page(body: &str) -> Result<PartPage, ClientError> {
    let value: Value = serde_json::from_str(body)
        .map_err(|_| ClientError::MissingData("零件列表不是 JSON".into()))?;

    if let Some(items) = value.as_array() {
        let results = parse_part_rows(items);
        return Ok(PartPage {
            count: results.len() as i64,
            results,
        });
    }

    let results = value
        .get("results")
        .and_then(Value::as_array)
        .map(|items| parse_part_rows(items))
        .unwrap_or_default();
    let count = value
        .get("count")
        .and_then(Value::as_i64)
        .unwrap_or(results.len() as i64);
    Ok(PartPage { count, results })
}

fn parse_part_rows(items: &[Value]) -> Vec<PartSummary> {
    items.iter().filter_map(parse_part).collect()
}

fn parse_part(value: &Value) -> Option<PartSummary> {
    let pk = value.get("pk").and_then(Value::as_i64)?;
    Some(PartSummary {
        pk,
        name: string_field(value, "name"),
        ipn: string_field(value, "IPN"),
        description: string_field(value, "description"),
        in_stock: value.get("in_stock").and_then(Value::as_f64).unwrap_or(0.0),
        units: string_field(value, "units"),
        thumbnail: string_field(value, "thumbnail"),
    })
}

pub fn parse_category_page(body: &str) -> Result<CategoryPage, ClientError> {
    let value: Value = serde_json::from_str(body)
        .map_err(|_| ClientError::MissingData("类别列表不是 JSON".into()))?;

    if let Some(items) = value.as_array() {
        let results = parse_category_rows(items);
        return Ok(CategoryPage {
            count: results.len() as i64,
            results,
        });
    }

    let results = value
        .get("results")
        .and_then(Value::as_array)
        .map(|items| parse_category_rows(items))
        .unwrap_or_default();
    let count = value
        .get("count")
        .and_then(Value::as_i64)
        .unwrap_or(results.len() as i64);
    Ok(CategoryPage { count, results })
}

fn parse_category_rows(items: &[Value]) -> Vec<CategorySummary> {
    items.iter().filter_map(parse_category).collect()
}

fn parse_category(value: &Value) -> Option<CategorySummary> {
    let pk = value.get("pk").and_then(Value::as_i64)?;
    Some(CategorySummary {
        pk,
        name: string_field(value, "name"),
    })
}

pub fn part_list_url(
    base: &str,
    category: Option<i64>,
    search: &str,
    offset: u32,
) -> Result<String, ClientError> {
    let search = search.trim();
    let mut pairs = vec![
        ("limit", PART_PAGE_LIMIT.to_string()),
        ("offset", offset.to_string()),
    ];
    if search.is_empty() {
        pairs.push((
            "category",
            match category {
                Some(id) => id.to_string(),
                None => "null".to_string(),
            },
        ));
    } else if let Some(id) = category {
        pairs.push(("category", id.to_string()));
        pairs.push(("cascade", "true".to_string()));
        pairs.push(("search", search.to_string()));
    } else {
        pairs.push(("search", search.to_string()));
    }
    with_query(&api_url(base, "api/part/")?, &pairs)
}

pub fn category_list_url(
    base: &str,
    parent: Option<i64>,
    offset: u32,
) -> Result<String, ClientError> {
    let mut pairs = vec![
        ("limit", PART_PAGE_LIMIT.to_string()),
        ("offset", offset.to_string()),
    ];
    if let Some(id) = parent {
        pairs.push(("parent", id.to_string()));
    } else {
        pairs.push(("top_level", "true".to_string()));
    }
    with_query(&api_url(base, "api/part/category/")?, &pairs)
}

fn with_query(url: &str, pairs: &[(&str, String)]) -> Result<String, ClientError> {
    let mut parsed = Url::parse(url).map_err(|_| ClientError::Invalid("地址无效".into()))?;
    {
        let mut query = parsed.query_pairs_mut();
        for (key, value) in pairs {
            query.append_pair(key, value);
        }
    }
    Ok(parsed.into())
}

pub fn resolve_media_url(base: &str, thumbnail: &str) -> Result<String, ClientError> {
    let thumbnail = thumbnail.trim();
    if thumbnail.is_empty() {
        return Err(ClientError::Invalid("没有缩略图".into()));
    }
    let base_url = Url::parse(&normalize_base(base)?)
        .map_err(|_| ClientError::Invalid("服务器地址无效".into()))?;
    let resolved = if thumbnail.contains("://") {
        Url::parse(thumbnail).map_err(|_| ClientError::Invalid("缩略图地址无效".into()))?
    } else {
        base_url
            .join(thumbnail)
            .map_err(|_| ClientError::Invalid("缩略图地址无效".into()))?
    };
    if resolved.scheme() != "http" && resolved.scheme() != "https" {
        return Err(ClientError::Invalid("缩略图地址无效".into()));
    }
    if !same_endpoint(&base_url, &resolved) {
        return Err(ClientError::Invalid("缩略图不在这台服务器上".into()));
    }
    Ok(resolved.to_string())
}

fn same_endpoint(left: &Url, right: &Url) -> bool {
    left.scheme() == right.scheme()
        && left.host() == right.host()
        && left.port_or_known_default() == right.port_or_known_default()
}

pub fn image_data_url(content_type: &str, bytes: &[u8]) -> Result<String, ClientError> {
    if bytes.is_empty() {
        return Err(ClientError::MissingData("缩略图是空的".into()));
    }
    if bytes.len() > MAX_THUMBNAIL_BYTES {
        return Err(ClientError::Invalid("缩略图太大".into()));
    }
    let mime = content_type.split(';').next().unwrap_or("").trim();
    if !mime.starts_with("image/") || mime.contains('"') || mime.contains(' ') {
        return Err(ClientError::MissingData("缩略图不是图片".into()));
    }
    let encoded = base64::engine::general_purpose::STANDARD.encode(bytes);
    Ok(format!("data:{mime};base64,{encoded}"))
}

fn string_field(value: &Value, key: &str) -> String {
    value
        .get(key)
        .and_then(Value::as_str)
        .unwrap_or("")
        .to_string()
}

fn detail_message(body: &str, status: u16) -> String {
    let parsed: Option<Value> = serde_json::from_str(body).ok();
    if let Some(detail) = parsed.as_ref().and_then(|value| value.get("detail")) {
        if let Some(text) = detail.as_str() {
            if !text.trim().is_empty() {
                return text.trim().to_string();
            }
        } else if !detail.is_null() {
            return detail.to_string();
        }
    }
    format!("服务器返回 {status}")
}

fn status_error(status: u16, body: &str) -> ClientError {
    let message = detail_message(body, status);
    match status {
        401 => ClientError::Unauthorized(message),
        403 => ClientError::Forbidden(message),
        _ => ClientError::Http(message),
    }
}

fn map_reqwest(err: reqwest::Error) -> ClientError {
    if err.is_timeout() {
        return ClientError::Network("连接超时".into());
    }
    if is_cert_error(&err) {
        return ClientError::Certificate(
            "证书校验失败。可以勾选信任这台服务器的证书后再试。".into(),
        );
    }
    ClientError::Network(format!("网络错误：{err}"))
}

fn is_cert_error(err: &reqwest::Error) -> bool {
    let mut current: Option<&(dyn std::error::Error + 'static)> = Some(err);
    while let Some(source) = current {
        let text = source.to_string().to_lowercase();
        if text.contains("certificate")
            || text.contains("unknownissuer")
            || text.contains("invalid peer")
        {
            return true;
        }
        current = source.source();
    }
    false
}

fn http_client(trust_invalid_certs: bool) -> Result<reqwest::Client, ClientError> {
    reqwest::Client::builder()
        .danger_accept_invalid_certs(trust_invalid_certs)
        .timeout(Duration::from_secs(30))
        .user_agent("inventree-leaf")
        .build()
        .map_err(|err| ClientError::Network(format!("无法创建 HTTP 客户端：{err}")))
}

async fn get_text(
    url: &str,
    trust_invalid_certs: bool,
    authorization: Option<&str>,
) -> Result<String, ClientError> {
    let client = http_client(trust_invalid_certs)?;
    let mut request = client.get(url).header("Accept", "application/json");
    if let Some(authorization) = authorization {
        request = request.header("Authorization", authorization);
    }
    let response = request.send().await.map_err(map_reqwest)?;
    let status = response.status().as_u16();
    let body = response.text().await.map_err(map_reqwest)?;
    if !(200..300).contains(&status) {
        return Err(status_error(status, &body));
    }
    Ok(body)
}

pub async fn fetch_server_info(
    base: &str,
    trust_invalid_certs: bool,
) -> Result<ServerInfo, ClientError> {
    let url = api_url(base, "api/")?;
    let body = get_text(&url, trust_invalid_certs, None).await?;
    parse_server_info(&body)
}

pub async fn login(
    base: &str,
    trust_invalid_certs: bool,
    username: &str,
    password: &str,
) -> Result<(String, SessionUser), ClientError> {
    let username = username.trim();
    let password = password.trim();
    if username.is_empty() || password.is_empty() {
        return Err(ClientError::Invalid("请填写用户名和密码".into()));
    }

    let info = fetch_server_info(base, trust_invalid_certs).await?;
    let url = token_url(base, info.api_version)?;
    let body = get_text(
        &url,
        trust_invalid_certs,
        Some(&basic_auth_header(username, password)),
    )
    .await?;
    let token = parse_token(&body)?;
    let user = fetch_me(base, trust_invalid_certs, &token).await?;
    Ok((token, user))
}

pub async fn fetch_me(
    base: &str,
    trust_invalid_certs: bool,
    token: &str,
) -> Result<SessionUser, ClientError> {
    let url = api_url(base, "api/user/me/")?;
    let body = get_text(&url, trust_invalid_certs, Some(&format!("Token {token}"))).await?;
    parse_session_user(&body)
}

pub async fn fetch_parts(
    base: &str,
    trust_invalid_certs: bool,
    token: &str,
    category: Option<i64>,
    search: &str,
    offset: u32,
) -> Result<PartPage, ClientError> {
    let url = part_list_url(base, category, search, offset)?;
    let body = get_text(&url, trust_invalid_certs, Some(&format!("Token {token}"))).await?;
    parse_part_page(&body)
}

pub async fn fetch_categories(
    base: &str,
    trust_invalid_certs: bool,
    token: &str,
    parent: Option<i64>,
    offset: u32,
) -> Result<CategoryPage, ClientError> {
    let url = category_list_url(base, parent, offset)?;
    let body = get_text(&url, trust_invalid_certs, Some(&format!("Token {token}"))).await?;
    parse_category_page(&body)
}

pub async fn fetch_part_thumbnail(
    base: &str,
    trust_invalid_certs: bool,
    token: &str,
    thumbnail: &str,
) -> Result<String, ClientError> {
    let url = resolve_media_url(base, thumbnail)?;
    let client = http_client(trust_invalid_certs)?;
    let response = client
        .get(&url)
        .header("Accept", "image/*")
        .header("Authorization", format!("Token {token}"))
        .send()
        .await
        .map_err(map_reqwest)?;
    let status = response.status().as_u16();
    if !(200..300).contains(&status) {
        let body = response.text().await.map_err(map_reqwest)?;
        return Err(status_error(status, &body));
    }
    let final_url = response.url().clone();
    let base_url = Url::parse(&normalize_base(base)?)
        .map_err(|_| ClientError::Invalid("服务器地址无效".into()))?;
    if !same_endpoint(&base_url, &final_url) {
        return Err(ClientError::Invalid("缩略图不在这台服务器上".into()));
    }
    if response
        .content_length()
        .is_some_and(|length| length > MAX_THUMBNAIL_BYTES as u64)
    {
        return Err(ClientError::Invalid("缩略图太大".into()));
    }
    let mime = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .unwrap_or("")
        .to_string();
    let bytes = response.bytes().await.map_err(map_reqwest)?;
    image_data_url(&mime, &bytes)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalizes_server_urls() {
        assert_eq!(
            normalize_base("  https://demo.example.com  ").unwrap(),
            "https://demo.example.com/"
        );
        assert_eq!(
            normalize_base("https://demo.example.com/").unwrap(),
            "https://demo.example.com/"
        );
        assert_eq!(
            normalize_base("https://demo.example.com/inventree").unwrap(),
            "https://demo.example.com/inventree/"
        );
        assert_eq!(
            normalize_base("https://demo.example.com/inventree/api/").unwrap(),
            "https://demo.example.com/inventree/"
        );
        assert_eq!(
            normalize_base("http://192.168.1.20:8000").unwrap(),
            "http://192.168.1.20:8000/"
        );
        assert_eq!(
            normalize_base("http://[::1]:8000/api").unwrap(),
            "http://[::1]:8000/"
        );
        assert!(normalize_base("ftp://example.com").is_err());
        assert!(normalize_base("demo.example.com").is_err());
        assert!(normalize_base("").is_err());
        assert!(normalize_base("https://user:pass@example.com").is_err());
    }

    #[test]
    fn normalize_is_idempotent_and_joins_api() {
        let once = normalize_base("https://demo.example.com/inventree").unwrap();
        let twice = normalize_base(&once).unwrap();
        assert_eq!(once, twice);
        assert_eq!(
            api_url(&once, "api/part/").unwrap(),
            "https://demo.example.com/inventree/api/part/"
        );
    }

    #[test]
    fn picks_token_and_role_paths_by_api_version() {
        assert_eq!(token_path(530), "api/user/me/token/");
        assert_eq!(token_path(489), "api/user/token/");
        assert_eq!(roles_path(490), "api/user/me/roles/");
        assert_eq!(roles_path(180), "api/user/roles/");
        assert_eq!(
            token_url("https://demo.example.com", 180).unwrap(),
            "https://demo.example.com/api/user/token/?name=inventree-leaf"
        );
    }

    #[test]
    fn encodes_basic_auth() {
        assert_eq!(basic_auth_header("user", "pass"), "Basic dXNlcjpwYXNz");
    }

    #[test]
    fn parses_server_info() {
        let info =
            parse_server_info(r#"{"version":"0.17.0","apiVersion":530,"instance":"lab"}"#).unwrap();
        assert_eq!(info.version, "0.17.0");
        assert_eq!(info.api_version, 530);
        assert_eq!(info.instance, "lab");
        assert_eq!(
            parse_server_info(r#"{"version":"","apiVersion":530}"#)
                .unwrap_err()
                .kind(),
            "missingData"
        );
        assert_eq!(
            parse_server_info(r#"{"version":"0.13.0","apiVersion":100}"#)
                .unwrap_err()
                .kind(),
            "oldApi"
        );
        assert!(parse_server_info("not-json").is_err());
    }

    #[test]
    fn parses_token_and_http_errors() {
        assert_eq!(
            parse_token(r#"{"token":"abc","name":"inventree-leaf"}"#).unwrap(),
            "abc"
        );
        assert!(parse_token(r#"{"token":""}"#).is_err());
        let unauthorized = status_error(401, r#"{"detail":"Invalid username/password"}"#);
        assert_eq!(unauthorized.kind(), "unauthorized");
        assert_eq!(unauthorized.message(), "Invalid username/password");
        assert_eq!(status_error(403, "{}").kind(), "forbidden");
        assert_eq!(status_error(500, "").message(), "服务器返回 500");
    }

    #[test]
    fn parses_paginated_and_raw_part_lists() {
        let page = parse_part_page(
            r#"{"count":2,"next":null,"previous":null,"results":[
                {"pk":4,"name":"电阻","IPN":"R-10K","description":"10k","in_stock":12,"units":"g","thumbnail":"/media/a.png"},
                {"pk":5,"name":"空库存","IPN":"","description":"","in_stock":null}
            ]}"#,
        )
        .unwrap();
        assert_eq!(page.count, 2);
        assert_eq!(page.results[0].ipn, "R-10K");
        assert_eq!(page.results[0].in_stock, 12.0);
        assert_eq!(page.results[0].units, "g");
        assert_eq!(page.results[0].thumbnail, "/media/a.png");
        assert_eq!(page.results[1].in_stock, 0.0);
        assert_eq!(page.results[1].units, "");
        assert_eq!(page.results[1].thumbnail, "");

        let raw =
            parse_part_page(r#"[{"pk":1,"name":"螺丝","IPN":"S","description":"","in_stock":3}]"#)
                .unwrap();
        assert_eq!(raw.count, 1);
        assert_eq!(raw.results[0].name, "螺丝");
    }

    #[test]
    fn parses_category_lists() {
        let page = parse_category_page(
            r#"{"count":1,"results":[{"pk":8,"name":"耗材","pathstring":"耗材"}]}"#,
        )
        .unwrap();
        assert_eq!(page.count, 1);
        assert_eq!(page.results[0].name, "耗材");
        let raw = parse_category_page(r#"[{"pk":2,"name":"3D打印耗材"}]"#).unwrap();
        assert_eq!(raw.results[0].pk, 2);
    }

    #[test]
    fn builds_part_and_category_urls() {
        let base = "https://demo.example.com/inventree";
        assert_eq!(
            part_list_url(base, None, "", 0).unwrap(),
            "https://demo.example.com/inventree/api/part/?limit=50&offset=0&category=null"
        );
        assert_eq!(
            part_list_url(base, Some(7), "  ", 0).unwrap(),
            "https://demo.example.com/inventree/api/part/?limit=50&offset=0&category=7"
        );
        assert_eq!(
            part_list_url(base, None, "pla", 0).unwrap(),
            "https://demo.example.com/inventree/api/part/?limit=50&offset=0&search=pla"
        );
        assert_eq!(
            part_list_url(base, Some(3), "黄 色", 50).unwrap(),
            "https://demo.example.com/inventree/api/part/?limit=50&offset=50&category=3&cascade=true&search=%E9%BB%84+%E8%89%B2"
        );
        assert_eq!(
            category_list_url(base, None, 0).unwrap(),
            "https://demo.example.com/inventree/api/part/category/?limit=50&offset=0&top_level=true"
        );
        assert_eq!(
            category_list_url(base, Some(8), 0).unwrap(),
            "https://demo.example.com/inventree/api/part/category/?limit=50&offset=0&parent=8"
        );
    }

    #[test]
    fn resolves_thumbnail_urls_on_the_same_server() {
        let base = "https://demo.example.com/inventree";
        assert_eq!(
            resolve_media_url(base, "/media/a.png").unwrap(),
            "https://demo.example.com/media/a.png"
        );
        assert_eq!(
            resolve_media_url(base, "https://demo.example.com/media/b.png").unwrap(),
            "https://demo.example.com/media/b.png"
        );
        assert_eq!(
            resolve_media_url("http://192.168.1.20:8000", "/media/c.png").unwrap(),
            "http://192.168.1.20:8000/media/c.png"
        );
        assert!(resolve_media_url(base, "").is_err());
        assert!(resolve_media_url(base, "https://evil.example/a.png").is_err());
        assert!(resolve_media_url(base, "javascript:alert(1)").is_err());
    }

    #[test]
    fn builds_image_data_urls() {
        let url = image_data_url("image/png; charset=binary", b"png").unwrap();
        assert_eq!(url, "data:image/png;base64,cG5n");
        assert!(image_data_url("text/html", b"<p>").is_err());
        assert!(image_data_url("image/png", b"").is_err());
        assert!(image_data_url("image/png", &vec![0; MAX_THUMBNAIL_BYTES + 1]).is_err());
    }
}

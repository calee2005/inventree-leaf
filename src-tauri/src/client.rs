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
    pub pathstring: String,
    pub part_count: i64,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PartCategory {
    pub pk: i64,
    pub name: String,
    pub description: String,
    pub parent_id: Option<i64>,
    pub parent_path: String,
    pub part_count: i64,
    pub subcategory_count: i64,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CategoryPage {
    pub count: i64,
    pub results: Vec<CategorySummary>,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecordSummary {
    pub pk: i64,
    pub title: String,
    pub detail: String,
    pub trailing: String,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecordPage {
    pub count: i64,
    pub results: Vec<RecordSummary>,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PartParameter {
    pub name: String,
    pub value: String,
    pub units: String,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PartDetail {
    pub pk: i64,
    pub name: String,
    pub full_name: String,
    pub description: String,
    pub thumbnail: String,
    pub image: String,
    pub units: String,
    pub active: bool,
    pub assembly: bool,
    pub component: bool,
    pub purchaseable: bool,
    pub salable: bool,
    pub in_stock: f64,
    pub category_name: String,
    pub category_id: Option<i64>,
    pub location: String,
    pub keywords: String,
    pub link: String,
    pub notes: String,
    pub template_pk: Option<i64>,
    pub template_name: String,
    pub template_thumbnail: String,
    pub variant_count: i64,
    pub bom_count: i64,
    pub used_in_count: i64,
    pub supplier_count: i64,
    pub attachment_count: i64,
    pub building: f64,
    pub scheduled_to_build: f64,
    pub can_build: Option<f64>,
    pub allocated_to_build: f64,
    pub required_for_build: f64,
    pub allocated_to_sales: f64,
    pub required_for_sales: f64,
    pub ordering: f64,
    pub price_label: Option<String>,
    pub is_template: bool,
    pub parameters: Vec<PartParameter>,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PartPriceDetail {
    pub currency: String,
    pub price_range: String,
    pub override_min: String,
    pub override_max: String,
    pub internal_cost: String,
    pub variant_cost: String,
    pub bom_cost: String,
    pub purchase_price: String,
    pub supplier_price: String,
    pub sale_price: String,
    pub sale_history: String,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SupplierPartSummary {
    pub pk: i64,
    pub sku: String,
    pub supplier_name: String,
    pub part_name: String,
    pub supplier_image: String,
    pub in_stock: f64,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SupplierPartPage {
    pub count: i64,
    pub results: Vec<SupplierPartSummary>,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SupplierPartDetail {
    pub pk: i64,
    pub sku: String,
    pub active: bool,
    pub primary: bool,
    pub in_stock: f64,
    pub part_id: i64,
    pub part_name: String,
    pub supplier_name: String,
    pub manufacturer_name: String,
    pub mpn: String,
    pub packaging: String,
    pub pack_quantity: String,
    pub link: String,
    pub note: String,
}

#[derive(Debug, Clone, PartialEq)]
pub struct PartRequirements {
    pub building: f64,
    pub scheduled_to_build: f64,
    pub can_build: f64,
    pub ordering: f64,
    pub allocated_to_build: f64,
    pub required_for_build: f64,
    pub allocated_to_sales: f64,
    pub required_for_sales: f64,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PartStockItem {
    pub pk: i64,
    pub part_name: String,
    pub location: String,
    pub quantity: String,
    pub thumbnail: String,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PartStockPage {
    pub count: i64,
    pub results: Vec<PartStockItem>,
}

pub const MAX_THUMBNAIL_BYTES: usize = 2 * 1024 * 1024;
pub const MAX_PART_IMAGE_BYTES: usize = 8 * 1024 * 1024;

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
        in_stock: number_field(value, "in_stock"),
        units: string_field(value, "units"),
        thumbnail: string_field(value, "thumbnail"),
    })
}

pub fn parse_part_detail(body: &str) -> Result<PartDetail, ClientError> {
    let value: Value = serde_json::from_str(body)
        .map_err(|_| ClientError::MissingData("零件详情不是 JSON".into()))?;
    let pk = value
        .get("pk")
        .and_then(json_i64)
        .ok_or_else(|| ClientError::MissingData("零件详情里没有 pk".into()))?;
    let name = string_field(&value, "name");
    let full_name = {
        let full = string_field(&value, "full_name");
        if full.trim().is_empty() { name.clone() } else { full }
    };
    let category_name = {
        let direct = string_field(&value, "category_name");
        if direct.trim().is_empty() {
            nested_text(&value, "category_detail", "name")
        } else {
            direct
        }
    };
    let location = {
        let path = nested_text(&value, "default_location_detail", "pathstring");
        if path.trim().is_empty() {
            nested_text(&value, "default_location_detail", "name")
        } else {
            path
        }
    };
    Ok(PartDetail {
        pk,
        name,
        full_name,
        description: string_field(&value, "description"),
        thumbnail: string_field(&value, "thumbnail"),
        image: string_field(&value, "image"),
        units: string_field(&value, "units"),
        active: bool_field(&value, "active", true),
        assembly: bool_field(&value, "assembly", false),
        component: bool_field(&value, "component", false),
        purchaseable: bool_field(&value, "purchaseable", false),
        salable: bool_field(&value, "salable", false),
        in_stock: number_field(&value, "in_stock"),
        category_name,
        category_id: optional_id(&value, "category"),
        location,
        keywords: string_field(&value, "keywords"),
        link: string_field(&value, "link"),
        notes: string_field(&value, "notes"),
        template_pk: optional_id(&value, "variant_of"),
        template_name: String::new(),
        template_thumbnail: String::new(),
        variant_count: 0,
        bom_count: 0,
        used_in_count: 0,
        supplier_count: 0,
        attachment_count: 0,
        building: number_field(&value, "building"),
        scheduled_to_build: number_field(&value, "scheduled_to_build"),
        can_build: None,
        allocated_to_build: number_field(&value, "allocated_to_build_orders"),
        required_for_build: number_field(&value, "required_for_build_orders"),
        allocated_to_sales: number_field(&value, "allocated_to_sales_orders"),
        required_for_sales: number_field(&value, "required_for_sales_orders"),
        ordering: number_field(&value, "ordering"),
        price_label: None,
        is_template: bool_field(&value, "is_template", false),
        parameters: parse_parameters(&value),
    })
}

fn parse_parameters(value: &Value) -> Vec<PartParameter> {
    value
        .get("parameters")
        .and_then(Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(|item| {
                    let name = nested_text(item, "template_detail", "name");
                    if name.trim().is_empty() {
                        return None;
                    }
                    Some(PartParameter {
                        name,
                        value: string_field(item, "data"),
                        units: nested_text(item, "template_detail", "units"),
                    })
                })
                .collect()
        })
        .unwrap_or_default()
}

pub fn parse_part_requirements(body: &str) -> Option<PartRequirements> {
    let value: Value = serde_json::from_str(body).ok()?;
    if !value.is_object() {
        return None;
    }
    Some(PartRequirements {
        building: number_field(&value, "building"),
        scheduled_to_build: number_field(&value, "scheduled_to_build"),
        can_build: number_field(&value, "can_build"),
        ordering: number_field(&value, "ordering"),
        allocated_to_build: number_field(&value, "allocated_to_build_orders"),
        required_for_build: number_field(&value, "required_for_build_orders"),
        allocated_to_sales: number_field(&value, "allocated_to_sales_orders"),
        required_for_sales: number_field(&value, "required_for_sales_orders"),
    })
}

pub fn parse_price_label(body: &str) -> Option<String> {
    let value: Value = serde_json::from_str(body).ok()?;
    if !value.is_object() {
        return None;
    }
    Some(format_price_range(
        &decimal_text(&value, "overall_min"),
        &decimal_text(&value, "overall_max"),
        string_field(&value, "currency").trim(),
    ))
}

pub fn parse_part_pricing(body: &str) -> Result<PartPriceDetail, ClientError> {
    let value: Value = serde_json::from_str(body)
        .map_err(|_| ClientError::MissingData("价格不是 JSON".into()))?;
    if !value.is_object() {
        return Err(ClientError::MissingData("价格不是 JSON".into()));
    }
    let currency = string_field(&value, "currency").trim().to_string();
    Ok(PartPriceDetail {
        currency,
        price_range: priced_range(&value, "overall_min", "overall_max"),
        override_min: priced_override(&value, "override_min", "override_min_currency"),
        override_max: priced_override(&value, "override_max", "override_max_currency"),
        internal_cost: priced_range(&value, "internal_cost_min", "internal_cost_max"),
        variant_cost: priced_range(&value, "variant_cost_min", "variant_cost_max"),
        bom_cost: priced_range(&value, "bom_cost_min", "bom_cost_max"),
        purchase_price: priced_range(&value, "purchase_cost_min", "purchase_cost_max"),
        supplier_price: priced_range(&value, "supplier_price_min", "supplier_price_max"),
        sale_price: priced_range(&value, "sale_price_min", "sale_price_max"),
        sale_history: priced_range(&value, "sale_history_min", "sale_history_max"),
    })
}

fn priced_range(value: &Value, min_key: &str, max_key: &str) -> String {
    let currency = string_field(value, "currency").trim().to_string();
    let text = format_price_range(
        &decimal_text(value, min_key),
        &decimal_text(value, max_key),
        &currency,
    );
    if text.is_empty() { "-".into() } else { text }
}

fn priced_override(value: &Value, amount_key: &str, currency_key: &str) -> String {
    let amount = decimal_text(value, amount_key);
    if amount.is_empty() {
        return String::new();
    }
    let currency = string_field(value, currency_key).trim().to_string();
    if currency.is_empty() {
        return "-".into();
    }
    format_price_range(&amount, &amount, &currency)
}

pub fn parse_list_count(body: &str) -> i64 {
    let Ok(value) = serde_json::from_str::<Value>(body) else {
        return 0;
    };
    if let Some(count) = value.get("count").and_then(json_i64) {
        return count;
    }
    value.as_array().map(|items| items.len() as i64).unwrap_or(0)
}

pub fn parse_part_stock_page(body: &str) -> Result<PartStockPage, ClientError> {
    let value: Value = serde_json::from_str(body)
        .map_err(|_| ClientError::MissingData("库存列表不是 JSON".into()))?;
    if let Some(items) = value.as_array() {
        let results = parse_stock_rows(items);
        return Ok(PartStockPage {
            count: results.len() as i64,
            results,
        });
    }
    let results = value
        .get("results")
        .and_then(Value::as_array)
        .map(|items| parse_stock_rows(items))
        .unwrap_or_default();
    let count = value
        .get("count")
        .and_then(json_i64)
        .unwrap_or(results.len() as i64);
    Ok(PartStockPage { count, results })
}

pub fn parse_supplier_part_page(body: &str) -> Result<SupplierPartPage, ClientError> {
    let value: Value = serde_json::from_str(body)
        .map_err(|_| ClientError::MissingData("供应商零件列表不是 JSON".into()))?;
    if let Some(items) = value.as_array() {
        let results = parse_supplier_part_rows(items);
        return Ok(SupplierPartPage {
            count: results.len() as i64,
            results,
        });
    }
    let results = value
        .get("results")
        .and_then(Value::as_array)
        .map(|items| parse_supplier_part_rows(items))
        .unwrap_or_default();
    let count = value
        .get("count")
        .and_then(json_i64)
        .unwrap_or(results.len() as i64);
    Ok(SupplierPartPage { count, results })
}

fn parse_supplier_part_rows(items: &[Value]) -> Vec<SupplierPartSummary> {
    items.iter().filter_map(parse_supplier_part_summary).collect()
}

fn parse_supplier_part_summary(value: &Value) -> Option<SupplierPartSummary> {
    let pk = value.get("pk").and_then(json_i64)?;
    let image = {
        let thumb = nested_text(value, "supplier_detail", "thumbnail");
        if thumb.trim().is_empty() {
            nested_text(value, "supplier_detail", "image")
        } else {
            thumb
        }
    };
    Some(SupplierPartSummary {
        pk,
        sku: string_field(value, "SKU"),
        supplier_name: nested_text(value, "supplier_detail", "name"),
        part_name: first_text(&[
            nested_text(value, "part_detail", "full_name"),
            nested_text(value, "part_detail", "name"),
        ]),
        supplier_image: image,
        in_stock: number_field(value, "in_stock"),
    })
}

pub fn parse_supplier_part(body: &str) -> Result<SupplierPartDetail, ClientError> {
    let value: Value = serde_json::from_str(body)
        .map_err(|_| ClientError::MissingData("供应商零件不是 JSON".into()))?;
    let pk = value
        .get("pk")
        .and_then(json_i64)
        .ok_or_else(|| ClientError::MissingData("供应商零件里没有 pk".into()))?;
    let note = {
        let short = string_field(&value, "note");
        if short.trim().is_empty() {
            string_field(&value, "notes")
        } else {
            short
        }
    };
    Ok(SupplierPartDetail {
        pk,
        sku: string_field(&value, "SKU"),
        active: bool_field(&value, "active", true),
        primary: bool_field(&value, "primary", false),
        in_stock: number_field(&value, "in_stock"),
        part_id: optional_id(&value, "part").unwrap_or(0),
        part_name: first_text(&[
            nested_text(&value, "part_detail", "full_name"),
            nested_text(&value, "part_detail", "name"),
        ]),
        supplier_name: nested_text(&value, "supplier_detail", "name"),
        manufacturer_name: nested_text(&value, "manufacturer_detail", "name"),
        mpn: string_field(&value, "MPN"),
        packaging: string_field(&value, "packaging"),
        pack_quantity: string_field(&value, "pack_quantity"),
        link: string_field(&value, "link"),
        note,
    })
}

fn parse_stock_rows(items: &[Value]) -> Vec<PartStockItem> {
    items.iter().filter_map(parse_stock_item).collect()
}

fn parse_stock_item(value: &Value) -> Option<PartStockItem> {
    let pk = value.get("pk").and_then(json_i64)?;
    let location = {
        let path = nested_text(value, "location_detail", "pathstring");
        if path.trim().is_empty() {
            nested_text(value, "location_detail", "name")
        } else {
            path
        }
    };
    Some(PartStockItem {
        pk,
        part_name: first_text(&[
            nested_text(value, "part_detail", "full_name"),
            nested_text(value, "part_detail", "name"),
        ]),
        location,
        quantity: stock_trailing(value),
        thumbnail: nested_text(value, "part_detail", "thumbnail"),
    })
}

fn format_price_range(min: &str, max: &str, currency: &str) -> String {
    let min = min.trim();
    let max = max.trim();
    let amount = if min.is_empty() && max.is_empty() {
        String::new()
    } else if min.is_empty() || max.is_empty() || min == max {
        if min.is_empty() { max } else { min }.to_string()
    } else {
        format!("{min} – {max}")
    };
    if amount.is_empty() {
        return String::new();
    }
    if currency.is_empty() {
        amount
    } else {
        format!("{currency} {amount}")
    }
}

fn decimal_text(value: &Value, key: &str) -> String {
    match value.get(key) {
        Some(Value::String(text)) => trim_decimal(text),
        Some(Value::Number(number)) => trim_decimal(&number.to_string()),
        _ => String::new(),
    }
}

fn trim_decimal(raw: &str) -> String {
    let text = raw.trim();
    if text.is_empty() {
        return String::new();
    }
    if !text.contains('.') {
        return text.to_string();
    }
    let trimmed = text.trim_end_matches('0').trim_end_matches('.');
    if trimmed.is_empty() || trimmed == "-" {
        "0".into()
    } else {
        trimmed.to_string()
    }
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
    let pk = value.get("pk").and_then(json_i64)?;
    Some(CategorySummary {
        pk,
        name: string_field(value, "name"),
        pathstring: string_field(value, "pathstring"),
        part_count: number_field(value, "part_count") as i64,
    })
}

pub fn parse_part_category(body: &str) -> Result<PartCategory, ClientError> {
    let value: Value = serde_json::from_str(body)
        .map_err(|_| ClientError::MissingData("类别详情不是 JSON".into()))?;
    let pk = value
        .get("pk")
        .and_then(json_i64)
        .ok_or_else(|| ClientError::MissingData("类别详情里没有 pk".into()))?;
    let pathstring = string_field(&value, "pathstring");
    Ok(PartCategory {
        pk,
        name: string_field(&value, "name"),
        description: string_field(&value, "description"),
        parent_id: optional_id(&value, "parent"),
        parent_path: parent_category_path(&pathstring),
        part_count: number_field(&value, "part_count") as i64,
        subcategory_count: number_field(&value, "subcategories") as i64,
    })
}

fn parent_category_path(pathstring: &str) -> String {
    let mut parts: Vec<&str> = pathstring
        .split('/')
        .filter(|part| !part.trim().is_empty())
        .collect();
    if parts.len() <= 1 {
        return String::new();
    }
    parts.pop();
    parts.join("/")
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

pub fn part_category_url(base: &str, pk: i64) -> Result<String, ClientError> {
    if pk <= 0 {
        return Err(ClientError::Invalid("类别不存在".into()));
    }
    api_url(base, &format!("api/part/category/{pk}/"))
}

pub fn part_detail_url(base: &str, pk: i64) -> Result<String, ClientError> {
    if pk <= 0 {
        return Err(ClientError::Invalid("零件不存在".into()));
    }
    with_query(
        &api_url(base, &format!("api/part/{pk}/"))?,
        &[
            ("category_detail", "true".to_string()),
            ("location_detail", "true".to_string()),
            ("parameters", "true".to_string()),
        ],
    )
}

pub fn part_related_url(base: &str, path: &str, pk: i64) -> Result<String, ClientError> {
    if pk <= 0 {
        return Err(ClientError::Invalid("零件不存在".into()));
    }
    api_url(base, &format!("api/part/{pk}/{path}"))
}

pub fn list_count_url(base: &str, path: &str, key: &str, pk: i64) -> Result<String, ClientError> {
    if pk <= 0 {
        return Err(ClientError::Invalid("零件不存在".into()));
    }
    with_query(
        &api_url(base, path)?,
        &[
            ("limit", "1".to_string()),
            ("offset", "0".to_string()),
            (key, pk.to_string()),
        ],
    )
}

pub fn attachment_count_url(base: &str, pk: i64) -> Result<String, ClientError> {
    if pk <= 0 {
        return Err(ClientError::Invalid("零件不存在".into()));
    }
    with_query(
        &api_url(base, "api/attachment/")?,
        &[
            ("limit", "1".to_string()),
            ("offset", "0".to_string()),
            ("model_type", "part".to_string()),
            ("model_id", pk.to_string()),
        ],
    )
}

pub fn supplier_part_list_url(base: &str, part: i64, offset: u32) -> Result<String, ClientError> {
    if part <= 0 {
        return Err(ClientError::Invalid("零件不存在".into()));
    }
    with_query(
        &api_url(base, "api/company/part/")?,
        &[
            ("limit", PART_PAGE_LIMIT.to_string()),
            ("offset", offset.to_string()),
            ("part", part.to_string()),
            ("supplier_detail", "true".to_string()),
            ("part_detail", "true".to_string()),
        ],
    )
}

pub fn supplier_part_url(base: &str, pk: i64) -> Result<String, ClientError> {
    if pk <= 0 {
        return Err(ClientError::Invalid("供应商零件不存在".into()));
    }
    with_query(
        &api_url(base, &format!("api/company/part/{pk}/"))?,
        &[
            ("supplier_detail", "true".to_string()),
            ("part_detail", "true".to_string()),
            ("manufacturer_detail", "true".to_string()),
        ],
    )
}

pub fn part_stock_url(base: &str, pk: i64, offset: u32) -> Result<String, ClientError> {
    if pk <= 0 {
        return Err(ClientError::Invalid("零件不存在".into()));
    }
    with_query(
        &api_url(base, "api/stock/")?,
        &[
            ("limit", PART_PAGE_LIMIT.to_string()),
            ("offset", offset.to_string()),
            ("part", pk.to_string()),
            ("part_detail", "true".to_string()),
            ("location_detail", "true".to_string()),
        ],
    )
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

pub fn record_list_path(kind: &str) -> Result<&'static str, ClientError> {
    match kind {
        "stock" => Ok("api/stock/"),
        "build" => Ok("api/build/"),
        "purchase" => Ok("api/order/po/"),
        "sales" => Ok("api/order/so/"),
        "transfer" => Ok("api/order/transfer-order/"),
        "supplier" | "customer" => Ok("api/company/"),
        _ => Err(ClientError::Invalid("未知的列表".into())),
    }
}

pub fn record_list_url(
    base: &str,
    kind: &str,
    offset: u32,
    search: &str,
) -> Result<String, ClientError> {
    let path = record_list_path(kind)?;
    let mut pairs = vec![
        ("limit", PART_PAGE_LIMIT.to_string()),
        ("offset", offset.to_string()),
    ];
    let search = search.trim();
    if !search.is_empty() {
        pairs.push(("search", search.to_string()));
    }
    if kind == "stock" {
        pairs.push(("part_detail", "true".to_string()));
    }
    if kind == "supplier" {
        pairs.push(("is_supplier", "true".to_string()));
    }
    if kind == "customer" {
        pairs.push(("is_customer", "true".to_string()));
    }
    with_query(&api_url(base, path)?, &pairs)
}

pub fn parse_record_page(kind: &str, body: &str) -> Result<RecordPage, ClientError> {
    record_list_path(kind)?;
    let value: Value = serde_json::from_str(body)
        .map_err(|_| ClientError::MissingData("列表不是 JSON".into()))?;
    if let Some(items) = value.as_array() {
        let results = parse_record_rows(kind, items);
        return Ok(RecordPage {
            count: results.len() as i64,
            results,
        });
    }
    let results = value
        .get("results")
        .and_then(Value::as_array)
        .map(|items| parse_record_rows(kind, items))
        .unwrap_or_default();
    let count = value
        .get("count")
        .and_then(Value::as_i64)
        .unwrap_or(results.len() as i64);
    Ok(RecordPage { count, results })
}

fn parse_record_rows(kind: &str, items: &[Value]) -> Vec<RecordSummary> {
    items.iter().filter_map(|item| parse_record(kind, item)).collect()
}

fn parse_record(kind: &str, value: &Value) -> Option<RecordSummary> {
    let pk = value.get("pk").and_then(Value::as_i64)?;
    let (title, detail, trailing) = match kind {
        "stock" => (
            first_text(&[
                nested_text(value, "part_detail", "full_name"),
                nested_text(value, "part_detail", "name"),
                string_field(value, "part__name"),
            ]),
            first_text(&[
                string_field(value, "serial"),
                string_field(value, "batch"),
                nested_text(value, "location_detail", "name"),
            ]),
            stock_trailing(value),
        ),
        "build" => (
            string_field(value, "reference"),
            first_text(&[string_field(value, "title"), string_field(value, "part_name")]),
            string_field(value, "status_text"),
        ),
        "supplier" | "customer" => (
            string_field(value, "name"),
            string_field(value, "description"),
            String::new(),
        ),
        _ => (
            string_field(value, "reference"),
            string_field(value, "description"),
            string_field(value, "status_text"),
        ),
    };
    Some(RecordSummary {
        pk,
        title,
        detail,
        trailing,
    })
}

fn first_text(values: &[String]) -> String {
    values
        .iter()
        .find(|value| !value.trim().is_empty())
        .cloned()
        .unwrap_or_default()
}

fn nested_text(value: &Value, object_key: &str, field: &str) -> String {
    value
        .get(object_key)
        .and_then(|item| item.get(field))
        .and_then(Value::as_str)
        .unwrap_or("")
        .to_string()
}

fn stock_trailing(value: &Value) -> String {
    let quantity = value.get("quantity").and_then(Value::as_f64);
    let Some(quantity) = quantity else {
        return String::new();
    };
    let text = if quantity.fract() == 0.0 {
        format!("{}", quantity as i64)
    } else {
        format!("{quantity}")
    };
    let units = nested_text(value, "part_detail", "units");
    if units.trim().is_empty() {
        text
    } else {
        format!("{text} {units}")
    }
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

pub fn image_data_url(
    content_type: &str,
    bytes: &[u8],
    max_bytes: usize,
) -> Result<String, ClientError> {
    if bytes.is_empty() {
        return Err(ClientError::MissingData("缩略图是空的".into()));
    }
    if bytes.len() > max_bytes {
        return Err(ClientError::Invalid(media_limit_message(max_bytes).into()));
    }
    let mime = content_type.split(';').next().unwrap_or("").trim();
    if !mime.starts_with("image/") || mime.contains('"') || mime.contains(' ') {
        return Err(ClientError::MissingData("缩略图不是图片".into()));
    }
    let encoded = base64::engine::general_purpose::STANDARD.encode(bytes);
    Ok(format!("data:{mime};base64,{encoded}"))
}

fn string_field(value: &Value, key: &str) -> String {
    match value.get(key) {
        Some(Value::String(text)) => text.clone(),
        _ => String::new(),
    }
}

fn json_i64(value: &Value) -> Option<i64> {
    match value {
        Value::Number(number) => number.as_i64().or_else(|| number.as_f64().map(|item| item as i64)),
        Value::String(text) => text.trim().parse().ok(),
        _ => None,
    }
}

fn optional_id(value: &Value, key: &str) -> Option<i64> {
    value.get(key).and_then(json_i64).filter(|id| *id > 0)
}

fn number_field(value: &Value, key: &str) -> f64 {
    match value.get(key) {
        Some(Value::Number(number)) => number.as_f64().unwrap_or(0.0),
        Some(Value::String(text)) => text.trim().parse().unwrap_or(0.0),
        _ => 0.0,
    }
}

fn bool_field(value: &Value, key: &str, default: bool) -> bool {
    value.get(key).and_then(Value::as_bool).unwrap_or(default)
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

pub async fn fetch_part(
    base: &str,
    trust_invalid_certs: bool,
    token: &str,
    pk: i64,
) -> Result<PartDetail, ClientError> {
    let authorization = format!("Token {token}");
    let url = part_detail_url(base, pk)?;
    let body = get_text(&url, trust_invalid_certs, Some(&authorization)).await?;
    let mut detail = parse_part_detail(&body)?;
    let template_pk = detail.template_pk;
    let assembly = detail.assembly;
    let component = detail.component;
    let purchaseable = detail.purchaseable;

    let template_url = match template_pk {
        Some(id) => Some(part_detail_url(base, id)?),
        None => None,
    };
    let bom_url = if assembly {
        Some(list_count_url(base, "api/part/", "in_bom_for", pk)?)
    } else {
        None
    };
    let used_url = if component {
        Some(list_count_url(base, "api/bom/", "uses", pk)?)
    } else {
        None
    };
    let supplier_url = if purchaseable {
        Some(list_count_url(base, "api/company/part/", "part", pk)?)
    } else {
        None
    };
    let variant_url = list_count_url(base, "api/part/", "variant_of", pk)?;
    let attachment_url = attachment_count_url(base, pk)?;
    let price_url = part_related_url(base, "pricing/", pk)?;
    let requirements_url = part_related_url(base, "requirements/", pk)?;

    let (
        template_body,
        variant_count,
        bom_count,
        used_in_count,
        supplier_count,
        attachment_count,
        price_body,
        requirements_body,
    ) = tokio::join!(
        optional_text(template_url, trust_invalid_certs, authorization.clone()),
        optional_count(Some(variant_url), trust_invalid_certs, authorization.clone()),
        optional_count(bom_url, trust_invalid_certs, authorization.clone()),
        optional_count(used_url, trust_invalid_certs, authorization.clone()),
        optional_count(supplier_url, trust_invalid_certs, authorization.clone()),
        optional_count(Some(attachment_url), trust_invalid_certs, authorization.clone()),
        optional_text(Some(price_url), trust_invalid_certs, authorization.clone()),
        optional_text(Some(requirements_url), trust_invalid_certs, authorization),
    );

    if let Some(body) = template_body {
        if let Ok(parent) = parse_part_detail(&body) {
            detail.template_name = parent.full_name;
            detail.template_thumbnail = parent.thumbnail;
        }
    }
    detail.variant_count = variant_count;
    detail.bom_count = bom_count;
    detail.used_in_count = used_in_count;
    detail.supplier_count = supplier_count;
    detail.attachment_count = attachment_count;
    if let Some(body) = price_body {
        detail.price_label = parse_price_label(&body);
    }
    if let Some(body) = requirements_body {
        if let Some(stats) = parse_part_requirements(&body) {
            detail.building = stats.building;
            detail.scheduled_to_build = stats.scheduled_to_build;
            detail.can_build = Some(stats.can_build);
            detail.ordering = stats.ordering;
            detail.allocated_to_build = stats.allocated_to_build;
            detail.required_for_build = stats.required_for_build;
            detail.allocated_to_sales = stats.allocated_to_sales;
            detail.required_for_sales = stats.required_for_sales;
        }
    }
    Ok(detail)
}

async fn optional_text(
    url: Option<String>,
    trust_invalid_certs: bool,
    authorization: String,
) -> Option<String> {
    let url = url?;
    get_text(&url, trust_invalid_certs, Some(&authorization))
        .await
        .ok()
}

async fn optional_count(
    url: Option<String>,
    trust_invalid_certs: bool,
    authorization: String,
) -> i64 {
    let Some(url) = url else {
        return 0;
    };
    match get_text(&url, trust_invalid_certs, Some(&authorization)).await {
        Ok(body) => parse_list_count(&body),
        Err(_) => 0,
    }
}

pub async fn fetch_part_stock(
    base: &str,
    trust_invalid_certs: bool,
    token: &str,
    pk: i64,
    offset: u32,
) -> Result<PartStockPage, ClientError> {
    let url = part_stock_url(base, pk, offset)?;
    let body = get_text(&url, trust_invalid_certs, Some(&format!("Token {token}"))).await?;
    parse_part_stock_page(&body)
}

pub async fn fetch_supplier_parts(
    base: &str,
    trust_invalid_certs: bool,
    token: &str,
    part: i64,
    offset: u32,
) -> Result<SupplierPartPage, ClientError> {
    let url = supplier_part_list_url(base, part, offset)?;
    let body = get_text(&url, trust_invalid_certs, Some(&format!("Token {token}"))).await?;
    parse_supplier_part_page(&body)
}

pub async fn fetch_supplier_part(
    base: &str,
    trust_invalid_certs: bool,
    token: &str,
    pk: i64,
) -> Result<SupplierPartDetail, ClientError> {
    let url = supplier_part_url(base, pk)?;
    let body = get_text(&url, trust_invalid_certs, Some(&format!("Token {token}"))).await?;
    parse_supplier_part(&body)
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

pub async fn fetch_part_pricing(
    base: &str,
    trust_invalid_certs: bool,
    token: &str,
    pk: i64,
) -> Result<PartPriceDetail, ClientError> {
    let url = part_related_url(base, "pricing/", pk)?;
    let body = get_text(&url, trust_invalid_certs, Some(&format!("Token {token}"))).await?;
    parse_part_pricing(&body)
}

pub async fn fetch_part_category(
    base: &str,
    trust_invalid_certs: bool,
    token: &str,
    pk: i64,
) -> Result<PartCategory, ClientError> {
    let url = part_category_url(base, pk)?;
    let body = get_text(&url, trust_invalid_certs, Some(&format!("Token {token}"))).await?;
    parse_part_category(&body)
}

pub async fn fetch_records(
    base: &str,
    trust_invalid_certs: bool,
    token: &str,
    kind: &str,
    offset: u32,
    search: &str,
) -> Result<RecordPage, ClientError> {
    let url = record_list_url(base, kind, offset, search)?;
    let body = get_text(&url, trust_invalid_certs, Some(&format!("Token {token}"))).await?;
    parse_record_page(kind, &body)
}

pub async fn fetch_part_thumbnail(
    base: &str,
    trust_invalid_certs: bool,
    token: &str,
    thumbnail: &str,
) -> Result<String, ClientError> {
    fetch_part_media(
        base,
        trust_invalid_certs,
        token,
        thumbnail,
        MAX_THUMBNAIL_BYTES,
    )
    .await
}

pub async fn fetch_part_image(
    base: &str,
    trust_invalid_certs: bool,
    token: &str,
    image: &str,
) -> Result<String, ClientError> {
    fetch_part_media(base, trust_invalid_certs, token, image, MAX_PART_IMAGE_BYTES).await
}

async fn fetch_part_media(
    base: &str,
    trust_invalid_certs: bool,
    token: &str,
    path: &str,
    max_bytes: usize,
) -> Result<String, ClientError> {
    let url = resolve_media_url(base, path)?;
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
        .is_some_and(|length| length > max_bytes as u64)
    {
        return Err(ClientError::Invalid(media_limit_message(max_bytes).into()));
    }
    let mime = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .unwrap_or("")
        .to_string();
    let bytes = response.bytes().await.map_err(map_reqwest)?;
    image_data_url(&mime, &bytes, max_bytes)
}

fn media_limit_message(max_bytes: usize) -> &'static str {
    if max_bytes <= MAX_THUMBNAIL_BYTES {
        "缩略图太大"
    } else {
        "图片太大"
    }
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
        let category = parse_part_category(
            r#"{"pk":8,"name":"电阻","description":"贴片","parent":2,"pathstring":"电子/电阻","part_count":4,"subcategories":1,"level":1,"starred":false}"#,
        )
        .unwrap();
        assert_eq!(category.parent_id, Some(2));
        assert_eq!(category.parent_path, "电子");
        assert_eq!(category.part_count, 4);
        assert_eq!(
            parse_part_category(
                r#"{"pk":2,"name":"电子","description":"","parent":null,"pathstring":"电子","part_count":0,"subcategories":3,"level":0,"starred":false}"#,
            )
            .unwrap()
            .parent_path,
            ""
        );
        assert!(parse_part_category("{}").is_err());
        assert!(part_category_url("https://demo.example.com", 8).unwrap().ends_with("/api/part/category/8/"));
    }

    #[test]
    fn parses_record_lists() {
        let stock = parse_record_page(
            "stock",
            r#"{"count":1,"results":[{"pk":3,"quantity":12,"serial":"S1","part_detail":{"full_name":"螺丝","units":"个"},"location_detail":{"name":"A1"}}]}"#,
        )
        .unwrap();
        assert_eq!(stock.results[0].title, "螺丝");
        assert_eq!(stock.results[0].detail, "S1");
        assert_eq!(stock.results[0].trailing, "12 个");

        let build = parse_record_page(
            "build",
            r#"{"count":1,"results":[{"pk":4,"reference":"BO-1","title":"组装","status_text":"进行中"}]}"#,
        )
        .unwrap();
        assert_eq!(build.results[0].title, "BO-1");
        assert_eq!(build.results[0].detail, "组装");
        assert_eq!(build.results[0].trailing, "进行中");

        let order = parse_record_page(
            "purchase",
            r#"[{"pk":5,"reference":"PO-9","description":"补货","status_text":"已下单"}]"#,
        )
        .unwrap();
        assert_eq!(order.count, 1);
        assert_eq!(order.results[0].title, "PO-9");
        let company = parse_record_page(
            "supplier",
            r#"{"count":1,"results":[{"pk":6,"name":"甲公司","description":"耗材"}]}"#,
        )
        .unwrap();
        assert_eq!(company.results[0].title, "甲公司");
        assert_eq!(company.results[0].detail, "耗材");
        assert!(parse_record_page("unknown", r#"{"count":0,"results":[]}"#).is_err());
    }

    #[test]
    fn builds_record_list_urls() {
        let base = "https://demo.example.com/inventree";
        assert_eq!(
            record_list_url(base, "stock", 50, "螺丝").unwrap(),
            "https://demo.example.com/inventree/api/stock/?limit=50&offset=50&search=%E8%9E%BA%E4%B8%9D&part_detail=true"
        );
        assert_eq!(
            record_list_url(base, "transfer", 0, "").unwrap(),
            "https://demo.example.com/inventree/api/order/transfer-order/?limit=50&offset=0"
        );
        assert_eq!(
            record_list_url(base, "supplier", 0, "").unwrap(),
            "https://demo.example.com/inventree/api/company/?limit=50&offset=0&is_supplier=true"
        );
        assert_eq!(
            record_list_url(base, "customer", 0, "甲").unwrap(),
            "https://demo.example.com/inventree/api/company/?limit=50&offset=0&search=%E7%94%B2&is_customer=true"
        );
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
        let url = image_data_url("image/png; charset=binary", b"png", MAX_THUMBNAIL_BYTES).unwrap();
        assert_eq!(url, "data:image/png;base64,cG5n");
        assert!(image_data_url("text/html", b"<p>", MAX_THUMBNAIL_BYTES).is_err());
        assert!(image_data_url("image/png", b"", MAX_THUMBNAIL_BYTES).is_err());
        assert!(image_data_url(
            "image/png",
            &vec![0; MAX_THUMBNAIL_BYTES + 1],
            MAX_THUMBNAIL_BYTES
        )
        .is_err());
        assert!(image_data_url(
            "image/png",
            &vec![0; MAX_THUMBNAIL_BYTES + 1],
            MAX_PART_IMAGE_BYTES
        )
        .is_ok());
    }

    #[test]
    fn parses_part_detail_and_related_counts() {
        let detail = parse_part_detail(
            r#"{"pk":9,"name":"电阻","full_name":"R 电阻","description":"10k","thumbnail":"/media/r.png","image":"/media/r-full.png","category":8,"units":"个","active":false,"assembly":true,"component":true,"purchaseable":true,"salable":false,"in_stock":"4","category_name":"","category_detail":{"name":"电子"},"default_location_detail":{"name":"A1","pathstring":"仓库/A1"},"keywords":"电阻 10k","link":"https://example.com/r","notes":"注意极性","variant_of":3,"building":2,"scheduled_to_build":5,"allocated_to_build_orders":1,"required_for_build_orders":4,"ordering":6,"parameters":[{"pk":1,"data":"10k","template":2,"template_detail":{"name":"阻值","units":"Ω"},"model_id":9}]}"#,
        )
        .unwrap();
        assert_eq!(detail.full_name, "R 电阻");
        assert_eq!(detail.image, "/media/r-full.png");
        assert_eq!(detail.thumbnail, "/media/r.png");
        assert!(!detail.active);
        assert_eq!(detail.category_name, "电子");
        assert_eq!(detail.category_id, Some(8));
        assert_eq!(detail.location, "仓库/A1");
        assert_eq!(detail.in_stock, 4.0);
        assert_eq!(detail.template_pk, Some(3));
        assert_eq!(detail.parameters[0].name, "阻值");
        assert_eq!(detail.parameters[0].units, "Ω");
        assert!(parse_part_detail("{}").is_err());
        assert!(parse_part_detail("[]").is_err());

        let requirements = parse_part_requirements(
            r#"{"building":1,"scheduled_to_build":8,"can_build":3,"ordering":2,"allocated_to_build_orders":1,"required_for_build_orders":4,"allocated_to_sales_orders":0,"required_for_sales_orders":0}"#,
        )
        .unwrap();
        assert_eq!(requirements.can_build, 3.0);
        assert!(parse_part_requirements("[]").is_none());
        assert_eq!(
            parse_price_label(r#"{"currency":"CNY","overall_min":"1.500000","overall_max":"2.000000"}"#)
                .unwrap(),
            "CNY 1.5 – 2"
        );
        assert_eq!(parse_price_label(r#"{"currency":"","overall_min":null,"overall_max":null}"#).unwrap(), "");
        let pricing = parse_part_pricing(
            r#"{"currency":"CNY","overall_min":"1.500000","overall_max":"2.000000","override_min":"1.2","override_min_currency":"CNY","override_max":null,"internal_cost_min":null,"internal_cost_max":null,"bom_cost_min":"0.400000","bom_cost_max":"0.400000","purchase_cost_min":"1","purchase_cost_max":"3","supplier_price_min":null,"supplier_price_max":"5","sale_price_min":"8","sale_price_max":"9","sale_history_min":null,"sale_history_max":null,"variant_cost_min":"1","variant_cost_max":"1","scheduled_for_update":false}"#,
        )
        .unwrap();
        assert_eq!(pricing.currency, "CNY");
        assert_eq!(pricing.price_range, "CNY 1.5 – 2");
        assert_eq!(pricing.override_min, "CNY 1.2");
        assert_eq!(pricing.override_max, "");
        assert_eq!(pricing.internal_cost, "-");
        assert_eq!(pricing.bom_cost, "CNY 0.4");
        assert_eq!(pricing.purchase_price, "CNY 1 – 3");
        assert_eq!(pricing.supplier_price, "CNY 5");
        assert_eq!(pricing.sale_price, "CNY 8 – 9");
        assert_eq!(pricing.sale_history, "-");
        assert!(parse_part_pricing("[]").is_err());
        assert_eq!(parse_list_count(r#"{"count":12,"results":[]}"#), 12);
        assert_eq!(parse_list_count(r#"[{"pk":1}]"#), 1);
    }

    #[test]
    fn builds_part_detail_urls_and_parses_stock() {
        let base = "https://demo.example.com/inventree";
        assert_eq!(
            part_detail_url(base, 9).unwrap(),
            "https://demo.example.com/inventree/api/part/9/?category_detail=true&location_detail=true&parameters=true"
        );
        assert!(part_detail_url(base, 0).is_err());
        assert_eq!(
            part_stock_url(base, 9, 50).unwrap(),
            "https://demo.example.com/inventree/api/stock/?limit=50&offset=50&part=9&part_detail=true&location_detail=true"
        );
        assert_eq!(
            list_count_url(base, "api/part/", "variant_of", 9).unwrap(),
            "https://demo.example.com/inventree/api/part/?limit=1&offset=0&variant_of=9"
        );
        assert_eq!(
            attachment_count_url(base, 9).unwrap(),
            "https://demo.example.com/inventree/api/attachment/?limit=1&offset=0&model_type=part&model_id=9"
        );
        let page = parse_part_stock_page(
            r#"{"count":1,"results":[{"pk":3,"quantity":2,"part_detail":{"full_name":"电阻","units":"个","thumbnail":"/media/r.png"},"location_detail":{"name":"A1","pathstring":"仓库/A1"}}]}"#,
        )
        .unwrap();
        assert_eq!(page.results[0].part_name, "电阻");
        assert_eq!(page.results[0].location, "仓库/A1");
        assert_eq!(page.results[0].quantity, "2 个");
        assert_eq!(page.results[0].thumbnail, "/media/r.png");
        let suppliers = parse_supplier_part_page(
            r#"{"count":1,"results":[{"pk":4,"SKU":"SKU-1","in_stock":6,"supplier_detail":{"name":"甲公司","thumbnail":"/media/s.png"},"part_detail":{"full_name":"电阻"}}]}"#,
        )
        .unwrap();
        assert_eq!(suppliers.results[0].sku, "SKU-1");
        assert_eq!(suppliers.results[0].supplier_name, "甲公司");
        assert_eq!(suppliers.results[0].supplier_image, "/media/s.png");
        let supplier = parse_supplier_part(
            r#"{"pk":4,"SKU":"SKU-1","active":false,"primary":true,"in_stock":6,"part":9,"packaging":"卷带","pack_quantity":"100","link":"https://example.com/s","note":"湿敏","MPN":"MPN-9","supplier_detail":{"name":"甲公司"},"part_detail":{"full_name":"电阻"},"manufacturer_detail":{"name":"乙厂"}}"#,
        )
        .unwrap();
        assert!(!supplier.active);
        assert!(supplier.primary);
        assert_eq!(supplier.part_id, 9);
        assert_eq!(supplier.manufacturer_name, "乙厂");
        assert_eq!(supplier.mpn, "MPN-9");
        assert_eq!(supplier.pack_quantity, "100");
        assert!(parse_supplier_part("{}").is_err());
        assert!(supplier_part_list_url("https://demo.example.com", 9, 0)
            .unwrap()
            .contains("part=9"));
    }
}

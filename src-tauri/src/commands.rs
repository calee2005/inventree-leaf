use crate::client::{
    self, CategoryPage, ClientError, PartCategory, PartDetail, PartPage, PartPriceDetail,
    PartStockPage, RecordPage,
    ServerInfo, SessionUser,
};
use crate::store::{self, ServerView};
use tauri::AppHandle;

#[tauri::command]
pub fn list_servers(app: AppHandle) -> Result<Vec<ServerView>, ClientError> {
    store::list_servers(&app)
}

#[tauri::command]
pub fn save_server(
    app: AppHandle,
    id: Option<String>,
    name: String,
    server: String,
    trusted_certificate: bool,
) -> Result<ServerView, ClientError> {
    store::save_server(&app, id, name, server, trusted_certificate)
}

#[tauri::command]
pub fn delete_server(app: AppHandle, id: String) -> Result<(), ClientError> {
    store::delete_server(&app, &id)
}

#[tauri::command]
pub fn select_server(app: AppHandle, id: String) -> Result<ServerView, ClientError> {
    store::select_server(&app, &id)
}

#[tauri::command]
pub async fn test_connection(app: AppHandle, id: String) -> Result<ServerInfo, ClientError> {
    let profile = store::get_server(&app, &id)?;
    client::fetch_server_info(&profile.server, profile.trusted_certificate).await
}

#[tauri::command]
pub async fn login(
    app: AppHandle,
    id: String,
    username: String,
    password: String,
) -> Result<SessionUser, ClientError> {
    let profile = store::get_server(&app, &id)?;
    let (token, user) = client::login(
        &profile.server,
        profile.trusted_certificate,
        &username,
        &password,
    )
    .await?;
    store::set_session(&app, &id, &token, &user.username)?;
    Ok(user)
}

#[tauri::command]
pub async fn current_user(app: AppHandle, id: String) -> Result<SessionUser, ClientError> {
    let profile = store::get_server(&app, &id)?;
    let token = store::token_for(&app, &id)?;
    match client::fetch_me(&profile.server, profile.trusted_certificate, &token).await {
        Ok(user) => {
            store::set_session(&app, &id, &token, &user.username)?;
            Ok(user)
        }
        Err(error @ ClientError::Unauthorized(_)) => {
            store::clear_token(&app, &id)?;
            Err(error)
        }
        Err(error) => Err(error),
    }
}

#[tauri::command]
pub fn logout(app: AppHandle, id: String) -> Result<(), ClientError> {
    store::clear_token(&app, &id)
}

#[tauri::command]
pub async fn list_parts(
    app: AppHandle,
    id: String,
    category: Option<i64>,
    search: Option<String>,
    offset: Option<u32>,
) -> Result<PartPage, ClientError> {
    let profile = store::get_server(&app, &id)?;
    let token = store::token_for(&app, &id)?;
    let search = search.unwrap_or_default();
    keep_session(
        &app,
        &id,
        client::fetch_parts(
            &profile.server,
            profile.trusted_certificate,
            &token,
            category,
            &search,
            offset.unwrap_or(0),
        )
        .await,
    )
}

#[tauri::command]
pub async fn get_part_pricing(
    app: AppHandle,
    id: String,
    pk: i64,
) -> Result<PartPriceDetail, ClientError> {
    let profile = store::get_server(&app, &id)?;
    let token = store::token_for(&app, &id)?;
    keep_session(
        &app,
        &id,
        client::fetch_part_pricing(&profile.server, profile.trusted_certificate, &token, pk).await,
    )
}

#[tauri::command]
pub async fn get_part_category(
    app: AppHandle,
    id: String,
    pk: i64,
) -> Result<PartCategory, ClientError> {
    let profile = store::get_server(&app, &id)?;
    let token = store::token_for(&app, &id)?;
    keep_session(
        &app,
        &id,
        client::fetch_part_category(&profile.server, profile.trusted_certificate, &token, pk).await,
    )
}

#[tauri::command]
pub async fn get_part(app: AppHandle, id: String, pk: i64) -> Result<PartDetail, ClientError> {
    let profile = store::get_server(&app, &id)?;
    let token = store::token_for(&app, &id)?;
    keep_session(
        &app,
        &id,
        client::fetch_part(&profile.server, profile.trusted_certificate, &token, pk).await,
    )
}

#[tauri::command]
pub async fn list_part_stock(
    app: AppHandle,
    id: String,
    pk: i64,
    offset: Option<u32>,
) -> Result<PartStockPage, ClientError> {
    let profile = store::get_server(&app, &id)?;
    let token = store::token_for(&app, &id)?;
    keep_session(
        &app,
        &id,
        client::fetch_part_stock(
            &profile.server,
            profile.trusted_certificate,
            &token,
            pk,
            offset.unwrap_or(0),
        )
        .await,
    )
}

#[tauri::command]
pub async fn list_part_categories(
    app: AppHandle,
    id: String,
    parent: Option<i64>,
    offset: Option<u32>,
) -> Result<CategoryPage, ClientError> {
    let profile = store::get_server(&app, &id)?;
    let token = store::token_for(&app, &id)?;
    keep_session(
        &app,
        &id,
        client::fetch_categories(
            &profile.server,
            profile.trusted_certificate,
            &token,
            parent,
            offset.unwrap_or(0),
        )
        .await,
    )
}

#[tauri::command]
pub async fn list_records(
    app: AppHandle,
    id: String,
    kind: String,
    offset: Option<u32>,
    search: Option<String>,
) -> Result<RecordPage, ClientError> {
    let profile = store::get_server(&app, &id)?;
    let token = store::token_for(&app, &id)?;
    let search = search.unwrap_or_default();
    keep_session(
        &app,
        &id,
        client::fetch_records(
            &profile.server,
            profile.trusted_certificate,
            &token,
            &kind,
            offset.unwrap_or(0),
            &search,
        )
        .await,
    )
}

#[tauri::command]
pub async fn load_part_image(
    app: AppHandle,
    id: String,
    image: String,
) -> Result<String, ClientError> {
    let profile = store::get_server(&app, &id)?;
    let token = store::token_for(&app, &id)?;
    keep_session(
        &app,
        &id,
        client::fetch_part_image(&profile.server, profile.trusted_certificate, &token, &image).await,
    )
}

#[tauri::command]
pub async fn load_part_thumbnail(
    app: AppHandle,
    id: String,
    thumbnail: String,
) -> Result<String, ClientError> {
    let profile = store::get_server(&app, &id)?;
    let token = store::token_for(&app, &id)?;
    keep_session(
        &app,
        &id,
        client::fetch_part_thumbnail(
            &profile.server,
            profile.trusted_certificate,
            &token,
            &thumbnail,
        )
        .await,
    )
}

fn keep_session<T>(
    app: &AppHandle,
    id: &str,
    result: Result<T, ClientError>,
) -> Result<T, ClientError> {
    match result {
        Err(error @ ClientError::Unauthorized(_)) => {
            store::clear_token(app, id)?;
            Err(error)
        }
        other => other,
    }
}

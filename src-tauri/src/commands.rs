use crate::client::{self, ClientError, PartPage, ServerInfo, SessionUser};
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
    store::set_token(&app, &id, &token)?;
    Ok(user)
}

#[tauri::command]
pub fn logout(app: AppHandle, id: String) -> Result<(), ClientError> {
    store::clear_token(&app, &id)
}

#[tauri::command]
pub async fn list_parts(app: AppHandle, id: String) -> Result<PartPage, ClientError> {
    let profile = store::get_server(&app, &id)?;
    let token = store::token_for(&app, &id)?;
    match client::fetch_parts(&profile.server, profile.trusted_certificate, &token).await {
        Err(error @ ClientError::Unauthorized(_)) => {
            store::clear_token(&app, &id)?;
            Err(error)
        }
        other => other,
    }
}

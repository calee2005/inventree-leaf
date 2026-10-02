use crate::client::ClientError;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tauri::AppHandle;
use tauri_plugin_store::StoreExt;
use uuid::Uuid;

const STORE_FILE: &str = "leaf.json";
const SERVERS_KEY: &str = "servers";
const TOKENS_KEY: &str = "tokens";
const USERNAMES_KEY: &str = "usernames";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ServerRecord {
    pub id: String,
    pub name: String,
    pub server: String,
    pub trusted_certificate: bool,
    pub selected: bool,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ServerView {
    pub id: String,
    pub name: String,
    pub server: String,
    pub trusted_certificate: bool,
    pub selected: bool,
    pub has_token: bool,
    pub username: String,
}

impl ServerView {
    fn from_record(record: ServerRecord, token: Option<&str>, username: String) -> Self {
        let has_token = token.is_some_and(|value| !value.is_empty());
        Self {
            has_token,
            username: if has_token { username } else { String::new() },
            id: record.id,
            name: record.name,
            server: record.server,
            trusted_certificate: record.trusted_certificate,
            selected: record.selected,
        }
    }
}

fn open(
    app: &AppHandle,
) -> Result<std::sync::Arc<tauri_plugin_store::Store<tauri::Wry>>, ClientError> {
    app.store(STORE_FILE)
        .map_err(|err| ClientError::Storage(err.to_string()))
}

fn read_json<T: for<'de> Deserialize<'de>>(
    store: &tauri_plugin_store::Store<tauri::Wry>,
    key: &str,
) -> Result<T, ClientError>
where
    T: Default,
{
    match store.get(key) {
        None => Ok(T::default()),
        Some(value) => serde_json::from_value(value)
            .map_err(|err| ClientError::Storage(format!("无法读取 {key}：{err}"))),
    }
}

fn read_servers(
    store: &tauri_plugin_store::Store<tauri::Wry>,
) -> Result<Vec<ServerRecord>, ClientError> {
    read_json(store, SERVERS_KEY)
}

fn read_tokens(
    store: &tauri_plugin_store::Store<tauri::Wry>,
) -> Result<HashMap<String, String>, ClientError> {
    read_json(store, TOKENS_KEY)
}

fn read_usernames(
    store: &tauri_plugin_store::Store<tauri::Wry>,
) -> Result<HashMap<String, String>, ClientError> {
    read_json(store, USERNAMES_KEY)
}

fn write_value(
    store: &tauri_plugin_store::Store<tauri::Wry>,
    key: &str,
    value: impl Serialize,
) -> Result<(), ClientError> {
    let json = serde_json::to_value(value).map_err(|err| ClientError::Storage(err.to_string()))?;
    store.set(key, json);
    store
        .save()
        .map_err(|err| ClientError::Storage(err.to_string()))
}

fn views_from(
    servers: Vec<ServerRecord>,
    tokens: &HashMap<String, String>,
    usernames: &HashMap<String, String>,
) -> Vec<ServerView> {
    servers
        .into_iter()
        .map(|server| {
            let token = tokens.get(&server.id).map(String::as_str);
            let username = usernames.get(&server.id).cloned().unwrap_or_default();
            ServerView::from_record(server, token, username)
        })
        .collect()
}

pub fn list_servers(app: &AppHandle) -> Result<Vec<ServerView>, ClientError> {
    let store = open(app)?;
    let servers = read_servers(&store)?;
    let tokens = read_tokens(&store)?;
    let usernames = read_usernames(&store)?;
    Ok(views_from(servers, &tokens, &usernames))
}

pub fn get_server(app: &AppHandle, id: &str) -> Result<ServerRecord, ClientError> {
    let store = open(app)?;
    read_servers(&store)?
        .into_iter()
        .find(|server| server.id == id)
        .ok_or_else(|| ClientError::NotFound("找不到这台服务器".into()))
}

pub fn save_server(
    app: &AppHandle,
    id: Option<String>,
    name: String,
    server: String,
    trusted_certificate: bool,
) -> Result<ServerView, ClientError> {
    let name = name.trim().to_string();
    if name.is_empty() {
        return Err(ClientError::Invalid("请填写显示名".into()));
    }
    let server = crate::client::normalize_base(&server)?;

    let store = open(app)?;
    let mut servers = read_servers(&store)?;
    let tokens = read_tokens(&store)?;
    let usernames = read_usernames(&store)?;

    if servers
        .iter()
        .any(|existing| existing.name == name && Some(&existing.id) != id.as_ref())
    {
        return Err(ClientError::Invalid("已经有同名服务器".into()));
    }

    let record = match id {
        Some(id) => {
            let existing = servers
                .iter()
                .find(|item| item.id == id)
                .ok_or_else(|| ClientError::NotFound("找不到这台服务器".into()))?;
            ServerRecord {
                id,
                name,
                server,
                trusted_certificate,
                selected: existing.selected,
            }
        }
        None => ServerRecord {
            id: Uuid::new_v4().to_string(),
            name,
            server,
            trusted_certificate,
            selected: !servers.iter().any(|item| item.selected),
        },
    };

    if record.selected {
        for item in &mut servers {
            item.selected = false;
        }
    }

    if let Some(slot) = servers.iter_mut().find(|item| item.id == record.id) {
        *slot = record.clone();
    } else {
        servers.push(record.clone());
    }

    write_value(&store, SERVERS_KEY, &servers)?;
    Ok(ServerView::from_record(
        record.clone(),
        tokens.get(&record.id).map(String::as_str),
        usernames.get(&record.id).cloned().unwrap_or_default(),
    ))
}

pub fn delete_server(app: &AppHandle, id: &str) -> Result<(), ClientError> {
    let store = open(app)?;
    let servers = read_servers(&store)?;
    if !servers.iter().any(|server| server.id == id) {
        return Err(ClientError::NotFound("找不到这台服务器".into()));
    }
    let servers: Vec<_> = servers
        .into_iter()
        .filter(|server| server.id != id)
        .collect();
    let mut tokens = read_tokens(&store)?;
    tokens.remove(id);
    let mut usernames = read_usernames(&store)?;
    usernames.remove(id);
    write_value(&store, SERVERS_KEY, &servers)?;
    write_value(&store, TOKENS_KEY, &tokens)?;
    write_value(&store, USERNAMES_KEY, &usernames)?;
    Ok(())
}

pub fn select_server(app: &AppHandle, id: &str) -> Result<ServerView, ClientError> {
    let store = open(app)?;
    let mut servers = read_servers(&store)?;
    if !servers.iter().any(|server| server.id == id) {
        return Err(ClientError::NotFound("找不到这台服务器".into()));
    }
    for server in &mut servers {
        server.selected = server.id == id;
    }
    write_value(&store, SERVERS_KEY, &servers)?;
    let tokens = read_tokens(&store)?;
    let usernames = read_usernames(&store)?;
    let record = servers.into_iter().find(|server| server.id == id).unwrap();
    Ok(ServerView::from_record(
        record,
        tokens.get(id).map(String::as_str),
        usernames.get(id).cloned().unwrap_or_default(),
    ))
}

pub fn set_session(
    app: &AppHandle,
    id: &str,
    token: &str,
    username: &str,
) -> Result<(), ClientError> {
    if token.is_empty() {
        return Err(ClientError::Invalid("token 为空".into()));
    }
    let _ = get_server(app, id)?;
    let store = open(app)?;
    let mut tokens = read_tokens(&store)?;
    tokens.insert(id.to_string(), token.to_string());
    let mut usernames = read_usernames(&store)?;
    usernames.insert(id.to_string(), username.trim().to_string());
    write_value(&store, TOKENS_KEY, &tokens)?;
    write_value(&store, USERNAMES_KEY, &usernames)
}

pub fn clear_token(app: &AppHandle, id: &str) -> Result<(), ClientError> {
    let store = open(app)?;
    let mut tokens = read_tokens(&store)?;
    tokens.remove(id);
    let mut usernames = read_usernames(&store)?;
    usernames.remove(id);
    write_value(&store, TOKENS_KEY, &tokens)?;
    write_value(&store, USERNAMES_KEY, &usernames)
}

pub fn token_for(app: &AppHandle, id: &str) -> Result<String, ClientError> {
    let store = open(app)?;
    let tokens = read_tokens(&store)?;
    tokens
        .get(id)
        .filter(|token| !token.is_empty())
        .cloned()
        .ok_or(ClientError::NotLoggedIn)
}

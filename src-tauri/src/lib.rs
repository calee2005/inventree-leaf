mod client;
mod commands;
mod store;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            commands::list_servers,
            commands::save_server,
            commands::delete_server,
            commands::select_server,
            commands::test_connection,
            commands::login,
            commands::logout,
            commands::list_parts,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

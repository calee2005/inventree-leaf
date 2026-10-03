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
            commands::current_user,
            commands::list_parts,
            commands::get_part,
            commands::get_part_category,
            commands::get_part_pricing,
            commands::list_bom,
            commands::get_bom_item,
            commands::create_bom_item,
            commands::update_bom_item,
            commands::delete_bom_item,
            commands::validate_bom_item,
            commands::create_bom_substitute,
            commands::delete_bom_substitute,
            commands::list_part_stock,
            commands::list_supplier_parts,
            commands::get_supplier_part,
            commands::list_part_categories,
            commands::list_records,
            commands::load_part_image,
            commands::load_part_thumbnail,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

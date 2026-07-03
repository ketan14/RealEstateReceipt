mod db;
mod commands;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let handle = app.handle().clone();
            // Perform synchronous block-on for database initialization during setup
            let pool = tauri::async_runtime::block_on(async move {
                db::init_db(&handle)
                    .await
                    .expect("Critical: Database initialization failed")
            });

            // Store the database state in Tauri's resource manager
            app.manage(commands::DbState { pool });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_property_map,
            commands::create_booking_and_receipt,
            commands::get_receipt_history,
            commands::open_receipt_html,
            commands::get_booking_details_by_unit,
            commands::create_additional_receipt,
            commands::update_unit_status
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

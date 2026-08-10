mod db;
mod crypto;
mod commands;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let handle = app.handle().clone();
            let pool = tauri::async_runtime::block_on(async move {
                db::init_db(&handle)
                    .await
                    .expect("Critical: Database initialization failed")
            });

            app.manage(commands::DbState { pool });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_property_map,
            commands::create_booking_and_receipt,
            commands::get_receipt_history,
            commands::open_receipt_html,
            commands::generate_and_open_pdf,
            commands::get_booking_details_by_unit,
            commands::create_additional_receipt,
            commands::update_unit_status,
            commands::void_receipt,
            // existing commands...
            commands::create_project,
            commands::get_projects,
            commands::update_project,
            commands::delete_project,

            // tower commands
            commands::create_tower,
            commands::get_towers,
            commands::update_tower,
            commands::delete_tower,

            // unit commands
            commands::create_unit,
            commands::get_units,
            commands::update_unit,
            commands::delete_unit,

            // customer commands
            commands::search_customers,
            commands::get_customer_profile,

            // auth commands
            commands::is_pin_setup,
            commands::setup_pin,
            commands::verify_pin,
            
            // backup commands
            commands::create_backup,

            // tier 3 payment schedule commands
            commands::create_payment_schedule,
            commands::get_payment_schedule,
            commands::update_milestone_status,

            // tier 3 reporting & analytics commands
            commands::get_financial_dashboard_stats,
            commands::get_overdue_milestones_report,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

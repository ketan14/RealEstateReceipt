use serde::{Deserialize, Serialize};
use sqlx::{SqlitePool, Row};
use tauri::{Manager, State};

// Database State wrapper
pub struct DbState {
    pub pool: SqlitePool,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Unit {
    pub id: i64,
    pub project_id: i64,
    pub tower_id: i64,
    pub unit_number: String,
    pub status: String, // "Available", "Booked", "Registered"
    pub base_price: f64,
    pub configuration: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Tower {
    pub id: i64,
    pub project_id: i64,
    pub name: String,
    pub units: Vec<Unit>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Project {
    pub id: i64,
    pub name: String,
    pub location: String,
    pub towers: Vec<Tower>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Customer {
    pub id: Option<i64>,
    pub name: String,
    pub phone: String,
    pub pan_number: String,
    pub aadhaar_number: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct BookingPayload {
    pub customer: Customer,
    pub unit_id: i64,
    pub booking_date: String,
    pub agreed_sale_value: f64,
    pub receipt_amount: f64,
    pub payment_mode: String, // "Cash", "Cheque", "RTGS", "IMPS"
    pub transaction_ref: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ReceiptHistoryItem {
    pub receipt_id: i64,
    pub receipt_number: String,
    pub amount: f64,
    pub payment_mode: String,
    pub transaction_ref: String,
    pub date: String,
    pub booking_id: i64,
    pub agreed_sale_value: f64,
    pub booking_date: String,
    pub customer_name: String,
    pub customer_phone: String,
    pub customer_pan: String,
    pub customer_aadhaar: String,
    pub unit_number: String,
    pub project_name: String,
    pub tower_name: String,
}

#[tauri::command]
pub async fn get_property_map(state: State<'_, DbState>) -> Result<Vec<Project>, String> {
    let pool = &state.pool;

    // 1. Fetch all projects
    let projects_rows = sqlx::query("SELECT id, name, location FROM projects ORDER BY name")
        .fetch_all(pool)
        .await
        .map_err(|e| format!("Failed to fetch projects: {}", e))?;

    let mut projects = Vec::new();
    for p_row in projects_rows {
        let p_id: i64 = p_row.get("id");
        let p_name: String = p_row.get("name");
        let p_location: String = p_row.get("location");

        // 2. Fetch towers for this project
        let towers_rows = sqlx::query("SELECT id, name FROM towers WHERE project_id = ? ORDER BY name")
            .bind(p_id)
            .fetch_all(pool)
            .await
            .map_err(|e| format!("Failed to fetch towers: {}", e))?;

        let mut towers = Vec::new();
        for t_row in towers_rows {
            let t_id: i64 = t_row.get("id");
            let t_name: String = t_row.get("name");

            // 3. Fetch units for this tower
            let units_rows = sqlx::query(
                "SELECT id, unit_number, status, base_price, configuration FROM units WHERE tower_id = ? ORDER BY unit_number"
            )
            .bind(t_id)
            .fetch_all(pool)
            .await
            .map_err(|e| format!("Failed to fetch units: {}", e))?;

            let mut units = Vec::new();
            for u_row in units_rows {
                units.push(Unit {
                    id: u_row.get("id"),
                    project_id: p_id,
                    tower_id: t_id,
                    unit_number: u_row.get("unit_number"),
                    status: u_row.get("status"),
                    base_price: u_row.get("base_price"),
                    configuration: u_row.get("configuration"),
                });
            }

            towers.push(Tower {
                id: t_id,
                project_id: p_id,
                name: t_name,
                units,
            });
        }

        projects.push(Project {
            id: p_id,
            name: p_name,
            location: p_location,
            towers,
        });
    }

    Ok(projects)
}

#[tauri::command]
pub async fn create_booking_and_receipt(
    payload: BookingPayload,
    state: State<'_, DbState>,
) -> Result<String, String> {
    let pool = &state.pool;

    // Validate financial inputs
    if payload.agreed_sale_value <= 0.0 {
        return Err("Agreed sale value must be greater than zero.".to_string());
    }
    if payload.receipt_amount <= 0.0 {
        return Err("Receipt amount must be greater than zero.".to_string());
    }
    if payload.receipt_amount > payload.agreed_sale_value {
        return Err("Receipt amount cannot be greater than the agreed sale value.".to_string());
    }

    // Start a database transaction
    let mut tx = pool
        .begin()
        .await
        .map_err(|e| format!("Failed to start transaction: {}", e))?;

    // 1. Verify unit is available
    let unit_status: String = sqlx::query_scalar("SELECT status FROM units WHERE id = ?")
        .bind(payload.unit_id)
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| format!("Unit not found or query failed: {}", e))?;

    if unit_status != "Available" {
        return Err(format!("Unit is not available for booking (Current status: {}).", unit_status));
    }

    // 2. Fetch or Create Customer
    let customer_id: i64 = if let Some(id) = payload.customer.id {
        // Customer ID already supplied, verify existence
        let exists: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM customers WHERE id = ?")
            .bind(id)
            .fetch_one(&mut *tx)
            .await
            .map_err(|e| e.to_string())?;
        if exists == 0 {
            return Err("Provided Customer ID does not exist.".to_string());
        }
        id
    } else {
        // Look up by PAN number to prevent duplicate customer profiles
        let existing_id: Option<i64> = sqlx::query_scalar("SELECT id FROM customers WHERE pan_number = ?")
            .bind(&payload.customer.pan_number)
            .fetch_optional(&mut *tx)
            .await
            .map_err(|e| e.to_string())?;

        match existing_id {
            Some(id) => id,
            None => {
                // Insert new customer
                let result = sqlx::query(
                    "INSERT INTO customers (name, phone, pan_number, aadhaar_number) VALUES (?, ?, ?, ?)"
                )
                .bind(&payload.customer.name)
                .bind(&payload.customer.phone)
                .bind(&payload.customer.pan_number)
                .bind(&payload.customer.aadhaar_number)
                .execute(&mut *tx)
                .await
                .map_err(|e| format!("Failed to insert customer: {}", e))?;
                
                result.last_insert_rowid()
            }
        }
    };

    // 3. Create Booking
    let booking_result = sqlx::query(
        "INSERT INTO bookings (customer_id, unit_id, booking_date, agreed_sale_value) VALUES (?, ?, ?, ?)"
    )
    .bind(customer_id)
    .bind(payload.unit_id)
    .bind(&payload.booking_date)
    .bind(payload.agreed_sale_value)
    .execute(&mut *tx)
    .await
    .map_err(|e| format!("Failed to create booking: {}", e))?;

    let booking_id = booking_result.last_insert_rowid();

    // 4. Update Unit Status to 'Booked'
    sqlx::query("UPDATE units SET status = 'Booked' WHERE id = ?")
        .bind(payload.unit_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| format!("Failed to update unit status: {}", e))?;

    // 5. Generate Receipt Number
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM receipts")
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;
    let receipt_number = format!("REC-{:05}", count + 1);

    // 6. Create Receipt
    sqlx::query(
        "INSERT INTO receipts (booking_id, receipt_number, amount, payment_mode, transaction_ref, date) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .bind(booking_id)
    .bind(&receipt_number)
    .bind(payload.receipt_amount)
    .bind(&payload.payment_mode)
    .bind(&payload.transaction_ref)
    .bind(&payload.booking_date) // using the same date for booking & initial receipt
    .execute(&mut *tx)
    .await
    .map_err(|e| format!("Failed to create receipt: {}", e))?;

    // Commit transaction
    tx.commit()
        .await
        .map_err(|e| format!("Failed to commit transaction: {}", e))?;

    Ok(receipt_number)
}

#[tauri::command]
pub async fn get_receipt_history(state: State<'_, DbState>) -> Result<Vec<ReceiptHistoryItem>, String> {
    let pool = &state.pool;

    let rows = sqlx::query(
        r#"
        SELECT 
            r.id as receipt_id,
            r.receipt_number,
            r.amount,
            r.payment_mode,
            r.transaction_ref,
            r.date,
            b.id as booking_id,
            b.agreed_sale_value,
            b.booking_date,
            c.name as customer_name,
            c.phone as customer_phone,
            c.pan_number as customer_pan,
            c.aadhaar_number as customer_aadhaar,
            u.unit_number,
            p.name as project_name,
            t.name as tower_name
        FROM receipts r
        JOIN bookings b ON r.booking_id = b.id
        JOIN customers c ON b.customer_id = c.id
        JOIN units u ON b.unit_id = u.id
        JOIN projects p ON u.project_id = p.id
        JOIN towers t ON u.tower_id = t.id
        ORDER BY r.id DESC
        "#
    )
    .fetch_all(pool)
    .await
    .map_err(|e| format!("Failed to query receipt history: {}", e))?;

    let mut history = Vec::new();
    for row in rows {
        history.push(ReceiptHistoryItem {
            receipt_id: row.get("receipt_id"),
            receipt_number: row.get("receipt_number"),
            amount: row.get("amount"),
            payment_mode: row.get("payment_mode"),
            transaction_ref: row.get("transaction_ref"),
            date: row.get("date"),
            booking_id: row.get("booking_id"),
            agreed_sale_value: row.get("agreed_sale_value"),
            booking_date: row.get("booking_date"),
            customer_name: row.get("customer_name"),
            customer_phone: row.get("customer_phone"),
            customer_pan: row.get("customer_pan"),
            customer_aadhaar: row.get("customer_aadhaar"),
            unit_number: row.get("unit_number"),
            project_name: row.get("project_name"),
            tower_name: row.get("tower_name"),
        });
    }

    Ok(history)
}

// ─── PDF / Print via system browser ────────────────────────────────────────
// window.print() does NOT work inside Tauri's WKWebView on macOS.
// Instead: frontend sends the receipt HTML, Rust saves it to a temp file,
// then opens it in the user's default browser where normal print works.
#[tauri::command]
pub async fn open_receipt_html(
    app: tauri::AppHandle,
    html: String,
    filename: String,
) -> Result<(), String> {
    use std::fs;

    // Resolve the app's local data directory (writable, platform-safe)
    let data_dir = app
        .path()
        .app_local_data_dir()
        .map_err(|e| format!("Cannot resolve app data dir: {e}"))?;

    // Ensure the directory exists
    fs::create_dir_all(&data_dir).map_err(|e| format!("Cannot create data dir: {e}"))?;

    // Build the temp file path
    let safe_name = filename
        .chars()
        .map(|c| if c.is_alphanumeric() || c == '-' || c == '_' { c } else { '_' })
        .collect::<String>();
    let file_path = data_dir.join(format!("{safe_name}.html"));

    // Write HTML content
    fs::write(&file_path, html.as_bytes())
        .map_err(|e| format!("Failed to write receipt file: {e}"))?;

    // Open in system default browser (supports print / save as PDF)
    tauri_plugin_opener::open_path(file_path.to_str().unwrap_or(""), None::<&str>)
        .map_err(|e| format!("Failed to open browser: {e}"))?;

    Ok(())
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ReceiptItem {
    pub id: i64,
    pub receipt_number: String,
    pub amount: f64,
    pub payment_mode: String,
    pub transaction_ref: String,
    pub date: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct BookingDetails {
    pub id: i64,
    pub customer_name: String,
    pub customer_phone: String,
    pub customer_pan: String,
    pub customer_aadhaar: String,
    pub agreed_sale_value: f64,
    pub booking_date: String,
    pub unit_id: i64,
    pub receipts: Vec<ReceiptItem>,
}

#[tauri::command]
pub async fn get_booking_details_by_unit(
    unit_id: i64,
    state: State<'_, DbState>,
) -> Result<Option<BookingDetails>, String> {
    let pool = &state.pool;

    // Fetch the active/most recent booking for this unit
    let booking_row = sqlx::query(
        r#"
        SELECT 
            b.id as booking_id,
            c.name as customer_name,
            c.phone as customer_phone,
            c.pan_number as customer_pan,
            c.aadhaar_number as customer_aadhaar,
            b.agreed_sale_value,
            b.booking_date
        FROM bookings b
        JOIN customers c ON b.customer_id = c.id
        WHERE b.unit_id = ?
        ORDER BY b.id DESC
        LIMIT 1
        "#
    )
    .bind(unit_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| format!("Failed to query booking: {}", e))?;

    match booking_row {
        Some(row) => {
            let booking_id: i64 = row.get("booking_id");
            let customer_name: String = row.get("customer_name");
            let customer_phone: String = row.get("customer_phone");
            let customer_pan: String = row.get("customer_pan");
            let customer_aadhaar: String = row.get("customer_aadhaar");
            let agreed_sale_value: f64 = row.get("agreed_sale_value");
            let booking_date: String = row.get("booking_date");

            // Fetch all receipts for this booking
            let receipt_rows = sqlx::query(
                r#"
                SELECT 
                    id,
                    receipt_number,
                    amount,
                    payment_mode,
                    transaction_ref,
                    date
                FROM receipts
                WHERE booking_id = ?
                ORDER BY id ASC
                "#
            )
            .bind(booking_id)
            .fetch_all(pool)
            .await
            .map_err(|e| format!("Failed to query receipts: {}", e))?;

            let mut receipts = Vec::new();
            for r_row in receipt_rows {
                receipts.push(ReceiptItem {
                    id: r_row.get("id"),
                    receipt_number: r_row.get("receipt_number"),
                    amount: r_row.get("amount"),
                    payment_mode: r_row.get("payment_mode"),
                    transaction_ref: r_row.get("transaction_ref"),
                    date: r_row.get("date"),
                });
            }

            Ok(Some(BookingDetails {
                id: booking_id,
                customer_name,
                customer_phone,
                customer_pan,
                customer_aadhaar,
                agreed_sale_value,
                booking_date,
                unit_id,
                receipts,
            }))
        }
        None => Ok(None)
    }
}

#[tauri::command]
pub async fn create_additional_receipt(
    booking_id: i64,
    amount: f64,
    payment_mode: String,
    transaction_ref: String,
    date: String,
    state: State<'_, DbState>,
) -> Result<String, String> {
    let pool = &state.pool;

    if amount <= 0.0 {
        return Err("Receipt amount must be greater than zero.".to_string());
    }

    let mut tx = pool
        .begin()
        .await
        .map_err(|e| format!("Failed to start transaction: {}", e))?;

    // 1. Get agreed sale value
    let agreed_sale_value: f64 = sqlx::query_scalar("SELECT agreed_sale_value FROM bookings WHERE id = ?")
        .bind(booking_id)
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| format!("Booking not found or query failed: {}", e))?;

    // 2. Get total amount paid so far
    let total_paid: f64 = sqlx::query_scalar("SELECT COALESCE(SUM(amount), 0.0) FROM receipts WHERE booking_id = ?")
        .bind(booking_id)
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| format!("Failed to query existing receipts total: {}", e))?;

    let outstanding = agreed_sale_value - total_paid;

    if amount > outstanding + 0.01 {
        return Err(format!(
            "Receipt amount (₹{}) exceeds the outstanding balance (₹{}).",
            amount, outstanding
        ));
    }

    // 3. Generate Receipt Number
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM receipts")
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;
    let receipt_number = format!("REC-{:05}", count + 1);

    // 4. Create Receipt
    sqlx::query(
        "INSERT INTO receipts (booking_id, receipt_number, amount, payment_mode, transaction_ref, date) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .bind(booking_id)
    .bind(&receipt_number)
    .bind(amount)
    .bind(&payment_mode)
    .bind(&transaction_ref)
    .bind(&date)
    .execute(&mut *tx)
    .await
    .map_err(|e| format!("Failed to create receipt: {}", e))?;

    tx.commit()
        .await
        .map_err(|e| format!("Failed to commit transaction: {}", e))?;

    Ok(receipt_number)
}

#[tauri::command]
pub async fn update_unit_status(
    unit_id: i64,
    status: String,
    state: State<'_, DbState>,
) -> Result<(), String> {
    let pool = &state.pool;

    if status != "Available" && status != "Booked" && status != "Registered" {
        return Err("Invalid unit status requested.".to_string());
    }

    sqlx::query("UPDATE units SET status = ? WHERE id = ?")
        .bind(&status)
        .bind(unit_id)
        .execute(pool)
        .await
        .map_err(|e| format!("Failed to update unit status: {}", e))?;

    Ok(())
}


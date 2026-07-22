use serde::{Deserialize, Serialize};
use sqlx::{SqlitePool, Row};
use tauri::{Manager, State};
use chrono::{NaiveDate, Datelike};
use bcrypt::{hash, verify, DEFAULT_COST};

//use crate::towers::{self, Tower};
//use crate::units::{self, Unit};
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
    pub units: Option<Vec<Unit>>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Project {
    pub id: i64,
    pub name: String,
    pub location: String,
    pub rera_number: Option<String>,
    pub rera_website_url: Option<String>,
    pub towers: Option<Vec<Tower>>, // optional towers
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct BookingCustomerInfo {
    pub customer_id: i64,
    pub role: String,
    pub name: String,
    pub phone: String,
    pub pan_number: String,
    pub aadhaar_number: String,
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
    pub co_applicants: Option<Vec<Customer>>,
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
    pub status: String,
    pub void_reason: Option<String>,
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
    pub rera_number: Option<String>,
    pub co_applicants: Option<Vec<BookingCustomerInfo>>,
}

// ─── Financial Year Helper ──────────────────────────────────────────────────
/// Derives the Indian financial year string (e.g. "2026-27") from a date.
/// Indian FY runs April 1 to March 31.
fn get_financial_year(date_str: &str) -> String {
    let date = NaiveDate::parse_from_str(date_str, "%Y-%m-%d")
        .unwrap_or_else(|_| chrono::Local::now().date_naive());
    let year = date.year();
    let month = date.month();
    if month >= 4 {
        // April onwards → FY is year to year+1
        format!("{}-{}", year, (year + 1) % 100)
    } else {
        // Jan–March → FY is year-1 to year
        format!("{}-{}", year - 1, year % 100)
    }
}

/// Generate the next receipt number for a given project and date.
/// Format: `{PREFIX}/{PROJECT_CODE}/{FY}/{SEQUENCE}` e.g. `REC/PRJ-1/2026-27/00012`
async fn generate_receipt_number(
    tx: &mut sqlx::Transaction<'_, sqlx::Sqlite>,
    project_id: i64,
    date_str: &str,
) -> Result<String, String> {
    let fy = get_financial_year(date_str);

    // Upsert: create row if missing, then increment
    sqlx::query(
        r#"
        INSERT INTO receipt_sequences (project_id, financial_year, last_number)
        VALUES (?, ?, 0)
        ON CONFLICT(project_id, financial_year) DO NOTHING;
        "#
    )
    .bind(project_id)
    .bind(&fy)
    .execute(&mut **tx)
    .await
    .map_err(|e| format!("Failed to init receipt sequence: {}", e))?;

    // Atomically increment and retrieve the new number
    sqlx::query(
        "UPDATE receipt_sequences SET last_number = last_number + 1 WHERE project_id = ? AND financial_year = ?"
    )
    .bind(project_id)
    .bind(&fy)
    .execute(&mut **tx)
    .await
    .map_err(|e| format!("Failed to increment receipt sequence: {}", e))?;

    let row = sqlx::query(
        "SELECT last_number, prefix FROM receipt_sequences WHERE project_id = ? AND financial_year = ?"
    )
    .bind(project_id)
    .bind(&fy)
    .fetch_one(&mut **tx)
    .await
    .map_err(|e| format!("Failed to read receipt sequence: {}", e))?;

    let seq_num: i64 = row.get("last_number");
    let prefix: String = row.get("prefix");

    Ok(format!("{}/PRJ-{}/{}/{:05}", prefix, project_id, fy, seq_num))
}

#[tauri::command]
pub async fn get_property_map(state: State<'_, DbState>) -> Result<Vec<Project>, String> {
    let pool = &state.pool;

    // 1. Fetch all projects
    let projects_rows = sqlx::query("SELECT id, name, location, rera_number, rera_website_url FROM projects ORDER BY name")
        .fetch_all(pool)
        .await
        .map_err(|e| format!("Failed to fetch projects: {}", e))?;

    let mut projects = Vec::new();
    for p_row in projects_rows {
        let p_id: i64 = p_row.get("id");
        let p_name: String = p_row.get("name");
        let p_location: String = p_row.get("location");
        let p_rera: Option<String> = p_row.get("rera_number");
        let p_rera_url: Option<String> = p_row.get("rera_website_url");

        // 2. Fetch towers for this project
        let towers_rows = sqlx::query("SELECT id, name FROM towers WHERE project_id = ? ORDER BY name")
            .bind(p_id)
            .fetch_all(pool)
            .await
            .map_err(|e| format!("Failed to fetch towers: {}", e))?;

        let mut towers: Vec<Tower> = Vec::new();
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

            let mut units: Vec<Unit> = Vec::new();
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
                units: Some(units),
            });
        }

        projects.push(Project {
            id: p_id,
            name: p_name,
            location: p_location,
            rera_number: p_rera,
            rera_website_url: p_rera_url,
            towers: Some(towers),
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

    // 3b. Insert into booking_customers junction table (primary buyer)
    sqlx::query(
        "INSERT INTO booking_customers (booking_id, customer_id, role) VALUES (?, ?, 'Primary')"
    )
    .bind(booking_id)
    .bind(customer_id)
    .execute(&mut *tx)
    .await
    .map_err(|e| format!("Failed to link primary customer to booking: {}", e))?;

    // 3c. Insert co-applicants if provided
    if let Some(co_applicants) = &payload.co_applicants {
        for co_app in co_applicants {
            // Look up or create the co-applicant customer record
            let co_id: i64 = if let Some(id) = co_app.id {
                id
            } else {
                let existing: Option<i64> = sqlx::query_scalar(
                    "SELECT id FROM customers WHERE pan_number = ?"
                )
                .bind(&co_app.pan_number)
                .fetch_optional(&mut *tx)
                .await
                .map_err(|e| e.to_string())?;

                match existing {
                    Some(id) => id,
                    None => {
                        let result = sqlx::query(
                            "INSERT INTO customers (name, phone, pan_number, aadhaar_number) VALUES (?, ?, ?, ?)"
                        )
                        .bind(&co_app.name)
                        .bind(&co_app.phone)
                        .bind(&co_app.pan_number)
                        .bind(&co_app.aadhaar_number)
                        .execute(&mut *tx)
                        .await
                        .map_err(|e| format!("Failed to insert co-applicant: {}", e))?;
                        result.last_insert_rowid()
                    }
                }
            };

            sqlx::query(
                "INSERT OR IGNORE INTO booking_customers (booking_id, customer_id, role) VALUES (?, ?, 'Co-Applicant')"
            )
            .bind(booking_id)
            .bind(co_id)
            .execute(&mut *tx)
            .await
            .map_err(|e| format!("Failed to link co-applicant to booking: {}", e))?;
        }
    }

    // 4. Update Unit Status to 'Booked'
    sqlx::query("UPDATE units SET status = 'Booked' WHERE id = ?")
        .bind(payload.unit_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| format!("Failed to update unit status: {}", e))?;

    // 5. Get project_id for this unit (needed for receipt numbering)
    let unit_project_id: i64 = sqlx::query_scalar("SELECT project_id FROM units WHERE id = ?")
        .bind(payload.unit_id)
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| format!("Failed to get unit project: {}", e))?;

    // 6. Generate Receipt Number (configurable, per-project, per-FY)
    let receipt_number = generate_receipt_number(&mut tx, unit_project_id, &payload.booking_date).await?;

    // 7. Create Receipt
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
            r.status,
            r.void_reason,
            b.id as booking_id,
            b.agreed_sale_value,
            b.booking_date,
            c.name as customer_name,
            c.phone as customer_phone,
            c.pan_number as customer_pan,
            c.aadhaar_number as customer_aadhaar,
            u.unit_number,
            p.name as project_name,
            t.name as tower_name,
            p.rera_number
        FROM receipts r
        JOIN bookings b ON r.booking_id = b.id
        JOIN booking_customers bc ON bc.booking_id = b.id AND bc.role = 'Primary'
        JOIN customers c ON bc.customer_id = c.id
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
        let booking_id: i64 = row.get("booking_id");

        // Fetch all co-applicants for this booking
        let co_app_rows = sqlx::query(
            r#"
            SELECT 
                bc.customer_id,
                bc.role,
                c.name,
                c.phone,
                c.pan_number,
                c.aadhaar_number
            FROM booking_customers bc
            JOIN customers c ON bc.customer_id = c.id
            WHERE bc.booking_id = ?
            ORDER BY bc.role ASC, c.name ASC
            "#
        )
        .bind(booking_id)
        .fetch_all(pool)
        .await
        .map_err(|e| format!("Failed to query co-applicants for receipt: {}", e))?;

        let mut co_applicants = Vec::new();
        for ca_row in co_app_rows {
            co_applicants.push(BookingCustomerInfo {
                customer_id: ca_row.get("customer_id"),
                role: ca_row.get("role"),
                name: ca_row.get("name"),
                phone: ca_row.get("phone"),
                pan_number: ca_row.get("pan_number"),
                aadhaar_number: ca_row.get("aadhaar_number"),
            });
        }

        history.push(ReceiptHistoryItem {
            receipt_id: row.get("receipt_id"),
            receipt_number: row.get("receipt_number"),
            amount: row.get("amount"),
            payment_mode: row.get("payment_mode"),
            transaction_ref: row.get("transaction_ref"),
            date: row.get("date"),
            status: row.get("status"),
            void_reason: row.get("void_reason"),
            booking_id,
            agreed_sale_value: row.get("agreed_sale_value"),
            booking_date: row.get("booking_date"),
            customer_name: row.get("customer_name"),
            customer_phone: row.get("customer_phone"),
            customer_pan: row.get("customer_pan"),
            customer_aadhaar: row.get("customer_aadhaar"),
            unit_number: row.get("unit_number"),
            project_name: row.get("project_name"),
            tower_name: row.get("tower_name"),
            rera_number: row.get("rera_number"),
            co_applicants: Some(co_applicants),
        });
    }

    Ok(history)
}

// ─── PDF / Print via system browser ────────────────────────────────────────
// window.print() does NOT work inside Tauri's WKWebView on macOS.
// Instead: frontend sends the receipt HTML, Rust saves it to a temp file,
// then opens it in the user's default browser where normal print works.
#[tauri::command]
pub async fn generate_and_open_pdf(
    app: tauri::AppHandle,
    html: String,
    filename: String,
) -> Result<(), String> {
    use std::fs;
    use headless_chrome::Browser;

    let data_dir = app
        .path()
        .app_local_data_dir()
        .map_err(|e| format!("Cannot resolve app data dir: {e}"))?;

    fs::create_dir_all(&data_dir).map_err(|e| format!("Cannot create data dir: {e}"))?;

    let safe_name = filename
        .chars()
        .map(|c| if c.is_alphanumeric() || c == '-' || c == '_' { c } else { '_' })
        .collect::<String>();
        
    let html_path = data_dir.join(format!("{safe_name}.html"));
    let pdf_path = data_dir.join(format!("{safe_name}.pdf"));

    fs::write(&html_path, html.as_bytes())
        .map_err(|e| format!("Failed to write HTML file: {e}"))?;

    let html_path_clone = html_path.clone();
    
    let pdf_data = tauri::async_runtime::spawn_blocking(move || -> Result<Vec<u8>, String> {
        let browser = Browser::default().map_err(|e| format!("Failed to launch browser: {e}"))?;
        let tab = browser.new_tab().map_err(|e| format!("Failed to open tab: {e}"))?;
        
        let file_url = format!("file://{}", html_path_clone.to_str().unwrap_or(""));
        tab.navigate_to(&file_url).map_err(|e| format!("Failed to navigate: {e}"))?;
        tab.wait_until_navigated().map_err(|e| format!("Failed to wait for navigation: {e}"))?;
        
        let pdf_data = tab.print_to_pdf(None).map_err(|e| format!("Failed to generate PDF: {e}"))?;
        Ok(pdf_data)
    }).await.map_err(|e| format!("Task failed: {e}"))??;

    fs::write(&pdf_path, pdf_data)
        .map_err(|e| format!("Failed to write PDF file: {e}"))?;

    tauri_plugin_opener::open_path(pdf_path.to_str().unwrap_or(""), None::<&str>)
        .map_err(|e| format!("Failed to open PDF: {e}"))?;

    Ok(())
}

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
    pub status: String,
    pub void_reason: Option<String>,
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
    pub co_applicants: Vec<BookingCustomerInfo>,
}

#[tauri::command]
pub async fn get_booking_details_by_unit(
    unit_id: i64,
    state: State<'_, DbState>,
) -> Result<Option<BookingDetails>, String> {
    let pool = &state.pool;

    // Fetch the active/most recent booking for this unit
    // Join through booking_customers junction table for the primary buyer
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
        JOIN booking_customers bc ON bc.booking_id = b.id AND bc.role = 'Primary'
        JOIN customers c ON bc.customer_id = c.id
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
                    date,
                    status,
                    void_reason
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
                    status: r_row.get("status"),
                    void_reason: r_row.get("void_reason"),
                });
            }

            // Fetch all co-applicants for this booking
            let co_app_rows = sqlx::query(
                r#"
                SELECT 
                    bc.customer_id,
                    bc.role,
                    c.name,
                    c.phone,
                    c.pan_number,
                    c.aadhaar_number
                FROM booking_customers bc
                JOIN customers c ON bc.customer_id = c.id
                WHERE bc.booking_id = ?
                ORDER BY bc.role ASC, c.name ASC
                "#
            )
            .bind(booking_id)
            .fetch_all(pool)
            .await
            .map_err(|e| format!("Failed to query co-applicants: {}", e))?;

            let mut co_applicants = Vec::new();
            for ca_row in co_app_rows {
                co_applicants.push(BookingCustomerInfo {
                    customer_id: ca_row.get("customer_id"),
                    role: ca_row.get("role"),
                    name: ca_row.get("name"),
                    phone: ca_row.get("phone"),
                    pan_number: ca_row.get("pan_number"),
                    aadhaar_number: ca_row.get("aadhaar_number"),
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
                co_applicants,
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

    // 1. Get agreed sale value and unit's project_id
    let booking_row = sqlx::query(
        "SELECT b.agreed_sale_value, u.project_id FROM bookings b JOIN units u ON b.unit_id = u.id WHERE b.id = ?"
    )
    .bind(booking_id)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| format!("Booking not found or query failed: {}", e))?;

    let agreed_sale_value: f64 = booking_row.get("agreed_sale_value");
    let unit_project_id: i64 = booking_row.get("project_id");

    // 2. Get total amount paid so far (exclude voided receipts)
    let total_paid: f64 = sqlx::query_scalar("SELECT COALESCE(SUM(amount), 0.0) FROM receipts WHERE booking_id = ? AND status = 'Active'")
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

    // 3. Generate Receipt Number (configurable, per-project, per-FY)
    let receipt_number = generate_receipt_number(&mut tx, unit_project_id, &date).await?;

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

// CREATE
#[tauri::command]
pub async fn create_project(
    state: State<'_, DbState>,
    name: String,
    location: String,
    rera_number: Option<String>,
    rera_website_url: Option<String>,
) -> Result<i64, String> {
    let pool = &state.pool;
    let rec = sqlx::query(
        "INSERT INTO projects (name, location, rera_number, rera_website_url) VALUES (?, ?, ?, ?)"
    )
    .bind(&name)
    .bind(&location)
    .bind(&rera_number)
    .bind(&rera_website_url)
    .execute(pool)
    .await
    .map_err(|e| format!("Failed to insert project: {}", e))?;

    Ok(rec.last_insert_rowid())
}

// READ
#[tauri::command]
pub async fn get_projects(state: State<'_, DbState>) -> Result<Vec<Project>, String> {
    let pool = &state.pool;
    let rows = sqlx::query("SELECT id, name, location, rera_number, rera_website_url FROM projects ORDER BY name")
        .fetch_all(pool)
        .await
        .map_err(|e| format!("Failed to fetch projects: {}", e))?;

    Ok(rows.into_iter().map(|row| Project {
        id: row.get("id"),
        name: row.get("name"),
        location: row.get("location"),
        rera_number: row.get("rera_number"),
        rera_website_url: row.get("rera_website_url"),
        towers: None,
    }).collect())
}

// UPDATE
#[tauri::command]
pub async fn update_project(
    state: State<'_, DbState>,
    id: i64,
    name: String,
    location: String,
    rera_number: Option<String>,
    rera_website_url: Option<String>,
) -> Result<(), String> {
    let pool = &state.pool;
    sqlx::query("UPDATE projects SET name = ?, location = ?, rera_number = ?, rera_website_url = ? WHERE id = ?")
        .bind(&name)
        .bind(&location)
        .bind(&rera_number)
        .bind(&rera_website_url)
        .bind(id)
        .execute(pool)
        .await
        .map_err(|e| format!("Failed to update project: {}", e))?;
    Ok(())
}

// DELETE
#[tauri::command]
pub async fn delete_project(state: State<'_, DbState>, id: i64) -> Result<(), String> {
    let pool = &state.pool;
    sqlx::query("DELETE FROM projects WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await
        .map_err(|e| format!("Failed to delete project: {}", e))?;
    Ok(())
}


// CREATE Tower
#[tauri::command]
pub async fn create_tower(state: State<'_, DbState>, project_id: i64, name: String) -> Result<i64, String> {
    let pool = &state.pool;
    let rec = sqlx::query("INSERT INTO towers (project_id, name) VALUES (?, ?)")
        .bind(project_id)
        .bind(name)
        .execute(pool)
        .await
        .map_err(|e| format!("Failed to insert tower: {}", e))?;

    Ok(rec.last_insert_rowid())
}

// READ Towers by project
#[tauri::command]
pub async fn get_towers(state: State<'_, DbState>, project_id: i64) -> Result<Vec<Tower>, String> {
    let pool = &state.pool;
    let rows = sqlx::query("SELECT id, project_id, name FROM towers WHERE project_id = ? ORDER BY name")
        .bind(project_id)
        .fetch_all(pool)
        .await
        .map_err(|e| format!("Failed to fetch towers: {}", e))?;

    Ok(rows.into_iter().map(|row| Tower {
        id: row.get("id"),
        project_id: row.get("project_id"),
        name: row.get("name"),
        units: None, // empty list until you fetch units
    }).collect())
}

// UPDATE Tower
#[tauri::command]
pub async fn update_tower(state: State<'_, DbState>, id: i64, project_id: i64, name: String) -> Result<(), String> {
    let pool = &state.pool;
    sqlx::query("UPDATE towers SET project_id = ?, name = ? WHERE id = ?")
        .bind(project_id)
        .bind(name)
        .bind(id)
        .execute(pool)
        .await
        .map_err(|e| format!("Failed to update tower: {}", e))?;
    Ok(())
}

// DELETE Tower
#[tauri::command]
pub async fn delete_tower(state: State<'_, DbState>, id: i64) -> Result<(), String> {
    let pool = &state.pool;
    sqlx::query("DELETE FROM towers WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await
        .map_err(|e| format!("Failed to delete tower: {}", e))?;
    Ok(())
}
 
// CREATE Unit
#[tauri::command]
pub async fn create_unit(
    state: State<'_, DbState>,
    project_id: i64,
    tower_id: i64,
    unit_number: String,
    status: String,
    base_price: f64,
    configuration: String,
) -> Result<i64, String> {
    let pool = &state.pool;
    let rec = sqlx::query(
        "INSERT INTO units (project_id, tower_id, unit_number, status, base_price, configuration)
         VALUES (?, ?, ?, ?, ?, ?)"
    )
    .bind(project_id)
    .bind(tower_id)
    .bind(unit_number)
    .bind(status)
    .bind(base_price)
    .bind(configuration)
    .execute(pool)
    .await
    .map_err(|e| format!("Failed to insert unit: {}", e))?;

    Ok(rec.last_insert_rowid())
}

// READ Units by project
#[tauri::command]
pub async fn get_units(state: State<'_, DbState>, project_id: i64) -> Result<Vec<Unit>, String> {
    println!("Message from Rust: {}", project_id);
    let pool = &state.pool;
    let rows = sqlx::query(
        "SELECT id, project_id, tower_id, unit_number, status, base_price, configuration
         FROM units
         WHERE project_id = ?
         ORDER BY unit_number"
    )
    .bind(project_id)
    .fetch_all(pool)
    .await
    .map_err(|e| format!("Failed to fetch units: {}", e))?;

    Ok(rows.into_iter().map(|row| Unit {
        id: row.get("id"),
        project_id: row.get("project_id"),
        tower_id: row.get("tower_id"),
        unit_number: row.get("unit_number"),
        status: row.get("status"),
        base_price: row.get("base_price"),
        configuration: row.get("configuration"),
    }).collect())
}

// UPDATE Unit
#[tauri::command]
pub async fn update_unit(
    state: State<'_, DbState>,
    id: i64,
    project_id: i64,
    tower_id: i64,
    unit_number: String,
    status: String,
    base_price: f64,
    configuration: String,
) -> Result<(), String> {
    let pool = &state.pool;
    sqlx::query(
        "UPDATE units
         SET project_id = ?, tower_id = ?, unit_number = ?, status = ?, base_price = ?, configuration = ?
         WHERE id = ?"
    )
    .bind(project_id)
    .bind(tower_id)
    .bind(unit_number)
    .bind(status)
    .bind(base_price)
    .bind(configuration)
    .bind(id)
    .execute(pool)
    .await
    .map_err(|e| format!("Failed to update unit: {}", e))?;
    Ok(())
}

// DELETE Unit
#[tauri::command]
pub async fn delete_unit(state: State<'_, DbState>, id: i64) -> Result<(), String> {
    let pool = &state.pool;
    sqlx::query("DELETE FROM units WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await
        .map_err(|e| format!("Failed to delete unit: {}", e))?;
    Ok(())
}

// ─── Authentication ────────────────────────────────────────────────────────
#[tauri::command]
pub async fn is_pin_setup(state: State<'_, DbState>) -> Result<bool, String> {
    let pin_hash: Option<String> = sqlx::query_scalar("SELECT pin_hash FROM settings WHERE id = 1")
        .fetch_one(&state.pool)
        .await
        .map_err(|e| format!("Database error: {}", e))?;
    Ok(pin_hash.is_some())
}

#[tauri::command]
pub async fn setup_pin(pin: String, state: State<'_, DbState>) -> Result<(), String> {
    if pin.trim().is_empty() {
        return Err("PIN cannot be empty".to_string());
    }
    let hashed = hash(pin, DEFAULT_COST).map_err(|e| format!("Failed to hash PIN: {}", e))?;
    sqlx::query("UPDATE settings SET pin_hash = ? WHERE id = 1")
        .bind(hashed)
        .execute(&state.pool)
        .await
        .map_err(|e| format!("Database error: {}", e))?;
    Ok(())
}

#[tauri::command]
pub async fn verify_pin(pin: String, state: State<'_, DbState>) -> Result<bool, String> {
    let pin_hash: Option<String> = sqlx::query_scalar("SELECT pin_hash FROM settings WHERE id = 1")
        .fetch_one(&state.pool)
        .await
        .map_err(|e| format!("Database error: {}", e))?;
        
    if let Some(h) = pin_hash {
        let valid = verify(pin, &h).unwrap_or(false);
        Ok(valid)
    } else {
        Err("PIN is not set up".to_string())
    }
}

// ─── Backups ────────────────────────────────────────────────────────
#[tauri::command]
pub async fn create_backup(app: tauri::AppHandle) -> Result<String, String> {
    use std::fs;
    
    // Get the source DB path
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {}", e))?;
    let db_path = app_data_dir.join("real_estate_erp.db");

    // Ensure it exists
    if !db_path.exists() {
        return Err("Database file not found. Nothing to backup.".to_string());
    }

    // Get the backup directory
    let docs_dir = app
        .path()
        .document_dir()
        .map_err(|e| format!("Failed to get documents directory: {}", e))?;
    
    let backup_dir = docs_dir.join("RealEstateERP_Backups");
    fs::create_dir_all(&backup_dir).map_err(|e| format!("Failed to create backup dir: {}", e))?;

    // Create a timestamped backup name
    let timestamp = chrono::Local::now().format("%Y%m%d_%H%M%S").to_string();
    let backup_filename = format!("real_estate_erp_{}.db", timestamp);
    let backup_path = backup_dir.join(&backup_filename);

    // Copy the file
    fs::copy(&db_path, &backup_path).map_err(|e| format!("Failed to copy DB file: {}", e))?;

    Ok(backup_path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn void_receipt(
    receipt_id: i64,
    reason: String,
    state: State<'_, DbState>,
) -> Result<(), String> {
    let pool = &state.pool;
    
    if reason.trim().is_empty() {
        return Err("Void reason cannot be empty.".to_string());
    }

    let affected = sqlx::query("UPDATE receipts SET status = 'Voided', void_reason = ? WHERE id = ?")
        .bind(&reason)
        .bind(receipt_id)
        .execute(pool)
        .await
        .map_err(|e| format!("Failed to void receipt: {}", e))?;

    if affected.rows_affected() == 0 {
        return Err("Receipt not found.".to_string());
    }

    Ok(())
}

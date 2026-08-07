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
    pub carpet_area_sqm: Option<f64>,
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
    pub is_metro: Option<bool>,
    pub occupancy_certificate_date: Option<String>,
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
    pub gst_rate: Option<f64>,
    pub gst_amount: Option<f64>,
    pub taxable_value: Option<f64>,
    pub tds_amount: Option<f64>,
    pub gst_basis: Option<String>,
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
    let projects_rows = sqlx::query("SELECT id, name, location, rera_number, rera_website_url, is_metro, occupancy_certificate_date FROM projects ORDER BY name")
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
        let is_m: i64 = p_row.get("is_metro");
        let oc_date: Option<String> = p_row.get("occupancy_certificate_date");

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
                "SELECT id, unit_number, status, base_price, configuration, carpet_area_sqm FROM units WHERE tower_id = ? ORDER BY unit_number"
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
                    carpet_area_sqm: u_row.get("carpet_area_sqm"),
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
            is_metro: Some(is_m != 0),
            occupancy_certificate_date: oc_date,
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

    // 5. Get tax parameters & project_id for this unit
    let unit_info = sqlx::query(
        "SELECT u.project_id, u.carpet_area_sqm, p.is_metro, p.occupancy_certificate_date FROM units u JOIN projects p ON u.project_id = p.id WHERE u.id = ?"
    )
    .bind(payload.unit_id)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| format!("Failed to get unit tax info: {}", e))?;

    let unit_project_id: i64 = unit_info.get("project_id");
    let carpet_area_sqm: f64 = unit_info.get("carpet_area_sqm");
    let is_m: i64 = unit_info.get("is_metro");
    let oc_date: Option<String> = unit_info.get("occupancy_certificate_date");

    let gst = calculate_gst_and_tds(
        payload.agreed_sale_value,
        payload.receipt_amount,
        carpet_area_sqm,
        is_m != 0,
        oc_date.as_deref(),
        &payload.booking_date,
    );

    // 6. Generate Receipt Number (configurable, per-project, per-FY)
    let receipt_number = generate_receipt_number(&mut tx, unit_project_id, &payload.booking_date).await?;

    // 7. Create Receipt with Tax Breakdown
    sqlx::query(
        r#"
        INSERT INTO receipts (
            booking_id, receipt_number, amount, payment_mode, transaction_ref, date,
            gst_rate, gst_amount, taxable_value, tds_amount, gst_basis
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        "#
    )
    .bind(booking_id)
    .bind(&receipt_number)
    .bind(payload.receipt_amount)
    .bind(&payload.payment_mode)
    .bind(&payload.transaction_ref)
    .bind(&payload.booking_date)
    .bind(gst.gst_rate)
    .bind(gst.gst_amount)
    .bind(gst.taxable_value)
    .bind(gst.tds_amount)
    .bind(&gst.gst_basis)
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
            r.gst_rate,
            r.gst_amount,
            r.taxable_value,
            r.tds_amount,
            r.gst_basis,
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
            gst_rate: row.get("gst_rate"),
            gst_amount: row.get("gst_amount"),
            taxable_value: row.get("taxable_value"),
            tds_amount: row.get("tds_amount"),
            gst_basis: row.get("gst_basis"),
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
    pub gst_rate: Option<f64>,
    pub gst_amount: Option<f64>,
    pub taxable_value: Option<f64>,
    pub tds_amount: Option<f64>,
    pub gst_basis: Option<String>,
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
                    void_reason,
                    gst_rate,
                    gst_amount,
                    taxable_value,
                    tds_amount,
                    gst_basis
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
                    gst_rate: r_row.get("gst_rate"),
                    gst_amount: r_row.get("gst_amount"),
                    taxable_value: r_row.get("taxable_value"),
                    tds_amount: r_row.get("tds_amount"),
                    gst_basis: r_row.get("gst_basis"),
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

    // 1. Get agreed sale value, unit's project_id, and tax parameters
    let booking_row = sqlx::query(
        "SELECT b.agreed_sale_value, u.project_id, u.carpet_area_sqm, p.is_metro, p.occupancy_certificate_date FROM bookings b JOIN units u ON b.unit_id = u.id JOIN projects p ON u.project_id = p.id WHERE b.id = ?"
    )
    .bind(booking_id)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| format!("Booking not found or query failed: {}", e))?;

    let agreed_sale_value: f64 = booking_row.get("agreed_sale_value");
    let unit_project_id: i64 = booking_row.get("project_id");
    let carpet_area_sqm: f64 = booking_row.get("carpet_area_sqm");
    let is_m: i64 = booking_row.get("is_metro");
    let oc_date: Option<String> = booking_row.get("occupancy_certificate_date");

    let gst = calculate_gst_and_tds(
        agreed_sale_value,
        amount,
        carpet_area_sqm,
        is_m != 0,
        oc_date.as_deref(),
        &date,
    );

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

    // 4. Create Receipt with Tax Breakdown
    sqlx::query(
        r#"
        INSERT INTO receipts (
            booking_id, receipt_number, amount, payment_mode, transaction_ref, date,
            gst_rate, gst_amount, taxable_value, tds_amount, gst_basis
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        "#
    )
    .bind(booking_id)
    .bind(&receipt_number)
    .bind(amount)
    .bind(&payment_mode)
    .bind(&transaction_ref)
    .bind(&date)
    .bind(gst.gst_rate)
    .bind(gst.gst_amount)
    .bind(gst.taxable_value)
    .bind(gst.tds_amount)
    .bind(&gst.gst_basis)
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
    
    // 1. Include the missing columns in your SQL query
    let rows = sqlx::query(
        "SELECT id, name, location, rera_number, rera_website_url, is_metro, occupancy_certificate_date 
         FROM projects 
         ORDER BY name"
    )
    .fetch_all(pool)
    .await
    .map_err(|e| format!("Failed to fetch projects: {}", e))?;

    // 2. Map the new fields in the struct initializer
    Ok(rows
        .into_iter()
        .map(|row| Project {
            id: row.get("id"),
            name: row.get("name"),
            location: row.get("location"),
            rera_number: row.get("rera_number"),
            rera_website_url: row.get("rera_website_url"),
            is_metro: row.get("is_metro"),
            occupancy_certificate_date: row.get("occupancy_certificate_date"),
            towers: None,
        })
        .collect())
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
    
    // 1. Add carpet_area_sqm to the SQL SELECT query
    let rows = sqlx::query(
        "SELECT id, project_id, tower_id, unit_number, status, base_price, configuration, carpet_area_sqm
         FROM units
         WHERE project_id = ?
         ORDER BY unit_number"
    )
    .bind(project_id)
    .fetch_all(pool)
    .await
    .map_err(|e| format!("Failed to fetch units: {}", e))?;

    // 2. Map carpet_area_sqm into the Unit struct
    Ok(rows.into_iter().map(|row| Unit {
        id: row.get("id"),
        project_id: row.get("project_id"),
        tower_id: row.get("tower_id"),
        unit_number: row.get("unit_number"),
        status: row.get("status"),
        base_price: row.get("base_price"),
        configuration: row.get("configuration"),
        carpet_area_sqm: row.get("carpet_area_sqm"),
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

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct CustomerPropertySummary {
    pub booking_id: i64,
    pub unit_number: String,
    pub project_name: String,
    pub tower_name: String,
    pub agreed_sale_value: f64,
    pub total_paid: f64,
    pub outstanding_balance: f64,
    pub role: String, // "Primary" or "Co-Applicant"
    pub receipts: Vec<ReceiptItem>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct CustomerProfile {
    pub customer: Customer,
    pub properties: Vec<CustomerPropertySummary>,
    pub grand_total_agreed: f64,
    pub grand_total_paid: f64,
    pub grand_total_outstanding: f64,
}

#[tauri::command]
pub async fn search_customers(
    query: String,
    state: State<'_, DbState>,
) -> Result<Vec<Customer>, String> {
    let pool = &state.pool;
    let like_query = format!("%{}%", query);

    let rows = sqlx::query(
        r#"
        SELECT id, name, phone, pan_number, aadhaar_number
        FROM customers
        WHERE name LIKE ? OR phone LIKE ? OR pan_number LIKE ? OR aadhaar_number LIKE ?
        ORDER BY name ASC
        LIMIT 50
        "#
    )
    .bind(&like_query)
    .bind(&like_query)
    .bind(&like_query)
    .bind(&like_query)
    .fetch_all(pool)
    .await
    .map_err(|e| format!("Failed to search customers: {}", e))?;

    let mut customers = Vec::new();
    for row in rows {
        customers.push(Customer {
            id: Some(row.get("id")),
            name: row.get("name"),
            phone: row.get("phone"),
            pan_number: row.get("pan_number"),
            aadhaar_number: row.get("aadhaar_number"),
        });
    }

    Ok(customers)
}

#[tauri::command]
pub async fn get_customer_profile(
    customer_id: i64,
    state: State<'_, DbState>,
) -> Result<CustomerProfile, String> {
    let pool = &state.pool;

    // Fetch customer details
    let c_row = sqlx::query(
        "SELECT id, name, phone, pan_number, aadhaar_number FROM customers WHERE id = ?"
    )
    .bind(customer_id)
    .fetch_one(pool)
    .await
    .map_err(|e| format!("Customer not found: {}", e))?;

    let customer = Customer {
        id: Some(c_row.get("id")),
        name: c_row.get("name"),
        phone: c_row.get("phone"),
        pan_number: c_row.get("pan_number"),
        aadhaar_number: c_row.get("aadhaar_number"),
    };

    // Fetch all bookings for this customer (as Primary or Co-Applicant)
    let b_rows = sqlx::query(
        r#"
        SELECT 
            b.id as booking_id,
            b.agreed_sale_value,
            bc.role,
            u.unit_number,
            p.name as project_name,
            t.name as tower_name,
            COALESCE((SELECT SUM(amount) FROM receipts WHERE booking_id = b.id AND status = 'Active'), 0) as total_paid
        FROM booking_customers bc
        JOIN bookings b ON bc.booking_id = b.id
        JOIN units u ON b.unit_id = u.id
        JOIN projects p ON u.project_id = p.id
        JOIN towers t ON u.tower_id = t.id
        WHERE bc.customer_id = ?
        ORDER BY b.booking_date DESC
        "#
    )
    .bind(customer_id)
    .fetch_all(pool)
    .await
    .map_err(|e| format!("Failed to fetch customer properties: {}", e))?;

    let mut properties = Vec::new();
    let mut grand_total_agreed = 0.0;
    let mut grand_total_paid = 0.0;

    for row in b_rows {
        let agreed_sale_value: f64 = row.get("agreed_sale_value");
        let total_paid: f64 = row.get("total_paid");
        let outstanding_balance = agreed_sale_value - total_paid;

        grand_total_agreed += agreed_sale_value;
        grand_total_paid += total_paid;

        let booking_id: i64 = row.get("booking_id");
        
        let receipt_rows = sqlx::query(
            "SELECT 
                id, receipt_number, amount, payment_mode, transaction_ref, 
                date, status, void_reason, 
                gst_amount, gst_basis, gst_rate, taxable_value, tds_amount 
             FROM receipts 
             WHERE booking_id = ? 
             ORDER BY id ASC"
        )
        .bind(booking_id)
        .fetch_all(pool)
        .await
        .unwrap_or_default();

        let mut receipts = Vec::new();
        for r_row in receipt_rows {
            // 2. Add the missing fields to the struct initializer
            receipts.push(ReceiptItem {
                id: r_row.get("id"),
                receipt_number: r_row.get("receipt_number"),
                amount: r_row.get("amount"),
                payment_mode: r_row.get("payment_mode"),
                transaction_ref: r_row.get("transaction_ref"),
                date: r_row.get("date"),
                status: r_row.get("status"),
                void_reason: r_row.get("void_reason"),
                gst_amount: r_row.get("gst_amount"),
                gst_basis: r_row.get("gst_basis"),
                gst_rate: r_row.get("gst_rate"),
                taxable_value: r_row.get("taxable_value"),
                tds_amount: r_row.get("tds_amount"),
            });
        }

        properties.push(CustomerPropertySummary {
            booking_id,
            unit_number: row.get("unit_number"),
            project_name: row.get("project_name"),
            tower_name: row.get("tower_name"),
            agreed_sale_value,
            total_paid,
            outstanding_balance,
            role: row.get("role"),
            receipts,
        });
    }

    Ok(CustomerProfile {
        customer,
        properties,
        grand_total_agreed,
        grand_total_paid,
        grand_total_outstanding: grand_total_agreed - grand_total_paid,
    })
}

// ─── Tier 3 Payment Schedule & GST / TDS Logic ──────────────────────────────

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct GstBreakdown {
    pub gst_rate: f64,
    pub gst_amount: f64,
    pub taxable_value: f64,
    pub tds_amount: f64,
    pub gst_basis: String,
}

pub fn calculate_gst_and_tds(
    agreed_sale_value: f64,
    receipt_amount: f64,
    carpet_area_sqm: f64,
    is_metro: bool,
    oc_date: Option<&str>,
    receipt_date: &str,
) -> GstBreakdown {
    if let Some(oc) = oc_date {
        if !oc.trim().is_empty() && oc <= receipt_date {
            return GstBreakdown {
                gst_rate: 0.0,
                gst_amount: 0.0,
                taxable_value: receipt_amount,
                tds_amount: if agreed_sale_value >= 5_000_000.0 { receipt_amount * 0.01 } else { 0.0 },
                gst_basis: format!("Exempt (Occupancy Certificate Issued on {})", oc),
            };
        }
    }

    let taxable_value = receipt_amount * (2.0 / 3.0);
    let max_area = if is_metro { 60.0 } else { 90.0 };
    let is_affordable = agreed_sale_value <= 4_500_000.0 && carpet_area_sqm > 0.0 && carpet_area_sqm <= max_area;

    let (gst_rate, gst_basis) = if is_affordable {
        (1.0, format!("1% GST (Affordable Housing: Price ≤ ₹45L & Area ≤ {} sqm)", max_area))
    } else {
        (5.0, "5% GST (Standard Under-Construction Rate)".to_string())
    };

    let gst_amount = taxable_value * (gst_rate / 100.0);
    let tds_amount = if agreed_sale_value >= 5_000_000.0 { receipt_amount * 0.01 } else { 0.0 };

    GstBreakdown {
        gst_rate,
        gst_amount,
        taxable_value,
        tds_amount,
        gst_basis,
    }
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct PaymentScheduleItem {
    pub id: i64,
    pub booking_id: i64,
    pub milestone_name: String,
    pub due_date: Option<String>,
    pub percentage: f64,
    pub due_amount: f64,
    pub status: String,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct PaymentMilestoneInput {
    pub milestone_name: String,
    pub due_date: Option<String>,
    pub percentage: f64,
    pub due_amount: f64,
}

#[tauri::command]
pub async fn create_payment_schedule(
    booking_id: i64,
    milestones: Vec<PaymentMilestoneInput>,
    state: State<'_, DbState>,
) -> Result<(), String> {
    let pool = &state.pool;
    let mut tx = pool.begin().await.map_err(|e| e.to_string())?;

    sqlx::query("DELETE FROM payment_schedules WHERE booking_id = ? AND status = 'Pending'")
        .bind(booking_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| format!("Failed to clear existing schedule: {}", e))?;

    for m in milestones {
        sqlx::query(
            r#"
            INSERT INTO payment_schedules (booking_id, milestone_name, due_date, percentage, due_amount, status)
            VALUES (?, ?, ?, ?, ?, 'Pending')
            "#
        )
        .bind(booking_id)
        .bind(&m.milestone_name)
        .bind(&m.due_date)
        .bind(m.percentage)
        .bind(m.due_amount)
        .execute(&mut *tx)
        .await
        .map_err(|e| format!("Failed to insert milestone: {}", e))?;
    }

    tx.commit().await.map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn get_payment_schedule(
    booking_id: i64,
    state: State<'_, DbState>,
) -> Result<Vec<PaymentScheduleItem>, String> {
    let pool = &state.pool;
    let rows = sqlx::query(
        r#"
        SELECT id, booking_id, milestone_name, due_date, percentage, due_amount, status, created_at, updated_at
        FROM payment_schedules
        WHERE booking_id = ?
        ORDER BY id ASC
        "#
    )
    .bind(booking_id)
    .fetch_all(pool)
    .await
    .map_err(|e| format!("Failed to fetch payment schedule: {}", e))?;

    let mut items = Vec::new();
    for row in rows {
        items.push(PaymentScheduleItem {
            id: row.get("id"),
            booking_id: row.get("booking_id"),
            milestone_name: row.get("milestone_name"),
            due_date: row.get("due_date"),
            percentage: row.get("percentage"),
            due_amount: row.get("due_amount"),
            status: row.get("status"),
            created_at: row.get("created_at"),
            updated_at: row.get("updated_at"),
        });
    }

    Ok(items)
}

#[tauri::command]
pub async fn update_milestone_status(
    milestone_id: i64,
    status: String,
    state: State<'_, DbState>,
) -> Result<(), String> {
    let pool = &state.pool;
    if !["Pending", "Partially Paid", "Paid", "Overdue"].contains(&status.as_str()) {
        return Err("Invalid milestone status".to_string());
    }

    sqlx::query("UPDATE payment_schedules SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
        .bind(&status)
        .bind(milestone_id)
        .execute(pool)
        .await
        .map_err(|e| format!("Failed to update milestone: {}", e))?;

    Ok(())
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ProjectRevenueSummary {
    pub project_id: i64,
    pub project_name: String,
    pub total_units: i64,
    pub booked_units: i64,
    pub total_agreed_value: f64,
    pub total_collected: f64,
    pub total_outstanding: f64,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct FinancialDashboardStats {
    pub total_revenue: f64,
    pub total_collected: f64,
    pub total_outstanding: f64,
    pub overdue_amount: f64,
    pub total_units: i64,
    pub booked_units: i64,
    pub available_units: i64,
    pub registered_units: i64,
    pub project_summaries: Vec<ProjectRevenueSummary>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct OverdueMilestoneReport {
    pub milestone_id: i64,
    pub booking_id: i64,
    pub milestone_name: String,
    pub due_date: String,
    pub due_amount: f64,
    pub status: String,
    pub customer_name: String,
    pub customer_phone: String,
    pub unit_number: String,
    pub project_name: String,
}

#[tauri::command]
pub async fn get_financial_dashboard_stats(
    state: State<'_, DbState>,
) -> Result<FinancialDashboardStats, String> {
    let pool = &state.pool;

    let total_units: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM units").fetch_one(pool).await.unwrap_or(0);
    let booked_units: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM units WHERE status = 'Booked'").fetch_one(pool).await.unwrap_or(0);
    let available_units: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM units WHERE status = 'Available'").fetch_one(pool).await.unwrap_or(0);
    let registered_units: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM units WHERE status = 'Registered'").fetch_one(pool).await.unwrap_or(0);

    let total_revenue: f64 = sqlx::query_scalar("SELECT COALESCE(SUM(agreed_sale_value), 0.0) FROM bookings").fetch_one(pool).await.unwrap_or(0.0);
    let total_collected: f64 = sqlx::query_scalar("SELECT COALESCE(SUM(amount), 0.0) FROM receipts WHERE status = 'Active'").fetch_one(pool).await.unwrap_or(0.0);
    let total_outstanding = total_revenue - total_collected;

    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
    let overdue_amount: f64 = sqlx::query_scalar(
        "SELECT COALESCE(SUM(due_amount), 0.0) FROM payment_schedules WHERE status != 'Paid' AND due_date IS NOT NULL AND due_date < ?"
    )
    .bind(&today)
    .fetch_one(pool)
    .await
    .unwrap_or(0.0);

    let p_rows = sqlx::query("SELECT id, name FROM projects ORDER BY name").fetch_all(pool).await.unwrap_or_default();
    let mut project_summaries = Vec::new();

    for p_row in p_rows {
        let p_id: i64 = p_row.get("id");
        let p_name: String = p_row.get("name");

        let p_total_units: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM units WHERE project_id = ?").bind(p_id).fetch_one(pool).await.unwrap_or(0);
        let p_booked_units: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM units WHERE project_id = ? AND status IN ('Booked','Registered')").bind(p_id).fetch_one(pool).await.unwrap_or(0);

        let p_agreed_val: f64 = sqlx::query_scalar(
            "SELECT COALESCE(SUM(b.agreed_sale_value), 0.0) FROM bookings b JOIN units u ON b.unit_id = u.id WHERE u.project_id = ?"
        ).bind(p_id).fetch_one(pool).await.unwrap_or(0.0);

        let p_collected_val: f64 = sqlx::query_scalar(
            "SELECT COALESCE(SUM(r.amount), 0.0) FROM receipts r JOIN bookings b ON r.booking_id = b.id JOIN units u ON b.unit_id = u.id WHERE u.project_id = ? AND r.status = 'Active'"
        ).bind(p_id).fetch_one(pool).await.unwrap_or(0.0);

        project_summaries.push(ProjectRevenueSummary {
            project_id: p_id,
            project_name: p_name,
            total_units: p_total_units,
            booked_units: p_booked_units,
            total_agreed_value: p_agreed_val,
            total_collected: p_collected_val,
            total_outstanding: p_agreed_val - p_collected_val,
        });
    }

    Ok(FinancialDashboardStats {
        total_revenue,
        total_collected,
        total_outstanding,
        overdue_amount,
        total_units,
        booked_units,
        available_units,
        registered_units,
        project_summaries,
    })
}

#[tauri::command]
pub async fn get_overdue_milestones_report(
    state: State<'_, DbState>,
) -> Result<Vec<OverdueMilestoneReport>, String> {
    let pool = &state.pool;
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();

    let rows = sqlx::query(
        r#"
        SELECT 
            ps.id as milestone_id,
            ps.booking_id,
            ps.milestone_name,
            ps.due_date,
            ps.due_amount,
            ps.status,
            c.name as customer_name,
            c.phone as customer_phone,
            u.unit_number,
            p.name as project_name
        FROM payment_schedules ps
        JOIN bookings b ON ps.booking_id = b.id
        JOIN booking_customers bc ON bc.booking_id = b.id AND bc.role = 'Primary'
        JOIN customers c ON bc.customer_id = c.id
        JOIN units u ON b.unit_id = u.id
        JOIN projects p ON u.project_id = p.id
        WHERE ps.status != 'Paid' AND ps.due_date IS NOT NULL AND ps.due_date < ?
        ORDER BY ps.due_date ASC
        "#
    )
    .bind(&today)
    .fetch_all(pool)
    .await
    .map_err(|e| format!("Failed to query overdue report: {}", e))?;

    let mut report = Vec::new();
    for row in rows {
        report.push(OverdueMilestoneReport {
            milestone_id: row.get("milestone_id"),
            booking_id: row.get("booking_id"),
            milestone_name: row.get("milestone_name"),
            due_date: row.get("due_date"),
            due_amount: row.get("due_amount"),
            status: row.get("status"),
            customer_name: row.get("customer_name"),
            customer_phone: row.get("customer_phone"),
            unit_number: row.get("unit_number"),
            project_name: row.get("project_name"),
        });
    }

    Ok(report)
}

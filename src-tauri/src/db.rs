use sqlx::{sqlite::SqliteConnectOptions, SqlitePool};
use tauri::Manager;

pub async fn init_db(app_handle: &tauri::AppHandle) -> Result<SqlitePool, String> {
    // 1. Get app data directory path
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {}", e))?;

    // Create the directory if it does not exist
    std::fs::create_dir_all(&app_data_dir)
        .map_err(|e| format!("Failed to create app data directory: {}", e))?;

    let db_path = app_data_dir.join("real_estate_erp.db");

    // 2. Configure connection options (enforce foreign keys)
    let options = SqliteConnectOptions::new()
        .filename(&db_path)
        .create_if_missing(true)
        .pragma("foreign_keys", "ON");

    // 3. Connect to the pool
    let pool = SqlitePool::connect_with(options)
        .await
        .map_err(|e| format!("Failed to connect to SQLite: {}", e))?;

    // 4. Run migrations/schema setup
    create_tables(&pool).await?;

    // 5. Apply incremental migrations (Phase 0 schema changes)
    apply_migrations(&pool).await?;

    // 6. Seed initial data if database is new/empty
    seed_data_if_empty(&pool).await?;

    Ok(pool)
}

async fn create_tables(pool: &SqlitePool) -> Result<(), String> {
    let queries = vec![
        r#"
        CREATE TABLE IF NOT EXISTS projects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            location TEXT NOT NULL
        );
        "#,
        r#"
        CREATE TABLE IF NOT EXISTS towers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
        );
        "#,
        r#"
        CREATE TABLE IF NOT EXISTS units (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER NOT NULL,
            tower_id INTEGER NOT NULL,
            unit_number TEXT NOT NULL,
            status TEXT NOT NULL CHECK(status IN ('Available', 'Booked', 'Registered')),
            base_price REAL NOT NULL,
            configuration TEXT NOT NULL,
            FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
            FOREIGN KEY(tower_id) REFERENCES towers(id) ON DELETE CASCADE
        );
        "#,
        r#"
        CREATE TABLE IF NOT EXISTS customers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            phone TEXT NOT NULL,
            pan_number TEXT NOT NULL,
            aadhaar_number TEXT NOT NULL
        );
        "#,
        r#"
        CREATE TABLE IF NOT EXISTS bookings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            customer_id INTEGER NOT NULL,
            unit_id INTEGER NOT NULL,
            booking_date TEXT NOT NULL,
            agreed_sale_value REAL NOT NULL,
            FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE CASCADE,
            FOREIGN KEY(unit_id) REFERENCES units(id) ON DELETE CASCADE
        );
        "#,
        r#"
        CREATE TABLE IF NOT EXISTS receipts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            booking_id INTEGER NOT NULL,
            receipt_number TEXT NOT NULL,
            amount REAL NOT NULL,
            payment_mode TEXT NOT NULL CHECK(payment_mode IN ('Cash', 'Cheque', 'RTGS', 'IMPS')),
            transaction_ref TEXT NOT NULL,
            date TEXT NOT NULL,
            FOREIGN KEY(booking_id) REFERENCES bookings(id) ON DELETE CASCADE
        );
        "#
    ];

    for query in queries {
        sqlx::query(query)
            .execute(pool)
            .await
            .map_err(|e| format!("DDL execution failed: {}", e))?;
    }

    Ok(())
}

async fn seed_data_if_empty(pool: &SqlitePool) -> Result<(), String> {
    // Check if projects table is empty
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM projects")
        .fetch_one(pool)
        .await
        .map_err(|e| format!("Query failed to check project count: {}", e))?;

    if count == 0 {
        // Start seeding
        // 1. Projects
        sqlx::query("INSERT INTO projects (id, name, location) VALUES (1, 'Greenfield Heights', 'Sector 62, Noida')")
            .execute(pool).await.map_err(|e| e.to_string())?;
        sqlx::query("INSERT INTO projects (id, name, location) VALUES (2, 'Golden Sands Villa', 'Palm Beach Road, Mumbai')")
            .execute(pool).await.map_err(|e| e.to_string())?;

        // 2. Towers
        sqlx::query("INSERT INTO towers (id, project_id, name) VALUES (1, 1, 'Tower A')")
            .execute(pool).await.map_err(|e| e.to_string())?;
        sqlx::query("INSERT INTO towers (id, project_id, name) VALUES (2, 1, 'Tower B')")
            .execute(pool).await.map_err(|e| e.to_string())?;
        sqlx::query("INSERT INTO towers (id, project_id, name) VALUES (3, 2, 'Villas Block A')")
            .execute(pool).await.map_err(|e| e.to_string())?;

        // 3. Units
        // Tower A units
        sqlx::query("INSERT INTO units (project_id, tower_id, unit_number, status, base_price, configuration) VALUES (1, 1, '101', 'Available', 7500000.0, '2BHK')")
            .execute(pool).await.map_err(|e| e.to_string())?;
        sqlx::query("INSERT INTO units (project_id, tower_id, unit_number, status, base_price, configuration) VALUES (1, 1, '102', 'Available', 8500000.0, '3BHK')")
            .execute(pool).await.map_err(|e| e.to_string())?;
        sqlx::query("INSERT INTO units (project_id, tower_id, unit_number, status, base_price, configuration) VALUES (1, 1, '103', 'Available', 8500000.0, '3BHK')")
            .execute(pool).await.map_err(|e| e.to_string())?;

        // Tower B units
        sqlx::query("INSERT INTO units (project_id, tower_id, unit_number, status, base_price, configuration) VALUES (1, 2, '201', 'Available', 7800000.0, '2BHK')")
            .execute(pool).await.map_err(|e| e.to_string())?;
        sqlx::query("INSERT INTO units (project_id, tower_id, unit_number, status, base_price, configuration) VALUES (1, 2, '202', 'Available', 9200000.0, '3BHK')")
            .execute(pool).await.map_err(|e| e.to_string())?;

        // Villas Block A units
        sqlx::query("INSERT INTO units (project_id, tower_id, unit_number, status, base_price, configuration) VALUES (2, 3, 'V-01', 'Available', 15000000.0, '4BHK')")
            .execute(pool).await.map_err(|e| e.to_string())?;
        sqlx::query("INSERT INTO units (project_id, tower_id, unit_number, status, base_price, configuration) VALUES (2, 3, 'V-02', 'Available', 18000000.0, '4BHK')")
            .execute(pool).await.map_err(|e| e.to_string())?;
    }

    Ok(())
}

/// Apply incremental schema migrations. Each migration is tracked in
/// `_migrations` so it runs exactly once, even across app restarts.
async fn apply_migrations(pool: &SqlitePool) -> Result<(), String> {
    // Create migrations tracking table
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS _migrations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            applied_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        "#
    )
    .execute(pool)
    .await
    .map_err(|e| format!("Failed to create migrations table: {}", e))?;

    // Define all migrations in order
    let migrations: Vec<(&str, Vec<&str>)> = vec![
        // Phase 0.3 — RERA fields on projects
        ("001_add_rera_fields_to_projects", vec![
            "ALTER TABLE projects ADD COLUMN rera_number TEXT",
            "ALTER TABLE projects ADD COLUMN rera_website_url TEXT",
        ]),
        // Phase 0.1 — Configurable receipt numbering
        ("002_create_receipt_sequences", vec![
            r#"
            CREATE TABLE IF NOT EXISTS receipt_sequences (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL,
                financial_year TEXT NOT NULL,
                last_number INTEGER NOT NULL DEFAULT 0,
                prefix TEXT NOT NULL DEFAULT 'REC',
                FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
                UNIQUE(project_id, financial_year)
            );
            "#,
        ]),
        // Phase 0.2 — booking_customers junction table for joint ownership
        ("003_create_booking_customers", vec![
            r#"
            CREATE TABLE IF NOT EXISTS booking_customers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                booking_id INTEGER NOT NULL,
                customer_id INTEGER NOT NULL,
                role TEXT NOT NULL DEFAULT 'Primary' CHECK(role IN ('Primary', 'Co-Applicant')),
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY(booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
                FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE CASCADE,
                UNIQUE(booking_id, customer_id)
            );
            "#,
            // Migrate existing bookings.customer_id data into junction table
            r#"
            INSERT OR IGNORE INTO booking_customers (booking_id, customer_id, role)
            SELECT id, customer_id, 'Primary' FROM bookings
            WHERE id NOT IN (SELECT booking_id FROM booking_customers);
            "#,
        ]),
    ];

    for (name, queries) in migrations {
        // Check if migration already applied
        let applied: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM _migrations WHERE name = ?"
        )
        .bind(name)
        .fetch_one(pool)
        .await
        .map_err(|e| format!("Failed to check migration '{}': {}", name, e))?;

        if applied > 0 {
            continue;
        }

        // Apply all queries in this migration
        for query in &queries {
            sqlx::query(query)
                .execute(pool)
                .await
                .map_err(|e| format!("Migration '{}' failed: {} — Query: {}", name, e, query))?;
        }

        // Mark as applied
        sqlx::query("INSERT INTO _migrations (name) VALUES (?)")
            .bind(name)
            .execute(pool)
            .await
            .map_err(|e| format!("Failed to record migration '{}': {}", name, e))?;
    }

    Ok(())
}

package repository

import (
	"os"
	"path/filepath"
	"fmt"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"beidar-desktop/internal/core/domain"
)

// CloseDB safely closes the database connection
func CloseDB() error {
	if activeDB == nil {
		return nil
	}
	sqlDB, err := activeDB.DB()
	if err != nil {
		return err
	}
	err = sqlDB.Close()
	activeDB = nil
	return err
}

// ResetDB drops all tables and re-initializes
func ResetDB() error {
	if activeDB == nil {
		return fmt.Errorf("database not initialized")
	}

	models := []interface{}{
		&domain.PurchaseOrderItem{}, &domain.PurchaseOrder{},
		&domain.SaleItem{}, &domain.Sale{},
		&domain.CashMovement{}, &domain.Shift{},
		&domain.Payment{}, &domain.StockMovement{},
		&domain.Expense{}, &domain.Customer{}, &domain.Supplier{},
		&domain.Product{}, &domain.Category{}, &domain.AppPreferences{},
		&domain.ParkedSale{}, &domain.LoginAttempt{}, &domain.Staff{},
		&domain.BlockedDevice{}, &domain.Discount{}, &domain.AuditLog{},
	}

	sqlDB, err := activeDB.DB()
	if err == nil {
		_, _ = sqlDB.Exec("PRAGMA foreign_keys = OFF;")
		defer func() {
			_, _ = sqlDB.Exec("PRAGMA foreign_keys = ON;")
		}()
	}

	for _, model := range models {
		if activeDB.Migrator().HasTable(model) {
			if err := activeDB.Migrator().DropTable(model); err != nil {
				return fmt.Errorf("failed to drop table: %w", err)
			}
		}
	}

	if err := activeDB.AutoMigrate(models...); err != nil {
		return fmt.Errorf("failed to auto migrate: %w", err)
	}

	// Seed default preferences if not exists
	var count int64
	activeDB.Model(&domain.AppPreferences{}).Count(&count)
	if count == 0 {
		defaultPrefs := domain.AppPreferences{
			StoreName:       "متجر بيدر",
			Currency:        "IQD",
			Theme:           "dark",
			AccentColor:     "#306D29",
			Language:        "ar",
			LowStockTrigger: 5,
		}
		activeDB.Create(&defaultPrefs)
	}

	return nil
}

// BackupPath renames current DB to backup and returns the backup path
func BackupPath() (string, error) {
	configDir, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}
	dbPath := filepath.Join(configDir, "BeidarPOS_V3", "beidar_v3.db")
	backupPath := dbPath + ".backup"
	_ = os.Rename(dbPath, backupPath)
	return backupPath, nil
}

// RestoreBackup restores DB from the backup path
func RestoreBackup(backupPath string) error {
	configDir, err := os.UserConfigDir()
	if err != nil {
		return err
	}
	dbPath := filepath.Join(configDir, "BeidarPOS_V3", "beidar_v3.db")
	_ = os.Rename(backupPath, dbPath)
	_, err = InitDB()
	return err
}

// SetTestDB sets the active database connection (useful for unit testing)
func SetTestDB(db *gorm.DB) {
	activeDB = db
}

var activeDB *gorm.DB

// GetDB returns the active database connection
func GetDB() *gorm.DB {
	return activeDB
}

func InitDB() (*gorm.DB, error) {
	configDir, err := os.UserConfigDir()
	if err != nil {
		return nil, err
	}

	appDir := filepath.Join(configDir, "BeidarPOS_V3")
	if err := os.MkdirAll(appDir, 0755); err != nil {
		return nil, err
	}

	dbPath := filepath.Join(appDir, "beidar_v3.db")

	// Migration check: If legacy database exists at BeidarPOS/beidar.db and new DB does not exist, copy legacy DB over.
	legacyDbPath := filepath.Join(configDir, "BeidarPOS", "beidar.db")
	if _, err := os.Stat(dbPath); os.IsNotExist(err) {
		if _, err := os.Stat(legacyDbPath); err == nil {
			if data, err := os.ReadFile(legacyDbPath); err == nil {
				_ = os.WriteFile(dbPath, data, 0644)
			}
		}
	}

	// Config for glebarez (pure go)
	db, err := gorm.Open(sqlite.Open(dbPath), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Warn),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to connect database: %w", err)
	}

	// Enable WAL mode for better concurrent performance
	sqlDB, err := db.DB()
	if err != nil {
		return nil, err
	}
	_, _ = sqlDB.Exec("PRAGMA journal_mode=WAL;")
	_, _ = sqlDB.Exec("PRAGMA busy_timeout=5000;") // 5 seconds wait on lock
	_, _ = sqlDB.Exec("PRAGMA foreign_keys=ON;")   // Enable foreign key constraints

	// SQLite only supports one concurrent writer. Limit connections to 1 to avoid 'database is locked' issues,
	// especially when serving multiple LAN clients.
	sqlDB.SetMaxOpenConns(1)

	// Auto Migrate Domain Models
	err = db.AutoMigrate(
		&domain.Product{},
		&domain.Sale{},
		&domain.SaleItem{},
		&domain.Customer{},
		&domain.Supplier{},
		&domain.Expense{},
		&domain.Payment{},
		&domain.Category{},
		&domain.StockMovement{},
		&domain.AppPreferences{},
		&domain.ParkedSale{},
		&domain.LoginAttempt{},
		&domain.Staff{},
		&domain.Shift{},
		&domain.CashMovement{},
		&domain.PurchaseOrder{},
		&domain.PurchaseOrderItem{},
		&domain.BlockedDevice{},
		&domain.Discount{},
		&domain.AuditLog{},
	)

	if err != nil {
		return nil, fmt.Errorf("failed to auto migrate: %w", err)
	}

	// Seed default preferences if not exists
	var prefs domain.AppPreferences
	if result := db.First(&prefs); result.Error != nil {
		defaultPrefs := domain.AppPreferences{
			StoreName:       "متجر بيدر",
			Currency:        "IQD",
			Theme:           "dark",
			AccentColor:     "#306D29",
			Language:        "ar",
			LowStockTrigger: 5,
		}
		db.Create(&defaultPrefs)
	}

	activeDB = db
	return db, nil
}

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
	if DB == nil {
		return nil
	}
	sqlDB, err := DB.DB()
	if err != nil {
		return err
	}
	err = sqlDB.Close()
	DB = nil
	return err
}

// ResetDB drops all tables and re-initializes
func ResetDB() error {
	err := DB.Migrator().DropTable(
		&domain.Product{}, &domain.Sale{}, &domain.SaleItem{}, &domain.Customer{}, &domain.Supplier{},
		&domain.Expense{}, &domain.Category{}, &domain.StockMovement{}, &domain.AppPreferences{},
		&domain.Payment{}, &domain.ParkedSale{}, &domain.LoginAttempt{}, &domain.Staff{}, &domain.Shift{},
		&domain.CashMovement{}, &domain.PurchaseOrder{}, &domain.PurchaseOrderItem{}, &domain.BlockedDevice{},
		&domain.Discount{},
	)
	if err != nil {
		return err
	}
	return InitDB()
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
	return InitDB()
}

var DB *gorm.DB

func InitDB() error {
	configDir, err := os.UserConfigDir()
	if err != nil {
		return err
	}

	appDir := filepath.Join(configDir, "BeidarPOS_V3")
	if err := os.MkdirAll(appDir, 0755); err != nil {
		return err
	}

	dbPath := filepath.Join(appDir, "beidar_v3.db")

	// Config for glebarez (pure go)
	DB, err = gorm.Open(sqlite.Open(dbPath), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
	})
	if err != nil {
		return fmt.Errorf("failed to connect database: %w", err)
	}

	// Enable WAL mode for better concurrent performance
	sqlDB, err := DB.DB()
	if err != nil {
		return err
	}
	sqlDB.Exec("PRAGMA journal_mode=WAL;")
	sqlDB.Exec("PRAGMA busy_timeout=5000;") // 5 seconds wait on lock
	sqlDB.Exec("PRAGMA foreign_keys=ON;")   // Enable foreign key constraints

	// Auto Migrate Domain Models
	err = DB.AutoMigrate(
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
	)

	if err != nil {
		return fmt.Errorf("failed to auto migrate: %w", err)
	}

	// Seed default preferences if not exists
	var prefs domain.AppPreferences
	if result := DB.First(&prefs); result.Error != nil {
		defaultPrefs := domain.AppPreferences{
			StoreName:       "متجر بيدر",
			Currency:        "IQD",
			Theme:           "dark",
			AccentColor:     "emerald",
			Language:        "ar",
			LowStockTrigger: 5,
		}
		DB.Create(&defaultPrefs)
	}

	return nil
}

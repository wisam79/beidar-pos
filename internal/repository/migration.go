package repository

import (
	"fmt"
	"time"

	"beidar-desktop/internal/core/domain"
	"beidar-desktop/pkg/logger"

	"gorm.io/gorm"
)

// SchemaMigration tracks applied database schema migration versions
type SchemaMigration struct {
	Version         string    `gorm:"primaryKey;size:64" json:"version"`
	Description     string    `gorm:"size:255;not null" json:"description"`
	AppliedAt       time.Time `gorm:"not null" json:"appliedAt"`
	ExecutionTimeMs int64     `gorm:"not null" json:"executionTimeMs"`
}

// TableName explicitly specifies the table name for SchemaMigration
func (SchemaMigration) TableName() string {
	return "schema_migrations"
}

// Migration represents a single numbered schema migration
type Migration struct {
	Version     string
	Description string
	Up          func(db *gorm.DB) error
}

// registeredMigrations defines the ordered sequence of schema migrations
var registeredMigrations = []Migration{
	{
		Version:     "20260721_0001_baseline_v208",
		Description: "Baseline schema for Beidar POS v2.0.8 domain models",
		Up: func(db *gorm.DB) error {
			// Auto migrate all core domain models
			err := db.AutoMigrate(
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
				return fmt.Errorf("baseline automigrate failed: %w", err)
			}

			// Seed default preferences if table is empty
			var count int64
			db.Model(&domain.AppPreferences{}).Count(&count)
			if count == 0 {
				defaultPrefs := domain.AppPreferences{
					StoreName:       "متجر بيدر",
					Currency:        "IQD",
					Theme:           "dark",
					AccentColor:     "#306D29",
					Language:        "ar",
					LowStockTrigger: 5,
				}
				if err := db.Create(&defaultPrefs).Error; err != nil {
					return fmt.Errorf("failed to seed default preferences: %w", err)
				}
			}

			return nil
		},
	},
	{
		Version:     "20260813_0002_crm_pagination_indices",
		Description: "Add search indices for paginated customers and suppliers",
		Up: func(db *gorm.DB) error {
			// Ensure composite search indices exist for customer & supplier search performance
			_ = db.Exec("CREATE INDEX IF NOT EXISTS idx_customers_name_phone ON customers(name, phone);").Error
			_ = db.Exec("CREATE INDEX IF NOT EXISTS idx_suppliers_name_phone ON suppliers(name, phone);").Error
			return nil
		},
	},
}

// RunMigrations applies all pending schema migrations sequentially in transactions
func RunMigrations(db *gorm.DB) error {
	if db == nil {
		return fmt.Errorf("cannot run migrations on nil db")
	}

	// 1. Ensure schema_migrations table exists
	if err := db.AutoMigrate(&SchemaMigration{}); err != nil {
		return fmt.Errorf("failed to create schema_migrations table: %w", err)
	}

	// 2. Fetch applied migration versions
	var applied []SchemaMigration
	if err := db.Find(&applied).Error; err != nil {
		return fmt.Errorf("failed to query applied migrations: %w", err)
	}

	appliedSet := make(map[string]bool, len(applied))
	for _, m := range applied {
		appliedSet[m.Version] = true
	}

	// 3. Apply pending migrations sequentially
	for _, migration := range registeredMigrations {
		if appliedSet[migration.Version] {
			continue // Already applied
		}

		start := time.Now()
		if logger.Logger != nil {
			logger.Logger.Info("Migration", fmt.Sprintf("Applying migration %s: %s", migration.Version, migration.Description))
		}

		// Execute migration within a database transaction
		err := db.Transaction(func(tx *gorm.DB) error {
			if err := migration.Up(tx); err != nil {
				return err
			}

			record := SchemaMigration{
				Version:         migration.Version,
				Description:     migration.Description,
				AppliedAt:       time.Now().UTC(),
				ExecutionTimeMs: time.Since(start).Milliseconds(),
			}

			if err := tx.Create(&record).Error; err != nil {
				return fmt.Errorf("failed to record migration %s: %w", migration.Version, err)
			}

			return nil
		})

		if err != nil {
			if logger.Logger != nil {
				logger.Logger.Error("Migration", fmt.Sprintf("Migration %s failed: %v", migration.Version, err))
			}
			return fmt.Errorf("migration %s failed: %w", migration.Version, err)
		}

		// Post-migration integrity check: verify SQLite foreign key constraints
		var fkErrors []struct {
			Table  string `gorm:"column:table"`
			RowID  int64  `gorm:"column:rowid"`
			Parent string `gorm:"column:parent"`
			FkID   int64  `gorm:"column:fkid"`
		}
		if err := db.Raw("PRAGMA foreign_key_check;").Scan(&fkErrors).Error; err == nil && len(fkErrors) > 0 {
			if logger.Logger != nil {
				logger.Logger.Warn("Migration", fmt.Sprintf("Foreign key violations detected after migration %s: %d violations", migration.Version, len(fkErrors)))
			}
		}

		if logger.Logger != nil {
			logger.Logger.Info("Migration", fmt.Sprintf("Successfully applied migration %s (%d ms)", migration.Version, time.Since(start).Milliseconds()))
		}
	}

	return nil
}

// GetAppliedMigrations returns all recorded schema migrations in chronological order
func GetAppliedMigrations(db *gorm.DB) ([]SchemaMigration, error) {
	var list []SchemaMigration
	if err := db.Order("applied_at ASC, version ASC").Find(&list).Error; err != nil {
		return nil, err
	}
	return list, nil
}

// GetLatestSchemaVersion returns the version of the most recently applied migration
func GetLatestSchemaVersion(db *gorm.DB) (string, error) {
	var latest SchemaMigration
	err := db.Order("applied_at DESC, version DESC").First(&latest).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return "none", nil
		}
		return "", err
	}
	return latest.Version, nil
}

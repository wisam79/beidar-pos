package repository

import (
	"testing"

	"beidar-desktop/internal/core/domain"
	"beidar-desktop/internal/testutil"

	"gorm.io/gorm"
)

func TestRunMigrations_FreshDatabase(t *testing.T) {
	db, cleanup := testutil.SetupDB(t)
	defer cleanup()

	// 1. Run migrations on fresh DB
	if err := RunMigrations(db); err != nil {
		t.Fatalf("RunMigrations failed on fresh DB: %v", err)
	}

	// 2. Verify schema_migrations table exists and contains expected records
	var count int64
	if err := db.Model(&SchemaMigration{}).Count(&count).Error; err != nil {
		t.Fatalf("Failed to query schema_migrations: %v", err)
	}

	if count != int64(len(registeredMigrations)) {
		t.Errorf("Expected %d applied migrations, got %d", len(registeredMigrations), count)
	}

	// 3. Verify domain tables exist and preferences seeded
	var prefCount int64
	if err := db.Model(&domain.AppPreferences{}).Count(&prefCount).Error; err != nil {
		t.Fatalf("Failed to query app_preferences: %v", err)
	}
	if prefCount == 0 {
		t.Error("Expected default app_preferences to be seeded")
	}

	// 4. Verify latest version
	latest, err := GetLatestSchemaVersion(db)
	if err != nil {
		t.Fatalf("GetLatestSchemaVersion failed: %v", err)
	}
	if latest == "" || latest == "none" {
		t.Errorf("Expected valid latest migration version, got %q", latest)
	}
}

func TestRunMigrations_Idempotent(t *testing.T) {
	db, cleanup := testutil.SetupDB(t)
	defer cleanup()

	// First run
	if err := RunMigrations(db); err != nil {
		t.Fatalf("First RunMigrations failed: %v", err)
	}

	// Second run should be a no-op and succeed without errors
	if err := RunMigrations(db); err != nil {
		t.Fatalf("Second RunMigrations failed (idempotency violation): %v", err)
	}

	var count int64
	if err := db.Model(&SchemaMigration{}).Count(&count).Error; err != nil {
		t.Fatalf("Failed to query schema_migrations: %v", err)
	}

	if count != int64(len(registeredMigrations)) {
		t.Errorf("Expected %d applied migrations after second run, got %d", len(registeredMigrations), count)
	}
}

func TestGetAppliedMigrations(t *testing.T) {
	db, cleanup := testutil.SetupDB(t)
	defer cleanup()

	if err := RunMigrations(db); err != nil {
		t.Fatalf("RunMigrations failed: %v", err)
	}

	migrations, err := GetAppliedMigrations(db)
	if err != nil {
		t.Fatalf("GetAppliedMigrations failed: %v", err)
	}

	if len(migrations) != len(registeredMigrations) {
		t.Fatalf("Expected %d migrations, got %d", len(registeredMigrations), len(migrations))
	}

	if migrations[0].Version != registeredMigrations[0].Version {
		t.Errorf("First migration version = %s, want %s", migrations[0].Version, registeredMigrations[0].Version)
	}
}

func TestRunMigrations_NilDB(t *testing.T) {
	var nilDB *gorm.DB
	if err := RunMigrations(nilDB); err == nil {
		t.Fatal("Expected error when running migrations on nil DB, got nil")
	}
}

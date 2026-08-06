//go:build windows

package repository

import (
	"os"
	"path/filepath"
	"testing"

	"beidar-desktop/internal/core/domain"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

// TestRestoreBackup_RestoresIntoConfigDir verifies RestoreBackup renames a
// backup file into the per-user app config directory and re-initialises the
// database there. It overrides %APPDATA% to a temp dir so the real user DB
// is never touched.
func TestRestoreBackup_RestoresIntoConfigDir(t *testing.T) {
	oldAppData, hadAppData := os.LookupEnv("APPDATA")
	tmp, err := os.MkdirTemp("", "beidar_restore_*")
	if err != nil {
		t.Fatalf("MkdirTemp failed: %v", err)
	}
	os.Setenv("APPDATA", tmp)
	defer func() {
		if hadAppData {
			os.Setenv("APPDATA", oldAppData)
		} else {
			os.Unsetenv("APPDATA")
		}
		os.RemoveAll(tmp)
	}()

	// Prepare a valid backup DB at the exact path RestoreBackup expects.
	backupPath := filepath.Join(tmp, "BeidarPOS_V3", "beidar_v3.db.backup")
	if err := os.MkdirAll(filepath.Dir(backupPath), 0755); err != nil {
		t.Fatalf("MkdirAll backup dir failed: %v", err)
	}
	backupDB, err := gorm.Open(sqlite.Open(backupPath), &gorm.Config{})
	if err != nil {
		t.Fatalf("open backup db failed: %v", err)
	}
	if err := backupDB.AutoMigrate(&domain.Product{}); err != nil {
		t.Fatalf("migrate backup db failed: %v", err)
	}
	backupSQL, _ := backupDB.DB()
	backupSQL.Close()

	// Path RestoreBackup will try to materialise.
	dbPath := filepath.Join(tmp, "BeidarPOS_V3", "beidar_v3.db")
	if _, err := os.Stat(backupPath); err != nil {
		t.Fatalf("backup file missing before restore: %v", err)
	}

	if err := RestoreBackup(backupPath); err != nil {
		t.Fatalf("RestoreBackup returned error: %v", err)
	}

	db := GetDB()
	if db == nil {
		t.Fatal("activeDB not set after restore")
	}
	if _, err := os.Stat(dbPath); err != nil {
		t.Errorf("restored db not present at %s: %v", dbPath, err)
	}
	if _, err := os.Stat(backupPath); err == nil && !os.IsNotExist(err) {
		t.Error("backup source file should have been moved away")
	}

	// Confirm it is a working, migrated connection.
	var count int64
	if err := db.Model(&domain.Product{}).Count(&count).Error; err != nil {
		t.Errorf("query restored db failed: %v", err)
	}

	// Clean up the package-level handle so later tests are unaffected.
	if err := CloseDB(); err != nil {
		t.Errorf("CloseDB failed: %v", err)
	}
}

// TestBackupPath_RenamesDbIntoSiblingBackup verifies BackupPath moves the live
// DB file to a `.backup` sibling. Uses the same %APPDATA% override so the real
// user DB is untouched.
func TestBackupPath_RenamesDbIntoSiblingBackup(t *testing.T) {
	oldAppData, hadAppData := os.LookupEnv("APPDATA")
	tmp, err := os.MkdirTemp("", "beidar_backup_*")
	if err != nil {
		t.Fatalf("MkdirTemp failed: %v", err)
	}
	os.Setenv("APPDATA", tmp)
	defer func() {
		if hadAppData {
			os.Setenv("APPDATA", oldAppData)
		} else {
			os.Unsetenv("APPDATA")
		}
		os.RemoveAll(tmp)
	}()

	appDir := filepath.Join(tmp, "BeidarPOS_V3")
	if err := os.MkdirAll(appDir, 0755); err != nil {
		t.Fatalf("MkdirAll app dir failed: %v", err)
	}
	dbPath := filepath.Join(appDir, "beidar_v3.db")
	if err := os.WriteFile(dbPath, []byte("sqlite file"), 0644); err != nil {
		t.Fatalf("WriteFile db failed: %v", err)
	}

	backupPath, err := BackupPath()
	if err != nil {
		t.Fatalf("BackupPath failed: %v", err)
	}
	if backupPath != dbPath+".backup" {
		t.Errorf("backupPath = %q, want %q", backupPath, dbPath+".backup")
	}
	if _, err := os.Stat(backupPath); err != nil {
		t.Errorf("backup file not created: %v", err)
	}
	if _, err := os.Stat(dbPath); !os.IsNotExist(err) {
		t.Errorf("original db should have been renamed away, err=%v", err)
	}
}
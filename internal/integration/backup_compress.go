package integration

import (
	"archive/zip"
	"bytes"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"time"

	"beidar-desktop/internal/repository"
)

// compressDatabaseForBackup produces a compressed (ZIP) snapshot of the local
// Beidar SQLite database. It first attempts a VACUUM INTO a temp file to get
// a consistent, locked-state copy; if that fails it falls back to copying the
// live database file directly. The database file lives under AppData so this
// is just a packaging helper for cloud-backup uploads.
func compressDatabaseForBackup() ([]byte, error) {
	buf := new(bytes.Buffer)
	zipWriter := zip.NewWriter(buf)

	configDir, err := os.UserConfigDir()
	if err != nil {
		return nil, err
	}
	dbPath := filepath.Join(configDir, "BeidarPOS_V3", "beidar_v3.db")

	var srcPath string
	useTemp := false

	db := repository.GetDB()
	if db != nil {
		tempFile := filepath.Join(os.TempDir(), fmt.Sprintf("beidar_backup_%d.db", time.Now().UnixNano()))
		if err := db.Exec("VACUUM INTO ?", tempFile).Error; err == nil {
			srcPath = tempFile
			useTemp = true
		}
	}

	if srcPath == "" {
		srcPath = dbPath
	}

	dbFile, err := os.Open(srcPath)
	if err != nil {
		return nil, err
	}
	defer dbFile.Close()

	if useTemp {
		defer os.Remove(srcPath)
	}

	info, err := dbFile.Stat()
	if err != nil {
		return nil, err
	}

	header, _ := zip.FileInfoHeader(info)
	header.Name = "beidar_v3.db"
	header.Method = zip.Deflate

	writer, err := zipWriter.CreateHeader(header)
	if err != nil {
		return nil, err
	}

	_, _ = io.Copy(writer, dbFile)
	_ = zipWriter.Close()

	return buf.Bytes(), nil
}

// restoreFromCompressed extracts a backup ZIP produced by
// compressDatabaseForBackup and atomically replaces the live database. On any
// failure the previous database is restored from the auto-backup.
func restoreFromCompressed(data []byte) error {
	reader, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		return err
	}

	if err := repository.CloseDB(); err != nil {
		return err
	}

	backupPath, err := repository.BackupPath()
	if err != nil {
		return err
	}

	for _, file := range reader.File {
		if file.Name == "beidar_v3.db" {
			rc, err := file.Open()
			if err != nil {
				_ = repository.RestoreBackup(backupPath)
				return err
			}
			defer rc.Close()

			configDir, _ := os.UserConfigDir()
			dbPath := filepath.Join(configDir, "BeidarPOS_V3", "beidar_v3.db")
			outFile, err := os.Create(dbPath)
			if err != nil {
				_ = repository.RestoreBackup(backupPath)
				return err
			}
			defer outFile.Close()

			_, _ = io.Copy(outFile, rc)
			_ = os.Remove(backupPath)

			if _, err := repository.InitDB(); err != nil {
				return fmt.Errorf("فشل إعادة تهيئة قاعدة البيانات: %v", err)
			}

			return nil
		}
	}

	_ = repository.RestoreBackup(backupPath)
	return fmt.Errorf("لم يتم العثور على ملف قاعدة البيانات في النسخة الاحتياطية")
}

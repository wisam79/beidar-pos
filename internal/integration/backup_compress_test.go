package integration

import (
	"archive/zip"
	"bytes"
	"io"
	"testing"

	"beidar-desktop/internal/core/domain"
	"beidar-desktop/internal/repository"
	"beidar-desktop/internal/testutil"
)

// TestCompressDatabaseForBackup_PackagesLiveDatabase asserts the ZIP snapshot
// contains the real SQLite file (not an empty archive) taken through the
// VACUUM INTO path, which is the branch used when a live database is open.
func TestCompressDatabaseForBackup_PackagesLiveDatabase(t *testing.T) {
	db, cleanup := testutil.SetupDB(t, &domain.AppPreferences{})
	defer cleanup()

	// VACUUM INTO needs a database that has been written to at least once.
	if err := db.Create(&domain.AppPreferences{StoreName: "متجر بيدر"}).Error; err != nil {
		t.Fatalf("seed preferences: %v", err)
	}

	previous := repository.GetDB()
	repository.SetTestDB(db)
	t.Cleanup(func() { repository.SetTestDB(previous) })

	data, err := compressDatabaseForBackup()
	if err != nil {
		t.Fatalf("compressDatabaseForBackup: %v", err)
	}
	if len(data) == 0 {
		t.Fatal("compressed backup is empty")
	}

	reader, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		t.Fatalf("result is not a valid ZIP archive: %v", err)
	}
	if len(reader.File) != 1 {
		t.Fatalf("archive holds %d entries, want exactly 1", len(reader.File))
	}
	if name := reader.File[0].Name; name != "beidar_v3.db" {
		t.Errorf("archive entry = %q, want %q", name, "beidar_v3.db")
	}

	rc, err := reader.File[0].Open()
	if err != nil {
		t.Fatalf("open archive entry: %v", err)
	}
	defer rc.Close()

	header := make([]byte, 16)
	if _, err := io.ReadFull(rc, header); err != nil {
		t.Fatalf("read archive entry: %v", err)
	}
	if !bytes.HasPrefix(header, []byte("SQLite format 3\x00")) {
		t.Errorf("archived payload is not a SQLite database (header = %q)", header)
	}
}

// TestCompressDatabaseForBackup_WithoutActiveDatabase exercises the fallback
// path taken when no database handle is registered: the helper then reads the
// on-disk AppData database instead of a VACUUM snapshot. Whether that file
// exists depends on the machine, so the assertion covers both honest outcomes:
// either a valid archive is produced, or the missing file is reported.
func TestCompressDatabaseForBackup_WithoutActiveDatabase(t *testing.T) {
	previous := repository.GetDB()
	repository.SetTestDB(nil)
	t.Cleanup(func() { repository.SetTestDB(previous) })

	data, err := compressDatabaseForBackup()
	if err != nil {
		if data != nil {
			t.Errorf("expected no payload alongside the error, got %d bytes", len(data))
		}
		return
	}

	if len(data) == 0 {
		t.Fatal("fallback path returned an empty archive without an error")
	}
	if _, zipErr := zip.NewReader(bytes.NewReader(data), int64(len(data))); zipErr != nil {
		t.Fatalf("fallback path returned a non-ZIP payload: %v", zipErr)
	}
}

// TestRestoreFromCompressed_RejectsGarbage asserts a corrupted payload is
// refused before any database file is touched.
func TestRestoreFromCompressed_RejectsGarbage(t *testing.T) {
	if err := restoreFromCompressed([]byte("this is not a zip archive")); err == nil {
		t.Fatal("expected restoreFromCompressed to reject a non-ZIP payload")
	}
}

// TestRestoreFromCompressed_RejectsEmpty asserts an empty payload is refused
// too, instead of being treated as a valid backup.
func TestRestoreFromCompressed_RejectsEmpty(t *testing.T) {
	if err := restoreFromCompressed(nil); err == nil {
		t.Fatal("expected restoreFromCompressed to reject an empty payload")
	}
}

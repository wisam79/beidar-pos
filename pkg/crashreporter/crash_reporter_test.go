package crashreporter

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func setupDir(t *testing.T) string {
	t.Helper()
	dir := t.TempDir()
	crashReportsDir = dir
	return dir
}

func TestSaveCrashReportCreatesFile(t *testing.T) {
	dir := setupDir(t)

	path := SaveCrashReport("test error message")
	if path == "" {
		t.Fatal("SaveCrashReport returned empty path")
	}
	if !strings.HasPrefix(path, dir) {
		t.Errorf("report path %q is not inside %q", path, dir)
	}
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("cannot read report: %v", err)
	}
	content := string(data)
	if !strings.Contains(content, "test error message") {
		t.Error("report content does not contain the error message")
	}
	if !strings.Contains(content, "Stack Trace") {
		t.Error("report content does not contain stack trace section")
	}
}

func TestGetCrashReportsListsOnlyLogs(t *testing.T) {
	setupDir(t)

	SaveCrashReport("first")
	time.Sleep(1100 * time.Millisecond) // filenames have 1-second resolution
	SaveCrashReport("second")
	_ = os.WriteFile(filepath.Join(crashReportsDir, "notes.txt"), []byte("x"), 0644)

	reports, err := GetCrashReports()
	if err != nil {
		t.Fatalf("GetCrashReports: %v", err)
	}
	if len(reports) != 2 {
		t.Errorf("expected 2 crash reports, got %d (%v)", len(reports), reports)
	}
	for _, r := range reports {
		if filepath.Ext(r) != ".log" {
			t.Errorf("non-log file listed: %s", r)
		}
	}
}

func TestGetCrashReportContentRoundTrip(t *testing.T) {
	setupDir(t)

	path := SaveCrashReport("roundtrip error")
	name := filepath.Base(path)

	content, err := GetCrashReportContent(name)
	if err != nil {
		t.Fatalf("GetCrashReportContent: %v", err)
	}
	if !strings.Contains(content, "roundtrip error") {
		t.Error("round-tripped content missing error message")
	}
}

func TestGetCrashReportContentRejectsTraversal(t *testing.T) {
	setupDir(t)

	if _, err := GetCrashReportContent("../../windows/system32/drivers/etc/hosts"); err == nil {
		t.Error("expected traversal attempt to be rejected")
	}
	if _, err := GetCrashReportContent(filepath.Clean(os.Getenv("WINDIR")) + `\System32\notepad.exe`); err == nil {
		t.Error("expected absolute path to be rejected")
	}
	if _, err := GetCrashReportContent("does-not-exist.log"); err == nil {
		t.Error("expected missing file to return an error")
	}
}

func TestClearCrashReportsRemovesFiles(t *testing.T) {
	setupDir(t)

	SaveCrashReport("one")
	SaveCrashReport("two")

	if err := ClearCrashReports(); err != nil {
		t.Fatalf("ClearCrashReports: %v", err)
	}
	reports, err := GetCrashReports()
	if err != nil {
		t.Fatalf("GetCrashReports after clear: %v", err)
	}
	if len(reports) != 0 {
		t.Errorf("expected no reports after clear, got %v", reports)
	}
}

func TestGetCrashReportsDir(t *testing.T) {
	setupDir(t)
	if got := GetCrashReportsDir(); got != crashReportsDir {
		t.Errorf("GetCrashReportsDir() = %q, want %q", got, crashReportsDir)
	}
}

func TestLogErrorNilIsNoop(t *testing.T) {
	setupDir(t)
	// Must not panic or write anything.
	LogError("context", nil)
}

func TestLogErrorWritesEntry(t *testing.T) {
	configDir, err := os.UserConfigDir()
	if err != nil {
		t.Skipf("no user config dir: %v", err)
	}
	logFile := filepath.Join(configDir, "BeidarPOS_V3", "logs", "errors.log")
	_ = os.Remove(logFile)

	LogError("test-context", os.ErrNotExist)
	data, err := os.ReadFile(logFile)
	if err != nil {
		t.Fatalf("expected errors.log to be written: %v", err)
	}
	if !strings.Contains(string(data), "test-context") {
		t.Error("log entry missing context")
	}
	_ = os.Remove(logFile)
}

func TestRecoverAndLogRepanics(t *testing.T) {
	setupDir(t)

	func() {
		defer func() {
			if r := recover(); r != nil {
				// Recovered from the re-panic; expected behavior.
				return
			}
			t.Error("RecoverAndLog should re-panic after saving the report")
		}()

		defer RecoverAndLog()
		panic("boom")
	}()

	reports, err := GetCrashReports()
	if err != nil {
		t.Fatalf("GetCrashReports: %v", err)
	}
	if len(reports) != 1 {
		t.Errorf("expected 1 saved crash report, got %v", reports)
	}
}

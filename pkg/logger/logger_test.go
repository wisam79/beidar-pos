package logger

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"testing"
)

func resetLogger() {
	once = sync.Once{}
	Logger = nil
}

func TestLogLevelString(t *testing.T) {
	cases := map[LogLevel]string{
		DEBUG: "DEBUG",
		INFO:  "INFO",
		WARN:  "WARN",
		ERROR: "ERROR",
		FATAL: "FATAL",
	}
	for level, want := range cases {
		if got := level.String(); got != want {
			t.Errorf("LogLevel(%d).String() = %q, want %q", level, got, want)
		}
	}
	if got := LogLevel(99).String(); got != "UNKNOWN" {
		t.Errorf("unknown LogLevel.String() = %q, want UNKNOWN", got)
	}
}

func TestLogLevelSlogMapping(t *testing.T) {
	if DEBUG.slogLevel().String() != "DEBUG" {
		t.Error("DEBUG should map to slog DEBUG")
	}
	if ERROR.slogLevel().String() != "ERROR" {
		t.Error("ERROR should map to slog ERROR")
	}
	if FATAL.slogLevel().String() != "ERROR" {
		t.Error("FATAL should map to slog ERROR")
	}
}

func TestInitLoggerWritesFile(t *testing.T) {
	resetLogger()
	t.Chdir(t.TempDir())

	lg := InitLogger(DEBUG, true)
	if lg == nil || Logger != lg {
		t.Fatal("InitLogger must return and store the singleton logger")
	}
	defer lg.Close()

	path := lg.GetLogFilePath()
	if path == "" {
		t.Fatal("expected a log file path when logging to file")
	}
	if _, err := os.Stat(path); err != nil {
		t.Fatalf("expected log file to exist: %v", err)
	}
	if lg.file == nil {
		t.Error("expected file handle to be open")
	}
}

func TestInitLoggerConsoleOnly(t *testing.T) {
	resetLogger()
	lg := InitLogger(INFO, false)
	defer lg.Close()
	if lg.GetLogFilePath() != "" {
		t.Errorf("expected no log file path, got %q", lg.GetLogFilePath())
	}
}

func TestLoggingLevelsAndFiltering(t *testing.T) {
	resetLogger()
	t.Chdir(t.TempDir())

	lg := InitLogger(WARN, false)
	defer lg.Close()

	// All of these should execute without panicking.
	lg.Debug("module", "debug message")
	lg.Info("module", "info message")
	lg.Warn("module", "warn message")
	lg.Error("module", "error message")

	// Raising the level higher filters lower-priority calls.
	lg.SetLevel(FATAL)
	lg.Error("module", "filtered error")

	// Package-level logging helpers must not panic with a logger configured.
	LogSale("SALE", "S-1", 12.5, "C-1")
	LogPayment("PAY", 1, 5.0, "C-1")
	LogCustomer("ADD", "C-1", "أحمد")
	LogAppError("MOD", os.ErrNotExist, "context")
	LogAppError("MOD", nil, "ignored nil error")
	LogFinancial("CREDIT", "C-1", 10, 20)

	if lg.file != nil {
		lg.Close()
	}
}

func TestLoggerNilReceiverSafe(t *testing.T) {
	var lg *AppLogger
	// Nil receiver log methods must not panic.
	lg.Debug("m", "x")
	lg.Info("m", "x")
	lg.Warn("m", "x")
	lg.Error("m", "x")
}

func TestLogHelpersWithoutLogger(t *testing.T) {
	// Ensure the singleton is nil; helpers must be no-ops.
	resetLogger()
	LogSale("SALE", "S-1", 1, "C")
	LogPayment("PAY", 1, 1, "C")
	LogCustomer("ADD", "C", "name")
	LogAppError("M", os.ErrNotExist, "ctx")
	LogFinancial("CREDIT", "C", 1, 2)
}

func TestWriter(t *testing.T) {
	resetLogger()
	t.Chdir(t.TempDir())
	lg := InitLogger(DEBUG, true)
	defer lg.Close()

	if lg.Writer() == nil {
		t.Error("expected non-nil writer when file logging is enabled")
	}
}

func TestHelperFatalSubprocess(t *testing.T) {
	if os.Getenv("LOGGER_FATAL_HELPER") != "1" {
		return
	}
	resetLogger()
	lg := InitLogger(DEBUG, false)
	lg.Fatal("TEST", "this must exit the process")
}

func TestFatalExitsProcess(t *testing.T) {
	exe, err := os.Executable()
	if err != nil {
		t.Skipf("cannot locate test binary: %v", err)
	}
	cmd := exec.Command(exe, "-test.run=^TestHelperFatalSubprocess$")
	cmd.Env = append(os.Environ(), "LOGGER_FATAL_HELPER=1")
	err = cmd.Run()

	var exitErr *exec.ExitError
	if err == nil {
		t.Fatal("expected Fatal to exit with a non-zero status")
	}
	ok := false
	if e, isExit := err.(*exec.ExitError); isExit {
		exitErr = e
		ok = exitErr.ExitCode() == 1
	}
	if !ok {
		t.Fatalf("expected exit code 1 from Fatal, got: %v", err)
	}
}

func TestLogFilePathIsUnderLogsDir(t *testing.T) {
	resetLogger()
	t.Chdir(t.TempDir())
	lg := InitLogger(DEBUG, true)
	defer lg.Close()

	if !strings.HasPrefix(filepath.Clean(lg.GetLogFilePath()), filepath.Clean(filepath.Join(".", "logs"))) {
		t.Errorf("log path %q is not under ./logs", lg.GetLogFilePath())
	}
}

func TestMaskPhone(t *testing.T) {
	tests := []struct {
		input string
		want  string
	}{
		{"", ""},
		{"12", "***"},
		{"1234", "***"},
		{"0770123", "07****3"},
		{"07701234567", "0770****567"},
		{"+9647701234567", "+9647******567"},
	}

	for _, tt := range tests {
		got := MaskPhone(tt.input)
		if got != tt.want {
			t.Errorf("MaskPhone(%q) = %q, want %q", tt.input, got, tt.want)
		}
	}
}

func TestMaskSensitiveText(t *testing.T) {
	input := "Customer with phone 07701234567 requested statement"
	got := MaskSensitiveText(input)
	if strings.Contains(got, "07701234567") {
		t.Errorf("MaskSensitiveText failed to mask phone number: %s", got)
	}
	if !strings.Contains(got, "0770****567") {
		t.Errorf("MaskSensitiveText expected masked phone, got: %s", got)
	}
}

func TestSanitizeAttr(t *testing.T) {
	resetLogger()
	t.Chdir(t.TempDir())
	lg := InitLogger(DEBUG, true)
	defer lg.Close()

	// Direct slog logging with sensitive attributes
	lg.slogger.Info("User logged in",
		"adminPin", "1234",
		"sessionToken", "secret-token-xyz",
		"customerPhone", "07701234567",
		"apiKey", "ai-key-secret-12345",
	)

	// Read log file and verify redacted fields
	lg.Close()
	content, err := os.ReadFile(lg.GetLogFilePath())
	if err != nil {
		t.Fatalf("Failed to read log file: %v", err)
	}
	logStr := string(content)

	if strings.Contains(logStr, "1234") {
		t.Errorf("Log contains unmasked PIN: %s", logStr)
	}
	if strings.Contains(logStr, "secret-token-xyz") {
		t.Errorf("Log contains unmasked token: %s", logStr)
	}
	if strings.Contains(logStr, "ai-key-secret-12345") {
		t.Errorf("Log contains unmasked apiKey: %s", logStr)
	}
	if strings.Contains(logStr, "07701234567") {
		t.Errorf("Log contains unmasked phone number: %s", logStr)
	}
	if !strings.Contains(logStr, "[REDACTED]") {
		t.Errorf("Log expected [REDACTED] placeholder: %s", logStr)
	}
}

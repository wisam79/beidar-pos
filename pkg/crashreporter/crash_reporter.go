package crashreporter

import (
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"runtime/debug"
	"strings"
	"time"
)

// CrashReport represents a structured crash report
type CrashReport struct {
	Timestamp  time.Time `json:"timestamp"`
	Error      string    `json:"error"`
	StackTrace string    `json:"stackTrace"`
	AppVersion string    `json:"appVersion"`
	GoVersion  string    `json:"goVersion"`
	OS         string    `json:"os"`
	Arch       string    `json:"arch"`
}

var (
	AppVersion       = "dev"
	crashReportsDir string
)

// InitCrashReporter initializes the crash reporter directories
func InitCrashReporter() error {
	configDir, err := os.UserConfigDir()
	if err != nil {
		return fmt.Errorf("failed to get config directory: %w", err)
	}

	crashReportsDir = filepath.Join(configDir, "BeidarPOS_V3", "crash-reports")
	if err := os.MkdirAll(crashReportsDir, 0755); err != nil {
		return fmt.Errorf("failed to create crash reports directory: %w", err)
	}

	return nil
}

// RecoverAndLog recovers from panic and logs the crash
func RecoverAndLog() {
	if r := recover(); r != nil {
		_ = SaveCrashReport(fmt.Sprint(r))
		panic(r) // Re-panic to let the app crash after logging
	}
}

// SaveCrashReport saves a crash report to disk
func SaveCrashReport(errorMsg string) string {
	if crashReportsDir == "" {
		_ = InitCrashReporter()
	}

	stack := string(debug.Stack())

	report := CrashReport{
		Timestamp:  time.Now(),
		Error:      errorMsg,
		StackTrace: stack,
		AppVersion: AppVersion,
		GoVersion:  runtime.Version(),
		OS:         runtime.GOOS,
		Arch:       runtime.GOARCH,
	}

	filename := fmt.Sprintf("crash_%s.log", time.Now().Format("2006-01-02_15-04-05"))
	filePath := filepath.Join(crashReportsDir, filename)

	content := fmt.Sprintf(`═══════════════════════════════════════════════════════════════
BEIDAR POS - تقرير العطل
═══════════════════════════════════════════════════════════════

الوقت: %s
الإصدار: %s
نظام التشغيل: %s/%s
إصدار Go: %s

═══════════════════════════════════════════════════════════════
الخطأ:
═══════════════════════════════════════════════════════════════
%s

═══════════════════════════════════════════════════════════════
Stack Trace:
═══════════════════════════════════════════════════════════════
%s
`,
		report.Timestamp.Format("2006-01-02 15:04:05"),
		report.AppVersion,
		report.OS,
		report.Arch,
		report.GoVersion,
		report.Error,
		report.StackTrace,
	)

	_ = os.WriteFile(filePath, []byte(content), 0644)

	return filePath
}

// GetCrashReports returns a list of recent crash reports
func GetCrashReports() ([]string, error) {
	if crashReportsDir == "" {
		if err := InitCrashReporter(); err != nil {
			return nil, err
		}
	}

	files, err := os.ReadDir(crashReportsDir)
	if err != nil {
		return nil, fmt.Errorf("failed to read crash reports directory: %w", err)
	}

	var reports []string
	for _, file := range files {
		if !file.IsDir() && filepath.Ext(file.Name()) == ".log" {
			reports = append(reports, file.Name())
		}
	}

	return reports, nil
}

// GetCrashReportContent returns the content of a crash report
func GetCrashReportContent(filename string) (string, error) {
	if crashReportsDir == "" {
		_ = InitCrashReporter()
	}

	cleaned := filepath.Clean(filename)
	if strings.Contains(cleaned, "..") || filepath.IsAbs(cleaned) {
		return "", fmt.Errorf("invalid filename")
	}

	filePath := filepath.Join(crashReportsDir, cleaned)
	if !strings.HasPrefix(filepath.Clean(filePath), filepath.Clean(crashReportsDir)) {
		return "", fmt.Errorf("invalid file path")
	}

	content, err := os.ReadFile(filePath)
	if err != nil {
		return "", fmt.Errorf("failed to read crash report: %w", err)
	}
	return string(content), nil
}

// ClearCrashReports deletes all crash reports
func ClearCrashReports() error {
	if crashReportsDir == "" {
		_ = InitCrashReporter()
	}

	files, err := os.ReadDir(crashReportsDir)
	if err != nil {
		return err
	}

	for _, file := range files {
		if !file.IsDir() {
			_ = os.Remove(filepath.Join(crashReportsDir, file.Name()))
		}
	}

	return nil
}

// GetCrashReportsDir returns the crash reports directory path
func GetCrashReportsDir() string {
	if crashReportsDir == "" {
		_ = InitCrashReporter()
	}
	return crashReportsDir
}

// LogError logs an error without crashing
func LogError(context string, err error) {
	if err == nil {
		return
	}

	configDir, _ := os.UserConfigDir()
	logDir := filepath.Join(configDir, "BeidarPOS_V3", "logs")
	_ = os.MkdirAll(logDir, 0755)

	logFile := filepath.Join(logDir, "errors.log")

	f, openErr := os.OpenFile(logFile, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if openErr != nil {
		return
	}
	defer f.Close()

	logEntry := fmt.Sprintf("[%s] %s: %v\n", time.Now().Format("2006-01-02 15:04:05"), context, err)
	_, _ = f.WriteString(logEntry)
}

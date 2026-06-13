package logger

import (
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"runtime"
	"sync"
	"time"
)

type LogLevel int

const (
	DEBUG LogLevel = iota
	INFO
	WARN
	ERROR
	FATAL
)

func (l LogLevel) String() string {
	switch l {
	case DEBUG:
		return "DEBUG"
	case INFO:
		return "INFO"
	case WARN:
		return "WARN"
	case ERROR:
		return "ERROR"
	case FATAL:
		return "FATAL"
	default:
		return "UNKNOWN"
	}
}

type AppLogger struct {
	mu          sync.Mutex
	level       LogLevel
	file        *os.File
	console     *log.Logger
	fileLogger  *log.Logger
	logToFile   bool
	logFilePath string
}

var (
	Logger *AppLogger
	once   sync.Once
)

func InitLogger(logLevel LogLevel, logToFile bool) *AppLogger {
	once.Do(func() {
		Logger = &AppLogger{
			level:     logLevel,
			logToFile: logToFile,
			console:   log.New(os.Stdout, "", 0),
		}

		if logToFile {
			Logger.setupFileLogging()
		}
	})
	return Logger
}

func (l *AppLogger) setupFileLogging() {
	logsDir := filepath.Join(".", "logs")
	if err := os.MkdirAll(logsDir, 0755); err != nil {
		l.console.Printf("⚠️ Failed to create logs directory: %v", err)
		return
	}

	today := time.Now().Format("2006-01-02")
	l.logFilePath = filepath.Join(logsDir, fmt.Sprintf("beidar_%s.log", today))

	file, err := os.OpenFile(l.logFilePath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
	if err != nil {
		l.console.Printf("⚠️ Failed to open log file: %v", err)
		return
	}

	l.file = file
	l.fileLogger = log.New(file, "", 0)
	l.Info("Logger", "=== Application Started ===")
}

func (l *AppLogger) formatMessage(level LogLevel, module, message string) string {
	timestamp := time.Now().Format("2006-01-02 15:04:05.000")
	_, file, line, ok := runtime.Caller(2)
	caller := ""
	if ok {
		caller = fmt.Sprintf("%s:%d", filepath.Base(file), line)
	}

	return fmt.Sprintf("[%s] [%s] [%s] %s | %s",
		timestamp,
		level.String(),
		module,
		message,
		caller,
	)
}

func (l *AppLogger) log(level LogLevel, module, message string) {
	if l == nil {
		return
	}
	if level < l.level {
		return
	}

	l.mu.Lock()
	defer l.mu.Unlock()

	formatted := l.formatMessage(level, module, message)

	switch level {
	case DEBUG:
		l.console.Printf("\033[36m%s\033[0m", formatted)
	case INFO:
		l.console.Printf("\033[32m%s\033[0m", formatted)
	case WARN:
		l.console.Printf("\033[33m%s\033[0m", formatted)
	case ERROR, FATAL:
		l.console.Printf("\033[31m%s\033[0m", formatted)
	default:
		l.console.Print(formatted)
	}

	if l.logToFile && l.fileLogger != nil {
		l.fileLogger.Print(formatted)
	}
}

func (l *AppLogger) Debug(module, message string) {
	l.log(DEBUG, module, message)
}

func (l *AppLogger) Info(module, message string) {
	l.log(INFO, module, message)
}

func (l *AppLogger) Warn(module, message string) {
	l.log(WARN, module, message)
}

func (l *AppLogger) Error(module, message string) {
	l.log(ERROR, module, message)
}

func (l *AppLogger) Fatal(module, message string) {
	l.log(FATAL, module, message)
	os.Exit(1)
}

func (l *AppLogger) Close() {
	if l.file != nil {
		l.Info("Logger", "=== Application Shutdown ===")
		l.file.Close()
	}
}

func (l *AppLogger) SetLevel(level LogLevel) {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.level = level
}

func (l *AppLogger) GetLogFilePath() string {
	return l.logFilePath
}

func LogSale(operation, saleID string, total float64, customerID string) {
	if Logger == nil {
		return
	}
	msg := fmt.Sprintf("%s | SaleID=%s | Total=%.2f | CustomerID=%s", operation, saleID, total, customerID)
	Logger.Info("SALES", msg)
}

func LogPayment(operation string, paymentID uint, amount float64, customerID string) {
	if Logger == nil {
		return
	}
	msg := fmt.Sprintf("%s | PaymentID=%d | Amount=%.2f | CustomerID=%s", operation, paymentID, amount, customerID)
	Logger.Info("PAYMENT", msg)
}

func LogCustomer(operation, customerID, customerName string) {
	if Logger == nil {
		return
	}
	msg := fmt.Sprintf("%s | CustomerID=%s | Name=%s", operation, customerID, customerName)
	Logger.Info("CRM", msg)
}

func LogAppError(module string, err error, context string) {
	if Logger == nil || err == nil {
		return
	}
	msg := fmt.Sprintf("%s | Error: %v", context, err)
	Logger.Error(module, msg)
}

func LogFinancial(operation string, customerID string, oldDebt, newDebt float64) {
	if Logger == nil {
		return
	}
	msg := fmt.Sprintf("%s | CustomerID=%s | OldDebt=%.2f | NewDebt=%.2f | Delta=%.2f",
		operation, customerID, oldDebt, newDebt, newDebt-oldDebt)
	Logger.Info("FINANCIAL", msg)
}

func (l *AppLogger) Writer() io.Writer {
	return l.file
}

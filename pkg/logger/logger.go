package logger

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"os"
	"path/filepath"
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

func (l LogLevel) slogLevel() slog.Level {
	switch l {
	case DEBUG:
		return slog.LevelDebug
	case INFO:
		return slog.LevelInfo
	case WARN:
		return slog.LevelWarn
	case ERROR, FATAL:
		return slog.LevelError
	default:
		return slog.LevelInfo
	}
}

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
	mu          sync.RWMutex
	level       LogLevel
	slogger     *slog.Logger
	file        *os.File
	logFilePath string
}

var (
	Logger *AppLogger
	once   sync.Once
)

func InitLogger(logLevel LogLevel, logToFile bool) *AppLogger {
	once.Do(func() {
		Logger = &AppLogger{
			level: logLevel,
		}

		var writers []io.Writer
		writers = append(writers, os.Stdout)

		if logToFile {
			Logger.setupFileLogging()
			if Logger.file != nil {
				writers = append(writers, Logger.file)
			}
		}

		// Create a multi-writer if both console and file are enabled
		var out io.Writer
		if len(writers) == 1 {
			out = writers[0]
		} else {
			out = io.MultiWriter(writers...)
		}

		// Setup slog handler
		opts := &slog.HandlerOptions{
			Level: logLevel.slogLevel(),
		}

		handler := slog.NewTextHandler(out, opts)
		Logger.slogger = slog.New(handler)
		slog.SetDefault(Logger.slogger)

		if logToFile && Logger.file != nil {
			Logger.Info("Logger", "=== Application Started ===")
		}
	})
	return Logger
}

func (l *AppLogger) setupFileLogging() {
	logsDir := filepath.Join(".", "logs")
	if err := os.MkdirAll(logsDir, 0755); err != nil {
		fmt.Printf("⚠️ Failed to create logs directory: %v\n", err)
		return
	}

	today := time.Now().Format("2006-01-02")
	l.logFilePath = filepath.Join(logsDir, fmt.Sprintf("beidar_%s.log", today))

	file, err := os.OpenFile(l.logFilePath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
	if err != nil {
		fmt.Printf("⚠️ Failed to open log file: %v\n", err)
		return
	}

	l.file = file
}

func (l *AppLogger) log(level LogLevel, module, message string) {
	if l == nil || l.slogger == nil {
		return
	}
	
	l.mu.RLock()
	currentLevel := l.level
	l.mu.RUnlock()

	if level < currentLevel {
		return
	}

	l.slogger.Log(context.Background(), level.slogLevel(), message, slog.String("module", module))
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
	if Logger == nil || Logger.slogger == nil {
		return
	}
	Logger.slogger.Info(fmt.Sprintf("%s | SaleID=%s | Total=%.2f", operation, saleID, total), 
		slog.String("module", "SALES"),
		slog.String("saleID", saleID),
		slog.Float64("total", total),
		slog.String("customerID", customerID),
	)
}

func LogPayment(operation string, paymentID uint, amount float64, customerID string) {
	if Logger == nil || Logger.slogger == nil {
		return
	}
	Logger.slogger.Info(fmt.Sprintf("%s | PaymentID=%d | Amount=%.2f", operation, paymentID, amount), 
		slog.String("module", "PAYMENT"),
		slog.Uint64("paymentID", uint64(paymentID)),
		slog.Float64("amount", amount),
		slog.String("customerID", customerID),
	)
}

func LogCustomer(operation, customerID, customerName string) {
	if Logger == nil || Logger.slogger == nil {
		return
	}
	Logger.slogger.Info(fmt.Sprintf("%s | CustomerID=%s | Name=%s", operation, customerID, customerName),
		slog.String("module", "CRM"),
		slog.String("customerID", customerID),
		slog.String("customerName", customerName),
	)
}

func LogAppError(module string, err error, contextStr string) {
	if Logger == nil || Logger.slogger == nil || err == nil {
		return
	}
	Logger.slogger.Error(contextStr, 
		slog.String("module", module),
		slog.Any("error", err),
	)
}

func LogFinancial(operation string, customerID string, oldDebt, newDebt float64) {
	if Logger == nil || Logger.slogger == nil {
		return
	}
	delta := newDebt - oldDebt
	Logger.slogger.Info(fmt.Sprintf("%s | CustomerID=%s", operation, customerID),
		slog.String("module", "FINANCIAL"),
		slog.String("customerID", customerID),
		slog.Float64("oldDebt", oldDebt),
		slog.Float64("newDebt", newDebt),
		slog.Float64("delta", delta),
	)
}

func (l *AppLogger) Writer() io.Writer {
	return l.file
}

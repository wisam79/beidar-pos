package service_test

import (
	"beidar-desktop/internal/core/domain"
	"beidar-desktop/internal/repository"
	"beidar-desktop/internal/service"
	"beidar-desktop/pkg/logger"
	"os"
	"testing"
	"time"

	"github.com/glebarez/sqlite"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

func setupStatsTestDB(t *testing.T) (service.StatsService, *gorm.DB, func()) {
	logger.InitLogger(logger.INFO, false)
	dbFileName := "test_stats_" + uuid.New().String()[:8] + ".db"
	os.Remove(dbFileName)

	db, err := gorm.Open(sqlite.Open(dbFileName), &gorm.Config{})
	if err != nil {
		t.Fatalf("Failed to open test DB: %v", err)
	}

	db.AutoMigrate(
		&domain.Product{}, &domain.Sale{}, &domain.SaleItem{}, &domain.Expense{}, &domain.Category{},
	)

	statsRepo := repository.NewStatsRepository(db)
	statsService := service.NewStatsService(statsRepo)

	return statsService, db, func() {
		sqlDB, _ := db.DB()
		if sqlDB != nil {
			sqlDB.Close()
		}
		os.Remove(dbFileName)
	}
}

func TestStatsAggregations(t *testing.T) {
	s, db, cleanup := setupStatsTestDB(t)
	defer cleanup()

	// 1. Create a Product
	product := domain.Product{
		ID:    uuid.New().String(),
		Name:  "Gamer Mouse",
		Cost:  15000,
		Price: 25000,
		Stock: 10,
	}
	db.Create(&product)

	// 2. Create an Expense
	expense := domain.Expense{
		ID:       uuid.New().String(),
		Title:    "Broadband Internet",
		Amount:   50000,
		Date:     time.Now().Format("2006-01-02"),
		Category: "Utility",
	}
	db.Create(&expense)

	// 3. Create a Sale
	sale := domain.Sale{
		ID:            uuid.New().String(),
		CustomerName:  "Hassan CRM Customer",
		Date:          time.Now().Format("2006-01-02"),
		Timestamp:     time.Now().UnixMilli(),
		Subtotal:      50000,
		Total:         50000,
		PaymentMethod: "cash",
		Status:        "completed",
		Items: []domain.SaleItem{
			{
				ProductID: product.ID,
				Name:      product.Name,
				Quantity:  2,
				Price:     25000,
				Total:     50000,
				Cost:      15000,
			},
		},
	}
	db.Create(&sale)

	// 4. Run dashboard statistics loading
	stats, err := s.GetDashboardStats("week")
	if err != nil {
		t.Fatalf("GetDashboardStats failed: %v", err)
	}

	if stats.TotalRevenue != 50000 {
		t.Errorf("Expected total revenue 50000, got %.2f", stats.TotalRevenue)
	}

	// Gross Profit: Revenue (50,000) - COGS (2 * 15,000 = 30,000) = 20,000
	if stats.GrossProfit != 20000 {
		t.Errorf("Expected gross profit 20000, got %.2f", stats.GrossProfit)
	}

	// Net Profit: Gross Profit (20,000) - Expenses (50,000) = -30,000
	if stats.NetProfit != -30000 {
		t.Errorf("Expected net profit -30000, got %.2f", stats.NetProfit)
	}

	if len(stats.RecentSales) != 1 {
		t.Errorf("Expected 1 recent sale, got %d", len(stats.RecentSales))
	}

	// 4b. Run dashboard statistics for month and year to cover chart data point calculations
	monthStats, err := s.GetDashboardStats("month")
	if err != nil {
		t.Fatalf("GetDashboardStats('month') failed: %v", err)
	}
	if monthStats.TotalRevenue != 50000 {
		t.Errorf("Expected month total revenue 50000, got %.2f", monthStats.TotalRevenue)
	}

	yearStats, err := s.GetDashboardStats("year")
	if err != nil {
		t.Fatalf("GetDashboardStats('year') failed: %v", err)
	}
	if yearStats.TotalRevenue != 50000 {
		t.Errorf("Expected year total revenue 50000, got %.2f", yearStats.TotalRevenue)
	}

	// 5. Monthly comparison
	comparison, err := s.GetMonthlyComparison()
	if err != nil {
		t.Fatalf("GetMonthlyComparison failed: %v", err)
	}

	if comparison.CurrentMonth.Revenue != 50000 {
		t.Errorf("Expected current month revenue 50000, got %.2f", comparison.CurrentMonth.Revenue)
	}
	if comparison.CurrentMonth.NetProfit != -30000 {
		t.Errorf("Expected current month net profit -30000, got %.2f", comparison.CurrentMonth.NetProfit)
	}
}

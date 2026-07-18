package service

import (
	"beidar-desktop/internal/core/domain"
	"fmt"
	"math"
	"time"
)

var arabicDays = map[string]string{
	"Sunday": "الأحد", "Monday": "الاثنين", "Tuesday": "الثلاثاء",
	"Wednesday": "الأربعاء", "Thursday": "الخميس", "Friday": "الجمعة", "Saturday": "السبت",
}

var arabicMonthAbbr = map[string]string{
	"January": "يناير", "February": "فبراير", "March": "مارس",
	"April": "أبريل", "May": "مايو", "June": "يونيو",
	"July": "يوليو", "August": "أغسطس", "September": "سبتمبر",
	"October": "أكتوبر", "November": "نوفمبر", "December": "ديسمبر",
}

type statsService struct {
	statsRepo domain.StatsRepository
}

// NewStatsService creates a new instance of domain.StatsService
func NewStatsService(statsRepo domain.StatsRepository) domain.StatsService {
	return &statsService{statsRepo: statsRepo}
}

func (s *statsService) GetDashboardStats(timeRange string) (stats *domain.DashboardStats, err error) {
	defer func() {
		if r := recover(); r != nil {
			err = fmt.Errorf("panic in GetDashboardStats: %v", r)
		}
	}()

	stats = &domain.DashboardStats{}
	today := time.Now().Format("2006-01-02")

	// 1. Basic Stats
	totalRevenue, totalOrders, dailyRevenue, dailyOrders, totalProducts, lowStockCount, err := s.statsRepo.GetBasicStats(today)
	if err != nil {
		return nil, err
	}
	stats.TotalRevenue = totalRevenue
	stats.TotalOrders = totalOrders
	stats.DailyRevenue = dailyRevenue
	stats.DailyOrders = dailyOrders
	stats.TotalProducts = totalProducts
	stats.LowStockCount = lowStockCount

	// 2. Recent Sales
	recentSales, err := s.statsRepo.GetRecentSales(5)
	if err != nil {
		return nil, err
	}
	stats.RecentSales = recentSales

	// 3. Top Selling
	topSelling, err := s.statsRepo.GetTopSellingProducts(5)
	if err != nil {
		return nil, err
	}
	stats.TopSelling = topSelling

	// 4. Profit & Expenses
	cogs, totalExpenses, expenseBreakdown, err := s.statsRepo.GetProfitAndExpenses()
	if err != nil {
		return nil, err
	}
	stats.TotalExpenses = totalExpenses
	stats.ExpenseBreakdown = expenseBreakdown

	// Compute profits
	stats.GrossProfit = stats.TotalRevenue.Sub(cogs)
	stats.NetProfit = stats.GrossProfit.Sub(stats.TotalExpenses)

	// 5. Top Customers
	topCustomers, err := s.statsRepo.GetTopCustomers(5)
	if err != nil {
		return nil, err
	}
	stats.TopCustomers = topCustomers

	// 6. Chart Data
	stats.ChartData = s.getChartDataPoints(timeRange)

	if stats.TopSelling == nil {
		stats.TopSelling = []domain.TopProduct{}
	}
	if stats.TopCustomers == nil {
		stats.TopCustomers = []domain.TopCustomer{}
	}
	if stats.RecentSales == nil {
		stats.RecentSales = []domain.Sale{}
	}
	if stats.ExpenseBreakdown == nil {
		stats.ExpenseBreakdown = []domain.ChartDataPoint{}
	}

	return stats, nil
}

func (s *statsService) getChartDataPoints(timeRange string) []domain.ChartDataPoint {
	var days int
	var dateFormat string

	switch timeRange {
	case "year":
		days = 365
		dateFormat = "%Y-%m"
	case "month":
		days = 30
		dateFormat = "%Y-%m-%d"
	default: // week
		days = 7
		dateFormat = "%Y-%m-%d"
	}

	startDate := time.Now().AddDate(0, 0, -days+1).Format("2006-01-02")
	results, err := s.statsRepo.GetChartData(startDate, dateFormat)
	if err != nil {
		return []domain.ChartDataPoint{}
	}

	valueMap := make(map[string]domain.Amount)
	for _, r := range results {
		valueMap[r.DateKey] = r.Total
	}

	var chartData []domain.ChartDataPoint

	switch timeRange {
	case "year":
		chartData = make([]domain.ChartDataPoint, 12)
		for i := 0; i < 12; i++ {
			d := time.Now().AddDate(0, -11+i, 0)
			key := d.Format("2006-01")
			label := arabicMonthAbbr[d.Month().String()]
			chartData[i] = domain.ChartDataPoint{
				Label: label,
				Value: valueMap[key],
			}
		}
	case "month":
		chartData = make([]domain.ChartDataPoint, 30)
		for i := 0; i < 30; i++ {
			d := time.Now().AddDate(0, 0, -29+i)
			key := d.Format("2006-01-02")
			label := d.Format("02")
			chartData[i] = domain.ChartDataPoint{
				Label: label,
				Value: valueMap[key],
			}
		}
	default: // week
		chartData = make([]domain.ChartDataPoint, 7)
		for i := 0; i < 7; i++ {
			d := time.Now().AddDate(0, 0, -6+i)
			key := d.Format("2006-01-02")
			label := arabicDays[d.Weekday().String()]
			chartData[i] = domain.ChartDataPoint{
				Label: label,
				Value: valueMap[key],
			}
		}
	}

	return chartData
}

func (s *statsService) GetMonthlyComparison() (*domain.MonthlyComparison, error) {
	now := time.Now()

	currentMonthStart := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.Local)
	currentMonthEnd := currentMonthStart.AddDate(0, 1, 0).Add(-time.Second)

	prevMonthStart := currentMonthStart.AddDate(0, -1, 0)
	prevMonthEnd := currentMonthStart.Add(-time.Second)

	arabicMonths := []string{"يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"}

	comparison := &domain.MonthlyComparison{}

	// 1. Current Month Stats
	revCurr, ordCurr, expCurr, cogsCurr, err := s.statsRepo.GetMonthStats(
		currentMonthStart.Format("2006-01-02"),
		currentMonthEnd.Format("2006-01-02"),
	)
	if err != nil {
		return nil, err
	}
	comparison.CurrentMonth = s.buildMonthData(
		revCurr, ordCurr, expCurr, cogsCurr,
		arabicMonths[now.Month()-1]+" "+fmt.Sprintf("%d", now.Year()),
	)

	// 2. Previous Month Stats
	revPrev, ordPrev, expPrev, cogsPrev, err := s.statsRepo.GetMonthStats(
		prevMonthStart.Format("2006-01-02"),
		prevMonthEnd.Format("2006-01-02"),
	)
	if err != nil {
		return nil, err
	}
	comparison.PreviousMonth = s.buildMonthData(
		revPrev, ordPrev, expPrev, cogsPrev,
		arabicMonths[prevMonthStart.Month()-1]+" "+fmt.Sprintf("%d", prevMonthStart.Year()),
	)

	// Calculate percentage changes
	if comparison.PreviousMonth.Revenue > 0 {
		comparison.RevenueChange = ((comparison.CurrentMonth.Revenue.Float() - comparison.PreviousMonth.Revenue.Float()) / comparison.PreviousMonth.Revenue.Float()) * 100
	}
	if comparison.PreviousMonth.Orders > 0 {
		comparison.OrdersChange = ((float64(comparison.CurrentMonth.Orders) - float64(comparison.PreviousMonth.Orders)) / float64(comparison.PreviousMonth.Orders)) * 100
	}
	if comparison.PreviousMonth.NetProfit != 0 {
		comparison.ProfitChange = ((comparison.CurrentMonth.NetProfit.Float() - comparison.PreviousMonth.NetProfit.Float()) / math.Abs(comparison.PreviousMonth.NetProfit.Float())) * 100
	}

	return comparison, nil
}

func (s *statsService) buildMonthData(revenue domain.Amount, orders int64, expenses domain.Amount, cogs domain.Amount, label string) domain.MonthData {
	avgOrder := domain.Zero()
	if orders > 0 {
		avgOrder = revenue.Div(orders)
	}

	return domain.MonthData{
		Label:     label,
		Revenue:   revenue,
		Orders:    orders,
		Expenses:  expenses,
		AvgOrder:  avgOrder,
		NetProfit: revenue.Sub(cogs).Sub(expenses),
	}
}

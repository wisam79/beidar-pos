package service

import (
	"beidar-desktop/internal/core/domain"
	"fmt"
	"math"
	"sync"
	"time"
)

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

	var wg sync.WaitGroup
	var errs []error
	var mu sync.Mutex

	appendErr := func(e error) {
		if e != nil {
			mu.Lock()
			errs = append(errs, e)
			mu.Unlock()
		}
	}

	wg.Add(6)

	// 1. Basic Stats
	go func() {
		defer wg.Done()
		totalRevenue, totalOrders, dailyRevenue, dailyOrders, totalProducts, lowStockCount, e := s.statsRepo.GetBasicStats(today)
		if e != nil {
			appendErr(e)
			return
		}
		mu.Lock()
		stats.TotalRevenue = totalRevenue
		stats.TotalOrders = totalOrders
		stats.DailyRevenue = dailyRevenue
		stats.DailyOrders = dailyOrders
		stats.TotalProducts = totalProducts
		stats.LowStockCount = lowStockCount
		mu.Unlock()
	}()

	// 2. Recent Sales
	go func() {
		defer wg.Done()
		recentSales, e := s.statsRepo.GetRecentSales(5)
		if e != nil {
			appendErr(e)
			return
		}
		mu.Lock()
		stats.RecentSales = recentSales
		mu.Unlock()
	}()

	// 3. Top Selling
	go func() {
		defer wg.Done()
		topSelling, e := s.statsRepo.GetTopSellingProducts(5)
		if e != nil {
			appendErr(e)
			return
		}
		mu.Lock()
		stats.TopSelling = topSelling
		mu.Unlock()
	}()

	// 4. Profit & Expenses
	go func() {
		defer wg.Done()
		totalCOGS, totalExpenses, expenseBreakdown, e := s.statsRepo.GetProfitAndExpenses()
		if e != nil {
			appendErr(e)
			return
		}
		mu.Lock()
		stats.TotalExpenses = totalExpenses
		stats.GrossProfit = stats.TotalRevenue - totalCOGS
		stats.NetProfit = stats.GrossProfit - totalExpenses
		stats.ExpenseBreakdown = expenseBreakdown
		mu.Unlock()
	}()

	// 5. Top Customers
	go func() {
		defer wg.Done()
		topCustomers, e := s.statsRepo.GetTopCustomers(5)
		if e != nil {
			appendErr(e)
			return
		}
		mu.Lock()
		stats.TopCustomers = topCustomers
		mu.Unlock()
	}()

	// 6. Chart Data
	go func() {
		defer wg.Done()
		mu.Lock()
		stats.ChartData = s.getChartDataPoints(timeRange)
		mu.Unlock()
	}()

	wg.Wait()

	// Recalculate gross and net profit based on loaded basic stats if necessary
	var totalCOGS float64
	totalCOGS, _, _, err = s.statsRepo.GetProfitAndExpenses()
	if err == nil {
		stats.GrossProfit = stats.TotalRevenue - totalCOGS
		stats.NetProfit = stats.GrossProfit - stats.TotalExpenses
	}

	if len(errs) > 0 {
		return nil, errs[0]
	}

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

	// Arabic day names for weekly chart
	arabicDays := map[string]string{
		"Sunday": "أحد", "Monday": "إثن", "Tuesday": "ثلا",
		"Wednesday": "أرب", "Thursday": "خمي", "Friday": "جمع", "Saturday": "سبت",
	}

	// Arabic month abbreviations for yearly chart
	arabicMonthAbbr := map[string]string{
		"January": "يناير", "February": "فبراير", "March": "مارس",
		"April": "أبريل", "May": "مايو", "June": "يونيو",
		"July": "يوليو", "August": "أغسطس", "September": "سبتمبر",
		"October": "أكتوبر", "November": "نوفمبر", "December": "ديسمبر",
	}

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

	valueMap := make(map[string]float64)
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

	// Current month data
	currRev, currOrd, currExp, currCogs, err := s.statsRepo.GetMonthStats(
		currentMonthStart.Format("2006-01-02"),
		currentMonthEnd.Format("2006-01-02"),
	)
	if err != nil {
		return nil, err
	}
	comparison.CurrentMonth = s.buildMonthData(
		currRev, currOrd, currExp, currCogs,
		arabicMonths[now.Month()-1]+" "+fmt.Sprintf("%d", now.Year()),
	)

	// Previous month data
	prevRev, prevOrd, prevExp, prevCogs, err := s.statsRepo.GetMonthStats(
		prevMonthStart.Format("2006-01-02"),
		prevMonthEnd.Format("2006-01-02"),
	)
	if err != nil {
		return nil, err
	}
	comparison.PreviousMonth = s.buildMonthData(
		prevRev, prevOrd, prevExp, prevCogs,
		arabicMonths[prevMonthStart.Month()-1]+" "+fmt.Sprintf("%d", prevMonthStart.Year()),
	)

	// Calculate percentage changes
	if comparison.PreviousMonth.Revenue > 0 {
		comparison.RevenueChange = ((comparison.CurrentMonth.Revenue - comparison.PreviousMonth.Revenue) / comparison.PreviousMonth.Revenue) * 100
	}
	if comparison.PreviousMonth.Orders > 0 {
		comparison.OrdersChange = ((float64(comparison.CurrentMonth.Orders) - float64(comparison.PreviousMonth.Orders)) / float64(comparison.PreviousMonth.Orders)) * 100
	}
	if comparison.PreviousMonth.NetProfit != 0 {
		comparison.ProfitChange = ((comparison.CurrentMonth.NetProfit - comparison.PreviousMonth.NetProfit) / math.Abs(comparison.PreviousMonth.NetProfit)) * 100
	}

	return comparison, nil
}

func (s *statsService) buildMonthData(revenue float64, orders int64, expenses float64, cogs float64, label string) domain.MonthData {
	avgOrder := 0.0
	if orders > 0 {
		avgOrder = revenue / float64(orders)
	}

	return domain.MonthData{
		Label:     label,
		Revenue:   revenue,
		Orders:    orders,
		Expenses:  expenses,
		AvgOrder:  avgOrder,
		NetProfit: revenue - cogs - expenses,
	}
}

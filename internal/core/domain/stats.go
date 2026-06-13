package domain

// ChartDataResult holds chart data from database queries
type ChartDataResult struct {
	DateKey string  `json:"date_key"`
	Total   float64 `json:"total"`
}

type ChartDataPoint struct {
	Label          string  `json:"label"`
	Value          float64 `json:"value"`
	FormattedValue string  `json:"formattedValue"`
}

type TopProduct struct {
	Label string `json:"label"`
	Value int    `json:"value"`
}

type TopCustomer struct {
	Name  string  `json:"name"`
	Total float64 `json:"total"`
}

type DashboardStats struct {
	TotalRevenue     float64          `json:"totalRevenue"`
	TotalOrders      int64            `json:"totalOrders"`
	DailyRevenue     float64          `json:"dailyRevenue"`
	DailyOrders      int64            `json:"dailyOrders"`
	ChartData        []ChartDataPoint `json:"chartData"`
	TopSelling       []TopProduct     `json:"topSelling"`
	RecentSales      []Sale           `json:"recentSales"`
	LowStockCount    int64            `json:"lowStockCount"`
	TotalProducts    int64            `json:"totalProducts"`
	NetProfit        float64          `json:"netProfit"`
	GrossProfit      float64          `json:"grossProfit"`
	TotalExpenses    float64          `json:"totalExpenses"`
	ExpenseBreakdown []ChartDataPoint `json:"expenseBreakdown"`
	TopCustomers     []TopCustomer    `json:"topCustomers"`
}

type MonthData struct {
	Label     string  `json:"label"`
	Revenue   float64 `json:"revenue"`
	Orders    int64   `json:"orders"`
	NetProfit float64 `json:"netProfit"`
	AvgOrder  float64 `json:"avgOrder"`
	Expenses  float64 `json:"expenses"`
}

type MonthlyComparison struct {
	CurrentMonth  MonthData `json:"currentMonth"`
	PreviousMonth MonthData `json:"previousMonth"`
	RevenueChange float64   `json:"revenueChange"`
	OrdersChange  float64   `json:"ordersChange"`
	ProfitChange  float64   `json:"profitChange"`
}

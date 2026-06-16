package domain

// ChartDataResult holds chart data from database queries
type ChartDataResult struct {
	DateKey string `json:"date_key"`
	Total   Amount `json:"total"`
}

type ChartDataPoint struct {
	Label          string `json:"label"`
	Value          Amount `json:"value"`
	FormattedValue string `json:"formattedValue"`
}

type TopProduct struct {
	Label string `json:"label"`
	Value int    `json:"value"`
}

type TopCustomer struct {
	Name  string `json:"name"`
	Total Amount `json:"total"`
}

type DashboardStats struct {
	TotalRevenue     Amount           `json:"totalRevenue"`
	TotalOrders      int64            `json:"totalOrders"`
	DailyRevenue     Amount           `json:"dailyRevenue"`
	DailyOrders      int64            `json:"dailyOrders"`
	ChartData        []ChartDataPoint `json:"chartData"`
	TopSelling       []TopProduct     `json:"topSelling"`
	RecentSales      []Sale           `json:"recentSales"`
	LowStockCount    int64            `json:"lowStockCount"`
	TotalProducts    int64            `json:"totalProducts"`
	NetProfit        Amount           `json:"netProfit"`
	GrossProfit      Amount           `json:"grossProfit"`
	TotalExpenses    Amount           `json:"totalExpenses"`
	ExpenseBreakdown []ChartDataPoint `json:"expenseBreakdown"`
	TopCustomers     []TopCustomer    `json:"topCustomers"`
}

type MonthData struct {
	Label     string `json:"label"`
	Revenue   Amount `json:"revenue"`
	Orders    int64  `json:"orders"`
	NetProfit Amount `json:"netProfit"`
	AvgOrder  Amount `json:"avgOrder"`
	Expenses  Amount `json:"expenses"`
}

type MonthlyComparison struct {
	CurrentMonth  MonthData `json:"currentMonth"`
	PreviousMonth MonthData `json:"previousMonth"`
	RevenueChange float64   `json:"revenueChange"`
	OrdersChange  float64   `json:"ordersChange"`
	ProfitChange  float64   `json:"profitChange"`
}


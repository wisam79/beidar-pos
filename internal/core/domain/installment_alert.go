package domain

// InstallmentAlert represents a single overdue installment alert
type InstallmentAlert struct {
	SaleID        string `json:"saleId"`
	CustomerID    string `json:"customerId"`
	CustomerName  string `json:"customerName"`
	CustomerPhone string `json:"customerPhone"`
	InstNumber    int    `json:"instNumber"`
	DueDate       string `json:"dueDate"`
	Amount        Amount `json:"amount"`
	DaysOverdue   int    `json:"daysOverdue"`
	TotalDue      Amount `json:"totalDue"`
}

// InstallmentAlertSummary aggregates overdue installments metrics
type InstallmentAlertSummary struct {
	TotalOverdue int64              `json:"totalOverdue"`
	TotalAmount  Amount             `json:"totalAmount"`
	ByDay        map[string]int64   `json:"byDay"`
	TopCustomers []OverdueCustomer  `json:"topCustomers"`
	Alerts       []InstallmentAlert `json:"alerts"`
}

// OverdueCustomer represents a customer with overdue installment debt
type OverdueCustomer struct {
	CustomerID   string `json:"customerId"`
	CustomerName string `json:"customerName"`
	TotalDebt    Amount `json:"totalDebt"`
	OverdueCount int    `json:"overdueCount"`
}

package repository

import (
	"beidar-desktop/internal/core/domain"
	"gorm.io/gorm"
)

type statsRepository struct {
	db *gorm.DB
}

func NewStatsRepository(db *gorm.DB) domain.StatsRepository {
	return &statsRepository{db: db}
}

func (r *statsRepository) GetBasicStats(today string) (totalRevenue domain.Amount, totalOrders int64, dailyRevenue domain.Amount, dailyOrders int64, totalProducts int64, lowStockCount int64, err error) {
	type saleStats struct {
		Revenue domain.Amount
		Orders  int64
	}
	type prodStats struct {
		Total     int64
		LowStock  int64
	}

	var allSales saleStats
	err = r.db.Model(&domain.Sale{}).Where("status != ?", "returned").Select("COALESCE(SUM(total), 0) as revenue, COUNT(*) as orders").Scan(&allSales).Error
	if err != nil {
		return
	}

	var dailySales saleStats
	err = r.db.Model(&domain.Sale{}).Where("date = ? AND status != ?", today, "returned").Select("COALESCE(SUM(total), 0) as revenue, COUNT(*) as orders").Scan(&dailySales).Error
	if err != nil {
		return
	}

	var prods prodStats
	err = r.db.Model(&domain.Product{}).Select("COUNT(*) as total, COUNT(CASE WHEN stock <= CASE WHEN min_stock > 0 THEN min_stock ELSE 5 END THEN 1 END) as low_stock").Scan(&prods).Error
	if err != nil {
		return
	}

	totalRevenue = allSales.Revenue
	totalOrders = allSales.Orders
	dailyRevenue = dailySales.Revenue
	dailyOrders = dailySales.Orders
	totalProducts = prods.Total
	lowStockCount = prods.LowStock
	return
}

func (r *statsRepository) GetRecentSales(limit int) ([]domain.Sale, error) {
	var sales []domain.Sale
	err := r.db.Order("timestamp desc").Limit(limit).Preload("Items").Find(&sales).Error
	return sales, err
}

func (r *statsRepository) GetTopSellingProducts(limit int) ([]domain.TopProduct, error) {
	var topProducts []domain.TopProduct
	rows, err := r.db.Table("sale_items").
		Joins("JOIN sales ON sales.id = sale_items.sale_id").
		Where("sales.status != ?", "returned").
		Select("sale_items.name as label, sum(sale_items.quantity) as value").
		Group("sale_items.name").
		Order("value desc").
		Limit(limit).
		Rows()

	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var p domain.TopProduct
		if err := rows.Scan(&p.Label, &p.Value); err == nil {
			topProducts = append(topProducts, p)
		}
	}
	return topProducts, nil
}

func (r *statsRepository) GetProfitAndExpenses() (totalCOGS domain.Amount, totalExpenses domain.Amount, expenseBreakdown []domain.ChartDataPoint, err error) {
	err = r.db.Table("sale_items").
		Joins("JOIN sales ON sales.id = sale_items.sale_id").
		Where("sales.status != ?", "returned").
		Select("CAST(COALESCE(SUM(sale_items.cost * sale_items.quantity), 0) AS INTEGER)").
		Scan(&totalCOGS).Error
	if err != nil {
		return
	}

	err = r.db.Model(&domain.Expense{}).Select("COALESCE(SUM(amount), 0)").Scan(&totalExpenses).Error
	if err != nil {
		return
	}

	rows, err := r.db.Model(&domain.Expense{}).
		Select("category, SUM(amount) as total").
		Group("category").
		Order("total desc").
		Rows()
	if err != nil {
		return
	}
	defer rows.Close()

	for rows.Next() {
		var cat string
		var am domain.Amount
		if err := rows.Scan(&cat, &am); err == nil {
			expenseBreakdown = append(expenseBreakdown, domain.ChartDataPoint{
				Label: cat,
				Value: am,
			})
		}
	}
	return
}

func (r *statsRepository) GetTopCustomers(limit int) ([]domain.TopCustomer, error) {
	var customers []domain.TopCustomer
	rows, err := r.db.Model(&domain.Sale{}).
		Where("status != ? AND customer_name != '' AND customer_name NOT LIKE ?", "returned", "%Guest%").
		Select("customer_name, SUM(total) as total").
		Group("customer_name").
		Order("total desc").
		Limit(limit).
		Rows()

	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var c domain.TopCustomer
		if err := rows.Scan(&c.Name, &c.Total); err == nil {
			customers = append(customers, c)
		}
	}
	return customers, nil
}

func (r *statsRepository) GetChartData(startDate string, dateFormat string) ([]domain.ChartDataResult, error) {
	var results []domain.ChartDataResult

	err := r.db.Table("sales").
		Where("date >= ? AND status != ?", startDate, "returned").
		Select("strftime(?, date) as date_key, COALESCE(SUM(total), 0) as total", dateFormat).
		Group("date_key").
		Order("date_key asc").
		Scan(&results).Error

	return results, err
}

func (r *statsRepository) GetMonthStats(startDate, endDate string) (revenue domain.Amount, orders int64, expenses domain.Amount, cogs domain.Amount, err error) {
	err = r.db.Model(&domain.Sale{}).
		Where("date >= ? AND date <= ? AND status != ?", startDate, endDate, "returned").
		Select("COALESCE(SUM(total), 0)").
		Scan(&revenue).Error
	if err != nil {
		return
	}

	err = r.db.Model(&domain.Sale{}).
		Where("date >= ? AND date <= ? AND status != ?", startDate, endDate, "returned").
		Count(&orders).Error
	if err != nil {
		return
	}

	err = r.db.Model(&domain.Expense{}).
		Where("date >= ? AND date <= ?", startDate, endDate).
		Select("COALESCE(SUM(amount), 0)").
		Scan(&expenses).Error
	if err != nil {
		return
	}

	err = r.db.Table("sale_items").
		Joins("JOIN sales ON sales.id = sale_items.sale_id").
		Where("sales.date >= ? AND sales.date <= ? AND sales.status != ?", startDate, endDate, "returned").
		Select("CAST(COALESCE(SUM(sale_items.cost * sale_items.quantity), 0) AS INTEGER)").
		Scan(&cogs).Error

	return
}

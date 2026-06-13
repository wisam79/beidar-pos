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

func (r *statsRepository) GetBasicStats(today string) (totalRevenue float64, totalOrders int64, dailyRevenue float64, dailyOrders int64, totalProducts int64, lowStockCount int64, err error) {
	err = r.db.Model(&domain.Sale{}).Where("status != ?", "returned").Select("COALESCE(SUM(total), 0)").Scan(&totalRevenue).Error
	if err != nil {
		return
	}

	err = r.db.Model(&domain.Sale{}).Where("status != ?", "returned").Count(&totalOrders).Error
	if err != nil {
		return
	}

	err = r.db.Model(&domain.Sale{}).Where("date = ? AND status != ?", today, "returned").Select("COALESCE(SUM(total), 0)").Scan(&dailyRevenue).Error
	if err != nil {
		return
	}

	err = r.db.Model(&domain.Sale{}).Where("date = ? AND status != ?", today, "returned").Count(&dailyOrders).Error
	if err != nil {
		return
	}

	err = r.db.Model(&domain.Product{}).Count(&totalProducts).Error
	if err != nil {
		return
	}

	err = r.db.Model(&domain.Product{}).Where("stock <= CASE WHEN min_stock > 0 THEN min_stock ELSE 5 END").Count(&lowStockCount).Error
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

func (r *statsRepository) GetProfitAndExpenses() (totalCOGS float64, totalExpenses float64, expenseBreakdown []domain.ChartDataPoint, err error) {
	err = r.db.Table("sale_items").
		Joins("JOIN sales ON sales.id = sale_items.sale_id").
		Where("sales.status != ?", "returned").
		Select("COALESCE(SUM(sale_items.cost * sale_items.quantity), 0)").
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
		var am float64
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

func (r *statsRepository) GetMonthStats(startDate, endDate string) (revenue float64, orders int64, expenses float64, cogs float64, err error) {
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
		Select("COALESCE(SUM(sale_items.cost * sale_items.quantity), 0)").
		Scan(&cogs).Error

	return
}

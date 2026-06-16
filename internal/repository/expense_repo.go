package repository

import (
	"beidar-desktop/internal/core/domain"
	"gorm.io/gorm"
)

type expenseRepository struct {
	db *gorm.DB
}

func NewExpenseRepository(db *gorm.DB) domain.ExpenseRepository {
	return &expenseRepository{db: db}
}

func (r *expenseRepository) WithTx(tx domain.Tx) domain.ExpenseRepository {
	return &expenseRepository{db: getDB(tx, r.db)}
}

func (r *expenseRepository) Transaction(fn func(tx domain.Tx) error) error {
	return r.db.Transaction(func(gdb *gorm.DB) error {
		return fn(domain.NewTx(gdb))
	})
}

func (r *expenseRepository) GetExpenses() ([]domain.Expense, error) {
	var expenses []domain.Expense
	result := r.db.Order("date desc").Find(&expenses)
	return expenses, result.Error
}

func (r *expenseRepository) GetExpenseByID(id string) (*domain.Expense, error) {
	var expense domain.Expense
	if err := r.db.First(&expense, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &expense, nil
}

func (r *expenseRepository) CreateExpense(e *domain.Expense) error {
	return r.db.Create(e).Error
}

func (r *expenseRepository) UpdateExpense(e *domain.Expense) error {
	return r.db.Save(e).Error
}

func (r *expenseRepository) DeleteExpense(id string) error {
	return r.db.Delete(&domain.Expense{}, "id = ?", id).Error
}

func (r *expenseRepository) GetCategories() ([]domain.Category, error) {
	var cats []domain.Category
	result := r.db.Find(&cats)
	return cats, result.Error
}

func (r *expenseRepository) GetCategoryByID(id string) (*domain.Category, error) {
	var cat domain.Category
	if err := r.db.First(&cat, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &cat, nil
}

func (r *expenseRepository) GetCategoryByName(name string) (*domain.Category, error) {
	var cat domain.Category
	if err := r.db.First(&cat, "name = ?", name).Error; err != nil {
		return nil, err
	}
	return &cat, nil
}

func (r *expenseRepository) CreateCategory(c *domain.Category) error {
	return r.db.Create(c).Error
}

func (r *expenseRepository) UpdateCategory(c *domain.Category) error {
	return r.db.Save(c).Error
}

func (r *expenseRepository) DeleteCategory(id string) error {
	return r.db.Delete(&domain.Category{}, "id = ?", id).Error
}

func (r *expenseRepository) CountProductsInCategory(categoryName string) (int64, error) {
	var count int64
	err := r.db.Model(&domain.Product{}).Where("category = ?", categoryName).Count(&count).Error
	return count, err
}

func (r *expenseRepository) UpdateProductCategory(oldCategoryName, newCategoryName string) error {
	return r.db.Model(&domain.Product{}).Where("category = ?", oldCategoryName).Update("category", newCategoryName).Error
}

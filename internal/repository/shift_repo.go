package repository

import (
	"beidar-desktop/internal/core/domain"
	"fmt"
	"gorm.io/gorm"
)

type shiftRepository struct {
	db *gorm.DB
}

func NewShiftRepository(db *gorm.DB) domain.ShiftRepository {
	return &shiftRepository{db: db}
}

func (r *shiftRepository) WithTx(tx domain.Tx) domain.ShiftRepository {
	return &shiftRepository{db: getDB(tx, r.db)}
}

func (r *shiftRepository) Transaction(fn func(tx domain.Tx) error) error {
	return r.db.Transaction(func(gdb *gorm.DB) error {
		return fn(domain.NewTx(gdb))
	})
}

func (r *shiftRepository) GetActiveShift() (*domain.Shift, error) {
	var shifts []domain.Shift
	if err := r.db.Where("status = ?", "open").Limit(1).Find(&shifts).Error; err != nil {
		return nil, err
	}
	if len(shifts) == 0 {
		return nil, nil
	}
	return &shifts[0], nil
}

func (r *shiftRepository) GetByID(id string) (*domain.Shift, error) {
	var shift domain.Shift
	if err := r.db.First(&shift, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &shift, nil
}

func (r *shiftRepository) GetShiftMovements(shiftID string) ([]domain.CashMovement, error) {
	var movements []domain.CashMovement
	err := r.db.Where("shift_id = ?", shiftID).Order("timestamp desc").Find(&movements).Error
	return movements, err
}

func (r *shiftRepository) GetShiftHistory(limit int) ([]domain.Shift, error) {
	var shifts []domain.Shift
	err := r.db.Where("status = ?", "closed").Order("close_time desc").Limit(limit).Find(&shifts).Error
	return shifts, err
}

func (r *shiftRepository) CreateCashMovement(move *domain.CashMovement) error {
	return r.db.Create(move).Error
}

func (r *shiftRepository) GetCashInAndOut(shiftID string) (cashIn domain.Amount, cashOut domain.Amount, err error) {
	var inCents, outCents int64
	err = r.db.Model(&domain.CashMovement{}).
		Where("shift_id = ? AND type = ?", shiftID, "cash_in").
		Select("COALESCE(SUM(amount), 0)").
		Scan(&inCents).Error
	if err != nil {
		return domain.Zero(), domain.Zero(), err
	}

	err = r.db.Model(&domain.CashMovement{}).
		Where("shift_id = ? AND type = ?", shiftID, "cash_out").
		Select("COALESCE(SUM(amount), 0)").
		Scan(&outCents).Error
	return domain.Amount(inCents), domain.Amount(outCents), err
}

func (r *shiftRepository) UpdateShiftSales(saleTotal, cashAmount domain.Amount, requireShift bool) error {
	var id string
	err := r.db.Model(&domain.Shift{}).
		Where("status = ?", "open").
		Limit(1).
		Pluck("id", &id).Error
	if err != nil {
		return err
	}
	if id == "" {
		if requireShift {
			return fmt.Errorf("لا يوجد شفت مفتوح. يرجى فتح شفت قبل البيع")
		}
		return nil
	}

	return r.db.Model(&domain.Shift{}).Where("id = ?", id).Updates(map[string]interface{}{
		"total_sales":      gorm.Expr("total_sales + ?", int64(saleTotal)),
		"cash_sales":       gorm.Expr("cash_sales + ?", int64(cashAmount)),
		"sales_count":      gorm.Expr("sales_count + 1"),
		"expected_balance": gorm.Expr("expected_balance + ?", int64(cashAmount)),
	}).Error
}

func (r *shiftRepository) Save(shift *domain.Shift) error {
	return r.db.Save(shift).Error
}

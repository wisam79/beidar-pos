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

func (r *shiftRepository) WithTx(tx *gorm.DB) domain.ShiftRepository {
	return &shiftRepository{db: tx}
}

func (r *shiftRepository) Transaction(fn func(tx *gorm.DB) error) error {
	return r.db.Transaction(fn)
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
	shift, err := r.GetActiveShift()
	if err != nil {
		return err
	}

	if shift == nil {
		if requireShift {
			return fmt.Errorf("لا يوجد شفت مفتوح. يرجى فتح شفت قبل البيع")
		}
		return nil
	}

	shift.TotalSales = shift.TotalSales.Add(saleTotal)
	shift.CashSales = shift.CashSales.Add(cashAmount)
	shift.SalesCount++
	shift.ExpectedBalance = shift.ExpectedBalance.Add(cashAmount)

	return r.Save(shift)
}

func (r *shiftRepository) Save(shift *domain.Shift) error {
	return r.db.Save(shift).Error
}

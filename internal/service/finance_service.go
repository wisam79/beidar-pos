package service

import (
	"beidar-desktop/internal/core/domain"
	pkgerrors "beidar-desktop/pkg/errors"
	"beidar-desktop/pkg/i18n"
	"beidar-desktop/pkg/logger"
	"fmt"
	"time"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

type financeService struct {
	expenseRepo     domain.ExpenseRepository
	shiftRepo       domain.ShiftRepository
	purchaseRepo    domain.PurchaseOrderRepository
	supplierRepo    domain.SupplierRepository
	productRepo     domain.ProductRepository
	preferencesRepo domain.PreferencesRepository
	productService  domain.ProductService
}

// NewFinanceService creates a new instance of domain.FinanceService
func NewFinanceService(
	expenseRepo domain.ExpenseRepository,
	shiftRepo domain.ShiftRepository,
	purchaseRepo domain.PurchaseOrderRepository,
	supplierRepo domain.SupplierRepository,
	productRepo domain.ProductRepository,
	preferencesRepo domain.PreferencesRepository,
	productService domain.ProductService,
) domain.FinanceService {
	return &financeService{
		expenseRepo:     expenseRepo,
		shiftRepo:       shiftRepo,
		purchaseRepo:    purchaseRepo,
		supplierRepo:    supplierRepo,
		productRepo:     productRepo,
		preferencesRepo: preferencesRepo,
		productService:  productService,
	}
}

func (s *financeService) GetExpenses() ([]domain.Expense, error) {
	return s.expenseRepo.GetExpenses()
}

func (s *financeService) SaveExpense(e domain.Expense) error {
	if e.Amount <= 0 {
		return pkgerrors.NewAppError(
			pkgerrors.ModuleFinance,
			"INVALID_AMOUNT",
			i18n.GetMessage("INVALID_AMOUNT"),
			i18n.GetHint("INVALID_AMOUNT"),
			"amount",
		)
	}

	if len(e.Title) < 2 {
		return pkgerrors.NewAppError(
			pkgerrors.ModuleFinance,
			"MISSING_TITLE",
			i18n.GetMessage("MISSING_TITLE"),
			i18n.GetHint("MISSING_TITLE"),
			"title",
		)
	}

	if e.ID == "" {
		e.ID = uuid.New().String()
		return s.expenseRepo.CreateExpense(&e)
	}
	return s.expenseRepo.UpdateExpense(&e)
}

func (s *financeService) DeleteExpense(id string) error {
	_, err := s.expenseRepo.GetExpenseByID(id)
	if err != nil {
		return pkgerrors.NewAppError(
			pkgerrors.ModuleFinance,
			"EXPENSE_NOT_FOUND",
			i18n.GetMessage("EXPENSE_NOT_FOUND"),
			i18n.GetHint("EXPENSE_NOT_FOUND"),
			"id",
		)
	}
	return s.expenseRepo.DeleteExpense(id)
}

func (s *financeService) GetCategories() ([]domain.Category, error) {
	return s.expenseRepo.GetCategories()
}

func (s *financeService) SaveCategory(c domain.Category) error {
	if len(c.Name) < 2 {
		return pkgerrors.NewAppError(
			pkgerrors.ModuleFinance,
			"INVALID_CATEGORY_NAME",
			i18n.GetMessage("INVALID_CATEGORY_NAME"),
			i18n.GetHint("INVALID_CATEGORY_NAME"),
			"name",
		)
	}

	if c.ID == "" {
		c.ID = uuid.New().String()
		return s.expenseRepo.CreateCategory(&c)
	}
	return s.expenseRepo.UpdateCategory(&c)
}

func (s *financeService) DeleteCategory(id string, force bool) error {
	cat, err := s.expenseRepo.GetCategoryByID(id)
	if err != nil {
		return pkgerrors.NewAppError(
			pkgerrors.ModuleFinance,
			"CATEGORY_NOT_FOUND",
			i18n.GetMessage("CATEGORY_NOT_FOUND"),
			i18n.GetHint("CATEGORY_NOT_FOUND"),
			"id",
		)
	}

	productCount, err := s.expenseRepo.CountProductsInCategory(cat.Name)
	if err != nil {
		return err
	}

	if productCount > 0 {
		if !force {
			return &pkgerrors.AppError{
				Module:  pkgerrors.ModuleFinance,
				Code:    "CATEGORY_HAS_PRODUCTS",
				Message: i18n.GetMessage("CATEGORY_HAS_PRODUCTS", productCount),
				Hint:    i18n.GetHint("CATEGORY_HAS_PRODUCTS"),
				Options: map[string]bool{"allowForce": true},
			}
		}
		if err := s.expenseRepo.UpdateProductCategory(cat.Name, "Uncategorized"); err != nil {
			return err
		}
	}

	return s.expenseRepo.DeleteCategory(id)
}

func (s *financeService) GetPreferences() (*domain.AppPreferences, error) {
	prefs, err := s.preferencesRepo.Get()
	if err != nil {
		return nil, err
	}
	if prefs.AdminPin != "" {
		prefs.AdminPin = "********"
	}
	return prefs, nil
}

func (s *financeService) UpdatePreferences(newPrefs domain.AppPreferences) error {
	currentPrefs, err := s.preferencesRepo.Get()
	if err != nil {
		return err
	}

	newPrefs.ID = currentPrefs.ID

	if newPrefs.AdminPin == "" || newPrefs.AdminPin == "********" {
		newPrefs.AdminPin = currentPrefs.AdminPin
	} else if newPrefs.AdminPin != currentPrefs.AdminPin {
		hashedPin, err := bcrypt.GenerateFromPassword([]byte(newPrefs.AdminPin), bcrypt.DefaultCost)
		if err != nil {
			return err
		}
		newPrefs.AdminPin = string(hashedPin)
	}

	return s.preferencesRepo.Save(&newPrefs)
}

func (s *financeService) VerifyAdminPin(pin string) (bool, error) {
	prefs, err := s.preferencesRepo.Get()
	if err != nil {
		return false, err
	}

	if prefs.AdminPin == "" {
		return false, nil
	}

	err = bcrypt.CompareHashAndPassword([]byte(prefs.AdminPin), []byte(pin))
	return err == nil, nil
}

func (s *financeService) OpenShift(staffID, staffName string, openingBalance domain.Amount) (*domain.Shift, error) {
	existing, err := s.shiftRepo.GetActiveShift()
	if err != nil {
		return nil, err
	}
	if existing != nil {
		return nil, fmt.Errorf("يوجد شفت مفتوح بالفعل للموظف %s", existing.StaffName)
	}

	shift := domain.Shift{
		ID:              uuid.New().String(),
		StaffID:         staffID,
		StaffName:       staffName,
		OpenTime:        time.Now().UnixMilli(),
		OpeningBalance:  openingBalance,
		ExpectedBalance: openingBalance,
		Status:          "open",
	}

	if err := s.shiftRepo.Save(&shift); err != nil {
		return nil, err
	}

	logger.Logger.Info("SHIFT", fmt.Sprintf("OpenShift | Staff=%s | OpeningBalance=%s", staffName, openingBalance.String()))
	return &shift, nil
}

func (s *financeService) CloseShift(shiftID string, closingBalance domain.Amount, note string) (*domain.Shift, error) {
	var shift domain.Shift
	err := s.shiftRepo.Transaction(func(tx domain.Tx) error {
		txShiftRepo := s.shiftRepo.WithTx(tx)
		sPointer, err := txShiftRepo.GetByID(shiftID)
		if err != nil {
			return fmt.Errorf("الشفت غير موجود")
		}

		shift = *sPointer
		if shift.Status != "open" {
			return fmt.Errorf("الشفت مغلق بالفعل")
		}

		cashIn, cashOut, err := txShiftRepo.GetCashInAndOut(shiftID)
		if err != nil {
			return err
		}

		expectedBalance := shift.OpeningBalance.Add(shift.CashSales).Add(cashIn).Sub(cashOut)
		variance := closingBalance.Sub(expectedBalance)

		shift.CloseTime = time.Now().UnixMilli()
		shift.ClosingBalance = closingBalance
		shift.ExpectedBalance = expectedBalance
		shift.Variance = variance
		shift.Status = "closed"
		shift.Note = note

		if err := txShiftRepo.Save(&shift); err != nil {
			return err
		}

		logger.Logger.Info("SHIFT", fmt.Sprintf("CloseShift | Staff=%s | ClosingBalance=%s | Variance=%s", shift.StaffName, closingBalance.String(), variance.String()))
		return nil
	})

	if err != nil {
		return nil, err
	}
	return &shift, nil
}

func (s *financeService) GetActiveShift() (*domain.Shift, error) {
	shift, err := s.shiftRepo.GetActiveShift()
	if err != nil {
		return nil, err
	}
	if shift == nil {
		return nil, nil
	}

	cashIn, cashOut, err := s.shiftRepo.GetCashInAndOut(shift.ID)
	if err != nil {
		return nil, err
	}

	shift.ExpectedBalance = shift.OpeningBalance.Add(shift.CashSales).Add(cashIn).Sub(cashOut)
	return shift, nil
}

func (s *financeService) AddCashMovement(shiftID, moveType, reason, staffID, staffName string, amount domain.Amount) (*domain.CashMovement, error) {
	var move domain.CashMovement
	err := s.shiftRepo.Transaction(func(tx domain.Tx) error {
		txShiftRepo := s.shiftRepo.WithTx(tx)
		shift, err := txShiftRepo.GetByID(shiftID)
		if err != nil {
			return fmt.Errorf("الشفت غير موجود")
		}
		if shift.Status != "open" {
			return fmt.Errorf("لا يمكن إضافة حركة لشفت مغلق")
		}

		move = domain.CashMovement{
			ID:        uuid.New().String(),
			ShiftID:   shiftID,
			Type:      moveType,
			Amount:    amount,
			Reason:    reason,
			StaffID:   staffID,
			StaffName: staffName,
			Timestamp: time.Now().UnixMilli(),
		}

		if err := txShiftRepo.CreateCashMovement(&move); err != nil {
			return err
		}

		logger.Logger.Info("SHIFT", fmt.Sprintf("CashMovement | Type=%s | Amount=%s | Staff=%s", moveType, amount.String(), staffName))
		return nil
	})

	if err != nil {
		return nil, err
	}
	return &move, nil
}

func (s *financeService) GetShiftMovements(shiftID string) ([]domain.CashMovement, error) {
	return s.shiftRepo.GetShiftMovements(shiftID)
}

func (s *financeService) GetShiftHistory(limit int) ([]domain.Shift, error) {
	return s.shiftRepo.GetShiftHistory(limit)
}

func (s *financeService) CreatePurchaseOrder(order domain.PurchaseOrder) (*domain.PurchaseOrder, error) {
	if order.SupplierID == "" {
		return nil, fmt.Errorf("المورد مطلوب")
	}
	if len(order.Items) == 0 {
		return nil, fmt.Errorf("يجب إضافة منتج واحد على الأقل")
	}

	order.ID = "PO-" + uuid.New().String()[:8]
	order.Status = domain.POStatusPending
	order.CreatedAt = time.Now().UnixMilli()
	order.PaidAmount = domain.Zero()

	var total domain.Amount
	for i := range order.Items {
		if order.Items[i].Quantity <= 0 {
			return nil, fmt.Errorf("الكمية يجب أن تكون أكبر من الصفر")
		}
		if order.Items[i].UnitCost <= 0 {
			return nil, fmt.Errorf("تكلفة الوحدة يجب أن تكون أكبر من الصفر")
		}
		order.Items[i].OrderID = order.ID
		order.Items[i].ReceivedQty = 0
		order.Items[i].Total = order.Items[i].UnitCost.MulFloat(order.Items[i].Quantity)
		total = total.Add(order.Items[i].Total)
	}
	order.TotalAmount = total

	supplier, err := s.supplierRepo.GetByID(order.SupplierID)
	if err == nil {
		order.SupplierName = supplier.Name
	}

	err = s.purchaseRepo.Create(&order)
	return &order, err
}

func (s *financeService) GetPurchaseOrders(status string, supplierID string) ([]domain.PurchaseOrder, error) {
	return s.purchaseRepo.GetPurchaseOrders(status, supplierID)
}

func (s *financeService) GetPurchaseOrder(id string) (*domain.PurchaseOrder, error) {
	return s.purchaseRepo.GetByID(id)
}

func (s *financeService) UpdatePurchaseOrder(order domain.PurchaseOrder) error {
	existing, err := s.purchaseRepo.GetByID(order.ID)
	if err != nil {
		return err
	}

	if existing.Status != domain.POStatusPending {
		return fmt.Errorf("لا يمكن تعديل أمر شراء تم استلامه أو إلغاؤه")
	}

	var total domain.Amount
	for i := range order.Items {
		if order.Items[i].Quantity <= 0 {
			return fmt.Errorf("الكمية يجب أن تكون أكبر من الصفر")
		}
		if order.Items[i].UnitCost <= 0 {
			return fmt.Errorf("تكلفة الوحدة يجب أن تكون أكبر من الصفر")
		}
		order.Items[i].OrderID = order.ID
		order.Items[i].Total = order.Items[i].UnitCost.MulFloat(order.Items[i].Quantity)
		total = total.Add(order.Items[i].Total)
	}
	order.TotalAmount = total

	return s.purchaseRepo.Transaction(func(tx domain.Tx) error {
		txPurchaseRepo := s.purchaseRepo.WithTx(tx)
		if err := txPurchaseRepo.DeleteItemsByOrderID(order.ID); err != nil {
			return err
		}
		return txPurchaseRepo.Update(&order)
	})
}

func (s *financeService) DeletePurchaseOrder(id string) error {
	order, err := s.purchaseRepo.GetByID(id)
	if err != nil {
		return err
	}

	if order.Status != domain.POStatusPending {
		return fmt.Errorf("لا يمكن حذف أمر شراء تم استلامه")
	}

	return s.purchaseRepo.Transaction(func(tx domain.Tx) error {
		txPurchaseRepo := s.purchaseRepo.WithTx(tx)
		if err := txPurchaseRepo.DeleteItemsByOrderID(id); err != nil {
			return err
		}
		return txPurchaseRepo.Delete(id)
	})
}

func (s *financeService) CancelPurchaseOrder(id string) error {
	order, err := s.purchaseRepo.GetByID(id)
	if err != nil {
		return err
	}

	if order.Status != domain.POStatusPending && order.Status != domain.POStatusPartial {
		return fmt.Errorf("لا يمكن إلغاء هذا الأمر")
	}

	order.Status = domain.POStatusCancelled
	return s.purchaseRepo.Update(order)
}

func (s *financeService) ReceivePurchaseOrder(orderID string, items []domain.PurchaseOrderItem) error {
	err := s.purchaseRepo.Transaction(func(tx domain.Tx) error {
		txPurchaseRepo := s.purchaseRepo.WithTx(tx)
		txProductRepo := s.productRepo.WithTx(tx)

		order, err := txPurchaseRepo.GetByID(orderID)
		if err != nil {
			return err
		}

		if order.Status == domain.POStatusReceived {
			return fmt.Errorf("تم استلام هذا الأمر بالكامل مسبقاً")
		}
		if order.Status == domain.POStatusCancelled {
			return fmt.Errorf("لا يمكن استلام أمر ملغي")
		}

		allReceived := true

		for _, receiveItem := range items {
			if receiveItem.ReceivedQty <= 0 {
				continue
			}

			orderItem, err := txPurchaseRepo.GetOrderItem(orderID, receiveItem.ProductID)
			if err != nil {
				continue
			}

			remaining := orderItem.Quantity - orderItem.ReceivedQty
			if remaining <= 0 {
				continue
			}
			toReceive := receiveItem.ReceivedQty
			if toReceive <= 0 {
				continue
			}
			if toReceive > remaining {
				toReceive = remaining
			}

			newReceivedQty := orderItem.ReceivedQty + toReceive
			if err := txPurchaseRepo.UpdateItemReceivedQty(orderItem.ID, newReceivedQty); err != nil {
				return err
			}

			if err := txProductRepo.UpdateStock(receiveItem.ProductID, toReceive); err != nil {
				return err
			}

			product, err := txProductRepo.GetByID(receiveItem.ProductID)
			productName := orderItem.ProductName
			if err == nil {
				productName = product.Name
			}

			movement := domain.StockMovement{
				ProductID:   receiveItem.ProductID,
				ProductName: productName,
				Type:        "restock",
				Qty:         toReceive,
				Reason:      "استلام أمر شراء #" + orderID,
				Timestamp:   time.Now().UnixMilli(),
			}
			if err := txProductRepo.CreateStockMovement(&movement); err != nil {
				return err
			}

			if newReceivedQty < orderItem.Quantity {
				allReceived = false
			}
		}

		orderItems, err := txPurchaseRepo.GetOrderItems(orderID)
		if err != nil {
			return err
		}

		partiallyReceived := false
		for _, item := range orderItems {
			if item.ReceivedQty < item.Quantity {
				allReceived = false
			}
			if item.ReceivedQty > 0 {
				partiallyReceived = true
			}
		}

		if allReceived {
			order.Status = domain.POStatusReceived
			order.ReceivedAt = time.Now().UnixMilli()
			if err := txPurchaseRepo.Update(order); err != nil {
				return err
			}
		} else if partiallyReceived {
			order.Status = domain.POStatusPartial
			if err := txPurchaseRepo.Update(order); err != nil {
				return err
			}
		}

		return nil
	})
	if err == nil && s.productService != nil {
		s.productService.ClearCache()
	}
	return err
}

func (s *financeService) PayPurchaseOrder(orderID string, amount domain.Amount, method string) error {
	order, err := s.purchaseRepo.GetByID(orderID)
	if err != nil {
		return err
	}

	remaining := order.TotalAmount.Sub(order.PaidAmount)
	if amount > remaining {
		return fmt.Errorf("المبلغ أكبر من المتبقي (%s)", remaining.String())
	}

	return s.purchaseRepo.Transaction(func(tx domain.Tx) error {
		txPurchaseRepo := s.purchaseRepo.WithTx(tx)
		txSupplierRepo := s.supplierRepo.WithTx(tx)

		order.PaidAmount = order.PaidAmount.Add(amount)
		if err := txPurchaseRepo.Update(order); err != nil {
			return err
		}

		if err := txSupplierRepo.UpdateBalance(order.SupplierID, amount); err != nil {
			return err
		}

		return nil
	})
}

func (s *financeService) GetPurchaseOrderStats() (*domain.PurchaseOrderStats, error) {
	return s.purchaseRepo.GetPurchaseOrderStats()
}

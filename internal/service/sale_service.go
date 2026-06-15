package service

import (
	"errors"
	"fmt"
	"time"

	"beidar-desktop/internal/core/domain"
	pkgerrors "beidar-desktop/pkg/errors"
	"beidar-desktop/pkg/i18n"
	"beidar-desktop/pkg/logger"

	"github.com/google/uuid"
)

// SalesErrorCode represents specific sales error types
type SalesErrorCode string

const (
	ErrCodeSalesInsufficientStock SalesErrorCode = "SALES_INSUFFICIENT_STOCK"
	ErrCodeInvalidPayment         SalesErrorCode = "INVALID_PAYMENT"
	ErrCodeEmptyCart              SalesErrorCode = "EMPTY_CART"
	ErrCodeSaleNotFound           SalesErrorCode = "SALE_NOT_FOUND"
	ErrCodeAlreadyReturned        SalesErrorCode = "ALREADY_RETURNED"
	ErrCodeSalesProductNotFound   SalesErrorCode = "SALES_PRODUCT_NOT_FOUND"
	ErrCodeSalesInvalidQuantity   SalesErrorCode = "SALES_INVALID_QUANTITY"
	ErrCodePriceMismatch          SalesErrorCode = "PRICE_MISMATCH"
)

// SalesError represents a detailed sales error with hints
type SalesError struct {
	Code    SalesErrorCode `json:"code"`
	Message string         `json:"message"`
	Hint    string         `json:"hint,omitempty"`
	Field   string         `json:"field,omitempty"`
}

func (e *SalesError) Error() string {
	if e.Hint != "" {
		return fmt.Sprintf("%s. %s", e.Message, e.Hint)
	}
	return e.Message
}

func NewSalesError(code SalesErrorCode, message, hint, field string) *SalesError {
	return &SalesError{
		Code:    code,
		Message: message,
		Hint:    hint,
		Field:   field,
	}
}

func ErrSalesInsufficientStock(productName string, available, requested float64) *SalesError {
	return NewSalesError(
		ErrCodeSalesInsufficientStock,
		i18n.GetMessage("SALES_INSUFFICIENT_STOCK", productName, fmt.Sprintf("%.2f", available), fmt.Sprintf("%.2f", requested)),
		i18n.GetHint("SALES_INSUFFICIENT_STOCK"),
		"stock",
	)
}

func ErrInvalidPayment() *SalesError {
	return NewSalesError(
		ErrCodeInvalidPayment,
		i18n.GetMessage("INVALID_PAYMENT"),
		i18n.GetHint("INVALID_PAYMENT"),
		"payment",
	)
}

func ErrEmptyCart() *SalesError {
	return NewSalesError(
		ErrCodeEmptyCart,
		i18n.GetMessage("EMPTY_CART"),
		i18n.GetHint("EMPTY_CART"),
		"items",
	)
}

func ErrSalesNotFound(id string) *SalesError {
	return NewSalesError(
		ErrCodeSaleNotFound,
		i18n.GetMessage("SALE_NOT_FOUND", id),
		i18n.GetHint("SALE_NOT_FOUND"),
		"id",
	)
}

func ErrAlreadyReturned() *SalesError {
	return NewSalesError(
		ErrCodeAlreadyReturned,
		i18n.GetMessage("ALREADY_RETURNED"),
		i18n.GetHint("ALREADY_RETURNED"),
		"status",
	)
}

func ErrSalesProductNotFound(productID string) *SalesError {
	return NewSalesError(
		ErrCodeSalesProductNotFound,
		i18n.GetMessage("SALES_PRODUCT_NOT_FOUND", productID),
		i18n.GetHint("SALES_PRODUCT_NOT_FOUND"),
		"product_id",
	)
}

func ErrSalesInvalidQuantity() *SalesError {
	return NewSalesError(
		ErrCodeSalesInvalidQuantity,
		i18n.GetMessage("SALES_INVALID_QUANTITY"),
		i18n.GetHint("SALES_INVALID_QUANTITY"),
		"quantity",
	)
}

func ErrPriceMismatch(productName string, oldPrice, newPrice domain.Amount) *SalesError {
	return NewSalesError(
		ErrCodePriceMismatch,
		i18n.GetMessage("PRICE_MISMATCH", productName, oldPrice.String(), newPrice.String()),
		i18n.GetHint("PRICE_MISMATCH"),
		"price",
	)
}

type saleService struct {
	saleRepo        domain.SaleRepository
	productRepo     domain.ProductRepository
	customerRepo    domain.CustomerRepository
	paymentRepo     domain.PaymentRepository
	shiftRepo       domain.ShiftRepository
	preferencesRepo domain.PreferencesRepository
	productService  domain.ProductService
}

// NewSaleService creates a new instance of domain.SaleService
func NewSaleService(
	saleRepo domain.SaleRepository,
	productRepo domain.ProductRepository,
	customerRepo domain.CustomerRepository,
	paymentRepo domain.PaymentRepository,
	shiftRepo domain.ShiftRepository,
	preferencesRepo domain.PreferencesRepository,
	productService domain.ProductService,
) domain.SaleService {
	return &saleService{
		saleRepo:        saleRepo,
		productRepo:     productRepo,
		customerRepo:    customerRepo,
		paymentRepo:     paymentRepo,
		shiftRepo:       shiftRepo,
		preferencesRepo: preferencesRepo,
		productService:  productService,
	}
}

func (s *saleService) GetSales(page int, pageSize int, search string, statusFilter string, dateFilter string) (*domain.PaginatedSales, error) {
	return s.saleRepo.GetSales(page, pageSize, search, statusFilter, dateFilter)
}

func (s *saleService) GetSale(id string) (*domain.Sale, error) {
	return s.saleRepo.GetByID(id)
}

func (s *saleService) ProcessSale(sale *domain.Sale) error {

	if len(sale.Items) == 0 {
		return ErrEmptyCart()
	}

	if sale.ID == "" {
		sale.ID = uuid.New().String()
	}

	if sale.CustomerID == "" {
		if sale.PaymentMethod == "credit" {
			return NewSalesError(
				ErrCodeInvalidPayment,
				i18n.GetMessage("CREDIT_WITHOUT_CUSTOMER"),
				i18n.GetHint("CREDIT_WITHOUT_CUSTOMER"),
				"customer",
			)
		}
		if sale.PaymentMethod == "installment" {
			return NewSalesError(
				ErrCodeInvalidPayment,
				i18n.GetMessage("INSTALLMENT_WITHOUT_CUSTOMER"),
				i18n.GetHint("INSTALLMENT_WITHOUT_CUSTOMER"),
				"customer",
			)
		}
		if sale.PaymentMethod == "split" && sale.SplitDetails != nil {
			if creditAmount, ok := sale.SplitDetails["credit"]; ok && creditAmount > 0 {
				return NewSalesError(
					ErrCodeInvalidPayment,
					i18n.GetMessage("SPLIT_CREDIT_WITHOUT_CUSTOMER"),
					i18n.GetHint("SPLIT_CREDIT_WITHOUT_CUSTOMER"),
					"customer",
				)
			}
		}
	}

	for _, item := range sale.Items {
		if item.Quantity <= 0 {
			return ErrSalesInvalidQuantity()
		}
		if item.Discount.IsNegative() {
			return NewSalesError(ErrCodeInvalidPayment, "قيمة خصم المنتج لا يمكن أن تكون سالبة", "يجب أن تكون قيمة خصم المنتج صفراً أو أكبر", "discount")
		}
		baseAmount := item.Price.MulFloat(item.Quantity)
		if item.Discount > baseAmount {
			return NewSalesError(ErrCodeInvalidPayment, "قيمة خصم المنتج تتجاوز الإجمالي", "لا يمكن أن تتجاوز قيمة خصم المنتج السعر الإجمالي للمنتج", "discount")
		}
	}

	// Snapshot the shift-required preference BEFORE opening the transaction so
	// the value is fixed for the whole sale and we avoid a read inside the tx.
	requireShiftPref := false
	if prefs, err := s.preferencesRepo.Get(); err == nil {
		requireShiftPref = prefs.RequireShift
	}

	err := s.saleRepo.Transaction(func(tx domain.Tx) error {
		txSaleRepo := s.saleRepo.WithTx(tx)
		txProductRepo := s.productRepo.WithTx(tx)
		txCustomerRepo := s.customerRepo.WithTx(tx)
		txPaymentRepo := s.paymentRepo.WithTx(tx)
		txShiftRepo := s.shiftRepo.WithTx(tx)

		var calculatedTotal domain.Amount
		var calculatedSubtotal domain.Amount

		productIDs := make([]string, len(sale.Items))
		for i, item := range sale.Items {
			productIDs[i] = item.ProductID
		}
		products, err := txProductRepo.GetByIDs(productIDs)
		if err != nil {
			return err
		}
		productMap := make(map[string]*domain.Product, len(products))
		for i := range products {
			productMap[products[i].ID] = &products[i]
		}

		for i, item := range sale.Items {
			product, ok := productMap[item.ProductID]
			if !ok {
				return ErrSalesProductNotFound(item.ProductID)
			}

			if product.Stock < item.Quantity {
				return ErrSalesInsufficientStock(product.Name, product.Stock, item.Quantity)
			}

			priceMatchesRegular := product.Price.Sub(item.Price).Abs().Cents() <= 1
			priceMatchesWholesale := product.WholesalePrice > 0 && product.WholesalePrice.Sub(item.Price).Abs().Cents() <= 1

			if !priceMatchesRegular && !priceMatchesWholesale {
				return ErrPriceMismatch(product.Name, item.Price, product.Price)
			}

			realPrice := item.Price
			itemTotal := realPrice.MulFloat(item.Quantity).Sub(item.Discount)

			sale.Items[i].Price = realPrice
			sale.Items[i].Name = product.Name
			sale.Items[i].Total = itemTotal
			sale.Items[i].Cost = product.Cost

			calculatedSubtotal = calculatedSubtotal.Add(realPrice.MulFloat(item.Quantity))
			calculatedTotal = calculatedTotal.Add(itemTotal)

			err = txProductRepo.UpdateStock(item.ProductID, -item.Quantity)
			if err != nil {
				if errors.Is(err, domain.ErrInsufficientStock) {
					return ErrSalesInsufficientStock(product.Name, product.Stock, item.Quantity)
				}
				return err
			}

			movement := domain.StockMovement{
				ProductID:   product.ID,
				ProductName: product.Name,
				Type:        "sale",
				Qty:         -item.Quantity,
				Reason:      "Sale #" + sale.ID,
				Timestamp:   time.Now().UnixMilli(),
			}
			if err := txProductRepo.CreateStockMovement(&movement); err != nil {
				return err
			}
		}

		sale.Subtotal = calculatedSubtotal
		if sale.Discount > calculatedTotal {
			return errors.New(i18n.GetMessage("DISCOUNT_EXCEEDS_TOTAL"))
		}
		sale.Total = calculatedTotal.Sub(sale.Discount)

		if sale.CustomerID != "" {
			sale.PointsAwarded = int(sale.Total.Div(1000).Cents())
		}

		if err := txSaleRepo.Create(sale); err != nil {
			return errors.New(i18n.GetMessage("SAVE_SALE_FAILED", err.Error()))
		}

		if sale.CustomerID != "" {
			customer, err := txCustomerRepo.GetByID(sale.CustomerID)
			if err == nil {
				updates := map[string]interface{}{
					"total_purchases": customer.TotalPurchases.Add(sale.Total).Cents(),
					"last_visit":      time.Now().Format("2006-01-02"),
					"points":          customer.Points + sale.PointsAwarded,
				}

				var debtIncrease, installmentDebtIncrease domain.Amount

				if sale.PaymentMethod == "credit" {
					debtIncrease = sale.Total
				} else if sale.PaymentMethod == "installment" {
					if sale.InstallmentPlan != nil {
						installmentDebtIncrease = sale.Total.Sub(sale.InstallmentPlan.DownPayment)
					} else {
						installmentDebtIncrease = sale.Total
					}
				} else if sale.PaymentMethod == "split" && sale.SplitDetails != nil {
					debtIncrease = sale.SplitDetails["credit"]
				}

				if debtIncrease > 0 {
					updates["debt"] = customer.Debt.Add(debtIncrease).Cents()
				}
				if installmentDebtIncrease > 0 {
					updates["installment_debt"] = customer.InstallmentDebt.Add(installmentDebtIncrease).Cents()
				}

				if err := txCustomerRepo.Updates(customer.ID, updates); err != nil {
					return err
				}
			}
		}

		if sale.PaymentMethod == "split" && sale.SplitDetails != nil {
			for method, amount := range sale.SplitDetails {
				if amount > 0 {
					payment := domain.Payment{
						SaleID:     sale.ID,
						CustomerID: sale.CustomerID,
						Amount:     amount,
						Method:     method,
						Timestamp:  time.Now().UnixMilli(),
						Note:       "Split Payment",
						StaffID:    sale.StaffID,
					}
					if err := txPaymentRepo.Create(&payment); err != nil {
						return errors.New(i18n.GetMessage("SAVE_PAYMENT_FAILED", err.Error()))
					}
				}
			}
		} else {
			payment := domain.Payment{
				SaleID:     sale.ID,
				CustomerID: sale.CustomerID,
				Amount:     sale.Total,
				Method:     sale.PaymentMethod,
				Timestamp:  time.Now().UnixMilli(),
				StaffID:    sale.StaffID,
			}
			if err := txPaymentRepo.Create(&payment); err != nil {
				return errors.New(i18n.GetMessage("SAVE_PAYMENT_FAILED", err.Error()))
			}
		}

		var cashAmount domain.Amount
		if sale.PaymentMethod == "cash" {
			cashAmount = sale.Total
		} else if sale.PaymentMethod == "split" && sale.SplitDetails != nil {
			cashAmount = sale.SplitDetails["cash"]
		}

		requireShift := requireShiftPref

		if err := txShiftRepo.UpdateShiftSales(sale.Total, cashAmount, requireShift); err != nil {
			return errors.New(i18n.GetMessage("SALE_PROCESS_FAILED", err.Error()))
		}

		logger.LogSale("COMPLETED", sale.ID, sale.Total.Float(), sale.CustomerID)

		return nil
	})
	if err == nil && s.productService != nil {
		s.productService.ClearCache()
	}
	return err
}

func (s *saleService) ReturnSale(id string) error {
	err := s.saleRepo.Transaction(func(tx domain.Tx) error {
		txSaleRepo := s.saleRepo.WithTx(tx)
		txProductRepo := s.productRepo.WithTx(tx)
		txCustomerRepo := s.customerRepo.WithTx(tx)
		txPaymentRepo := s.paymentRepo.WithTx(tx)

		sale, err := txSaleRepo.GetByID(id)
		if err != nil {
			return ErrSalesNotFound(id)
		}

		if sale.Status == "returned" {
			return ErrAlreadyReturned()
		}

		for _, item := range sale.Items {
			err = txProductRepo.UpdateStock(item.ProductID, item.Quantity)
			if err != nil {
				return err
			}

			product, err := txProductRepo.GetByID(item.ProductID)
			productName := item.Name
			if err == nil {
				productName = product.Name
			}

			movement := domain.StockMovement{
				ProductID:   item.ProductID,
				ProductName: productName,
				Type:        "return",
				Qty:         item.Quantity,
				Reason:      "مرتجع فاتورة #" + sale.ID,
				Timestamp:   time.Now().UnixMilli(),
			}
			if err := txProductRepo.CreateStockMovement(&movement); err != nil {
				return err
			}
		}

		if sale.CustomerID != "" {
			pointsToRevert := sale.PointsAwarded
			if pointsToRevert == 0 {
				pointsToRevert = int(sale.Total.Div(1000).Cents())
			}

			if err := txCustomerRepo.DecrementPurchases(sale.CustomerID, sale.Total); err != nil {
				return err
			}
			if err := txCustomerRepo.AdjustPoints(sale.CustomerID, -pointsToRevert); err != nil {
				return err
			}

			switch sale.PaymentMethod {
			case "credit":
				if err := txCustomerRepo.DecrementDebt(sale.CustomerID, sale.Total); err != nil {
					return err
				}
			case "installment":
				installmentAmount := sale.Total
				if sale.InstallmentPlan != nil {
					installmentAmount = sale.Total.Sub(sale.InstallmentPlan.DownPayment)
				}
				if err := txCustomerRepo.DecrementInstallmentDebt(sale.CustomerID, installmentAmount); err != nil {
					return err
				}
			}
		}

		if sale.PaymentMethod == "cash" || sale.PaymentMethod == "card" {
			refundPayment := domain.Payment{
				SaleID:     sale.ID,
				CustomerID: sale.CustomerID,
				Amount:     -sale.Total,
				Method:     sale.PaymentMethod,
				Timestamp:  time.Now().UnixMilli(),
				Note:       "استرجاع / Refund",
			}
			if err := txPaymentRepo.Create(&refundPayment); err != nil {
				return fmt.Errorf("فشل تسجيل عملية الاسترجاع: %v", err)
			}
		}

		sale.Status = "returned"
		if err := txSaleRepo.Update(sale); err != nil {
			return err
		}

		return nil
	})
	if err == nil && s.productService != nil {
		s.productService.ClearCache()
	}
	return err
}

func (s *saleService) ReturnSalePartial(saleID string, productID string, qtyToReturn float64) error {
	err := s.saleRepo.Transaction(func(tx domain.Tx) error {
		txSaleRepo := s.saleRepo.WithTx(tx)
		txProductRepo := s.productRepo.WithTx(tx)
		txCustomerRepo := s.customerRepo.WithTx(tx)
		txPaymentRepo := s.paymentRepo.WithTx(tx)

		item, err := txSaleRepo.GetSaleItem(saleID, productID)
		if err != nil {
			return ErrSalesProductNotFound(productID)
		}

		sale, err := txSaleRepo.GetByID(saleID)
		if err != nil {
			return ErrSalesNotFound(saleID)
		}

		if qtyToReturn <= 0 {
			return ErrSalesInvalidQuantity()
		}

		remainingQty := item.Quantity - item.ReturnedQty
		if qtyToReturn > remainingQty {
			return fmt.Errorf("لا يمكن إرجاع %.2f. المتبقي فقط %.2f", qtyToReturn, remainingQty)
		}

		item.ReturnedQty += qtyToReturn
		if err := txSaleRepo.UpdateSaleItem(item); err != nil {
			return err
		}

		err = txProductRepo.UpdateStock(productID, qtyToReturn)
		if err != nil {
			return err
		}

		movement := domain.StockMovement{
			ProductID:   item.ProductID,
			ProductName: item.Name,
			Type:        "return_partial",
			Qty:         qtyToReturn,
			Reason:      fmt.Sprintf("Partial Return: Sale #%s", saleID),
			Timestamp:   time.Now().UnixMilli(),
		}
		if err := txProductRepo.CreateStockMovement(&movement); err != nil {
			return err
		}

		var refundAmount domain.Amount
		if item.Quantity > 0 {
			refundAmount = item.Total.MulFloat(qtyToReturn / item.Quantity)
		}

		if sale.CustomerID != "" {
			pointsToRevert := int(refundAmount.Div(1000).Cents())

			if err := txCustomerRepo.DecrementPurchases(sale.CustomerID, refundAmount); err != nil {
				return err
			}
			if err := txCustomerRepo.AdjustPoints(sale.CustomerID, -pointsToRevert); err != nil {
				return err
			}

			switch sale.PaymentMethod {
			case "credit":
				if err := txCustomerRepo.DecrementDebt(sale.CustomerID, refundAmount); err != nil {
					return err
				}
			case "installment":
				if err := txCustomerRepo.DecrementInstallmentDebt(sale.CustomerID, refundAmount); err != nil {
					return err
				}
			case "split":
				if err := txCustomerRepo.DecrementDebt(sale.CustomerID, refundAmount); err != nil {
					return err
				}
			}
		}

		refundPayment := domain.Payment{
			SaleID:     sale.ID,
			CustomerID: sale.CustomerID,
			Amount:     domain.Amount(-refundAmount.Cents()),
			Method:     sale.PaymentMethod,
			Timestamp:  time.Now().UnixMilli(),
			Note:       fmt.Sprintf("Partial Return: %.2f x %s", qtyToReturn, item.Name),
		}
		if err := txPaymentRepo.Create(&refundPayment); err != nil {
			return err
		}

		allItems, err := txSaleRepo.GetSaleItems(saleID)
		if err != nil {
			return err
		}

		allReturned := true
		for _, i := range allItems {
			if i.ReturnedQty < i.Quantity {
				allReturned = false
				break
			}
		}

		newStatus := "partial_return"
		if allReturned {
			newStatus = "returned"
		}
		sale.Status = newStatus
		if err := txSaleRepo.Update(sale); err != nil {
			return err
		}

		return nil
	})
	if err == nil && s.productService != nil {
		s.productService.ClearCache()
	}
	return err
}

func (s *saleService) GetSaleItems(saleID string) ([]domain.SaleItem, error) {
	return s.saleRepo.GetSaleItems(saleID)
}

func (s *saleService) DeleteSale(id string) error {
	return pkgerrors.NewAppError(
		pkgerrors.ModuleSales,
		"SALE_DELETION_DISABLED",
		"لا يمكن حذف الفواتير - استخدم خيار الإرجاع بدلاً من ذلك",
		"الفواتير سجلات مالية لا يمكن حذفها. استخدم 'إرجاع الفاتورة' للاسترداد",
		"id",
	)
}

func (s *saleService) ParkSale(itemsJSON string, customerName string, customerID string, note string, total float64, itemsCount float64) (*domain.ParkedSale, error) {
	parked := domain.ParkedSale{
		ItemsJSON:    itemsJSON,
		CustomerName: customerName,
		CustomerID:   customerID,
		Note:         note,
		Total:        domain.NewAmount(total),
		ItemsCount:   itemsCount,
		CreatedAt:    time.Now().Unix(),
	}
	err := s.saleRepo.ParkSale(&parked)
	return &parked, err
}

func (s *saleService) GetParkedSales() ([]domain.ParkedSale, error) {
	return s.saleRepo.GetParkedSales()
}

func (s *saleService) GetParkedSalesCount() (int, error) {
	return s.saleRepo.GetParkedSalesCount()
}

func (s *saleService) RetrieveParkedSale(id uint) (*domain.ParkedSale, error) {
	return s.saleRepo.RetrieveParkedSale(id)
}

func (s *saleService) DeleteParkedSale(id uint) error {
	return s.saleRepo.DeleteParkedSale(id)
}

func (s *saleService) GetInstallmentSales() ([]domain.Sale, error) {
	return s.saleRepo.GetInstallmentSales()
}

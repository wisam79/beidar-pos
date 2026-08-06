package service

import (
	"errors"
	"fmt"
	"time"

	"beidar-desktop/internal/core/domain"
	pkgerrors "beidar-desktop/pkg/errors"
	"beidar-desktop/pkg/i18n"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"beidar-desktop/pkg/auth"
)

func ErrSalesInsufficientStock(productName string, available, requested float64) *pkgerrors.AppError {
	return pkgerrors.NewAppError(
		pkgerrors.ModuleSales,
		"SALES_INSUFFICIENT_STOCK",
		i18n.GetMessage("SALES_INSUFFICIENT_STOCK", productName, fmt.Sprintf("%.2f", available), fmt.Sprintf("%.2f", requested)),
		i18n.GetHint("SALES_INSUFFICIENT_STOCK"),
		"stock",
	)
}

func ErrInvalidPayment() *pkgerrors.AppError {
	return pkgerrors.NewAppError(
		pkgerrors.ModuleSales,
		"INVALID_PAYMENT",
		i18n.GetMessage("INVALID_PAYMENT"),
		i18n.GetHint("INVALID_PAYMENT"),
		"payment",
	)
}

func ErrEmptyCart() *pkgerrors.AppError {
	return pkgerrors.NewAppError(
		pkgerrors.ModuleSales,
		"EMPTY_CART",
		i18n.GetMessage("EMPTY_CART"),
		i18n.GetHint("EMPTY_CART"),
		"items",
	)
}

func ErrSalesNotFound(id string) *pkgerrors.AppError {
	return pkgerrors.NewAppError(
		pkgerrors.ModuleSales,
		"SALE_NOT_FOUND",
		i18n.GetMessage("SALE_NOT_FOUND", id),
		i18n.GetHint("SALE_NOT_FOUND"),
		"id",
	)
}

func ErrAlreadyReturned() *pkgerrors.AppError {
	return pkgerrors.NewAppError(
		pkgerrors.ModuleSales,
		"ALREADY_RETURNED",
		i18n.GetMessage("ALREADY_RETURNED"),
		i18n.GetHint("ALREADY_RETURNED"),
		"status",
	)
}

func ErrSalesProductNotFound(productID string) *pkgerrors.AppError {
	return pkgerrors.NewAppError(
		pkgerrors.ModuleSales,
		"SALES_PRODUCT_NOT_FOUND",
		i18n.GetMessage("SALES_PRODUCT_NOT_FOUND", productID),
		i18n.GetHint("SALES_PRODUCT_NOT_FOUND"),
		"product_id",
	)
}

func ErrSalesInvalidQuantity() *pkgerrors.AppError {
	return pkgerrors.NewAppError(
		pkgerrors.ModuleSales,
		"SALES_INVALID_QUANTITY",
		i18n.GetMessage("SALES_INVALID_QUANTITY"),
		i18n.GetHint("SALES_INVALID_QUANTITY"),
		"quantity",
	)
}

func ErrPriceMismatch(productName string, oldPrice, newPrice domain.Amount) *pkgerrors.AppError {
	return pkgerrors.NewAppError(
		pkgerrors.ModuleSales,
		"PRICE_MISMATCH",
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
	auditRepo       domain.AuditRepository
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
	auditRepo domain.AuditRepository,
) domain.SaleService {
	return &saleService{
		saleRepo:        saleRepo,
		productRepo:     productRepo,
		customerRepo:    customerRepo,
		paymentRepo:     paymentRepo,
		shiftRepo:       shiftRepo,
		preferencesRepo: preferencesRepo,
		productService:  productService,
		auditRepo:       auditRepo,
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

	// Never trust client-supplied timestamps, dates, or status.
	sale.Date = time.Now().Format("2006-01-02")
	sale.Timestamp = time.Now().UnixMilli()
	sale.Status = "completed"

	// Check permissions for discounts in the service layer
	anyItemHasDiscount := false
	for _, item := range sale.Items {
		if item.Discount > 0 {
			anyItemHasDiscount = true
			break
		}
	}
	if sale.Discount > 0 || anyItemHasDiscount {
		if err := auth.RequirePermission(auth.PermDiscounts); err != nil {
			return err
		}
	}

	if sale.ID == "" {
		sale.ID = uuid.New().String()
	}

	if sale.CustomerID == "" {
		if sale.PaymentMethod == "credit" {
			return pkgerrors.NewAppError(
				pkgerrors.ModuleSales,
				"INVALID_PAYMENT",
				i18n.GetMessage("CREDIT_WITHOUT_CUSTOMER"),
				i18n.GetHint("CREDIT_WITHOUT_CUSTOMER"),
				"customer",
			)
		}
		if sale.PaymentMethod == "installment" {
			return pkgerrors.NewAppError(
				pkgerrors.ModuleSales,
				"INVALID_PAYMENT",
				i18n.GetMessage("INSTALLMENT_WITHOUT_CUSTOMER"),
				i18n.GetHint("INSTALLMENT_WITHOUT_CUSTOMER"),
				"customer",
			)
		}
		if sale.PaymentMethod == "split" && sale.SplitDetails != nil {
			if creditAmount, ok := sale.SplitDetails["credit"]; ok && creditAmount > 0 {
				return pkgerrors.NewAppError(
					pkgerrors.ModuleSales,
					"INVALID_PAYMENT",
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
			return pkgerrors.NewAppError(pkgerrors.ModuleSales, "INVALID_PAYMENT", "قيمة خصم المنتج لا يمكن أن تكون سالبة", "يجب أن تكون قيمة خصم المنتج صفراً أو أكبر", "discount")
		}
		baseAmount := item.Price.MulFloat(item.Quantity)
		if item.Discount > baseAmount {
			return pkgerrors.NewAppError(pkgerrors.ModuleSales, "INVALID_PAYMENT", "قيمة خصم المنتج تتجاوز الإجمالي", "لا يمكن أن تتجاوز قيمة خصم المنتج السعر الإجمالي للمنتج", "discount")
		}
	}

	requireShiftPref := false
	vatRate := float64(0)
	if prefs, err := s.preferencesRepo.Get(); err == nil {
		requireShiftPref = prefs.RequireShift
		vatRate = prefs.TaxRate
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

		// Use GORM Lock for Update (Pessimistic Locking) via repository interface
		products, fetchErr := txProductRepo.GetForUpdate(productIDs)
		if fetchErr != nil {
			return fetchErr
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

			updateErr := txProductRepo.UpdateStock(item.ProductID, -item.Quantity)
			if updateErr != nil {
				if errors.Is(updateErr, domain.ErrInsufficientStock) {
					return ErrSalesInsufficientStock(product.Name, product.Stock, item.Quantity)
				}
				return updateErr
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
		if sale.Discount.IsNegative() {
			return pkgerrors.NewAppError(pkgerrors.ModuleSales, "INVALID_PAYMENT", "قيمة الخصم لا يمكن أن تكون سالبة", "يجب أن تكون قيمة الخصم صفراً أو أكبر", "discount")
		}
		if sale.Discount > calculatedTotal {
			return errors.New(i18n.GetMessage("DISCOUNT_EXCEEDS_TOTAL"))
		}

		taxableTotal := calculatedTotal.Sub(sale.Discount)
		if vatRate > 0 {
			sale.VAT = taxableTotal.Percentage(vatRate)
		} else {
			sale.VAT = domain.Zero()
		}

		sale.Total = taxableTotal.Add(sale.VAT)

		if sale.CustomerID != "" {
			sale.PointsAwarded = int(sale.Total.Div(1000).Cents())
		}

		if sale.PaymentMethod == "installment" {
			if sale.InstallmentPlan != nil && sale.InstallmentPlan.DownPayment.IsNegative() {
				return pkgerrors.NewAppError(
					pkgerrors.ModuleSales,
					"INVALID_PAYMENT",
					"الدفعة الأولى لا يمكن أن تكون سالبة",
					"يجب أن تكون الدفعة الأولى صفراً أو أكبر",
					"installment",
				)
			}
			if sale.InstallmentPlan != nil && sale.InstallmentPlan.DownPayment > sale.Total {
				return pkgerrors.NewAppError(
					pkgerrors.ModuleSales,
					"INVALID_PAYMENT",
					"قيمة الدفعة الأولى لا يمكن أن تتجاوز إجمالي الفاتورة",
					"يجب أن تكون الدفعة الأولى أقل من أو تساوي إجمالي الفاتورة",
					"installment",
				)
			}
		}

		if err := txSaleRepo.Create(sale); err != nil {
			return fmt.Errorf("%s: %w", i18n.GetMessage("SAVE_SALE_FAILED", ""), err)
		}

		if sale.CustomerID != "" {
			customer, err := txCustomerRepo.GetByID(sale.CustomerID)
			if err != nil {
				return pkgerrors.NewAppError(
					pkgerrors.ModuleSales,
					"CUSTOMER_NOT_FOUND",
					"العميل غير موجود",
					"لا يمكن إتمام الفاتورة على عميل غير موجود",
					"customerId",
				)
			}

			updates := map[string]interface{}{
				"total_purchases": gorm.Expr("total_purchases + ?", sale.Total.Cents()),
				"last_visit":      time.Now().Format("2006-01-02"),
				"points":          gorm.Expr("points + ?", sale.PointsAwarded),
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
				updates["debt"] = gorm.Expr("debt + ?", debtIncrease.Cents())
			}
			if installmentDebtIncrease > 0 {
				updates["installment_debt"] = gorm.Expr("installment_debt + ?", installmentDebtIncrease.Cents())
			}

			if err := txCustomerRepo.Updates(customer.ID, updates); err != nil {
				return err
			}
		}

		if sale.PaymentMethod == "split" && sale.SplitDetails != nil {
			for _, amount := range sale.SplitDetails {
				if amount.IsNegative() {
					return pkgerrors.NewAppError(
						pkgerrors.ModuleSales,
						"INVALID_PAYMENT",
						"قيمة الدفعة المقسمة لا يمكن أن تكون سالبة",
						"يجب أن تكون قيمة كل دفعة مقسمة صفراً أو أكبر",
						"split",
					)
				}
				if amount > sale.Total {
					return pkgerrors.NewAppError(
						pkgerrors.ModuleSales,
						"INVALID_PAYMENT",
						"قيمة الدفعة المقسمة تتجاوز إجمالي الفاتورة",
						"لا يمكن أن تتجاوز قيمة الدفعة المقسمة إجمالي الفاتورة",
						"split",
					)
				}
			}
			var splitSum domain.Amount
			for _, amount := range sale.SplitDetails {
				splitSum = splitSum.Add(amount)
			}
			if splitSum != sale.Total {
				return pkgerrors.NewAppError(
					pkgerrors.ModuleSales,
					"INVALID_PAYMENT",
					fmt.Sprintf("مجموع الدفعات المقسمة (%s) لا يساوي إجمالي الفاتورة (%s)", splitSum.String(), sale.Total.String()),
					"يرجى مراجعة الدفعات المقسمة",
					"split",
				)
			}

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
						return fmt.Errorf("%s: %w", i18n.GetMessage("SAVE_PAYMENT_FAILED", ""), err)
					}
				}
			}
		} else {
			paymentAmount := sale.Total
			// For installments, the base ledger row reflects the financed part
			// only; the down payment is recorded below as a separate cash row.
			// This keeps the payment ledger exactly equal to the invoice total
			// instead of double-counting the down payment.
			if sale.PaymentMethod == "installment" && sale.InstallmentPlan != nil && sale.InstallmentPlan.DownPayment > 0 {
				paymentAmount = sale.Total.Sub(sale.InstallmentPlan.DownPayment)
			}
			if paymentAmount > 0 {
				payment := domain.Payment{
					SaleID:     sale.ID,
					CustomerID: sale.CustomerID,
					Amount:     paymentAmount,
					Method:     sale.PaymentMethod,
					Timestamp:  time.Now().UnixMilli(),
					StaffID:    sale.StaffID,
				}
				if err := txPaymentRepo.Create(&payment); err != nil {
					return fmt.Errorf("%s: %w", i18n.GetMessage("SAVE_PAYMENT_FAILED", ""), err)
				}
			}

			if sale.PaymentMethod == "installment" && sale.InstallmentPlan != nil && sale.InstallmentPlan.DownPayment > 0 {
				dpPayment := domain.Payment{
					SaleID:     sale.ID,
					CustomerID: sale.CustomerID,
					Amount:     sale.InstallmentPlan.DownPayment,
					Method:     "cash",
					Timestamp:  time.Now().UnixMilli(),
					Note:       "الدفعة الأولى",
					StaffID:    sale.StaffID,
				}
				if err := txPaymentRepo.Create(&dpPayment); err != nil {
					return fmt.Errorf("%s: %w", i18n.GetMessage("SAVE_PAYMENT_FAILED", ""), err)
				}
			}
		}

		var cashAmount domain.Amount
		if sale.PaymentMethod == "cash" {
			cashAmount = sale.Total
		} else if sale.PaymentMethod == "split" && sale.SplitDetails != nil {
			cashAmount = sale.SplitDetails["cash"]
		} else if sale.PaymentMethod == "installment" && sale.InstallmentPlan != nil {
			cashAmount = sale.InstallmentPlan.DownPayment
		}

		requireShift := requireShiftPref
		if err := txShiftRepo.UpdateShiftSales(sale.Total, cashAmount, true, requireShift); err != nil {
			return fmt.Errorf("%s: %w", i18n.GetMessage("SALE_PROCESS_FAILED", ""), err)
		}

		if sale.Discount > 0 {
			_ = s.auditRepo.WithTx(tx).Log(&domain.AuditLog{
				StaffID:  sale.StaffID,
				Action:   "SALE_DISCOUNT",
				Entity:   "Sale",
				EntityID: sale.ID,
				Details:  fmt.Sprintf("تم تطبيق خصم بقيمة %s على الفاتورة", sale.Discount.String()),
			})
		}

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
		txShiftRepo := s.shiftRepo.WithTx(tx)

		sale, err := txSaleRepo.GetForUpdate(id)
		if err != nil {
			return ErrSalesNotFound(id)
		}

		if sale.Status == "returned" {
			return ErrAlreadyReturned()
		}

		productIDs := make([]string, len(sale.Items))
		for i, item := range sale.Items {
			productIDs[i] = item.ProductID
		}
		products, err := txProductRepo.GetByIDs(productIDs)
		if err != nil {
			return err
		}
		productMap := make(map[string]domain.Product)
		for _, prod := range products {
			productMap[prod.ID] = prod
		}

		for _, item := range sale.Items {
			// The product was deleted after the sale; skip restoring stock and the movement.
			if _, exists := productMap[item.ProductID]; !exists {
				continue
			}

			returnQty := item.Quantity - item.ReturnedQty
			if returnQty <= 0 {
				continue
			}

			err = txProductRepo.UpdateStock(item.ProductID, returnQty)
			if err != nil {
				return err
			}

			productName := item.Name
			if prod, exists := productMap[item.ProductID]; exists {
				productName = prod.Name
			}

			movement := domain.StockMovement{
				ProductID:   item.ProductID,
				ProductName: productName,
				Type:        "return",
				Qty:         returnQty,
				Reason:      "مرتجع فاتورة #" + sale.ID,
				Timestamp:   time.Now().UnixMilli(),
			}
			if err := txProductRepo.CreateStockMovement(&movement); err != nil {
				return err
			}
		}

		if sale.CustomerID != "" {
			// Revert only the points that were awarded for the REMAINING total.
			// Partial returns already reverted their own shares; using the original
			// PointsAwarded here would double-revert after prior partial returns.
			pointsToRevert := int(sale.Total.Div(1000).Cents())

			if err := txCustomerRepo.DecrementPurchases(sale.CustomerID, sale.Total); err != nil {
				return err
			}
			if err := txCustomerRepo.AdjustPoints(sale.CustomerID, -pointsToRevert); err != nil {
				return err
			}

			// Fraction of the original invoice that is still outstanding after
			// any prior partial returns (1 when none happened).
			splitRemaining := saleRemainingLegs(sale)

			switch sale.PaymentMethod {
			case "credit":
				customer, err := txCustomerRepo.GetByID(sale.CustomerID)
				if err != nil {
					return err
				}
				refundAmount := domain.NewAmount(0)
				if customer.Debt < sale.Total {
					refundAmount = sale.Total.Sub(customer.Debt)
				}
				
				if err := txCustomerRepo.DecrementDebt(sale.CustomerID, sale.Total); err != nil {
					return err
				}
				
				if refundAmount > 0 {
					refundPayment := domain.Payment{
						SaleID:     sale.ID,
						CustomerID: sale.CustomerID,
						Amount:     -refundAmount,
						Method:     "cash",
						Note:       "استرداد نقدي لمدفوعات آجل",
						StaffID:    sale.StaffID,
						Timestamp:  time.Now().UnixMilli(),
					}
					if err := txPaymentRepo.Create(&refundPayment); err != nil {
						return fmt.Errorf("فشل تسجيل عملية الاسترجاع: %w", err)
					}
				}
			case "installment":
				var paidSum domain.Amount
				var refundable domain.Amount
				if sale.InstallmentPlan != nil {
					for _, inst := range sale.InstallmentPlan.Schedule {
						if inst.Status == "paid" {
							paidSum = paidSum.Add(inst.Amount)
						}
					}
					refundable = sale.InstallmentPlan.DownPayment.Add(paidSum)
				}

				if refundable > 0 {
					refundPayment := domain.Payment{
						SaleID:     sale.ID,
						CustomerID: sale.CustomerID,
						Amount:     -refundable,
						Method:     "cash",
						Note:       "استرداد فاتورة أقساط",
						StaffID:    sale.StaffID,
						Timestamp:  time.Now().UnixMilli(),
					}
					if err := txPaymentRepo.Create(&refundPayment); err != nil {
						return fmt.Errorf("فشل تسجيل عملية الاسترجاع: %w", err)
					}
				}

				outstanding := sale.Total
				if sale.InstallmentPlan != nil {
					outstanding = sale.Total.Sub(sale.InstallmentPlan.DownPayment).Sub(paidSum)
				}
				if outstanding > 0 {
					if err := txCustomerRepo.DecrementInstallmentDebt(sale.CustomerID, outstanding); err != nil {
						return err
					}
				}
			case "split":
				// Only the credit leg that is still outstanding affects debt:
				if creditRemaining, ok := splitRemaining["credit"]; ok && creditRemaining > 0 {
					customer, err := txCustomerRepo.GetByID(sale.CustomerID)
					if err == nil {
						refundAmount := domain.NewAmount(0)
						if customer.Debt < creditRemaining {
							refundAmount = creditRemaining.Sub(customer.Debt)
						}
						
						if err := txCustomerRepo.DecrementDebt(sale.CustomerID, creditRemaining); err != nil {
							return err
						}
						
						if refundAmount > 0 {
							refundPayment := domain.Payment{
								SaleID:     sale.ID,
								CustomerID: sale.CustomerID,
								Amount:     -refundAmount,
								Method:     "cash",
								Note:       "استرداد نقدي لمدفوعات آجل",
								StaffID:    sale.StaffID,
								Timestamp:  time.Now().UnixMilli(),
							}
							_ = txPaymentRepo.Create(&refundPayment)
						}
					}
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
				StaffID:    sale.StaffID,
			}
			if err := txPaymentRepo.Create(&refundPayment); err != nil {
				return fmt.Errorf("فشل تسجيل عملية الاسترجاع: %w", err)
			}
		} else if sale.PaymentMethod == "split" && sale.SplitDetails != nil {
			splitRemaining := saleRemainingLegs(sale)
			for method, amount := range sale.SplitDetails {
				if amount > 0 && method != "credit" {
					remaining := splitRemaining[method]
					if remaining <= 0 {
						continue
					}
					refundPayment := domain.Payment{
						SaleID:     sale.ID,
						CustomerID: sale.CustomerID,
						Amount:     -remaining,
						Method:     method,
						Timestamp:  time.Now().UnixMilli(),
						Note:       "استرجاع مقسم / Split Refund",
						StaffID:    sale.StaffID,
					}
					if err := txPaymentRepo.Create(&refundPayment); err != nil {
						return fmt.Errorf("فشل تسجيل عملية الاسترجاع: %w", err)
					}
				}
			}
		}

		var totalRefund domain.Amount
		var cashRefund domain.Amount
		switch sale.PaymentMethod {
		case "cash":
			totalRefund = sale.Total
			cashRefund = sale.Total
		case "card":
			totalRefund = sale.Total
		case "installment":
			if sale.InstallmentPlan != nil {
				var paidSum domain.Amount
				for _, inst := range sale.InstallmentPlan.Schedule {
					if inst.Status == "paid" {
						paidSum = paidSum.Add(inst.Amount)
					}
				}
				totalRefund = sale.InstallmentPlan.DownPayment.Add(paidSum)
				cashRefund = sale.InstallmentPlan.DownPayment.Add(paidSum)
			}
		case "split":
			splitRemaining := saleRemainingLegs(sale)
			if cash, ok := splitRemaining["cash"]; ok {
				cashRefund = cashRefund.Add(cash)
				totalRefund = totalRefund.Add(cash)
			}
			if card, ok := splitRemaining["card"]; ok {
				totalRefund = totalRefund.Add(card)
			}
		}
		if totalRefund > 0 {
			if err := txShiftRepo.UpdateShiftRefunds(totalRefund, cashRefund, true); err != nil {
				return fmt.Errorf("%s: %w", i18n.GetMessage("SALE_PROCESS_FAILED", ""), err)
			}
		}

		sale.Status = "returned"
		if err := txSaleRepo.Update(sale); err != nil {
			return err
		}

		_ = s.auditRepo.WithTx(tx).Log(&domain.AuditLog{
			StaffID:  sale.StaffID,
			Action:   "RETURN_SALE",
			Entity:   "Sale",
			EntityID: sale.ID,
			Details:  "تم استرجاع الفاتورة بالكامل",
		})

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
		txShiftRepo := s.shiftRepo.WithTx(tx)

		item, err := txSaleRepo.GetSaleItem(saleID, productID)
		if err != nil {
			return ErrSalesProductNotFound(productID)
		}

		sale, err := txSaleRepo.GetForUpdate(saleID)
		if err != nil {
			return ErrSalesNotFound(saleID)
		}

		if qtyToReturn <= 0 {
			return ErrSalesInvalidQuantity()
		}

		remainingQty := item.Quantity - item.ReturnedQty
		if qtyToReturn > remainingQty {
			return pkgerrors.NewAppError(
				pkgerrors.ModuleSales,
				"RETURN_QUANTITY_EXCEEDS_REMAINING",
				fmt.Sprintf("لا يمكن إرجاع %.2f. المتبقي فقط %.2f", qtyToReturn, remainingQty),
				"يرجى التحقق من الكمية المتبقية القابلة للإرجاع",
				"quantity",
			)
		}

		item.ReturnedQty += qtyToReturn
		if err := txSaleRepo.UpdateSaleItem(item); err != nil {
			return err
		}

		// If the product was deleted after the sale, skip restoring stock and the movement.
		product, productErr := txProductRepo.GetByID(productID)
		if productErr != nil && !errors.Is(productErr, gorm.ErrRecordNotFound) {
			return productErr
		}
		if productErr == nil {
			err = txProductRepo.UpdateStock(productID, qtyToReturn)
			if err != nil {
				return err
			}

			productName := item.Name
			if product != nil && product.Name != "" {
				productName = product.Name
			}

			movement := domain.StockMovement{
				ProductID:   item.ProductID,
				ProductName: productName,
				Type:        "return_partial",
				Qty:         qtyToReturn,
				Reason:      fmt.Sprintf("Partial Return: Sale #%s", saleID),
				Timestamp:   time.Now().UnixMilli(),
			}
			if err := txProductRepo.CreateStockMovement(&movement); err != nil {
				return err
			}
		}

		// The refund is the returned quantity's proportional share of the CURRENT invoice
		// total. sale.Total already includes VAT and the invoice-level discount, so
		// allocating by remaining value guarantees the discount fairness, sale.Total never
		// goes below zero, and no dependence on the current preference tax rate.
		qtyToReturnScaled := int64(qtyToReturn*1000 + 0.5)
		itemQtyScaled := int64(item.Quantity*1000 + 0.5)
		if itemQtyScaled == 0 {
			return pkgerrors.NewAppError(pkgerrors.ModuleSales, "INVALID_QUANTITY", "الكمية غير صالحة", "لا يمكن أن تكون الكمية صفراً", "quantity")
		}
		itemShareCents := (item.Total.Cents() * qtyToReturnScaled) / itemQtyScaled

		// Remaining invoice value BEFORE this return. For the returned item the
		// current deduction is excluded so the ratio (share/remaining) is exact.
		var remAllCents int64
		for _, invItem := range sale.Items {
			remQty := invItem.ReturnedQty
			if invItem.ProductID == item.ProductID {
				remQty = item.ReturnedQty - qtyToReturn
			}
			scaledQty := int64(invItem.Quantity*1000 + 0.5)
			if scaledQty <= 0 {
				continue
			}
			remScaledQty := int64((invItem.Quantity-remQty)*1000 + 0.5)
			if remScaledQty < 0 {
				remScaledQty = 0
			}
			if remScaledQty > scaledQty {
				remScaledQty = scaledQty
			}
			remAllCents += (invItem.Total.Cents() * remScaledQty) / scaledQty
		}
		if remAllCents == 0 {
			return pkgerrors.NewAppError(pkgerrors.ModuleSales, "INVALID_REFUND", "قيمة الاسترداد غير صالحة", "لا توجد قيمة متبقية للفاتورة", "refund")
		}

		refundAmount := domain.Amount((sale.Total.Cents() * itemShareCents) / remAllCents)
		if refundAmount > sale.Total {
			refundAmount = sale.Total
		}
		if refundAmount.IsNegative() || refundAmount.IsZero() {
			return pkgerrors.NewAppError(
				pkgerrors.ModuleSales,
				"INVALID_REFUND",
				"قيمة الاسترداد غير صالحة",
				"لا يمكن استرداد أكثر مما دفعه العميل لهذا المنتج",
				"refund",
			)
		}

		allItems, err := txSaleRepo.GetSaleItems(saleID)
		if err != nil {
			return err
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
				if sale.SplitDetails != nil && sale.Total > 0 {
					creditAmount := sale.SplitDetails["credit"]
					if creditAmount > 0 {
						creditShare := domain.Amount((int64(refundAmount) * int64(creditAmount)) / int64(sale.Total))
						if creditShare > 0 {
							if err := txCustomerRepo.DecrementDebt(sale.CustomerID, creditShare); err != nil {
								return err
							}
						}
					}
				}
			}
		}

		if sale.PaymentMethod == "split" && sale.SplitDetails != nil && sale.Total > 0 {
			for method, amount := range sale.SplitDetails {
				if amount > 0 && method != "credit" {
					methodShare := domain.Amount((int64(refundAmount) * int64(amount)) / int64(sale.Total))
					if methodShare > 0 {
						refundPayment := domain.Payment{
							SaleID:     sale.ID,
							CustomerID: sale.CustomerID,
							Amount:     domain.Amount(-methodShare.Cents()),
							Method:     method,
							Timestamp:  time.Now().UnixMilli(),
							Note:       fmt.Sprintf("Partial Return: %.2f x %s", qtyToReturn, item.Name),
							StaffID:    sale.StaffID,
						}
						if err := txPaymentRepo.Create(&refundPayment); err != nil {
							return err
						}
					}
				}
			}
		} else {
			refundPayment := domain.Payment{
				SaleID:     sale.ID,
				CustomerID: sale.CustomerID,
				Amount:     domain.Amount(-refundAmount.Cents()),
				Method:     sale.PaymentMethod,
				Timestamp:  time.Now().UnixMilli(),
				Note:       fmt.Sprintf("Partial Return: %.2f x %s", qtyToReturn, item.Name),
				StaffID:    sale.StaffID,
			}
			if err := txPaymentRepo.Create(&refundPayment); err != nil {
				return err
			}
		}

		if refundAmount > 0 {
			cashRefund := domain.Zero()
			if sale.PaymentMethod == "cash" {
				cashRefund = refundAmount
			} else if sale.PaymentMethod == "split" && sale.SplitDetails != nil && sale.Total > 0 {
				cashAmount := sale.SplitDetails["cash"]
				if cashAmount > 0 {
					cashRefund = domain.Amount((int64(refundAmount) * int64(cashAmount)) / int64(sale.Total))
				}
			}
			if err := txShiftRepo.UpdateShiftRefunds(refundAmount, cashRefund, false); err != nil {
				return fmt.Errorf("%s: %w", i18n.GetMessage("SALE_PROCESS_FAILED", ""), err)
			}
		}

		// allItems already fetched above
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

		var refundVat domain.Amount
		if sale.Total > 0 && sale.VAT > 0 {
			refundVat = domain.Amount((sale.VAT.Cents() * refundAmount.Cents()) / sale.Total.Cents())
		}
		sale.Total = sale.Total.Sub(refundAmount)
		sale.Subtotal = sale.Subtotal.Sub(refundAmount.Sub(refundVat))
		sale.VAT = sale.VAT.Sub(refundVat)

		if err := txSaleRepo.Update(sale); err != nil {
			return err
		}

		_ = s.auditRepo.WithTx(tx).Log(&domain.AuditLog{
			StaffID:  sale.StaffID,
			Action:   "RETURN_PARTIAL",
			Entity:   "Sale",
			EntityID: sale.ID,
			Details:  fmt.Sprintf("تم استرجاع كمية %.2f من المنتج %s", qtyToReturn, item.Name),
		})

		return nil
	})
	if err == nil && s.productService != nil {
		s.productService.ClearCache()
	}
	return err
}

// saleRemainingLegs computes the outstanding amount of each split-payment leg
// (cash, card, credit) after prior partial returns. Partial returns reduce
// sale.Total proportionally, so each leg is scaled by (sale.Total / originalTotal).
// The truncation remainder is allocated to the credit leg so all legs sum exactly
// to the remaining invoice total.
func saleRemainingLegs(sale *domain.Sale) map[string]domain.Amount {
	remaining := make(map[string]domain.Amount)
	if sale == nil || sale.SplitDetails == nil || len(sale.SplitDetails) == 0 {
		return remaining
	}

	var originalTotal domain.Amount
	for _, amount := range sale.SplitDetails {
		originalTotal = originalTotal.Add(amount)
	}
	if originalTotal <= 0 {
		return remaining
	}

	for method, amount := range sale.SplitDetails {
		if amount <= 0 {
			continue
		}
		leg := domain.Amount((int64(sale.Total) * int64(amount)) / int64(originalTotal))
		if leg < 0 {
			leg = 0
		}
		if leg > amount {
			leg = amount
		}
		remaining[method] = leg
	}

	var allocated domain.Amount
	for _, v := range remaining {
		allocated = allocated.Add(v)
	}
	if diff := sale.Total.Sub(allocated); diff > 0 {
		if credit, ok := remaining["credit"]; ok {
			remaining["credit"] = credit.Add(diff)
		} else {
			remaining["cash"] = remaining["cash"].Add(diff)
		}
	}

	return remaining
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

func (s *saleService) ParkSale(itemsJSON string, customerName string, customerID string, note string, total domain.Amount, itemsCount float64) (*domain.ParkedSale, error) {
	parked := domain.ParkedSale{
		ItemsJSON:    itemsJSON,
		CustomerName: customerName,
		CustomerID:   customerID,
		Note:         note,
		Total:        total,
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

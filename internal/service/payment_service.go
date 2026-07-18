package service

import (
	"encoding/json"
	"fmt"
	"sort"
	"strings"
	"time"

	"beidar-desktop/internal/core/domain"
	pkgerrors "beidar-desktop/pkg/errors"
	"beidar-desktop/pkg/i18n"
	"beidar-desktop/pkg/logger"
)

type paymentService struct {
	paymentRepo     domain.PaymentRepository
	customerRepo    domain.CustomerRepository
	saleRepo        domain.SaleRepository
	shiftRepo       domain.ShiftRepository
	preferencesRepo domain.PreferencesRepository
}

// NewPaymentService creates a new instance of domain.PaymentService
func NewPaymentService(
	paymentRepo domain.PaymentRepository,
	customerRepo domain.CustomerRepository,
	saleRepo domain.SaleRepository,
	shiftRepo domain.ShiftRepository,
	preferencesRepo domain.PreferencesRepository,
) domain.PaymentService {
	return &paymentService{
		paymentRepo:     paymentRepo,
		customerRepo:    customerRepo,
		saleRepo:        saleRepo,
		shiftRepo:       shiftRepo,
		preferencesRepo: preferencesRepo,
	}
}

func (s *paymentService) CreatePayment(payment domain.Payment) (*domain.Payment, error) {
	if payment.Amount <= 0 {
		return nil, pkgerrors.NewAppError(
			pkgerrors.ModulePayment,
			"INVALID_PAYMENT_AMOUNT",
			i18n.GetMessage("INVALID_PAYMENT_AMOUNT"),
			i18n.GetHint("INVALID_PAYMENT_AMOUNT"),
			"amount",
		)
	}

	payment.Timestamp = time.Now().UnixMilli()

	return &payment, s.paymentRepo.Transaction(func(tx domain.Tx) error {
		txPaymentRepo := s.paymentRepo.WithTx(tx)
		txCustomerRepo := s.customerRepo.WithTx(tx)
		txSaleRepo := s.saleRepo.WithTx(tx)

		if payment.CustomerID != "" {
			customer, err := txCustomerRepo.GetByID(payment.CustomerID)
			if err != nil {
				return pkgerrors.NewAppError(
					pkgerrors.ModulePayment,
					"PAYMENT_CUSTOMER_NOT_FOUND",
					i18n.GetMessage("PAYMENT_CUSTOMER_NOT_FOUND", payment.CustomerID),
					i18n.GetHint("PAYMENT_CUSTOMER_NOT_FOUND"),
					"customer_id",
				)
			}

			if customer.Debt >= 0 && payment.Amount > customer.Debt {
				isAcknowledged := strings.Contains(payment.Note, "[OVERPAY_OK]")
				if !isAcknowledged {
					return &pkgerrors.AppError{
						Module:  pkgerrors.ModulePayment,
						Code:    "PAYMENT_EXCEEDS_DEBT",
						Message: i18n.GetMessage("PAYMENT_EXCEEDS_DEBT", payment.Amount, customer.Debt),
						Hint:    i18n.GetMessage("PAYMENT_EXCEEDS_DEBT_HINT", payment.Amount-customer.Debt),
						Options: map[string]bool{"allowForce": true},
					}
				}
				payment.Note = strings.Replace(payment.Note, "[OVERPAY_OK]", "", 1)
				payment.Note = strings.TrimSpace(payment.Note)
			}
		}

		if payment.SaleID != "" {
			_, err := txSaleRepo.GetByID(payment.SaleID)
			if err != nil {
				return pkgerrors.NewAppError(
					pkgerrors.ModulePayment,
					"PAYMENT_SALE_NOT_FOUND",
					i18n.GetMessage("PAYMENT_SALE_NOT_FOUND", payment.SaleID),
					i18n.GetHint("PAYMENT_SALE_NOT_FOUND"),
					"sale_id",
				)
			}
		}

		if err := txPaymentRepo.Create(&payment); err != nil {
			return err
		}

		if payment.CustomerID != "" {
			if err := txCustomerRepo.DecrementDebt(payment.CustomerID, payment.Amount); err != nil {
				return err
			}
		}

		if payment.Method == "cash" {
			txShiftRepo := s.shiftRepo.WithTx(tx)
			requireShift := false
			if prefs, err := s.preferencesRepo.Get(); err == nil {
				requireShift = prefs.RequireShift
			}
			if err := txShiftRepo.UpdateShiftSales(0, payment.Amount, requireShift); err != nil {
				return err
			}
		}

		logger.LogPayment("CREATED", payment.ID, payment.Amount.Float(), payment.CustomerID)

		return nil
	})
}

func (s *paymentService) GetPaymentsBySale(saleID string) ([]domain.Payment, error) {
	return s.paymentRepo.GetPaymentsBySale(saleID)
}

func (s *paymentService) GetPaymentsByCustomer(customerID string) ([]domain.Payment, error) {
	return s.paymentRepo.GetPaymentsByCustomer(customerID)
}

func (s *paymentService) DeletePayment(id uint) error {
	return s.paymentRepo.Transaction(func(tx domain.Tx) error {
		txPaymentRepo := s.paymentRepo.WithTx(tx)
		txCustomerRepo := s.customerRepo.WithTx(tx)

		payment, err := txPaymentRepo.GetByID(id)
		if err != nil {
			return pkgerrors.NewAppError(
				pkgerrors.ModulePayment,
				"PAYMENT_NOT_FOUND",
				i18n.GetMessage("PAYMENT_NOT_FOUND", id),
				i18n.GetHint("PAYMENT_NOT_FOUND"),
				"id",
			)
		}

		isInstallmentPayment := payment.SaleID != "" && len(payment.Note) > 0 &&
			(strings.Contains(payment.Note, "قسط") || payment.InstIndex >= 0 && strings.Contains(payment.Note, "قسط رقم"))
		if isInstallmentPayment {
			return pkgerrors.NewAppError(
				pkgerrors.ModulePayment,
				"CANNOT_DELETE_INSTALLMENT_PAYMENT",
				i18n.GetMessage("CANNOT_DELETE_INSTALLMENT_PAYMENT"),
				i18n.GetHint("CANNOT_DELETE_INSTALLMENT_PAYMENT"),
				"id",
			)
		}

		if payment.CustomerID != "" {
			if err := txCustomerRepo.DecrementDebt(payment.CustomerID, -payment.Amount); err != nil {
				return err
			}
		}

		return txPaymentRepo.Delete(id)
	})
}

func (s *paymentService) PayInstallment(saleID string, installmentIndex int, amount domain.Amount, method string) error {
	if amount <= 0 {
		return pkgerrors.NewAppError(
			pkgerrors.ModulePayment,
			"INVALID_PAYMENT_AMOUNT",
			i18n.GetMessage("INVALID_PAYMENT_AMOUNT"),
			i18n.GetHint("INVALID_PAYMENT_AMOUNT"),
			"amount",
		)
	}

	return s.paymentRepo.Transaction(func(tx domain.Tx) error {
		txPaymentRepo := s.paymentRepo.WithTx(tx)
		txCustomerRepo := s.customerRepo.WithTx(tx)
		txSaleRepo := s.saleRepo.WithTx(tx)

		sale, err := txSaleRepo.GetByID(saleID)
		if err != nil {
			return pkgerrors.NewAppError(
				pkgerrors.ModulePayment,
				"PAYMENT_SALE_NOT_FOUND",
				i18n.GetMessage("PAYMENT_SALE_NOT_FOUND", saleID),
				i18n.GetHint("PAYMENT_SALE_NOT_FOUND"),
				"sale_id",
			)
		}

		if sale.InstallmentPlan == nil {
			return pkgerrors.NewAppError(
				pkgerrors.ModulePayment,
				"NO_INSTALLMENT_PLAN",
				i18n.GetMessage("NO_INSTALLMENT_PLAN"),
				i18n.GetHint("NO_INSTALLMENT_PLAN"),
				"installment_plan",
			)
		}

		if installmentIndex < 0 || installmentIndex >= len(sale.InstallmentPlan.Schedule) {
			return pkgerrors.NewAppError(
				pkgerrors.ModulePayment,
				"INVALID_INSTALLMENT_INDEX",
				i18n.GetMessage("INVALID_INSTALLMENT_INDEX", installmentIndex+1, len(sale.InstallmentPlan.Schedule)),
				i18n.GetHint("INVALID_INSTALLMENT_INDEX"),
				"installment_index",
			)
		}

		if sale.InstallmentPlan.Schedule[installmentIndex].Status == "paid" {
			return pkgerrors.NewAppError(
				pkgerrors.ModulePayment,
				"INSTALLMENT_ALREADY_PAID",
				i18n.GetMessage("INSTALLMENT_ALREADY_PAID", installmentIndex),
				i18n.GetHint("INSTALLMENT_ALREADY_PAID"),
				"status",
			)
		}

		requiredAmount := sale.InstallmentPlan.Schedule[installmentIndex].Amount
		if amount != requiredAmount {
			return pkgerrors.NewAppError(
				pkgerrors.ModulePayment,
				"EXACT_AMOUNT_REQUIRED",
				i18n.GetMessage("EXACT_AMOUNT_REQUIRED", requiredAmount.Float()),
				i18n.GetHint("EXACT_AMOUNT_REQUIRED"),
				"amount",
			)
		}

		sale.InstallmentPlan.Schedule[installmentIndex].Status = "paid"
		sale.InstallmentPlan.Schedule[installmentIndex].PaidAt = time.Now().Unix()

		allPaid := true
		for _, inst := range sale.InstallmentPlan.Schedule {
			if inst.Status != "paid" {
				allPaid = false
				break
			}
		}
		if allPaid {
			sale.Status = "paid"
		}

		planJSON, err := json.Marshal(sale.InstallmentPlan)
		if err != nil {
			return fmt.Errorf("failed to marshal installment plan: %w", err)
		}

		if err := txSaleRepo.Update(sale); err != nil {
			return err
		}

		if err := txSaleRepo.UpdateSaleInstallmentPlan(sale.ID, string(planJSON), sale.Status); err != nil {
			return err
		}

		payment := domain.Payment{
			SaleID:     saleID,
			CustomerID: sale.CustomerID,
			Amount:     amount,
			Method:     method,
			InstIndex:  installmentIndex,
			Timestamp:  time.Now().UnixMilli(),
			Note:       i18n.GetMessage("INSTALLMENT_NOTE", installmentIndex+1),
		}
		if err := txPaymentRepo.Create(&payment); err != nil {
			return err
		}

		if sale.CustomerID != "" {
			if err := txCustomerRepo.DecrementInstallmentDebt(sale.CustomerID, amount); err != nil {
				return err
			}
		}

		if method == "cash" {
			txShiftRepo := s.shiftRepo.WithTx(tx)
			requireShift := false
			if prefs, err := s.preferencesRepo.Get(); err == nil {
				requireShift = prefs.RequireShift
			}
			if err := txShiftRepo.UpdateShiftSales(0, amount, requireShift); err != nil {
				return err
			}
		}

		return nil
	})
}

func (s *paymentService) GetCustomerInstallments(customerID string) ([]domain.Sale, error) {
	// Let's implement directly inside repository or use a simple raw DB query?
	// To keep Clean Architecture perfect, we should add a method GetCustomerInstallments in SaleRepository
	// Or we can query it using a generic method if needed. Let's see: the repository layer did not have this,
	// but we can query it directly since we have DB. But wait! Repository layer should have the query.
	// Let's add it to SaleRepository or run it from repository.DB.
	// The best clean way is to let repository layer implement it. Since we haven't added it to SaleRepository interface,
	// let's update SaleRepository interface with GetCustomerInstallments.
	// Wait, we can query it here using GORM, but that violates "repository layer only communicates with Gorm".
	// Let's add a method to SaleRepository!
	return s.saleRepo.GetCustomerInstallments(customerID)
}

func (s *paymentService) GetInstallmentSummary(saleID string) (total int, paid int, remaining domain.Amount, err error) {
	sale, err := s.saleRepo.GetByID(saleID)
	if err != nil {
		return 0, 0, domain.Zero(), pkgerrors.NewAppError(
			pkgerrors.ModulePayment,
			"PAYMENT_SALE_NOT_FOUND",
			i18n.GetMessage("PAYMENT_SALE_NOT_FOUND", saleID),
			i18n.GetHint("PAYMENT_SALE_NOT_FOUND"),
			"sale_id",
		)
	}

	if sale.InstallmentPlan == nil {
		return 0, 0, domain.Zero(), nil
	}

	total = len(sale.InstallmentPlan.Schedule)
	for _, inst := range sale.InstallmentPlan.Schedule {
		if inst.Status == "paid" {
			paid++
		} else {
			remaining = remaining.Add(inst.Amount)
		}
	}

	return total, paid, remaining, nil
}

func (s *paymentService) CalculateInstallmentPlan(total, downPayment domain.Amount, months int) (*domain.InstallmentPlan, error) {
	if months <= 0 {
		return nil, fmt.Errorf("عدد الأشهر يجب أن يكون أكبر من صفر")
	}

	if downPayment > total {
		return nil, fmt.Errorf("الدفعة المقدمة أكبر من الإجمالي")
	}

	remaining := total - downPayment // cents
	unit := domain.Amount(25000)     // 250 IQD in cents

	rawPerMonth := remaining / domain.Amount(months)         // integer division (truncates toward zero)
	roundedBase := rawPerMonth.RoundToNearest(unit)          // floor to nearest 25000 cents
	
	if roundedBase <= 0 {
		roundedBase = rawPerMonth
	}

	schedule := make([]domain.Installment, months)

	for i := 0; i < months; i++ {
		now := time.Now()
		dueDate := now.AddDate(0, i+1, 0).Format("2006-01-02")

		var amount domain.Amount
		if i == months-1 {
			// Last installment gets the remainder so the sum equals remaining
			amount = remaining - roundedBase*domain.Amount(months-1)
		} else {
			amount = roundedBase
		}

		schedule[i] = domain.Installment{
			Number:  i + 1,
			DueDate: dueDate,
			Amount:  amount,
			Status:  "pending",
		}
	}

	return &domain.InstallmentPlan{
		TotalAmount: total,
		DownPayment: downPayment,
		Months:      months,
		StartDate:   time.Now().Format("2006-01-02"),
		Schedule:    schedule,
	}, nil
}

func (s *paymentService) GetInstallmentAlertSummary() (*domain.InstallmentAlertSummary, error) {
	sales, err := s.saleRepo.GetInstallmentSales()
	if err != nil {
		return nil, fmt.Errorf("failed to fetch installment sales: %w", err)
	}

	// Extract unique customer IDs from installment sales
	custIDMap := make(map[string]bool)
	for _, sale := range sales {
		if sale.CustomerID != "" {
			custIDMap[sale.CustomerID] = true
		}
	}
	custIDs := make([]string, 0, len(custIDMap))
	for id := range custIDMap {
		custIDs = append(custIDs, id)
	}

	customers, err := s.customerRepo.GetByIDs(custIDs)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch installment customers: %w", err)
	}

	customerMap := make(map[string]domain.Customer)
	for _, c := range customers {
		customerMap[c.ID] = c
	}

	var totalOverdue int64
	var totalAmount domain.Amount
	byDay := map[string]int64{
		"1-7":  0,
		"8-30": 0,
		"30+":  0,
	}

	alerts := []domain.InstallmentAlert{}
	customerOverdueDebt := make(map[string]domain.Amount)
	customerOverdueCount := make(map[string]int)

	today := time.Now().Truncate(24 * time.Hour)

	for _, sale := range sales {
		if sale.InstallmentPlan == nil {
			continue
		}

		var totalDueForSale domain.Amount
		for _, inst := range sale.InstallmentPlan.Schedule {
			if inst.Status != "paid" {
				totalDueForSale = totalDueForSale.Add(inst.Amount)
			}
		}

		for _, inst := range sale.InstallmentPlan.Schedule {
			if inst.Status == "paid" {
				continue
			}

			dueTime, err := time.Parse("2006-01-02", inst.DueDate)
			if err != nil {
				continue
			}

			if dueTime.Before(today) {
				daysOverdue := int(today.Sub(dueTime).Hours() / 24)
				if daysOverdue <= 0 {
					continue
				}

				totalOverdue++
				totalAmount = totalAmount.Add(inst.Amount)

				if daysOverdue <= 7 {
					byDay["1-7"]++
				} else if daysOverdue <= 30 {
					byDay["8-30"]++
				} else {
					byDay["30+"]++
				}

				phone := ""
				custName := sale.CustomerName
				if c, ok := customerMap[sale.CustomerID]; ok {
					phone = c.Phone
					if custName == "" {
						custName = c.Name
					}
				}

				alerts = append(alerts, domain.InstallmentAlert{
					SaleID:        sale.ID,
					CustomerID:    sale.CustomerID,
					CustomerName:  custName,
					CustomerPhone: phone,
					InstNumber:    inst.Number,
					DueDate:       inst.DueDate,
					Amount:        inst.Amount,
					DaysOverdue:   daysOverdue,
					TotalDue:      totalDueForSale,
				})

				customerOverdueDebt[sale.CustomerID] = customerOverdueDebt[sale.CustomerID].Add(inst.Amount)
				customerOverdueCount[sale.CustomerID]++
			}
		}
	}

	topCustomers := []domain.OverdueCustomer{}
	for cID, debt := range customerOverdueDebt {
		name := ""
		if c, ok := customerMap[cID]; ok {
			name = c.Name
		}
		topCustomers = append(topCustomers, domain.OverdueCustomer{
			CustomerID:   cID,
			CustomerName: name,
			TotalDebt:    debt,
			OverdueCount: customerOverdueCount[cID],
		})
	}

	sort.Slice(topCustomers, func(i, j int) bool {
		return topCustomers[i].TotalDebt > topCustomers[j].TotalDebt
	})

	if len(topCustomers) > 5 {
		topCustomers = topCustomers[:5]
	}

	return &domain.InstallmentAlertSummary{
		TotalOverdue: totalOverdue,
		TotalAmount:  totalAmount,
		ByDay:        byDay,
		TopCustomers: topCustomers,
		Alerts:       alerts,
	}, nil
}


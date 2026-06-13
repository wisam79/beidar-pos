package service

import (
	"beidar-desktop/internal/core/domain"
	pkgerrors "beidar-desktop/pkg/errors"
	"beidar-desktop/pkg/i18n"
	"beidar-desktop/pkg/logger"
	"errors"
	"regexp"

	"github.com/google/uuid"
)

type crmService struct {
	customerRepo domain.CustomerRepository
	supplierRepo domain.SupplierRepository
	productRepo  domain.ProductRepository
}

// NewCRMService creates a new instance of domain.CRMService
func NewCRMService(
	customerRepo domain.CustomerRepository,
	supplierRepo domain.SupplierRepository,
	productRepo domain.ProductRepository,
) domain.CRMService {
	return &crmService{
		customerRepo: customerRepo,
		supplierRepo: supplierRepo,
		productRepo:  productRepo,
	}
}

func (s *crmService) GetCustomers() ([]domain.Customer, error) {
	return s.customerRepo.GetAll()
}

func (s *crmService) SearchCustomers(query string) ([]domain.Customer, error) {
	return s.customerRepo.Search(query)
}

func (s *crmService) SaveCustomer(c domain.Customer) error {
	if len(c.Name) < 2 {
		return pkgerrors.NewAppError(
			pkgerrors.ModuleCustomer,
			"INVALID_CUSTOMER_NAME",
			i18n.GetMessage("INVALID_CUSTOMER_NAME"),
			i18n.GetHint("INVALID_CUSTOMER_NAME"),
			"name",
		)
	}

	if c.Phone != "" {
		phoneRegex := regexp.MustCompile(`^[0-9]{10,15}$`)
		if !phoneRegex.MatchString(c.Phone) {
			return pkgerrors.NewAppError(
				pkgerrors.ModuleCustomer,
				"INVALID_CUSTOMER_PHONE",
				i18n.GetMessage("INVALID_CUSTOMER_PHONE", c.Phone),
				i18n.GetHint("INVALID_CUSTOMER_PHONE"),
				"phone",
			)
		}

		existing, err := s.customerRepo.GetByPhone(c.Phone)
		if err == nil && existing != nil && existing.ID != c.ID {
			return pkgerrors.NewAppError(
				pkgerrors.ModuleCustomer,
				"DUPLICATE_CUSTOMER_PHONE",
				i18n.GetMessage("DUPLICATE_CUSTOMER_PHONE", c.Phone),
				i18n.GetHint("DUPLICATE_CUSTOMER_PHONE"),
				"phone",
			)
		}
	}

	if c.ID == "" {
		c.ID = uuid.New().String()
		if c.Debt != 0 {
			return pkgerrors.NewAppError(
				pkgerrors.ModuleCustomer,
				"INITIAL_DEBT",
				i18n.GetMessage("INITIAL_DEBT"),
				i18n.GetHint("INITIAL_DEBT"),
				"debt",
			)
		}

		if err := s.customerRepo.Create(&c); err != nil {
			return errors.New(i18n.GetMessage("CREATE_CUSTOMER_FAILED", err.Error()))
		}
		logger.LogCustomer("CREATED", c.ID, c.Name)
		return nil
	}

	// Update existing - check if customer exists first
	_, err := s.customerRepo.GetByID(c.ID)
	if err != nil {
		return pkgerrors.NewAppError(
			pkgerrors.ModuleCustomer,
			"CUSTOMER_NOT_FOUND",
			i18n.GetMessage("CUSTOMER_NOT_FOUND"),
			i18n.GetHint("CUSTOMER_NOT_FOUND"),
			"id",
		)
	}

	if err := s.customerRepo.Update(&c); err != nil {
		return errors.New(i18n.GetMessage("UPDATE_CUSTOMER_FAILED", err.Error()))
	}
	logger.LogCustomer("UPDATED", c.ID, c.Name)
	return nil
}

func (s *crmService) DeleteCustomer(id string, force bool) error {
	customer, err := s.customerRepo.GetByID(id)
	if err != nil {
		return pkgerrors.NewAppError(
			pkgerrors.ModuleCustomer,
			"CUSTOMER_NOT_FOUND",
			i18n.GetMessage("CUSTOMER_NOT_FOUND"),
			i18n.GetHint("CUSTOMER_NOT_FOUND"),
			"id",
		)
	}

	activeInstallments, err := s.customerRepo.GetActiveInstallmentsCount(id)
	if err != nil {
		return err
	}
	if activeInstallments > 0 {
		return &pkgerrors.AppError{
			Module:  pkgerrors.ModuleCustomer,
			Code:    "CUSTOMER_HAS_ACTIVE_INSTALLMENTS",
			Message: i18n.GetMessage("CUSTOMER_HAS_ACTIVE_INSTALLMENTS", activeInstallments),
			Hint:    i18n.GetHint("CUSTOMER_HAS_ACTIVE_INSTALLMENTS"),
		}
	}

	if customer.Debt > 0 {
		if !force {
			return &pkgerrors.AppError{
				Module:  pkgerrors.ModuleCustomer,
				Code:    "CUSTOMER_HAS_DEBT",
				Message: i18n.GetMessage("CUSTOMER_HAS_DEBT", customer.Debt),
				Hint:    i18n.GetMessage("CUSTOMER_HAS_DEBT_FORCE_HINT"),
				Options: map[string]bool{"allowForce": true},
			}
		}
		logger.Logger.Warn("CRM", i18n.GetMessage("FORCE_DELETE_CUSTOMER_LOG", customer.Name, customer.Debt))
	}

	if err := s.customerRepo.Delete(id); err != nil {
		return errors.New(i18n.GetMessage("DELETE_CUSTOMER_FAILED", err.Error()))
	}
	logger.LogCustomer("DELETED", customer.ID, customer.Name)
	return nil
}

func (s *crmService) GetSuppliers() ([]domain.Supplier, error) {
	return s.supplierRepo.GetAll()
}

func (s *crmService) SaveSupplier(sup domain.Supplier) error {
	if len(sup.Name) < 2 {
		return pkgerrors.NewAppError(
			pkgerrors.ModuleProduct,
			"INVALID_SUPPLIER_NAME",
			"اسم المورد مطلوب (على الأقل حرفين)",
			"أدخل اسماً واضحاً للمورد",
			"name",
		)
	}

	if sup.Phone != "" {
		phoneRegex := regexp.MustCompile(`^[0-9]{10,15}$`)
		if !phoneRegex.MatchString(sup.Phone) {
			return pkgerrors.NewAppError(
				pkgerrors.ModuleProduct,
				"INVALID_SUPPLIER_PHONE",
				i18n.GetMessage("INVALID_SUPPLIER_PHONE"),
				"تحقق من رقم الهاتف",
				"phone",
			)
		}
	}

	if sup.ID == "" {
		sup.ID = uuid.New().String()
		return s.supplierRepo.Create(&sup)
	}
	return s.supplierRepo.Update(&sup)
}

func (s *crmService) DeleteSupplier(id string, force bool) error {
	supplier, err := s.supplierRepo.GetByID(id)
	if err != nil {
		return pkgerrors.NewAppError(
			pkgerrors.ModuleProduct,
			"SUPPLIER_NOT_FOUND",
			i18n.GetMessage("SUPPLIER_NOT_FOUND"),
			"",
			"id",
		)
	}

	productCount, err := s.productRepo.CountBySupplier(supplier.Name)
	if err != nil {
		return err
	}

	if productCount > 0 {
		if !force {
			return &pkgerrors.AppError{
				Module:  pkgerrors.ModuleProduct,
				Code:    "SUPPLIER_HAS_PRODUCTS",
				Message: i18n.GetMessage("SUPPLIER_HAS_PRODUCTS", productCount),
				Hint:    i18n.GetHint("SUPPLIER_HAS_PRODUCTS"),
				Options: map[string]bool{"allowForce": true},
			}
		}

		if err := s.productRepo.UnlinkSupplier(supplier.Name); err != nil {
			return err
		}
	}

	return s.supplierRepo.Delete(id)
}

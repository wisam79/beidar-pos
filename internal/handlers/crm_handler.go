package handlers

import (
	"beidar-desktop/internal/core/domain"
	"beidar-desktop/internal/network"
	"beidar-desktop/pkg/auth"
	"context"
	"strings"
)

type CRMHandler struct {
	ctx        context.Context
	crmService domain.CRMService
	lanService network.LanService
}

func NewCRMHandler(crmService domain.CRMService, lanService network.LanService) *CRMHandler {
	return &CRMHandler{
		crmService: crmService,
		lanService: lanService,
	}
}

func (h *CRMHandler) Startup(ctx context.Context) {
	h.ctx = ctx
}

func (h *CRMHandler) GetCustomers() ([]domain.Customer, error) {
	if err := auth.Require(); err != nil {
		return nil, err
	}
	if h.lanService != nil && h.lanService.IsClientMode() {
		var result []domain.Customer
		err := h.lanService.RemoteGet("/api/customers", &result)
		return result, err
	}
	return h.crmService.GetCustomers()
}

func (h *CRMHandler) SearchCustomers(query string) ([]domain.Customer, error) {
	if err := auth.Require(); err != nil {
		return nil, err
	}
	// Remote server doesn't have a search customer endpoint, so filter the list locally
	if h.lanService != nil && h.lanService.IsClientMode() {
		customers, err := h.GetCustomers()
		if err != nil {
			return nil, err
		}
		
		var filtered []domain.Customer
		queryLower := strings.ToLower(query)
		for _, c := range customers {
			if strings.Contains(strings.ToLower(c.Name), queryLower) ||
				strings.Contains(strings.ToLower(c.Phone), queryLower) ||
				strings.Contains(strings.ToLower(c.Notes), queryLower) {
				filtered = append(filtered, c)
			}
		}
		return filtered, nil
	}
	return h.crmService.SearchCustomers(query)
}

func (h *CRMHandler) SaveCustomer(c domain.Customer) error {
	if err := auth.RequirePermission(auth.PermCustomers); err != nil {
		return err
	}
	if h.lanService != nil && h.lanService.IsClientMode() {
		return h.lanService.RemotePost("/api/customers", c, nil)
	}
	return h.crmService.SaveCustomer(c)
}

func (h *CRMHandler) DeleteCustomer(id string, force bool) error {
	if err := auth.RequirePermission(auth.PermCustomers); err != nil {
		return err
	}
	if h.lanService != nil && h.lanService.IsClientMode() {
		return h.lanService.RemoteDelete("/api/customers?id=" + id)
	}
	return h.crmService.DeleteCustomer(id, force)
}

func (h *CRMHandler) GetSuppliers() ([]domain.Supplier, error) {
	if err := auth.Require(); err != nil {
		return nil, err
	}
	if h.lanService != nil && h.lanService.IsClientMode() {
		var result []domain.Supplier
		err := h.lanService.RemoteGet("/api/suppliers", &result)
		return result, err
	}
	return h.crmService.GetSuppliers()
}

func (h *CRMHandler) SaveSupplier(s domain.Supplier) error {
	if err := auth.RequirePermission(auth.PermFinance); err != nil {
		return err
	}
	if h.lanService != nil && h.lanService.IsClientMode() {
		return h.lanService.RemotePost("/api/suppliers", s, nil)
	}
	return h.crmService.SaveSupplier(s)
}

func (h *CRMHandler) DeleteSupplier(id string, force bool) error {
	if err := auth.RequirePermission(auth.PermFinance); err != nil {
		return err
	}
	if h.lanService != nil && h.lanService.IsClientMode() {
		return h.lanService.RemoteDelete("/api/suppliers?id=" + id)
	}
	return h.crmService.DeleteSupplier(id, force)
}

package handlers

import (
	"beidar-desktop/internal/core/domain"
	"beidar-desktop/internal/network"
	"beidar-desktop/pkg/auth"
	"context"
	"net/url"
)

type SaleHandler struct {
	ctx        context.Context
	saleService domain.SaleService
	lanService  network.LanService
}

func NewSaleHandler(saleService domain.SaleService, lanService network.LanService) *SaleHandler {
	return &SaleHandler{
		saleService: saleService,
		lanService:  lanService,
	}
}

func (h *SaleHandler) Startup(ctx context.Context) {
	h.ctx = ctx
}

func (h *SaleHandler) GetSales(page int, pageSize int, search string, statusFilter string, dateFilter string) (*domain.PaginatedSales, error) {
	if err := auth.Require(); err != nil {
		return nil, err
	}
	if h.lanService != nil && h.lanService.IsClientMode() {
		var result domain.PaginatedSales
		err := h.lanService.RemoteGet("/api/sales", &result)
		return &result, err
	}
	return h.saleService.GetSales(page, pageSize, search, statusFilter, dateFilter)
}

func (h *SaleHandler) GetSale(id string) (*domain.Sale, error) {
	if err := auth.Require(); err != nil {
		return nil, err
	}
	// Filter remote sales list if client mode
	if h.lanService != nil && h.lanService.IsClientMode() {
		var sale domain.Sale
		err := h.lanService.RemoteGet("/api/sales?id="+url.QueryEscape(id), &sale)
		if err != nil {
			return nil, err
		}
		return &sale, nil
	}
	return h.saleService.GetSale(id)
}

func (h *SaleHandler) ProcessSale(sale domain.Sale) error {
	if err := auth.RequirePermission(auth.PermSales); err != nil {
		return err
	}
	if h.lanService != nil && h.lanService.IsClientMode() {
		return h.lanService.RemotePost("/api/sales/process", sale, nil)
	}
	return h.saleService.ProcessSale(&sale)
}

func (h *SaleHandler) ReturnSale(id string) error {
	if err := auth.RequirePermission(auth.PermDeleteSales); err != nil {
		return err
	}
	return h.saleService.ReturnSale(id)
}

func (h *SaleHandler) ReturnSalePartial(saleID string, productID string, qtyToReturn float64) error {
	if err := auth.RequirePermission(auth.PermDeleteSales); err != nil {
		return err
	}
	return h.saleService.ReturnSalePartial(saleID, productID, qtyToReturn)
}

func (h *SaleHandler) GetSaleItems(saleID string) ([]domain.SaleItem, error) {
	if err := auth.Require(); err != nil {
		return nil, err
	}
	// Remote server sends sale items embedded in domain.Sale.Items.
	// So we can find the sale locally or remotely and return items.
	if h.lanService != nil && h.lanService.IsClientMode() {
		sale, err := h.GetSale(saleID)
		if err != nil || sale == nil {
			return nil, err
		}
		return sale.Items, nil
	}
	return h.saleService.GetSaleItems(saleID)
}

func (h *SaleHandler) DeleteSale(id string) error {
	if err := auth.RequirePermission(auth.PermDeleteSales); err != nil {
		return err
	}
	if h.lanService != nil && h.lanService.IsClientMode() {
		return h.lanService.RemoteDelete("/api/sales?id=" + id)
	}
	return h.saleService.DeleteSale(id)
}

func (h *SaleHandler) ParkSale(itemsJSON string, customerName string, customerID string, note string, total domain.Amount, itemsCount float64) (*domain.ParkedSale, error) {
	if err := auth.RequirePermission(auth.PermSales); err != nil {
		return nil, err
	}
	return h.saleService.ParkSale(itemsJSON, customerName, customerID, note, total, itemsCount)
}

func (h *SaleHandler) GetParkedSales() ([]domain.ParkedSale, error) {
	if err := auth.Require(); err != nil {
		return nil, err
	}
	return h.saleService.GetParkedSales()
}

func (h *SaleHandler) GetParkedSalesCount() (int, error) {
	if err := auth.Require(); err != nil {
		return 0, err
	}
	return h.saleService.GetParkedSalesCount()
}

func (h *SaleHandler) RetrieveParkedSale(id uint) (*domain.ParkedSale, error) {
	if err := auth.RequirePermission(auth.PermSales); err != nil {
		return nil, err
	}
	return h.saleService.RetrieveParkedSale(id)
}

func (h *SaleHandler) DeleteParkedSale(id uint) error {
	if err := auth.RequirePermission(auth.PermSales); err != nil {
		return err
	}
	return h.saleService.DeleteParkedSale(id)
}

func (h *SaleHandler) GetInstallmentSales() ([]domain.Sale, error) {
	if err := auth.Require(); err != nil {
		return nil, err
	}
	return h.saleService.GetInstallmentSales()
}

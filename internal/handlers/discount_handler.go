package handlers

import (
	"beidar-desktop/internal/core/domain"
	"beidar-desktop/internal/network"
	"beidar-desktop/internal/service"
	"context"
)

type DiscountHandler struct {
	ctx             context.Context
	discountService service.DiscountService
	lanService      network.LanService
}

func NewDiscountHandler(discountService service.DiscountService, lanService network.LanService) *DiscountHandler {
	return &DiscountHandler{
		discountService: discountService,
		lanService:      lanService,
	}
}

func (h *DiscountHandler) Startup(ctx context.Context) {
	h.ctx = ctx
}

func (h *DiscountHandler) GetAllDiscounts() ([]domain.Discount, error) {
	if h.lanService != nil && h.lanService.IsClientMode() {
		var result []domain.Discount
		err := h.lanService.RemoteGet("/api/discounts", &result)
		return result, err
	}
	return h.discountService.GetDiscounts()
}

func (h *DiscountHandler) GetActiveDiscounts() ([]domain.Discount, error) {
	if h.lanService != nil && h.lanService.IsClientMode() {
		var result []domain.Discount
		err := h.lanService.RemoteGet("/api/discounts/active", &result)
		return result, err
	}
	return h.discountService.GetActiveDiscounts()
}

func (h *DiscountHandler) GetDiscount(id string) (domain.Discount, error) {
	if h.lanService != nil && h.lanService.IsClientMode() {
		var result domain.Discount
		err := h.lanService.RemoteGet("/api/discounts/get?id="+id, &result)
		return result, err
	}
	d, err := h.discountService.GetDiscount(id)
	if err != nil {
		return domain.Discount{}, err
	}
	return *d, nil
}

func (h *DiscountHandler) CreateDiscount(d domain.Discount) (domain.Discount, error) {
	if h.lanService != nil && h.lanService.IsClientMode() {
		var result domain.Discount
		err := h.lanService.RemotePost("/api/discounts", d, &result)
		return result, err
	}
	res, err := h.discountService.CreateDiscount(d)
	if err != nil {
		return domain.Discount{}, err
	}
	return *res, nil
}

func (h *DiscountHandler) UpdateDiscount(d domain.Discount) error {
	if h.lanService != nil && h.lanService.IsClientMode() {
		return h.lanService.RemotePost("/api/discounts/update", d, nil)
	}
	return h.discountService.UpdateDiscount(d)
}

func (h *DiscountHandler) DeleteDiscount(id string) error {
	if h.lanService != nil && h.lanService.IsClientMode() {
		return h.lanService.RemoteDelete("/api/discounts?id=" + id)
	}
	return h.discountService.DeleteDiscount(id)
}

func (h *DiscountHandler) ToggleDiscountStatus(id string) error {
	if h.lanService != nil && h.lanService.IsClientMode() {
		return h.lanService.RemotePost("/api/discounts/toggle?id="+id, nil, nil)
	}
	return h.discountService.ToggleDiscountStatus(id)
}

func (h *DiscountHandler) ValidateCoupon(code string) (domain.Discount, error) {
	if h.lanService != nil && h.lanService.IsClientMode() {
		var result domain.Discount
		err := h.lanService.RemoteGet("/api/discounts/validate?code="+code, &result)
		return result, err
	}
	d, err := h.discountService.ValidateCoupon(code)
	if err != nil {
		return domain.Discount{}, err
	}
	return *d, nil
}

func (h *DiscountHandler) ApplyDiscount(id string) error {
	if h.lanService != nil && h.lanService.IsClientMode() {
		return h.lanService.RemotePost("/api/discounts/apply?id="+id, nil, nil)
	}
	return h.discountService.ApplyDiscount(id)
}

package handlers

import (
	"beidar-desktop/internal/core/domain"
	"beidar-desktop/internal/network"
	"beidar-desktop/pkg/auth"
	"context"
)

// ProductHandler struct to bind to Wails
type ProductHandler struct {
	ctx            context.Context
	productService domain.ProductService
	lanService     network.LanService
}

// NewProductHandler creates a new ProductHandler
func NewProductHandler(productService domain.ProductService, lanService network.LanService) *ProductHandler {
	return &ProductHandler{
		productService: productService,
		lanService:     lanService,
	}
}

// Startup is called at application startup
func (h *ProductHandler) Startup(ctx context.Context) {
	h.ctx = ctx
}

// GetAllProducts retrieves all products to be shown in the UI
func (h *ProductHandler) GetAllProducts() ([]domain.Product, error) {
	if err := auth.Require(); err != nil {
		return nil, err
	}
	if h.lanService != nil && h.lanService.IsClientMode() {
		type PaginatedProducts struct {
			Data  []domain.Product `json:"data"`
			Total int64            `json:"total"`
		}
		var result PaginatedProducts
		err := h.lanService.RemoteGet("/api/products", &result)
		return result.Data, err
	}
	return h.productService.GetAllProducts()
}

// GetProductByID retrieves a product by its ID
func (h *ProductHandler) GetProductByID(id string) (*domain.Product, error) {
	if err := auth.Require(); err != nil {
		return nil, err
	}
	if h.lanService != nil && h.lanService.IsClientMode() {
		var product domain.Product
		err := h.lanService.RemoteGet("/api/products/detail?id="+id, &product)
		if err != nil {
			return nil, err
		}
		return &product, nil
	}
	return h.productService.GetProductByID(id)
}

// CreateProduct adds a new product
func (h *ProductHandler) CreateProduct(product domain.Product) error {
	if err := auth.RequirePermission(auth.PermProducts); err != nil {
		return err
	}
	if h.lanService != nil && h.lanService.IsClientMode() {
		return h.lanService.RemotePost("/api/products", product, nil)
	}
	return h.productService.CreateProduct(&product)
}

// UpdateProduct updates an existing product
func (h *ProductHandler) UpdateProduct(product domain.Product) error {
	if err := auth.RequirePermission(auth.PermProducts); err != nil {
		return err
	}
	if h.lanService != nil && h.lanService.IsClientMode() {
		return h.lanService.RemotePost("/api/products", product, nil)
	}
	return h.productService.UpdateProduct(&product)
}

// DeleteProduct deletes a product
func (h *ProductHandler) DeleteProduct(id string) error {
	if err := auth.RequirePermission(auth.PermProducts); err != nil {
		return err
	}
	if h.lanService != nil && h.lanService.IsClientMode() {
		return h.lanService.RemoteDelete("/api/products?id=" + id)
	}
	return h.productService.DeleteProduct(id)
}

// SearchProducts searches for products by name or barcode
func (h *ProductHandler) SearchProducts(query string) ([]domain.Product, error) {
	if err := auth.Require(); err != nil {
		return nil, err
	}
	if h.lanService != nil && h.lanService.IsClientMode() {
		var result []domain.Product
		err := h.lanService.RemoteGet("/api/products/search?q="+query, &result)
		return result, err
	}
	return h.productService.SearchProducts(query)
}

func (h *ProductHandler) GetStockMovements() ([]domain.StockMovement, error) {
	if err := auth.Require(); err != nil {
		return nil, err
	}
	if h.lanService != nil && h.lanService.IsClientMode() {
		var result []domain.StockMovement
		err := h.lanService.RemoteGet("/api/stock/movements", &result)
		return result, err
	}
	return h.productService.GetStockMovements()
}

func (h *ProductHandler) LogStockMovement(productID string, productName string, movementType string, qty float64, reason string) error {
	if err := auth.RequirePermission(auth.PermInventory); err != nil {
		return err
	}
	if h.lanService != nil && h.lanService.IsClientMode() {
		return h.lanService.RemotePost("/api/stock/movements", map[string]interface{}{
			"productId":   productID,
			"productName": productName,
			"type":        movementType,
			"qty":         qty,
			"reason":      reason,
		}, nil)
	}
	return h.productService.LogStockMovement(productID, productName, movementType, qty, reason)
}


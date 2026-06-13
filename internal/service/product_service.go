package service

import (
	"beidar-desktop/internal/core/domain"
	"beidar-desktop/pkg/imagestore"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
)

type productService struct {
	repo       domain.ProductRepository
	cacheMu    sync.RWMutex
	cacheList  []domain.Product
	cacheMap   map[string]domain.Product
	lastUpdate time.Time
}

// NewProductService creates a new instance of domain.ProductService
func NewProductService(repo domain.ProductRepository) domain.ProductService {
	return &productService{
		repo:     repo,
		cacheMap: make(map[string]domain.Product),
	}
}

func (s *productService) ClearCache() {
	s.cacheMu.Lock()
	defer s.cacheMu.Unlock()
	s.cacheList = nil
	s.cacheMap = make(map[string]domain.Product)
	s.lastUpdate = time.Time{}
}

func (s *productService) GetAllProducts() ([]domain.Product, error) {
	s.cacheMu.RLock()
	if s.cacheList != nil && time.Since(s.lastUpdate) < 5*time.Minute {
		// Return a copy to prevent callers from modifying the cache slice directly
		products := make([]domain.Product, len(s.cacheList))
		copy(products, s.cacheList)
		s.cacheMu.RUnlock()
		return products, nil
	}
	s.cacheMu.RUnlock()

	products, err := s.repo.GetAll()
	if err != nil {
		return nil, fmt.Errorf("failed to get all products: %w", err)
	}

	s.cacheMu.Lock()
	s.cacheList = make([]domain.Product, len(products))
	copy(s.cacheList, products)
	s.cacheMap = make(map[string]domain.Product)
	for _, p := range products {
		s.cacheMap[p.ID] = p
	}
	s.lastUpdate = time.Now()
	s.cacheMu.Unlock()

	return products, nil
}

func (s *productService) GetProductByID(id string) (*domain.Product, error) {
	if id == "" {
		return nil, fmt.Errorf("معرف المنتج مطلوب")
	}

	s.cacheMu.RLock()
	if s.cacheMap != nil && len(s.cacheMap) > 0 && time.Since(s.lastUpdate) < 5*time.Minute {
		if prod, found := s.cacheMap[id]; found {
			prodCopy := prod
			s.cacheMu.RUnlock()
			return &prodCopy, nil
		}
	}
	s.cacheMu.RUnlock()

	prod, err := s.repo.GetByID(id)
	if err != nil {
		return nil, fmt.Errorf("failed to get product by ID: %w", err)
	}
	return prod, nil
}

func (s *productService) CreateProduct(product *domain.Product) error {
	if product.Name == "" {
		return fmt.Errorf("اسم المنتج مطلوب")
	}
	if product.Price < 0 {
		return fmt.Errorf("السعر يجب أن يكون رقماً موجباً")
	}

	if product.ID == "" {
		product.ID = "prod_" + uuid.New().String()
	}

	// Save image to filesystem if provided
	if product.Image != "" {
		filename, err := imagestore.SaveImageFromBase64(product.Image, product.ID)
		if err == nil && filename != "" {
			product.Image = filename
		}
	}

	err := s.repo.Create(product)
	if err != nil {
		return fmt.Errorf("failed to create product: %w", err)
	}
	s.ClearCache()
	return nil
}

func (s *productService) UpdateProduct(product *domain.Product) error {
	if product.ID == "" {
		return fmt.Errorf("معرف المنتج مطلوب للتحديث")
	}

	existing, err := s.repo.GetByID(product.ID)
	if err != nil {
		return fmt.Errorf("failed to get existing product for update: %w", err)
	}

	// Handle image update
	if product.Image != "" && product.Image != existing.Image {
		filename, err := imagestore.SaveImageFromBase64(product.Image, product.ID)
		if err == nil && filename != "" && filename != product.Image {
			// Delete old image if it is a local file
			if existing.Image != "" && strings.Contains(existing.Image, ".") {
				_ = imagestore.DeleteImage(existing.Image)
			}
			product.Image = filename
		}
	}

	err = s.repo.Update(product)
	if err != nil {
		return fmt.Errorf("failed to update product: %w", err)
	}
	s.ClearCache()
	return nil
}

func (s *productService) DeleteProduct(id string) error {
	if id == "" {
		return fmt.Errorf("معرف المنتج مطلوب للحذف")
	}

	product, err := s.repo.GetByID(id)
	if err != nil {
		return fmt.Errorf("failed to get product for deletion: %w", err)
	}

	// Clean up image file
	if product.Image != "" && strings.Contains(product.Image, ".") {
		_ = imagestore.DeleteImage(product.Image)
	}

	err = s.repo.Delete(id)
	if err != nil {
		return fmt.Errorf("failed to delete product: %w", err)
	}
	s.ClearCache()
	return nil
}

func (s *productService) SearchProducts(query string) ([]domain.Product, error) {
	s.cacheMu.RLock()
	if s.cacheList != nil && time.Since(s.lastUpdate) < 5*time.Minute {
		var results []domain.Product
		q := strings.ToLower(query)
		for _, p := range s.cacheList {
			if strings.Contains(strings.ToLower(p.Name), q) || strings.Contains(strings.ToLower(p.Barcode), q) {
				results = append(results, p)
			}
		}
		s.cacheMu.RUnlock()
		return results, nil
	}
	s.cacheMu.RUnlock()

	results, err := s.repo.Search(query)
	if err != nil {
		return nil, fmt.Errorf("failed to search products: %w", err)
	}
	return results, nil
}

func (s *productService) GetStockMovements() ([]domain.StockMovement, error) {
	movements, err := s.repo.GetStockMovements()
	if err != nil {
		return nil, fmt.Errorf("failed to get stock movements: %w", err)
	}
	return movements, nil
}

func (s *productService) LogStockMovement(productID string, productName string, movementType string, qty float64, reason string) error {
	m := &domain.StockMovement{
		ProductID:   productID,
		ProductName: productName,
		Type:        movementType,
		Qty:         qty,
		Reason:      reason,
		Timestamp:   time.Now().Unix(),
	}
	err := s.repo.CreateStockMovement(m)
	if err != nil {
		return fmt.Errorf("failed to log stock movement: %w", err)
	}
	return nil
}




package e2e

import (
	"beidar-desktop/internal/core/domain"
	"beidar-desktop/internal/testutil"

	"github.com/google/uuid"
)

// AdminUsername is the username of the default admin seeded by SeedDefaultAdmin.
const AdminUsername = "admin"

// newSaleID returns a fresh unique sale identifier.
func newSaleID() string {
	return uuid.New().String()
}

// NewProduct inserts a product via the harness DB. See testutil.NewProduct.
func (h *Harness) NewProduct(name string, price float64, stock float64) *domain.Product {
	return testutil.NewProduct(h.t, h.DB, name, price, stock)
}

// NewCustomer inserts a customer via the harness DB. See testutil.NewCustomer.
func (h *Harness) NewCustomer(name string, initialDebt float64) *domain.Customer {
	return testutil.NewCustomer(h.t, h.DB, name, initialDebt)
}

// MustReloadProduct re-fetches a product from the DB by ID.
func (h *Harness) MustReloadProduct(id string) *domain.Product {
	return testutil.MustRefreshProduct(h.t, h.DB, id)
}

// MustReloadCustomer re-fetches a customer from the DB by ID.
func (h *Harness) MustReloadCustomer(id string) *domain.Customer {
	return testutil.MustRefreshCustomer(h.t, h.DB, id)
}

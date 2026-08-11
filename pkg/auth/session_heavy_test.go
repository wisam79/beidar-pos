package auth_test

import (
	"sync"
	"testing"

	"beidar-desktop/internal/core/domain"
	"beidar-desktop/pkg/auth"
)

// Test 4: TestAuth_SessionIsolation_MultiThreadedContext
func TestAuth_SessionIsolation_MultiThreadedContext(t *testing.T) {
	auth.Clear()

	adminStaff := &domain.Staff{
		ID:   "admin-id-999",
		Name: "Super Admin",
		Role: domain.RoleAdmin,
	}

	cashierStaff := &domain.Staff{
		ID:   "cashier-id-111",
		Name: "Front Desk Cashier",
		Role: domain.RoleCashier,
	}

	adminPerms := []string{auth.PermSales, auth.PermFinance, auth.PermStaffManage, auth.PermDeleteSales}
	cashierPerms := []string{auth.PermSales}

	var wg sync.WaitGroup
	iterations := 100

	for i := 0; i < iterations; i++ {
		wg.Add(2)

		// Thread 1: Admin session ops
		go func() {
			defer wg.Done()
			auth.Set(adminStaff, adminPerms)
			if auth.IsActive() {
				snap, ok := auth.Snapshot()
				if ok && snap.Staff.Role == domain.RoleAdmin {
					if !snap.HasPermission(auth.PermFinance) {
						t.Errorf("Admin snapshot missing PermFinance")
					}
				}
			}
		}()

		// Thread 2: Cashier session ops
		go func() {
			defer wg.Done()
			auth.Set(cashierStaff, cashierPerms)
			if auth.IsActive() {
				snap, ok := auth.Snapshot()
				if ok && snap.Staff.Role == domain.RoleCashier {
					if snap.HasPermission(auth.PermFinance) {
						t.Errorf("Cashier snapshot leaked PermFinance permission")
					}
				}
			}
		}()
	}

	wg.Wait()
	auth.Clear()
}

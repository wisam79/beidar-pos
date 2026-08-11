package domain

import (
	"encoding/json"
	"testing"
)

// TestSale_SplitDetails_SerializationIntegrity verifies that the SplitDetails map[string]Amount
// within a Sale serializes and deserializes accurately with correct currency amounts.
func TestSale_SplitDetails_SerializationIntegrity(t *testing.T) {
	t.Run("Multi-tender split payment serialization", func(t *testing.T) {
		sale := Sale{
			ID:           "SALE-2026-001",
			CustomerID:   "CUST-100",
			CustomerName: "Ahmad Ali",
			StaffID:      "STAFF-1",
			StaffName:    "Cashier 1",
			Date:         "2026-08-12",
			Timestamp:    1770000000,
			Subtotal:     FromCents(15000),
			Discount:     FromCents(1000),
			VAT:          Zero(),
			Total:        FromCents(14000), // 140.00
			PaymentMethod: "split",
			Status:       "completed",
			ItemsCount:   3,
			SplitDetails: map[string]Amount{
				"cash": FromCents(5000),  // 50.00
				"card": FromCents(6000),  // 60.00
				"debt": FromCents(3000),  // 30.00
			},
		}

		// Verify sum of splits matches total
		splitSum := Zero()
		for _, amt := range sale.SplitDetails {
			splitSum = splitSum.Add(amt)
		}
		if splitSum != sale.Total {
			t.Fatalf("Initial split sum %s != sale total %s", splitSum, sale.Total)
		}

		// Marshal to JSON
		data, err := json.Marshal(sale)
		if err != nil {
			t.Fatalf("json.Marshal(Sale) failed: %v", err)
		}

		// Deserialization
		var unmarshaled Sale
		if err := json.Unmarshal(data, &unmarshaled); err != nil {
			t.Fatalf("json.Unmarshal(Sale) failed: %v", err)
		}

		if unmarshaled.ID != sale.ID {
			t.Errorf("Sale ID mismatch: got %q, want %q", unmarshaled.ID, sale.ID)
		}
		if unmarshaled.Total != sale.Total {
			t.Errorf("Sale Total mismatch: got %s, want %s", unmarshaled.Total, sale.Total)
		}
		if len(unmarshaled.SplitDetails) != len(sale.SplitDetails) {
			t.Fatalf("SplitDetails len mismatch: got %d, want %d", len(unmarshaled.SplitDetails), len(sale.SplitDetails))
		}

		for k, expectedAmt := range sale.SplitDetails {
			gotAmt, ok := unmarshaled.SplitDetails[k]
			if !ok {
				t.Errorf("SplitDetails missing key %q", k)
				continue
			}
			if gotAmt != expectedAmt {
				t.Errorf("SplitDetails[%q] = %s (%d cents), want %s (%d cents)",
					k, gotAmt, gotAmt.Cents(), expectedAmt, expectedAmt.Cents())
			}
		}
	})

	t.Run("Empty and nil split details", func(t *testing.T) {
		saleNil := Sale{
			ID:           "SALE-NIL",
			Total:        FromCents(5000),
			SplitDetails: nil,
		}
		data, err := json.Marshal(saleNil)
		if err != nil {
			t.Fatalf("Marshal nil SplitDetails failed: %v", err)
		}
		var outNil Sale
		if err := json.Unmarshal(data, &outNil); err != nil {
			t.Fatalf("Unmarshal nil SplitDetails failed: %v", err)
		}
		if outNil.SplitDetails != nil && len(outNil.SplitDetails) != 0 {
			t.Errorf("expected empty or nil split details, got %v", outNil.SplitDetails)
		}
	})
}

// TestInstallmentPlan_ScheduleConsistency verifies that the sum of all installments in
// an InstallmentPlan plus the DownPayment exactly equals the TotalAmount across multiple configurations.
func TestInstallmentPlan_ScheduleConsistency(t *testing.T) {
	testPlans := []struct {
		name        string
		total       Amount
		downPayment Amount
		months      int
		schedule    []Installment
	}{
		{
			name:        "3 Months Equal Plan",
			total:       FromCents(120000), // 1200.00
			downPayment: FromCents(30000),  // 300.00
			months:      3,
			schedule: []Installment{
				{Number: 1, DueDate: "2026-09-01", Amount: FromCents(30000), Status: "pending"},
				{Number: 2, DueDate: "2026-10-01", Amount: FromCents(30000), Status: "pending"},
				{Number: 3, DueDate: "2026-11-01", Amount: FromCents(30000), Status: "pending"},
			},
		},
		{
			name:        "6 Months Uneven Remainder Absorption",
			total:       FromCents(100000), // 1000.00
			downPayment: FromCents(10000),  // 100.00
			months:      6,
			schedule: []Installment{
				{Number: 1, DueDate: "2026-09-01", Amount: FromCents(15000), Status: "pending"},
				{Number: 2, DueDate: "2026-10-01", Amount: FromCents(15000), Status: "pending"},
				{Number: 3, DueDate: "2026-11-01", Amount: FromCents(15000), Status: "pending"},
				{Number: 4, DueDate: "2026-12-01", Amount: FromCents(15000), Status: "pending"},
				{Number: 5, DueDate: "2027-01-01", Amount: FromCents(15000), Status: "pending"},
				{Number: 6, DueDate: "2027-02-01", Amount: FromCents(15000), Status: "pending"},
			},
		},
		{
			name:        "Zero DownPayment Full Installment Plan",
			total:       FromCents(75000),
			downPayment: Zero(),
			months:      3,
			schedule: []Installment{
				{Number: 1, DueDate: "2026-09-01", Amount: FromCents(25000), Status: "paid", PaidAt: 1770001000},
				{Number: 2, DueDate: "2026-10-01", Amount: FromCents(25000), Status: "pending"},
				{Number: 3, DueDate: "2026-11-01", Amount: FromCents(25000), Status: "pending"},
			},
		},
	}

	for _, tc := range testPlans {
		t.Run(tc.name, func(t *testing.T) {
			plan := InstallmentPlan{
				TotalAmount: tc.total,
				DownPayment: tc.downPayment,
				Months:      tc.months,
				StartDate:   "2026-08-12",
				Schedule:    tc.schedule,
			}

			// Validate months count matches schedule length
			if len(plan.Schedule) != plan.Months {
				t.Errorf("Schedule length %d != Months %d", len(plan.Schedule), plan.Months)
			}

			// Sum schedule amounts
			scheduleSum := Zero()
			for i, inst := range plan.Schedule {
				if inst.Number != i+1 {
					t.Errorf("Installment index %d has number %d, want %d", i, inst.Number, i+1)
				}
				if inst.Amount <= 0 {
					t.Errorf("Installment %d has non-positive amount %s", inst.Number, inst.Amount)
				}
				scheduleSum = scheduleSum.Add(inst.Amount)
			}

			// DownPayment + ScheduleSum MUST equal TotalAmount
			calculatedTotal := plan.DownPayment.Add(scheduleSum)
			if calculatedTotal != plan.TotalAmount {
				t.Fatalf("DownPayment (%s) + ScheduleSum (%s) = %s != TotalAmount (%s)",
					plan.DownPayment, scheduleSum, calculatedTotal, plan.TotalAmount)
			}

			// Test JSON round trip integrity
			data, err := json.Marshal(plan)
			if err != nil {
				t.Fatalf("json.Marshal(InstallmentPlan) failed: %v", err)
			}

			var restored InstallmentPlan
			if err := json.Unmarshal(data, &restored); err != nil {
				t.Fatalf("json.Unmarshal(InstallmentPlan) failed: %v", err)
			}

			if restored.TotalAmount != plan.TotalAmount {
				t.Errorf("Restored TotalAmount = %s, want %s", restored.TotalAmount, plan.TotalAmount)
			}
			if restored.DownPayment != plan.DownPayment {
				t.Errorf("Restored DownPayment = %s, want %s", restored.DownPayment, plan.DownPayment)
			}
			if len(restored.Schedule) != len(plan.Schedule) {
				t.Fatalf("Restored Schedule length = %d, want %d", len(restored.Schedule), len(plan.Schedule))
			}
			for i := range plan.Schedule {
				if restored.Schedule[i].Amount != plan.Schedule[i].Amount {
					t.Errorf("Restored Schedule[%d].Amount = %s, want %s",
						i, restored.Schedule[i].Amount, plan.Schedule[i].Amount)
				}
				if restored.Schedule[i].Status != plan.Schedule[i].Status {
					t.Errorf("Restored Schedule[%d].Status = %q, want %q",
						i, restored.Schedule[i].Status, plan.Schedule[i].Status)
				}
			}
		})
	}
}

// TestProduct_CustomDetails_NestedJSON verifies that Product with nested dynamic CustomDetails
// (maps, slices, numbers, booleans, strings) serializes and deserializes accurately.
func TestProduct_CustomDetails_NestedJSON(t *testing.T) {
	prod := Product{
		ID:             "PROD-TECH-001",
		Name:           "Flagship Tablet 12-inch",
		Barcode:        "6281000998877",
		Price:          FromCents(49999), // 499.99
		Cost:           FromCents(35000), // 350.00
		Stock:          25.5,
		MinStock:       5.0,
		Category:       "Electronics",
		Supplier:       "TechDistributor Ltd",
		WholesalePrice: FromCents(42000),
		Description:    "High performance tablet with stylus support",
		CustomDetails: map[string]interface{}{
			"brand":           "NovaTech",
			"warranty_months": float64(24),
			"is_refurbished":  false,
			"tags":            []interface{}{"tablet", "portable", "touchscreen"},
			"specifications": map[string]interface{}{
				"ram":     "16GB",
				"storage": "512GB",
				"display": map[string]interface{}{
					"resolution": "2880x1920",
					"refresh_hz": float64(120),
					"oled":       true,
				},
			},
		},
	}

	data, err := json.Marshal(prod)
	if err != nil {
		t.Fatalf("json.Marshal(Product) failed: %v", err)
	}

	var restored Product
	if err := json.Unmarshal(data, &restored); err != nil {
		t.Fatalf("json.Unmarshal(Product) failed: %v", err)
	}

	// Verify standard fields
	if restored.ID != prod.ID || restored.Name != prod.Name || restored.Barcode != prod.Barcode {
		t.Errorf("Product core fields mismatch: %+v", restored)
	}
	if restored.Price != prod.Price || restored.Cost != prod.Cost {
		t.Errorf("Product monetary fields mismatch: price %s, cost %s", restored.Price, restored.Cost)
	}
	if restored.Stock != prod.Stock {
		t.Errorf("Product Stock mismatch: got %f, want %f", restored.Stock, prod.Stock)
	}

	// Verify custom details nested structure
	cd := restored.CustomDetails
	if cd == nil {
		t.Fatalf("CustomDetails is nil after unmarshaling")
	}

	if cd["brand"] != "NovaTech" {
		t.Errorf("CustomDetails['brand'] = %v, want 'NovaTech'", cd["brand"])
	}
	if cd["warranty_months"] != float64(24) {
		t.Errorf("CustomDetails['warranty_months'] = %v, want 24", cd["warranty_months"])
	}
	if cd["is_refurbished"] != false {
		t.Errorf("CustomDetails['is_refurbished'] = %v, want false", cd["is_refurbished"])
	}

	specs, ok := cd["specifications"].(map[string]interface{})
	if !ok {
		t.Fatalf("specifications is not a map[string]interface{}: %v", cd["specifications"])
	}
	if specs["ram"] != "16GB" || specs["storage"] != "512GB" {
		t.Errorf("specifications ram/storage mismatch: %v", specs)
	}

	display, ok := specs["display"].(map[string]interface{})
	if !ok {
		t.Fatalf("display is not a map[string]interface{}: %v", specs["display"])
	}
	if display["resolution"] != "2880x1920" || display["refresh_hz"] != float64(120) || display["oled"] != true {
		t.Errorf("display specs mismatch: %v", display)
	}

	tags, ok := cd["tags"].([]interface{})
	if !ok || len(tags) != 3 {
		t.Fatalf("tags slice mismatch: %v", cd["tags"])
	}
	if tags[0] != "tablet" || tags[1] != "portable" || tags[2] != "touchscreen" {
		t.Errorf("tags contents mismatch: %v", tags)
	}
}

// TestRole_Constants_Exhaustive asserts that all defined roles exist, have expected string values,
// are non-empty, and are completely unique.
func TestRole_Constants_Exhaustive(t *testing.T) {
	roles := []struct {
		role     Role
		expected string
	}{
		{RoleAdmin, "admin"},
		{RoleManager, "manager"},
		{RoleCashier, "cashier"},
		{RoleViewer, "viewer"},
	}

	if len(roles) != 4 {
		t.Fatalf("expected exactly 4 defined roles, got %d", len(roles))
	}

	seen := make(map[Role]bool)
	seenStrings := make(map[string]bool)

	for _, item := range roles {
		if item.role == "" {
			t.Errorf("Role constant is empty string")
		}
		if string(item.role) != item.expected {
			t.Errorf("Role %v string representation = %q, want %q", item.role, string(item.role), item.expected)
		}
		if seen[item.role] {
			t.Errorf("Duplicate Role constant found: %v", item.role)
		}
		if seenStrings[string(item.role)] {
			t.Errorf("Duplicate Role string value found: %q", string(item.role))
		}
		seen[item.role] = true
		seenStrings[string(item.role)] = true
	}
}

// TestPermission_Constants_NoDuplicates asserts that all 13 permission constants are defined,
// non-empty, and unique with no collision.
func TestPermission_Constants_NoDuplicates(t *testing.T) {
	perms := []struct {
		name     string
		constant string
		expected string
	}{
		{"PermSales", PermSales, "sales"},
		{"PermProducts", PermProducts, "products"},
		{"PermInventory", PermInventory, "inventory"},
		{"PermCustomers", PermCustomers, "customers"},
		{"PermInvoices", PermInvoices, "invoices"},
		{"PermReports", PermReports, "reports"},
		{"PermFinance", PermFinance, "finance"},
		{"PermSettings", PermSettings, "settings"},
		{"PermStaffManage", PermStaffManage, "staff_manage"},
		{"PermDiscounts", PermDiscounts, "discounts"},
		{"PermDeleteSales", PermDeleteSales, "delete_sales"},
		{"PermEditPrices", PermEditPrices, "edit_prices"},
		{"PermExportData", PermExportData, "export_data"},
	}

	const expectedCount = 13
	if len(perms) != expectedCount {
		t.Fatalf("Expected %d permissions, found %d", expectedCount, len(perms))
	}

	seen := make(map[string]string) // permissionValue -> constantName
	for _, p := range perms {
		if p.constant == "" {
			t.Errorf("Permission %s is empty", p.name)
		}
		if p.constant != p.expected {
			t.Errorf("Permission %s = %q, want %q", p.name, p.constant, p.expected)
		}
		if existing, exists := seen[p.constant]; exists {
			t.Errorf("Collision: permission value %q is used by both %s and %s", p.constant, existing, p.name)
		}
		seen[p.constant] = p.name
	}

	if len(seen) != expectedCount {
		t.Errorf("Expected %d unique permission strings, got %d", expectedCount, len(seen))
	}
}

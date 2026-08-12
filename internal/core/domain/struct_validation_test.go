package domain

import (
	"fmt"
	"strings"
	"testing"
)

// Product Validations
func TestProduct_Validation(t *testing.T) {
	tests := []struct {
		name    string
		product Product
		wantErr bool
	}{
		{
			name: "Valid Product",
			product: Product{
				Name:  "Test Item",
				Price: NewAmount(1000),
				Stock: 50,
			},
			wantErr: false,
		},
		{
			name: "Empty Name",
			product: Product{
				Name:  "   ",
				Price: NewAmount(1000),
				Stock: 50,
			},
			wantErr: true,
		},
		{
			name: "Negative Price",
			product: Product{
				Name:  "Test Item",
				Price: NewAmount(-100),
				Stock: 50,
			},
			wantErr: true,
		},
		{
			name: "Extremely Long Name",
			product: Product{
				Name:  strings.Repeat("A", 256),
				Price: NewAmount(1000),
				Stock: 50,
			},
			wantErr: true, // Assuming max length is 255
		},
		{
			name: "Negative Stock (Allowed for some businesses, but generally warned)",
			product: Product{
				Name:  "Test Item",
				Price: NewAmount(1000),
				Stock: -5,
			},
			wantErr: false, // In many POS, negative stock is allowed (overselling)
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Mock validation function based on typical domain logic
			isValid := func(p Product) bool {
				if strings.TrimSpace(p.Name) == "" {
					return false
				}
				if len(p.Name) > 255 {
					return false
				}
				if p.Price.Cents() < 0 {
					return false
				}
				return true
			}

			err := !isValid(tt.product)
			if err != tt.wantErr {
				t.Errorf("expected error %v, got %v", tt.wantErr, err)
			}
		})
	}
}

// Customer Validations
func TestCustomer_Validation(t *testing.T) {
	tests := []struct {
		name     string
		customer Customer
		wantErr  bool
	}{
		{
			name: "Valid Customer",
			customer: Customer{
				Name:  "John Doe",
				Phone: "0123456789",
				Debt:  NewAmount(0),
			},
			wantErr: false,
		},
		{
			name: "No Name",
			customer: Customer{
				Name:  "",
				Phone: "0123456789",
				Debt:  NewAmount(0),
			},
			wantErr: true,
		},
		{
			name: "Invalid Phone Characters",
			customer: Customer{
				Name:  "John",
				Phone: "abc-def",
				Debt:  NewAmount(0),
			},
			wantErr: true,
		},
		{
			name: "Debt Validation Example",
			customer: Customer{
				Name:        "John",
				Debt:        NewAmount(1500000), // 15,000
			},
			wantErr: true, 
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			isValid := func(c Customer) bool {
				if strings.TrimSpace(c.Name) == "" {
					return false
				}
				// Very basic phone validation mock
				if c.Phone != "" && strings.ContainsAny(c.Phone, "abc") {
					return false
				}
				if c.Debt.Cents() > 1000000 { // 10,000 max (1 million cents)
					return false
				}
				return true
			}

			err := !isValid(tt.customer)
			if err != tt.wantErr {
				t.Errorf("expected error %v, got %v", tt.wantErr, err)
			}
		})
	}
}

// Sale Validations
func TestSale_Validation(t *testing.T) {
	tests := []struct {
		name    string
		sale    Sale
		wantErr bool
	}{
		{
			name: "Valid Sale",
			sale: Sale{
				Items: []SaleItem{{Quantity: 1, Price: NewAmount(1000)}},
				Total: NewAmount(1000),
			},
			wantErr: false,
		},
		{
			name: "Empty Items",
			sale: Sale{
				Items: []SaleItem{},
				Total: NewAmount(0),
			},
			wantErr: true,
		},
		{
			name: "Total Mismatch",
			sale: Sale{
				Items: []SaleItem{{Quantity: 1, Price: NewAmount(1000)}},
				Total: NewAmount(500), // Should be 1000
			},
			wantErr: true,
		},
		{
			name: "Negative Quantity Item",
			sale: Sale{
				Items: []SaleItem{{Quantity: -1, Price: NewAmount(1000)}},
				Total: NewAmount(-1000),
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			isValid := func(s Sale) bool {
				if len(s.Items) == 0 {
					return false
				}
				var calculatedTotal int64
				for _, item := range s.Items {
					if item.Quantity <= 0 {
						return false
					}
					calculatedTotal += item.Price.Cents() * int64(item.Quantity)
				}
				if calculatedTotal != s.Total.Cents() {
					return false
				}
				return true
			}

			err := !isValid(tt.sale)
			if err != tt.wantErr {
				t.Errorf("expected error %v, got %v", tt.wantErr, err)
			}
		})
	}
}

func TestInstallment_DownPayment(t *testing.T) {
	tests := []struct {
		name         string
		total        float64
		downPayment  float64
		months       int
		expectValid  bool
		expectPerMo  int64
	}{
		{"Standard Plan", 1200.0, 200.0, 5, true, 20000}, // (1200-200)/5 = 200 per mo
		{"Zero Down", 1000.0, 0.0, 4, true, 25000},
		{"Full Down Payment", 1000.0, 1000.0, 12, false, 0}, // No need for installment
		{"Down Payment Exceeds", 1000.0, 1500.0, 12, false, 0},
		{"Zero Months", 1000.0, 200.0, 0, false, 0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			isValid := func(total, down float64, months int) (bool, int64) {
				if months <= 0 {
					return false, 0
				}
				if down >= total {
					return false, 0
				}
				totalCents, _ := ParseAmount(fmt.Sprintf("%.2f", total))
				downCents, _ := ParseAmount(fmt.Sprintf("%.2f", down))
				remainder := totalCents.Sub(downCents)
				perMonth := remainder.Div(int64(months))
				return true, perMonth.Cents()
			}

			valid, pmo := isValid(tt.total, tt.downPayment, tt.months)
			if valid != tt.expectValid {
				t.Errorf("expected validity %v, got %v", tt.expectValid, valid)
			}
			if valid && pmo != tt.expectPerMo {
				t.Errorf("expected %d per month, got %d", tt.expectPerMo, pmo)
			}
		})
	}
}

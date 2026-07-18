package errors_test

import (
	"encoding/json"
	"strings"
	"testing"

	pkgerrors "beidar-desktop/pkg/errors"
)

func TestNewAppError_Fields(t *testing.T) {
	err := pkgerrors.NewAppError(
		pkgerrors.ModuleSales,
		"SALE_NOT_FOUND",
		"لم يتم العثور على الفاتورة",
		"تأكد من رقم الفاتورة",
		"id",
	)

	if err.Module != pkgerrors.ModuleSales {
		t.Errorf("Module = %q, want %q", err.Module, pkgerrors.ModuleSales)
	}
	if err.Code != "SALE_NOT_FOUND" {
		t.Errorf("Code = %q, want SALE_NOT_FOUND", err.Code)
	}
	if err.Message != "لم يتم العثور على الفاتورة" {
		t.Errorf("Message = %q, unexpected", err.Message)
	}
	if err.Hint != "تأكد من رقم الفاتورة" {
		t.Errorf("Hint = %q, unexpected", err.Hint)
	}
	if err.Field != "id" {
		t.Errorf("Field = %q, want id", err.Field)
	}
}

func TestAppError_Error_MessageOnly(t *testing.T) {
	err := &pkgerrors.AppError{
		Code:    "EMPTY_CART",
		Message: "السلة فارغة",
	}
	got := err.Error()
	if got != "السلة فارغة" {
		t.Errorf("Error() = %q, want %q", got, "السلة فارغة")
	}
}

func TestAppError_Error_WithHint(t *testing.T) {
	err := &pkgerrors.AppError{
		Code:    "INVALID_PIN",
		Message: "رمز PIN غير صحيح",
		Hint:    "يجب أن يتكون من 4 أرقام",
	}
	got := err.Error()
	if !strings.Contains(got, "رمز PIN غير صحيح") {
		t.Errorf("Error() missing message, got %q", got)
	}
	if !strings.Contains(got, "يجب أن يتكون من 4 أرقام") {
		t.Errorf("Error() missing hint, got %q", got)
	}
}

func TestAppError_Error_WithOptions_ReturnsJSON(t *testing.T) {
	err := &pkgerrors.AppError{
		Code:    "OVERSTOCK_CONFIRM",
		Message: "الكمية تتجاوز الحد",
		Options: map[string]bool{"can_override": true},
	}
	got := err.Error()

	// Should be valid JSON when options are set
	var parsed map[string]interface{}
	if jsonErr := json.Unmarshal([]byte(got), &parsed); jsonErr != nil {
		t.Errorf("Error() with options should return valid JSON, got %q: %v", got, jsonErr)
	}
	if parsed["code"] != "OVERSTOCK_CONFIRM" {
		t.Errorf("JSON missing correct code, got %v", parsed["code"])
	}
}

func TestAppError_ImplementsError(t *testing.T) {
	var err error = pkgerrors.NewAppError(
		pkgerrors.ModuleStaff,
		"AUTH_FAILED",
		"بيانات الدخول غير صحيحة",
		"",
		"",
	)
	if err == nil {
		t.Error("Expected non-nil error")
	}
	if err.Error() == "" {
		t.Error("Error() should return non-empty string")
	}
}

func TestModuleConstants(t *testing.T) {
	modules := []pkgerrors.ErrorModule{
		pkgerrors.ModuleStaff,
		pkgerrors.ModuleProduct,
		pkgerrors.ModuleCustomer,
		pkgerrors.ModuleSales,
		pkgerrors.ModulePayment,
		pkgerrors.ModuleFinance,
		pkgerrors.ModuleInventory,
		pkgerrors.ModuleDiscount,
	}
	for _, m := range modules {
		if m == "" {
			t.Errorf("Module constant should not be empty string")
		}
	}
}

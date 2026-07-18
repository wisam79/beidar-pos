package i18n

import (
	"strings"
	"testing"
)

func TestGetMessage(t *testing.T) {
	// 1. Simple lookup
	msg := GetMessage("EMPTY_CART")
	expected := "لا يمكن إتمام البيع بدون منتجات"
	if msg != expected {
		t.Errorf("Expected %q, got %q", expected, msg)
	}

	// 2. Format arguments lookup
	msgFormatted := GetMessage("SALES_INSUFFICIENT_STOCK", "Sugar", "5", "10")
	if !strings.Contains(msgFormatted, "Sugar") || !strings.Contains(msgFormatted, "5") || !strings.Contains(msgFormatted, "10") {
		t.Errorf("Expected formatted string containing args, got %q", msgFormatted)
	}

	// 3. Fallback to key if not found
	msgFallback := GetMessage("NON_EXISTENT_KEY")
	if msgFallback != "NON_EXISTENT_KEY" {
		t.Errorf("Expected fallback to key, got %q", msgFallback)
	}
}

func TestGetHint(t *testing.T) {
	// 1. Existing hint
	hint := GetHint("EMPTY_CART")
	expected := "أضف منتجات إلى السلة أولاً"
	if hint != expected {
		t.Errorf("Expected hint %q, got %q", expected, hint)
	}

	// 2. Non-existing hint
	hintNone := GetHint("NON_EXISTENT_KEY")
	if hintNone != "" {
		t.Errorf("Expected empty string for non-existent hint, got %q", hintNone)
	}
}

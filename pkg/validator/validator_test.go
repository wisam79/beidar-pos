package validator

import (
	"strings"
	"testing"
)

type testAccount struct {
	Name    string `json:"name" validate:"required"`
	Age     int    `json:"age" validate:"min=18"`
	Balance int64  `json:"balance" validate:"required,gt=0"`
}

type testIgnored struct {
	Internal string `json:"-"`
}

func TestGetReturnsSingleton(t *testing.T) {
	a := Get()
	b := Get()
	if a == nil {
		t.Fatal("Get() returned nil")
	}
	if a != b {
		t.Error("Get() must return the same singleton instance")
	}
}

func TestValidateUsesJSONTagName(t *testing.T) {
	v := Get()

	err := v.Struct(testAccount{})
	if err == nil {
		t.Fatal("expected validation error for empty struct")
	}

	msg := err.Error()
	if !strings.Contains(msg, "name") {
		t.Errorf("expected json tag 'name' in error message, got: %s", msg)
	}
	if !strings.Contains(msg, "balance") {
		t.Errorf("expected json tag 'balance' in error message, got: %s", msg)
	}
}

func TestValidateMinimumAge(t *testing.T) {
	v := Get()

	err := v.Struct(testAccount{Name: "أحمد", Age: 16, Balance: 100})
	if err == nil {
		t.Fatal("expected validation error for age below minimum")
	}
	if !strings.Contains(err.Error(), "age") {
		t.Errorf("expected field name 'age' in error, got: %s", err.Error())
	}
}

func TestValidateAcceptsValidStruct(t *testing.T) {
	v := Get()

	err := v.Struct(testAccount{Name: "أحمد", Age: 30, Balance: 500})
	if err != nil {
		t.Fatalf("expected no validation error, got: %v", err)
	}
}

func TestValidateSkippedDashField(t *testing.T) {
	v := Get()

	err := v.Struct(testIgnored{Internal: "x"})
	if err != nil {
		t.Fatalf("expected no validation error for ignored field, got: %v", err)
	}
}

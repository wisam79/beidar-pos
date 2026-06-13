package errors

import (
	"encoding/json"
	"fmt"
)

type ErrorModule string

const (
	ModuleStaff     ErrorModule = "STAFF"
	ModuleProduct   ErrorModule = "PRODUCT"
	ModuleCustomer  ErrorModule = "CUSTOMER"
	ModuleSales     ErrorModule = "SALES"
	ModulePayment   ErrorModule = "PAYMENT"
	ModuleFinance   ErrorModule = "FINANCE"
	ModuleInventory ErrorModule = "INVENTORY"
	ModuleDiscount  ErrorModule = "DISCOUNT"
)

type AppError struct {
	Module  ErrorModule     `json:"module"`
	Code    string          `json:"code"`
	Message string          `json:"message"`
	Hint    string          `json:"hint,omitempty"`
	Field   string          `json:"field,omitempty"`
	Options map[string]bool `json:"options,omitempty"`
}

func (e *AppError) Error() string {
	if len(e.Options) > 0 {
		data, _ := json.Marshal(e)
		return string(data)
	}

	if e.Hint != "" {
		return fmt.Sprintf("%s. %s", e.Message, e.Hint)
	}
	return e.Message
}

func NewAppError(module ErrorModule, code, message, hint, field string) *AppError {
	return &AppError{
		Module:  module,
		Code:    code,
		Message: message,
		Hint:    hint,
		Field:   field,
	}
}

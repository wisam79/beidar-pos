package domain

import (
	"fmt"
	"math"
	"strconv"
	"strings"
)

// Amount represents a monetary value stored as the smallest currency unit (e.g., cents, fils).
// Using int64 avoids floating-point errors that are unacceptable in accounting.
type Amount int64

func Zero() Amount { return Amount(0) }

// NewAmount creates an Amount from a float value (e.g., 12.50 -> 1250).
func NewAmount(v float64) Amount {
	return Amount(math.Round(v * 100))
}

// FromCents creates an Amount from a cents value directly.
func FromCents(c int64) Amount {
	return Amount(c)
}

// ParseAmount parses a string like "12.50" or "12" into an Amount.
func ParseAmount(s string) (Amount, error) {
	if s == "" {
		return Zero(), nil
	}
	s = strings.TrimSpace(s)
	v, err := strconv.ParseFloat(s, 64)
	if err != nil {
		return Zero(), fmt.Errorf("invalid amount: %w", err)
	}
	return NewAmount(v), nil
}

// Cents returns the amount in cents.
func (a Amount) Cents() int64 {
	return int64(a)
}

// Float returns the amount as a float64 for display or legacy calculations.
func (a Amount) Float() float64 {
	return float64(a) / 100
}

// Add returns a new amount that is the sum of a and b.
func (a Amount) Add(b Amount) Amount {
	return a + b
}

// Sub returns a new amount that is the difference of a and b.
func (a Amount) Sub(b Amount) Amount {
	return a - b
}

// Mul returns a new amount multiplied by an integer factor.
func (a Amount) Mul(factor int64) Amount {
	return a * Amount(factor)
}

// MulFloat returns a new amount multiplied by a floating point factor.
// Computed in the integer (cents) domain with rounding to avoid the
// floating-point drift that the naive a.Float()*factor introduces.
func (a Amount) MulFloat(factor float64) Amount {
	cents := float64(int64(a))
	return Amount(math.Round(cents * factor))
}

// Div returns a new amount divided by an integer divisor.
// It uses integer division with rounding to the nearest cent. Division by zero
// yields a zero Amount instead of panicking — callers that need to distinguish
// the zero-divisor case should check the divisor beforehand.
func (a Amount) Div(divisor int64) Amount {
	if divisor == 0 {
		return Zero()
	}
	return Amount(roundDiv(int64(a), divisor))
}

// Percentage returns a new amount that is a percentage of the current amount.
// Computed in the integer (cents) domain with rounding to the nearest cent.
func (a Amount) Percentage(p float64) Amount {
	cents := int64(a)
	return Amount(math.Round(float64(cents) * (p / 100.0)))
}

// roundDiv performs integer division of a by b with rounding to nearest.
func roundDiv(a, b int64) int64 {
	if b == 0 {
		return 0
	}
	q := a / b
	r := a % b
	// Round half away from zero.
	if (b > 0 && r*2 >= b) || (b < 0 && r*2 <= b) {
		if (a < 0) == (b < 0) {
			q++
		} else {
			q--
		}
	}
	return q
}

// RoundToNearest rounds the amount down to the nearest multiple of unit.
// For example, 129_999.RoundToNearest(25_000) = 125_000.
// Uses floor division (truncation toward zero) to match the legacy float64 behavior.
func (a Amount) RoundToNearest(unit Amount) Amount {
	if unit <= 0 {
		return a
	}
	return (a / unit) * unit
}

// IsZero returns true if the amount is zero.
func (a Amount) IsZero() bool {
	return a == 0
}

// IsNegative returns true if the amount is less than zero.
func (a Amount) IsNegative() bool {
	return a < 0
}

// Abs returns the absolute value of the amount.
func (a Amount) Abs() Amount {
	if a < 0 {
		return -a
	}
	return a
}

func (a Amount) String() string {
	sign := ""
	if a < 0 {
		sign = "-"
		a = -a
	}
	cents := a.Cents()
	dollars := cents / 100
	c := cents % 100
	return fmt.Sprintf("%s%d.%02d", sign, dollars, c)
}

// MarshalJSON serializes the amount as a JSON number (currency units, e.g., 12.5).
// This eliminates the ambiguity between cents and currency-unit integers.
func (a Amount) MarshalJSON() ([]byte, error) {
	return []byte(fmt.Sprintf("%.2f", a.Float())), nil
}

// UnmarshalJSON parses a JSON number (currency units, e.g., 12.5 or 12) or a
// string into an Amount by multiplying by 100. The old fast path that treated
// bare integers as cents has been removed because it corrupts values like 12
// (12 IQD → 1200 fils) into 12 fils.
func (a *Amount) UnmarshalJSON(data []byte) error {
	if len(data) == 0 {
		*a = Zero()
		return nil
	}
	// Strip quotes if present (string form)
	if data[0] == '"' && data[len(data)-1] == '"' {
		data = data[1 : len(data)-1]
	}
	v, err := strconv.ParseFloat(string(data), 64)
	if err != nil {
		return fmt.Errorf("invalid amount JSON: %s: %w", string(data), err)
	}
	*a = NewAmount(v)
	return nil
}

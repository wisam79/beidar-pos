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

// MarshalJSON serializes the amount as a JSON number (cents).
// This preserves precision and is safe for JavaScript (up to 2^53).
func (a Amount) MarshalJSON() ([]byte, error) {
	return strconv.AppendInt(nil, int64(a), 10), nil
}

// UnmarshalJSON accepts either a number (cents) or a string/float number.
// Flexibility for data migration and API compatibility.
func (a *Amount) UnmarshalJSON(data []byte) error {
	if len(data) == 0 {
		*a = Zero()
		return nil
	}
	// Strip quotes if present (string form)
	if data[0] == '"' && data[len(data)-1] == '"' {
		data = data[1 : len(data)-1]
	}
	s := string(data)
	// Try integer first (fast path)
	if i, err := strconv.ParseInt(s, 10, 64); err == nil {
		*a = Amount(i)
		return nil
	}
	// Fallback to float parsing for legacy data
	v, err := strconv.ParseFloat(s, 64)
	if err != nil {
		return fmt.Errorf("invalid amount JSON: %s: %w", s, err)
	}
	*a = NewAmount(v)
	return nil
}

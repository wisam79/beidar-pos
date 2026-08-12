package domain

import (
	"encoding/json"
	"testing"
)

// Performance tests (Benchmarks) for financial primitives.
// Since these functions are called millions of times during batch operations and complex sales,
// their performance is critical.

func BenchmarkAmount_Add(b *testing.B) {
	a1 := NewAmount(10500) // 105.00
	a2 := NewAmount(2525)  // 25.25
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = a1.Add(a2)
	}
}

func BenchmarkAmount_Sub(b *testing.B) {
	a1 := NewAmount(10500)
	a2 := NewAmount(2525)
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = a1.Sub(a2)
	}
}

func BenchmarkAmount_MulFloat(b *testing.B) {
	a := NewAmount(10500)
	factor := 1.15 // 15% VAT
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = a.MulFloat(factor)
	}
}

func BenchmarkAmount_Percentage(b *testing.B) {
	a := NewAmount(10500)
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = a.Percentage(15)
	}
}

func BenchmarkAmount_RoundToNearest(b *testing.B) {
	a := NewAmount(12345) // 123.45
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = a.RoundToNearest(250) // Round to nearest 0.25 (250 cents)
	}
}

func BenchmarkAmount_String(b *testing.B) {
	a := NewAmount(123456789)
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = a.String()
	}
}

func BenchmarkAmount_JSONMarshal(b *testing.B) {
	a := NewAmount(123456789)
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, _ = json.Marshal(a)
	}
}

func BenchmarkAmount_JSONUnmarshal(b *testing.B) {
	data := []byte(`1234567.89`)
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		var a Amount
		_ = json.Unmarshal(data, &a)
	}
}

func BenchmarkParseAmount(b *testing.B) {
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, _ = ParseAmount("123456.78")
	}
}

func BenchmarkAmount_Cents(b *testing.B) {
	a := NewAmount(100)
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = a.Cents()
	}
}


func BenchmarkAmount_Div(b *testing.B) {
	a := NewAmount(10000)
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = a.Div(3)
	}
}

func BenchmarkAmount_Compare(b *testing.B) {
	a1 := NewAmount(10000)
	a2 := NewAmount(20000)
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = a1.Cents() > a2.Cents()
	}
}

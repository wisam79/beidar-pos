package domain

import "testing"

func TestNewTxWrapsUnderlying(t *testing.T) {
	marker := struct{ name string }{name: "gorm-tx"}
	tx := NewTx(marker)

	if tx == nil {
		t.Fatal("NewTx returned nil")
	}
	// isTx() must be callable (satisfies the interface) without panicking.
	impl, ok := tx.(txImpl)
	if !ok {
		t.Fatal("expected NewTx to return a txImpl")
	}
	impl.isTx()
}

func TestGetTxUnderlying(t *testing.T) {
	// nil Tx -> nil.
	if got := GetTxUnderlying(nil); got != nil {
		t.Errorf("GetTxUnderlying(nil) = %v, want nil", got)
	}

	// Value txImpl.
	tx := NewTx(42)
	if got := GetTxUnderlying(tx); got != 42 {
		t.Errorf("GetTxUnderlying(value) = %v, want 42", got)
	}

	// *txImpl pointer.
	ptrTx := &txImpl{underlying: "ptr-underlying"}
	if got := GetTxUnderlying(ptrTx); got != "ptr-underlying" {
		t.Errorf("GetTxUnderlying(*txImpl) = %v, want 'ptr-underlying'", got)
	}

	// A Tx-like value that is neither txImpl nor *txImpl.
	if got := GetTxUnderlying(otherTx{}); got != nil {
		t.Errorf("GetTxUnderlying(unknown) = %v, want nil", got)
	}
}

// otherTx satisfies the unexported Tx interface marker from within the package.
type otherTx struct{}

func (otherTx) isTx() {}
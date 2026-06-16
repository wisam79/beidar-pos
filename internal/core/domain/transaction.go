package domain

// Tx is an opaque transaction type that hides the underlying database transaction
// from the domain layer, preserving Clean Architecture boundaries.
type Tx interface {
	isTx()
}

type txImpl struct {
	underlying interface{}
}

func (txImpl) isTx() {}

// NewTx wraps an underlying transaction object (e.g. *gorm.DB) as a domain.Tx.
func NewTx(underlying interface{}) Tx {
	return txImpl{underlying: underlying}
}

// GetTxUnderlying extracts the underlying transaction object from a domain.Tx.
func GetTxUnderlying(tx Tx) interface{} {
	if tx == nil {
		return nil
	}
	if impl, ok := tx.(txImpl); ok {
		return impl.underlying
	}
	if impl, ok := tx.(*txImpl); ok {
		return impl.underlying
	}
	return nil
}

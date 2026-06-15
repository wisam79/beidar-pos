package domain

// Tx is an opaque transaction type that hides the underlying *gorm.DB
// from the domain layer, preserving Clean Architecture boundaries.
type Tx interface{}

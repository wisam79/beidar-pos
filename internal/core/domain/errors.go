package domain

import "errors"

var ErrRecordNotFound = errors.New("record not found")
var ErrInsufficientStock = errors.New("insufficient stock")

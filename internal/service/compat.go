package service

import "beidar-desktop/internal/core/domain"

// Type aliases to map legacy service interfaces to domain interfaces
// in order to avoid breaking existing unit tests and other references.

type ProductService = domain.ProductService
type SaleService = domain.SaleService
type PaymentService = domain.PaymentService
type FinanceService = domain.FinanceService
type CRMService = domain.CRMService
type StaffService = domain.StaffService
type StatsService = domain.StatsService
type PrintService = domain.PrintService
type BackupService = domain.BackupService
type SettingsService = domain.SettingsService
type DiscountService = domain.DiscountService

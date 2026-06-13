//go:build !windows

package notification

import "errors"

type NotificationType string

func ShowNativeNotification(title, message string, notifType NotificationType) error {
	return errors.New("native notifications are not supported on this platform")
}

func ShowLowStockNotification(productName string, currentStock, minStock int) error {
	return nil
}

func ShowPaymentDueNotification(customerName string, amount float64, dueDate string) error {
	return nil
}

func ShowSaleCompletedNotification(total float64, itemsCount int) error {
	return nil
}

func ShowUpdateAvailableNotification(version string) error {
	return nil
}

func ShowBackupCompletedNotification() error {
	return nil
}

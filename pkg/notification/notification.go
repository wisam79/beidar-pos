//go:build windows

package notification

import (
	"fmt"
	"os/exec"
	"runtime"
	"strings"
	"syscall"
)

// NotificationType represents the type of notification
type NotificationType string

const (
	NotificationInfo    NotificationType = "info"
	NotificationWarning NotificationType = "warning"
	NotificationError   NotificationType = "error"
	NotificationSuccess NotificationType = "success"
)

// ShowNativeNotification displays a Windows toast notification
func ShowNativeNotification(title, message string, notifType NotificationType) error {
	if runtime.GOOS != "windows" {
		return fmt.Errorf("native notifications only supported on Windows")
	}

	// Use PowerShell to show Windows Toast Notification
	script := fmt.Sprintf(`
		[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
		[Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] | Out-Null

		$template = @"
		<toast>
			<visual>
				<binding template="ToastText02">
					<text id="1">%s</text>
					<text id="2">%s</text>
				</binding>
			</visual>
		</toast>
"@

		$xml = New-Object Windows.Data.Xml.Dom.XmlDocument
		$xml.LoadXml($template)
		$toast = New-Object Windows.UI.Notifications.ToastNotification $xml
		[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier("Beidar POS").Show($toast)
	`, escapePS(title), escapePS(message))

	cmd := exec.Command("powershell", "-NoProfile", "-WindowStyle", "Hidden", "-Command", script)
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	return cmd.Run()
}

// ShowLowStockNotification shows a notification for low stock items
func ShowLowStockNotification(productName string, currentStock, minStock int) error {
	title := "⚠️ تنبيه المخزون"
	message := fmt.Sprintf("المنتج '%s' وصل للحد الأدنى (%d من %d)", productName, currentStock, minStock)
	return ShowNativeNotification(title, message, NotificationWarning)
}

// ShowPaymentDueNotification shows a notification for upcoming payment
func ShowPaymentDueNotification(customerName string, amount float64, dueDate string) error {
	title := "💳 موعد دفعة"
	message := fmt.Sprintf("دفعة مستحقة من %s بقيمة %.0f - تاريخ الاستحقاق: %s", customerName, amount, dueDate)
	return ShowNativeNotification(title, message, NotificationInfo)
}

// ShowSaleCompletedNotification shows a notification when a sale is completed
func ShowSaleCompletedNotification(total float64, itemsCount int) error {
	title := "✅ عملية بيع ناجحة"
	message := fmt.Sprintf("تم بيع %d منتج بإجمالي %.0f", itemsCount, total)
	return ShowNativeNotification(title, message, NotificationSuccess)
}

// ShowUpdateAvailableNotification shows a notification when an update is available
func ShowUpdateAvailableNotification(version string) error {
	title := "🔄 تحديث متوفر"
	message := fmt.Sprintf("الإصدار %s متاح للتحميل", version)
	return ShowNativeNotification(title, message, NotificationInfo)
}

// ShowBackupCompletedNotification shows a notification when backup is done
func ShowBackupCompletedNotification() error {
	title := "☁️ النسخ الاحتياطي"
	message := "تم حفظ النسخة الاحتياطية بنجاح"
	return ShowNativeNotification(title, message, NotificationSuccess)
}

func escapePS(s string) string {
	result := strings.ReplaceAll(s, "\"", "`\"")
	result = strings.ReplaceAll(result, "$", "`$")
	return result
}

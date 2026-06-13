package main

import (
	"embed"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/windows"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	// Create an instance of the app structure
	app := NewApp()

	// Create application with options
	err := wails.Run(&options.App{
		Title:     "بيدر - نظام المبيعات",
		Width:     1280,
		Height:    800,
		MinWidth:  1024,
		MinHeight: 768,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		BackgroundColour: &options.RGBA{R: 33, G: 33, B: 36, A: 255},
		OnStartup:        app.startup,
		Frameless:        true,
		Windows: &windows.Options{
			WebviewIsTransparent: false,
			WindowIsTranslucent:  false,
			DisableWindowIcon:    false,
		},
		Bind: []interface{}{
			app,
			app.ProductHandler, // Expose product logic
			app.SaleHandler,    // Expose sales logic
			app.PaymentHandler, // Expose payment logic
			app.FinanceHandler, // Expose finance logic
			app.CRMHandler,     // Expose crm logic
			app.StaffHandler,   // Expose staff logic
			app.StatsHandler,   // Expose stats logic
			app.PrintHandler,   // Expose printing logic
			app.BackupHandler,  // Expose backup logic
			app.SettingsHandler, // Expose settings/system logic
			app.LanHandler,      // Expose LAN sync logic
			app.CloudHandler,    // Expose Cloud & Integration logic
			app.DiscountHandler, // Expose Discount logic
		},
	})

	if err != nil {
		println("Error:", err.Error())
	}
}

package main

import (
	"context"
	"embed"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"net/http"
	"strings"

	"beidar-desktop/internal/repository"
	"beidar-desktop/pkg/imagestore"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/windows"
	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

//go:embed all:frontend/dist
var assets embed.FS

type windowState struct {
	Width  int  `json:"width"`
	Height int  `json:"height"`
	X      int  `json:"x"`
	Y      int  `json:"y"`
	Max    bool `json:"max"`
}

func getWindowStatePath() string {
	cd, err := os.UserConfigDir()
	if err != nil {
		return ""
	}
	return filepath.Join(cd, "BeidarPOS_V3", "window.json")
}

func loadWindowState() (windowState, error) {
	path := getWindowStatePath()
	var state windowState
	data, err := os.ReadFile(path)
	if err != nil {
		return state, err
	}
	err = json.Unmarshal(data, &state)
	return state, err
}

func saveWindowState(state windowState) error {
	path := getWindowStatePath()
	if path == "" {
		return fmt.Errorf("could not get config path")
	}
	data, err := json.Marshal(state)
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0644)
}

func getWebviewCacheDir() string {
	cd, err := os.UserConfigDir()
	if err != nil {
		return ""
	}
	return filepath.Join(cd, "BeidarPOS_V3", "webview_cache")
}

func main() {
	// 🔒 Single Instance Lock
	cleanup, err := checkSingleInstance()
	if err != nil {
		fmt.Println("❌ Application instance already running. Exiting...")
		return
	}
	defer cleanup()

	// Load window state
	initialWidth := 1280
	initialHeight := 800
	if state, err := loadWindowState(); err == nil {
		if state.Width > 0 && state.Height > 0 {
			initialWidth = state.Width
			initialHeight = state.Height
		}
	}

	// Create an instance of the app structure
	app := NewApp()

	// Create application with options
	err = wails.Run(&options.App{
		Title:                    "بيدر - نظام المبيعات",
		Width:                    initialWidth,
		Height:                   initialHeight,
		MinWidth:                 1024,
		MinHeight:                768,
		StartHidden:              true,
		EnableDefaultContextMenu: false,
		AssetServer: &assetserver.Options{
			Assets: assets,
			Handler: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if strings.HasPrefix(r.URL.Path, "/local-image/") {
					filename := strings.TrimPrefix(r.URL.Path, "/local-image/")
					dir, err := imagestore.GetImageStoreDir()
					if err == nil {
						filePath := filepath.Join(dir, filename)
						http.ServeFile(w, r, filePath)
						return
					}
				}
				http.NotFound(w, r)
			}),
		},
		BackgroundColour: &options.RGBA{R: 0, G: 0, B: 0, A: 0}, // Set to transparent for Mica effect
		OnStartup: func(ctx context.Context) {
			// Restore position and maximize state
			if state, err := loadWindowState(); err == nil {
				if state.X != 0 || state.Y != 0 {
					wailsruntime.WindowSetPosition(ctx, state.X, state.Y)
				}
				if state.Max {
					wailsruntime.WindowMaximise(ctx)
				}
			}
			app.startup(ctx)
		},
		OnDomReady: func(ctx context.Context) {
			wailsruntime.WindowShow(ctx)
		},
		OnShutdown: func(ctx context.Context) {
			// Save window state
			isMax := wailsruntime.WindowIsMaximised(ctx)
			w, h := wailsruntime.WindowGetSize(ctx)
			x, y := wailsruntime.WindowGetPosition(ctx)
			
			state := windowState{
				Width:  w,
				Height: h,
				X:      x,
				Y:      y,
				Max:    isMax,
			}
			_ = saveWindowState(state)
		},
		Frameless:        true,
		Windows: &windows.Options{
			WebviewIsTransparent:              true,          // Transparency for glassmorphism
			WindowIsTranslucent:               true,          // Enable translucent window
			BackdropType:                      windows.Mica,  // Mica backdrop on Windows 11
			DisableFramelessWindowDecorations: false,         // Keep rounded corners and shadows
			WebviewUserDataPath:              getWebviewCacheDir(), // WebView2 cache path
			DisableWindowIcon:                 false,
			OnSuspend: func() {
				fmt.Println("💤 System entering suspend mode. Closing SQLite database safely...")
				_ = repository.CloseDB()
			},
			OnResume: func() {
				fmt.Println("☀️ System resumed from suspend. Re-opening SQLite database...")
				_, err := repository.InitDB()
				if err != nil {
					fmt.Printf("⚠️ Error re-opening database on resume: %v\n", err)
				}
				if app != nil && app.ctx != nil {
					wailsruntime.EventsEmit(app.ctx, "system-resumed")
				}
			},
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


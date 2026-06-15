package network

import (
	"beidar-desktop/internal/core/domain"
	"context"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"strconv"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

const (
	DefaultLanPort = 8765
)

func (s *lanService) StartServer(port int) error {
	s.serverMutex.Lock()
	defer s.serverMutex.Unlock()

	if s.server != nil {
		return fmt.Errorf("server already running")
	}

	if port == 0 {
		port = DefaultLanPort
	}

	s.serverMux = http.NewServeMux()
	s.setupRoutes(s.serverMux)

	var listener net.Listener
	var err error
	actualPort := port

	for tryPort := port; tryPort < port+20; tryPort++ {
		addr := fmt.Sprintf(":%d", tryPort)
		listener, err = net.Listen("tcp", addr)
		if err == nil {
			actualPort = tryPort
			break
		}
		fmt.Printf("Port %d busy, trying %d...\n", tryPort, tryPort+1)
	}

	if err != nil {
		return fmt.Errorf("لا يوجد بورت متاح للسيرفر")
	}

	s.server = &http.Server{
		Handler: s.serverMux,
	}
	s.actualPort = actualPort

	go func() {
		s.serverStatus = "running"
		fmt.Printf("🌐 LAN Server started on port %d\n", actualPort)
		if err := s.server.Serve(listener); err != nil && err != http.ErrServerClosed {
			fmt.Printf("LAN Server error: %v\n", err)
			s.serverMutex.Lock()
			s.serverStatus = "error"
			s.serverMutex.Unlock()
		}
	}()

	// Start UDP discovery broadcast
	if err := s.StartBroadcasting(actualPort); err != nil {
		fmt.Printf("⚠️ Failed to start UDP broadcast: %v\n", err)
	}

	return nil
}

func (s *lanService) StopServer() error {
	s.serverMutex.Lock()
	defer s.serverMutex.Unlock()

	s.StopBroadcasting()

	if s.server == nil {
		return nil
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	err := s.server.Shutdown(ctx)
	s.server = nil
	s.serverMux = nil
	s.serverStatus = "stopped"

	s.ClearAllClients()

	fmt.Println("🔌 LAN Server stopped")
	return err
}

func (s *lanService) IsServerRunning() bool {
	s.serverMutex.Lock()
	defer s.serverMutex.Unlock()
	return s.server != nil
}

func (s *lanService) GetServerStatus() domain.LanServerStatus {
	ip, _ := GetLocalIP()
	clients := s.GetConnectedClients()

	clientIPs := make([]string, len(clients))
	for i, c := range clients {
		clientIPs[i] = c.IPAddress
	}

	port := s.actualPort
	if port == 0 {
		port = DefaultLanPort
	}

	return domain.LanServerStatus{
		Running:     s.IsServerRunning(),
		LocalIP:     ip,
		Port:        port,
		ClientCount: len(clients),
		Clients:     clientIPs,
	}
}

// REST Route Handlers Setup
func (s *lanService) setupRoutes(mux *http.ServeMux) {
	// allowedCORSOrigins restricts cross-origin browser access to the Wails
	// webview (served from localhost) only. LAN clients talk plain HTTP without
	// a browser Origin header and are unaffected.
	allowedCORSOrigins := map[string]bool{
		"http://localhost:5173": true, // Vite dev server
		"http://127.0.0.1:5173": true,
		"http://wails.localhost": true,
		"https://wails.localhost": true,
		"http://localhost": true,
		"http://127.0.0.1": true,
	}

	corsMiddleware := func(next http.HandlerFunc) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			origin := r.Header.Get("Origin")
			if origin != "" && allowedCORSOrigins[origin] {
				w.Header().Set("Access-Control-Allow-Origin", origin)
				w.Header().Set("Vary", "Origin")
			}
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

			if r.Method == "OPTIONS" {
				w.WriteHeader(http.StatusOK)
				return
			}
			next(w, r)
		}
	}

	authMiddleware := func(next http.HandlerFunc) http.HandlerFunc {
		return corsMiddleware(func(w http.ResponseWriter, r *http.Request) {
			token := r.Header.Get("Authorization")
			if token == "" {
				http.Error(w, `{"error":"يجب تسجيل الدخول أولاً"}`, http.StatusUnauthorized)
				return
			}

			if len(token) > 7 && token[:7] == "Bearer " {
				token = token[7:]
			}

			client, err := s.ValidateSessionToken(token)
			if err != nil {
				http.Error(w, fmt.Sprintf(`{"error":"%s"}`, err.Error()), http.StatusUnauthorized)
				return
			}

			s.UpdateClientActivity(token)

			// Simple check for Role permission gates
			if client != nil && client.Role != "admin" {
				allowedCashierPosts := map[string]bool{
					"/api/sales/process": true,
					"/api/customers":     true,
					"/api/products":      true,
				}

				// Reject cashier from accessing sensitive GET admin/stats endpoints
				if r.Method == "GET" {
					if r.URL.Path == "/api/database/export" ||
						r.URL.Path == "/api/stats/dashboard" ||
						r.URL.Path == "/api/admin/clients" ||
						r.URL.Path == "/api/admin/blocked" {
						http.Error(w, `{"error":"غير مصرح لك بهذه العملية - صلاحيات المدير مطلوبة"}`, http.StatusForbidden)
						return
					}
				}

				if r.Method == "DELETE" {
					http.Error(w, `{"error":"غير مصرح لك بالحذف - صلاحيات المدير مطلوبة"}`, http.StatusForbidden)
					return
				}

				if r.Method == "POST" {
					if !allowedCashierPosts[r.URL.Path] {
						http.Error(w, `{"error":"غير مصرح لك بهذه العملية - صلاحيات المدير مطلوبة"}`, http.StatusForbidden)
						return
					}
				}
			}

			next(w, r)
		})
	}

	// Health check
	mux.HandleFunc("/api/ping", corsMiddleware(func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"status": "ok",
			"time":   time.Now().Unix(),
			"app":    "Beidar POS",
		})
	}))

	// Client Connect
	mux.HandleFunc("/api/connect", corsMiddleware(s.handleConnect))

	// Admin Endpoints - now protected under authMiddleware
	mux.HandleFunc("/api/admin/clients", authMiddleware(s.handleAdminClients))
	mux.HandleFunc("/api/admin/blocked", authMiddleware(s.handleAdminBlocked))

	// Protected Data Endpoints
	mux.HandleFunc("/api/products", authMiddleware(s.handleProducts))
	mux.HandleFunc("/api/products/detail", authMiddleware(s.handleProductDetail))
	mux.HandleFunc("/api/products/search", authMiddleware(s.handleProductSearch))
	mux.HandleFunc("/api/sales", authMiddleware(s.handleSales))
	mux.HandleFunc("/api/sales/process", authMiddleware(s.handleProcessSale))
	mux.HandleFunc("/api/customers", authMiddleware(s.handleCustomers))
	mux.HandleFunc("/api/suppliers", authMiddleware(s.handleSuppliers))
	mux.HandleFunc("/api/categories", authMiddleware(s.handleCategories))
	mux.HandleFunc("/api/expenses", authMiddleware(s.handleExpenses))
	mux.HandleFunc("/api/stats/dashboard", authMiddleware(s.handleDashboardStats))
	mux.HandleFunc("/api/preferences", authMiddleware(s.handlePreferences))
	mux.HandleFunc("/api/stock/movements", authMiddleware(s.handleStockMovements))
	mux.HandleFunc("/api/database/export", authMiddleware(s.handleDatabaseExport))
	mux.HandleFunc("/api/remote-scan", corsMiddleware(s.requireServerSecret(s.handleRemoteScan)))
}

// requireServerSecret gates an endpoint behind the shared server secret, read
// from either the Authorization Bearer header or an X-Server-Secret header.
// Endpoints that serve non-browser LAN devices (e.g. barcode scanners) use this
// instead of session-token auth. If no secret is configured, the endpoint is
// left open for backwards compatibility during first-time setup.
func (s *lanService) requireServerSecret(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		provided := r.Header.Get("X-Server-Secret")
		if provided == "" {
			if auth := r.Header.Get("Authorization"); len(auth) > 7 && auth[:7] == "Bearer " {
				provided = auth[7:]
			}
		}
		serverSecret := s.GetServerSecret()
		if serverSecret != "" && !s.ValidateServerSecret(provided) {
			http.Error(w, `{"error":"سر الخادم مطلوب وغير صحيح"}`, http.StatusUnauthorized)
			return
		}
		next(w, r)
	}
}

func (s *lanService) handleConnect(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != "POST" {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	// Cap request body size to protect against memory-exhaustion DoS.
	r.Body = http.MaxBytesReader(w, r.Body, 1<<20) // 1 MiB

	var req struct {
		DeviceID   string `json:"deviceId"`
		DeviceName string `json:"deviceName"`
		Secret     string `json:"secret"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Invalid request"}`, http.StatusBadRequest)
		return
	}

	// Enforce the shared server secret when one has been configured. This stops
	// arbitrary devices on the LAN from registering without the operator's key.
	if serverSecret := s.GetServerSecret(); serverSecret != "" {
		if !s.ValidateServerSecret(req.Secret) {
			http.Error(w, `{"error":"سر الخادم غير صحيح"}`, http.StatusUnauthorized)
			return
		}
	}

	token, err := s.RegisterClient(req.DeviceID, req.DeviceName, r.RemoteAddr)
	if err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"%s"}`, err.Error()), http.StatusForbidden)
		return
	}

	_ = json.NewEncoder(w).Encode(map[string]string{
		"status": "connected",
		"token":  token,
	})
}

func (s *lanService) handleAdminClients(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	switch r.Method {
	case "GET":
		clients := s.GetConnectedClients()
		_ = json.NewEncoder(w).Encode(clients)

	case "POST":
		r.Body = http.MaxBytesReader(w, r.Body, 1<<20) // 1 MiB
		var req struct {
			Action   string `json:"action"` // disconnect, suspend, resume, block
			DeviceID string `json:"deviceId"`
			Reason   string `json:"reason"`
		}

		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, `{"error":"Invalid request"}`, http.StatusBadRequest)
			return
		}

		var err error
		switch req.Action {
		case "disconnect":
			err = s.DisconnectClient(req.DeviceID)
		case "suspend":
			err = s.SuspendClient(req.DeviceID)
		case "resume":
			err = s.ResumeClient(req.DeviceID)
		case "block":
			clients := s.GetConnectedClients()
			deviceName := req.DeviceID
			for _, c := range clients {
				if c.DeviceID == req.DeviceID {
					deviceName = c.DeviceName
					break
				}
			}
			err = s.BlockDevice(req.DeviceID, deviceName, req.Reason)
		default:
			http.Error(w, `{"error":"Unknown action"}`, http.StatusBadRequest)
			return
		}

		if err != nil {
			http.Error(w, fmt.Sprintf(`{"error":"%s"}`, err.Error()), http.StatusInternalServerError)
			return
		}

		_ = json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
	}
}

func (s *lanService) handleAdminBlocked(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	switch r.Method {
	case "GET":
		devices, err := s.GetBlockedDevices()
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		_ = json.NewEncoder(w).Encode(devices)

	case "DELETE":
		r.Body = http.MaxBytesReader(w, r.Body, 1<<20) // 1 MiB
		var req struct {
			ID uint `json:"id"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, `{"error":"Invalid request"}`, http.StatusBadRequest)
			return
		}
		if err := s.UnblockDevice(req.ID); err != nil {
			http.Error(w, fmt.Sprintf(`{"error":"%s"}`, err.Error()), http.StatusInternalServerError)
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]string{"status": "unblocked"})
	}
}

func (s *lanService) handleProducts(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	switch r.Method {
	case "GET":
		products, err := s.productService.GetAllProducts()
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		// Wrap products in PaginatedProducts structure like old code expected
		type PaginatedProducts struct {
			Data  []domain.Product `json:"data"`
			Total int64            `json:"total"`
		}
		_ = json.NewEncoder(w).Encode(PaginatedProducts{Data: products, Total: int64(len(products))})

	case "POST":
		r.Body = http.MaxBytesReader(w, r.Body, 4<<20) // 4 MiB (products may have base64 images)
		var product domain.Product
		if err := json.NewDecoder(r.Body).Decode(&product); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		var err error
		if product.ID == "" {
			err = s.productService.CreateProduct(&product)
		} else {
			err = s.productService.UpdateProduct(&product)
		}
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]string{"status": "saved"})

	case "DELETE":
		id := r.URL.Query().Get("id")
		if err := s.productService.DeleteProduct(id); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]string{"status": "deleted"})
	}
}

func (s *lanService) handleProductDetail(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	id := r.URL.Query().Get("id")
	if id == "" {
		http.Error(w, `{"error":"id parameter is required"}`, http.StatusBadRequest)
		return
	}
	product, err := s.productService.GetProductByID(id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	_ = json.NewEncoder(w).Encode(product)
}

func (s *lanService) handleProductSearch(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	query := r.URL.Query().Get("q")
	products, err := s.productService.SearchProducts(query)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	_ = json.NewEncoder(w).Encode(products)
}

func (s *lanService) handleSales(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	switch r.Method {
	case "GET":
		id := r.URL.Query().Get("id")
		if id != "" {
			sale, err := s.saleService.GetSale(id)
			if err != nil {
				http.Error(w, err.Error(), http.StatusNotFound)
				return
			}
			_ = json.NewEncoder(w).Encode(sale)
			return
		}
		// Paginate the list instead of pulling 10,000 rows in one shot.
		page, pageSize := 1, 50
		if v := r.URL.Query().Get("page"); v != "" {
			if p, err := strconv.Atoi(v); err == nil && p > 0 {
				page = p
			}
		}
		if v := r.URL.Query().Get("pageSize"); v != "" {
			if ps, err := strconv.Atoi(v); err == nil && ps > 0 && ps <= 200 {
				pageSize = ps
			}
		}
		search := r.URL.Query().Get("search")
		statusFilter := r.URL.Query().Get("status")
		dateFilter := r.URL.Query().Get("date")
		sales, err := s.saleService.GetSales(page, pageSize, search, statusFilter, dateFilter)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		_ = json.NewEncoder(w).Encode(sales)

	case "DELETE":
		id := r.URL.Query().Get("id")
		if err := s.saleService.DeleteSale(id); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]string{"status": "deleted"})
	}
}

func (s *lanService) handleProcessSale(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, 4<<20) // 4 MiB (sales can carry many items)
	var sale domain.Sale
	if err := json.NewDecoder(r.Body).Decode(&sale); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if err := s.saleService.ProcessSale(&sale); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	_ = json.NewEncoder(w).Encode(map[string]string{"status": "processed"})
}

func (s *lanService) handleCustomers(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	switch r.Method {
	case "GET":
		customers, err := s.crmService.GetCustomers()
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		_ = json.NewEncoder(w).Encode(customers)

	case "POST":
		r.Body = http.MaxBytesReader(w, r.Body, 1<<20) // 1 MiB
		var customer domain.Customer
		if err := json.NewDecoder(r.Body).Decode(&customer); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		if err := s.crmService.SaveCustomer(customer); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]string{"status": "saved"})

	case "DELETE":
		id := r.URL.Query().Get("id")
		if err := s.crmService.DeleteCustomer(id, false); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]string{"status": "deleted"})
	}
}

func (s *lanService) handleSuppliers(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	switch r.Method {
	case "GET":
		suppliers, err := s.crmService.GetSuppliers()
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		_ = json.NewEncoder(w).Encode(suppliers)

	case "POST":
		r.Body = http.MaxBytesReader(w, r.Body, 1<<20) // 1 MiB
		var supplier domain.Supplier
		if err := json.NewDecoder(r.Body).Decode(&supplier); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		if err := s.crmService.SaveSupplier(supplier); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]string{"status": "saved"})

	case "DELETE":
		id := r.URL.Query().Get("id")
		if err := s.crmService.DeleteSupplier(id, false); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]string{"status": "deleted"})
	}
}

func (s *lanService) handleCategories(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	switch r.Method {
	case "GET":
		categories, err := s.financeService.GetCategories()
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		_ = json.NewEncoder(w).Encode(categories)

	case "POST":
		r.Body = http.MaxBytesReader(w, r.Body, 1<<20) // 1 MiB
		var category domain.Category
		if err := json.NewDecoder(r.Body).Decode(&category); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		if err := s.financeService.SaveCategory(category); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]string{"status": "saved"})

	case "DELETE":
		id := r.URL.Query().Get("id")
		if err := s.financeService.DeleteCategory(id, false); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]string{"status": "deleted"})
	}
}

func (s *lanService) handleExpenses(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	switch r.Method {
	case "GET":
		expenses, err := s.financeService.GetExpenses()
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		_ = json.NewEncoder(w).Encode(expenses)

	case "POST":
		r.Body = http.MaxBytesReader(w, r.Body, 1<<20) // 1 MiB
		var expense domain.Expense
		if err := json.NewDecoder(r.Body).Decode(&expense); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		if err := s.financeService.SaveExpense(expense); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]string{"status": "saved"})

	case "DELETE":
		id := r.URL.Query().Get("id")
		if err := s.financeService.DeleteExpense(id); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]string{"status": "deleted"})
	}
}

func (s *lanService) handleDashboardStats(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	timeRange := r.URL.Query().Get("range")
	if timeRange == "" {
		timeRange = "week"
	}
	// In statsService, we didn't have a parameter for range. Wait, statsService has GetDashboardStats()
	// Let's verify what s.statsService.GetDashboardStats() expects. It expects no arguments?
	// Let's call it and ignore timeRange if not supported, or let's check stats service logic.
	stats, err := s.statsService.GetDashboardStats(timeRange)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	_ = json.NewEncoder(w).Encode(stats)
}

func (s *lanService) handlePreferences(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	switch r.Method {
	case "GET":
		prefs, err := s.settingsService.GetPreferences()
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		// Scrub secrets before sending to LAN clients — they only need store
		// identity, currency, tax, and printing prefs, never the admin PIN or
		// AI API keys.
		prefs.AdminPin = ""
		prefs.GeminiAPIKey = ""
		prefs.GeminiAPIKeys = nil
		_ = json.NewEncoder(w).Encode(prefs)

	case "POST":
		r.Body = http.MaxBytesReader(w, r.Body, 1<<20) // 1 MiB
		var prefs domain.AppPreferences
		if err := json.NewDecoder(r.Body).Decode(&prefs); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		if err := s.settingsService.UpdatePreferences(prefs); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]string{"status": "saved"})
	}
}

func (s *lanService) handleStockMovements(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	movements, err := s.productService.GetStockMovements()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	_ = json.NewEncoder(w).Encode(movements)
}

func (s *lanService) handleDatabaseExport(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	data, err := s.backupService.ExportDatabase()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	_ = json.NewEncoder(w).Encode(data)
}

func (s *lanService) handleRemoteScan(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != "POST" {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, 1<<20) // 1 MiB

	type ScannerPayload struct {
		Code   string `json:"code"`
		Type   string `json:"type"`
		Device string `json:"device,omitempty"`
	}

	var payload ScannerPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, `{"error":"Invalid request payload"}`, http.StatusBadRequest)
		return
	}

	if payload.Code == "" {
		http.Error(w, `{"error":"Barcode is empty"}`, http.StatusBadRequest)
		return
	}

	fmt.Printf("📲 Remote Scan Received: %s [%s]\n", payload.Code, payload.Type)

	s.ctxMutex.RLock()
	ctx := s.ctx
	s.ctxMutex.RUnlock()

	if ctx != nil {
		runtime.EventsEmit(ctx, "remote-scan-received", payload)
		_ = json.NewEncoder(w).Encode(map[string]string{"status": "success", "message": "Scanned"})
	} else {
		http.Error(w, `{"error":"Desktop app not ready"}`, http.StatusServiceUnavailable)
	}
}

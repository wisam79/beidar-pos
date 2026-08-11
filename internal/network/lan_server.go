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

	// Ensure a server secret exists before serving any traffic so LAN
	// registration and scanner endpoints are never left open. The secret is
	// generated once per process run and shown to the operator through the
	// settings screen (LanHandler.GetServerSecret).
	if s.GetServerSecret() == "" {
		if _, err := s.GenerateServerSecret(); err != nil {
			return fmt.Errorf("فشل توليد سر الخادم: %w", err)
		}
		fmt.Println("🔑 Generated new LAN server secret")
	}

	s.server = &http.Server{
		Handler:           s.serverMux,
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
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

			ipAddress := r.RemoteAddr
			if host, _, err := net.SplitHostPort(r.RemoteAddr); err == nil {
				ipAddress = host
			}

			client, err := s.ValidateSessionToken(token, ipAddress)
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
				}

				// Reject cashier from accessing sensitive admin/stats endpoints (any HTTP method)
				if r.URL.Path == "/api/database/export" ||
					r.URL.Path == "/api/stats/dashboard" ||
					r.URL.Path == "/api/stats/comparison" ||
					r.URL.Path == "/api/expenses" ||
					r.URL.Path == "/api/stock/movements" ||
					r.URL.Path == "/api/admin/clients" ||
					r.URL.Path == "/api/admin/blocked" {
					http.Error(w, `{"error":"غير مصرح لك بهذه العملية - صلاحيات المدير مطلوبة"}`, http.StatusForbidden)
					return
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
	mux.HandleFunc("/api/products", authMiddleware(s.notifyDataChange(s.handleProducts)))
	mux.HandleFunc("/api/products/detail", authMiddleware(s.handleProductDetail))
	mux.HandleFunc("/api/products/search", authMiddleware(s.handleProductSearch))
	mux.HandleFunc("/api/sales", authMiddleware(s.notifyDataChange(s.handleSales)))
	mux.HandleFunc("/api/sales/process", authMiddleware(s.notifyDataChange(s.handleProcessSale)))
	mux.HandleFunc("/api/sales/return", authMiddleware(s.notifyDataChange(s.handleSalesReturn)))
	mux.HandleFunc("/api/sales/return-partial", authMiddleware(s.notifyDataChange(s.handleSalesReturnPartial)))
	mux.HandleFunc("/api/customers", authMiddleware(s.notifyDataChange(s.handleCustomers)))
	mux.HandleFunc("/api/suppliers", authMiddleware(s.notifyDataChange(s.handleSuppliers)))
	mux.HandleFunc("/api/categories", authMiddleware(s.notifyDataChange(s.handleCategories)))
	mux.HandleFunc("/api/expenses", authMiddleware(s.notifyDataChange(s.handleExpenses)))
	mux.HandleFunc("/api/stats/dashboard", authMiddleware(s.handleDashboardStats))
	mux.HandleFunc("/api/stats/comparison", authMiddleware(s.handleMonthlyComparisonStats))
	mux.HandleFunc("/api/preferences", authMiddleware(s.notifyDataChange(s.handlePreferences)))
	mux.HandleFunc("/api/stock/movements", authMiddleware(s.handleStockMovements))
	mux.HandleFunc("/api/database/export", authMiddleware(s.handleDatabaseExport))
	mux.HandleFunc("/api/remote-scan", corsMiddleware(s.requireServerSecret(s.handleRemoteScan)))
}

// statusWriter captures the HTTP status code so we can tell whether a write
// request actually succeeded before broadcasting a data-change event.
type statusWriter struct {
	http.ResponseWriter
	status int
}

func (w *statusWriter) WriteHeader(code int) {
	w.status = code
	w.ResponseWriter.WriteHeader(code)
}

func (w *statusWriter) Write(b []byte) (int, error) {
	if w.status == 0 {
		w.status = http.StatusOK
	}
	return w.ResponseWriter.Write(b)
}

// notifyDataChange emits a "data-changed" Wails event after a successful (2xx)
// write request (POST/DELETE) so the server's own UI refreshes when a LAN
// client modifies data. Read-only requests pass through untouched.
func (s *lanService) notifyDataChange(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet || r.Method == http.MethodOptions {
			next(w, r)
			return
		}
		rw := &statusWriter{ResponseWriter: w}
		next(rw, r)
		if rw.status >= 200 && rw.status < 300 {
			s.ctxMutex.RLock()
			ctx := s.ctx
			s.ctxMutex.RUnlock()
			if ctx != nil {
				runtime.EventsEmit(ctx, "data-changed", r.URL.Path)
			}
		}
	}
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

	// Per-IP rate limit: slow down credential brute-forcing on /api/connect with Tarpitting.
	if delay := s.getConnectTarpitDelay(r.RemoteAddr); delay > 0 {
		time.Sleep(delay)
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

	// Store the host-only IP so subsequent session validation (which compares
	// against the host portion of RemoteAddr) can match. Passing RemoteAddr
	// verbatim would include the ephemeral client port and make every session
	// validation fail with "different IP address".
	clientIP := r.RemoteAddr
	if host, _, err := net.SplitHostPort(r.RemoteAddr); err == nil {
		clientIP = host
	}

	token, err := s.RegisterClient(req.DeviceID, req.DeviceName, clientIP)
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

func (s *lanService) handleSalesReturn(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	id := r.URL.Query().Get("id")
	if id == "" {
		http.Error(w, "Missing id", http.StatusBadRequest)
		return
	}

	if err := s.saleService.ReturnSale(id); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	_ = json.NewEncoder(w).Encode(map[string]string{"status": "returned"})
}

func (s *lanService) handleSalesReturnPartial(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	saleID := r.URL.Query().Get("saleId")
	productID := r.URL.Query().Get("productId")
	qtyStr := r.URL.Query().Get("qty")

	if saleID == "" || productID == "" || qtyStr == "" {
		http.Error(w, "Missing parameters", http.StatusBadRequest)
		return
	}

	qty, err := strconv.ParseFloat(qtyStr, 64)
	if err != nil {
		http.Error(w, "Invalid quantity", http.StatusBadRequest)
		return
	}

	if err := s.saleService.ReturnSalePartial(saleID, productID, qty); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	_ = json.NewEncoder(w).Encode(map[string]string{"status": "returned"})
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
		month := r.URL.Query().Get("month")
		expenses, err := s.financeService.GetExpenses(month)
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
	if r.Method != http.MethodGet {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}
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

func (s *lanService) handleMonthlyComparisonStats(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodGet {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}
	comp, err := s.statsService.GetMonthlyComparison()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	_ = json.NewEncoder(w).Encode(comp)
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
		prefs.GroqAPIKey = ""
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
	if r.Method != http.MethodGet {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}
	movements, err := s.productService.GetStockMovements()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	_ = json.NewEncoder(w).Encode(movements)
}

func (s *lanService) handleDatabaseExport(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodGet {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}
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

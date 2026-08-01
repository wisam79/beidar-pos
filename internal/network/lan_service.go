package network

import (
	"beidar-desktop/internal/core/domain"
	"context"
	"net"
	"net/http"
	"sync"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// LanService coordinates server, client discovery, client management, and API calls.
type LanService interface {
	// Startup binds the Wails context
	Startup(ctx context.Context)

	// Server Management
	StartServer(port int) error
	StopServer() error
	GetServerStatus() domain.LanServerStatus
	IsServerRunning() bool

	// Client Connection (Local machine as a client to a remote server)
	ConnectToServer(serverIP string, port int, secret string) error
	DisconnectFromServer()
	GetClientStatus() domain.LanClientStatus
	IsClientMode() bool
	DiscoverServers() ([]domain.DiscoveredServer, error)
	TestConnection() string

	// Client Management (On the server machine, managing connected clients)
	GetConnectedClients() []domain.ConnectedClient
	DisconnectClient(deviceID string) error
	SuspendClient(deviceID string) error
	ResumeClient(deviceID string) error
	BlockDevice(deviceID, deviceName, reason string) error
	UnblockDevice(id uint) error
	GetBlockedDevices() ([]domain.BlockedDevice, error)
	GenerateServerSecret() (string, error)
	GetServerSecret() string
	ValidateServerSecret(secret string) bool

	// Remote REST client wrappers (called by handlers when IsClientMode() is true)
	RemoteGet(endpoint string, result interface{}) error
	RemotePost(endpoint string, data interface{}, result interface{}) error
	RemoteDelete(endpoint string) error
}

// connectRateEntry tracks per-IP rate limiting for /api/connect
type connectRateEntry struct {
	count   int
	expires time.Time
}

const (
	connectRateWindow  = time.Minute
	connectRateMaxPerIP = 10
)

// allowConnectRateLimit reports whether the given remote address is still
// within the allowed connect-attempt budget. False means the caller must
// reject the attempt (HTTP 429) to slow down credential brute-forcing.
func (s *lanService) allowConnectRateLimit(remoteAddr string) bool {
	ip, _, err := net.SplitHostPort(remoteAddr)
	if err != nil {
		ip = remoteAddr
	}

	s.connectRateMutex.Lock()
	defer s.connectRateMutex.Unlock()

	now := time.Now()
	entry, ok := s.connectRateLimits[ip]
	if !ok || now.After(entry.expires) {
		s.connectRateLimits[ip] = &connectRateEntry{count: 1, expires: now.Add(connectRateWindow)}
		return true
	}
	entry.count++
	if entry.count > connectRateMaxPerIP {
		return false
	}
	return true
}

type lanService struct {
	ctx             context.Context
	ctxMutex        sync.RWMutex
	networkRepo     domain.NetworkRepository
	productService  domain.ProductService
	saleService     domain.SaleService
	crmService      domain.CRMService
	financeService  domain.FinanceService
	statsService    domain.StatsService
	settingsService domain.SettingsService
	backupService   domain.BackupService
	staffService    domain.StaffService

	// Server state
	server          *http.Server
	serverMux       *http.ServeMux
	serverMutex     sync.Mutex
	serverStatus    string // "stopped", "running", "error"
	actualPort      int
	secret          string
	secretMutex     sync.RWMutex

	// Per-IP rate limiting for /api/connect
	connectRateLimits map[string]*connectRateEntry
	connectRateMutex  sync.Mutex

	// Clients list (on server)
	connectedClients map[string]*domain.ConnectedClient
	clientsMutex     sync.RWMutex

	// Client state (on client connecting to server)
	clientMode     bool
	serverAddress  string
	sessionToken   string
	clientMutex    sync.RWMutex
	httpClient     *http.Client

	// UDP Discovery state
	isBroadcasting  bool
	broadcastCancel context.CancelFunc
	broadcastMutex  sync.Mutex
}

// NewLanService creates a new instance of LanService
func NewLanService(
	networkRepo domain.NetworkRepository,
	productService domain.ProductService,
	saleService domain.SaleService,
	crmService domain.CRMService,
	financeService domain.FinanceService,
	statsService domain.StatsService,
	settingsService domain.SettingsService,
	backupService domain.BackupService,
	staffService domain.StaffService,
) LanService {
	return &lanService{
		networkRepo:      networkRepo,
		productService:   productService,
		saleService:      saleService,
		crmService:       crmService,
		financeService:   financeService,
		statsService:     statsService,
		settingsService:  settingsService,
		backupService:    backupService,
		staffService:     staffService,
		serverStatus:     "stopped",
		connectedClients: make(map[string]*domain.ConnectedClient),
		connectRateLimits: make(map[string]*connectRateEntry),
		httpClient:       &http.Client{Timeout: 10 * time.Second},
	}
}

func (s *lanService) Startup(ctx context.Context) {
	s.ctxMutex.Lock()
	s.ctx = ctx
	s.ctxMutex.Unlock()

	// Start background network connectivity checking loop
	go s.startConnectivityBroadcaster(ctx)
}

func (s *lanService) startConnectivityBroadcaster(ctx context.Context) {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	client := &http.Client{Timeout: 3 * time.Second}
	lastStatus := false

	// Initial check
	online := checkOnlineStatus(client)
	runtime.EventsEmit(ctx, "network-status", online)
	lastStatus = online

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			online := checkOnlineStatus(client)
			if online != lastStatus {
				runtime.EventsEmit(ctx, "network-status", online)
				lastStatus = online
			}
			// Clean up inactive LAN clients (inactive for > 5 minutes)
			s.CleanupInactiveClients(300)
		}
	}
}

func checkOnlineStatus(client *http.Client) bool {
	// Simple HTTP HEAD request to check internet access
	resp, err := client.Head("https://api.supabase.com")
	if err == nil {
		resp.Body.Close()
		return true
	}

	// Fallback check
	resp, err = client.Head("https://www.google.com")
	if err == nil {
		resp.Body.Close()
		return true
	}

	return false
}

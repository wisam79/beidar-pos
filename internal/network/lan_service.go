package network

import (
	"beidar-desktop/internal/core/domain"
	"beidar-desktop/internal/service"
	"context"
	"net/http"
	"sync"
	"time"
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
	ConnectToServer(serverIP string, port int) error
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
	GenerateServerSecret() string
	GetServerSecret() string
	ValidateServerSecret(secret string) bool

	// Remote REST client wrappers (called by handlers when IsClientMode() is true)
	RemoteGet(endpoint string, result interface{}) error
	RemotePost(endpoint string, data interface{}, result interface{}) error
	RemoteDelete(endpoint string) error
}

type lanService struct {
	ctx             context.Context
	ctxMutex        sync.RWMutex
	networkRepo     domain.NetworkRepository
	productService  service.ProductService
	saleService     service.SaleService
	crmService      service.CRMService
	financeService  service.FinanceService
	statsService    service.StatsService
	settingsService service.SettingsService
	backupService   service.BackupService

	// Server state
	server          *http.Server
	serverMux       *http.ServeMux
	serverMutex     sync.Mutex
	serverStatus    string // "stopped", "running", "error"
	actualPort      int
	secret          string
	secretMutex     sync.RWMutex

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
	broadcastConn *http.Server // Not HTTP but we keep UDP handles in lan_discovery.go
	isBroadcasting bool
}

// NewLanService creates a new instance of LanService
func NewLanService(
	networkRepo domain.NetworkRepository,
	productService service.ProductService,
	saleService service.SaleService,
	crmService service.CRMService,
	financeService service.FinanceService,
	statsService service.StatsService,
	settingsService service.SettingsService,
	backupService service.BackupService,
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
		serverStatus:     "stopped",
		connectedClients: make(map[string]*domain.ConnectedClient),
		httpClient:       &http.Client{Timeout: 10 * time.Second},
	}
}

func (s *lanService) Startup(ctx context.Context) {
	s.ctxMutex.Lock()
	s.ctx = ctx
	s.ctxMutex.Unlock()
}

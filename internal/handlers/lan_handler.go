package handlers

import (
	"beidar-desktop/internal/core/domain"
	"beidar-desktop/internal/network"
	"context"
)

type LanHandler struct {
	ctx        context.Context
	lanService network.LanService
}

func NewLanHandler(lanService network.LanService) *LanHandler {
	return &LanHandler{
		lanService: lanService,
	}
}

func (h *LanHandler) Startup(ctx context.Context) {
	h.ctx = ctx
	h.lanService.Startup(ctx)
}

func (h *LanHandler) StartLanServer() error {
	// Start on default port
	return h.lanService.StartServer(network.DefaultLanPort)
}

func (h *LanHandler) StopLanServer() error {
	return h.lanService.StopServer()
}

func (h *LanHandler) GetLanServerStatus() domain.LanServerStatus {
	return h.lanService.GetServerStatus()
}

func (h *LanHandler) ConnectToLanServer(serverIP string, port int) error {
	return h.lanService.ConnectToServer(serverIP, port)
}

func (h *LanHandler) DisconnectFromLanServer() {
	h.lanService.DisconnectFromServer()
}

func (h *LanHandler) GetLanClientStatus() domain.LanClientStatus {
	return h.lanService.GetClientStatus()
}

func (h *LanHandler) GetLocalIP() (string, error) {
	return network.GetLocalIP()
}

func (h *LanHandler) DiscoverServers() ([]domain.DiscoveredServer, error) {
	return h.lanService.DiscoverServers()
}

func (h *LanHandler) TestLanConnection() string {
	return h.lanService.TestConnection()
}

func (h *LanHandler) GenerateServerSecret() string {
	return h.lanService.GenerateServerSecret()
}

func (h *LanHandler) GetServerSecret() string {
	return h.lanService.GetServerSecret()
}

func (h *LanHandler) GetConnectedClients() []domain.ConnectedClient {
	return h.lanService.GetConnectedClients()
}

func (h *LanHandler) DisconnectLanClient(deviceID string) error {
	return h.lanService.DisconnectClient(deviceID)
}

func (h *LanHandler) SuspendLanClient(deviceID string) error {
	return h.lanService.SuspendClient(deviceID)
}

func (h *LanHandler) ResumeLanClient(deviceID string) error {
	return h.lanService.ResumeClient(deviceID)
}

func (h *LanHandler) BlockLanDevice(deviceID, deviceName, reason string) error {
	return h.lanService.BlockDevice(deviceID, deviceName, reason)
}

func (h *LanHandler) UnblockLanDevice(id uint) error {
	return h.lanService.UnblockDevice(id)
}

func (h *LanHandler) GetBlockedDevices() ([]domain.BlockedDevice, error) {
	return h.lanService.GetBlockedDevices()
}

package handlers

import (
	"beidar-desktop/internal/core/domain"
	"beidar-desktop/internal/network"
	"beidar-desktop/pkg/auth"
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
	if err := auth.RequirePermission(auth.PermSettings); err != nil {
		return err
	}
	// Start on default port
	return h.lanService.StartServer(network.DefaultLanPort)
}

func (h *LanHandler) StopLanServer() error {
	if err := auth.RequirePermission(auth.PermSettings); err != nil {
		return err
	}
	return h.lanService.StopServer()
}

func (h *LanHandler) GetLanServerStatus() domain.LanServerStatus {
	return h.lanService.GetServerStatus()
}

func (h *LanHandler) ConnectToLanServer(serverIP string, port int, secret string) error {
	if err := auth.RequirePermission(auth.PermSettings); err != nil {
		return err
	}
	return h.lanService.ConnectToServer(serverIP, port, secret)
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
	if err := auth.Require(); err != nil {
		return nil, err
	}
	return h.lanService.DiscoverServers()
}

func (h *LanHandler) TestLanConnection() string {
	return h.lanService.TestConnection()
}

func (h *LanHandler) GenerateServerSecret() (string, error) {
	if err := auth.RequirePermission(auth.PermSettings); err != nil {
		return "", err
	}
	return h.lanService.GenerateServerSecret()
}

func (h *LanHandler) GetServerSecret() string {
	if err := auth.RequirePermission(auth.PermSettings); err != nil {
		return ""
	}
	return h.lanService.GetServerSecret()
}

func (h *LanHandler) GetConnectedClients() []domain.ConnectedClient {
	if err := auth.Require(); err != nil {
		return nil
	}
	return h.lanService.GetConnectedClients()
}

func (h *LanHandler) DisconnectLanClient(deviceID string) error {
	if err := auth.RequirePermission(auth.PermSettings); err != nil {
		return err
	}
	return h.lanService.DisconnectClient(deviceID)
}

func (h *LanHandler) SuspendLanClient(deviceID string) error {
	if err := auth.RequirePermission(auth.PermSettings); err != nil {
		return err
	}
	return h.lanService.SuspendClient(deviceID)
}

func (h *LanHandler) ResumeLanClient(deviceID string) error {
	if err := auth.RequirePermission(auth.PermSettings); err != nil {
		return err
	}
	return h.lanService.ResumeClient(deviceID)
}

func (h *LanHandler) BlockLanDevice(deviceID, deviceName, reason string) error {
	if err := auth.RequirePermission(auth.PermSettings); err != nil {
		return err
	}
	return h.lanService.BlockDevice(deviceID, deviceName, reason)
}

func (h *LanHandler) UnblockLanDevice(id uint) error {
	if err := auth.RequirePermission(auth.PermSettings); err != nil {
		return err
	}
	return h.lanService.UnblockDevice(id)
}

func (h *LanHandler) GetBlockedDevices() ([]domain.BlockedDevice, error) {
	if err := auth.Require(); err != nil {
		return nil, err
	}
	return h.lanService.GetBlockedDevices()
}

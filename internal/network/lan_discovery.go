package network

import (
	"beidar-desktop/internal/core/domain"
	"context"
	"encoding/json"
	"fmt"
	"net"
	"time"
)

// UDP Discovery Configuration
const (
	DiscoveryPort         = 9765
	DiscoveryMagic        = "BEIDAR_POS_V1"
	BroadcastInterval     = 5 * time.Second
	DiscoveryScanDuration = 2 * time.Second
)

type DiscoveryMessage struct {
	Magic      string `json:"magic"`
	ServerName string `json:"serverName"`
	ServerIP   string `json:"serverIP"`
	Port       int    `json:"port"`
	DeviceID   string `json:"deviceId"`
}

// GetLocalIP returns the local IP address of this machine
func GetLocalIP() (string, error) {
	addrs, err := net.InterfaceAddrs()
	if err != nil {
		return "", err
	}

	for _, addr := range addrs {
		if ipnet, ok := addr.(*net.IPNet); ok && !ipnet.IP.IsLoopback() {
			if ipnet.IP.To4() != nil {
				ip := ipnet.IP.String()
				// Prefer private IPs
				if isPrivateIP(ip) {
					return ip, nil
				}
			}
		}
	}

	return "127.0.0.1", nil
}

func isPrivateIP(ipStr string) bool {
	parsedIP := net.ParseIP(ipStr)
	if parsedIP == nil {
		return false
	}
	return parsedIP.IsPrivate() || parsedIP.IsLoopback()
}

// StartBroadcasting begins UDP broadcast for server discovery
func (s *lanService) StartBroadcasting(httpPort int) error {
	s.broadcastMutex.Lock()
	defer s.broadcastMutex.Unlock()

	if s.isBroadcasting {
		return nil
	}

	s.actualPort = httpPort

	localIP, err := GetLocalIP()
	if err != nil {
		return fmt.Errorf("failed to get local IP: %w", err)
	}

	addr, err := net.ResolveUDPAddr("udp4", fmt.Sprintf(":%d", DiscoveryPort))
	if err != nil {
		return fmt.Errorf("failed to resolve UDP address: %w", err)
	}

	conn, err := net.ListenUDP("udp4", addr)
	if err != nil {
		// Try alternative ports if busy
		for altPort := DiscoveryPort + 1; altPort < DiscoveryPort+10; altPort++ {
			addr, _ = net.ResolveUDPAddr("udp4", fmt.Sprintf(":%d", altPort))
			conn, err = net.ListenUDP("udp4", addr)
			if err == nil {
				break
			}
		}
		if err != nil {
			return fmt.Errorf("failed to create UDP socket: %w", err)
		}
	}

	ctx, cancel := context.WithCancel(context.Background())
	s.broadcastCancel = cancel
	s.isBroadcasting = true

	deviceID, _ := s.settingsService.GetDeviceID()
	hostname := "Beidar POS Server"

	msg := DiscoveryMessage{
		Magic:      DiscoveryMagic,
		ServerName: hostname,
		ServerIP:   localIP,
		Port:       httpPort,
		DeviceID:   deviceID,
	}
	msgBytes, _ := json.Marshal(msg)

	go func(ctx context.Context, conn *net.UDPConn) {
		ticker := time.NewTicker(BroadcastInterval)
		defer ticker.Stop()
		defer conn.Close()

		broadcastAddr, _ := net.ResolveUDPAddr("udp4", "255.255.255.255:"+fmt.Sprint(DiscoveryPort))
		fmt.Printf("📡 Starting UDP discovery broadcast on port %d\n", DiscoveryPort)

		for {
			select {
			case <-ctx.Done():
				fmt.Println("📡 Stopping UDP discovery broadcast safely")
				return
			case <-ticker.C:
				_, _ = conn.WriteToUDP(msgBytes, broadcastAddr)
			}
		}
	}(ctx, conn)

	return nil
}

// StopBroadcasting stops the UDP broadcast
func (s *lanService) StopBroadcasting() {
	s.broadcastMutex.Lock()
	defer s.broadcastMutex.Unlock()

	if !s.isBroadcasting {
		return
	}

	if s.broadcastCancel != nil {
		s.broadcastCancel()
		s.broadcastCancel = nil
	}
	s.isBroadcasting = false
}

// DiscoverServers scans for available Beidar servers on the network
func (s *lanService) DiscoverServers() ([]domain.DiscoveredServer, error) {
	servers := make([]domain.DiscoveredServer, 0)
	serverMap := make(map[string]*domain.DiscoveredServer)

	fmt.Println("🔍 Scanning for Beidar servers...")

	// Try UDP discovery first
	udpServers := s.discoverViaUDP()
	for i := range udpServers {
		srv := udpServers[i]
		serverMap[srv.DeviceID] = &srv
	}

	// If no servers found via UDP (maybe same machine), try local check
	if len(serverMap) == 0 {
		localServer := s.discoverLocalServer()
		if localServer != nil {
			serverMap[localServer.DeviceID] = localServer
		}
	}

	// Convert map to slice
	for _, server := range serverMap {
		servers = append(servers, *server)
	}

	fmt.Printf("🔍 Scan complete. Found %d server(s)\n", len(servers))
	return servers, nil
}

func (s *lanService) discoverViaUDP() []domain.DiscoveredServer {
	servers := make([]domain.DiscoveredServer, 0)

	conn, err := net.ListenUDP("udp4", &net.UDPAddr{Port: DiscoveryPort})
	if err != nil {
		conn, err = net.ListenUDP("udp4", nil)
		if err != nil {
			fmt.Printf("⚠️ UDP discovery failed: %v\n", err)
			return servers
		}
	}
	defer conn.Close()

	_ = conn.SetReadDeadline(time.Now().Add(DiscoveryScanDuration))

	buffer := make([]byte, 1024)

	for {
		n, remoteAddr, err := conn.ReadFromUDP(buffer)
		if err != nil {
			break
		}

		var msg DiscoveryMessage
		if err := json.Unmarshal(buffer[:n], &msg); err != nil {
			continue
		}

		if msg.Magic != DiscoveryMagic {
			continue
		}

		if msg.ServerIP == "" || msg.ServerIP == "127.0.0.1" {
			msg.ServerIP = remoteAddr.IP.String()
		}

		servers = append(servers, domain.DiscoveredServer{
			ServerName: msg.ServerName,
			ServerIP:   msg.ServerIP,
			Port:       msg.Port,
			DeviceID:   msg.DeviceID,
			LastSeen:   time.Now().Unix(),
		})

		fmt.Printf("📡 Found server via UDP: %s at %s:%d\n", msg.ServerName, msg.ServerIP, msg.Port)
	}

	return servers
}

func (s *lanService) discoverLocalServer() *domain.DiscoveredServer {
	portsToCheck := []int{DefaultLanPort}
	for i := 1; i < 10; i++ {
		portsToCheck = append(portsToCheck, DefaultLanPort+i)
	}

	localIP, _ := GetLocalIP()

	for _, port := range portsToCheck {
		client := &net.Dialer{Timeout: 500 * time.Millisecond}
		conn, err := client.Dial("tcp", fmt.Sprintf("127.0.0.1:%d", port))
		if err != nil {
			continue
		}
		conn.Close()

		deviceID, _ := s.settingsService.GetDeviceID()
		fmt.Printf("📡 Found local server at port %d\n", port)
		return &domain.DiscoveredServer{
			ServerName: "Local Beidar Server",
			ServerIP:   localIP,
			Port:       port,
			DeviceID:   deviceID + "_local",
			LastSeen:   time.Now().Unix(),
		}
	}

	return nil
}

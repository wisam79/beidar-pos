package domain

// ConnectedClient represents an active LAN client connection
type ConnectedClient struct {
	DeviceID     string `json:"deviceId"`
	DeviceName   string `json:"deviceName"`
	IPAddress    string `json:"ipAddress"`
	ConnectedAt  int64  `json:"connectedAt"`
	LastActivity int64  `json:"lastActivity"`
	Status       string `json:"status"` // "active", "suspended"
	SessionToken string `json:"sessionToken,omitempty"`
	Role         string `json:"role"` // "cashier", "viewer", "admin"
}

// BlockedDevice represents a permanently blocked device (stored in DB)
type BlockedDevice struct {
	ID         uint   `gorm:"primaryKey;autoIncrement" json:"id"`
	DeviceID   string `gorm:"uniqueIndex" json:"deviceId"`
	DeviceName string `json:"deviceName"`
	BlockedAt  int64  `json:"blockedAt"`
	Reason     string `json:"reason"`
}

// LanServerStatus represents the current server state
type LanServerStatus struct {
	Running     bool     `json:"running"`
	LocalIP     string   `json:"localIP"`
	Port        int      `json:"port"`
	ClientCount int      `json:"clientCount"`
	Clients     []string `json:"clients"`
}

// LanClientStatus represents the current client state
type LanClientStatus struct {
	Connected     bool   `json:"connected"`
	ServerAddress string `json:"serverAddress"`
	Mode          string `json:"mode"` // "standalone", "server", "client"
}

// DiscoveredServer represents a server found on the network
type DiscoveredServer struct {
	ServerName string `json:"serverName"`
	ServerIP   string `json:"serverIP"`
	Port        int    `json:"port"`
	DeviceID   string `json:"deviceId"`
	LastSeen   int64  `json:"lastSeen"`
}

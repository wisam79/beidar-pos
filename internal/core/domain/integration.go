package domain

// UserSession represents the logged-in user session
type UserSession struct {
	UserID        string       `json:"user_id"`
	Email         string       `json:"email"`
	StoreName     string       `json:"store_name"`
	AccessToken   string       `json:"access_token"`
	RefreshToken  string       `json:"refresh_token"`
	SessionToken  string       `json:"session_token"`
	ExpiresAt     int64        `json:"expires_at"`
	BackupLimitMB int          `json:"backup_limit_mb"`
	MaxBackups    int          `json:"max_backups"`
	Features      UserFeatures `json:"features"`
}

// UserFeatures defines toggleable capabilities
type UserFeatures struct {
	EnableAI       bool `json:"enable_ai"`
	EnableLAN      bool `json:"enable_lan"`
	EnableWhatsApp bool `json:"enable_whatsapp"`
}

// SupabaseAuthResult for login/register operations
type SupabaseAuthResult struct {
	Success bool        `json:"success"`
	Message string      `json:"message"`
	User    UserSession `json:"user,omitempty"`
}

// CloudBackup represents a backup record
type CloudBackup struct {
	ID        string `json:"id"`
	UserID    string `json:"user_id"`
	StoreName string `json:"store_name"`
	SizeBytes int64  `json:"size_bytes"`
	Chunks    int    `json:"chunks"`
	CreatedAt string `json:"created_at"`
}

// LicenseResult is returned from license operations
type LicenseResult struct {
	Licensed       bool            `json:"licensed"`
	Success        bool            `json:"success"`
	Message        string          `json:"message"`
	CustomerName   string          `json:"customerName,omitempty"`
	CustomerPhone  string          `json:"customerPhone,omitempty"`
	StoreName      string          `json:"storeName,omitempty"`
	Features       map[string]bool `json:"features"`
	ExpiresAt      string          `json:"expiresAt,omitempty"`
	CachedAt       int64           `json:"cachedAt,omitempty"`
	LastServerTime int64           `json:"lastServerTime,omitempty"`
}

// LicenseInfo for admin dashboard listing
type LicenseInfo struct {
	ID            int             `json:"id"`
	LicenseKey    string          `json:"license_key"`
	CustomerName  string          `json:"customer_name"`
	CustomerPhone string          `json:"customer_phone"`
	StoreName     string          `json:"store_name"`
	Status        string          `json:"status"`
	ExpiresAt     string          `json:"expires_at"`
	CreatedAt     string          `json:"created_at"`
	UserID        string          `json:"device_id"` // Keep as device_id for frontend compatibility
	BoundAt       string          `json:"bound_at"`
	LastCheckIn   string          `json:"last_check_in"`
	AppVersion    string          `json:"app_version"`
	Features      map[string]bool `json:"features"`
	IsPaid        bool            `json:"is_paid"`
}

// AdminLoginResult for developer dashboard login
type AdminLoginResult struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
}

// AdminLogEntry for audit logs
type AdminLogEntry struct {
	ID            int    `json:"id"`
	AdminUsername string `json:"admin_username"`
	Action        string `json:"action"`
	TargetLicense string `json:"target_license"`
	Details       string `json:"details"`
	CreatedAt     string `json:"created_at"`
}

// UserDetails contains detailed info about a bound user
type UserDetails struct {
	UserID     string                 `json:"user_id"`
	Email      string                 `json:"email"`
	StoreName  string                 `json:"store_name"`
	CreatedAt  string                 `json:"created_at"`
	LastSignIn string                 `json:"last_sign_in"`
	Backups    []DashboardBackupInfo  `json:"backups"`
	Sessions   []DashboardSessionInfo `json:"sessions"`
}

// DashboardBackupInfo for user backups in dashboard
type DashboardBackupInfo struct {
	ID        string `json:"id"`
	BackupID  string `json:"backup_id"`
	StoreName string `json:"store_name"`
	Size      int64  `json:"size"`
	CreatedAt string `json:"created_at"`
}

// DashboardSessionInfo for active sessions in dashboard
type DashboardSessionInfo struct {
	DeviceName string `json:"device_name"`
	LoginTime  string `json:"login_time"`
	LastSeen   string `json:"last_seen"`
}

// ZohoConfig holds Zoho Books credentials
type ZohoConfig struct {
	ClientID       string `json:"clientId"`
	ClientSecret   string `json:"clientSecret"`
	RefreshToken   string `json:"refreshToken"`
	AccessToken    string `json:"accessToken"`
	OrganizationID string `json:"organizationId"`
	TokenExpiry    int64  `json:"tokenExpiry"`
	Enabled        bool   `json:"enabled"`
}

// ZohoTokenResponse from OAuth
type ZohoTokenResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	ExpiresIn    int64  `json:"expires_in"`
	TokenType    string `json:"token_type"`
	Error        string `json:"error"`
}

// ZohoInvoice represents a Zoho Books invoice
type ZohoInvoice struct {
	CustomerID      string         `json:"customer_id,omitempty"`
	CustomerName    string         `json:"customer_name,omitempty"`
	Date            string         `json:"date"`
	LineItems       []ZohoLineItem `json:"line_items"`
	Notes           string         `json:"notes,omitempty"`
	ReferenceNumber string         `json:"reference_number,omitempty"`
}

// ZohoLineItem for invoice
type ZohoLineItem struct {
	Name        string  `json:"name"`
	Description string  `json:"description,omitempty"`
	Rate        float64 `json:"rate"`
	Quantity    float64 `json:"quantity"`
}

// SyncQueue for offline Zoho sales
type ZohoSyncQueue struct {
	SaleID    string    `json:"saleId"`
	CreatedAt string    `json:"createdAt"`
	Retries   int       `json:"retries"`
}

// SessionValidityResult for session check
type SessionValidityResult struct {
	Valid   bool   `json:"valid"`
	Message string `json:"message"`
}

package network

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/sha256"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"fmt"
	"math/big"
	"net"
	"os"
	"path/filepath"
	"strings"
	"time"

	"beidar-desktop/pkg/crypto"
	"beidar-desktop/pkg/secureconfig"
)

// CalculateCertFingerprint returns a formatted SHA-256 fingerprint string (e.g. "AA:BB:CC:...").
func CalculateCertFingerprint(certDER []byte) string {
	hash := sha256.Sum256(certDER)
	var hexParts []string
	for _, b := range hash {
		hexParts = append(hexParts, fmt.Sprintf("%02X", b))
	}
	return strings.Join(hexParts, ":")
}

// GetAllLocalIPs enumerates all non-loopback IPv4 addresses on local interfaces.
func GetAllLocalIPs() []net.IP {
	var ips []net.IP
	interfaces, err := net.Interfaces()
	if err != nil {
		return []net.IP{net.ParseIP("127.0.0.1")}
	}

	for _, iface := range interfaces {
		if iface.Flags&net.FlagUp == 0 {
			continue // interface down
		}
		addrs, err := iface.Addrs()
		if err != nil {
			continue
		}
		for _, addr := range addrs {
			var ip net.IP
			switch v := addr.(type) {
			case *net.IPNet:
				ip = v.IP
			case *net.IPAddr:
				ip = v.IP
			}
			if ip != nil && ip.To4() != nil {
				ips = append(ips, ip)
			}
		}
	}

	if len(ips) == 0 {
		ips = append(ips, net.ParseIP("127.0.0.1"))
	}
	return ips
}

func getLanCertPaths() (certPath string, keyEncPath string, err error) {
	configDir, err := os.UserConfigDir()
	if err != nil {
		return "", "", err
	}
	dir := filepath.Join(configDir, "BeidarPOS_V3")
	_ = os.MkdirAll(dir, 0755)
	return filepath.Join(dir, "lan_cert.pem"), filepath.Join(dir, "lan_key.enc"), nil
}

// deriveLanTLSKey derives a 32-byte AES key bound to this machine.
func deriveLanTLSKey() []byte {
	host, _ := os.Hostname()
	machineID := secureconfig.MachineID()
	seed := fmt.Sprintf("beidar-v3-lan-tls-%s-%s", host, machineID)
	return crypto.DeriveKey(seed)
}

// GenerateSelfSignedCert creates a new ECDSA P-256 certificate valid for all local IPs and hostnames.
func GenerateSelfSignedCert(ips []net.IP, hostname string) (tls.Certificate, string, []byte, []byte, error) {
	priv, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		return tls.Certificate{}, "", nil, nil, fmt.Errorf("failed to generate ecdsa key: %w", err)
	}

	serialNumberLimit := new(big.Int).Lsh(big.NewInt(1), 128)
	serialNumber, err := rand.Int(rand.Reader, serialNumberLimit)
	if err != nil {
		return tls.Certificate{}, "", nil, nil, fmt.Errorf("failed to generate serial number: %w", err)
	}

	if hostname == "" {
		hostname = "beidar.local"
	}

	dnsNames := []string{"localhost", hostname, "beidar.local"}
	ipList := append([]net.IP{net.ParseIP("127.0.0.1"), net.ParseIP("::1")}, ips...)

	template := x509.Certificate{
		SerialNumber: serialNumber,
		Subject: pkix.Name{
			Organization: []string{"Beidar POS LAN Server"},
			CommonName:   hostname,
		},
		NotBefore:             time.Now().Add(-1 * time.Hour),
		NotAfter:              time.Now().Add(10 * 365 * 24 * time.Hour), // 10 years validity
		KeyUsage:              x509.KeyUsageDigitalSignature | x509.KeyUsageKeyEncipherment,
		ExtKeyUsage:           []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth, x509.ExtKeyUsageClientAuth},
		BasicConstraintsValid: true,
		DNSNames:              dnsNames,
		IPAddresses:           ipList,
	}

	certDER, err := x509.CreateCertificate(rand.Reader, &template, &template, &priv.PublicKey, priv)
	if err != nil {
		return tls.Certificate{}, "", nil, nil, fmt.Errorf("failed to create certificate: %w", err)
	}

	certPEM := pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: certDER})

	keyBytes, err := x509.MarshalECPrivateKey(priv)
	if err != nil {
		return tls.Certificate{}, "", nil, nil, fmt.Errorf("failed to marshal private key: %w", err)
	}
	keyPEM := pem.EncodeToMemory(&pem.Block{Type: "EC PRIVATE KEY", Bytes: keyBytes})

	tlsCert, err := tls.X509KeyPair(certPEM, keyPEM)
	if err != nil {
		return tls.Certificate{}, "", nil, nil, fmt.Errorf("failed to parse generated key pair: %w", err)
	}

	fingerprint := CalculateCertFingerprint(certDER)
	return tlsCert, fingerprint, certPEM, keyPEM, nil
}

// GetOrGenerateServerCert retrieves or generates the TLS certificate and fingerprint for the LAN server.
func GetOrGenerateServerCert() (tlsCert tls.Certificate, fingerprint string, err error) {
	certPath, keyEncPath, err := getLanCertPaths()
	if err != nil {
		return tls.Certificate{}, "", err
	}

	machineKey := deriveLanTLSKey()

	// Try loading existing cert and encrypted key
	if certData, errCert := os.ReadFile(certPath); errCert == nil {
		if encKeyData, errKey := os.ReadFile(keyEncPath); errKey == nil {
			decryptedKeyPEM, errDec := crypto.Decrypt(string(encKeyData), machineKey)
			if errDec == nil {
				parsedCert, errPair := tls.X509KeyPair(certData, decryptedKeyPEM)
				if errPair == nil && len(parsedCert.Certificate) > 0 {
					// Verify certificate validity
					leaf, errLeaf := x509.ParseCertificate(parsedCert.Certificate[0])
					if errLeaf == nil && time.Now().Before(leaf.NotAfter.Add(-24*time.Hour)) {
						return parsedCert, CalculateCertFingerprint(parsedCert.Certificate[0]), nil
					}
				}
			}
		}
	}

	// Generate a new certificate
	hostname, _ := os.Hostname()
	localIPs := GetAllLocalIPs()

	tlsCert, fingerprint, certPEM, keyPEM, err := GenerateSelfSignedCert(localIPs, hostname)
	if err != nil {
		return tls.Certificate{}, "", err
	}

	// Save cert as plaintext PEM
	if err := os.WriteFile(certPath, certPEM, 0644); err != nil {
		return tlsCert, fingerprint, fmt.Errorf("failed to save cert file: %w", err)
	}

	// Encrypt and save private key
	encryptedKeyStr, err := crypto.Encrypt(keyPEM, machineKey)
	if err != nil {
		return tlsCert, fingerprint, fmt.Errorf("failed to encrypt private key: %w", err)
	}

	if err := os.WriteFile(keyEncPath, []byte(encryptedKeyStr), 0600); err != nil {
		return tlsCert, fingerprint, fmt.Errorf("failed to save encrypted key: %w", err)
	}

	return tlsCert, fingerprint, nil
}

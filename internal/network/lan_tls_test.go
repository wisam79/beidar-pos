package network

import (
	"crypto/tls"
	"crypto/x509"
	"net"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestCalculateCertFingerprint(t *testing.T) {
	sampleDER := []byte("dummy certificate content for fingerprint testing")
	fp := CalculateCertFingerprint(sampleDER)

	parts := strings.Split(fp, ":")
	if len(parts) != 32 {
		t.Fatalf("Expected 32 hex bytes in SHA-256 fingerprint, got %d (fp: %s)", len(parts), fp)
	}

	for _, p := range parts {
		if len(p) != 2 {
			t.Errorf("Invalid hex part length %q in %s", p, fp)
		}
	}
}

func TestGenerateSelfSignedCert(t *testing.T) {
	testIPs := []net.IP{net.ParseIP("192.168.1.100")}
	hostname := "pos-terminal-01"

	tlsCert, fingerprint, certPEM, keyPEM, err := GenerateSelfSignedCert(testIPs, hostname)
	if err != nil {
		t.Fatalf("GenerateSelfSignedCert failed: %v", err)
	}

	if len(certPEM) == 0 || len(keyPEM) == 0 {
		t.Fatal("Expected non-empty cert and key PEM bytes")
	}

	if fingerprint == "" {
		t.Fatal("Expected non-empty certificate fingerprint")
	}

	if len(tlsCert.Certificate) == 0 {
		t.Fatal("Expected at least one certificate in tls.Certificate")
	}

	leaf, err := x509.ParseCertificate(tlsCert.Certificate[0])
	if err != nil {
		t.Fatalf("Failed to parse generated x509 cert: %v", err)
	}

	// Verify Subject Common Name
	if leaf.Subject.CommonName != hostname {
		t.Errorf("CommonName = %q, want %q", leaf.Subject.CommonName, hostname)
	}

	// Verify IP SANs
	hasLocalhost := false
	hasCustomIP := false
	for _, ip := range leaf.IPAddresses {
		if ip.String() == "127.0.0.1" {
			hasLocalhost = true
		}
		if ip.String() == "192.168.1.100" {
			hasCustomIP = true
		}
	}
	if !hasLocalhost || !hasCustomIP {
		t.Errorf("Missing expected IPs in SANs: got %v", leaf.IPAddresses)
	}

	// Verify DNS SANs
	hasHostDNS := false
	for _, dns := range leaf.DNSNames {
		if dns == hostname {
			hasHostDNS = true
		}
	}
	if !hasHostDNS {
		t.Errorf("Missing hostname %q in DNSNames %v", hostname, leaf.DNSNames)
	}

	// Verify validity
	if time.Now().Before(leaf.NotBefore) || time.Now().After(leaf.NotAfter) {
		t.Errorf("Certificate outside valid range: %v to %v", leaf.NotBefore, leaf.NotAfter)
	}
}

func TestGetOrGenerateServerCert(t *testing.T) {
	// First call should generate and cache
	cert1, fp1, err := GetOrGenerateServerCert()
	if err != nil {
		t.Fatalf("GetOrGenerateServerCert first call failed: %v", err)
	}
	if fp1 == "" {
		t.Fatal("Expected non-empty fingerprint")
	}

	// Second call should return the same certificate from disk
	cert2, fp2, err := GetOrGenerateServerCert()
	if err != nil {
		t.Fatalf("GetOrGenerateServerCert second call failed: %v", err)
	}

	if fp1 != fp2 {
		t.Errorf("Expected identical fingerprint on subsequent call, got %s vs %s", fp1, fp2)
	}

	if len(cert1.Certificate) != len(cert2.Certificate) {
		t.Errorf("Certificate length mismatch: %d vs %d", len(cert1.Certificate), len(cert2.Certificate))
	}
}

func TestTLSClient_MatchingFingerprint(t *testing.T) {
	tlsCert, fingerprint, _, _, err := GenerateSelfSignedCert([]net.IP{net.ParseIP("127.0.0.1")}, "localhost")
	if err != nil {
		t.Fatalf("Failed to generate test cert: %v", err)
	}

	ts := httptest.NewUnstartedServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("secure-pos-data"))
	}))
	ts.TLS = &tls.Config{
		Certificates: []tls.Certificate{tlsCert},
		MinVersion:   tls.VersionTLS13,
	}
	ts.StartTLS()
	defer ts.Close()

	// Client with matching fingerprint
	expectedFP := fingerprint
	client := createSecureHTTPClient(&expectedFP)

	resp, err := client.Get(ts.URL)
	if err != nil {
		t.Fatalf("HTTPS GET with matching fingerprint failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("Status code = %d, want 200", resp.StatusCode)
	}
}

func TestTLSClient_MismatchingFingerprint(t *testing.T) {
	tlsCert, _, _, _, err := GenerateSelfSignedCert([]net.IP{net.ParseIP("127.0.0.1")}, "localhost")
	if err != nil {
		t.Fatalf("Failed to generate test cert: %v", err)
	}

	ts := httptest.NewUnstartedServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	ts.TLS = &tls.Config{
		Certificates: []tls.Certificate{tlsCert},
		MinVersion:   tls.VersionTLS13,
	}
	ts.StartTLS()
	defer ts.Close()

	// Client with wrong expected fingerprint
	wrongFP := "AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99"
	client := createSecureHTTPClient(&wrongFP)

	_, err = client.Get(ts.URL)
	if err == nil {
		t.Fatal("Expected error due to certificate fingerprint mismatch, but request succeeded")
	}

	if !strings.Contains(err.Error(), "بصمة شهادة الخادم غير مطابقة") && !strings.Contains(err.Error(), "mismatch") {
		t.Logf("Got expected connection failure: %v", err)
	}
}

func TestGetAllLocalIPs(t *testing.T) {
	ips := GetAllLocalIPs()
	if len(ips) == 0 {
		t.Fatal("Expected at least 1 local IP address")
	}

	hasValidIP := false
	for _, ip := range ips {
		if ip.To4() != nil {
			hasValidIP = true
			break
		}
	}
	if !hasValidIP {
		t.Error("Expected at least one IPv4 address in GetAllLocalIPs")
	}
}

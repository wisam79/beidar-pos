package network

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// newRemoteTestService builds a client-mode service bound to a plain HTTP test
// server. The remote helpers are transport-agnostic, so LAN TLS is not needed
// to exercise their request, response, and error handling.
func newRemoteTestService(serverURL string) *lanService {
	return &lanService{
		serverAddress: serverURL,
		sessionToken:  "session-token",
		httpClient:    &http.Client{},
		clientMode:    true,
	}
}

func remoteTestService(t *testing.T, handler http.HandlerFunc) *lanService {
	t.Helper()
	server := httptest.NewServer(handler)
	t.Cleanup(server.Close)
	return newRemoteTestService(server.URL)
}

// ─── RemoteGet ──────────────────────────────────────────────────────────────

func TestRemoteGet_NotConnected(t *testing.T) {
	var out map[string]bool
	if err := (&lanService{}).RemoteGet("/api/products", &out); err == nil {
		t.Fatal("expected an error when no server address or token is set")
	}
}

func TestRemoteGet_Success(t *testing.T) {
	var gotAuth string
	svc := remoteTestService(t, func(w http.ResponseWriter, r *http.Request) {
		gotAuth = r.Header.Get("Authorization")
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"ok":true}`))
	})

	var out map[string]bool
	if err := svc.RemoteGet("/api/products", &out); err != nil {
		t.Fatalf("RemoteGet: %v", err)
	}
	if !out["ok"] {
		t.Errorf("decoded payload = %v, want ok=true", out)
	}
	if gotAuth != "Bearer session-token" {
		t.Errorf("Authorization header = %q, want the session bearer token", gotAuth)
	}
}

func TestRemoteGet_UnauthorizedSession(t *testing.T) {
	svc := remoteTestService(t, func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
	})

	var out map[string]bool
	err := svc.RemoteGet("/api/products", &out)
	if err == nil || !strings.Contains(err.Error(), "جلسة غير صالحة") {
		t.Fatalf("error = %v, want an invalid-session error", err)
	}
}

func TestRemoteGet_ServerError(t *testing.T) {
	svc := remoteTestService(t, func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
		_, _ = w.Write([]byte("boom"))
	})

	var out map[string]bool
	err := svc.RemoteGet("/api/products", &out)
	if err == nil || !strings.Contains(err.Error(), "boom") {
		t.Fatalf("error = %v, want the server error body to be surfaced", err)
	}
}

func TestRemoteGet_InvalidJSON(t *testing.T) {
	svc := remoteTestService(t, func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte("not-json"))
	})

	var out map[string]bool
	if err := svc.RemoteGet("/api/products", &out); err == nil {
		t.Fatal("expected a decode error for a non-JSON body")
	}
}

// ─── RemotePost ─────────────────────────────────────────────────────────────

func TestRemotePost_Success(t *testing.T) {
	var gotContentType, gotBody string
	svc := remoteTestService(t, func(w http.ResponseWriter, r *http.Request) {
		gotContentType = r.Header.Get("Content-Type")
		raw := make([]byte, 64)
		n, _ := r.Body.Read(raw)
		gotBody = string(raw[:n])
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"id":"created-1"}`))
	})

	var out map[string]string
	if err := svc.RemotePost("/api/sales", map[string]string{"total": "100"}, &out); err != nil {
		t.Fatalf("RemotePost: %v", err)
	}
	if out["id"] != "created-1" {
		t.Errorf("decoded payload = %v, want id=created-1", out)
	}
	if gotContentType != "application/json" {
		t.Errorf("Content-Type = %q, want application/json", gotContentType)
	}
	if !strings.Contains(gotBody, "100") {
		t.Errorf("request body = %q, want the marshalled payload", gotBody)
	}
}

func TestRemotePost_NilResult(t *testing.T) {
	svc := remoteTestService(t, func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	if err := svc.RemotePost("/api/heartbeat", map[string]string{"ping": "1"}, nil); err != nil {
		t.Fatalf("RemotePost with nil result: %v", err)
	}
}

func TestRemotePost_MarshalFailure(t *testing.T) {
	svc := newRemoteTestService("http://127.0.0.1:1")
	if err := svc.RemotePost("/api/sales", make(chan int), nil); err == nil {
		t.Fatal("expected a marshal error for an unsupported payload type")
	}
}

func TestRemotePost_NotConnected(t *testing.T) {
	if err := (&lanService{}).RemotePost("/api/sales", map[string]string{}, nil); err == nil {
		t.Fatal("expected an error when no server address or token is set")
	}
}

func TestRemotePost_UnauthorizedSession(t *testing.T) {
	svc := remoteTestService(t, func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
	})

	err := svc.RemotePost("/api/sales", map[string]string{}, nil)
	if err == nil || !strings.Contains(err.Error(), "جلسة غير صالحة") {
		t.Fatalf("error = %v, want an invalid-session error", err)
	}
}

func TestRemotePost_ServerError(t *testing.T) {
	svc := remoteTestService(t, func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusBadRequest)
		_, _ = w.Write([]byte("rejected"))
	})

	err := svc.RemotePost("/api/sales", map[string]string{}, nil)
	if err == nil || !strings.Contains(err.Error(), "rejected") {
		t.Fatalf("error = %v, want the server error body to be surfaced", err)
	}
}

// ─── RemoteDelete ───────────────────────────────────────────────────────────

func TestRemoteDelete_Success(t *testing.T) {
	var gotMethod string
	svc := remoteTestService(t, func(w http.ResponseWriter, r *http.Request) {
		gotMethod = r.Method
		w.WriteHeader(http.StatusOK)
	})

	if err := svc.RemoteDelete("/api/parked-sales/1"); err != nil {
		t.Fatalf("RemoteDelete: %v", err)
	}
	if gotMethod != http.MethodDelete {
		t.Errorf("method = %q, want DELETE", gotMethod)
	}
}

func TestRemoteDelete_NotConnected(t *testing.T) {
	if err := (&lanService{}).RemoteDelete("/api/parked-sales/1"); err == nil {
		t.Fatal("expected an error when no server address or token is set")
	}
}

func TestRemoteDelete_UnauthorizedSession(t *testing.T) {
	svc := remoteTestService(t, func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
	})

	err := svc.RemoteDelete("/api/parked-sales/1")
	if err == nil || !strings.Contains(err.Error(), "جلسة غير صالحة") {
		t.Fatalf("error = %v, want an invalid-session error", err)
	}
}

func TestRemoteDelete_ServerError(t *testing.T) {
	svc := remoteTestService(t, func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusForbidden)
		_, _ = w.Write([]byte("denied"))
	})

	err := svc.RemoteDelete("/api/parked-sales/1")
	if err == nil || !strings.Contains(err.Error(), "denied") {
		t.Fatalf("error = %v, want the server error body to be surfaced", err)
	}
}

// ─── TestConnection ─────────────────────────────────────────────────────────

func TestTestConnection_NotConnected(t *testing.T) {
	got := (&lanService{}).TestConnection()
	if !strings.Contains(got, "Not connected") {
		t.Errorf("TestConnection() = %q, want a not-connected message", got)
	}
}

func TestTestConnection_ShortResponse(t *testing.T) {
	svc := remoteTestService(t, func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(`{"ok":true}`))
	})

	got := svc.TestConnection()
	if !strings.Contains(got, "Complete Response") || !strings.Contains(got, "ok") {
		t.Errorf("TestConnection() = %q, want the complete short response", got)
	}
}

func TestTestConnection_LongResponseIsPreviewed(t *testing.T) {
	svc := remoteTestService(t, func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(strings.Repeat("x", 900)))
	})

	got := svc.TestConnection()
	if !strings.Contains(got, "Success") || !strings.Contains(got, "...") {
		t.Errorf("TestConnection() = %q, want a truncated preview", got)
	}
}

func TestTestConnection_NetworkError(t *testing.T) {
	// A closed listener guarantees a transport error instead of an HTTP response.
	server := httptest.NewServer(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {}))
	svc := newRemoteTestService(server.URL)
	server.Close()

	got := svc.TestConnection()
	if !strings.Contains(got, "Network Error") {
		t.Errorf("TestConnection() = %q, want a network error message", got)
	}
}

// ─── GetClientStatus ────────────────────────────────────────────────────────

func TestGetClientStatus_Standalone(t *testing.T) {
	status := (&lanService{}).GetClientStatus()
	if status.Mode != "standalone" || status.Connected {
		t.Errorf("standalone status = %+v, want mode=standalone and not connected", status)
	}
}

func TestGetClientStatus_ServerMode(t *testing.T) {
	status := (&lanService{server: &http.Server{}}).GetClientStatus()
	if status.Mode != "server" || status.Connected {
		t.Errorf("server status = %+v, want mode=server and not connected", status)
	}
}

func TestGetClientStatus_ClientModeOverTLS(t *testing.T) {
	svc := &lanService{
		clientMode:              true,
		serverAddress:           "https://192.168.1.20:9765",
		serverFingerprintClient: "AA:BB",
	}

	status := svc.GetClientStatus()
	if !status.Connected || status.Mode != "client" {
		t.Errorf("status = %+v, want a connected client", status)
	}
	if !status.UseTLS {
		t.Error("UseTLS = false, want true for an https server address")
	}
	if status.Fingerprint != "AA:BB" {
		t.Errorf("Fingerprint = %q, want the stored fingerprint", status.Fingerprint)
	}
}

// ─── IsClientMode ───────────────────────────────────────────────────────────

func TestIsClientMode(t *testing.T) {
	if (&lanService{}).IsClientMode() {
		t.Error("IsClientMode() = true for an unconfigured service")
	}
	if !(&lanService{clientMode: true}).IsClientMode() {
		t.Error("IsClientMode() = false for a client-mode service")
	}
}

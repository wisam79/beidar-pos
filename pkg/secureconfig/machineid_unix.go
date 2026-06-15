//go:build !windows

package secureconfig

import "os"

// readMachineID returns a stable per-machine identifier on Unix systems by
// reading the OS-provided machine-id files.
func readMachineID() string {
	paths := []string{
		"/etc/machine-id",
		"/var/lib/dbus/machine-id",
	}
	for _, p := range paths {
		if data, err := os.ReadFile(p); err == nil {
			return string(data)
		}
	}
	// Fallback: hostname-derived so the key at least varies per host.
	host, _ := os.Hostname()
	if host == "" {
		return "unix-unknown"
	}
	return host
}

//go:build windows

package secureconfig

import (
	"os"
)

// readMachineID returns the Windows MachineGuid from the registry on Windows.
// This uniquely identifies the machine and binds the encryption key to the
// device. If the registry query fails we fall back to a constant so secrets can
// still be read/written, though with weaker binding.
func readMachineID() string {
	guid, err := readMachineGuidFromRegistry()
	if err == nil && guid != "" {
		return guid
	}
	// Final fallback: hostname-derived so at least it varies per host.
	host, _ := os.Hostname()
	if host == "" {
		return "windows-unknown"
	}
	return host
}

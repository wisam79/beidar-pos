//go:build !windows

package main

func checkSingleInstance() (func(), error) {
	// Stubs for non-Windows platforms (e.g. Linux during CI)
	cleanup := func() {}
	return cleanup, nil
}

//go:build windows

package main

import (
	"fmt"
	syswin "golang.org/x/sys/windows"
)

func checkSingleInstance() (func(), error) {
	mutexName := "BeidarPOS_SingleInstance_Mutex"
	h, err := syswin.CreateMutex(nil, false, syswin.StringToUTF16Ptr(mutexName))
	if err != nil {
		return nil, fmt.Errorf("error creating named mutex: %w", err)
	}

	if syswin.GetLastError() == syswin.ERROR_ALREADY_EXISTS {
		syswin.CloseHandle(h)
		return nil, fmt.Errorf("application instance already running")
	}

	cleanup := func() {
		syswin.CloseHandle(h)
	}
	return cleanup, nil
}

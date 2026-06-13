package imagestore

import (
	"encoding/base64"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

const (
	// ImageServerPort is the local port for serving images
	ImageServerPort = "48123"

	// ImagesDir is the directory name for storing images
	ImagesDir = "images"
)

var (
	imageStoreDir string // Computed at runtime
	imageServer   *http.Server
)

// GetImageStoreDir returns the path to the image store directory
func GetImageStoreDir() (string, error) {
	if imageStoreDir != "" {
		return imageStoreDir, nil
	}

	configDir, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}

	imageStoreDir = filepath.Join(configDir, "BeidarPOS", ImagesDir)
	if err := os.MkdirAll(imageStoreDir, 0755); err != nil {
		return "", err
	}

	return imageStoreDir, nil
}

// StartImageServer starts a local HTTP server to serve images
func StartImageServer() error {
	dir, err := GetImageStoreDir()
	if err != nil {
		return fmt.Errorf("failed to get image store dir: %v", err)
	}

	// Create a file server handler with CORS for Wails
	fs := http.FileServer(http.Dir(dir))
	mux := http.NewServeMux()

	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		w.Header().Set("Cache-Control", "public, max-age=31536000") // 1 year cache

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		fs.ServeHTTP(w, r)
	})

	imageServer = &http.Server{
		Addr:         "127.0.0.1:" + ImageServerPort,
		Handler:      mux,
		ReadTimeout:  5 * time.Second,
		WriteTimeout: 10 * time.Second,
	}

	go func() {
		fmt.Printf("🖼️ Image server started on http://127.0.0.1:%s\n", ImageServerPort)
		if err := imageServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			fmt.Printf("Image server error: %v\n", err)
		}
	}()

	return nil
}

// StopImageServer gracefully shuts down the image server
func StopImageServer() {
	if imageServer != nil {
		_ = imageServer.Close()
	}
}

// GetImageURL returns the full URL for an image filename
func GetImageURL(filename string) string {
	if filename == "" {
		return ""
	}
	if strings.HasPrefix(filename, "http") || strings.HasPrefix(filename, "data:") {
		return filename
	}
	if len(filename) < 10 && !strings.Contains(filename, ".") {
		return filename
	}
	return fmt.Sprintf("http://127.0.0.1:%s/%s", ImageServerPort, filename)
}

// SaveImageFromBase64 decodes a Base64 image and saves it to disk
func SaveImageFromBase64(base64Data, productID string) (string, error) {
	if base64Data == "" {
		return "", nil
	}

	if !strings.HasPrefix(base64Data, "data:image") && !isValidBase64Image(base64Data) {
		return base64Data, nil
	}

	parts := strings.Split(base64Data, ",")
	var data string
	var ext string

	if len(parts) == 2 {
		data = parts[1]
		if strings.Contains(parts[0], "png") {
			ext = ".png"
		} else if strings.Contains(parts[0], "webp") {
			ext = ".webp"
		} else {
			ext = ".jpg"
		}
	} else {
		data = base64Data
		ext = ".jpg"
	}

	decoded, err := base64.StdEncoding.DecodeString(data)
	if err != nil {
		return "", fmt.Errorf("failed to decode base64: %v", err)
	}

	filename := fmt.Sprintf("prod_%s%s", sanitizeFilename(productID), ext)

	dir, err := GetImageStoreDir()
	if err != nil {
		return "", err
	}

	filePath := filepath.Join(dir, filename)
	if err := os.WriteFile(filePath, decoded, 0644); err != nil {
		return "", fmt.Errorf("failed to write image file: %v", err)
	}

	fmt.Printf("💾 Saved image: %s (%d KB)\n", filename, len(decoded)/1024)
	return filename, nil
}

// DeleteImage removes an image file from disk
func DeleteImage(filename string) error {
	if filename == "" || !strings.Contains(filename, ".") {
		return nil
	}

	dir, err := GetImageStoreDir()
	if err != nil {
		return err
	}

	filePath := filepath.Join(dir, filename)
	if err := os.Remove(filePath); err != nil && !os.IsNotExist(err) {
		return err
	}

	return nil
}

func isValidBase64Image(s string) bool {
	if len(s) < 100 {
		return false
	}

	for _, c := range s[:50] {
		if !((c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') ||
			(c >= '0' && c <= '9') || c == '+' || c == '/' || c == '=') {
			return false
		}
	}

	return true
}

func sanitizeFilename(s string) string {
	replacer := strings.NewReplacer(
		"/", "_",
		"\\", "_",
		":", "_",
		"*", "_",
		"?", "_",
		"\"", "_",
		"<", "_",
		">", "_",
		"|", "_",
		" ", "_",
	)
	return replacer.Replace(s)
}

// GetDirectoryStats counts images on disk and returns total bytes
func GetDirectoryStats() (int, int64, error) {
	dir, err := GetImageStoreDir()
	if err != nil {
		return 0, 0, err
	}

	entries, err := os.ReadDir(dir)
	if err != nil {
		return 0, 0, err
	}

	totalImages := 0
	var totalSizeBytes int64

	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		info, err := entry.Info()
		if err != nil {
			continue
		}
		totalImages++
		totalSizeBytes += info.Size()
	}

	return totalImages, totalSizeBytes, nil
}

package imagestore

import (
	"encoding/base64"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
)

const (
	// ImageServerPort is the local port for serving images
	ImageServerPort = "48123"

	// ImagesDir is the directory name for storing images
	ImagesDir = "images"
)

var (
	imageStoreDir string // Computed at runtime
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

	imageStoreDir = filepath.Join(configDir, "BeidarPOS_V3", ImagesDir)
	if err := os.MkdirAll(imageStoreDir, 0755); err != nil {
		return "", err
	}

	// Migrate legacy images from BeidarPOS to BeidarPOS_V3 if they exist
	legacyDir := filepath.Join(configDir, "BeidarPOS", ImagesDir)
	if _, err := os.Stat(legacyDir); err == nil {
		if entries, err := os.ReadDir(legacyDir); err == nil {
			for _, entry := range entries {
				if !entry.IsDir() {
					oldPath := filepath.Join(legacyDir, entry.Name())
					newPath := filepath.Join(imageStoreDir, entry.Name())
					if _, err := os.Stat(newPath); os.IsNotExist(err) {
						_ = copyFile(oldPath, newPath)
					}
				}
			}
		}
	}

	return imageStoreDir, nil
}

func copyFile(src, dst string) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()

	out, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer out.Close()

	_, err = io.Copy(out, in)
	if err != nil {
		return err
	}
	return out.Sync()
}

// StartImageServer is an empty stub because images are served natively via Wails AssetHandler
func StartImageServer() error {
	fmt.Println("🖼️ Images will be served natively via Wails Custom AssetHandler")
	return nil
}

// StopImageServer is an empty stub because images are served natively via Wails AssetHandler
func StopImageServer() {
}

// GetImageURL returns the local Wails asset path for an image filename
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
	return "/local-image/" + filename
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

	// Validate the entire string contains only valid base64 characters.
	// The old check only inspected the first 50 characters, allowing invalid
	// characters later in the data URI body.
	for _, c := range s {
		if !((c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') ||
			(c >= '0' && c <= '9') || c == '+' || c == '/' || c == '=' ||
			c == ',') {
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

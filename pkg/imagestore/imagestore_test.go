package imagestore

import (
	"encoding/base64"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestImageStore(t *testing.T) {
	// Backup original state
	origImageStoreDir := imageStoreDir
	origAppData := os.Getenv("APPDATA")
	defer func() {
		imageStoreDir = origImageStoreDir
		os.Setenv("APPDATA", origAppData)
	}()

	// Setup a temporary directory for APPDATA
	tmpDir := t.TempDir()
	os.Setenv("APPDATA", tmpDir)

	// Reset cached imageStoreDir to force re-computation inside the temp dir
	imageStoreDir = ""

	t.Run("GetImageStoreDir", func(t *testing.T) {
		dir, err := GetImageStoreDir()
		if err != nil {
			t.Fatalf("GetImageStoreDir failed: %v", err)
		}

		expectedSubpath := filepath.Join("BeidarPOS_V3", ImagesDir)
		if !strings.Contains(dir, expectedSubpath) {
			t.Errorf("Expected path %q to contain %q", dir, expectedSubpath)
		}

		// Verify directory is actually created
		if _, err := os.Stat(dir); os.IsNotExist(err) {
			t.Errorf("Expected directory %q to be created", dir)
		}
	})

	t.Run("GetImageURL", func(t *testing.T) {
		tests := []struct {
			filename string
			expected string
		}{
			{"", ""},
			{"http://example.com/img.png", "http://example.com/img.png"},
			{"data:image/png;base64,abc", "data:image/png;base64,abc"},
			{"prod_123.jpg", "/local-image/prod_123.jpg"},
			{"short", "short"},
		}

		for _, tc := range tests {
			got := GetImageURL(tc.filename)
			if got != tc.expected {
				t.Errorf("GetImageURL(%q) = %q, want %q", tc.filename, got, tc.expected)
			}
		}
	})

	t.Run("SaveDeleteAndStats", func(t *testing.T) {
		// Reset state
		imageStoreDir = ""
		dir, _ := GetImageStoreDir()

		// 1. Save valid base64 image
		dummyPngData := "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
		base64Data := "data:image/png;base64," + dummyPngData

		productID := "prod/test:123" // Includes chars that need sanitization
		filename, err := SaveImageFromBase64(base64Data, productID)
		if err != nil {
			t.Fatalf("SaveImageFromBase64 failed: %v", err)
		}

		expectedFilename := "prod_prod_test_123.png"
		if filename != expectedFilename {
			t.Errorf("Expected filename %q, got %q", expectedFilename, filename)
		}

		savedPath := filepath.Join(dir, filename)
		if _, err := os.Stat(savedPath); os.IsNotExist(err) {
			t.Errorf("Saved image file does not exist at %q", savedPath)
		}

		// Verify content is decoded correctly
		data, err := os.ReadFile(savedPath)
		if err != nil {
			t.Fatalf("Failed to read saved file: %v", err)
		}
		decodedDummy, _ := base64.StdEncoding.DecodeString(dummyPngData)
		if string(data) != string(decodedDummy) {
			t.Error("Saved file content does not match decoded base64 data")
		}

		// 2. Get directory stats
		count, size, err := GetDirectoryStats()
		if err != nil {
			t.Fatalf("GetDirectoryStats failed: %v", err)
		}
		if count != 1 {
			t.Errorf("Expected 1 image, got %d", count)
		}
		if size != int64(len(decodedDummy)) {
			t.Errorf("Expected size %d, got %d", len(decodedDummy), size)
		}

		// 3. Delete the image
		err = DeleteImage(filename)
		if err != nil {
			t.Fatalf("DeleteImage failed: %v", err)
		}

		if _, err := os.Stat(savedPath); !os.IsNotExist(err) {
			t.Errorf("Expected file %q to be deleted", savedPath)
		}

		// Stats after delete
		count, size, _ = GetDirectoryStats()
		if count != 0 || size != 0 {
			t.Errorf("Expected stats to be 0 after deletion, got count=%d, size=%d", count, size)
		}
	})

	t.Run("IsValidBase64Image", func(t *testing.T) {
		validBase64 := "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==AAAAAAAAAAAAAAAAAAAA"
		invalidBase64 := "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==AAAAAAAAAAAAAAAAAAAA!!!"

		if !isValidBase64Image(validBase64) {
			t.Errorf("Expected %q to be valid base64 image", validBase64)
		}

		if isValidBase64Image(invalidBase64) {
			t.Errorf("Expected %q to be invalid base64 image", invalidBase64)
		}

		// Short string check
		if isValidBase64Image("abc") {
			t.Error("Expected short string 'abc' to be invalid base64 image")
		}
	})
}

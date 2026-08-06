package repository

import (
	"testing"
	"time"

	"beidar-desktop/internal/core/domain"
	"beidar-desktop/internal/testutil"
)

func TestAuditRepository_LogAndGetRecent(t *testing.T) {
	db, cleanup := testutil.SetupFullDB(t)
	defer cleanup()
	repo := NewAuditRepository(db)

	now := time.Now()
	entries := []*domain.AuditLog{
		{StaffID: "s1", Action: "create", Entity: "sale", EntityID: "sl1", Timestamp: now},
		{StaffID: "s1", Action: "update", Entity: "sale", EntityID: "sl1", Timestamp: now.Add(time.Second)},
		{StaffID: "s2", Action: "delete", Entity: "expense", EntityID: "ex1", Timestamp: now.Add(2 * time.Second)},
	}
	for _, e := range entries {
		if err := repo.Log(e); err != nil {
			t.Fatalf("Log failed: %v", err)
		}
	}

	recent, err := repo.GetRecent(2)
	if err != nil {
		t.Fatalf("GetRecent failed: %v", err)
	}
	if len(recent) != 2 {
		t.Fatalf("GetRecent len = %d, want 2", len(recent))
	}
	// Order by timestamp desc -> newest first.
	if recent[0].Action != "delete" {
		t.Errorf("recent[0].Action = %q, want 'delete'", recent[0].Action)
	}

	all, err := repo.GetRecent(100)
	if err != nil {
		t.Fatalf("GetRecent(all) failed: %v", err)
	}
	if len(all) != 3 {
		t.Errorf("GetRecent(100) len = %d, want 3", len(all))
	}
}
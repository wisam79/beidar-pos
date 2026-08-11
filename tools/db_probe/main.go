package main

import (
	"fmt"
	"os"
	"sort"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func cols(db *gorm.DB, table string) []string {
	var rows []map[string]interface{}
	db.Raw("PRAGMA table_info(" + table + ")").Scan(&rows)
	var out []string
	for _, r := range rows {
		out = append(out, fmt.Sprintf("%v", r["name"]))
	}
	sort.Strings(out)
	return out
}

func diff(a, b []string) []string {
	mb := map[string]bool{}
	for _, x := range b { mb[x] = true }
	var out []string
	for _, x := range a { if !mb[x] { out = append(out, x) } }
	return out
}

func main() {
	dbA, _ := gorm.Open(sqlite.Open(os.Args[1]), &gorm.Config{})
	defer func() { d, _ := dbA.DB(); d.Close() }()
	dbB, _ := gorm.Open(sqlite.Open(os.Args[2]), &gorm.Config{})
	defer func() { d, _ := dbB.DB(); d.Close() }()
	for _, t := range []string{"products", "sales", "sale_items", "payments", "customers", "shifts", "staffs", "app_preferences", "stock_movements", "categories", "suppliers", "expenses"} {
		ca, cb := cols(dbA, t), cols(dbB, t)
		if fmt.Sprintf("%v", ca) == fmt.Sprintf("%v", cb) {
			fmt.Printf("%-18s IDENTICAL (%d cols)\n", t, len(ca))
		} else {
			fmt.Printf("%-18s DIFF (old=%d new=%d)\n", t, len(ca), len(cb))
			fmt.Printf("   old-only: %v\n", diff(ca, cb))
			fmt.Printf("   new-only: %v\n", diff(cb, ca))
		}
	}
}

package main

import "github.com/wailsapp/wails/v2/pkg/runtime"

var _ = runtime.MessageDialogOptions{
	Type:          runtime.QuestionDialog,
	Title:         "T",
	Message:       "M",
	Buttons:       []string{"A", "B"},
	DefaultButton: "A",
	CancelButton:  "B",
}

func main() {}

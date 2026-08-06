//go:build windows

package notification

import "testing"

func TestNotificationTypes(t *testing.T) {
	if NotificationInfo != "info" {
		t.Errorf("NotificationInfo = %q", NotificationInfo)
	}
	if NotificationWarning != "warning" {
		t.Errorf("NotificationWarning = %q", NotificationWarning)
	}
	if NotificationError != "error" {
		t.Errorf("NotificationError = %q", NotificationError)
	}
	if NotificationSuccess != "success" {
		t.Errorf("NotificationSuccess = %q", NotificationSuccess)
	}
}

func TestEscapeXML(t *testing.T) {
	cases := []struct {
		in, want string
	}{
		{"plain text", "plain text"},
		{"<b>&\"'", "&lt;b&gt;&amp;&#34;&#39;"},
		{"أحمد & محمود", "أحمد &amp; محمود"},
	}
	for _, c := range cases {
		if got := escapeXML(c.in); got != c.want {
			t.Errorf("escapeXML(%q) = %q, want %q", c.in, got, c.want)
		}
	}
}

package handlers

import (
	"beidar-desktop/internal/core/domain"
	"beidar-desktop/internal/network"
	"beidar-desktop/pkg/auth"
	"context"
)

type StatsHandler struct {
	ctx          context.Context
	statsService domain.StatsService
	lanService   network.LanService
}

func NewStatsHandler(statsService domain.StatsService, lanService network.LanService) *StatsHandler {
	return &StatsHandler{
		statsService: statsService,
		lanService:   lanService,
	}
}

func (h *StatsHandler) Startup(ctx context.Context) {
	h.ctx = ctx
}

func (h *StatsHandler) GetDashboardStats(timeRange string) (*domain.DashboardStats, error) {
	if err := auth.RequirePermission(auth.PermReports); err != nil {
		return nil, err
	}
	if h.lanService != nil && h.lanService.IsClientMode() {
		var result domain.DashboardStats
		err := h.lanService.RemoteGet("/api/stats/dashboard?range="+timeRange, &result)
		return &result, err
	}
	return h.statsService.GetDashboardStats(timeRange)
}

func (h *StatsHandler) GetMonthlyComparison() (*domain.MonthlyComparison, error) {
	if err := auth.RequirePermission(auth.PermReports); err != nil {
		return nil, err
	}
	return h.statsService.GetMonthlyComparison()
}

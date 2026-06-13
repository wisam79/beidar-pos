import * as StatsHandler from '../../../wailsjs/go/handlers/StatsHandler';

export const stats = {
    getDashboard: (timeRange: string = 'week') => StatsHandler.GetDashboardStats(timeRange),
    getMonthlyComparison: () => StatsHandler.GetMonthlyComparison(),
};

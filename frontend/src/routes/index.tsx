import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { LoadingScreen } from '../components/LoadingScreen';

const Dashboard = lazy(() => import('../features/dashboard/dashboard').then((m) => ({ default: m.Dashboard })));
const SalesPage = lazy(() => import('../features/pos/pos').then((m) => ({ default: m.SalesPage })));
const ProductsPage = lazy(() => import('../features/products/products').then((m) => ({ default: m.ProductsPage })));
const InventoryPage = lazy(() => import('../features/inventory/inventory').then((m) => ({ default: m.InventoryPage })));
const ReportsPage = lazy(() => import('../features/reports/reports').then((m) => ({ default: m.ReportsPage })));
const SettingsPage = lazy(() => import('../features/settings/settings').then((m) => ({ default: m.SettingsPage })));
const InvoicesPage = lazy(() => import('../features/invoices/invoices').then((m) => ({ default: m.InvoicesPage })));
const CustomersPage = lazy(() => import('../features/customers/customers').then((m) => ({ default: m.CustomersPage })));
const FinancePage = lazy(() => import('../features/finance/finance').then((m) => ({ default: m.FinancePage })));
const ShiftsPage = lazy(() => import('../features/shifts/shifts').then((m) => ({ default: m.ShiftsPage })));

const preloadRoutes = () => {
  const routes = [
    import('../features/dashboard/dashboard'),
    import('../features/pos/pos'),
    import('../features/products/products'),
    import('../features/inventory/inventory'),
    import('../features/reports/reports'),
    import('../features/settings/settings'),
    import('../features/invoices/invoices'),
    import('../features/customers/customers'),
    import('../features/finance/finance'),
    import('../features/shifts/shifts'),
  ];
  Promise.all(routes).catch(() => {});
};

export const AppRoutes: React.FC = () => {
  React.useEffect(() => {
    const trigger = () => {
      if ('requestIdleCallback' in window) {
        window.requestIdleCallback(() => preloadRoutes(), { timeout: 5000 });
      } else {
        setTimeout(preloadRoutes, 2000);
      }
    };
    const timer = setTimeout(trigger, 3000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <Suspense fallback={<LoadingScreen />}>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/sales" element={<SalesPage />} />
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/inventory" element={<InventoryPage />} />
        <Route path="/invoices" element={<InvoicesPage />} />
        <Route path="/customers" element={<CustomersPage />} />
        <Route path="/finance" element={<FinancePage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/shifts" element={<ShiftsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Suspense>
  );
};

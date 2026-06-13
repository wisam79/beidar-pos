import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { LoadingScreen } from '../components/LoadingScreen';

const Dashboard = lazy(() => import('../pages/Dashboard').then((m) => ({ default: m.Dashboard })));
const SalesPage = lazy(() => import('../pages/Sales').then((m) => ({ default: m.SalesPage })));
const ProductsPage = lazy(() => import('../pages/Products').then((m) => ({ default: m.ProductsPage })));
const InventoryPage = lazy(() => import('../pages/Inventory').then((m) => ({ default: m.InventoryPage })));
const ReportsPage = lazy(() => import('../pages/Reports').then((m) => ({ default: m.ReportsPage })));
const SettingsPage = lazy(() => import('../pages/Settings').then((m) => ({ default: m.SettingsPage })));
const InvoicesPage = lazy(() => import('../pages/Invoices').then((m) => ({ default: m.InvoicesPage })));
const CustomersPage = lazy(() => import('../pages/Customers').then((m) => ({ default: m.CustomersPage })));
const FinancePage = lazy(() => import('../pages/Finance').then((m) => ({ default: m.FinancePage })));
const ShiftsPage = lazy(() => import('../pages/Shifts').then((m) => ({ default: m.ShiftsPage })));

const preloadRoutes = () => {
  const routes = [
    import('../pages/Dashboard'),
    import('../pages/Sales'),
    import('../pages/Products'),
    import('../pages/Inventory'),
    import('../pages/Reports'),
    import('../pages/Settings'),
    import('../pages/Invoices'),
    import('../pages/Customers'),
    import('../pages/Finance'),
    import('../pages/Shifts'),
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

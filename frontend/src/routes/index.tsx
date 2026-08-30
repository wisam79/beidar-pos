import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { LoadingScreen } from '../components/LoadingScreen';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { useAuth } from '../core/AuthContext';

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

interface ProtectedRouteProps {
  children: React.ReactElement;
  permission?: string;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, permission }) => {
  const { isAuthenticated, hasPermission } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  if (permission && !hasPermission(permission)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

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

const RouteErrorFallback: React.FC<{ pageName?: string }> = ({ pageName = 'الصفحة' }) => (
  <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center bg-surface/40 rounded-2xl border border-border/60 m-6 animate-scale-in">
    <div className="w-14 h-14 bg-danger/10 text-danger rounded-2xl flex items-center justify-center mb-4 border border-danger/20">
      <AlertTriangle size={28} />
    </div>
    <h3 className="text-lg font-bold text-text-main mb-1.5">تعذر تحميل {pageName}</h3>
    <p className="text-text-muted text-xs mb-5 max-w-sm">
      حدث خطأ غير متوقع أثناء معالجة هذه الصفحة. يمكنك المحاولة مجدداً أو الانتقال لشاشة المبيعات.
    </p>
    <div className="flex gap-3">
      <button
        onClick={() => window.location.reload()}
        className="px-4 py-2 bg-primary text-primary-fg rounded-xl font-bold text-xs hover:opacity-90 transition-opacity"
      >
        إعادة المحاولة
      </button>
      <a
        href="#/sales"
        className="px-4 py-2 bg-surface text-text-main rounded-xl font-bold text-xs border border-border hover:bg-surface-hover transition-colors"
      >
        الذهاب لنقاط البيع
      </a>
    </div>
  </div>
);

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
        <Route path="/dashboard" element={<ErrorBoundary fallback={<RouteErrorFallback pageName="لوحة التحكم" />}><Dashboard /></ErrorBoundary>} />
        <Route path="/sales" element={<ErrorBoundary fallback={<RouteErrorFallback pageName="شاشة البيع" />}><SalesPage /></ErrorBoundary>} />
        <Route path="/products" element={<ErrorBoundary fallback={<RouteErrorFallback pageName="المنتجات" />}><ProductsPage /></ErrorBoundary>} />
        <Route path="/inventory" element={<ErrorBoundary fallback={<RouteErrorFallback pageName="المخزون" />}><InventoryPage /></ErrorBoundary>} />
        <Route path="/invoices" element={<ErrorBoundary fallback={<RouteErrorFallback pageName="الفواتير" />}><InvoicesPage /></ErrorBoundary>} />
        <Route path="/customers" element={<ErrorBoundary fallback={<RouteErrorFallback pageName="العملاء" />}><CustomersPage /></ErrorBoundary>} />
        <Route path="/finance" element={<ProtectedRoute permission="finance"><ErrorBoundary fallback={<RouteErrorFallback pageName="المالية" />}><FinancePage /></ErrorBoundary></ProtectedRoute>} />
        <Route path="/reports" element={<ProtectedRoute permission="reports"><ErrorBoundary fallback={<RouteErrorFallback pageName="التقارير" />}><ReportsPage /></ErrorBoundary></ProtectedRoute>} />
        <Route path="/shifts" element={<ErrorBoundary fallback={<RouteErrorFallback pageName="الورديات" />}><ShiftsPage /></ErrorBoundary>} />
        <Route path="/settings" element={<ProtectedRoute permission="settings"><ErrorBoundary fallback={<RouteErrorFallback pageName="الإعدادات" />}><SettingsPage /></ErrorBoundary></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Suspense>
  );
};

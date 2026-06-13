import React, { Suspense, lazy } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LoadingScreen } from '../components/LoadingScreen';

// Lazy Load Pages
const Dashboard = lazy(() =>
    import('../pages/Dashboard').then((module) => ({ default: module.Dashboard }))
);
const SalesPage = lazy(() =>
    import('../pages/Sales').then((module) => ({ default: module.SalesPage }))
);
const ProductsPage = lazy(() =>
    import('../pages/Products').then((module) => ({ default: module.ProductsPage }))
);
const InventoryPage = lazy(() =>
    import('../pages/Inventory').then((module) => ({ default: module.InventoryPage }))
);
const ReportsPage = lazy(() =>
    import('../pages/Reports').then((module) => ({ default: module.ReportsPage }))
);
const SettingsPage = lazy(() =>
    import('../pages/Settings').then((module) => ({ default: module.SettingsPage }))
);
const InvoicesPage = lazy(() =>
    import('../pages/Invoices').then((module) => ({ default: module.InvoicesPage }))
);
const CustomersPage = lazy(() =>
    import('../pages/Customers').then((module) => ({ default: module.CustomersPage }))
);
const FinancePage = lazy(() =>
    import('../pages/Finance').then((module) => ({ default: module.FinancePage }))
);
const ShiftsPage = lazy(() =>
    import('../pages/Shifts').then((module) => ({ default: module.ShiftsPage }))
);

// Protected Route wrapper
interface ProtectedRouteProps {
    children: React.ReactNode;
    isAuthenticated: boolean;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, isAuthenticated }) => {
    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }
    return <>{children}</>;
};

import { View, AppPreferences } from '../core/types';

// App Routes component
interface AppRoutesProps {
    prefs: AppPreferences;
    notify: (message: string, type?: 'success' | 'error' | 'info') => void;
    setPrefs: (prefs: AppPreferences) => void;
    setView: (view: View) => void;
}

// Preload all routes for instant navigation
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
        import('../pages/Shifts')
    ];
    Promise.all(routes).catch(() => { /* Ignore preload errors */ });
};

export const AppRoutes: React.FC<AppRoutesProps> = ({ prefs, notify, setPrefs, setView }) => {
    // 🚀 Smart Background Preloading
    React.useEffect(() => {
        const triggerPreload = () => {
            // Check for requestIdleCallback support
            if ('requestIdleCallback' in window) {
                window.requestIdleCallback(() => {
                    preloadRoutes();
                }, { timeout: 5000 }); // Force run after 5s if never idle
            } else {
                // Fallback for older browsers
                setTimeout(preloadRoutes, 2000);
            }
        };

        // Wait for initial render to complete + buffer
        const timer = setTimeout(triggerPreload, 3000);
        return () => clearTimeout(timer);
    }, []);

    return (
        <Suspense fallback={<LoadingScreen />}>
            <Routes>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<Dashboard prefs={prefs} setView={setView} />} />
                <Route path="/sales" element={<SalesPage prefs={prefs} notify={notify} />} />
                <Route path="/products" element={<ProductsPage prefs={prefs} notify={notify} />} />
                <Route path="/inventory" element={<InventoryPage prefs={prefs} notify={notify} />} />
                <Route path="/invoices" element={<InvoicesPage prefs={prefs} notify={notify} />} />
                <Route path="/customers" element={<CustomersPage prefs={prefs} notify={notify} />} />
                <Route path="/finance" element={<FinancePage prefs={prefs} notify={notify} />} />
                <Route path="/reports" element={<ReportsPage prefs={prefs} />} />
                <Route path="/shifts" element={<ShiftsPage prefs={prefs} notify={notify} />} />
                <Route path="/settings" element={<SettingsPage prefs={prefs} setPrefs={setPrefs} notify={notify} />} />
                {/* Fallback route */}
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
        </Suspense>
    );
};

// Router wrapper component
interface AppRouterProps {
    children: React.ReactNode;
}

export const AppRouter: React.FC<AppRouterProps> = ({ children }) => {
    return <HashRouter>{children}</HashRouter>;
};

export { ProtectedRoute };

import { Permission } from '@sawmill/shared';
import { lazy, ReactNode, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/Login';
import { useI18n } from './i18n';

// Pages load on demand (each is its own chunk); the login page is part of the main bundle.
const AccountantDashboard = lazy(() => import('./pages/AccountantDashboard').then((m) => ({ default: m.AccountantDashboard })));
const AuditLogPage = lazy(() => import('./pages/AuditLog').then((m) => ({ default: m.AuditLogPage })));
const ImportDetailPage = lazy(() => import('./pages/ImportDetail').then((m) => ({ default: m.ImportDetailPage })));
const ImportsPage = lazy(() => import('./pages/Imports').then((m) => ({ default: m.ImportsPage })));
const NewImportPage = lazy(() => import('./pages/Imports').then((m) => ({ default: m.NewImportPage })));
const OwnerDashboard = lazy(() => import('./pages/OwnerDashboard').then((m) => ({ default: m.OwnerDashboard })));
const MyEntriesPage = lazy(() => import('./pages/MyEntries').then((m) => ({ default: m.MyEntriesPage })));
const NewProductionPage = lazy(() => import('./pages/Production').then((m) => ({ default: m.NewProductionPage })));
const ProductionPage = lazy(() => import('./pages/Production').then((m) => ({ default: m.ProductionPage })));
const ProductionDetailPage = lazy(() => import('./pages/ProductionDetail').then((m) => ({ default: m.ProductionDetailPage })));
const StockPage = lazy(() => import('./pages/Stock').then((m) => ({ default: m.StockPage })));
const AccountsPage = lazy(() => import('./pages/Accounts').then((m) => ({ default: m.AccountsPage })));
const ApprovalsPage = lazy(() => import('./pages/Approvals').then((m) => ({ default: m.ApprovalsPage })));
const ReportsPage = lazy(() => import('./pages/Reports').then((m) => ({ default: m.ReportsPage })));
const SettingsPage = lazy(() => import('./pages/Settings').then((m) => ({ default: m.SettingsPage })));
const ClientsPage = lazy(() => import('./pages/Suppliers').then((m) => ({ default: m.ClientsPage })));
const SuppliersPage = lazy(() => import('./pages/Suppliers').then((m) => ({ default: m.SuppliersPage })));
const ExportDetailPage = lazy(() => import('./pages/ExportDetail').then((m) => ({ default: m.ExportDetailPage })));
const ExportsPage = lazy(() => import('./pages/Exports').then((m) => ({ default: m.ExportsPage })));
const NewExportPage = lazy(() => import('./pages/Exports').then((m) => ({ default: m.NewExportPage })));
const UsersPage = lazy(() => import('./pages/Users').then((m) => ({ default: m.UsersPage })));

function Guard({ permission, children }: { permission: Permission; children: ReactNode }) {
  const { can } = useAuth();
  return can(permission) ? <>{children}</> : <Navigate to="/" replace />;
}

export default function App() {
  const { user, loading, can } = useAuth();
  const { t } = useI18n();

  if (loading) return <div className="grid min-h-svh place-items-center bg-background text-sm text-muted-foreground">{t('loading')}</div>;
  if (!user) return <LoginPage />;

  return (
    <Layout>
      <Suspense fallback={<div className="py-10 text-center text-sm text-muted-foreground">{t('loading')}</div>}>
      <Routes>
        <Route path="/" element={can(Permission.DASHBOARD_OWNER) ? <OwnerDashboard /> : <AccountantDashboard />} />
        <Route
          path="/users"
          element={
            <Guard permission={Permission.USERS_MANAGE}>
              <UsersPage />
            </Guard>
          }
        />
        <Route
          path="/audit"
          element={
            <Guard permission={Permission.AUDIT_VIEW}>
              <AuditLogPage />
            </Guard>
          }
        />
        <Route path="/imports" element={<Guard permission={Permission.OPERATIONS_CREATE}><ImportsPage /></Guard>} />
        <Route path="/imports/new" element={<Guard permission={Permission.OPERATIONS_CREATE}><NewImportPage /></Guard>} />
        <Route path="/imports/:id" element={<Guard permission={Permission.OPERATIONS_CREATE}><ImportDetailPage /></Guard>} />
        <Route path="/measurement" element={<Guard permission={Permission.OPERATIONS_CREATE}><ImportsPage openOnly /></Guard>} />
        <Route path="/my-entries" element={<Guard permission={Permission.OPERATIONS_CREATE}><MyEntriesPage /></Guard>} />
        <Route path="/suppliers" element={<Guard permission={Permission.SUPPLIERS_MANAGE}><SuppliersPage /></Guard>} />
        <Route path="/production" element={<Guard permission={Permission.OPERATIONS_CREATE}><ProductionPage /></Guard>} />
        <Route path="/production/new" element={<Guard permission={Permission.OPERATIONS_CREATE}><NewProductionPage /></Guard>} />
        <Route path="/production/:id" element={<Guard permission={Permission.OPERATIONS_CREATE}><ProductionDetailPage /></Guard>} />
        <Route path="/stock" element={<Guard permission={Permission.OPERATIONS_CREATE}><StockPage /></Guard>} />
        <Route path="/exports" element={<Guard permission={Permission.OPERATIONS_CREATE}><ExportsPage /></Guard>} />
        <Route path="/exports/new" element={<Guard permission={Permission.OPERATIONS_CREATE}><NewExportPage /></Guard>} />
        <Route path="/exports/:id" element={<Guard permission={Permission.OPERATIONS_CREATE}><ExportDetailPage /></Guard>} />
        <Route path="/clients" element={<Guard permission={Permission.CLIENTS_MANAGE}><ClientsPage /></Guard>} />
        <Route path="/approvals" element={<Guard permission={Permission.OPERATIONS_APPROVE}><ApprovalsPage /></Guard>} />
        <Route path="/settings" element={<Guard permission={Permission.SETTINGS_MANAGE}><SettingsPage /></Guard>} />
        <Route path="/reports" element={<Guard permission={Permission.REPORTS_OPERATIONAL}><ReportsPage /></Guard>} />
        <Route path="/accounts" element={<Guard permission={Permission.FINANCE_VIEW}><AccountsPage /></Guard>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
    </Layout>
  );
}

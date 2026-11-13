import { Permission } from '@sawmill/shared';
import { ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth';
import { Layout } from './components/Layout';
import { NAV_ITEMS } from './nav';
import { AccountantDashboard } from './pages/AccountantDashboard';
import { AuditLogPage } from './pages/AuditLog';
import { ComingSoon } from './pages/ComingSoon';
import { ImportDetailPage } from './pages/ImportDetail';
import { ImportsPage, NewImportPage } from './pages/Imports';
import { LoginPage } from './pages/Login';
import { OwnerDashboard } from './pages/OwnerDashboard';
import { SuppliersPage } from './pages/Suppliers';
import { UsersPage } from './pages/Users';
import { useI18n } from './i18n';

function Guard({ permission, children }: { permission: Permission; children: ReactNode }) {
  const { can } = useAuth();
  return can(permission) ? <>{children}</> : <Navigate to="/" replace />;
}

export default function App() {
  const { user, loading, can } = useAuth();
  const { t } = useI18n();

  if (loading) return <div className="splash">{t('loading')}</div>;
  if (!user) return <LoginPage />;

  return (
    <Layout>
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
        <Route path="/suppliers" element={<Guard permission={Permission.SUPPLIERS_MANAGE}><SuppliersPage /></Guard>} />
        {NAV_ITEMS.filter((n) => n.phase).map((n) => (
          <Route
            key={n.path}
            path={n.path}
            element={
              <Guard permission={n.permission}>
                <ComingSoon titleKey={n.labelKey} phase={n.phase!} />
              </Guard>
            }
          />
        ))}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

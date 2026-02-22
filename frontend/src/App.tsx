
import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, CssBaseline, CircularProgress, Box } from '@mui/material';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { theme } from './theme';

// Lazy-load all pages — only the visited page is downloaded
const LoginPage = lazy(() => import('./pages/Login'));
const SetupPage = lazy(() => import('./pages/Setup'));
const DashboardPage = lazy(() => import('./pages/Dashboard'));
const FileManagerPage = lazy(() => import('./pages/FileManager'));
const TerminalPage = lazy(() => import('./pages/terminal/TerminalPage'));
const ToolsPage = lazy(() => import('./pages/Tools'));
const DomainCreatePage = lazy(() => import('./pages/DomainCreate'));
const DnsEditorPage = lazy(() => import('./pages/DnsEditor'));
const DomainsListView = lazy(() => import('./pages/DomainsListView'));
const NameserverSetupPage = lazy(() => import('./pages/NameserverSetup'));
const SslPage = lazy(() => import('./pages/Ssl'));
const DatabasesPage = lazy(() => import('./pages/Databases'));
const AppStorePage = lazy(() => import('./pages/AppStore'));
const PhpManagerPage = lazy(() => import('./pages/PhpManager'));
const MailDomainsPage = lazy(() => import('./pages/MailDomains'));
const EmailAccountsPage = lazy(() => import('./pages/EmailAccounts'));
const ForwardersPage = lazy(() => import('./pages/Forwarders'));
const EmailFiltersPage = lazy(() => import('./pages/EmailFilters'));
const LogsPage = lazy(() => import('./pages/Logs'));
const SettingsPage = lazy(() => import('./pages/Settings'));
const WebserverPage = lazy(() => import('./pages/Webserver'));

// Eagerly load SetupGuard since it wraps all routes
import { SetupGuard } from './components/SetupGuard';

function PageLoader() {
  return (
    <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
      <CircularProgress />
    </Box>
  );
}

function ProtectedRoute({ children }: { children: React.ReactElement }) {
  const { authenticated, loading } = useAuth();
  if (loading) return <div style={{ padding: 24 }}>Checking session…</div>;
  if (!authenticated) return <Navigate to="/login" replace />;
  return children;
}

export function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <BrowserRouter>
          <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Setup wizard - no auth required, shown on first run */}
            <Route path="/setup" element={<SetupPage />} />

            {/* All other routes go through SetupGuard first */}
            <Route element={<SetupGuard />}>
              <Route path="/login" element={<LoginPage />} />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <DashboardPage />
                  </ProtectedRoute>
              }
            />
            <Route
              path="/files"
              element={
                <ProtectedRoute>
                  <FileManagerPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/terminal"
              element={
                <ProtectedRoute>
                  <TerminalPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/tools"
              element={
                <ProtectedRoute>
                  <ToolsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/domains/new"
              element={
                <ProtectedRoute>
                  <DomainCreatePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dns"
              element={
                <ProtectedRoute>
                  <DnsEditorPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/nameservers"
              element={
                <ProtectedRoute>
                  <NameserverSetupPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/domains"
              element={
                <ProtectedRoute>
                  <DomainsListView />
                </ProtectedRoute>
              }
            />
            <Route
              path="/ssl"
              element={
                <ProtectedRoute>
                  <SslPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/databases"
              element={
                <ProtectedRoute>
                  <DatabasesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/app-store"
              element={
                <ProtectedRoute>
                  <AppStorePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/php"
              element={
                <ProtectedRoute>
                  <PhpManagerPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/mail-domains"
              element={
                <ProtectedRoute>
                  <MailDomainsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/email-accounts"
              element={
                <ProtectedRoute>
                  <EmailAccountsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/forwarders"
              element={
                <ProtectedRoute>
                  <ForwardersPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/email-filters"
              element={
                <ProtectedRoute>
                  <EmailFiltersPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/logs"
              element={
                <ProtectedRoute>
                  <LogsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <SettingsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/webserver"
              element={
                <ProtectedRoute>
                  <WebserverPage />
                </ProtectedRoute>
              }
            />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Route>
          </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;

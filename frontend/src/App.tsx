
import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { CssBaseline, CircularProgress, Box } from '@mui/material';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { ThemeProvider } from './theme/theme-provider';
import { DashboardLayout } from './layouts/dashboard';

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
const DatabasesPage = lazy(() => import('./pages/database/DatabaseManagerPage'));
const AppStorePage = lazy(() => import('./pages/AppStore'));
const PhpManagerPage = lazy(() => import('./pages/PhpManager'));
const MailDomainsPage = lazy(() => import('./pages/mail/MailDomainsPage'));
const EmailAccountsPage = lazy(() => import('./pages/EmailAccounts'));
const ForwardersPage = lazy(() => import('./pages/Forwarders'));
const EmailFiltersPage = lazy(() => import('./pages/EmailFilters'));
const EmailPage = lazy(() => import('./pages/Email'));
const LogsPage = lazy(() => import('./pages/Logs'));
const SettingsPage = lazy(() => import('./pages/Settings'));
const WebserverPage = lazy(() => import('./pages/Webserver'));
const SshKeysPage = lazy(() => import('./pages/SshKeys'));
const CronJobsPage = lazy(() => import('./pages/CronJobs'));
const FirewallPage = lazy(() => import('./pages/Firewall'));
const MonitoringPage = lazy(() => import('./pages/Monitoring'));
const BackupPage = lazy(() => import('./pages/Backup'));
const TwoFactorPage = lazy(() => import('./pages/TwoFactor'));
const ProcessesPage = lazy(() => import('./pages/Processes'));
const GitPage = lazy(() => import('./pages/Git'));
const FtpManagerPage = lazy(() => import('./pages/FtpManager'));
const RedirectsPage = lazy(() => import('./pages/Redirects'));
const IpBlockerPage = lazy(() => import('./pages/IpBlocker'));
const DirPrivacyPage = lazy(() => import('./pages/DirPrivacy'));
const HotlinkProtectionPage = lazy(() => import('./pages/HotlinkProtection'));
const DockerPage = lazy(() => import('./pages/Docker'));
const NodeAppsPage = lazy(() => import('./pages/NodeApps'));
const SubdomainsPage = lazy(() => import('./pages/Subdomains'));
const ErrorPagesPage = lazy(() => import('./pages/ErrorPages'));
const AutoRespondersPage = lazy(() => import('./pages/AutoResponders'));
const MailingListsPage = lazy(() => import('./pages/MailingLists'));
const SpamFilterPage = lazy(() => import('./pages/SpamFilter'));

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
    <ThemeProvider>
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
                    <DashboardLayout><DashboardLayout><DashboardPage /></DashboardLayout></DashboardLayout>
                  </ProtectedRoute>
              }
            />
            <Route
              path="/files"
              element={
                <ProtectedRoute>
                  <DashboardLayout><DashboardLayout><FileManagerPage /></DashboardLayout></DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/terminal"
              element={
                <ProtectedRoute>
                  <DashboardLayout><DashboardLayout><TerminalPage /></DashboardLayout></DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/tools"
              element={
                <ProtectedRoute>
                  <DashboardLayout><DashboardLayout><ToolsPage /></DashboardLayout></DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/domains/new"
              element={
                <ProtectedRoute>
                  <DashboardLayout><DashboardLayout><DomainCreatePage /></DashboardLayout></DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/dns"
              element={
                <ProtectedRoute>
                  <DashboardLayout><DashboardLayout><DnsEditorPage /></DashboardLayout></DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/nameservers"
              element={
                <ProtectedRoute>
                  <DashboardLayout><DashboardLayout><NameserverSetupPage /></DashboardLayout></DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/domains"
              element={
                <ProtectedRoute>
                  <DashboardLayout><DashboardLayout><DomainsListView /></DashboardLayout></DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/ssl"
              element={
                <ProtectedRoute>
                  <DashboardLayout><DashboardLayout><SslPage /></DashboardLayout></DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/databases"
              element={
                <ProtectedRoute>
                  <DashboardLayout><DashboardLayout><DatabasesPage /></DashboardLayout></DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/app-store"
              element={
                <ProtectedRoute>
                  <DashboardLayout><DashboardLayout><AppStorePage /></DashboardLayout></DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/php"
              element={
                <ProtectedRoute>
                  <DashboardLayout><DashboardLayout><PhpManagerPage /></DashboardLayout></DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/mail-domains"
              element={
                <ProtectedRoute>
                  <DashboardLayout><DashboardLayout><MailDomainsPage /></DashboardLayout></DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/email-accounts"
              element={
                <ProtectedRoute>
                  <DashboardLayout><DashboardLayout><EmailAccountsPage /></DashboardLayout></DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/forwarders"
              element={
                <ProtectedRoute>
                  <DashboardLayout><DashboardLayout><ForwardersPage /></DashboardLayout></DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/email"
              element={
                <ProtectedRoute>
                  <DashboardLayout><DashboardLayout><EmailPage /></DashboardLayout></DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/email-filters"
              element={
                <ProtectedRoute>
                  <DashboardLayout><DashboardLayout><EmailFiltersPage /></DashboardLayout></DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/logs"
              element={
                <ProtectedRoute>
                  <DashboardLayout><DashboardLayout><LogsPage /></DashboardLayout></DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <DashboardLayout><DashboardLayout><SettingsPage /></DashboardLayout></DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/webserver"
              element={
                <ProtectedRoute>
                  <DashboardLayout><DashboardLayout><WebserverPage /></DashboardLayout></DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/ssh-keys"
              element={
                <ProtectedRoute>
                  <DashboardLayout><DashboardLayout><SshKeysPage /></DashboardLayout></DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/cron-jobs"
              element={
                <ProtectedRoute>
                  <DashboardLayout><DashboardLayout><CronJobsPage /></DashboardLayout></DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/firewall"
              element={
                <ProtectedRoute>
                  <DashboardLayout><DashboardLayout><FirewallPage /></DashboardLayout></DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/monitoring"
              element={
                <ProtectedRoute>
                  <DashboardLayout><DashboardLayout><MonitoringPage /></DashboardLayout></DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/backup"
              element={
                <ProtectedRoute>
                  <DashboardLayout><DashboardLayout><BackupPage /></DashboardLayout></DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/two-factor"
              element={
                <ProtectedRoute>
                  <DashboardLayout><DashboardLayout><TwoFactorPage /></DashboardLayout></DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/processes"
              element={
                <ProtectedRoute>
                  <DashboardLayout><DashboardLayout><ProcessesPage /></DashboardLayout></DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/git"
              element={
                <ProtectedRoute>
                  <DashboardLayout><DashboardLayout><GitPage /></DashboardLayout></DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/ftp"
              element={
                <ProtectedRoute>
                  <DashboardLayout><DashboardLayout><FtpManagerPage /></DashboardLayout></DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/redirects"
              element={
                <ProtectedRoute>
                  <DashboardLayout><DashboardLayout><RedirectsPage /></DashboardLayout></DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/ip-blocker"
              element={
                <ProtectedRoute>
                  <DashboardLayout><DashboardLayout><IpBlockerPage /></DashboardLayout></DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/dir-privacy"
              element={
                <ProtectedRoute>
                  <DashboardLayout><DashboardLayout><DirPrivacyPage /></DashboardLayout></DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/hotlink-protection"
              element={
                <ProtectedRoute>
                  <DashboardLayout><DashboardLayout><HotlinkProtectionPage /></DashboardLayout></DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/docker"
              element={
                <ProtectedRoute>
                  <DashboardLayout><DashboardLayout><DockerPage /></DashboardLayout></DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/node-apps"
              element={
                <ProtectedRoute>
                  <DashboardLayout><DashboardLayout><NodeAppsPage /></DashboardLayout></DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/subdomains"
              element={
                <ProtectedRoute>
                  <DashboardLayout><DashboardLayout><SubdomainsPage /></DashboardLayout></DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/error-pages"
              element={
                <ProtectedRoute>
                  <DashboardLayout><DashboardLayout><ErrorPagesPage /></DashboardLayout></DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/auto-responders"
              element={
                <ProtectedRoute>
                  <DashboardLayout><DashboardLayout><AutoRespondersPage /></DashboardLayout></DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/mailing-lists"
              element={
                <ProtectedRoute>
                  <DashboardLayout><DashboardLayout><MailingListsPage /></DashboardLayout></DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/spam-filter"
              element={
                <ProtectedRoute>
                  <DashboardLayout><DashboardLayout><SpamFilterPage /></DashboardLayout></DashboardLayout>
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

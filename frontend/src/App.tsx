
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { theme } from './theme';
import LoginPage from './pages/Login';
import SetupPage from './pages/Setup';
import { SetupGuard } from './components/SetupGuard';
import DashboardPage from './pages/Dashboard';
import FileManagerPage from './pages/FileManager';
import TerminalPage from './pages/terminal/TerminalPage';
import ToolsPage from './pages/Tools';
import DomainCreatePage from './pages/DomainCreate';
import DnsEditorPage from './pages/DnsEditor';
import DomainsListView from './pages/DomainsListView';
import NameserverSetupPage from './pages/NameserverSetup';
import SslPage from './pages/Ssl';

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
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;

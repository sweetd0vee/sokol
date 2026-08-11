import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './contexts/AuthContext';
import { SokolDataProvider } from './contexts/SokolDataContext';
import { LoginPage } from './components/auth/LoginPage';
import { AuthGuard } from './components/auth/AuthGuard';
import { AdminGuard } from './components/auth/AdminGuard';
import { AppLayout } from './components/layout/AppLayout';
import { AuthLayout } from './components/layout/AuthLayout';
import { ProfilePage } from './components/profile/ProfilePage';
import { RecommendationsTab } from './components/tabs/RecommendationsTab';
import { RecommendationFormPage } from './components/recommendations/RecommendationFormPage';
import { ChecksTab } from './components/tabs/ChecksTab';
import { CheckFormPage } from './components/checks/CheckFormPage';
import { AnalyticsTab } from './components/tabs/AnalyticsTab';
import { ObservationsTab } from './components/tabs/ObservationsTab';
import { ObservationFormPage } from './components/observations/ObservationFormPage';
import { PlanningTab } from './components/tabs/PlanningTab';
import { KantslerTab } from './components/tabs/KantslerTab';
import { SettingsTab } from './components/tabs/SettingsTab';
import { ToolsTab } from './components/tabs/ToolsTab';
import './App.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});

function AppContent() {
  return (
    <Routes>
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginPage />} />
      </Route>
      <Route element={<AuthGuard />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Navigate to="/checks" replace />} />
          <Route path="/recommendations" element={<RecommendationsTab />} />
          <Route path="/recommendations/new" element={<RecommendationFormPage />} />
          <Route path="/recommendations/:id/edit" element={<RecommendationFormPage />} />
          <Route path="/checks" element={<ChecksTab />} />
          <Route path="/checks/new" element={<CheckFormPage />} />
          <Route path="/checks/:id/edit" element={<CheckFormPage />} />
          <Route path="/observations" element={<ObservationsTab />} />
          <Route path="/observations/new" element={<ObservationFormPage />} />
          <Route path="/observations/:id/edit" element={<ObservationFormPage />} />
          <Route path="/analytics" element={<AnalyticsTab />} />
          <Route path="/planning" element={<PlanningTab />} />
          <Route path="/tools" element={<ToolsTab />} />
          <Route path="/kantsler" element={<KantslerTab />} />
          <Route
            path="/settings"
            element={
              <AdminGuard>
                <SettingsTab />
              </AdminGuard>
            }
          />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="*" element={<Navigate to="/checks" replace />} />
        </Route>
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SokolDataProvider>
          <BrowserRouter>
            <AppContent />
          </BrowserRouter>
        </SokolDataProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

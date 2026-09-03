import { Navigate, Route, Routes } from 'react-router-dom';
import { LoginPage } from './components/auth/LoginPage';
import { AuthGuard } from './components/auth/AuthGuard';
import { AppLayout } from './components/layout/AppLayout';
import { AuthLayout } from './components/layout/AuthLayout';
import { ProfilePage } from './components/profile/ProfilePage';
import { RecommendationsTab } from './components/tabs/RecommendationsTab';
import { RecommendationFormPage } from './components/recommendations/RecommendationFormPage';
import { ChecksTab } from './components/tabs/ChecksTab';
import { CheckFormPage } from './components/checks/CheckFormPage';
import { AnalyticsTab } from './components/tabs/AnalyticsTab';
import { PlanningTab } from './components/tabs/PlanningTab';
import { ConstructorTab } from './components/tabs/ConstructorTab';
import { ConstructorEditorPage } from './components/analytics/constructor/ConstructorEditorPage';
import { SettingsTab } from './components/tabs/SettingsTab';
import { ToolsTab } from './components/tabs/ToolsTab';

export function AppRoutes() {
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
          <Route path="/analytics" element={<AnalyticsTab />} />
          <Route path="/planning" element={<PlanningTab />} />
          <Route path="/constructor" element={<ConstructorTab />} />
          <Route path="/constructor/:id" element={<ConstructorEditorPage />} />
          <Route path="/tools" element={<ToolsTab />} />
          <Route path="/settings" element={<SettingsTab />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="*" element={<Navigate to="/checks" replace />} />
        </Route>
      </Route>
    </Routes>
  );
}

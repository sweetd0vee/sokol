import { Navigate, Route, Routes } from 'react-router-dom';
import { LoginPage } from './components/auth/LoginPage';
import { AuthGuard } from './components/auth/AuthGuard';
import { AdminGuard } from './components/auth/AdminGuard';
import { AppLayout } from './components/layout/AppLayout';
import { AuthLayout } from './components/layout/AuthLayout';
import { lazyNamed } from './utils/lazyNamed';

const ProfilePage = lazyNamed(() => import('./components/profile/ProfilePage'), 'ProfilePage');
const RecommendationsTab = lazyNamed(() => import('./components/tabs/RecommendationsTab'), 'RecommendationsTab');
const RecommendationFormPage = lazyNamed(
  () => import('./components/recommendations/RecommendationFormPage'),
  'RecommendationFormPage',
);
const ChecksTab = lazyNamed(() => import('./components/tabs/ChecksTab'), 'ChecksTab');
const CheckFormPage = lazyNamed(() => import('./components/checks/CheckFormPage'), 'CheckFormPage');
const AnalyticsTab = lazyNamed(() => import('./components/tabs/AnalyticsTab'), 'AnalyticsTab');
const PlanningTab = lazyNamed(() => import('./components/tabs/PlanningTab'), 'PlanningTab');
const ConstructorTab = lazyNamed(() => import('./components/tabs/ConstructorTab'), 'ConstructorTab');
const ConstructorEditorPage = lazyNamed(
  () => import('./components/analytics/constructor/ConstructorEditorPage'),
  'ConstructorEditorPage',
);
const SettingsTab = lazyNamed(() => import('./components/tabs/SettingsTab'), 'SettingsTab');
const ToolsTab = lazyNamed(() => import('./components/tabs/ToolsTab'), 'ToolsTab');

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
          <Route path="/profile" element={<ProfilePage />} />
          <Route element={<AdminGuard />}>
            <Route path="/settings" element={<SettingsTab />} />
          </Route>
          <Route path="*" element={<Navigate to="/checks" replace />} />
        </Route>
      </Route>
    </Routes>
  );
}

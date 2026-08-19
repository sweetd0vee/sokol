import { AppProviders } from './AppProviders';
import { AppRoutes } from './AppRoutes';
import './App.css';

export default function App() {
  return (
    <AppProviders>
      <AppRoutes />
    </AppProviders>
  );
}

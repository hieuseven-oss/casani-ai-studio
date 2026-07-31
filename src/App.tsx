import { Routes, Route } from 'react-router-dom';

import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Create from './pages/Create';
import Results from './pages/Results';
import Products from './pages/Products';
import Projects from './pages/Projects';
import ProductionLibrary from './pages/ProductionLibrary';
import SettingsPage from './pages/Settings';

export default function App() {
  return (
    <Routes>
      {/* Public route */}
      <Route path="/login" element={<Login />} />

      {/* Protected application */}
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <Layout>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/create" element={<Create />} />
                <Route path="/results/:id" element={<Results />} />
                <Route path="/products" element={<Products />} />
                <Route path="/projects" element={<Projects />} />
                <Route path="/production" element={<ProductionLibrary />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Routes>
            </Layout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

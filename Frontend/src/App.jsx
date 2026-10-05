import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import LoginPage from './pages/auth/LoginPage';
import AdminDashboard from './pages/admin/AdminDashboard';
import CEODashboard from './pages/ceo/CEODashboard';
import EmployeeDashboard from './pages/employee/EmployeeDashboard';
import LoadingSpinner from './components/common/LoadingSpinner';
import { CodeoProvider } from './components/codeo/CodeoProvider';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();
  if (loading) return <LoadingSpinner fullPage />;
  if (!user) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={`/${user.role}`} replace />;
  }
  return children;
};

const RoleRouter = () => {
  const { user, loading } = useAuth();
  if (loading) return <LoadingSpinner fullPage />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'admin') return <Navigate to="/admin" replace />;
  if (user.role === 'ceo') return <Navigate to="/ceo" replace />;
  return <Navigate to="/employee" replace />;
};

// Renders the system-wide Codeo assistant only for authenticated users.
const WithCodeo = ({ children }) => {
  const { user } = useAuth();
  if (!user) return children;
  return <CodeoProvider>{children}</CodeoProvider>;
};

function App() {
  return (
    <ThemeProvider>
    <AuthProvider>
      <WithCodeo>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<RoleRouter />} />

          {/* Admin Routes */}
          <Route
            path="/admin/*"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />

          {/* CEO Routes */}
          <Route
            path="/ceo/*"
            element={
              <ProtectedRoute allowedRoles={['ceo']}>
                <CEODashboard />
              </ProtectedRoute>
            }
          />

          {/* Employee Routes */}
          <Route
            path="/employee/*"
            element={
              <ProtectedRoute allowedRoles={['employee']}>
                <EmployeeDashboard />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </WithCodeo>
    </AuthProvider>
    </ThemeProvider>
  );
}

export default App;

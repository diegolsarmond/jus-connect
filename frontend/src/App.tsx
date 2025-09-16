import React, { createContext, useMemo, useState } from "react";
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import LibraryPage from "./pages/LibraryPage";
import EditorPage from "./pages/EditorPage";
import LoginPage from "./pages/LoginPage";

export const AUTH_TOKEN_KEY = "jusconnect.jwt";

export interface AuthContextValue {
  token: string | null;
  login: (jwt: string) => void;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextValue>({
  token: null,
  login: () => undefined,
  logout: () => undefined,
});

const ProtectedRoute: React.FC = () => {
  const location = useLocation();
  const token = localStorage.getItem(AUTH_TOKEN_KEY);

  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
};

const AppLayout: React.FC<{ onLogout: () => void }> = ({ onLogout }) => {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className={`app-shell ${collapsed ? "collapsed" : ""}`}>
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed((prev) => !prev)}
        onLogout={onLogout}
      />
      <main className="app-content">
        <Outlet />
      </main>
    </div>
  );
};

const App: React.FC = () => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(AUTH_TOKEN_KEY));

  const login = (jwt: string) => {
    localStorage.setItem(AUTH_TOKEN_KEY, jwt);
    setToken(jwt);
  };

  const logout = () => {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    setToken(null);
  };

  const authValue = useMemo<AuthContextValue>(() => ({ token, login, logout }), [token]);

  return (
    <AuthContext.Provider value={authValue}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout onLogout={logout} />}>
              <Route index element={<LibraryPage />} />
              <Route path="templates/new" element={<EditorPage mode="create" />} />
              <Route path="templates/:templateId" element={<EditorPage mode="edit" />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to={token ? "/" : "/login"} replace />} />
        </Routes>
      </BrowserRouter>
    </AuthContext.Provider>
  );
};

export default App;

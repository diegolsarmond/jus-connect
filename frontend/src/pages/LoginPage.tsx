import React, { FormEvent, useContext, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AuthContext } from "../App";
import { login as loginRequest } from "../services/api";

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useContext(AuthContext);
  const [email, setEmail] = useState("consultor@jus.com");
  const [password, setPassword] = useState("123456");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const token = await loginRequest(email, password);
      login(token);
      const redirect = (location.state as { from?: { pathname?: string } } | undefined)?.from?.pathname ?? "/";
      navigate(redirect, { replace: true });
    } catch (err) {
      console.error(err);
      setError("Falha na autenticação. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page" style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
      <form
        onSubmit={handleSubmit}
        style={{
          background: "#ffffff",
          padding: 32,
          borderRadius: 16,
          boxShadow: "0 20px 40px rgba(15, 23, 42, 0.1)",
          width: 360,
          maxWidth: "90vw",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <h1 style={{ margin: 0 }}>JusConnect</h1>
        <p style={{ marginTop: 4, color: "#6b7280" }}>Autenticação simulada para acessar os modelos.</p>
        <label style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          E-mail
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            style={{ padding: "12px", borderRadius: 8, border: "1px solid #d1d5db" }}
          />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          Senha
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            style={{ padding: "12px", borderRadius: 8, border: "1px solid #d1d5db" }}
          />
        </label>
        <button
          type="submit"
          disabled={loading}
          style={{
            background: "#4f46e5",
            color: "#ffffff",
            border: "none",
            borderRadius: 8,
            padding: "12px 16px",
            fontSize: 16,
            cursor: "pointer",
          }}
        >
          {loading ? "Entrando..." : "Entrar"}
        </button>
        {error ? <span style={{ color: "#ef4444" }}>{error}</span> : null}
      </form>
    </div>
  );
};

export default LoginPage;

import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { LogIn, Mail } from "lucide-react";
import AuthLayout from "../components/auth/AuthLayout";
import { Alert, Button, PasswordField, TextField } from "../components/ui";
import { homeFor } from "../lib/session";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function Login() {
  const location = useLocation();
  const navigate = useNavigate();
  const [email, setEmail] = useState(location.state?.email || "");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const justRegistered = location.state?.registered;

  const validate = () => {
    const next = {};
    if (!email.trim()) next.email = "Enter your email address.";
    else if (!EMAIL_PATTERN.test(email.trim())) next.email = "That doesn't look like an email address.";
    if (!password) next.password = "Enter your password.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setServerError("");
    if (!validate() || submitting) return;
    setSubmitting(true);

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setServerError(data.message === "Invalid credentials" ? "That email and password don't match an account." : data.message || "Sign-in failed.");
        return;
      }

      localStorage.setItem("token", data.token);
      localStorage.setItem("role", data.role);
      localStorage.setItem("name", data.name);
      navigate(homeFor(data.role));
    } catch (err) {
      console.error(err);
      setServerError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to your account."
      footer={
        <p className="text-sm text-muted">
          New here? <Link to="/register" className="font-semibold">Create an account</Link>
        </p>
      }
    >
      <form onSubmit={handleLogin} noValidate className="stack">
        {justRegistered && !serverError && (
          <Alert tone="success" title="Account created">
            Sign in with your new account.
          </Alert>
        )}
        {serverError && <Alert tone="danger">{serverError}</Alert>}

        <TextField
          label="Email"
          type="email"
          icon={Mail}
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
          required
          disabled={submitting}
        />
        <PasswordField
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          error={errors.password}
          required
          disabled={submitting}
        />
        <Button type="submit" variant="primary" size="lg" block loading={submitting} icon={LogIn}>
          {submitting ? "Signing in..." : "Sign in"}
        </Button>
      </form>
    </AuthLayout>
  );
}

export default Login;

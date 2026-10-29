import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Check, Compass, Mail, User, UserPlus, Wand2 } from "lucide-react";
import AuthLayout from "../components/auth/AuthLayout";
import { Alert, Button, PasswordField, TextField } from "../components/ui";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ROLES = [
  { value: "STUDENT", label: "Student", hint: "I play campaigns", icon: Compass, tone: "student" },
  { value: "TEACHER", label: "Teacher", hint: "I create campaigns", icon: Wand2, tone: "teacher" },
];

function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("STUDENT");
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  const validate = () => {
    const next = {};
    if (!name.trim()) next.name = "Enter your name.";
    if (!email.trim()) next.email = "Enter your email address.";
    else if (!EMAIL_PATTERN.test(email.trim())) next.email = "That doesn't look like an email address.";
    if (!password) next.password = "Choose a password.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setServerError("");
    if (!validate() || submitting) return;
    setSubmitting(true);

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), password, role }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setServerError(data.message || "Couldn't create the account.");
        return;
      }

      navigate("/", { state: { registered: true, email: email.trim() } });
    } catch (err) {
      console.error(err);
      setServerError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Sign up as a student or a teacher."
      footer={
        <p className="text-sm text-muted">
          Already have an account? <Link to="/" className="font-semibold">Sign in</Link>
        </p>
      }
    >
      <form onSubmit={handleRegister} noValidate className="stack">
        {serverError && <Alert tone="danger">{serverError}</Alert>}

        <fieldset className="role-picker" disabled={submitting}>
          <legend className="field__label" style={{ marginBottom: 8 }}>
            I am a...
          </legend>
          <div className="role-picker__options">
            {ROLES.map((r) => {
              const Icon = r.icon;
              const selected = role === r.value;
              return (
                <label key={r.value} className="role-option" data-selected={selected} style={{ "--tone": `var(--color-${r.tone})`, "--tone-soft": `var(--color-${r.tone}-soft)` }}>
                  <input type="radio" name="role" value={r.value} checked={selected} onChange={() => setRole(r.value)} className="sr-only" />
                  <span className="role-option__icon" aria-hidden="true">
                    <Icon size={22} />
                  </span>
                  <span className="grow">
                    <span className="role-option__label">{r.label}</span>
                    <span className="role-option__hint">{r.hint}</span>
                  </span>
                  {selected && <Check size={18} className="role-option__check" aria-hidden="true" />}
                </label>
              );
            })}
          </div>
        </fieldset>

        <TextField label="Name" icon={User} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} required disabled={submitting} />
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
        <PasswordField value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" error={errors.password} required disabled={submitting} />

        <Button type="submit" variant="primary" size="lg" block loading={submitting} icon={UserPlus}>
          {submitting ? "Creating account..." : "Create account"}
        </Button>
      </form>
    </AuthLayout>
  );
}

export default Register;

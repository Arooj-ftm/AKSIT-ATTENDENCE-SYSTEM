
import { useState } from "react";
import {
    Eye,
    EyeOff,
    Mail,
    Lock,
    ArrowRight,
    ShieldCheck,
} from "lucide-react";
import "./Login.css";

const API_BASE_URL =
    import.meta.env.VITE_API_URL || "http://localhost:5000";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function Login({ onLogin }) {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (event) => {
        event.preventDefault();
        setError("");

        const normalizedEmail = email.trim().toLowerCase();

        if (!normalizedEmail || !password) {
            setError("Please enter your company email and password.");
            return;
        }

        if (!emailRegex.test(normalizedEmail)) {
            setError("Please enter a valid email address.");
            return;
        }

        setLoading(true);

        try {
            const response = await fetch(
                `${API_BASE_URL}/api/auth/login`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        email: normalizedEmail,
                        password,
                    }),
                }
            );

            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(
                    data.message || "Login failed. Please check your credentials."
                );
            }

            const token = data.token || data.data?.token;
            const user = data.user || data.data?.user;

            if (!token || !user) {
                throw new Error(
                    "Login response is incomplete. Please check the backend response."
                );
            }

            if (typeof onLogin === "function") {
                await onLogin({ token, user });
            }
        } catch (err) {
            setError(
                err.message ||
                "Unable to connect to the server. Please try again."
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="login-page">
            <div className="login-decoration login-decoration-one" />
            <div className="login-decoration login-decoration-two" />

            <section className="login-card">
                <div className="login-brand">
                    <img
                        src="/logo.png"
                        alt="Company logo"
                        className="login-logo"
                        onError={(event) => {
                            event.currentTarget.style.display = "none";
                        }}
                    />
                    <span className="login-brand-label">WORKSPACE</span>
                </div>

                <div className="login-heading">
                    <span className="login-eyebrow">WELCOME BACK</span>
                    <h1>Sign in to your account</h1>
                    <p>
                        Enter your company credentials to continue.
                    </p>
                </div>

                <form
                    className="login-form"
                    onSubmit={handleSubmit}
                    noValidate
                >
                    <label htmlFor="login-email">Company email</label>

                    <div className="login-input-wrap">
                        <Mail size={19} aria-hidden="true" />

                        <input
                            id="login-email"
                            name="email"
                            type="email"
                            placeholder="you@company.com"
                            value={email}
                            onChange={(event) => {
                                setEmail(event.target.value);
                                setError("");
                            }}
                            autoComplete="username"
                            autoCapitalize="none"
                            spellCheck={false}
                            required
                            disabled={loading}
                        />
                    </div>

                    <div className="login-password-label">
                        <label htmlFor="login-password">Password</label>
                    </div>

                    <div className="login-input-wrap">
                        <Lock size={19} aria-hidden="true" />

                        <input
                            id="login-password"
                            name="password"
                            type={showPassword ? "text" : "password"}
                            placeholder="Enter your password"
                            value={password}
                            onChange={(event) => {
                                setPassword(event.target.value);
                                setError("");
                            }}
                            autoComplete="current-password"
                            required
                            disabled={loading}
                        />

                        <button
                            type="button"
                            className="login-password-toggle"
                            onClick={() =>
                                setShowPassword((current) => !current)
                            }
                            aria-label={
                                showPassword ? "Hide password" : "Show password"
                            }
                            title={
                                showPassword ? "Hide password" : "Show password"
                            }
                            disabled={loading}
                        >
                            {showPassword ? (
                                <EyeOff size={19} />
                            ) : (
                                <Eye size={19} />
                            )}
                        </button>
                    </div>

                    {error && (
                        <p className="login-error" role="alert">
                            {error}
                        </p>
                    )}

                    <button
                        type="submit"
                        className="login-submit"
                        disabled={loading}
                    >
                        {loading ? "Signing in..." : "Sign In"}
                        {!loading && <ArrowRight size={18} />}
                    </button>
                </form>

                <div className="login-footer">
                    <ShieldCheck size={16} />
                    Secure company workspace
                </div>
            </section>

            <p className="login-copyright">
                © {new Date().getFullYear()} Your Company. All rights reserved.
            </p>
        </main>
    );
}

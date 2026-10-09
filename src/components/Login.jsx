import { useState } from "react";
import {
    Eye,
    EyeOff,
    Mail,
    Lock,
    ArrowRight,
    Check,
    ShieldCheck,
} from "lucide-react";
import "./Login.css";

const emailRegex = /^[^\s@]+@[^\s@]+.[^\s@]{2,}$/;

const passwordRules = [
    {
        label: "At least 8 characters",
        test: (password) => password.length >= 8,
    },
    {
        label: "One uppercase letter (A–Z)",
        test: (password) => /[A-Z]/.test(password),
    },
    {
        label: "One lowercase letter (a–z)",
        test: (password) => /[a-z]/.test(password),
    },
    {
        label: "One number (0–9)",
        test: (password) => /\d/.test(password),
    },
    {
        label: "One special character (@, #, !)",
        test: (password) => /[^A-Za-z0-9\s]/.test(password),
    },
    {
        label: "No spaces",
        test: (password) => !/\s/.test(password),
    },
];

const passwordRegex =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9\s])\S{8,}$/;

export default function Login({ onLogin }) {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState("");
    const [showRequirements, setShowRequirements] = useState(false);


    const handleSubmit = (event) => {
        event.preventDefault();
        setError("");

        const normalizedEmail = email.trim();

        if (!normalizedEmail || !password) {
            setError("Please enter your company email and password.");
            return;
        }

        if (!emailRegex.test(normalizedEmail)) {
            setError("Please enter a valid email address.");
            return;
        }

        if (!passwordRegex.test(password)) {
            setError(
                "Your password must contain at least 8 characters, one uppercase letter, one lowercase letter, one number, and one special character, with no spaces."
            );
            return;
        }

        if (typeof onLogin === "function") {
            onLogin({ email: normalizedEmail });
        }
    };
    const handlePasswordChange = (event) => {
        setPassword(event.target.value);
        setError("");
    };

    return (<main className="login-page"> <div className="login-decoration login-decoration-one" /> <div className="login-decoration login-decoration-two" />


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
                <p>Enter your company credentials to continue.</p>
            </div>

            <form className="login-form" onSubmit={handleSubmit} noValidate>
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
                        onChange={handlePasswordChange}
                        autoComplete="current-password"
                        required
                    />

                    <button
                        type="button"
                        className="login-password-toggle"
                        onClick={() => setShowPassword((current) => !current)}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        title={showPassword ? "Hide password" : "Show password"}
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

                <button type="submit" className="login-submit">
                    Sign In
                    <ArrowRight size={18} />
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

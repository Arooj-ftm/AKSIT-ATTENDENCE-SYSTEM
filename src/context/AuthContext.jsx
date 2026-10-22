
import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useState,
} from "react";
import { apiRequest } from "../api/api";

const AuthContext = createContext(null);

const TOKEN_KEY = "aksit_auth_token";

export function AuthProvider({ children }) {
    const [token, setToken] = useState(() =>
        localStorage.getItem(TOKEN_KEY)
    );

    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    const logout = useCallback(() => {
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
        setUser(null);
    }, []);

    const login = useCallback(async (credentials) => {
        const data = await apiRequest("/api/auth/login", {
            method: "POST",
            body: JSON.stringify(credentials),
        });

        if (!data.token || !data.user) {
            throw new Error(
                "Backend ne valid login response nahi diya."
            );
        }

        localStorage.setItem(TOKEN_KEY, data.token);
        setToken(data.token);
        setUser(data.user);

        return data.user;
    }, []);

    const refreshUser = useCallback(async (activeToken) => {
        const sessionToken = activeToken || token;

        if (!sessionToken) {
            throw new Error("Login session nahi mili.");
        }

        const data = await apiRequest(
            "/api/auth/me",
            {},
            sessionToken
        );

        setUser(data.user);
        return data.user;
    }, [token]);

    const acceptSession = useCallback(({ token, user }) => {
        if (!token || !user) {
            throw new Error("Login session is incomplete.");
        }

        localStorage.setItem(TOKEN_KEY, token);
        setToken(token);
        setUser(user);

        return user;
    }, []);

    // Update authenticated user's name and email.
    const updateProfile = useCallback(async ({
        name,
        email,
    }) => {
        if (!token) {
            throw new Error(
                "Profile update karne ke liye login karein."
            );
        }

        const data = await apiRequest(
            "/api/auth/profile",
            {
                method: "PATCH",
                body: JSON.stringify({
                    name,
                    email,
                }),
            },
            token
        );

        if (!data.success || !data.user) {
            throw new Error(
                data.message || "Profile update nahi ho saka."
            );
        }

        // Keep the updated profile in the current app session.
        setUser((previousUser) => ({
            ...(previousUser || {}),
            ...data.user,
        }));

        return data;
    }, [token]);

    // Existing password-change functionality remains unchanged.
    const changePassword = useCallback(async ({
        currentPassword,
        newPassword,
    }) => {
        if (!token) {
            throw new Error(
                "Password change karne ke liye login karein."
            );
        }

        const data = await apiRequest(
            "/api/auth/change-password",
            {
                method: "POST",
                body: JSON.stringify({
                    currentPassword,
                    newPassword,
                }),
            },
            token
        );

        if (!data.success) {
            throw new Error(
                data.message || "Password change nahi ho saka."
            );
        }

        if (data.user) {
            setUser((previousUser) => ({
                ...(previousUser || {}),
                ...data.user,
                mustChangePassword: false,
            }));
        } else {
            await refreshUser(token);
        }

        return data;
    }, [token, refreshUser]);

    useEffect(() => {
        let cancelled = false;

        async function restoreSession() {
            if (!token) {
                setLoading(false);
                return;
            }

            try {
                const data = await apiRequest(
                    "/api/auth/me",
                    {},
                    token
                );

                if (!cancelled) {
                    setUser(data.user);
                }
            } catch {
                if (!cancelled) {
                    localStorage.removeItem(TOKEN_KEY);
                    setToken(null);
                    setUser(null);
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        }

        restoreSession();

        return () => {
            cancelled = true;
        };
    }, [token]);

    return (
        <AuthContext.Provider
            value={{
                user,
                token,
                loading,
                isAuthenticated: Boolean(token && user),
                mustChangePassword:
                    user?.mustChangePassword === true,
                login,
                logout,
                refreshUser,
                acceptSession,
                changePassword,
                updateProfile,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);

    if (!context) {
        throw new Error(
            "useAuth must be used inside AuthProvider."
        );
    }

    return context;
}

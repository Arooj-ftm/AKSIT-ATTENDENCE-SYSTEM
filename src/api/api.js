
const API_BASE_URL =
    import.meta.env.VITE_API_URL || "http://localhost:5000";

export async function apiRequest(path, options = {}, token) {
    const isFormData =
        typeof FormData !== "undefined" &&
        options.body instanceof FormData;

    const {
        token: optionsToken,
        headers: customHeaders,
        ...fetchOptions
    } = options;

    const authToken = token || optionsToken;

    const headers = {
        ...(!isFormData && fetchOptions.body
            ? { "Content-Type": "application/json" }
            : {}),
        ...customHeaders,
    };

    if (isFormData) {
        delete headers["Content-Type"];
        delete headers["content-type"];
    }

    if (authToken) {
        headers.Authorization = `Bearer ${authToken}`;
    }

    let response;

    try {
        response = await fetch(`${API_BASE_URL}${path}`, {
            ...fetchOptions,
            headers,
        });
    } catch {
        throw new Error("Backend se connection nahi ho raha.");
    }

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(data.message || "Request failed.");
    }

    return data;
}

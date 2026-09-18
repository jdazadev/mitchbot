const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
class AuthService {
    tokenKey = 'mitchbot_token';
    userKey = 'mitchbot_user';
    /** Obtener token almacenado */
    getToken() {
        return localStorage.getItem(this.tokenKey);
    }
    /** Obtener usuario almacenado */
    getUser() {
        const data = localStorage.getItem(this.userKey);
        if (!data)
            return null;
        try {
            return JSON.parse(data);
        }
        catch {
            return null;
        }
    }
    /** ¿Está autenticado? */
    isAuthenticated() {
        const token = this.getToken();
        if (!token)
            return false;
        // Verificar que el token no haya expirado (decodificar payload)
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            const now = Math.floor(Date.now() / 1000);
            return payload.exp > now;
        }
        catch {
            return false;
        }
    }
    /** Guardar sesión */
    saveSession(data) {
        localStorage.setItem(this.tokenKey, data.token);
        localStorage.setItem(this.userKey, JSON.stringify(data.user));
    }
    /** Limpiar sesión */
    clearSession() {
        localStorage.removeItem(this.tokenKey);
        localStorage.removeItem(this.userKey);
    }
    /** Headers con Authorization */
    getHeaders() {
        const token = this.getToken();
        return {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        };
    }
    /** Login */
    async login(email, password) {
        const res = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        });
        const data = await res.json();
        if (!res.ok)
            throw new Error(data.error || 'Error al iniciar sesión');
        this.saveSession(data);
        return data;
    }
    /** Register */
    async register(name, email, password) {
        const res = await fetch(`${API_BASE}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password }),
        });
        const data = await res.json();
        if (!res.ok)
            throw new Error(data.error || 'Error al registrar');
        this.saveSession(data);
        return data;
    }
    /** Logout */
    async logout() {
        try {
            await fetch(`${API_BASE}/auth/logout`, {
                method: 'POST',
                headers: this.getHeaders(),
            });
        }
        catch {
            // Ignorar errores de red en logout
        }
        this.clearSession();
        // Limpiar también el cache del proyecto
        localStorage.removeItem('mitchbot_project_setup');
    }
    /** Obtener perfil actualizado desde el servidor */
    async getProfile() {
        const res = await fetch(`${API_BASE}/auth/profile`, {
            headers: this.getHeaders(),
        });
        const data = await res.json();
        if (!res.ok)
            throw new Error(data.error || 'Error al obtener perfil');
        localStorage.setItem(this.userKey, JSON.stringify(data));
        return data;
    }
    /** Actualizar perfil */
    async updateProfile(profileData) {
        const res = await fetch(`${API_BASE}/auth/profile`, {
            method: 'PUT',
            headers: this.getHeaders(),
            body: JSON.stringify(profileData),
        });
        const data = await res.json();
        if (!res.ok)
            throw new Error(data.error || 'Error al actualizar perfil');
        localStorage.setItem(this.userKey, JSON.stringify(data));
        return data;
    }
}
export const authService = new AuthService();
//# sourceMappingURL=auth.service.js.map
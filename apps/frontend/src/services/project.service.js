import { authService } from './auth.service';
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
class ProjectService {
    setupKey = 'mitchbot_project_setup';
    /** ¿Ya tiene proyecto configurado? (cache local) */
    hasLocalProject() {
        return localStorage.getItem(this.setupKey) === 'true';
    }
    /** Marcar que ya tiene proyecto */
    setLocalProject(value) {
        if (value) {
            localStorage.setItem(this.setupKey, 'true');
        }
        else {
            localStorage.removeItem(this.setupKey);
        }
    }
    /** Verificar en el servidor si existe un proyecto */
    async checkProject() {
        const res = await fetch(`${API_BASE}/project/check`, {
            headers: authService.getHeaders(),
        });
        if (!res.ok)
            return false;
        const data = await res.json();
        this.setLocalProject(data.hasProject);
        return data.hasProject;
    }
    /** Obtener proyecto activo */
    async getProject() {
        const res = await fetch(`${API_BASE}/project`, {
            headers: authService.getHeaders(),
        });
        if (!res.ok)
            return null;
        return res.json();
    }
    /** Crear proyecto con agente */
    async createProject(data) {
        const res = await fetch(`${API_BASE}/project`, {
            method: 'POST',
            headers: authService.getHeaders(),
            body: JSON.stringify(data),
        });
        const result = await res.json();
        if (!res.ok)
            throw new Error(result.error || 'Error al crear proyecto');
        this.setLocalProject(true);
        return result;
    }
    /** Actualizar proyecto */
    async updateProject(data) {
        const res = await fetch(`${API_BASE}/project`, {
            method: 'PUT',
            headers: authService.getHeaders(),
            body: JSON.stringify(data),
        });
        const result = await res.json();
        if (!res.ok)
            throw new Error(result.error || 'Error al actualizar proyecto');
        return result;
    }
    /** Limpiar cache local */
    clearLocal() {
        localStorage.removeItem(this.setupKey);
    }
}
export const projectService = new ProjectService();
//# sourceMappingURL=project.service.js.map
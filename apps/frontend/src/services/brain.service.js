import { authService } from './auth.service';
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
export const brainService = {
    async getSources() {
        const res = await fetch(`${API_URL}/brain/sources`, {
            headers: authService.getHeaders(),
        });
        if (!res.ok)
            throw new Error('Failed to fetch sources');
        return res.json();
    },
    async getStats() {
        const res = await fetch(`${API_URL}/brain/stats`, {
            headers: authService.getHeaders(),
        });
        if (!res.ok)
            throw new Error('Failed to fetch stats');
        return res.json();
    },
    async uploadSource(file, collectionName) {
        const token = authService.getToken();
        const formData = new FormData();
        formData.append('file', file);
        if (collectionName) {
            formData.append('collectionName', collectionName);
        }
        const res = await fetch(`${API_URL}/brain/sources/upload`, {
            method: 'POST',
            headers: {
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: formData,
        });
        const data = await res.json();
        if (!res.ok)
            throw new Error(data.error || 'Error al subir archivo');
        return data;
    },
    async getSourceLogs(id) {
        const res = await fetch(`${API_URL}/brain/sources/${id}/logs`, {
            headers: authService.getHeaders(),
        });
        const data = await res.json();
        if (!res.ok)
            throw new Error(data.error || 'Error al obtener logs');
        return data;
    },
    async writeTextSource(data) {
        const res = await fetch(`${API_URL}/brain/sources/write`, {
            method: 'POST',
            headers: authService.getHeaders(),
            body: JSON.stringify(data),
        });
        const result = await res.json();
        if (!res.ok)
            throw new Error(result.error || 'Error al guardar texto');
        return result;
    },
    async deleteSource(id) {
        const res = await fetch(`${API_URL}/brain/sources/${id}`, {
            method: 'DELETE',
            headers: authService.getHeaders(),
        });
        if (!res.ok && res.status !== 204) {
            const data = await res.json();
            throw new Error(data.error || 'Error al eliminar fuente');
        }
    },
    async getSourceExtractedText(id) {
        const res = await fetch(`${API_URL}/brain/sources/${id}/extracted-text`, {
            headers: authService.getHeaders(),
        });
        const data = await res.json();
        if (!res.ok)
            throw new Error(data.error || 'Error al obtener texto extraido');
        return data;
    },
    async extractTextOnly(file) {
        const token = authService.getToken();
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch(`${API_URL}/brain/devadmin/extract`, {
            method: 'POST',
            headers: {
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: formData,
        });
        const data = await res.json();
        if (!res.ok)
            throw new Error(data.error || 'Error al extraer texto');
        return data;
    },
    async convertPdfToImages(file, maxPages = 6) {
        const token = authService.getToken();
        const formData = new FormData();
        formData.append('file', file);
        formData.append('maxPages', String(maxPages));
        const res = await fetch(`${API_URL}/brain/devadmin/pdf-to-images`, {
            method: 'POST',
            headers: {
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: formData,
        });
        const data = await res.json();
        if (!res.ok)
            throw new Error(data.error || 'Error al convertir PDF');
        return data;
    },
};
//# sourceMappingURL=brain.service.js.map

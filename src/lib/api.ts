const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3333";

console.log("🔗 API URL:", API_URL);

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function getToken() {
  return localStorage.getItem("vertente_admin_token");
}

async function handle(res: Response) {
  const isJson = res.headers.get("content-type")?.includes("application/json");
  const body = isJson ? await res.json() : null;

  if (!res.ok) {
    const message = body?.error || "Não foi possível completar a operação.";
    throw new ApiError(message, res.status);
  }

  return body;
}

function authHeaders(): HeadersInit {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export const api = {
  async post(path: string, data: unknown) {
    const res = await fetch(`${API_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(data),
    });
    return handle(res);
  },

  async put(path: string, data: unknown) {
    const res = await fetch(`${API_URL}${path}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(data),
    });
    return handle(res);
  },

  async patch(path: string, data: unknown) {
    const res = await fetch(`${API_URL}${path}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(data),
    });
    return handle(res);
  },

  async get(path: string) {
    const res = await fetch(`${API_URL}${path}`, { headers: authHeaders() });
    return handle(res);
  },

  async delete(path: string) {
    const res = await fetch(`${API_URL}${path}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    return handle(res);
  },

  // Upload multipart com progresso (usa XHR pois fetch não expõe upload progress)
  uploadForm(
    path: string,
    method: "POST" | "PUT",
    formData: FormData,
    onProgress?: (percent: number) => void,
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open(method, `${API_URL}${path}`);

      const token = getToken();
      if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      };

      xhr.onload = () => {
        let body: any = null;
        try {
          body = JSON.parse(xhr.responseText);
        } catch {
          // resposta vazia/não-json
        }

        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(body);
        } else {
          reject(
            new ApiError(body?.error || "Erro ao enviar o modelo.", xhr.status),
          );
        }
      };

      xhr.onerror = () =>
        reject(new ApiError("Erro de conexão com o servidor.", 0));

      xhr.send(formData);
    });
  },
};

export { getToken };

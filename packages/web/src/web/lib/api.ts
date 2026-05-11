// Simple fetch wrapper — matches api.get/post/patch/delete usage patterns throughout the app

const getHeaders = () => {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  return headers;
};

export const api = {
  get: (path: string) =>
    fetch(path, { headers: getHeaders(), credentials: "include" }),

  post: (path: string, body?: unknown) =>
    fetch(path, {
      method: "POST",
      headers: getHeaders(),
      credentials: "include",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),

  patch: (path: string, body?: unknown) =>
    fetch(path, {
      method: "PATCH",
      headers: getHeaders(),
      credentials: "include",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),

  put: (path: string, body?: unknown) =>
    fetch(path, {
      method: "PUT",
      headers: getHeaders(),
      credentials: "include",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),

  delete: (path: string) =>
    fetch(path, {
      method: "DELETE",
      headers: getHeaders(),
      credentials: "include",
    }),
};

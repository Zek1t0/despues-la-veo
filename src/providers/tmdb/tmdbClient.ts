const TMDB_BASE = "https://api.themoviedb.org/3";

function getToken() {
  const token = process.env.EXPO_PUBLIC_TMDB_TOKEN;
  if (!token) throw new Error("Falta EXPO_PUBLIC_TMDB_TOKEN en .env");
  return token;
}

export async function tmdbFetch<T>(path: string, params?: Record<string, string>) {
  const url = new URL(TMDB_BASE + path);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${getToken()}`,
      "Content-Type": "application/json;charset=utf-8",
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`TMDB ${res.status} ${res.statusText}: ${text}`);
  }

  return (await res.json()) as T;
}
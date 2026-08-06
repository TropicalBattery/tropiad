type ApiResponse<T> = {
  data: T | null;
  error: string | null;
};

export async function requestAdminApi<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(url, options);
  const payload = (await response.json()) as ApiResponse<T>;

  if (!response.ok || payload.error) {
    throw new Error(payload.error ?? "Request failed.");
  }

  if (payload.data === null) {
    throw new Error("Request returned no data.");
  }

  return payload.data;
}

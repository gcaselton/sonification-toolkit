export async function apiRequest(
  url: string,
  payload: any = {},
  method: string = "POST",
  options: { signal?: AbortSignal } = {}
) {
  const baseOptions: RequestInit = {
    method,
    credentials: "include",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    signal: options.signal,
  };

  const requestOptions: RequestInit =
    method !== "GET"
      ? {
        ...baseOptions,
        body: JSON.stringify(payload),
      }
      : baseOptions;

  try {
    const res = await fetch(url, requestOptions);

    if (!res.ok) {
      let message = `HTTP ${res.status}`;

      try {
        const errorData = await res.json();
        if (errorData?.detail) {
          message = errorData.detail;
        }
      } catch {
        // response was not JSON — ignore
      }

      throw new Error(message);
    }


    return await res.json();
  } catch (err: any) {

    if (err.name === "AbortError") {
      throw err;
    }

    console.error(`${method} error:`, err);
    throw err;
  }
}

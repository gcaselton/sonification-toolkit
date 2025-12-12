

export async function apiRequest(url: string, payload = {}, method: string = 'POST') {
  const options: RequestInit = method != 'GET' ? {
    method,
    credentials: 'include', 
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload)
  } : {
    method,
    credentials: 'include', 
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    }
  };

  try {
    const res = await fetch(url, options);

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    return await res.json();
  } catch (err) {
    console.error(`${method} error:`, err);
    throw err;
  }
}

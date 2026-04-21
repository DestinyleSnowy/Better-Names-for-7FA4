export function createFetchClient(fetchImpl: typeof fetch = fetch) {
    return {
        async getJson<T>(url: string): Promise<T> {
            const response = await fetchImpl(url);
            if (!response.ok) {
                throw new Error(`Request failed: ${response.status}`);
            }
            return response.json() as Promise<T>;
        }
    };
}

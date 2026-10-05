/** The CSRF token Laravel keeps in its `XSRF-TOKEN` cookie, for a request sent outside the Inertia client. */
export function xsrfToken(): string {
    const match = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]+)/);

    return match ? decodeURIComponent(match[1]) : '';
}

/** A request that outlives the page leaving it (pagehide): the browser keeps it alive. */
export function sendOnUnload(route: { url: string; method: string }): void {
    fetch(route.url, {
        method: route.method.toUpperCase(),
        keepalive: true,
        credentials: 'same-origin',
        headers: { Accept: 'application/json', 'X-XSRF-TOKEN': xsrfToken() },
    }).catch(() => {});
}

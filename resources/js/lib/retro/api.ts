import { http, HttpResponseError } from '@inertiajs/core';
import { echo, echoIsConfigured } from '@laravel/echo-react';

type Route = { url: string; method: string };

type ErrorPayload = { message?: string; errors?: Record<string, string[]> };

export class RetroRequestError extends Error {
    constructor(
        public status: number,
        message: string,
        public errors: Record<string, string[]> = {},
    ) {
        super(message);
    }
}

function parse(data: string): ErrorPayload | null {
    try {
        return JSON.parse(data) as ErrorPayload;
    } catch {
        return null;
    }
}

function socketId(): string | undefined {
    if (!echoIsConfigured()) {
        return undefined;
    }

    return echo().socketId();
}

export async function retroRequest<T = null>(
    route: Route,
    data?: Record<string, unknown>,
): Promise<T> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    const socket = socketId();

    if (socket) {
        headers['X-Socket-ID'] = socket;
    }

    try {
        const response = await http.getClient().request({
            method: route.method as 'get',
            url: route.url,
            data,
            headers,
        });

        return (response.data === '' ? null : JSON.parse(response.data)) as T;
    } catch (error) {
        if (error instanceof HttpResponseError) {
            const payload = parse(error.response.data);
            const firstError = Object.values(payload?.errors ?? {})[0]?.[0];

            throw new RetroRequestError(
                error.response.status,
                firstError ?? payload?.message ?? error.message,
                payload?.errors ?? {},
            );
        }

        throw error;
    }
}

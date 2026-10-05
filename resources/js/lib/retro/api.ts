import { http, HttpCancelledError, HttpResponseError } from '@inertiajs/core';
import type { HttpResponse } from '@inertiajs/core';
import { echo, echoIsConfigured } from '@laravel/echo-react';
import type { Translate } from '@/hooks/use-trans';

const RequestTimeoutMs = 15_000;

type Route = { url: string; method: string };

type RequestOptions = { timeoutMs?: number };

type ErrorPayload = { message?: string; errors?: Record<string, string[]> };

export class RetroRequestError extends Error {
    constructor(
        public status: number,
        message: string,
        public errors: Record<string, string[]> = {},
        /** The whole answer, for an error that carries data (a 409 conflict). */
        public payload: unknown = null,
    ) {
        super(message);
    }
}

/** The translated message to show for a failed request. */
export function requestErrorMessage(error: unknown, t: Translate): string {
    if (!(error instanceof RetroRequestError)) {
        return t('Something went wrong. Please try again.');
    }

    if (error.status === 0) {
        return t('The server did not respond in time. Please try again.');
    }

    return error.message || t('Something went wrong. Please try again.');
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
    options: RequestOptions = {},
): Promise<T> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    const socket = socketId();

    if (socket) {
        headers['X-Socket-ID'] = socket;
    }

    let response: HttpResponse;

    try {
        response = await http.getClient().request({
            method: route.method as 'get',
            url: route.url,
            data,
            headers,
            signal: AbortSignal.timeout(options.timeoutMs ?? RequestTimeoutMs),
        });
    } catch (error) {
        if (error instanceof HttpResponseError) {
            const payload = parse(error.response.data);
            const firstError = Object.values(payload?.errors ?? {})[0]?.[0];

            throw new RetroRequestError(
                error.response.status,
                firstError ?? payload?.message ?? error.message,
                payload?.errors ?? {},
                payload,
            );
        }

        if (error instanceof HttpCancelledError) {
            throw new RetroRequestError(0, 'timeout');
        }

        throw error;
    }

    if (response.data === '') {
        return null as T;
    }

    try {
        return JSON.parse(response.data) as T;
    } catch {
        throw new RetroRequestError(response.status, 'invalid response');
    }
}

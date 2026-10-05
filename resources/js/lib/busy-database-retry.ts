import { HttpCancelledError, HttpResponseError } from '@inertiajs/core';
import type { HttpClient } from '@inertiajs/core';
import { busyMessage, header } from '@/lib/maintenance-reload';

function retryDelay(headers: Record<string, unknown>): number {
    const seconds = Number(header(headers, 'retry-after'));

    return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : 1000;
}

function wait(delay: number, url: string, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
        const cancel = () => {
            clearTimeout(timer);
            reject(new HttpCancelledError('Request was cancelled', url));
        };
        const timer = setTimeout(() => {
            signal?.removeEventListener('abort', cancel);
            resolve();
        }, delay);

        if (signal?.aborted) {
            cancel();

            return;
        }

        signal?.addEventListener('abort', cancel, { once: true });
    });
}

/**
 * A busy database answers 503 with its message in a header and a Retry-After:
 * the transaction was rolled back, so the request, visit or not, is sent once
 * more after that delay. A second refusal goes on to the caller, which shows
 * the message.
 */
export function retryOnceWhenDatabaseBusy(client: HttpClient): HttpClient {
    return {
        request: (config) =>
            client.request(config).catch(async (error: unknown) => {
                if (
                    !(error instanceof HttpResponseError) ||
                    error.response.status !== 503 ||
                    busyMessage(error.response.headers) === null
                ) {
                    throw error;
                }

                await wait(
                    retryDelay(error.response.headers),
                    config.url,
                    config.signal,
                );

                return client.request(config);
            }),
    };
}

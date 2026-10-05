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
 * A busy database answers 503 with its message in a header and a Retry-After.
 * A read is sent once more after that delay. A write is not: the server answers
 * busy wherever the error happens, also after the change was saved, so sending
 * it again could save it twice; its refusal goes straight on to the caller,
 * which shows the message, as does a second refusal of a read. The wrapped
 * client reports each refusal to `http.onError` handlers before this wrapper
 * sees it, the first busy answer to a read included, even when the retry
 * succeeds.
 */
export function retryOnceWhenDatabaseBusy(client: HttpClient): HttpClient {
    return {
        request: (config) =>
            client.request(config).catch(async (error: unknown) => {
                if (
                    config.method !== 'get' ||
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

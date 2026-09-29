export type WhisperChannel = {
    whisper(event: string, data: unknown): unknown;
    listen(
        event: string,
        callback: (data: unknown, metadata?: { user_id?: string }) => void,
    ): unknown;
    stopListening(
        event: string,
        callback?: (...args: never[]) => void,
    ): unknown;
};

/**
 * Client events on the presence channel. Reverb (accept_client_events_from
 * = members) stamps each relayed event with the sender's authenticated
 * presence id, so the sender comes from the server, never from the payload.
 */
export function whisperTransport(
    channel: WhisperChannel,
    event: string,
    accept: (senderId: string, raw: unknown) => boolean,
) {
    return {
        send(message: unknown) {
            try {
                channel.whisper(event, message);
            } catch {
                // The channel was left (board unmounting): nothing to send to.
            }
        },
        onMessage(handler: (raw: unknown, senderId?: string) => void) {
            const listener = (
                data: unknown,
                metadata?: { user_id?: string },
            ) => {
                const senderId = metadata?.user_id;

                if (!senderId || !accept(senderId, data)) {
                    return;
                }

                handler(data, senderId);
            };

            channel.listen(`.client-${event}`, listener);

            return () => {
                channel.stopListening(`.client-${event}`, listener);
            };
        },
    };
}

const channelKeys = new WeakMap<object, number>();
let channelKeyCounter = 0;

/** A stable key per channel object, so consumers rebuild when Echo swaps it. */
export function channelKey(channel: object): number {
    let key = channelKeys.get(channel);

    if (key === undefined) {
        channelKeyCounter += 1;
        key = channelKeyCounter;
        channelKeys.set(channel, key);
    }

    return key;
}

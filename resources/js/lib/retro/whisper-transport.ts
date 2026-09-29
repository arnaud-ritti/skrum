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
            channel.whisper(event, message);
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

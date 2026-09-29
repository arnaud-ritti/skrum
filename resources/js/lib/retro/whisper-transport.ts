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

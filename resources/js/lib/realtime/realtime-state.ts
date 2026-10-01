export type RealtimeState = 'connecting' | 'connected';

/**
 * A page is connected once its socket is up and its presence channel has
 * answered with the members who are here, which always include the viewer.
 */
export function realtimeState(
    connected: boolean,
    online: readonly unknown[],
): RealtimeState {
    return connected && online.length > 0 ? 'connected' : 'connecting';
}

type ReverbClientConfig = {
    key: string | null;
    host: string | null;
    port: number | null;
    scheme: 'http' | 'https' | null;
};

export type EchoConnection = {
    key: string;
    wsHost: string;
    wsPort: number;
    wssPort: number;
    forceTLS: boolean;
};

function readConfig(): ReverbClientConfig | null {
    const content = document
        .querySelector('meta[name="reverb-config"]')
        ?.getAttribute('content');

    if (!content) {
        return null;
    }

    try {
        return JSON.parse(content) as ReverbClientConfig;
    } catch {
        return null;
    }
}

export function echoConnection(): EchoConnection | null {
    const config = readConfig();

    if (!config?.key) {
        return null;
    }

    const scheme = config.scheme ?? window.location.protocol.replace(':', '');
    const secure = scheme === 'https';
    const pagePort = window.location.port
        ? Number(window.location.port)
        : secure
          ? 443
          : 80;
    const port = config.port ?? pagePort;

    return {
        key: config.key,
        wsHost: config.host ?? window.location.hostname,
        wsPort: port,
        wssPort: port,
        forceTLS: secure,
    };
}

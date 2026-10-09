type Demo = { enabled: boolean; resetTime: string; timezone: string };

export function DemoBanner({
    demo,
    translations,
}: {
    demo?: Demo;
    translations: Record<string, string>;
}) {
    if (!demo?.enabled) {
        return null;
    }

    const message = (
        translations['Public demo — data resets daily at :time (:timezone).'] ??
        'Public demo — data resets daily at :time (:timezone).'
    )
        .replace(':time', demo.resetTime)
        .replace(':timezone', demo.timezone);

    return (
        <aside className="border-b border-border bg-muted px-4 py-2 text-center text-sm text-foreground">
            <p>{message}</p>
            <p>
                <span>facilitator@skrum.test / member@skrum.test</span>
                {' · '}
                {translations['Password'] ?? 'Password'}: <code>password</code>
            </p>
        </aside>
    );
}

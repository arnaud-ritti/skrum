import { useHttp } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import { store as breachRange } from '@/actions/App/Http/Controllers/Settings/PasswordBreachRangesController';
import { isBreached, sha1Hex, splitHash } from '@/lib/settings/breach-check';

export type BreachState =
    | 'idle'
    | 'checking'
    | 'clear'
    | 'breached'
    | 'unavailable';

const DebounceMilliseconds = 600;

type Checked = { password: string; state: BreachState };

/**
 * Whether the password appears in known data breaches, by k-anonymity: the
 * instance receives five characters of its SHA-1 and answers the suffixes of
 * that range, which are compared here. Until the answer for the password as
 * it is now arrives, the state is `checking`.
 */
export function useBreachCheck(
    password: string,
    enabled: boolean,
): BreachState {
    const { transform, submit, cancel } = useHttp<
        { prefix: string },
        { suffixes?: string[] }
    >({ prefix: '' });
    const [checked, setChecked] = useState<Checked | null>(null);

    useEffect(() => {
        if (!enabled || password === '') {
            return;
        }

        let current = true;
        const settle = (state: BreachState): void => {
            if (current) {
                setChecked({ password, state });
            }
        };

        const timer = setTimeout(() => {
            void (async () => {
                const hash = await sha1Hex(password);

                if (!current) {
                    return;
                }

                if (hash === null) {
                    settle('unavailable');

                    return;
                }

                const { prefix, suffix } = splitHash(hash);

                transform(() => ({ prefix }));

                try {
                    const answer = await submit(breachRange());

                    if (!Array.isArray(answer?.suffixes)) {
                        settle('unavailable');

                        return;
                    }

                    settle(
                        isBreached(answer.suffixes, suffix)
                            ? 'breached'
                            : 'clear',
                    );
                } catch {
                    settle('unavailable');
                }
            })();
        }, DebounceMilliseconds);

        return () => {
            current = false;
            clearTimeout(timer);
            cancel();
        };
    }, [password, enabled, transform, submit, cancel]);

    if (!enabled || password === '') {
        return 'idle';
    }

    if (checked === null || checked.password !== password) {
        return 'checking';
    }

    return checked.state;
}

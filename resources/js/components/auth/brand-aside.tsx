import { AuthAside } from '@/components/auth/auth-aside';

/**
 * Right pane of the split auth screen: the promise and its sample notes, the
 * same on every instance. The instance's own logo or name is in the page's
 * header, not here.
 */
export function BrandAside() {
    return <AuthAside />;
}

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
    Card,
    CardAction,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';

describe('Card', () => {
    it('keeps every existing slot', () => {
        const { container } = render(
            <Card data-test="c">
                <CardHeader>
                    <CardTitle>Title</CardTitle>
                    <CardDescription>Desc</CardDescription>
                    <CardAction>Act</CardAction>
                </CardHeader>
                <CardContent>Body</CardContent>
                <CardFooter>Foot</CardFooter>
            </Card>,
        );

        for (const slot of [
            'card',
            'card-header',
            'card-title',
            'card-description',
            'card-action',
            'card-content',
            'card-footer',
        ]) {
            expect(
                container.querySelector(`[data-slot="${slot}"]`),
            ).not.toBeNull();
        }

        expect(screen.getByText('Title')).toBeTruthy();
    });

    it('renders header and footer from the title, description and footer props', () => {
        render(
            <Card title="Invite" description="Share the link" footer="Done">
                <CardContent>Body</CardContent>
            </Card>,
        );

        expect(screen.getByText('Invite')).toBeTruthy();
        expect(screen.getByText('Share the link')).toBeTruthy();
        expect(screen.getByText('Done')).toBeTruthy();
    });

    it('renders no header without title or description', () => {
        const { container } = render(<Card>Body</Card>);

        expect(container.querySelector('[data-slot="card-header"]')).toBeNull();
        expect(container.querySelector('[data-slot="card-footer"]')).toBeNull();
    });

    it('forwards the ref and extra props to its own root', () => {
        let node: HTMLElement | null = null;

        const { container } = render(
            <Card
                data-test="root"
                ref={(element) => {
                    node = element;
                }}
            >
                Body
            </Card>,
        );

        const root = container.querySelector('[data-slot="card"]');

        expect(root?.getAttribute('data-test')).toBe('root');
        expect(node).toBe(root);
    });

    it('forwards the ref to the slotted child with asChild', () => {
        let node: HTMLElement | null = null;

        render(
            <Card
                asChild
                ref={(element) => {
                    node = element;
                }}
            >
                <a href="/x">Go</a>
            </Card>,
        );

        const link = screen.getByRole('link', { name: 'Go' });

        expect(link.getAttribute('data-slot')).toBe('card');
        expect(node).toBe(link);
    });

});

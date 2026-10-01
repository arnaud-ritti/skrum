import { Moon, Monitor, Sun } from 'lucide-react';
import { useState } from 'react';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { useTrans } from '@/hooks/use-trans';

function Labelled({
    label,
    children,
}: {
    label: string;
    children: React.ReactNode;
}) {
    return (
        <div className="flex min-w-0 flex-col gap-2">
            <p className="text-xs font-semibold text-muted-foreground">
                {label}
            </p>
            {children}
        </div>
    );
}

export default function TabsSection() {
    const { t } = useTrans();
    const [view, setView] = useState('board');
    const [theme, setTheme] = useState('dark');
    const [step, setStep] = useState('write');
    const [settings, setSettings] = useState('members');
    const [status, setStatus] = useState('todo');
    const [counted, setCounted] = useState(6);

    const views = [
        { value: 'board', label: t('Board') },
        { value: 'groups', label: t('Groups') },
        { value: 'actions', label: t('Actions') },
        { value: 'export', label: t('Export'), disabled: true },
    ];

    return (
        <div className="flex max-w-2xl min-w-0 flex-col gap-8 p-4 md:p-6">
            <Labelled
                label={t('Pill: active, hover, keyboard focus, disabled')}
            >
                <Tabs
                    value={view}
                    onValueChange={setView}
                    items={views}
                    aria-label={t('Board view')}
                >
                    <TabsContent value="board">{t('Board')}</TabsContent>
                    <TabsContent value="groups">{t('Groups')}</TabsContent>
                    <TabsContent value="actions">{t('Actions')}</TabsContent>
                </Tabs>
            </Labelled>
            <Labelled label={t('Pill with icons')}>
                <Tabs
                    value={theme}
                    onValueChange={setTheme}
                    aria-label={t('Theme')}
                    items={[
                        { value: 'light', label: t('Light'), icon: Sun },
                        { value: 'dark', label: t('Dark'), icon: Moon },
                        { value: 'system', label: t('System'), icon: Monitor },
                    ]}
                />
            </Labelled>
            <Labelled label={t('Pill full width (mobile)')}>
                <div className="w-80 max-w-full">
                    <Tabs
                        value={step}
                        onValueChange={setStep}
                        fullWidth
                        aria-label={t('Step')}
                        items={[
                            { value: 'write', label: t('Write') },
                            { value: 'vote', label: t('Vote') },
                            { value: 'discuss', label: t('Discuss') },
                        ]}
                    />
                </div>
            </Labelled>
            <Labelled label={t('Line: active, hover, disabled')}>
                <Tabs
                    value={settings}
                    onValueChange={setSettings}
                    variant="line"
                    aria-label={t('Team settings')}
                    items={[
                        { value: 'general', label: t('General') },
                        { value: 'members', label: t('Members') },
                        { value: 'integrations', label: t('Integrations') },
                        {
                            value: 'billing',
                            label: t('Billing'),
                            disabled: true,
                        },
                    ]}
                />
            </Labelled>
            <Labelled label={t('Line with counts, updated live')}>
                <Tabs
                    value={status}
                    onValueChange={setStatus}
                    variant="line"
                    aria-label={t('Actions')}
                    items={[
                        { value: 'todo', label: t('To do'), count: counted },
                        { value: 'late', label: t('Overdue'), count: 2 },
                        { value: 'done', label: t('Done'), count: 14 },
                        { value: 'all', label: t('All') },
                    ]}
                />
                <button
                    type="button"
                    className="self-start text-xs underline"
                    onClick={() => setCounted((count) => count + 1)}
                >
                    {t('Add an action')}
                </button>
            </Labelled>
        </div>
    );
}

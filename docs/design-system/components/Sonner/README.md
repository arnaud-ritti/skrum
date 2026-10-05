Notifications éphémères (toasts Sonner) et messages inline persistants (`Alert`) pour informer du résultat d'une action ou d'un état.

**Quand l'utiliser**
- Toast : confirmation d'une action (succès), action réversible avec « Annuler » (info), perte de connexion temporaire (avertissement), échec avec « Réessayer » (erreur).
- Alert inline : état durable lié à une zone (cartes masquées, SMTP configuré, actions non terminées, certificat SSO expiré).
- Décision bloquante → `Dialog`.

**Anatomie**
Toast 356 px : `--popover`, bord, `--radius`, `--shadow-popover`, icône de statut 16 (`circle-check`, `info`, `wifi-off`, `circle-x`) colorée en `*-text`, titre 600 + description 13 muted, action (outline sm) ou fermer (`x`). Pile repliée : toasts précédents décalés de 8 px et réduits (0,95 / 0,9). Alert : fond `*-soft`, texte `*-text`, icône, titre 650, description, action optionnelle à droite.

**Props**
```ts
// toast (sonner)
toast.success('Rétro créée', { description: "Le lien d'invitation est copié." });
toast.info('3 cartes fusionnées', { description: 'Groupe « Tests instables ».', action: { label: 'Annuler', onClick: undo } });
toast.warning('Connexion perdue', { description: 'Reconnexion dans 4 s', duration: Infinity, id: 'ws' });
toast.error('Export Jira impossible', { description: "Jeton expiré — reconnecte l'intégration.", action: { label: 'Réessayer', onClick: retry } });
interface AlertProps { variant: 'info' | 'success' | 'warning' | 'error'; title: string; description?: string; action?: React.ReactNode; icon?: LucideIcon }
```

**États**
Toast : entrée (`--duration-base` `--ease-enter`), pile repliée / dépliée au survol, persistant (reconnexion : même `id`, mis à jour en succès « Reconnecté » puis fermé), fermeture. Alert : 4 variantes, avec ou sans action.

**Accessibilité & clavier**
- Succès/info/avertissement : `role="status"` (`aria-live="polite"`) ; erreur : `role="alert"`.
- Durée ≥ 5 s, pause au survol et au focus ; `Alt+T` place le focus dans la région des toasts.
- L'action « Annuler » reste accessible au clavier avant expiration ; jamais d'info unique dans un toast.

**Temps réel**
Un seul toast par événement distant regroupé (« Théo et 2 autres ont rejoint ») ; la perte de websocket utilise un toast persistant plutôt qu'une pile de toasts.

**À faire / À éviter**
- Faire : titre au passé (« Rétro créée ») ; ≤ 3 toasts visibles ; position bas droite desktop, haut mobile.
- Éviter : toast pour une erreur de formulaire (→ message inline) ; Alert rouge pour une info.

**Tokens**
`--popover` `--popover-foreground` `--border` `--muted-foreground` `--foreground` `--skrum-success-soft` `--skrum-success-text` `--skrum-info-soft` `--skrum-info-text` `--skrum-warning-soft` `--skrum-warning-text` `--skrum-destructive-soft` `--skrum-destructive-text` `--shadow-popover` `--radius` `--duration-base` `--ease-enter` `--z-toast`

**Mapping shadcn**
- `@/components/ui/sonner` (`<Toaster position="bottom-right" richColors={false} />`) et `@/components/ui/alert` (`Alert`, `AlertTitle`, `AlertDescription`).
- Toaster `toastOptions.classNames` : `toast: 'bg-popover text-popover-foreground border rounded-lg shadow-popover'`, `description: 'text-muted-foreground text-body-sm'`, `success: '[&_[data-icon]]:text-skrum-success-text'` (idem warning/error/info), `actionButton: buttonVariants({ variant: 'outline', size: 'sm' })`.
- Alert (cva) : `info: 'bg-skrum-info-soft text-skrum-info-text'`, `success: 'bg-skrum-success-soft text-skrum-success-text'`, `warning: 'bg-skrum-warning-soft text-skrum-warning-text'`, `error: 'bg-skrum-destructive-soft text-skrum-destructive-text'` ; description `text-foreground/85`.

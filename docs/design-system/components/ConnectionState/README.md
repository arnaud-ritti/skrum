Indicateur de connexion temps réel : hors ligne, reconnexion (loader tréma), reconnecté, et verrou « quelqu'un édite ».

## Quand l'utiliser
- Topbar de toute session Reverb, à côté de la `PresenceStack`. Invisible quand tout va bien (sauf « Reconnecté » 3 s).
- Bannière pleine largeur si la coupure dure plus de 30 s ; voile sur le board pendant la resynchronisation.

## Anatomie
Pastille `sk-conn` (icône ou tréma + texte court) · variante `is-lost` (destructive doux), défaut = reconnexion (warning doux), `is-ok` (succès doux) · pastille « édite » : avatar de l'éditeur + texte + tréma à sa couleur · bannière `role="alert"` avec « Réessayer ».

## Props
```ts
type ConnectionStatus = "connected" | "connecting" | "reconnecting" | "offline" | "resynced";

interface ConnectionStateProps {
  status: ConnectionStatus;
  attempt?: number;                 // 2
  maxAttempts?: number;             // 5
  pendingChanges?: number;          // modifs en file d'attente locale
  variant?: "pill" | "banner" | "overlay";
  onRetry?: () => void;
}

interface EditingIndicatorProps {
  user: { name: string; initials: string; presence: number };
  target: "card" | "group" | "column";
}
```

## États
connexion perdue (après 5 s sans heartbeat) · reconnexion n/5 (tréma animé) · reconnecté (3 s puis disparaît) · quelqu'un édite · bannière déconnexion prolongée · board en lecture seule pendant la resynchronisation.

## Accessibilité & clavier
- Pastille `role="status"` `aria-live="polite"` ; la bannière `role="alert"` (une seule fois).
- « Réessayer » focusable ; pas de piège de focus sur le voile, le board reste lisible.
- Le tréma n'est jamais seul : texte toujours présent. `prefers-reduced-motion` fige les points.

## Temps réel
- Écoute `Echo.connector.pusher.connection.bind("state_change", …)` : `connecting` → reconnexion, `unavailable`/`failed` → hors ligne, `connected` → reconnecté.
- Backoff 1 s → 2 s → 4 s → 8 s → 16 s, puis bannière + bouton.
- Au retour : rejoue la file locale (mutations Inertia/axios idempotentes par `clientMutationId`), puis `router.reload({ only: ["board"] })` pour resynchroniser.
- « Quelqu'un édite » : whisper `client-card.editing`, expiré à 5 s.

## À faire / À éviter
- Faire : rassurer (« Tes cartes sont gardées localement »).
- Éviter : bloquer l'écran avec une modale ; afficher un spinner générique au lieu du tréma.

## Tokens
`--skrum-warning-soft` `--skrum-warning-text` `--skrum-destructive-soft` `--skrum-destructive-text` `--skrum-success-soft` `--skrum-success-text` `--skrum-presence-*` `--card` `--border` `--background` `--foreground` `--radius-full` `--radius` `--radius-xl` `--shadow-card` `--space-3` `--space-4`

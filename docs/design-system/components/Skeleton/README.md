Silhouette de chargement qui reproduit la mise en page à venir (board de rétro, liste de sessions) pour éviter les sauts.

**Quand l'utiliser**
- Chargement initial > 300 ms d'une page ou d'une zone dont la structure est connue.
- Connexion à une session live : skeleton du board + `sk-trema` « Connexion à la session… ».
- Action courte (< 300 ms) → rien ; action utilisateur → spinner dans le bouton.

**Anatomie**
Blocs `sk-skel` (`--muted`, `--radius-sm`, pulsation 1,6 s) calqués sur le contenu réel : colonnes (pastille + titre), cartes (2–3 lignes de largeurs variées, avatar xs + nom), bouton d'ajout ; liste : icône 32, deux lignes, badge pilule. Sur une surface déjà `--muted`, les blocs sont renforcés (mélange 9 % `--foreground`).

**Props**
```ts
interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> { className?: string }
interface BoardSkeletonProps { columns?: number /* 3 */; cardsPerColumn?: number[] /* [3,2,1] */; status?: string }
interface ListSkeletonProps { rows?: number /* 5 */; withAvatar?: boolean; withBadge?: boolean }
```

**États**
Pulsation ; `prefers-reduced-motion` : statique (opacité fixe). Jamais d'état d'erreur dans un skeleton → remplacer par `Alert` + « Réessayer ».

**Accessibilité & clavier**
- Conteneur `aria-busy="true"` + `aria-label` (« Chargement du board ») ; blocs `aria-hidden`.
- Un seul message d'état lisible (`role="status"`) ; le focus n'entre pas dans le skeleton.

**Temps réel**
Au premier snapshot du serveur, remplacer d'un coup (fondu `--duration-base`) — pas carte par carte. Au-delà de 8 s, afficher l'état de connexion (`sk-conn`).

**À faire / À éviter**
- Faire : mêmes dimensions que le contenu final ; nombre d'éléments réaliste.
- Éviter : skeleton de texte sur 100 % de la largeur ; shimmer coloré ; skeleton pour une recherche instantanée.

**Tokens**
`--muted` `--foreground` `--card` `--border` `--skrum-canvas` `--skrum-primary-text` `--radius-sm` `--radius` `--radius-xl` `--duration-base` `--ease-standard`

**Mapping shadcn**
- `@/components/ui/skeleton` (`animate-pulse rounded-sm bg-muted`), composé dans `BoardSkeleton` / `ListSkeleton` applicatifs.
- Lignes : `h-2.5 rounded-full w-7/10` ; avatar `size-5 rounded-full` ; badge `h-5.5 w-16 rounded-full` ; sur colonne : `bg-[color-mix(in_oklch,var(--foreground)_9%,var(--muted))]`.
- `motion-reduce:animate-none` sur chaque bloc.

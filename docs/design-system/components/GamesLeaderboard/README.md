Page Jeux d'une équipe : rooms d'icebreaker (actives, en attente, terminées) et classement des joueurs sur 30 jours ou depuis toujours.

## Quand l'utiliser
- Page `/teams/{team}/games`, ouverte depuis le bouton « Games » de la page équipe.
- Pas pour le jeu lui-même (→ `ScreenIcebreaker`) ni pour choisir un jeu (→ `IcebreakerGameCard`).

## Anatomie
- **En-tête** : titre « Games » (`sk-h3`), sous-titre « Short games to warm up Atlas », actions « Back to the team » (`outline`, `arrow-left`) et « New room » (primaire, `plus`) ; les actions passent sous le titre quand la place manque.
- **Rooms** (`sk-card`) : compteur « 2 live » · liste de rooms cliquables : tuile de jeu 2.5rem colorée `sk-c-*` + icône du jeu (Pendu `whole-word`/sun, Devine l'emoji `smile`/lagoon, Dessin à deviner `brush`/plum, Deux vérités un mensonge `message-circle`/sky) · nom de la room · jeu · contexte (« started 4 min ago », « needs 1 more player ») · pile d'avatars xs + « n players » · badge de statut · chevron. Survol : `--shadow-raised` + bord teinté `--primary`.
- **Classement** (`sk-card`) : toggle `sk-tabs` « Last 30 days / All time » · podium top 3 (2ᵉ – 1ᵉʳ – 3ᵉ, marches de 3.5 / 5 / 2.5rem ; 1ᵉʳ en `--skrum-primary-soft` avec couronne `--skrum-warning`) · liste à partir du 4ᵉ : rang, avatar, prénom, « n games · n wins », points ; ligne de l'utilisateur courant en `--accent`.
- **États vides** : `sk-empty` avec pastille d'icône `--muted` — Rooms : « No game rooms yet. » + « New room » (outline) ; Classement : « No games played yet. » (toggle conservé).

## Props
```ts
type GameKind = "hangman" | "emoji" | "draw" | "two-truths" | "mood" | "who" | "quick-question";
type RoomStatus = "live" | "waiting" | "finished";

interface GameRoom {
  id: string;
  name: string;
  game: GameKind;
  status: RoomStatus;
  players: { id: string; name: string; initials: string; presence: number }[];
  minPlayers: number;
  startedAt?: string;          // ISO
  finishedAt?: string;
}

interface LeaderboardEntry {
  userId: string;
  name: string;
  initials: string;
  presence: number;
  points: number;
  gamesPlayed: number;
  wins: number;
  isMe?: boolean;
}

interface GamesPageProps {
  team: { id: string; name: string };
  rooms: GameRoom[];
  leaderboard: { period: "30d" | "all"; entries: LeaderboardEntry[] };
  onPeriodChange: (p: "30d" | "all") => void;   // partial reload Inertia `only: ["leaderboard"]`
  canCreateRoom: boolean;
}
```

## États
Rooms : live (badge success + point) · en attente de joueurs (badge warning + `clock`, contexte « needs n more player(s) ») · terminée (badge muted, ouvre les résultats) · survol / focus · vide. Classement : 30 jours · depuis toujours · moi dans la liste · moi sur le podium (anneau `--ring` autour de l'avatar) · moins de 3 joueurs (podium partiel, marches vides en pointillés) · vide.

## Accessibilité & clavier
- Chaque room = un seul lien englobant (`aria-label` = nom, jeu, statut, nombre de joueurs) ; pas de bouton imbriqué.
- Toggle de période : `role="tablist"` (Radix Tabs), flèches gauche/droite ; le contenu est un `tabpanel` avec `aria-busy` pendant le rechargement.
- Podium : rendu dans l'ordre DOM 1 → 2 → 3 (ordre visuel 2-1-3 par `order` CSS) et `<ol>` pour la liste, afin que le lecteur d'écran lise le rang réel.
- Statuts : texte + couleur ; points en `tabular-nums` ; libellés de boutons et d'onglets sur une ligne (`whitespace-nowrap`).
- Pluriels gérés par l'i18n (`1 win` / `2 wins`, `1 victoire` / `2 victoires`, `0 victoire`).

## Temps réel
- Canal `private-team.{id}.games` : `GameRoomCreated`, `GameRoomUpdated` (joueurs, statut), `GameRoomFinished` → la liste se met à jour sans rechargement ; la room passe en « Finished » et le classement est rechargé (`router.reload({ only: ["leaderboard"] })`).
- Les points sont calculés côté serveur à la fin de partie ; le client n'additionne jamais.

## À faire / À éviter
- Faire : trier les rooms live → en attente → terminées (7 derniers jours max).
- Faire : garder « New room » visible dans l'en-tête même quand la liste est vide (et le répéter dans l'état vide).
- Éviter : afficher un classement « All time » à une équipe sans partie ; éviter les médailles colorées criardes ou les dégradés sur le podium.

## Tokens
`--card` `--border` `--foreground` `--muted` `--muted-foreground` `--accent` `--primary` `--primary-foreground` `--ring` `--skrum-primary-soft` `--skrum-primary-text` `--skrum-success-soft` `--skrum-success-text` `--skrum-warning` `--skrum-warning-soft` `--skrum-warning-text` `--skrum-col-*` (`--c` `--c-b` `--c-t`) `--skrum-presence-*` `--shadow-card` `--shadow-raised` `--radius` `--radius-md` `--radius-xl` `--space-2` `--space-3` `--space-4` `--space-5` `--space-8` `--font-display` `--duration-fast` `--ease-standard`

## Mapping shadcn
- En-tête : `flex flex-wrap items-end justify-between gap-3` ; `@/components/ui/button` (`variant="outline"` + `variant="default"`).
- Cards : `@/components/ui/card` ; Badge `@/components/ui/badge` (`bg-skrum-success-soft text-skrum-success-text rounded-full`, idem warning / muted).
- Room : `<Link className="flex items-center gap-3 rounded-lg border bg-card p-3 transition-shadow hover:shadow-raised hover:border-primary/35 focus-visible:ring-2 focus-visible:ring-ring">` ; tuile `size-10 rounded-md border col-sun bg-(--col) text-(--col-text) border-(--col-border)`.
- Avatars : `@/components/ui/avatar` `size-5` en pile `-space-x-1`.
- Toggle : `@/components/ui/tabs` (`TabsList` / `TabsTrigger`, `whitespace-nowrap`).
- Podium : `grid grid-cols-3 items-end gap-2` ; marches `h-14` / `h-20` / `h-10 rounded-t-md bg-muted` (1ᵉʳ `bg-skrum-primary-soft text-skrum-primary-text`) ; avatar `size-10`.
- Vide : composant `EmptyState` (`sk-empty`).

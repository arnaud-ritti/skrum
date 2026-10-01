Carte de rétrospective (post-it) : le contenu écrit par un participant, colorée par sa colonne, avec auteur, réactions et votes.

## Quand l'utiliser
- Dans une `RetroColumn` ou un `CardGroup`, pendant toutes les phases de la rétro.
- Pas pour le whiteboard libre (utiliser `sk-sticky`) ni pour les actions (utiliser `ActionItem`).

## Anatomie
Surface colorée (`--c` / `--c-b` hérités de la colonne) · texte (`--foreground`, 280 caractères max) · réactions emoji (optionnel) · pied : auteur (avatar xs + prénom) **ou** badge « Anonyme », `VoteDots` (mes votes) et bouton de vote · étiquette de verrou quand un autre participant l'édite.

## Props
```ts
type ColumnColor = "sun" | "apricot" | "coral" | "plum" | "iris" | "sky" | "lagoon" | "moss";

interface RetroCardProps {
  id: string;
  text: string;
  color: ColumnColor;
  author?: { id: string; name: string; initials: string; presence: 1|2|3|4|5|6|7|8|9|10|11|12 } | null; // null = anonyme
  masked?: boolean;                 // phase Écriture : texte flouté pour les autres
  reactions?: { emoji: string; count: number; mine: boolean }[];
  votes?: { total: number | null; mine: number }; // total null = votes masqués
  lockedBy?: { name: string; presence: number } | null; // quelqu'un édite
  editing?: boolean;                // j'édite (textarea inline)
  selected?: boolean;               // sélection multiple (regroupement)
  focused?: boolean;                // focus facilitateur
  dragging?: boolean;
  ghost?: boolean;                  // emplacement d'origine pendant un drag
  canVote?: boolean;
  onVote?: (delta: 1 | -1) => void;
  onReact?: (emoji: string) => void;
  onEdit?: (text: string) => void;
  onDelete?: () => void;
}
```

## États
défaut · anonyme · masquée (phase Écriture, bandes hachurées `--c-t` à 22 %, mention « Masquée jusqu'à la révélation ») · réactions + mes votes · éditée par quelqu'un d'autre (anneau et étiquette à la couleur de présence de l'éditeur, loader tréma) · en édition (moi : fond `--card`, anneau `--ring`, compteur 28/280) · sélectionnée · focus facilitateur (anneau `--skrum-info`) · en drag (rotation −2°, `--shadow-drag`, `--z-drag`) + fantôme en pointillés.

## Accessibilité & clavier
- `<article>` focusable (`tabIndex=0`), `aria-label` = texte + auteur + nombre de votes ; masquée : « Carte masquée jusqu'à la révélation ».
- <kbd>Entrée</kbd> éditer (si c'est la mienne) · <kbd>⌘/Ctrl</kbd>+<kbd>Entrée</kbd> publier · <kbd>Échap</kbd> annuler · <kbd>V</kbd> voter / <kbd>Maj</kbd>+<kbd>V</kbd> retirer un vote · <kbd>Suppr</kbd> supprimer (confirmation).
- Drag & drop clavier via dnd-kit : <kbd>Espace</kbd> saisir, flèches déplacer, <kbd>Espace</kbd> déposer, annonces `aria-live`.
- La couleur de colonne n'est jamais la seule information : le titre de colonne est annoncé.

## Temps réel
- Canal `presence-retro.{sessionId}` (Laravel Reverb, `Echo.join`).
- Événements serveur : `CardCreated`, `CardUpdated`, `CardMoved`, `CardDeleted`, `CardRevealed` (masquage levé pour tous), `ReactionToggled`.
- Verrou d'édition : whisper `client-card.editing` `{cardId, userId}` émis au focus puis toutes les 3 s ; expiré après 5 s sans signal. L'édition locale est bloquée tant qu'un verrou d'un autre est actif.
- Pendant la phase Écriture, le serveur n'envoie aux autres que `{id, color, authorId?}` : le texte ne quitte pas le serveur avant la révélation.
- Mise à jour optimiste, réconciliée par `CardUpdated` (le `version` serveur gagne).

## À faire / À éviter
- Faire : garder le texte en `--foreground` quelle que soit la couleur.
- Faire : afficher « Anonyme » explicitement, jamais un avatar vide.
- Éviter : bordure gauche colorée, dégradés, texte coloré `--c-t` pour le contenu.
- Éviter : révéler le total des votes pendant la phase Vote si le facilitateur les a masqués.

## Tokens
`--skrum-col-*` / `-border` / `-text` (via `sk-c-*` → `--c` `--c-b` `--c-t`) `--card` `--foreground` `--muted-foreground` `--border` `--ring` `--primary` `--skrum-primary-soft` `--skrum-primary-text` `--skrum-info` `--skrum-presence-*` `--radius` `--shadow-card` `--shadow-raised` `--shadow-drag` `--z-drag` `--duration-fast` `--duration-base` `--ease-standard` `--space-3`

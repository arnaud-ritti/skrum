Points de vote : budget de votes restant, votes posés sur une carte et bouton de vote, avec animation « pop ».

## Quand l'utiliser
- Phase Vote d'une rétro (dot voting), sur `RetroCard` et `CardGroup`, et dans l'en-tête du board pour le budget.
- Pas pour le ROTI ni le poker (composants dédiés).

## Anatomie
- **Budget** (`sk-vote-budget`) : icône, « N votes restants », 1 point par vote du budget — plein = disponible, vide = utilisé.
- **Sur une carte** : mes votes en points pleins (`sk-votes`), bouton « − » pour retirer, bouton de vote (pouce + total).
- **Total masqué** : pastille pointillée « Total masqué » quand le facilitateur cache les votes jusqu'à la révélation.

## Props
```ts
interface VoteBudgetProps {
  total: number;                    // ex. 5
  remaining: number;
}

interface CardVotesProps {
  mine: number;                     // mes votes sur cette carte
  total: number | null;             // null = masqué jusqu'à la révélation
  maxPerCard?: number;              // ex. 3
  budgetLeft: number;
  onVote: () => void;
  onUnvote: () => void;
}
```

## États
budget 5/5 · budget 2/5 · plus de votes (icône barrée, points vides) · votes sur une carte (bouton `is-mine` terracotta doux) · plus de votes disponibles (bouton `aria-disabled` + tooltip « Vous avez utilisé vos 5 votes ») · animation pop à l'ajout (`sk-pop`, 0,4 → 1,25 → 1 sur `--duration-base` / `--ease-spring`) · total masqué.

## Accessibilité & clavier
- Bouton de vote : `aria-label="Voter, 6 votes"` ; `aria-pressed` quand j'ai au moins un vote.
- <kbd>V</kbd> vote, <kbd>Maj</kbd>+<kbd>V</kbd> retire, sur la carte focalisée.
- Budget : `role="status"` + `aria-live="polite"` (« 2 votes restants »).
- Désactivé : `aria-disabled` (pas `disabled`) pour garder le tooltip accessible au focus.
- `prefers-reduced-motion` : pas de pop, changement d'état instantané.

## Temps réel
- `VoteCast` / `VoteRetracted` sur `private-retro.{sessionId}.votes` ; le payload contient le total seulement si `votesVisible` est vrai.
- Mes votes et mon budget viennent de `private-user.{userId}` (jamais diffusés aux autres).
- `VotesRevealed` : tous les totaux arrivent d'un coup, le tri par votes se déclenche avec `sk-enter`.
- Optimiste : décrément du budget immédiat, rollback + toast si le serveur refuse (budget dépassé).

## À faire / À éviter
- Faire : afficher le budget en permanence pendant la phase Vote.
- Éviter : montrer le total quand les votes sont masqués, même à l'auteur de la carte.
- Éviter : colorer les points autrement qu'en `--primary`.

## Tokens
`--primary` `--skrum-primary-soft` `--skrum-primary-text` `--card` `--border` `--input` `--foreground` `--muted-foreground` `--shadow-card` `--radius-full` `--duration-base` `--ease-spring` `--space-2`

État vide illustré, un par module (Rétro, Poker, Whiteboard, Sondages, Icebreakers, Actions) : illustration géométrique, titre, phrase, action.

## Quand l'utiliser
- Première visite d'un module ou liste vide après filtre (dans ce cas, variante sans illustration + « Effacer les filtres »).
- Pas pour les erreurs (utiliser `Alert`) ni le chargement (squelettes `sk-skel`).

## Anatomie
`sk-empty` centré · illustration SVG 120×88 (`sk-empty-art`) : formes de post-it (coins arrondis, coin replié), cartes, cases, et les deux points tréma `--primary` — **aucun personnage** · sur-titre du module · titre (`sk-empty-t`) · description (`sk-empty-d`, 2 lignes max) · 1 action principale (+ 1 secondaire max).

## Props
```ts
type Module = "retro" | "poker" | "whiteboard" | "survey" | "icebreaker" | "actions";

interface EmptyStateProps {
  module: Module;
  title: string;
  description: string;
  illustration?: boolean;           // false pour une liste filtrée vide
  action?: { label: string; icon?: string; onClick?: () => void; href?: string; variant?: "default" | "outline" | "ghost" };
  secondaryAction?: { label: string; onClick?: () => void; href?: string };
}
```

## Contenus par module
Rétro « Aucune rétro pour l'instant » → Nouvelle rétro · Poker « Aucune story à estimer » → Importer / Ajouter une story · Whiteboard « Une toile vierge » (astuce <kbd>N</kbd>) → Choisir un modèle · Sondages « Aucun sondage publié » → Créer un sondage · Icebreakers « Pas encore de partie » → Choisir un jeu · Actions « Aucune action ouverte » (état positif) → Voir les actions terminées.

## États
premier usage (illustration + CTA) · liste filtrée vide (sans illustration) · état positif (Actions à jour : action `ghost`).

## Accessibilité & clavier
- Illustration `aria-hidden="true"` ; le titre est un vrai titre (`h2`/`h3` selon la page).
- L'action principale reçoit le focus si l'état vide est tout le contenu de la page.

## Temps réel
- Si un autre membre crée un élément (`RetroCreated`, `SurveyPublished`…), l'état vide est remplacé par la liste sans rechargement.

## À faire / À éviter
- Faire : des formes Skrüm (post-its, cartes, points tréma) colorées uniquement via tokens ; ton chaleureux, concret.
- Éviter : personnages, mascottes, visages ; dégradés ; plus d'une action principale.

## Tokens
`--skrum-col-*` + `-border` + `-text` `--primary` `--primary-foreground` `--card` `--border` `--input` `--muted` `--muted-foreground` `--foreground` `--skrum-canvas-dot` `--skrum-success` `--skrum-success-foreground` `--radius-xl` `--shadow-card` `--space-3` `--space-6` `--space-8`

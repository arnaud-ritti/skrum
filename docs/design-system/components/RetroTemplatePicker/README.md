Choix du format de rétrospective : onglets Intégrés / Mon espace / Récents, recherche, cartes de modèle à bande de couleurs et aperçu détaillé (mini-board) du modèle sélectionné.

## Quand l'utiliser
- Dialog « Nouvelle session » › Rétro › « Tous les modèles » (le dialog n'affiche que 5 raccourcis `ss-tpl`, ce composant est la vue complète).
- Page Modèles du workspace (lecture + « Dupliquer et modifier » → `TemplateEditor`).
- Pas pour les decks de poker (`DeckPicker`).

## Anatomie
Barre : `Tabs` (libellé + compteur) · recherche (`search`, raccourci <kbd>/</kbd>, bouton effacer) — passe sous les onglets en étroit.
Grille `RadioGroup` de cartes `ss-tpl` : bande `ss-strip` (une pastille par colonne, `--c-b`) · nom (ellipsis) · « n colonnes » · description (2 lignes) · badges : « Par défaut » (`star`, soft), « Utilisé 6× » (`history`, muted), « Espace Nordlys » (`building-2`, info). Dernière carte « Partir de zéro » en pointillés.
Panneau détail `rtp-detail` : nom + badges · description · mini-board `ss-mini` / `ss-mcol` (pastille, nom, question d'aide, cartes fantômes) · réglages par défaut (votes, anonymat, timer) · « Utiliser ce modèle » + « Dupliquer et modifier ».
Mise en page par conteneur : grille + détail côte à côte dès 48rem, empilés en dessous ; mini-board sur une ligne, 2 × 2 (4 colonnes) ou 3 + 2 (5) sous 28rem de panneau.

Modèles intégrés : Start · Stop · Continue (moss, coral, sky) · Glad · Sad · Mad (sun, sky, coral) · 4L — Liked, Learned, Lacked, Longed for (moss, iris, apricot, plum) · Voilier — Vent, Ancre, Rochers, Île (lagoon, apricot, coral, moss) · Starfish — Continuer, Plus de, Moins de, Arrêter, Commencer (moss, lagoon, apricot, coral, sky) · KALM — Keep, Add, Less, More · DAKI — Drop, Add, Keep, Improve · Partir de zéro.

## Props
```ts
type ColumnColor = "sun" | "apricot" | "coral" | "plum" | "iris" | "sky" | "lagoon" | "moss";
type TemplateSource = "builtin" | "workspace" | "recent";

interface RetroTemplate {
  id: string;
  name: string;
  description: string;
  source: TemplateSource;
  columns: { id: string; title: string; color: ColumnColor; help?: string }[];
  defaults: { votesPerPerson: number; maxPerCard: number; anonymous: boolean; timers: Partial<Record<"writing" | "voting" | "discussing", number>> };
  isTeamDefault?: boolean;            // badge « Par défaut »
  usageCount?: number;                // badge « Utilisé n× » (équipe courante)
  workspaceName?: string;             // badge « Espace Nordlys »
}

interface RetroTemplatePickerProps {
  value: string | "blank";
  onValueChange: (id: string | "blank") => void;
  templates: RetroTemplate[];
  tab?: TemplateSource;                // contrôlé, défaut "builtin"
  onTabChange?: (t: TemplateSource) => void;
  query?: string;
  onQueryChange?: (q: string) => void;
  loading?: boolean;                   // squelettes + aria-busy
  onUse: (id: string | "blank") => void;
  onDuplicate?: (id: string) => void;  // ouvre TemplateEditor
}
```

## États
défaut · carte au survol (`--accent`) · carte focus (anneau `--ring`) · carte sélectionnée (bordure + anneau `--primary`, fond `--skrum-primary-soft`, coche) · onglet Mon espace (badges espace + usage) · recherche sans résultat (`EmptyState` : `search-x`, « Aucun modèle ne correspond à « … » », Effacer la recherche / Partir de zéro) · chargement (`Skeleton` pour bande, titre, méta, description ; détail en squelette) · onglet vide « Mon espace » : `EmptyState` « Aucun modèle d'espace pour l'instant. » + Créer un modèle.

## Accessibilité & clavier
- `Tabs` : <kbd>←</kbd>/<kbd>→</kbd> entre onglets, compteur inclus dans le nom (« Intégrés, 7 »).
- Recherche : <kbd>/</kbd> donne le focus, <kbd>Échap</kbd> efface ; le nombre de résultats est annoncé (`role="status"`, debounce 300 ms).
- Grille : `role="radiogroup"`, tabindex itinérant, flèches dans les 2 dimensions, <kbd>Entrée</kbd> = « Utiliser ce modèle ». Le panneau détail est `aria-live="polite"` sur le nom seulement.
- Chargement : `aria-busy="true"` sur la zone + texte `sk-sr` « Chargement des modèles… ».
- Couleurs doublées par les noms de colonnes dans le détail ; la bande est `aria-hidden`.

## À faire / À éviter
- Faire : garder « Partir de zéro » toujours en dernière position, même filtré.
- Faire : présélectionner le modèle « Par défaut » de l'équipe, sinon le dernier utilisé.
- Éviter : ouvrir l'éditeur au clic simple — l'édition passe par « Dupliquer et modifier » (les intégrés sont en lecture seule).
- Éviter : plus de 2 lignes de description par carte.

## Mapping shadcn / Tailwind
- `@/components/ui/tabs` (`TabsList`, `TabsTrigger` `whitespace-nowrap`, compteur `text-overline tabular-nums text-muted-foreground`), `@/components/ui/input` dans `relative` + icône `Search` `absolute left-2.5`, `@/components/ui/radio-group`, `@/components/ui/badge`, `@/components/ui/button`, `@/components/ui/skeleton`.
- Racine `@container/picker` ; corps `grid gap-4 @3xl/picker:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]` ; grille `grid grid-cols-[repeat(auto-fill,minmax(min(100%,--spacing(44)),1fr))] gap-2`.
- Carte : `relative flex flex-col gap-1.5 rounded-lg border border-input bg-card px-3 pt-2 pb-3 text-left hover:bg-accent data-[state=checked]:border-primary data-[state=checked]:bg-skrum-primary-soft data-[state=checked]:ring-1 data-[state=checked]:ring-inset data-[state=checked]:ring-primary`.
- Bande : `flex h-1.5 gap-0.5` > `flex-1 rounded-full bg-skrum-col-moss-border` … ; nom `truncate text-sm font-title` ; description `line-clamp-2 text-xs text-muted-foreground`.
- Détail : `@container/detail flex flex-col gap-3 rounded-lg border bg-muted/55 p-4` ; mini-board `grid grid-flow-col auto-cols-fr gap-2 rounded-lg border bg-skrum-canvas p-2 @max-md/detail:grid-flow-row @max-md/detail:grid-cols-2`.
- Icônes : `Search`, `SearchX`, `X`, `Star`, `History`, `Building2`, `CircleCheck`, `Plus`, `ArrowRight`, `Copy`, `Vote`, `VenetianMask`, `Timer`.

## Tokens
`--skrum-col-*` / `-border` / `-text` (via `sk-c-*`) `--skrum-canvas` `--card` `--muted` `--muted-foreground` `--foreground` `--accent` `--input` `--border` `--primary` `--skrum-primary-soft` `--skrum-primary-text` `--skrum-info-soft` `--skrum-info-text` `--ring` `--radius` `--radius-md` `--radius-sm` `--radius-xs` `--space-1` `--space-2` `--space-3` `--space-4` `--space-5` `--shadow-card` `--duration-fast` `--ease-standard`

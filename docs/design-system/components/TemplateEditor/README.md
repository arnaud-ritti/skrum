Éditeur de modèle de rétrospective : nom, description, visibilité, colonnes réordonnables avec `ColumnColorPicker` intégré, réglages par défaut liés et aperçu live du board.

## Quand l'utiliser
- Page Modèles (« Nouveau modèle », « Modifier »), « Dupliquer et modifier » depuis `RetroTemplatePicker`, « Enregistrer comme modèle d'équipe » en fin de création de session.
- En `Sheet` large (desktop) ou plein écran (mobile) ; les decks de poker utilisent `DeckPicker`.

## Anatomie
En-tête : titre, « Rétro · modifié par Inès il y a 2 jours », badge de visibilité.
Colonne principale : Nom · Description · Visibilité (radio segmentée Personnel / Équipe / Espace + aide) · Colonnes `n/8` : liste ordonnée de lignes `ss-colrow` — poignée `grip-vertical`, bouton couleur `ss-swbtn` (ouvre `ColumnColorPicker`), titre, supprimer (`trash-2`), question d'aide (facultative), message d'erreur · « Ajouter une colonne » + compteur restant.
Colonne latérale : Aperçu en direct (`ss-mini`, titre vide = « Sans titre » en italique muted) · Réglages par défaut (`ss-opt` : votes par personne et max par carte en stepper, cartes anonymes en switch, timer par phase en select).
Pied : « Supprimer le modèle » (ghost destructive, icône + libellé) à gauche · résumé d'erreurs · Dupliquer · Annuler · **Enregistrer**.
Deux colonnes dès 48rem de conteneur, empilées sinon.

### ColumnColorPicker (sous-composant)
Popover ancré au bouton couleur : titre « Couleur de « Idées » », 8 options `ss-cpick-opt` (pastille `ss-sw` + nom visible : Soleil, Abricot, Corail, Prune, Iris, Ciel, Lagon, Mousse), 4 × 2 sous 24rem, 8 × 1 au-delà. Couleur sélectionnée cerclée `--ring` ; couleur déjà prise par une autre colonne marquée d'un point `--foreground` (légende sous la grille) — reste choisissable, les deux colonnes échangent alors leurs couleurs.

## Props
```ts
type ColumnColor = "sun" | "apricot" | "coral" | "plum" | "iris" | "sky" | "lagoon" | "moss";
type Visibility = "personal" | "team" | "workspace";

interface TemplateColumnDraft { id: string; title: string; help?: string; color: ColumnColor }

interface TemplateDraft {
  name: string;
  description?: string;
  visibility: Visibility;
  columns: TemplateColumnDraft[];          // 1 à 8
  defaults: { votesPerPerson: number; maxPerCard: number; anonymous: boolean; timers: Partial<Record<"writing" | "voting" | "discussing", number>> };
}

interface TemplateEditorProps {
  mode: "create" | "edit";
  value: TemplateDraft;
  onChange: (d: TemplateDraft) => void;
  errors?: Partial<Record<"name" | `columns.${number}.title`, string>>;
  canShareWorkspace?: boolean;             // false ⇒ « Espace » désactivé
  meta?: { editedBy: string; editedAt: string; usedByTeams?: number };
  saving?: boolean;
  onSave: () => void;
  onCancel: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;                   // ouvre un AlertDialog
}

interface ColumnColorPickerProps {
  value: ColumnColor;
  onValueChange: (c: ColumnColor) => void;
  usedBy?: Partial<Record<ColumnColor, string>>;   // couleur → titre de la colonne qui l'utilise
  columnTitle: string;                              // pour le libellé « Couleur de « … » »
}
```

## États
défaut · titre de colonne vide (bordure `--destructive`, « Donne un titre à cette colonne. ») · doublon (comparaison insensible à la casse et aux espaces, « Une autre colonne s'appelle déjà « Stop ». ») · sélecteur de couleur ouvert (bouton cerclé `--ring`) · couleur utilisée ailleurs (point) · glisser (ligne inclinée −1°, `--shadow-drag`, `--z-drag`, emplacement cible en pointillés `--ring`) · 8 colonnes atteintes (« Ajouter une colonne » désactivé + aide) · enregistrement (bouton avec `sk-spinner`) · erreurs (résumé « 2 champs à corriger » dans le pied, Enregistrer reste actif et amène le focus à la première erreur).

## Accessibilité & clavier
- `<form aria-labelledby>` ; Visibilité en `radiogroup` (flèches).
- Liste `<ol>` ; poignée = `button` dnd-kit `aria-roledescription="sortable"` : <kbd>Espace</kbd> saisir, <kbd>↑</kbd>/<kbd>↓</kbd> déplacer, <kbd>Espace</kbd> déposer, <kbd>Échap</kbd> annuler ; annonces `aria-live` (« Stop déplacée en position 1 sur 3 »).
- Champs en erreur : `aria-invalid` + `aria-describedby` vers le message ; à l'envoi, focus sur le premier champ invalide.
- ColumnColorPicker : `Popover` focus piégé, `radiogroup` (flèches, <kbd>Entrée</kbd> valide et ferme, <kbd>Échap</kbd> rend le focus au bouton) ; nom accessible « Mousse, utilisée par Bravo ». Le bouton couleur annonce « Couleur : Ciel ».
- Supprimer une colonne : <kbd>Suppr</kbd> sur la ligne focalisée, annulable par toast (5 s) ; supprimer le modèle : `AlertDialog`.

## Temps réel
Pas d'édition concurrente : `version` envoyée à l'enregistrement ; si un autre membre a enregistré entre-temps, alerte « Modifié par Théo il y a 1 min » avec Recharger / Écraser. Les rétros déjà créées ne sont pas affectées.

## À faire / À éviter
- Faire : proposer d'emblée une couleur libre pour chaque nouvelle colonne.
- Faire : garder l'aperçu identique à `RetroColumn` (titre en `--foreground`, pastille).
- Éviter : bloquer Enregistrer sans dire pourquoi ; supprimer sans confirmation.
- Éviter : bouton destructif sans libellé (icône seule) dans le pied.

## Mapping shadcn / Tailwind
- `@/components/ui/input`, `textarea`, `toggle-group` (visibilité, `type="single"` `grid grid-cols-3 gap-0.5 rounded-lg bg-muted p-0.75`), `popover` (ColumnColorPicker), `radio-group`, `switch`, `select`, `button`, `badge`, `alert-dialog`, `sonner` ; dnd-kit `@dnd-kit/sortable`.
- Racine `@container/editor` ; corps `grid gap-5 p-5 @3xl/editor:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]`.
- Ligne : `grid grid-cols-[auto_auto_minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1.5 rounded-lg border bg-card p-2 aria-invalid:border-destructive` ; aide `col-span-2 col-start-3 h-7 text-xs` ; poignée `h-8 w-6 cursor-grab text-muted-foreground` ; drag `rotate-[-1deg] shadow-drag z-50 border-ring` (rotation = non-taille, tolérée) ; cible `h-11 rounded-lg border-2 border-dashed border-ring bg-primary/8`.
- Bouton couleur `size-8 rounded-md border border-input` > pastille `size-4.5 rounded-full bg-skrum-col-sky-border ring-1 ring-inset ring-skrum-col-sky-text`.
- Picker : `@container/cpick` ; `grid grid-cols-4 gap-1 @sm/cpick:grid-cols-8` ; option `flex flex-col items-center gap-1 rounded-sm text-overline data-[state=checked]:text-foreground` ; sélection `ring-2 ring-ring ring-offset-2 ring-offset-popover`.
- Supprimer : `Button variant="ghost"` + `text-skrum-destructive-text hover:bg-skrum-destructive-soft` avec `Trash2`.

## Tokens
`--skrum-col-*` / `-border` / `-text` (via `sk-c-*`) `--skrum-canvas` `--card` `--popover` `--muted` `--muted-foreground` `--foreground` `--input` `--border` `--ring` `--primary` `--destructive` `--skrum-destructive-text` `--skrum-destructive-soft` `--skrum-info-soft` `--skrum-info-text` `--shadow-card` `--shadow-popover` `--shadow-drag` `--z-drag` `--radius` `--radius-md` `--radius-sm` `--space-1` `--space-1-5` `--space-2` `--space-3` `--space-4` `--space-5`

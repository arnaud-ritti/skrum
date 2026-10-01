Choix et édition d'un deck de planning poker : decks intégrés, decks enregistrés de l'équipe, « Créer un deck », et éditeur de deck personnalisé avec aperçu en PokerCard.

## Quand l'utiliser
- Dialog « Nouvelle session » › Poker (section Deck), page « Saved decks » de l'équipe, réglages d'une partie en cours (changement de deck avant le premier vote).
- L'éditeur s'ouvre depuis « Créer un deck » ou « Modifier » d'un deck enregistré (les intégrés se dupliquent).

## Anatomie
Sélecteur : `RadioGroup` de cartes `ss-tpl` — nom, « n cartes », aperçu des valeurs `ss-val` (7 premières + « +n », spéciales `?` ☕ en `muted`), badge « Intégré » (outline) ou « Enregistré » (`bookmark`) + auteur ; carte pointillée « Créer un deck ». Sous la grille, le deck sélectionné en `PokerCard` `sk-pcard--sm` dans un `sk-deck`.
Éditeur : Nom · Valeurs (tag input `ss-chips` : chips `ss-chip` avec poignée, valeur en police display, bouton retirer ; chip en édition cerclé `--ring` ; champ d'ajout avec <kbd>↵</kbd>) · aide · Cartes spéciales (`?` « Je ne sais pas », ☕ « J'ai besoin d'une pause », switch) · Aperçu `sk-pcard--sm` sur canevas · pied Annuler / **Enregistrer le deck**. Deux colonnes dès 48rem de conteneur.

Decks intégrés : Fibonacci `0 1 2 3 5 8 13 21 34 55 89 ? ☕` (deck de l'app) · Fibonacci modifié `0 ½ 1 2 3 5 8 13 20 40 100 ? ☕` · T-shirt `XS S M L XL XXL ?` · Puissances de 2 `1 2 4 8 16 32 64 ?`.

## Props
```ts
interface Deck {
  id: string;
  name: string;
  values: string[];                  // dans l'ordre du jeu, 2 à 20, 4 caractères max chacune
  unknownCard: boolean;              // « ? »
  breakCard: boolean;                // « ☕ »
  source: "builtin" | "saved";
  createdBy?: { name: string };
}

interface DeckPickerProps {
  value: string;
  onValueChange: (id: string) => void;
  decks: Deck[];
  onCreate: () => void;              // ouvre DeckEditor (mode create)
  onEdit?: (id: string) => void;     // decks enregistrés seulement
}

interface DeckEditorProps {
  value: Omit<Deck, "id" | "source">;
  onChange: (d: Omit<Deck, "id" | "source">) => void;
  errors?: { name?: string; values?: string };   // « Ajoutez au moins 2 valeurs. », « Valeur en double : 8 »
  saving?: boolean;
  onSave: () => void;
  onCancel: () => void;
}
```

## États
carte défaut · survol (`--accent`) · sélectionnée (bordure + anneau `--primary`, fond soft, coche) · « Créer un deck » (pointillés) · chip en édition (double-clic ou <kbd>Entrée</kbd> sur la chip) · spéciale désactivée (switch off, retirée de l'aperçu) · validation : moins de 2 valeurs (bordure `--destructive`, message, Enregistrer désactivé), valeur en double (chip refusée, message), valeur trop longue (> 4 caractères) · enregistrement (spinner).

## Accessibilité & clavier
- Sélecteur : `radiogroup` à tabindex itinérant ; nom accessible « Fibonacci modifié, 13 cartes » ; l'aperçu `ss-vals` est `aria-hidden`, l'ensemble des valeurs est lu via le deck sous la grille.
- Tag input : `role="list"` ; <kbd>Entrée</kbd> ou <kbd>,</kbd> ajoute ; <kbd>Retour arrière</kbd> dans le champ vide sélectionne puis retire la dernière chip ; <kbd>←</kbd>/<kbd>→</kbd> naviguent entre chips ; <kbd>Alt</kbd>+<kbd>←</kbd>/<kbd>→</kbd> déplacent ; bouton « Retirer 8 ». Chaque ajout/retrait est annoncé (`aria-live="polite"`).
- Erreur : `aria-invalid` + `aria-describedby` sur la liste ; Enregistrer `disabled` + raison visible.
- ☕ est un vrai caractère (fonctionnalité), toujours accompagné de son libellé.

## Temps réel
Deck enregistré partagé par l'équipe : `DeckSaved` / `DeckDeleted` sur `private-team.{teamId}` rafraîchissent la grille ; une partie en cours garde une copie figée de son deck.

## À faire / À éviter
- Faire : conserver l'ordre saisi (c'est l'ordre du jeu) ; accepter `½`, `0.5` normalisé en `½`.
- Faire : afficher l'aperçu en vraies PokerCard pour vérifier la lisibilité (4 caractères max sur `sk-pcard--sm`).
- Éviter : modifier un deck intégré (dupliquer à la place) ; plus de 20 valeurs.

## Mapping shadcn / Tailwind
- `@/components/ui/radio-group`, `badge`, `input`, `switch`, `button`, `card` ; PokerCard du design system (`sk-pcard`).
- Racine `@container/deck` ; grille `grid grid-cols-[repeat(auto-fill,minmax(min(100%,--spacing(48)),1fr))] gap-2` ; éditeur `grid gap-5 p-5 @3xl/deck:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]`.
- Valeur aperçu : `grid h-7 min-w-6 place-items-center rounded-sm border bg-card px-1 font-display text-xs font-bold shadow-card` ; spéciale `bg-muted text-muted-foreground`.
- Tag input : `flex min-h-11 flex-wrap items-center gap-1.5 rounded-md border border-input bg-card p-1.5 aria-invalid:border-destructive` ; chip `inline-flex h-7.5 items-center gap-0.5 rounded-sm border bg-muted pl-1.5 pr-0.5 font-display text-sm font-bold` ; retirer `size-5.5 rounded-xs text-muted-foreground` ; chip en édition `bg-card ring-2 ring-ring ring-offset-1`.
- Spéciales : `grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b py-2` ; aperçu `flex flex-col gap-3 rounded-lg border bg-skrum-canvas p-4`.
- Icônes : `CircleCheck`, `Bookmark`, `Plus`, `GripVertical`, `X`, `Check`, `CircleAlert`.

## Tokens
`--card` `--muted` `--muted-foreground` `--foreground` `--accent` `--input` `--border` `--ring` `--primary` `--destructive` `--skrum-primary-soft` `--skrum-primary-text` `--skrum-destructive-text` `--skrum-canvas` `--secondary` `--secondary-foreground` `--shadow-card` `--radius` `--radius-md` `--radius-sm` `--radius-xs` `--radius-xl` `--space-1-5` `--space-2` `--space-3` `--space-4` `--space-5` `--font-display` `--duration-flip` `--ease-flip`

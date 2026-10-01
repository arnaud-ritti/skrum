Dialog « Raccourcis clavier » ouvert par `?` : liste filtrable des raccourcis par contexte (Général, Rétro, Réactions, Poker, Whiteboard), en ⌘ sur macOS et Ctrl ailleurs.

## Quand l'utiliser
- Partout dans l'app : `?` (hors champ de saisie), bouton `keyboard` du menu d'aide, entrée « Afficher les raccourcis clavier » de la palette ⌘K.
- Dans une session, la section du contexte courant (Rétro, Poker ou Whiteboard) est placée en premier, juste après Général.
- Pas pour exécuter des actions : c'est une aide de référence. Pour agir → `Command` (⌘K).

## Anatomie
En-tête (icône `keyboard` `--skrum-primary-text`, titre 18/650, bascule `Tabs` « macOS » / « Windows · Linux », fermer) · champ de recherche pleine largeur 44 px (`search`, `sk-kbd` `/`, nombre de résultats pendant la saisie) · corps en colonnes (`column-width` 18rem, 1 colonne en étroit, sections insécables) : titre de section en overline + icône, lignes « libellé ↔ touches » 32 px, touches en `sk-kbd` (séparateurs « – », « / », « + glisser » en texte), icône `wand-sparkles` = facilitateur uniquement · Réactions : grille 6 × (emoji + chiffre) + note · pied `--muted` : `?` à tout moment, `↑ ↓` défiler, `Esc` fermer, légende facilitateur.

Raccourcis :
- **Général** : ⌘K palette · `?` raccourcis · ⌘B barre latérale.
- **Rétro** : N nouvelle carte · ↵ publier · Esc annuler · V voter · G grouper · F focus (facilitateur) · ⌘→ phase suivante (facilitateur, même raccourci que `FacilitatorBar`).
- **Poker** : 0–9 choisir une carte · `?` jouer « ? » · C pause café ☕ · R révéler · ⇧R revoter · N tâche suivante (ces trois : facilitateur).
- **Whiteboard** : V sélection · H main · N post-it · S forme · T texte · P crayon · C connecteur · Espace + glisser · ⌘Z / ⇧⌘Z · ⌘+ / ⌘−.
- **Réactions** : 1–6 → 👍 ❤️ 👏 🎉 🤔 👎 (désactivé au poker, où les chiffres votent).

## Props
```ts
type Platform = 'mac' | 'other';
type Mod = 'mod' | 'shift' | 'alt';          // 'mod' = ⌘ (mac) / Ctrl (other)

interface Shortcut {
  id: string;
  label: string;                             // « Voter pour la carte sélectionnée »
  keys: (Mod | string)[];                    // ['mod', 'K'], ['shift', 'R'], ['Space']
  range?: [from: string, to: string];        // 0–9
  suffix?: string;                           // « + glisser »
  facilitatorOnly?: boolean;
  keywords?: string[];                       // « vote », « estimer »…
}
interface ShortcutSection { id: 'general' | 'retro' | 'poker' | 'whiteboard' | 'reactions'; title: string; icon: LucideIcon; items: Shortcut[]; note?: string }

interface KeyboardShortcutsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sections: ShortcutSection[];
  context?: ShortcutSection['id'];           // section mise en premier
  platform?: Platform;                       // défaut : détecté (navigator.userAgentData.platform)
  onPlatformChange?: (p: Platform) => void;
  query?: string;
  onQueryChange?: (q: string) => void;
  onOpenCommandPalette?: () => void;         // bouton de l'état vide
}
```

## États
- **Défaut macOS** (⌘, ⇧) et **Windows · Linux** (Ctrl, Shift) — la bascule n'affecte que l'affichage.
- **Recherche filtrée** : correspondance surlignée (`--skrum-primary-soft` / `--skrum-primary-text`), recherche aussi dans les mots-clés (« vote » trouve « Choisir une carte »), sections vides masquées, « 3 résultats » annoncé.
- **Aucun résultat** : icône `search-x`, « Aucun raccourci pour « export » », bouton « Ouvrir la palette ⌘K ».
- **Déclencheurs** : bouton icône + tooltip avec `sk-kbd ?` ; entrée de palette.
- Mobile : non affiché (pas de clavier) ; tablette avec clavier physique → `Dialog` plein écran.

## Accessibilité & clavier
- `role="dialog"` + `aria-modal` + `aria-labelledby` ; `Esc` ferme, focus rendu au déclencheur.
- Focus initial dans la recherche ; `/` y revient ; `↑ ↓` et `PgUp/PgDn` font défiler le corps.
- `?` n'ouvre pas la dialog quand le focus est dans un champ ou un contenu éditable, ni au poker quand le deck a le focus (`?` y joue la carte « ? ») ; ⌘/ reste disponible partout.
- Chaque groupe de touches porte un `aria-label` lisible (« Meta K », « Control Shift Z ») ; icône facilitateur avec `aria-label`.
- Sections `<section aria-label>` + `role="list"` ; résultat de recherche en `aria-live="polite"`.
- Les raccourcis à une lettre ne s'activent jamais pendant une saisie et peuvent être désactivés (Réglages › Accessibilité, WCAG 2.1.4).

## À faire / À éviter
- Faire : garder exactement les mêmes libellés que les tooltips et la palette ⌘K ; montrer ⌘ et Ctrl via la bascule plutôt que « ⌘/Ctrl » partout.
- Faire : marquer les raccourcis facilitateur au lieu de les cacher (les participants comprennent ce que fait l'animateur).
- Éviter : un raccourci sans équivalent visible à la souris ; réutiliser une lettre déjà prise dans le même contexte.

## Tokens
`--popover` `--popover-foreground` `--border` `--muted` `--muted-foreground` `--foreground` `--ring` `--skrum-primary-soft` `--skrum-primary-text` `--skrum-scrim` `--font-mono` `--radius-xs` `--radius-md` `--radius-xl` `--shadow-modal` `--shadow-popover` `--space-1` `--space-1-5` `--space-2` `--space-4` `--space-5` `--space-8`

## Mapping shadcn
- `@/components/ui/dialog` + `@/components/ui/tabs` (plateforme) + `@/components/ui/input` (recherche) + `@/components/ui/kbd` (ou `<kbd className="sk-kbd">` équivalent) + `@/components/ui/scroll-area` + `@/components/ui/tooltip` (déclencheur). Raccourcis globaux via `react-hotkeys-hook` (`enableOnFormTags: false`).
- DialogContent : `max-w-190 p-0 gap-0 overflow-hidden rounded-xl shadow-modal`. En-tête : `flex flex-wrap items-center gap-x-3 gap-y-2 pl-5 pr-4 pt-4 pb-3` ; titre `text-lg font-semibold truncate`.
- Recherche : `h-11 border-y px-5 text-ui-lg focus-within:border-b-2 focus-within:border-b-ring`.
- Corps : `columns-xs gap-8 px-5 pt-4 pb-5` ; section `break-inside-avoid mb-5` ; titre `text-overline uppercase text-muted-foreground border-b pb-1.5 mb-1 flex items-center gap-2`.
- Ligne : `flex min-h-8 items-center justify-between gap-3 py-1 text-body-sm` ; touches `flex shrink-0 items-center gap-0.75 whitespace-nowrap text-xs text-muted-foreground` ; `Kbd` : `font-mono text-overline rounded-xs border border-b-2 bg-muted px-1.25 min-w-5`.
- Surlignage : `<mark className="rounded-xs bg-skrum-primary-soft text-skrum-primary-text font-semibold">`.
- Réactions : `grid grid-cols-6 gap-1` ; tuile `flex flex-col items-center gap-1 rounded-md bg-muted py-1.5 text-lg`.
- Pied : `flex flex-wrap gap-x-4 gap-y-1 border-t bg-muted px-5 py-2 text-xs text-muted-foreground`.

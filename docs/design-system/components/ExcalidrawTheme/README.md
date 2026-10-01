Thème Skrüm pour le whiteboard Excalidraw : surcharge des variables CSS d'Excalidraw par nos tokens et palette de remplissage limitée aux 8 couleurs de post-its.

## Quand l'utiliser
- Partout où `@excalidraw/excalidraw` est monté (page Whiteboard, onglet whiteboard d'une rétro).
- Pas pour nos propres barres d'outils (→ `WhiteboardToolbar`) : ici on habille l'UI native d'Excalidraw sans la réécrire.

## Anatomie
Îles Excalidraw (`--island-bg-color` = `--popover`, bord `--border`, `--shadow-raised`, rayon `--radius`) · toolbar en haut au centre : lock, main, sélection (1), rectangle (2), losange (3), ellipse (4), flèche (5), ligne (6), crayon (7), texte (8), image (9), gomme (0), plus — outil actif `--skrum-primary-soft` + liseré `--primary` + icône `--skrum-primary-text` · menu burger en haut à gauche · panneau de propriétés à gauche (Trait, Arrière-plan, Remplissage, Épaisseur) · zoom − / 100 % / + et annuler / rétablir en bas à gauche · aide en bas à droite · hint centré en `--muted-foreground` · sélection (cadre + poignées) en `--primary` · fond du canevas `--skrum-canvas`. UI en Figtree (`--font-sans`) ; **le contenu dessiné garde la police manuscrite d'Excalidraw** (Excalifont / Virgil) — la preview utilise `--font-display` faute de pouvoir charger Excalifont.

## CSS à mettre dans l'app
`resources/css/excalidraw-theme.css`, importé **après** `@excalidraw/excalidraw/index.css`. Les tokens étant redéfinis par `.dark`, la plupart des lignes valent pour les deux thèmes ; `.theme--dark` ne reprend que ce qu'Excalidraw redéfinit lui-même en sombre.

```css
/* Skrüm × Excalidraw — surcharge des variables natives par les tokens Skrüm */
.excalidraw,
.excalidraw.theme--dark {
  /* Primaire : violet Excalidraw → terracotta */
  --color-primary: var(--primary);
  --color-primary-darker: color-mix(in oklch, var(--primary) 86%, var(--foreground));
  --color-primary-darkest: color-mix(in oklch, var(--primary) 72%, var(--foreground));
  --color-primary-light: var(--skrum-primary-soft);
  --color-primary-light-darker: color-mix(in oklch, var(--skrum-primary-soft) 85%, var(--primary));
  --color-primary-hover: color-mix(in oklch, var(--primary) 86%, var(--foreground));
  --color-on-primary-container: var(--skrum-primary-text);
  --color-surface-primary-container: var(--skrum-primary-soft);
  --color-brand-hover: var(--color-primary-darker);
  --color-selection: var(--primary);
  --select-highlight-color: var(--primary);

  /* Surfaces & bordures */
  --island-bg-color: var(--popover);
  --default-bg-color: var(--skrum-canvas);
  --default-border-color: var(--border);
  --popup-bg-color: var(--popover);
  --popup-secondary-bg-color: var(--muted);
  --popup-text-color: var(--popover-foreground);
  --popup-text-inverted-color: var(--background);
  --sidebar-bg-color: var(--sidebar);
  --sidebar-border-color: var(--sidebar-border);
  --overlay-bg-color: var(--skrum-scrim);
  --color-surface-lowest: var(--background);
  --color-surface-low: var(--muted);
  --color-surface-mid: var(--accent);
  --color-surface-high: var(--sidebar-accent);
  --color-on-surface: var(--foreground);
  --color-gray-100: var(--muted);

  /* Contrôles */
  --button-bg: var(--popover);
  --button-color: var(--foreground);
  --button-hover-bg: var(--accent);
  --button-active-bg: var(--skrum-primary-soft);
  --button-active-border: var(--primary);
  --button-hover-color: var(--foreground);
  --input-bg-color: var(--card);
  --input-border-color: var(--input);
  --input-hover-bg-color: var(--accent);
  --input-label-color: var(--muted-foreground);
  --icon-fill-color: var(--foreground);
  --text-primary-color: var(--foreground);
  --keybinding-color: var(--muted-foreground);
  --link-color: var(--skrum-primary-text);
  --color-danger: var(--destructive);

  /* Forme */
  --shadow-island: var(--shadow-raised);
  --border-radius-md: var(--radius-md);
  --border-radius-lg: var(--radius);
  --ui-font: var(--font-sans);
}

/* Focus visible cohérent avec le reste de l'app */
.excalidraw :focus-visible { outline: 2px solid var(--ring); outline-offset: 2px; }
```

- Thème : passer `theme={resolvedTheme === "dark" ? "dark" : "light"}` au composant ; Excalidraw ajoute alors `.theme--dark` et **inverse le canevas** (`filter: invert(93%) hue-rotate(180deg)`). Le canevas sombre est donc dérivé des couleurs claires stockées dans la scène : ne jamais écrire les valeurs sombres dans les éléments.
- Fond du canevas : `initialData.appState.viewBackgroundColor`, pas une variable CSS → lire `--skrum-canvas` du thème **clair** (valeur stockée), Excalidraw l'inverse en sombre.

## Palette (post-its à la place des couleurs Excalidraw)
Les couleurs des éléments sont **enregistrées dans la scène** (partagée entre thèmes et participants) : elles doivent être des chaînes littérales, issues des valeurs claires des tokens. Source unique : `resources/js/whiteboard/palette.ts` généré depuis `tokens.json`.

| Nom | Fond (`backgroundColor`) | Trait (`strokeColor`) | Hex fond / trait (clair) |
| --- | --- | --- | --- |
| Soleil · Sun | `--skrum-col-sun` | `--skrum-col-sun-border` | `#fdf1c2` / `#ddc362` |
| Abricot · Apricot | `--skrum-col-apricot` | `--skrum-col-apricot-border` | `#ffecdd` / `#efb787` |
| Corail · Coral | `--skrum-col-coral` | `--skrum-col-coral-border` | `#ffebe8` / `#f9aea4` |
| Prune · Plum | `--skrum-col-plum` | `--skrum-col-plum-border` | `#ffe9f4` / `#efadd1` |
| Iris | `--skrum-col-iris` | `--skrum-col-iris-border` | `#efeeff` / `#c3bbfb` |
| Ciel · Sky | `--skrum-col-sky` | `--skrum-col-sky-border` | `#e2f3ff` / `#8dccf9` |
| Lagon · Lagoon | `--skrum-col-lagoon` | `--skrum-col-lagoon-border` | `#cefaf9` / `#78d7d6` |
| Mousse · Moss | `--skrum-col-moss` | `--skrum-col-moss-border` | `#e1f8dc` / `#a5d39b` |

Traits libres (crayon, flèches, texte) : `--foreground` et les `--skrum-col-*-text` (contraste AA sur les fonds post-it).

```tsx
import { Excalidraw } from "@excalidraw/excalidraw";
import { POSTIT } from "@/whiteboard/palette"; // { sun: { bg: "#fdf1c2", stroke: "#ddc362" }, … }

<Excalidraw
  theme={isDark ? "dark" : "light"}
  langCode={locale === "fr" ? "fr-FR" : "en"}
  initialData={{
    elements,
    appState: {
      viewBackgroundColor: CANVAS_LIGHT,              // valeur claire de --skrum-canvas
      currentItemBackgroundColor: POSTIT.sun.bg,     // nouveau rectangle = post-it Soleil
      currentItemStrokeColor: POSTIT.sun.stroke,
      currentItemFillStyle: "solid",
      currentItemRoughness: 1,
      currentItemFontFamily: 5,                       // Excalifont : police manuscrite conservée
    },
  }}
  UIOptions={{
    canvasActions: { changeViewBackgroundColor: false, toggleTheme: false, export: false, loadScene: false },
    tools: { image: true },
  }}
/>
```

- Les « quick picks » natifs d'Excalidraw ne sont pas paramétrables par une prop stable selon les versions : **vérifier la version installée**. Si `UIOptions` n'expose pas de palette, masquer les pickers natifs (`.excalidraw .color-picker__top-picks { display: none; }`) et afficher la sous-barre de couleurs de `WhiteboardToolbar` qui applique la couleur via `excalidrawAPI.updateScene({ elements })` sur la sélection et met à jour `appState.currentItemBackgroundColor`.
- `toggleTheme: false` : le thème suit celui de l'app (réglage Appearance), jamais un toggle propre à Excalidraw.

## Props
```ts
type PostItColor = "sun" | "apricot" | "coral" | "plum" | "iris" | "sky" | "lagoon" | "moss";

interface SkrumExcalidrawProps {
  boardId: string;
  theme: "light" | "dark";              // depuis useAppearance()
  locale: "fr" | "en";
  defaultFill?: PostItColor;            // défaut "sun"
  readOnly?: boolean;                   // board verrouillé → viewModeEnabled
  initialElements?: readonly ExcalidrawElement[];
  onChange?: (elements: readonly ExcalidrawElement[], appState: AppState) => void;
}
```

## États
outil actif (soft + liseré primaire) · survol d'outil (`--accent`) · tooltip outil (`sk-tooltip`, « Rectangle R ou 2 ») · élément sélectionné (cadre et poignées `--primary`) · swatch actif (contour 2px `--primary`) · annuler/rétablir désactivé (50 %) · clair / sombre · mobile (toolbar réduite : main, sélection, rectangle, ellipse, flèche, crayon, texte ; hint masqué).

## Accessibilité & clavier
- Raccourcis natifs conservés (1–9, 0, H, V, R, D, O, A, L, P, T, E, Ctrl+Z / Ctrl+Maj+Z, Ctrl+molette) ; la `ReactionBar` utilise 1–6 **uniquement hors canevas focalisé** pour ne pas entrer en conflit.
- Contrastes : outil actif `--skrum-primary-text` sur `--skrum-primary-soft` ≥ 4.5:1 dans les deux thèmes ; hint `--muted-foreground` AA.
- Tooltips et libellés traduits par `langCode` (`fr-FR` / `en`).

## Temps réel
- Collaboration via les callbacks Excalidraw (`onChange`, `onPointerUpdate`) relayés sur `presence-board.{id}` (Reverb) : diff d'éléments par `version`/`versionNonce`, curseurs en whisper `client-pointer` (throttle 50 ms) affichés avec les couleurs `--skrum-presence-*` via `collaborators`.
- Les couleurs de la palette étant des littéraux stockés, tous les participants voient la même couleur quel que soit leur thème.

## À faire / À éviter
- Faire : surcharger les variables, pas les classes internes d'Excalidraw (fragiles d'une version à l'autre).
- Faire : garder Excalifont pour le contenu dessiné ; Figtree uniquement pour l'UI.
- Éviter : stocker `var(--token)` ou des valeurs sombres dans les éléments (non résolues sur le canvas, et inversées en sombre).
- Éviter : laisser les couleurs par défaut d'Excalidraw (verts/marrons foncés) ou le violet `#6965db`.

## Tokens
`--primary` `--foreground` `--background` `--skrum-primary-soft` `--skrum-primary-text` `--popover` `--popover-foreground` `--card` `--muted` `--muted-foreground` `--accent` `--border` `--input` `--ring` `--destructive` `--sidebar` `--sidebar-border` `--sidebar-accent` `--skrum-canvas` `--skrum-scrim` `--skrum-col-*` `--skrum-col-*-border` `--skrum-col-*-text` `--skrum-presence-*` `--shadow-raised` `--radius` `--radius-md` `--radius-sm` `--radius-xl` `--font-sans` `--space-1` `--space-2` `--space-3`

## Mapping shadcn
- Pas de composant shadcn : Excalidraw est un composant tiers. Le conteneur : `relative h-full w-full bg-skrum-canvas` ; boutons ajoutés via `renderTopRightUI` (pile de présence, Partager) en `@/components/ui/button variant="outline" size="sm"` et `@/components/ui/avatar`.
- La sous-barre de couleurs de repli réutilise `WhiteboardToolbar` (`rounded-xl border bg-popover p-1 shadow-raised`).

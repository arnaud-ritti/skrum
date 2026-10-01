Sélecteur de GIF branché sur GIPHY, pour les jeux d'icebreaker (« Le sprint en un GIF ») et, plus tard, les réactions de carte.

## Quand l'utiliser
- Quand un participant doit **choisir un GIF** à partager avec la salle : jeu « Sprint in one GIF », réponse d'icebreaker.
- En Popover ancré au bouton « Choisir mon GIF » sur desktop, en Drawer plein écran sur mobile.
- Pas pour les emojis rapides (→ `ReactionBar`) ni pour l'upload d'images (→ whiteboard).

## Anatomie
1. **En-tête** : champ de recherche (`search`, bouton `x` pour effacer), rangée de catégories en pastilles (`Tendances` actif par défaut, `Victoire`, `Fatigue`, `Facepalm`, `Café`, `Deadline`), fondu à droite si elles débordent.
2. **Corps** (hauteur fixe, défilement vertical) : sur-titre (« Tendances du moment » / « Résultats pour « … » »), grille **masonry 2 colonnes** — les tuiles sont réparties dans la colonne la plus courte (comme `react-masonry-css`), pas en `column-count`, pour garder l'ordre de lecture ligne par ligne.
3. **Tuile** : rendu du GIF, durée en pastille mono (`2,4 s`), titre en dégradé au survol / à la sélection, coche `--primary` quand sélectionnée.
4. **Aperçu avant envoi** : grande tuile, titre, méta (durée · en boucle · partagé avec la salle), légende facultative (60 caractères), `Retour` / `Envoyer ce GIF`.
5. **Pied** : classement de contenu (`Tout public (G)`) et l'attribution obligatoire **« Powered by GIPHY »** (texte, pas de logo dans le DS ; l'app peut afficher le logo officiel fourni par GIPHY).

Dans les previews, les GIF sont représentés par des **tuiles neutres** (dégradé d'une couleur de colonne, formes post-it, icône `film`) : aucune image ni URL externe.

## Props
```ts
type GifRating = 'g' | 'pg';
interface GifItem {
  id: string;
  title: string;            // sert d'alt / aria-label
  durationMs: number;
  width: number; height: number;   // rendition fixed_width, pour réserver la hauteur (pas de layout shift)
  mp4: string; webp: string; still: string;  // URLs servies par le proxy Laravel
}
interface GifPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories?: { key: string; label: string; query: string }[];  // défaut : tendances + 5 requêtes
  initialQuery?: string;
  rating?: GifRating;               // défaut 'g'
  lang: 'fr' | 'en';                // i18n de l'app → paramètre lang de GIPHY
  selectedId?: string;
  withCaption?: boolean;            // affiche l'aperçu avant envoi avec légende
  captionMaxLength?: number;        // défaut 60
  onSelect: (gif: GifItem, caption?: string) => void;
  status?: 'idle' | 'loading' | 'empty' | 'error' | 'disabled';  // piloté par useGifSearch()
}
```

## États
- **Défaut / tendances** — catégorie `Tendances` active, tuiles animées.
- **Survol** — anneau `--ring` + titre en bas de tuile.
- **Chargement** — 6 `sk-skel` de hauteurs variées + loader tréma « Chargement des GIF… » (`aria-busy="true"`). Requête après 300 ms de debounce.
- **Vide** — icône `search-x`, « Aucun GIF pour « … » », 3 suggestions cliquables.
- **Erreur** — icône `wifi-off` sur `--skrum-destructive-soft`, message rassurant, bouton `Réessayer` (`role="alert"`).
- **Sélectionné** — anneau double `--popover` + `--ring`, coche `--primary`, `aria-pressed="true"`.
- **Aperçu avant envoi** — voir Anatomie.
- **Animations réduites** — image fixe (`still`), bouton lecture sur chaque tuile, lecture au survol ou au clic.
- **Désactivé par l'admin** — recherche et catégories inactives, icône `key-round`, « Un administrateur peut ajouter une clé GIPHY dans Administration → Intégrations. », pas d'appel réseau.

## Intégration GIPHY
- **Endpoints** : `GET https://api.giphy.com/v1/gifs/search?q=…` et `GET https://api.giphy.com/v1/gifs/trending`, avec `limit=24`, `offset` (pagination au scroll), **`rating=g`**, **`lang=fr|en`** selon la langue de l'interface, `bundle=messaging_non_clips`.
- **Renditions** : `images.fixed_width` (200 px de large) dans la grille, `images.downsized` (ou `original` si < 2 Mo) dans l'aperçu et la galerie, `images.fixed_width_still` pour l'image fixe.
- **Formats** : préférer **`mp4`** puis **`webp`** au `.gif`. Rendu : `<video autoplay muted loop playsinline poster={still}>` (le `.gif` seulement en dernier recours).
- **Proxy Laravel** : le front n'appelle jamais GIPHY directement. Route `GET /api/gifs/search` et `/api/gifs/trending` → `GifController` qui ajoute `api_key` côté serveur, force `rating=g`, met en cache 10 min (`Cache::remember`, clé = requête + lang + offset), réduit la réponse aux champs utiles et applique un rate limit par utilisateur (`throttle:30,1`). La clé ne quitte jamais le serveur.
- **Self-host** : clé configurable par l'admin d'instance (Administration → Intégrations → GIPHY : clé, classement max, activé/désactivé), stockée chiffrée. Sans clé ou désactivé → état « Désactivé » et le jeu « Le sprint en un GIF » est masqué du choix des jeux.
- **Attribution** : « Powered by GIPHY » toujours visible dans le pied quand l'intégration est active (exigence des CGU GIPHY).

## Accessibilité & clavier
- Popover en `role="dialog"` avec `aria-label` (« Choisir un GIF »), focus initial dans la recherche, `Échap` ferme et rend le focus au déclencheur.
- Catégories en `role="tablist"` (flèches gauche/droite). Grille en `role="listbox"` : flèches pour naviguer, `Entrée` pour choisir, `Espace` pour lire/mettre en pause.
- **alt text = titre du GIF** (`aria-label` de la tuile et `aria-label` de la `<video>`), complété par la durée.
- `prefers-reduced-motion: reduce` : aucune lecture automatique, image fixe + bouton lecture ; lecture uniquement au survol, au focus ou au clic.
- Résultats annoncés via une région `aria-live="polite"` (« 24 GIF pour « fatigue » »).

## À faire / À éviter
- À faire : réserver la hauteur de chaque tuile à partir de `width/height` (pas de saut de mise en page), garder la légende courte, afficher la durée.
- À faire : vider la sélection à la fermeture si rien n'a été envoyé.
- À éviter : appeler GIPHY depuis le navigateur ou exposer la clé, charger le `.gif` original dans la grille, lancer la lecture automatique malgré `prefers-reduced-motion`, retirer l'attribution.

## Tokens
`--popover`, `--popover-foreground`, `--border`, `--input`, `--ring`, `--card`, `--foreground`, `--background`, `--muted`, `--muted-foreground`, `--primary`, `--primary-foreground`, `--skrum-destructive-soft`, `--skrum-destructive-text`, `--skrum-col-*` (+ `-border`, `-text`) pour les tuiles neutres, `--radius-md`, `--radius-xl`, `--shadow-popover`, `--space-1-5`, `--space-2`, `--space-3`, `--font-mono`.

## Mapping shadcn
- Conteneur : `@/components/ui/popover` (`PopoverContent className="w-104 p-0 rounded-xl shadow-popover"`) ; mobile : `@/components/ui/drawer`.
- Recherche : `@/components/ui/input` dans un `relative` (`pl-8.5 pr-9`), icône `Search` `absolute left-2.5 size-3.5 text-muted-foreground`.
- Catégories : `@/components/ui/toggle-group` (`type="single"`) avec items `h-7 px-2.5 rounded-full border text-xs font-semibold data-[state=on]:bg-foreground data-[state=on]:text-background`.
- Grille : `@/components/ui/scroll-area` `h-64 p-2` → `grid grid-cols-2 gap-2 items-start`, colonnes `flex flex-col gap-2`.
- Tuile : `button relative overflow-hidden rounded-md focus-visible:ring-2 ring-ring aria-pressed:ring-offset-2 ring-offset-popover` ; durée `absolute right-1.5 bottom-1.5 rounded-full px-1.5 font-mono text-overline`.
- Chargement : `@/components/ui/skeleton` ; aperçu : `Input` + `Button size="sm"` (`variant="ghost"` pour Retour).
- Pied : `flex justify-between border-t px-3 py-2 text-overline text-muted-foreground` ; « Powered by GIPHY » en `font-extrabold uppercase tracking-overline text-foreground`.

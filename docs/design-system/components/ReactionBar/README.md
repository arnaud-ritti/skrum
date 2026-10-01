Barre de réactions flottante commune à la rétro, au poker et au whiteboard : six emojis rapides + un sélecteur, diffusés en temps réel à toute la salle.

## Quand l'utiliser
- Toute session live (rétro, poker, whiteboard) : en bas au centre de l'écran, au-dessus de tout le contenu de la session.
- Pas pour réagir à une carte précise (→ `sk-reactions` dans `RetroCard`) : la barre envoie une réaction **éphémère à la salle**, sans la stocker.

## Anatomie
`rb-bar` (pilule `--popover`, bord `--border`, `--shadow-raised`, padding `space-1`) · 6 boutons emoji 👍 ❤️ 👏 🎉 🤔 👎 de 2.75rem (44 px) · séparateur vertical `--border` · bouton `smile-plus` (ouvre le sélecteur) · tooltip `sk-tooltip` (nom + `sk-kbd` 1–6) · « +1 » qui s'envole (pastille `--primary` / `--primary-foreground`) · emojis reçus flottants au-dessus de la barre, avec étiquette de présence `--skrum-presence-*` pour les premiers et agrégat « 🎉 ×8 · Malik et 7 autres » au-delà · sélecteur `sk-popover` (recherche, grille 8 colonnes, pied avec nom + shortcode).

## Placement (règle)
- **Poker** : la barre ne chevauche **jamais** le panneau du deck. Deux options valides :
  1. **Au-dessus** : la barre se pose sur le bord supérieur du panneau, écart `space-3` (0.75rem). Calcul : `bottom = hauteur du deck + space-3` (variable `--deck-height` posée par le panneau via `ResizeObserver`).
  2. **Intégrée** : la barre devient une zone du panneau (`variant="inline"`, sans pilule ni ombre), à droite du deck dès 46rem de conteneur, sous le deck avec un filet `--border` en dessous.
- **Rétro / whiteboard** : `bottom: space-6`, centrée ; elle remonte de la même façon au-dessus de toute barre basse (`FacilitatorBar`, zoom du whiteboard).
- Z-index : `--z-chrome` (sous les overlays et les toasts).

## Props
```ts
type QuickEmoji = "👍" | "❤️" | "👏" | "🎉" | "🤔" | "👎";

interface ReactionBarProps {
  emojis?: QuickEmoji[];                 // défaut : les 6, dans cet ordre (raccourcis 1–6)
  variant?: "floating" | "inline";       // inline = intégrée en bout de panneau (poker)
  compact?: boolean;                     // mobile : 3 emojis + « … » qui ouvre un Drawer
  compactEmojis?: QuickEmoji[];          // défaut ["👍", "❤️", "🎉"]
  disabled?: boolean;                    // board verrouillé par le facilitateur
  disabledReason?: string;               // « Le facilitateur a verrouillé les réactions. »
  offsetBottom?: number;                 // rem ; posé par le parent (hauteur du deck + space-3)
  incoming?: { id: string; emoji: string; userName?: string; presence?: number }[]; // rafale reçue
  onReact: (emoji: string) => void;      // émet + affiche l'envol local
  onOpenPicker?: () => void;
  labels?: Partial<Record<QuickEmoji | "add" | "more" | "search" | "locked", string>>; // i18n EN/FR
}
```

## États
repos · survol d'un emoji (fond `--accent`, glyphe ×1.35 et −0.25rem, tooltip « Fête 4 ») · pressé (fond `--skrum-primary-soft`, anneau `--primary`, « +1 » qui monte de 2.5rem en `--duration-slow` puis s'efface, traînée de 2 copies estompées) · sélecteur ouvert (bouton `smile-plus` actif, `aria-expanded`) · rafale reçue (emojis qui montent de 7.5rem avec léger drift horizontal, opacité 1 → 0 en `--duration-celebrate`, maximum 12 simultanés puis agrégat) · désactivé (boutons à 45 %, pilule sans ombre, badge `lock` « Board verrouillé ») · mobile compact (3 + `ellipsis`) · Drawer mobile (grille 3 × 2 de cibles 4.25rem avec nom, bouton « Plus d'emojis »).

## Accessibilité & clavier
- `role="toolbar"` + `aria-label="Réactions"` ; navigation entre boutons par flèches (roving tabindex), un seul arrêt Tab.
- Raccourcis globaux <kbd>1</kbd>–<kbd>6</kbd> (désactivés quand le focus est dans un champ texte ou une carte en édition) ; <kbd>Échap</kbd> ferme le sélecteur / le Drawer et rend le focus au bouton `smile-plus`.
- Chaque bouton : `aria-label="Fête (4)"`. Les emojis flottants sont `aria-hidden` ; une annonce `aria-live="polite"` résumée toutes les 5 s au plus (« 8 réactions 🎉 ») évite le spam lecteur d'écran.
- Cibles tactiles 2.75rem (44 px) minimum, y compris en mode compact et dans le sélecteur sur mobile.
- Désactivé : `aria-disabled="true"` (pas `disabled`, pour garder le tooltip explicatif au focus).
- `prefers-reduced-motion: reduce` : **pas d'envol** ni de rafale animée ; le « +1 » et les réactions reçues s'affichent sur place en fondu (`--duration-fast`) puis disparaissent ; pas de mise à l'échelle au survol.

## Temps réel
- Canal de présence de la session (`presence-retro.{id}`, `presence-poker.{id}`, `presence-board.{id}`) via Laravel Reverb.
- Envoi en **whisper** `client-reaction` `{ emoji, userId }` : rien n'est persisté, pas d'aller-retour serveur.
- Throttling émetteur : 1 whisper / 150 ms, rafale max 6 / s ; au-delà les clics sont regroupés (`{ emoji, count }`).
- Réception : file locale plafonnée à 12 emojis animés ; au-delà, agrégat par emoji pendant 2 s. Ignorer ses propres whispers (l'envol local est déjà joué).
- Board verrouillé : l'état `reactionsLocked` vient de l'événement serveur `SessionUpdated` ; le client cesse d'émettre et ignore les whispers reçus.

## À faire / À éviter
- Faire : calculer la position à partir de la hauteur réelle du deck (`space-3` d'écart) ou passer en `variant="inline"`.
- Faire : passer en `compact` sous 30rem de viewport ; ouvrir le reste dans un `Drawer`.
- Éviter : poser la barre en `bottom` fixe sur le poker, où elle chevauche les cartes du deck (bug actuel).
- Éviter : stocker les réactions de la barre ou les compter dans les stats ; éviter plus de 6 emojis rapides.

## Tokens
`--popover` `--border` `--accent` `--foreground` `--muted-foreground` `--primary` `--primary-foreground` `--skrum-primary-soft` `--skrum-primary-text` `--skrum-presence-*` `--skrum-success-soft` `--skrum-success-text` `--skrum-destructive-soft` `--skrum-destructive-text` `--destructive` `--skrum-canvas` `--skrum-canvas-dot` `--shadow-raised` `--shadow-card` `--radius-full` `--radius-xl` `--radius-md` `--space-1` `--space-2` `--space-3` `--space-6` `--duration-fast` `--duration-slow` `--duration-celebrate` `--ease-spring` `--ease-standard` `--z-chrome` `--font-mono`

## Mapping shadcn
- Boutons : `@/components/ui/button` `variant="ghost" size="icon"` → `size-11 rounded-full text-xl hover:bg-accent` ; pressé `bg-skrum-primary-soft ring-1 ring-inset ring-primary`.
- Barre : `fixed inset-x-0 mx-auto w-fit z-30 flex items-center rounded-full border bg-popover p-1 shadow-raised` ; position poker `bottom-(--reaction-offset)` où `--reaction-offset: calc(var(--deck-height) + var(--space-3))`.
- Tooltip : `@/components/ui/tooltip` (`TooltipContent` + `<Kbd>`). Sélecteur : `@/components/ui/popover` + `@/components/ui/command` (recherche) ; mobile : `@/components/ui/drawer`.
- Séparateur : `@/components/ui/separator` `orientation="vertical"` → `h-6 mx-1`.
- Animation : ajouter `--animate-reaction-rise` (keyframes `reaction-rise`) au thème, utilisé en `motion-safe:animate-reaction-rise motion-reduce:animate-none` (pas de valeur arbitraire).

## Classes partagées

Le cœur du composant est dans `bundle.css` : `.sk-rbar`, `.sk-rbar-e` (bouton 2.75rem, emoji dans un `<span>`), `.sk-rbar-add`, `.sk-rbar-sep`, `.sk-rbar-dock` (ancrage bas-centre d’une zone `position: relative`) et `.sk-rbar-fly` (réactions reçues). Les écrans (icebreaker, poker…) utilisent ces classes plutôt que des pastilles `sk-react`, réservées aux réactions **sur une carte**.

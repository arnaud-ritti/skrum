Centre de notifications de la cloche (topbar) : popover desktop, `Drawer` mobile, onglets Toutes / Non lues, actions en ligne (Accepter, Rejoindre) et lien vers les réglages.

**Quand l'utiliser**
- Événements qui concernent personnellement l'utilisateur hors session : invitation à une équipe, session qui démarre, action en retard, mention sur une carte, récap disponible.
- Pas pour les événements de la session en cours (→ `Sonner` / présence) ni pour les erreurs système (→ `Alert`).
- Mobile (< 640 px) : même contenu dans un `Drawer` ouvert depuis la cloche.

**Anatomie**
Cloche : bouton ghost icône 36 px (`bell`, 20), badge compteur 18 px `--destructive` / `--destructive-foreground` cerclé `--background` (« 9+ » au-delà de 9), ouverte : `--accent` + anneau `--ring`, arrivée : `bell-ring` + halo `--primary` 22 %. Popover 400 px (`--popover`, `--radius`, `--shadow-popover`, padding 0) → en-tête (titre 15/650 + « Tout marquer comme lu » ghost sm `--skrum-primary-text`) → `Tabs` pilule pleine largeur avec compteurs → liste : avatar (personne) ou tuile 32 px (`radio` session `--skrum-primary-soft`, `calendar-clock` retard `--skrum-destructive-soft`, `file-text` récap `--muted`), texte 13/20 avec noms en 650, méta 12 muted, actions sm, point non lu 8 px `--primary` à droite ; non lu = fond `--skrum-primary-soft` 55 % → pied « Réglages des notifications ». État vide : pastille `check-check` `--skrum-success-soft`, titre, description.

**Props**
```ts
type NotificationKind = 'team_invite' | 'session_starting' | 'action_overdue' | 'mention' | 'recap_ready';
interface AppNotification {
  id: string; kind: NotificationKind; readAt: string | null; createdAt: string;
  actor?: { name: string; presence: 1|2|3|4|5|6|7|8|9|10|11|12; avatarUrl?: string };
  team?: string; session?: { id: string; title: string; startsAt: string; facilitator: string };
  action?: { id: string; title: string; dueAt: string; ticket?: string };
  excerpt?: string;                     // mention
  href: string;
}
interface NotificationsPanelProps {
  notifications: AppNotification[];
  unreadCount: number;
  tab: 'all' | 'unread'; onTabChange: (t: 'all' | 'unread') => void;
  onMarkAllRead: () => void; onOpen: (n: AppNotification) => void;
  onInvite: (id: string, answer: 'accept' | 'decline') => void;
  onJoin: (sessionId: string) => void;
  settingsHref: string;                 // /settings/notifications
  hasMore?: boolean; onLoadMore?: () => void;
}
```

**États**
Cloche : aucune, compteur, 9+, ouverte / focus, nouvelle arrivée. Item : non lu (fond teinté + point), lu (texte atténué), survol (`--muted`), focus clavier (anneau intérieur `--ring`), invitation répondue (« Acceptée · bienvenue dans Atlas », boutons retirés), session démarrée (« Rejoindre » reste jusqu'à la fin de la session). Onglet Non lues vide → état vide, « Tout marquer comme lu » désactivé. Chargement : `Skeleton` de 3 items.

**Accessibilité & clavier**
- Cloche : `aria-label="Notifications, 3 non lues"`, `aria-haspopup="dialog"`, `aria-expanded` ; le badge est `aria-hidden` (le nombre est dans le libellé).
- Popover `role="dialog"` + `aria-labelledby` ; focus sur l'onglet actif à l'ouverture, `Échap` ferme et rend le focus à la cloche ; liste `role="list"`, `↑ ↓` entre items.
- Point non lu doublé d'un texte masqué « Non lue » ; retard signalé par le texte « Échéance … » en `--skrum-destructive-text`, pas par la couleur seule.
- Arrivée annoncée dans une région `aria-live="polite"` (« Nouvelle notification : Rétro sprint 42 commence dans 5 min »), sans voler le focus.

**Temps réel**
Canal privé Reverb `user.{id}` : une nouvelle notification incrémente le badge, joue la pulsation (`--duration-slow`, `--ease-spring`, désactivée en mouvement réduit) et s'insère en tête si le panneau est ouvert, sans décaler l'item sous le pointeur. « Tout marquer comme lu » est optimiste et synchronisé entre onglets/appareils. Le rappel « commence dans 5 min » est envoyé 5 min avant `startsAt`.

**À faire / À éviter**
- Faire : regrouper (« Théo et 2 autres t'ont mentionné ») ; marquer lu à l'ouverture de l'item, pas à l'ouverture du panneau ; 20 items puis « Charger plus ».
- Éviter : plus de deux actions par item ; notifications sans lien de destination ; badge rouge pour un simple récap si l'utilisateur l'a désactivé dans ses réglages.

**Tokens**
`--popover` `--popover-foreground` `--border` `--foreground` `--muted` `--muted-foreground` `--accent` `--background` `--primary` `--destructive` `--destructive-foreground` `--skrum-primary-soft` `--skrum-primary-text` `--skrum-destructive-soft` `--skrum-destructive-text` `--skrum-success-soft` `--skrum-success-text` `--skrum-presence-*` `--ring` `--shadow-popover` `--shadow-modal` `--radius` `--radius-md` `--radius-sm` `--radius-2xl` `--skrum-scrim` `--duration-slow` `--ease-spring`

**Mapping shadcn**
- `@/components/ui/popover` (desktop) / `@/components/ui/drawer` (mobile, via `useIsMobile`), `tabs`, `button`, `avatar`, `badge`, `scroll-area` (liste `max-h-105`).
- Cloche : `Button variant="ghost" size="icon" className="relative data-[state=open]:bg-accent"` ; badge : `absolute top-0.5 right-0.5 min-w-4.5 h-4.5 rounded-full bg-destructive px-1 text-overline text-destructive-foreground tabular-nums ring-2 ring-background`.
- PopoverContent : `w-100 p-0 overflow-hidden rounded-lg shadow-popover` (`align="end"`) ; en-tête `flex items-center justify-between pl-4 pr-3 pt-3` ; marquer lu : `Button variant="ghost" size="sm" className="text-skrum-primary-text"`.
- Item : `relative flex gap-3 border-t py-3 pl-4 pr-8 data-[unread=true]:bg-skrum-primary-soft/55 hover:bg-muted focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring` ; texte `text-body-sm` ; méta `text-xs text-muted-foreground` ; point `absolute right-4 top-4.5 size-2 rounded-full bg-primary` ; tuile `size-8 rounded-md bg-skrum-primary-soft text-skrum-primary-text`.
- Pied : `border-t p-1` + lien `h-9 rounded-sm px-3 text-body-sm font-semibold hover:bg-accent`.

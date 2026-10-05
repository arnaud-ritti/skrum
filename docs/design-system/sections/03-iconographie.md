# Iconographie

**lucide-react uniquement**, trait 2 px (1,75 px au-delà de 24 px), `strokeLinecap/Join="round"`, couleur `currentColor`. Tailles : 14 px (badges, méta), 16 px (défaut, boutons), 20 px (barres d'outils, navigation mobile), 40 px (illustrations de jeux, empty states). Une icône seule dans un bouton a toujours un `aria-label` et un tooltip avec son raccourci. Pas d'icônes remplies, pas d'autres bibliothèques ; les logos tiers (Jira, Linear, Slack, GitHub, Google, Microsoft…) sont les vrais logos des marques, dans leurs couleurs (Simple Icons, CC0 ; gilbarbara/logos pour ceux qui manquent), toujours accompagnés du nom du service en texte.

| Concept | Icône lucide | Note |
| --- | --- | --- |
| Rétrospective | `Layers` | module, sessions |
| Planning poker | `Spade` | module ; carte = `RectangleVertical` |
| Whiteboard | `PenTool` | module |
| Sondage | `ChartColumn` | module ; question = `CircleHelp` |
| Icebreaker | `Sparkles` | module ; pendu = `Type`, dessin = `Brush`, emoji = `Smile` |
| Action | `ListChecks` | liste ; une action = `CircleCheck` / `Circle` |
| Facilitateur | `Crown` | badge, barre de facilitation |
| Invité / anonyme | `VenetianMask` | anonyme ; invité = `UserRound` |
| Participants | `Users` | présence, membres |
| Timer | `Timer` | pause = `Pause`, +1 min = `TimerReset` |
| Phase | `ListOrdered` | suivante = `ArrowRight`, stepper = `ChevronRight` |
| Écriture | `PencilLine` | phase |
| Regroupement | `Group` | phase ; fusionner = `Merge` |
| Vote | `ThumbsUp` | bouton ; budget = points `sk-vdot` |
| Discussion | `MessagesSquare` | phase |
| ROTI / humeur | `Gauge` | tendance = `TrendingUp` |
| Masquer / révéler | `EyeOff` / `Eye` | cartes, votes |
| Verrouiller le board | `Lock` / `LockOpen` | facilitateur |
| Focus sur une carte | `Crosshair` | « tout le monde regarde ici » |
| Curseurs live | `MousePointer2` | masquer = `MousePointerClick` barré par un Switch |
| Réactions | `SmilePlus` | ajout de réaction |
| Partager / lien | `Share2` / `Link` | invitation |
| Connexion | `Wifi` / `WifiOff` | reconnexion = loader tréma |
| Ticket externe | `ExternalLink` | + ID en mono |
| Priorité | barres `sk-prio` (pas d'icône) | low / medium / high |
| Échéance | `CalendarClock` | en retard = `AlarmClock` en `skrum-destructive-text` |
| Paramètres / admin | `Settings2` / `ShieldCheck` | SSO = `KeyRound`, SMTP = `Mail`, MCP = `Plug` |
| Commande | `Command` + `Search` | palette ⌘K |
| Whiteboard outils | `MousePointer2`, `Hand`, `StickyNote`, `Shapes`, `Type`, `Pencil`, `Spline`, `ZoomIn`, `ZoomOut`, `Map` | V H N S T P C |

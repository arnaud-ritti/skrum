Modèles des e-mails transactionnels de Skrüm (lien magique, invitation, rappel d'actions en retard, récap de rétro, code 2FA), en 600 px max, EN/FR, clair/sombre et white-label.

## Quand l'utiliser

- Tout e-mail envoyé par l'app ou une instance self-host : un seul gabarit (`layout`), cinq contenus. Pas de newsletter ni de marketing ici.
- Un e-mail **dit quoi faire** en une action principale (un seul bouton), puis donne la conséquence et la sortie (« Tu n'as rien demandé ? Ignore cet e-mail »).

## Anatomie

1. **Fond** `muted` pleine largeur ; **carte** `card` de 600 px max (37.5rem), bordure `border`, rayon 10 px (8 px si Outlook desktop l'ignore, c'est acceptable).
2. **En-tête** : logo PNG @2x (symbole 28 px + `skrüm`, ou logo de l'instance) avec `alt` = nom affiché.
3. **Corps** : titre 20/28 bold, paragraphe 15/24, **un bouton bulletproof** `primary`, contenus métier (liste d'actions, stats, ROTI, code), petite ligne d'aide 13/20 `muted-foreground`.
4. **Pied** (hors carte, centré 12/18) : pourquoi tu reçois ce message, liens de gestion (et **désabonnement** pour les rappels et récaps), nom de l'instance, « Propulsé par Skrüm » (masquable).
5. **Pré-header** caché (texte d'aperçu dans la boîte de réception) : affiché en italique dans la preview.

Contenus : **Lien magique** (adresse en gras, validité 15 min, lien texte de secours en mono) · **Invitation** équipe ou espace (avatar de l'invitant + pastille d'équipe, bloc équipe/espace, message de l'invitant, validité 7 jours) · **Rappel d'actions en retard** (liste : case, titre, « Atlas · échéance 26 sept. · 5 jours de retard » en `skrum-destructive-text`, ticket mono) · **Récap de rétro** (4 stats, actions avec responsable et échéance, distribution ROTI 1→5 aux couleurs `skrum-roti-*`) · **Code 2FA** (code mono 32 px espacé, contexte de la demande, « Ce n'est pas toi ? change ton mot de passe »).

## Props

```ts
// Données passées à chaque Mailable (côté Laravel : propriétés publiques du Mailable, ici typées pour le front de preview)
interface MailBrand { name: string; logoUrl: string; logoWidth: number; primary: string; primaryForeground: string; primaryDark: string; primaryForegroundDark: string; poweredBy: boolean; instanceUrl: string }
interface BaseMail { locale: 'fr' | 'en'; brand: MailBrand; preheader: string; recipientEmail: string }
interface MagicLinkMail extends BaseMail { url: string; expiresInMinutes: 15 }
interface InvitationMail extends BaseMail { kind: 'team' | 'workspace'; inviter: { name: string; initials: string; presence: number }; team?: { name: string; initials: string; color: ColumnColor; members: number }; workspace: { name: string; teams: number }; message?: string; acceptUrl: string; expiresAt: string }
interface OverdueActionsMail extends BaseMail { actions: { title: string; team: string; dueAt: string; daysLate: number; ticket?: string; url: string }[]; actionsUrl: string; unsubscribeUrl: string; preferencesUrl: string }
interface RetroSummaryMail extends BaseMail { retro: { title: string; team: string; facilitator: string; endedAt: string; participants: number; cards: number }; actions: { title: string; assignee: { name: string; initials: string; presence: number }; dueLabel: string }[]; roti: { average: number; counts: [number, number, number, number, number] }; summaryUrl: string; preferencesUrl: string }
interface TwoFactorCodeMail extends BaseMail { code: string; expiresInMinutes: 10; request: { browser: string; os: string; city: string; country: string; at: string }; passwordUrl: string }
type ColumnColor = 'sun' | 'apricot' | 'coral' | 'plum' | 'iris' | 'sky' | 'lagoon' | 'moss';
```

## Construction Laravel

- Un **Mailable** par e-mail (`app/Mail/MagicLinkMail.php`…) qui implémente `ShouldQueue`, avec `->locale($user->locale)` et des chaînes dans `lang/{fr,en}/mail.php`. Les rappels passent par une **Notification** (`OverdueActionsReminder`) pour respecter les préférences de Paramètres › Notifications.
- **Option A — Markdown mail components** : `php artisan vendor:publish --tag=laravel-mail`, puis thème `resources/views/vendor/mail/html/themes/skrum.css` (valeurs hex ci-dessous) et composants `<x-mail::button>`, `<x-mail::panel>`, `<x-mail::table>` ; Laravel inline le CSS (CssToInlineStyles). Ajouter des composants maison `<x-mail::action-list>`, `<x-mail::roti>`, `<x-mail::code>`.
- **Option B — MJML** (recommandée pour le sombre et Outlook) : templates `.mjml` compilés au build (`mjml` en CLI ou `spatie/laravel-mjml`) vers des vues Blade ; `mj-button`, `mj-table`, `mj-attributes` portent les hex. Les deux options partagent le même `layout` et les mêmes partials.
- Envoi : SMTP configuré par l'admin d'instance (Admin › SMTP). Prévisualisation : `Route::get('/mail-preview/{mail}', fn () => new MagicLinkMail(...))` en local.

## Contraintes e-mail

- **Tables** pour la mise en page (`role="presentation"`, `cellpadding="0"`, `cellspacing="0"`), largeur fixe 600 + `width:100%` dans une table conteneur ; fluide sous 600 (une colonne, padding 24 → 16).
- **Styles inline** uniquement (le `<style>` du `<head>` ne sert qu'aux media queries et au mode sombre). **Pas de variables CSS, pas de `color-mix`, pas d'OKLCH** : seulement les hex du tableau.
- **Polices** : `font-family: Figtree, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;` (Figtree n'est chargée que par Apple Mail via `@font-face` ; ailleurs, la pile système). Code et liens de secours : `'JetBrains Mono', ui-monospace, Menlo, Consolas, monospace`. Le mot-symbole `skrüm` est **dans l'image du logo**, jamais en texte stylé.
- **Logo** : PNG @2x (56 × 56 pour 28 px affichés, ou largeur du logo d'instance × 2), `width`/`height` en attributs, `alt="Skrüm"` (ou nom d'instance), `style="display:block;border:0"`. Une variante claire pour le sombre via `<picture>`/media query (Apple Mail) sinon pastille `card` autour du logo.
- **Bouton bulletproof** : `<a>` en `display:inline-block` avec padding 12 × 24, fond et bordure `primary`, texte `primary-foreground` 15 px bold, rayon 8 ; pour Outlook desktop, un `<v:roundrect>` VML dans un commentaire conditionnel `<!--[if mso]>` de même hauteur (44 px) et même couleur. Toujours doublé d'un lien texte quand l'action est critique (lien magique).
- **Texte alternatif** : `alt` sur toutes les images, `lang` et `dir` sur `<html>`, `<title>` = objet ; le contenu reste compréhensible images bloquées (aucun texte dans une image hormis le logo).
- **Désabonnement** : rappels et récaps portent un lien « Se désabonner des rappels » (URL signée, sans connexion) **et** les en-têtes `List-Unsubscribe: <https://…>, <mailto:…>` + `List-Unsubscribe-Post: List-Unsubscribe=One-Click` (RFC 8058). Les e-mails de sécurité (lien magique, 2FA, invitation) n'en ont pas.
- **Mode sombre** : `<meta name="color-scheme" content="light dark">`, `<meta name="supported-color-schemes" content="light dark">`, puis `@media (prefers-color-scheme: dark)` (Apple Mail, Outlook iOS/macOS) et sélecteurs `[data-ogsc]`/`[data-ogsb]` (Outlook.com) avec la colonne « Sombre » ; Gmail inverse lui-même les couleurs : garder des contrastes AA dans les deux sens et éviter le texte sur image.
- Corps 15 px mini (13 px pour l'aide, 12 px pour le pied), lignes ≤ 75 caractères, pas d'emoji dans l'objet.

## Valeurs hex dérivées des tokens

Source : `python3 tools/palette.py hex` (OKLCH → sRGB, mêmes valeurs que l'app). À recopier dans le thème Markdown ou `mj-attributes`.

| Token | Clair | Sombre | Usage dans les mails |
| --- | --- | --- | --- |
| `muted` | `#f3efeb` | `#27221e` | fond de page, bloc stats, citation, code |
| `card` | `#ffffff` | `#1b1613` | carte |
| `border` | `#e4dfd9` | `#352f2b` | bordure carte, filets, lignes de liste |
| `input` | `#948a83` | `#6f6761` | case à cocher, pointillés du code |
| `foreground` | `#211a16` | `#f2f0ec` | titres, texte courant |
| `muted-foreground` | `#655b55` | `#b0aaa3` | aide, pied, méta |
| `primary` | `#bb4d2a` | `#ea865e` | bouton, logo |
| `primary-foreground` | `#fefbf8` | `#1d100b` | texte du bouton |
| `skrum-primary-text` | `#9c3917` | `#f9a782` | liens |
| `skrum-primary-soft` | `#ffe6da` | `#402218` | badge doux (facultatif) |
| `skrum-destructive-text` | `#a51c30` | `#feaaa9` | « n jours de retard » |
| `skrum-success-text` | `#00563c` | `#94e1bf` | confirmation |
| `skrum-warning-soft` / `-text` | `#fff3ce` / `#7d460b` | `#38260a` / `#f2cc7a` | avertissement |
| `skrum-col-lagoon` / `-border` / `-text` | `#cefaf9` / `#78d7d6` / `#005d5e` | `#002f2f` / `#006060` / `#98e4e3` | pastille d'équipe (couleur choisie) |
| `skrum-roti-1` … `5` | `#e06255` `#dd7b2b` `#e7bf57` `#6fb880` `#45a992` | `#ed756e` `#ee9b58` `#e9c769` `#82cb92` `#4db39e` | barres ROTI |
| `skrum-roti-foreground` | `#221812` | `#190f0a` | chiffre ROTI |
| `skrum-presence-2` / `-foreground` | `#4871cb` / `#fefbf8` | `#35b2ff` / `#1c1410` | avatar (ex. Théo) |
| `skrum-presence-4` / `-foreground` | `#59ad9b` / `#1c1410` | `#a1b385` / `#1c1410` | avatar (ex. Camille) |
| `skrum-presence-5` / `-foreground` | `#bc3b95` / `#fefbf8` | `#f485c9` / `#1c1410` | avatar (ex. Nadia) |
| `skrum-presence-8` / `-foreground` | `#ebe050` / `#1c1410` | `#fae74a` / `#1c1410` | avatar (ex. Lucas) |
| `skrum-info` / `-foreground` | `#0070a6` / `#fefbf8` | `#67b5e1` / `#05131d` | exemple de couleur d'instance (white-label) |

Les autres couleurs de colonnes / présence : même commande, même règle (fond = token, texte = son `-foreground` ou `-text`).

## White-label

- Le nom affiché, le logo (PNG ≥ 128 px, servi @2x) et la couleur viennent d'Admin › Branding. La couleur passe par `App\Support\Branding\BrandPalette::derive($hex)` : on lit `primary`, `primary-foreground` (clair) et leurs valeurs sombres, converties en **hex** (ajouter `BrandPalette::toHex()` à côté de `css()`), mises en cache avec le CSS de l'instance. Les contrastes sont donc garantis comme dans l'app.
- Seuls `primary`, `primary-foreground`, `skrum-primary-text` et le logo changent ; neutres, états, ROTI et présence restent ceux du tableau.
- Expéditeur : `MAIL_FROM_NAME` = nom affiché (« Atlas Corp Retro »), adresse de l'instance. « Propulsé par Skrüm » suit le réglage de l'admin.

## États

Lien magique (valide · expiré → l'écran Auth gère l'erreur) · invitation équipe / espace · rappel 1 à n actions (au-delà de 5 : « et 3 autres ») · récap avec ou sans ROTI (masqué si < 3 votes, anonymat) · code 2FA · clair / sombre · FR / EN · marque Skrüm / white-label.

## Accessibilité & clavier

- `<html lang="fr|en">`, tables `role="presentation"`, un seul `<h1>`, ordre de lecture = ordre visuel.
- Contrastes AA dans les deux modes (valeurs issues des paires vérifiées du DS) ; le retard n'est pas porté par la seule couleur (« 5 jours de retard » écrit).
- Code 2FA : chiffres groupés 3 + 3 avec espace insécable, `aria-label` chiffre par chiffre ; objet qui contient le code pour la lecture sur montre/notification.
- Liens explicites (« Ouvrir mes actions », jamais « clique ici »), cibles ≥ 44 px pour le bouton.

## À faire / À éviter

- **À faire** : une action par e-mail, objet qui dit le fait (« 3 actions sont en retard »), pré-header utile, lien texte de secours, pied qui explique la raison de l'envoi.
- **À éviter** : images de fond, texte dans les images, polices web obligatoires, `color-mix`/variables CSS, boutons en image, plusieurs boutons primaires, points d'exclamation, emoji décoratifs, tracking pixels dans les e-mails de sécurité.

## Tokens

`muted`, `card`, `border`, `input`, `foreground`, `muted-foreground`, `primary`, `primary-foreground`, `skrum-primary-text`, `skrum-destructive-text`, `skrum-col-lagoon(-border|-text)`, `skrum-roti-1…5`, `skrum-roti-foreground`, `skrum-presence-2|4|5|8(-foreground)`, `skrum-info(-foreground)` (white-label de démonstration), `radius`, `radius-md`, `radius-xl`, `font-sans`, `font-display`, `font-mono`.

## Mapping Tailwind (preview uniquement)

La preview utilise des classes locales `em-*` ; dans un composant React de prévisualisation (Admin › SMTP › « Envoyer un e-mail de test ») : carte `max-w-150 rounded-lg border bg-card`, corps `px-6 pt-4 pb-6 gap-3`, titre `text-xl font-bold`, texte `text-ui-lg/6`, bouton `rounded-md bg-primary px-6 py-3 text-ui-lg font-semibold text-primary-foreground`, pied `text-xs text-muted-foreground`. Le HTML réellement envoyé ne contient aucune classe Tailwind.

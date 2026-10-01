Paramètres utilisateur › Sécurité (desktop 1440, EN puis FR, scroll long) : mot de passe, double authentification, sessions actives, comptes liés.

**But** — protéger son compte sans jargon : chaque bloc dit l'état actuel, la conséquence d'une action et ce qu'il faut faire ensuite.

**Zones**
- Sidebar générée (`tools/sidebar.py`, `active=None`) + sous-navigation `.sk-subnav` « Compte » (Profil, **Sécurité** actif, Apparence, Notifications, Jetons d'API) — jamais de seconde sidebar. Topbar : fil d'Ariane Arnaud Ritti › Paramètres › Sécurité, recherche ⌘K.
- **Mot de passe** : actuel, nouveau (focus, afficher/masquer, jauge de force 4 segments `skrum-success`, libellé « Bon — ajoutez un symbole… »), confirmation (coche verte), règles cochées (12 caractères, absent des fuites — `Password::defaults()->uncompromised()`, différent de l'e-mail). Pied : « Les autres sessions sont déconnectées » + « Mettre à jour le mot de passe ». Masqué si le compte n'a que le SSO.
- **2FA · activation** (badge « Désactivée ») : QR code `otpauth://totp/…` dessiné en grille de modules (`foreground` sur `card`, logo au centre), **toujours foncé sur clair** (boîte forcée en thème clair) ; clé manuelle en `font-mono` groupée par 4 + « Copier » ; saisie OTP 6 cases (3 | 3, case active au focus ring, collage d'un code entier accepté) ; « Activer la 2FA » / « Annuler ».
- **Codes de récupération** (étape 3, juste après l'activation) : alerte warning « affichés une seule fois », grille mono numérotée de 10 codes, « Télécharger le .txt », « Copier », « Imprimer », case « J'ai enregistré mes codes » qui débloque « Terminer ».
- **2FA · activée** (badge « Activée ») : app d'authentification (date d'ajout, dernier usage, « Changer d'appareil »), codes restants (« Régénérer les codes » invalide les anciens), « Désactiver la 2FA » (outline destructive + icône, demande un code valide). Si l'admin impose la 2FA, le bouton de désactivation disparaît et une note l'explique.
- **Sessions actives** : table appareil (icône laptop/smartphone/monitor, modèle · navigateur, OS), badge « Cet appareil », lieu approximatif (ville, depuis l'IP — jamais l'IP complète), badge warning « Lieu inhabituel », dernière activité, « Déconnecter » par ligne + « Déconnecter les autres sessions » (re-saisie du mot de passe).
- **Comptes liés** : SSO OIDC (badge « Géré par votre admin », non déliable), Google (« Délier »), GitHub (« Lier GitHub »). Note : impossible de délier le dernier moyen de connexion.

**Composants** — Sidebar, `.sk-subnav`, Input, Field, Checkbox, Alert, Badge, Button (outline/ghost/sm), Table.

**Classes locales à promouvoir** — `.se-otp` / `.se-otp-box` (InputOTP), `.se-meter` (jauge de force), `.se-codes` (grille de codes), `.se-key` (secret copiable), `.se-qr` (QR en tokens).

**Mapping shadcn / Laravel** — `@/components/ui/input-otp` (`InputOTP maxLength={6}`, `InputOTPGroup`, `InputOTPSeparator`, `InputOTPSlot` : `size-11 h-13 rounded-md border-input font-mono text-xl`) ; QR rendu côté serveur par Laravel Fortify (`twoFactorQrCodeSvg()`), clé = `decrypt($user->two_factor_secret)` ; codes = `recoveryCodes()` ; sessions = driver `database` (`sessions.user_agent`, `last_activity`), lieu via GeoLite2 au niveau ville. Jauge : `grid grid-cols-4 gap-1`, segment `h-1.5 rounded-full bg-skrum-success`.

**Accessibilité** — OTP : un `input` réel (`autocomplete="one-time-code"`, `inputmode="numeric"`), les cases ne sont que l'affichage ; jauge en `role="meter"` + libellé texte ; QR avec `aria-label` et clé manuelle toujours visible ; actions destructives avec icône + mot.

**Mobile** — sous-nav en `Select` en haut de page ; QR au-dessus des étapes ; table des sessions en liste de cartes (appareil, lieu, activité, bouton) ; grille des codes en 2 colonnes.

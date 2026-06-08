# Spécification technique — Outil OSINT de génération de variantes de pseudo

## 1. Vue d'ensemble

Application web 100 % statique permettant de :
1. Saisir un pseudo unique
2. Générer ses variantes via leet bidirectionnel borné par une distance de Hamming
3. Tester manuellement chaque variante sur une liste de sites configurable
4. Suivre l'état de vérification de chaque test, avec persistance navigateur

**Hébergement cible** : GitHub Pages (statique pur, aucun backend).
**Stack imposée** : HTML5 + CSS3 + JavaScript vanilla (pas de framework, pas de build step).
**Persistance** : `localStorage` du navigateur.

---

## 2. Arborescence du projet

```
osint-pseudo-generator/
├── index.html
├── css/
│   └── style.css
├── js/
│   ├── app.js              # Bootstrap, gestion événements UI
│   ├── storage.js          # Wrapper localStorage (get/set/clear)
│   ├── generator.js        # Génération des variantes (leet + Hamming)
│   ├── sites.js            # CRUD sites + rendu liens
│   └── io.js               # Import / Export JSON
├── config/
│   ├── leet.json           # Table leet figée (livrée dans le repo)
│   └── sites.default.json  # Sites par défaut (1er chargement)
└── README.md
```

---

## 3. Fichiers de configuration

### 3.1 `config/leet.json` (figé, non éditable depuis l'IHM)

Format : tableau d'objets décrivant chaque paire de substitution bidirectionnelle.

```json
[
  { "id": "a-4", "from": "a", "to": "4", "default": true,  "category": "digit" },
  { "id": "e-3", "from": "e", "to": "3", "default": true,  "category": "digit" },
  { "id": "i-1", "from": "i", "to": "1", "default": true,  "category": "digit" },
  { "id": "o-0", "from": "o", "to": "0", "default": true,  "category": "digit" },
  { "id": "s-5", "from": "s", "to": "5", "default": true,  "category": "digit" },
  { "id": "t-7", "from": "t", "to": "7", "default": true,  "category": "digit" },
  { "id": "b-8", "from": "b", "to": "8", "default": true,  "category": "digit" },
  { "id": "g-9", "from": "g", "to": "9", "default": true,  "category": "digit" },
  { "id": "l-1", "from": "l", "to": "1", "default": true,  "category": "digit" },
  { "id": "a-@", "from": "a", "to": "@", "default": false, "category": "special" },
  { "id": "i-!", "from": "i", "to": "!", "default": false, "category": "special" },
  { "id": "s-$", "from": "s", "to": "$", "default": false, "category": "special" }
]
```

### 3.2 `config/sites.default.json` (chargé au 1er run, ensuite éditable IHM)

Format : tableau d'objets. Le placeholder `{pseudo}` est obligatoire dans `url`.

```json
[
  { "id": "github",    "name": "GitHub",    "url": "https://github.com/{pseudo}" },
  { "id": "twitter",   "name": "X/Twitter", "url": "https://x.com/{pseudo}" },
  { "id": "instagram", "name": "Instagram", "url": "https://instagram.com/{pseudo}" },
  { "id": "reddit",    "name": "Reddit",    "url": "https://reddit.com/user/{pseudo}" }
]
```

---

## 4. Modèle de données `localStorage`

Un seul namespace : préfixe `osint_pg_` pour toutes les clés.

| Clé | Type | Description |
|---|---|---|
| `osint_pg_pseudo` | string | Pseudo en cours de saisie |
| `osint_pg_leet_selected` | string[] | IDs des paires leet cochées |
| `osint_pg_distance` | number (1\|2\|3) | Distance de Hamming sélectionnée |
| `osint_pg_sites` | object[] | Liste personnalisée des sites |
| `osint_pg_results` | object | Résultats de la dernière génération (voir 4.1) |
| `osint_pg_link_states` | object | États par lien (voir 4.2) |
| `osint_pg_link_clicked` | object | Liens déjà cliqués (voir 4.3) |

### 4.1 Format `osint_pg_results`

```json
{
  "pseudo": "exemple",
  "generatedAt": "2026-04-21T10:00:00Z",
  "variants": ["exemple", "3xemple", "ex3mple", "..."]
}
```

### 4.2 Format `osint_pg_link_states`

Clé composée : `{variant}::{siteId}` → état numérique.

```json
{
  "exemple::github": 0,
  "3xemple::github": 1,
  "ex3mple::twitter": 2
}
```

| Valeur | État | Affichage |
|---|---|---|
| absent ou `null` | Non vérifié | aucun indicateur |
| `0` | Ne fonctionne pas | 🔴 |
| `1` | Fonctionnel mais doute | 🟡 |
| `2` | Correspond à la recherche | 🟢 |

### 4.3 Format `osint_pg_link_clicked`

Clé composée identique : `{variant}::{siteId}` → booléen.

```json
{
  "exemple::github": true
}
```

---

## 5. Moteur de génération (`js/generator.js`)

### 5.1 Signature

```js
/**
 * @param {string} pseudo            - pseudo d'entrée (case-insensitive)
 * @param {Array}  leetPairs         - paires leet cochées [{ from, to }, ...]
 * @param {number} maxDistance       - 1, 2 ou 3
 * @returns {string[]}               - variantes uniques triées
 */
function generateVariants(pseudo, leetPairs, maxDistance)
```

### 5.2 Algorithme

1. **Normalisation** : `pseudo.toLowerCase()`.
2. **Construction de la table de substitution effective** depuis `leetPairs`. Pour chaque paire `{ from, to }`, on génère **les deux directions** :
   - `from → to`
   - `to → from`
3. **Gestion de la collision sur `1`** : lors de l'inversion d'un `1`, générer **deux candidats** (`i` et `l`) si les deux paires sont actives. Cela ne compte que pour **une seule substitution** dans le décompte de distance.
4. **Énumération combinatoire** : pour chaque position du pseudo, récupérer la liste des substitutions possibles (caractère original inclus). Générer toutes les combinaisons via produit cartésien, puis **filtrer** celles dont le nombre de positions modifiées est `≤ maxDistance`.
5. **Déduplication** : utiliser un `Set`.
6. **Tri** : par distance croissante puis ordre lexicographique.

### 5.3 Garde-fou volume

Avant énumération, calculer une **estimation grossière** du nombre de variantes :

```
estimation = somme pour k=0..maxDistance de C(n,k) × (moyenne_subs_par_position)^k
```

avec `n` = longueur du pseudo. Si `estimation > 10 000`, afficher un message bloquant à l'utilisateur (voir §6.6) avant de lancer la génération.

---

## 6. Interface utilisateur (`index.html` + `js/app.js`)

### 6.1 Layout général (mobile-first, responsive)

```
┌──────────────────────────────────────────┐
│ HEADER : titre + boutons Reset/Export/Import │
├──────────────────────────────────────────┤
│ SECTION 1 : Saisie pseudo                │
│   [input texte] + label                  │
├──────────────────────────────────────────┤
│ SECTION 2 : Configuration leet           │
│   [Table avec checkboxes]                │
├──────────────────────────────────────────┤
│ SECTION 3 : Distance de Hamming          │
│   [select 1/2/3]                         │
├──────────────────────────────────────────┤
│ SECTION 4 : Sites à tester               │
│   [liste éditable + bouton Ajouter]      │
├──────────────────────────────────────────┤
│ SECTION 5 : Bouton GENERATE              │
├──────────────────────────────────────────┤
│ SECTION 6 : Résultats                    │
│   ├── Onglet "Wordlist" (textarea)       │
│   └── Onglet "Liens" (liste interactive) │
└──────────────────────────────────────────┘
```

### 6.2 Section 2 — Tableau leet

Rendu dynamique depuis `leet.json`. Une ligne par paire :

| ☑ | from | ↔ | to | catégorie |
|---|---|---|---|---|

- Cases cochées par défaut selon `default: true` du JSON.
- État coché persisté dans `osint_pg_leet_selected`.
- Regroupement visuel par `category` (digit / special).

### 6.3 Section 4 — Éditeur de sites

- Affichage tableau : `Nom` | `URL template` | bouton 🗑 supprimer.
- Bouton `+ Ajouter` ouvre une ligne d'édition (nom + URL).
- Validation à l'ajout : URL doit contenir `{pseudo}`.
- Modification persistée immédiatement dans `osint_pg_sites`.

### 6.4 Section 6 — Résultats

**Onglet "Wordlist"** :
- `<textarea readonly>` contenant les variantes séparées par `\n`.
- Bouton "Copier" (Clipboard API).

**Onglet "Liens"** :

Pour chaque variante × chaque site, afficher une ligne :

```
[lien cliquable avec couleur violette si visité]   [● ● ●]
```

- **Lien** : `<a href="..." target="_blank" rel="noopener noreferrer">{url remplie}</a>`.
- **Au clic** : marquer dans `osint_pg_link_clicked` → ré-appliquer la classe CSS `.visited` (couleur violette `#7B1FA2`).
- **Sélecteur d'état** : 3 boutons radio (🔴 / 🟡 / 🟢) + un état "non vérifié" implicite (aucun bouton sélectionné).
- Persistance immédiate de l'état dans `osint_pg_link_states`.
- **Filtres** (optionnels mais recommandés) : afficher seulement les liens d'un état donné, ou seulement non vérifiés.

### 6.5 Boutons header

| Bouton | Action |
|---|---|
| **Reset** | Confirmation puis `localStorage.clear()` filtré sur préfixe `osint_pg_` + recharge UI |
| **Export** | Génère un blob JSON (voir §7.1) et déclenche un téléchargement |
| **Import** | Ouvre un `<input type="file">`, parse, demande confirmation, écrase la session |

### 6.6 Messages utilisateur

Tous les messages utilisent une zone de notification non bloquante (toast) sauf :
- **Confirmation Reset** : `confirm()` natif
- **Confirmation Import** : `confirm()` natif avec texte explicite
- **Avertissement volume** : `confirm()` natif si estimation > 10 000

---

## 7. Import / Export (`js/io.js`)

### 7.1 Format du fichier exporté

Nom suggéré : `osint-session-{pseudo}-{YYYYMMDD-HHmmss}.json`.

```json
{
  "schemaVersion": 1,
  "exportedAt": "2026-04-21T10:00:00Z",
  "session": {
    "pseudo": "exemple",
    "results": {
      "pseudo": "exemple",
      "generatedAt": "2026-04-21T09:55:00Z",
      "variants": ["exemple", "3xemple", "..."]
    },
    "link_states": { "exemple::github": 0, "...": 2 },
    "link_clicked": { "exemple::github": true }
  }
}
```

**Périmètre** : la session uniquement (pseudo + résultats + états + cliqués). **Pas** la config leet ni la liste des sites.

### 7.2 Comportement à l'import

1. Lecture du fichier via `FileReader`.
2. Parsing JSON, validation du `schemaVersion`.
3. Affichage d'un `confirm()` :
   > « L'import va écraser la session en cours (pseudo, variantes générées, états des liens, liens cliqués). La configuration des sites et de la table leet n'est pas affectée. Continuer ? »
4. Si OK : écrasement des 4 clés `osint_pg_pseudo`, `osint_pg_results`, `osint_pg_link_states`, `osint_pg_link_clicked` puis re-render complet.
5. Si erreur de parsing ou schéma invalide : toast d'erreur, aucune modification.

---

## 8. Style (`css/style.css`)

### 8.1 Palette

| Usage | Couleur |
|---|---|
| Fond | `#F5F5F5` |
| Texte principal | `#212121` |
| Accent primaire | `#1976D2` |
| Lien non visité | `#1976D2` |
| **Lien visité** | `#7B1FA2` |
| État KO | `#E53935` |
| État doute | `#FBC02D` |
| État OK | `#43A047` |

### 8.2 Règles structurantes

- Design pensé **desktop en priorité**, adaptation mobile via media query (voir §8.3).
- Police système : `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`.
- Aucune dépendance externe (pas de Google Fonts, pas de CDN).

### 8.3 Adaptation mobile

Usage principal desktop, usage occasionnel mobile. Pas d'optimisation poussée, juste garantir l'utilisabilité.

**Breakpoint** : `@media (max-width: 768px)`.

**Adaptations en dessous de 768px** :
- Sections empilées verticalement, largeur 100 %, padding latéral 12px.
- **Tableau leet** : passe d'un tableau classique à une liste de cartes empilées (une carte par paire avec checkbox, `from`, `↔`, `to` en ligne).
- **Liste de sites (éditeur)** : idem, passage en cartes empilées avec bouton 🗑 aligné à droite.
- **Liste de liens (résultats)** : le lien occupe une ligne complète, les 3 boutons d'état passent dessous, alignés en ligne.
- **Header** : les boutons `Reset` / `Export` / `Import` passent en icônes seules avec `aria-label` pour l'accessibilité (texte conservé en `title`).
- **Cibles tactiles** : tous les éléments interactifs (checkboxes, boutons d'état, boutons header, liens) passent à `min-height: 44px` et `min-width: 44px`.
- **Textarea wordlist** : `min-height: 200px`, redimensionnable verticalement uniquement.

**Tests cibles** : viewport 360px (Android bas de gamme) et 390px (iPhone standard) doivent rester utilisables sans scroll horizontal.

**Hors périmètre mobile** : pas de PWA, pas d'installation home screen, pas de gestes (swipe), pas de mode hors-ligne avancé, pas de notifications.

---

## 9. Contraintes & non-objectifs

**Contraintes** :
- Aucun appel réseau sortant en dehors du chargement initial des fichiers `config/*.json`.
- Aucune dépendance npm, aucun build, aucun bundler.
- Compatible navigateurs modernes (ES2020+, pas de transpilation).
- Fonctionne hors-ligne après premier chargement (les `config/*.json` peuvent être chargés via `fetch` au démarrage et mis en cache implicitement).

**Non-objectifs (à ne PAS implémenter)** :
- Vérification automatique des liens (CORS rend la chose inutilisable).
- Backend, base de données, authentification.
- Multi-pseudo en entrée (un seul à la fois).
- Génération Hamming pure sur alphabet a-z+0-9 (seul le leet borné par la distance est implémenté).
- Édition de la table leet depuis l'IHM (la table vient du JSON figé).

---

## 10. Critères d'acceptation

1. ✅ Le projet se déploie tel quel sur GitHub Pages sans étape de build.
2. ✅ Saisir un pseudo, garder les valeurs par défaut, cliquer Generate produit une wordlist non vide et une liste de liens.
3. ✅ Cocher/décocher une paire leet et regénérer modifie la wordlist en conséquence.
4. ✅ Cliquer un lien le colore en violet ; après refresh, il reste violet.
5. ✅ Sélectionner un état sur un lien le persiste après refresh.
6. ✅ Ajouter un site dans l'IHM le rend disponible immédiatement dans la liste de liens à la prochaine génération.
7. ✅ Export produit un JSON conforme à §7.1 ; Import du même fichier restaure exactement l'état.
8. ✅ Reset vide tout l'état applicatif et restaure la config par défaut.
9. ✅ Aucune erreur console en utilisation normale.
10. ✅ L'avertissement volume se déclenche bien au-delà de 10 000 variantes estimées.

---

## 11. Livrables attendus

- Code source complet dans l'arborescence §2.
- `README.md` contenant : description courte, instructions de déploiement GitHub Pages, captures d'écran (à générer après réalisation), licence.
- Fichiers JSON de config pré-remplis selon §3.

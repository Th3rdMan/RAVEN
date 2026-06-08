# 🐦‍⬛ RAVEN – Reconnaissance of Aliases, Variants & External Networks

![Version](https://img.shields.io/badge/Version-1.0.0-blue)
![License](https://img.shields.io/badge/License-MIT-teal)
[![GitHub Pages](https://img.shields.io/badge/Live-GitHub_Pages-222?logo=github)](https://th3rdman.github.io/RAVEN/)
[![Author: Th3rd](https://img.shields.io/badge/github-Th3rdMan-181717?logo=github)](https://github.com/Th3rdMan)
[![Based on: hammer](https://img.shields.io/badge/based_on-nikoko107%2Fhammer-555)](https://github.com/nikoko107/hammer)

**RAVEN** est un outil d'OSINT passif pour la **reconnaissance de pseudonymes** sur le web.  
À partir d'un pseudo cible, il génère automatiquement ses variantes en leet-speak, puis vérifie leur présence sur des dizaines de plateformes en ligne.

> Construit sur la base de [hammer](https://github.com/nikoko107/hammer) par **nikoko107**, enrichi et redesigné.

---

## 🔍 Fonctionnalités

- 🔡 **Génération de variantes leet**  
  Production automatique de toutes les combinaisons de substitution leet à partir du pseudo saisi, avec contrôle de la distance de Hamming (1 à 3 substitutions maximum).  
  Estimation du nombre de variantes avant génération pour éviter les explosions combinatoires.

- ⚙️ **Table leet configurable**  
  12 paires de substitution bidirectionnelles activables individuellement :  
  `a↔4`, `e↔3`, `i↔1`, `o↔0`, `s↔5`, `t↔7`, `b↔8`, `g↔9`, `l↔1`, `a↔@`, `i↔!`, `s↔$`.  
  Chaque paire peut être activée ou désactivée selon le contexte.

- 📐 **Distance de Hamming**  
  Contrôle du nombre maximal de substitutions simultanées appliquées au pseudo.  
  Une distance de 1 génère des variantes à une seule lettre modifiée ; 3 explore les combinaisons les plus éloignées.

- 🌐 **38 sites préconfigurés**  
  Vérification sur des plateformes couvrant plusieurs catégories :  
  `coding`, `tech`, `social`, `gaming`, `video`, `music`, `blog`, `images`, `misc`.  
  La liste est entièrement personnalisable : ajout et suppression de sites à la volée.

- ⚡ **Vérification automatique des liens**  
  Envoi automatique des URLs générées à un proxy distant pour contournement CORS.  
  Les requêtes sont exécutées en parallèle avec une concurrence contrôlée.  
  Chaque lien reçoit un état :

  | État | Signification |
  |------|--------------|
  | 🟢 Correspond | HTTP 200 — profil probablement présent |
  | 🟡 Incertain | Redirection ou accès restreint |
  | 🔴 Absent | HTTP 404 / 410 — profil inexistant |

- 🔎 **Filtrage des résultats**  
  Les liens générés sont filtrables par catégorie de site et par état de vérification pour se concentrer sur les résultats pertinents.

- 📋 **Wordlist exportable**  
  Toutes les variantes générées sont disponibles sous forme de liste de mots copiable en un clic, directement utilisable dans d'autres outils OSINT.

- 💾 **Import / Export de session**  
  Sauvegarde complète de la session en JSON : pseudo, configuration leet, sites, états des liens.  
  Reprise d'une session précédente sans tout reconfigurer.

- 🌑 **Interface sombre & responsive**  
  Thème dark natif, adapté aux écrans mobiles (≤ 480px, ≤ 768px, ≤ 900px).

---

## 🎯 Objectif

RAVEN est conçu pour la **reconnaissance passive** de pseudonymes dans un cadre OSINT, CTF ou veille.

Il reste volontairement passif et non intrusif :

- pas de scan agressif ;
- pas de fuzzing ni de bruteforce ;
- pas d'exploitation ni d'authentification ;
- pas de modification des ressources cibles ;
- uniquement des requêtes HEAD/GET standard sur des URLs publiques.

---

## ⚙️ Architecture proxy

Les plateformes imposent des restrictions CORS qui empêchent un navigateur de vérifier directement les URLs.  
RAVEN délègue ces vérifications à un **proxy distant léger** qui effectue les requêtes côté serveur et renvoie uniquement le code HTTP.

Trois options sont disponibles :

| Option | Usage | Fichier |
|--------|-------|---------|
| **Deno Deploy** | En ligne, sans configuration | [`deno-proxy.ts`](deno-proxy.ts) |
| **Cloudflare Worker** | Alternative gratuite | [`cloudflare-worker.js`](cloudflare-worker.js) |
| **Node.js local** | Développement | [`server.js`](server.js) |

Le proxy Deno Deploy par défaut est hébergé et opérationnel sans aucune installation.  
L'URL du proxy est configurable via `localStorage` pour pointer vers sa propre instance.

---

## ⚠️ Limites connues

- Les plateformes qui retournent HTTP 200 pour tout chemin (page « not found » en HTML) ne peuvent pas être distinguées des profils existants sans analyse du contenu.
- Les redirections sont traitées comme incertaines (🟡) : certains profils légitimes qui utilisent une redirection de canonicalisation d'URL peuvent apparaître en jaune.
- Les sites à fort anti-bot (Cloudflare, Akamai) peuvent retourner 403 ou déclencher des timeouts.
- La vérification est limitée à 38 sites par défaut ; la couverture dépend de la liste configurée.
- Le proxy partagé par défaut peut être soumis à des limites de débit sur Deno Deploy.

---

## 📦 Installation

RAVEN est une application web statique. Aucune installation requise.

**Utilisation directe (GitHub Pages) :**
```
https://th3rdman.github.io/RAVEN/
```

**Déploiement local :**
```bash
git clone https://github.com/Th3rdMan/RAVEN.git
cd RAVEN
# Option A — Node.js (proxy local intégré)
npm start
# Option B — serveur statique seul
npm run serve
```

---

## 🧭 Utilisation

1. **Saisir un pseudo** dans le champ principal.

2. **Configurer la table leet** (optionnel) — activer ou désactiver les paires de substitution selon le pseudo ciblé.

3. **Choisir la distance de Hamming** — `1` pour les variantes proches, `3` pour une exploration plus large.

4. **Sélectionner les sites** à tester — la liste par défaut couvre 38 plateformes.

5. **Cliquer sur « Générer les variantes »** — les variantes et les liens sont produits.

6. **Onglet Wordlist** — copier la liste pour l'utiliser dans d'autres outils.

7. **Onglet Liens** — cliquer sur ⚡ **Vérifier tout** pour lancer la vérification automatique.  
   Les résultats s'affichent en temps réel avec les indicateurs 🟢 🟡 🔴.

8. **Filtrer les résultats** par catégorie ou par état pour cibler les correspondances probables.

9. **Exporter la session** pour reprendre l'analyse plus tard.

---

## 🧪 Exemple d'usage OSINT / CTF

Pour un pseudo cible comme `h4ck3r` :

- Distance 1 génère les variantes à une substitution près : `hacker`, `h4cker`, `h4ck3r`, `hack3r`…
- La vérification automatique identifie en quelques secondes les plateformes où des variantes sont actives.
- Le filtre 🟢 **Correspond** isole les profils probablement existants.
- La wordlist exportée peut être réutilisée dans des outils comme Maltego, SpiderFoot ou des scripts personnalisés.

---

## ✍️ Auteur & crédits

**Th3rd**  
👁️‍🗨️ [https://github.com/Th3rdMan](https://github.com/Th3rdMan)

Basé sur [**hammer**](https://github.com/nikoko107/hammer) par [**nikoko107**](https://github.com/nikoko107) — merci pour les bases posées.

---

> 📘 Projet libre sous licence MIT. Contributions, suggestions et pull requests bienvenues.

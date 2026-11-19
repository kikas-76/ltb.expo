// Après `expo export` : copies de dist/index.html avec un aperçu de partage
// (Open Graph) propre à certaines pages. Les robots de WhatsApp, Instagram ou
// iMessage n'exécutent pas le JavaScript : ils lisent seulement ces balises.
// vercel.json réécrit chaque chemin vers son fichier.
const fs = require('fs');
const path = require('path');

const ORIGIN = 'https://app.louetonbien.fr';
const PAGES = [
  {
    file: 'publier.html',
    path: '/publier',
    title: 'Publiez votre objet sur LoueTonBien',
    description:
      "Vos objets qui dorment peuvent vous rapporter de l'argent. Publiez votre annonce en 2 minutes, c'est gratuit.",
    image: '/og-publier.jpg',
  },
];

const dist = path.join(__dirname, '..', 'dist');
const base = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');

const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

for (const page of PAGES) {
  const url = ORIGIN + page.path;
  const image = ORIGIN + page.image;
  const tags = [
    ['name', 'description', page.description],
    ['property', 'og:type', 'website'],
    ['property', 'og:site_name', 'LoueTonBien'],
    ['property', 'og:locale', 'fr_FR'],
    ['property', 'og:title', page.title],
    ['property', 'og:description', page.description],
    ['property', 'og:url', url],
    ['property', 'og:image', image],
    ['property', 'og:image:width', '1200'],
    ['property', 'og:image:height', '630'],
    ['name', 'twitter:card', 'summary_large_image'],
    ['name', 'twitter:title', page.title],
    ['name', 'twitter:description', page.description],
    ['name', 'twitter:image', image],
  ]
    .map(([attr, key, value]) => `    <meta ${attr}="${key}" content="${esc(value)}" />`)
    .join('\n');
  if (!base.includes('</head>') || !/<title>[^<]*<\/title>/.test(base)) {
    throw new Error('dist/index.html inattendu : <title> ou </head> introuvable');
  }
  // Retire d'éventuelles balises par défaut avant d'ajouter celles de la page.
  let html = base.replace(/\s*<meta (property|name)="(og:[^"]+|twitter:[^"]+|description)"[^>]*>/g, '');
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${esc(page.title)}</title>`);
  html = html.replace('</head>', `${tags}\n    <link rel="canonical" href="${url}" />\n  </head>`);
  fs.writeFileSync(path.join(dist, page.file), html);
  console.log(`aperçu de partage : ${page.path} → dist/${page.file}`);
}

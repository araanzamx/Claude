// Junta el build de modo "artefacto" en un solo archivo HTML (modo demostración).
// Uso: npm run artefacto  →  dist-artefacto/bitacora-upper-nannies.html
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = 'dist-artefacto/assets';
const archivos = readdirSync(dir);
const css = archivos.filter((f) => f.endsWith('.css')).map((f) => readFileSync(join(dir, f), 'utf8')).join('\n');
const js = archivos.filter((f) => f.endsWith('.js')).map((f) => readFileSync(join(dir, f), 'utf8')).join('\n');
const html = readFileSync('index.html', 'utf8');
const fuentes = html.match(/<link\s+href="https:\/\/fonts\.googleapis\.com[^>]*>/s)[0];

const pagina = `<title>Bitácora Upper Nannies</title>
<meta name="theme-color" content="#053B84" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
${fuentes}
<style>${css}</style>
<div id="root"></div>
<script type="module">${js.replace(/<\/script/gi, '<\\/script')}</script>
`;
writeFileSync('dist-artefacto/bitacora-upper-nannies.html', pagina);
console.log(`dist-artefacto/bitacora-upper-nannies.html (${Math.round(pagina.length / 1024)} KB)`);

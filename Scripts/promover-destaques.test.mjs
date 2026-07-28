/**
 * Teste TDD: promover_destaques deve mover APENAS o li de Destaques
 * para o nível de #menudrop > ul, imediatamente após #nav_torrents.
 *
 * Executar via: node Scripts/promover-destaques.test.mjs
 * (usa happy-dom se disponível; senão fallback com parser mínimo via linkedom/jsdom)
 */
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root_dir = join(__dirname, '..');

const fixture_html = `<!DOCTYPE html>
<html><body>
<div id="menudrop"><ul>
  <li id="nav_index"><a href="/">Home</a></li>
  <li id="nav_torrents">
    <a href="/torrents.php">Torrents</a>
    <ul>
      <li><a href="/torrents.php?action=search">Buscar</a></li>
      <li><a href="/torrents.php?action=destaques">Destaques</a></li>
      <li><a href="/torrents.php?action=top">Top</a></li>
    </ul>
  </li>
  <li id="nav_forums"><a href="/forums.php">Forums</a>
    <ul><li><a href="/forums.php?action=view">Board</a></li></ul>
  </li>
</ul></div>
</body></html>`;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function run_assertions(document, promover_destaques) {
  const before_top = document.querySelectorAll('#menudrop > ul > li').length;
  const before_sub = document.querySelectorAll('#nav_torrents > ul > li').length;

  const moved = promover_destaques(document);
  assert(moved === true, 'esperava true na primeira promoção');

  const dest_link = document.querySelector('#menudrop > ul > li > a[href*="action=destaques"]');
  assert(!!dest_link, 'Destaques deve estar no nível principal');

  const dest_li = dest_link.closest('li');
  assert(dest_li.parentElement === document.querySelector('#menudrop > ul'), 'pai deve ser o ul principal');
  assert(dest_li.previousElementSibling?.id === 'nav_torrents', 'Destaques deve vir logo após Torrents');
  assert(document.querySelector('#nav_torrents > ul > li > a[href*="action=destaques"]') === null, 'não deve restar no submenu');
  assert(document.querySelectorAll('#menudrop > ul > li').length === before_top + 1, 'menu principal +1 item');
  assert(document.querySelectorAll('#nav_torrents > ul > li').length === before_sub - 1, 'submenu -1 item');
  assert(document.querySelector('#nav_forums > ul > li') !== null, 'submenu de Forums intacto');

  const moved_again = promover_destaques(document);
  assert(moved_again === false, 'segunda chamada não deve mover de novo');

  // O(n) sobre os itens do menu principal
  const ids = [...document.querySelectorAll('#menudrop > ul > li')].map((li) => li.id || li.textContent.trim());
  assert(ids.includes('nav_torrents'), 'Torrents permanece');
  assert(ids.includes('nav_destaques'), 'Destaques recebe id no nível principal');
  assert(ids.includes('nav_forums'), 'Forums permanece');
}

async function main() {
  // Instala jsdom localmente só para o teste (devDependency efêmera em /tmp)
  const test_dir = '/tmp/destaques-tm-test';
  mkdirSync(test_dir, { recursive: true });
  const install = spawnSync('npm', ['init', '-y'], { cwd: test_dir, encoding: 'utf8' });
  if (install.status !== 0) throw new Error(install.stderr);
  const add = spawnSync('npm', ['install', 'jsdom@24', '--no-fund', '--no-audit'], {
    cwd: test_dir,
    encoding: 'utf8',
    timeout: 120000,
  });
  if (add.status !== 0) throw new Error(add.stderr || add.stdout);

  const require = createRequire(join(test_dir, 'package.json'));
  const { JSDOM } = require('jsdom');

  // Carrega a função do userscript extraindo o bloco exportável
  const user_script_path = join(root_dir, 'Scripts', 'promover-destaques.user.js');
  const source = readFileSync(user_script_path, 'utf8');
  const marker = '/* __TEST_EXPORT_START__ */';
  const end_marker = '/* __TEST_EXPORT_END__ */';
  const start = source.indexOf(marker);
  const end = source.indexOf(end_marker);
  assert(start >= 0 && end > start, 'userscript deve conter bloco __TEST_EXPORT__');
  const fn_source = source.slice(start + marker.length, end);
  // eslint-disable-next-line no-new-func
  const factory = new Function(`${fn_source}; return promover_destaques;`);
  const promover_destaques = factory();

  const dom = new JSDOM(fixture_html);
  run_assertions(dom.window.document, promover_destaques);
  console.log('PASS: promover_destaques');
}

main().catch((err) => {
  console.error('FAIL:', err.message);
  process.exit(1);
});

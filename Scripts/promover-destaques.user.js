// ==UserScript==
// @name         BJ - Promover Destaques no menu
// @namespace    https://github.com/canetex/CSS_BJ
// @version      1.2.1
// @description  Move apenas o item Destaques (submenu de Torrents) para o menu principal: HOME | TORRENTS | DESTAQUES | ...
// @author       canetex
// @match        https://bj-share.info/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

/*
 * Top 5 (complexidade):
 * 1. promover_destaques — O(1) consultas DOM + O(1) move
 * 2. tentar_promover_com_retry — O(k) tentativas
 * 3. log_diagnostico_menu — O(n) nos links do menu
 * 4. persistir_logs — O(n) serialização
 * 5. render_painel — O(n) linhas no painel
 *
 * Ativo somente em: https://bj-share.info/*
 * Logs NÃO dependem só do Console (somem com reload).
 * Há painel fixo na página + localStorage.
 * Filtrar console por: [BJ Destaques]
 * Helpers: __BJ_DESTAQUES.diagnostico() | .promover() | .logs() | .limpar()
 */

(function () {
  'use strict';

  const MAX_TENTATIVAS = 20;
  const INTERVALO_MS = 250;
  const LOG_PREFIX = '[BJ Destaques]';
  const STORAGE_KEY = '__bj_destaques_logs_v1';
  const MAX_LOG_LINES = 200;
  const PAINEL_ID = 'bj-destaques-debug-panel';
  const SCRIPT_VERSION = '1.2.1';

  const log_buffer = [];

  function agora_iso() {
    try {
      return new Date().toISOString();
    } catch (e) {
      return String(Date.now());
    }
  }

  function args_para_texto(args) {
    // O(n) args
    return Array.prototype.map.call(args, function (arg) {
      if (arg == null) return String(arg);
      if (typeof arg === 'string' || typeof arg === 'number' || typeof arg === 'boolean') {
        return String(arg);
      }
      if (arg instanceof Element) {
        return '<' + arg.tagName.toLowerCase() +
          (arg.id ? '#' + arg.id : '') +
          (arg.className ? '.' + String(arg.className).split(' ').join('.') : '') +
          '>';
      }
      if (arg instanceof NodeList || Array.isArray(arg)) {
        try {
          return JSON.stringify(Array.prototype.map.call(arg, function (item) {
            if (item instanceof Element) {
              return (item.tagName || '') + (item.id ? '#' + item.id : '');
            }
            return item;
          }));
        } catch (e) {
          return String(arg);
        }
      }
      try {
        return JSON.stringify(arg);
      } catch (e) {
        return String(arg);
      }
    }).join(' ');
  }

  function carregar_logs_persistidos() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      // O(n)
      for (let i = 0; i < parsed.length; i += 1) {
        log_buffer.push(parsed[i]);
      }
    } catch (e) {
      // ignore storage errors
    }
  }

  function persistir_logs() {
    try {
      const slim = log_buffer.slice(-MAX_LOG_LINES);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(slim));
    } catch (e) {
      // ignore quota / private mode
    }
  }

  function garantir_painel() {
    let painel = document.getElementById(PAINEL_ID);
    if (painel) return painel;

    painel = document.createElement('div');
    painel.id = PAINEL_ID;
    painel.setAttribute('data-bj-destaques', 'debug');
    painel.style.cssText = [
      'position:fixed',
      'right:8px',
      'bottom:8px',
      'z-index:2147483647',
      'width:420px',
      'max-width:95vw',
      'max-height:45vh',
      'display:flex',
      'flex-direction:column',
      'background:#0b1220',
      'color:#d7e0ea',
      'border:1px solid #3a4a5f',
      'border-radius:8px',
      'font:12px/1.4 Consolas,Menlo,monospace',
      'box-shadow:0 8px 24px rgba(0,0,0,.45)',
    ].join(';');

    const header = document.createElement('div');
    header.style.cssText = 'display:flex;gap:6px;align-items:center;padding:6px 8px;background:#152033;border-bottom:1px solid #3a4a5f';
    header.innerHTML = '<strong style="flex:1">BJ Destaques debug v' + SCRIPT_VERSION + '</strong>';

    const btn_copiar = document.createElement('button');
    btn_copiar.textContent = 'Copiar';
    btn_copiar.type = 'button';
    btn_copiar.style.cssText = 'cursor:pointer;padding:2px 6px';
    btn_copiar.addEventListener('click', function () {
      const texto = log_buffer.map(function (l) { return l.t + ' ' + l.m; }).join('\n');
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(texto).then(function () {
          btn_copiar.textContent = 'OK';
          setTimeout(function () { btn_copiar.textContent = 'Copiar'; }, 1200);
        });
      } else {
        window.prompt('Copie os logs:', texto);
      }
    });

    const btn_limpar = document.createElement('button');
    btn_limpar.textContent = 'Limpar';
    btn_limpar.type = 'button';
    btn_limpar.style.cssText = 'cursor:pointer;padding:2px 6px';
    btn_limpar.addEventListener('click', function () {
      log_buffer.length = 0;
      persistir_logs();
      render_painel();
    });

    const btn_fechar = document.createElement('button');
    btn_fechar.textContent = 'X';
    btn_fechar.type = 'button';
    btn_fechar.style.cssText = 'cursor:pointer;padding:2px 6px';
    btn_fechar.addEventListener('click', function () {
      painel.style.display = 'none';
    });

    header.appendChild(btn_copiar);
    header.appendChild(btn_limpar);
    header.appendChild(btn_fechar);

    const body = document.createElement('pre');
    body.id = PAINEL_ID + '-body';
    body.style.cssText = 'margin:0;padding:8px;overflow:auto;white-space:pre-wrap;word-break:break-word;flex:1';

    painel.appendChild(header);
    painel.appendChild(body);

    const mount = function () {
      if (!document.getElementById(PAINEL_ID)) {
        (document.body || document.documentElement).appendChild(painel);
      }
    };
    if (document.body) mount();
    else document.addEventListener('DOMContentLoaded', mount);

    return painel;
  }

  /**
   * O(n) — redesenha o painel com as últimas linhas.
   */
  function render_painel() {
    garantir_painel();
    const body = document.getElementById(PAINEL_ID + '-body');
    if (!body) return;
    const lines = log_buffer.slice(-MAX_LOG_LINES);
    // O(n)
    body.textContent = lines.map(function (l) {
      return '[' + l.lvl + '] ' + l.t + ' ' + l.m;
    }).join('\n');
    body.scrollTop = body.scrollHeight;
  }

  function push_log(level, args) {
    const message = args_para_texto(args);
    const entry = { t: agora_iso(), lvl: level, m: message };
    log_buffer.push(entry);
    if (log_buffer.length > MAX_LOG_LINES) {
      log_buffer.splice(0, log_buffer.length - MAX_LOG_LINES);
    }
    persistir_logs();
    render_painel();

    const console_args = [LOG_PREFIX].concat(Array.prototype.slice.call(args));
    if (level === 'WARN') console.warn.apply(console, console_args);
    else console.log.apply(console, console_args);
  }

  function log() {
    push_log('INFO', arguments);
  }

  function warn() {
    push_log('WARN', arguments);
  }

  /**
   * O(n) — dump diagnóstico do menu.
   */
  function log_diagnostico_menu(doc) {
    const menudrop = doc.querySelector('#menudrop');
    const menu_ul = doc.querySelector('#menudrop > ul');
    const nav_torrents = doc.querySelector('#nav_torrents');

    log('url =', location.href);
    log('readyState =', doc.readyState);
    log('#menudrop =', !!menudrop, menudrop);
    log('#menudrop > ul =', !!menu_ul, menu_ul);
    log('#nav_torrents =', !!nav_torrents, nav_torrents);

    if (menu_ul) {
      const top_items = Array.prototype.map.call(menu_ul.children, function (li) {
        const a = li.querySelector(':scope > a');
        return {
          id: li.id || '(sem id)',
          text: a ? (a.textContent || '').trim() : '(sem a)',
          href: a ? a.getAttribute('href') : null,
        };
      });
      log('itens nível principal (' + top_items.length + ') =', top_items);
    }

    if (nav_torrents) {
      const sub_links = nav_torrents.querySelectorAll('a');
      const sub_items = Array.prototype.map.call(sub_links, function (a) {
        return {
          text: (a.textContent || '').trim(),
          href: a.getAttribute('href'),
        };
      });
      log('links dentro de #nav_torrents (' + sub_items.length + ') =', sub_items);
    }

    let by_href;
    try {
      by_href = doc.querySelectorAll('a[href*="destaques" i], a[href*="action=destaques"]');
    } catch (e) {
      by_href = doc.querySelectorAll('a[href*="destaques"], a[href*="action=destaques"]');
    }
    const by_text = Array.prototype.filter.call(doc.querySelectorAll('a'), function (a) {
      return /destaques/i.test((a.textContent || '').trim());
    });
    log('links href*="destaques" (' + by_href.length + ') =', by_href);
    log('links texto~=Destaques (' + by_text.length + ') =', by_text);
  }

  /* __TEST_EXPORT_START__ */
  /**
   * Move somente o <li> de Destaques do submenu de #nav_torrents
   * para o nível de #menudrop > ul, logo após Torrents.
   * @param {Document} root
   * @returns {boolean} true se moveu nesta chamada
   */
  function promover_destaques(root) {
    const nav_destaques_id = 'nav_destaques';
    const doc = root || document;
    const menu_ul = doc.querySelector('#menudrop > ul');
    const nav_torrents = doc.querySelector('#nav_torrents');
    if (!menu_ul || !nav_torrents) {
      return false;
    }

    const ja_promovido = menu_ul.querySelector(
      ':scope > li#' + nav_destaques_id + ', :scope > li > a[href*="action=destaques"]'
    );
    if (ja_promovido) {
      return false;
    }

    const link = nav_torrents.querySelector('a[href*="action=destaques"]');
    if (!link) {
      return false;
    }

    const item_li = link.closest('li');
    if (!item_li || item_li.parentElement === menu_ul) {
      return false;
    }

    if (!item_li.id) {
      item_li.id = nav_destaques_id;
    }

    const referencia = nav_torrents.nextElementSibling;
    if (referencia) {
      menu_ul.insertBefore(item_li, referencia);
    } else {
      menu_ul.appendChild(item_li);
    }

    return true;
  }
  /* __TEST_EXPORT_END__ */

  function promover_destaques_com_log(doc) {
    log('--- tentativa de promoção ---');
    const menu_ul = doc.querySelector('#menudrop > ul');
    const nav_torrents = doc.querySelector('#nav_torrents');

    if (!menu_ul) {
      warn('ABORT: #menudrop > ul não encontrado');
      return false;
    }
    if (!nav_torrents) {
      warn('ABORT: #nav_torrents não encontrado');
      return false;
    }
    log('OK: menu_ul e nav_torrents encontrados');

    const ja_promovido = menu_ul.querySelector(
      ':scope > li#nav_destaques, :scope > li > a[href*="action=destaques"]'
    );
    if (ja_promovido) {
      log('SKIP: Destaques já está no nível principal =', ja_promovido);
      return false;
    }

    const link = nav_torrents.querySelector('a[href*="action=destaques"]');
    if (!link) {
      warn('ABORT: nenhum a[href*="action=destaques"] dentro de #nav_torrents');
      const alt = nav_torrents.querySelectorAll('a');
      log('hrefs disponíveis em #nav_torrents:');
      Array.prototype.forEach.call(alt, function (a, idx) {
        log('  [' + idx + ']', (a.textContent || '').trim(), '=>', a.getAttribute('href'));
      });
      return false;
    }
    log('OK: link Destaques encontrado =', link.href, '| texto =', (link.textContent || '').trim());

    const item_li = link.closest('li');
    if (!item_li) {
      warn('ABORT: link sem <li> ancestral');
      return false;
    }
    if (item_li.parentElement === menu_ul) {
      log('SKIP: <li> já é filho direto do ul principal');
      return false;
    }
    log('OK: <li> atual parent =', item_li.parentElement);

    const moved = promover_destaques(doc);
    if (moved) {
      log('SUCCESS: Destaques movido para o nível principal');
      log('novo parent =', item_li.parentElement);
      log('previousSibling id =', item_li.previousElementSibling && item_li.previousElementSibling.id);
      log('nextSibling id =', item_li.nextElementSibling && item_li.nextElementSibling.id);
    } else {
      warn('FAIL: promover_destaques retornou false (inesperado após checks)');
    }
    return moved;
  }

  function tentar_promover_com_retry() {
    let tentativas = 0;
    log('script iniciado | versão', SCRIPT_VERSION, '| retries =', MAX_TENTATIVAS, 'x', INTERVALO_MS + 'ms');
    log_diagnostico_menu(document);

    function tick() {
      tentativas += 1;
      log('retry', tentativas + '/' + MAX_TENTATIVAS);
      if (promover_destaques_com_log(document)) {
        log('finalizado com sucesso na tentativa', tentativas);
        return;
      }
      if (tentativas < MAX_TENTATIVAS) {
        setTimeout(tick, INTERVALO_MS);
      } else {
        warn('esgotaram as tentativas sem promover Destaques');
        log_diagnostico_menu(document);
      }
    }

    tick();
  }

  carregar_logs_persistidos();
  garantir_painel();
  render_painel();
  log('--- nova execução (logs anteriores restaurados do localStorage, se houver) ---');

  window.__BJ_DESTAQUES = {
    promover: function () {
      return promover_destaques_com_log(document);
    },
    diagnostico: function () {
      log_diagnostico_menu(document);
    },
    logs: function () {
      return log_buffer.slice();
    },
    limpar: function () {
      log_buffer.length = 0;
      persistir_logs();
      render_painel();
    },
    mostrar_painel: function () {
      const painel = garantir_painel();
      painel.style.display = 'flex';
      render_painel();
    },
  };
  log('helpers: __BJ_DESTAQUES.promover() | .diagnostico() | .logs() | .limpar() | .mostrar_painel()');

  if (document.readyState === 'loading') {
    log('aguardando DOMContentLoaded (readyState=loading)');
    document.addEventListener('DOMContentLoaded', tentar_promover_com_retry);
  } else {
    log('DOM já pronto (readyState=' + document.readyState + ')');
    tentar_promover_com_retry();
  }
})();

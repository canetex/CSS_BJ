// ==UserScript==
// @name         BJ - Promover Destaques no menu
// @namespace    https://github.com/canetex/CSS_BJ
// @version      1.1.0
// @description  Move apenas o item Destaques (submenu de Torrents) para o menu principal: HOME | TORRENTS | DESTAQUES | ...
// @author       canetex
// @match        *://*/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

/*
 * Top 5 (complexidade):
 * 1. promover_destaques — O(1) consultas DOM + O(1) move
 * 2. tentar_promover_com_retry — O(k) tentativas (k = MAX_TENTATIVAS)
 * 3. log_diagnostico_menu — O(n) nos links do menu
 *
 * Ajuste o @match para o domínio do tracker, ex.:
 * // @match  https://seu-tracker.com/*
 *
 * Abra o Console do navegador (F12) e filtre por: [BJ Destaques]
 */

(function () {
  'use strict';

  const MAX_TENTATIVAS = 20;
  const INTERVALO_MS = 250;
  const LOG_PREFIX = '[BJ Destaques]';

  function log() {
    const args = Array.prototype.slice.call(arguments);
    args.unshift(LOG_PREFIX);
    console.log.apply(console, args);
  }

  function warn() {
    const args = Array.prototype.slice.call(arguments);
    args.unshift(LOG_PREFIX);
    console.warn.apply(console, args);
  }

  /**
   * O(n) — dump diagnóstico do menu para o console.
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
      // O(n) itens do menu principal
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
      // O(n) links do submenu de Torrents
      const sub_items = Array.prototype.map.call(sub_links, function (a) {
        return {
          text: (a.textContent || '').trim(),
          href: a.getAttribute('href'),
        };
      });
      log('links dentro de #nav_torrents (' + sub_items.length + ') =', sub_items);
    }

    const by_href = doc.querySelectorAll('a[href*="destaques" i], a[href*="action=destaques"]');
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

    // Já está no nível principal
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

    // Insere imediatamente após Torrents no ul principal
    const referencia = nav_torrents.nextElementSibling;
    if (referencia) {
      menu_ul.insertBefore(item_li, referencia);
    } else {
      menu_ul.appendChild(item_li);
    }

    return true;
  }
  /* __TEST_EXPORT_END__ */

  /**
   * Versão com logs — usada em runtime (não no teste unitário).
   */
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
      // O(n)
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

  /**
   * O(k) — tenta até o menu existir (páginas com render atrasado).
   */
  function tentar_promover_com_retry() {
    let tentativas = 0;
    log('script iniciado | versão 1.1.0 | retries =', MAX_TENTATIVAS, 'x', INTERVALO_MS + 'ms');
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

  // Expõe helpers no console para inspeção manual
  window.__BJ_DESTAQUES = {
    promover: function () {
      return promover_destaques_com_log(document);
    },
    diagnostico: function () {
      log_diagnostico_menu(document);
    },
  };
  log('helpers no console: __BJ_DESTAQUES.promover() e __BJ_DESTAQUES.diagnostico()');

  if (document.readyState === 'loading') {
    log('aguardando DOMContentLoaded (readyState=loading)');
    document.addEventListener('DOMContentLoaded', tentar_promover_com_retry);
  } else {
    log('DOM já pronto (readyState=' + document.readyState + ')');
    tentar_promover_com_retry();
  }
})();

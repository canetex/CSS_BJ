// ==UserScript==
// @name         BJ - Promover Destaques no menu
// @namespace    https://github.com/canetex/CSS_BJ
// @version      1.0.0
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
 * 3. (restante trivial)
 *
 * Ajuste o @match para o domínio do tracker, ex.:
 * // @match  https://seu-tracker.com/*
 */

(function () {
  'use strict';

  const MAX_TENTATIVAS = 20;
  const INTERVALO_MS = 250;

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
   * O(k) — tenta até o menu existir (páginas com render atrasado).
   */
  function tentar_promover_com_retry() {
    let tentativas = 0;

    function tick() {
      tentativas += 1;
      if (promover_destaques(document)) {
        return;
      }
      if (tentativas < MAX_TENTATIVAS) {
        setTimeout(tick, INTERVALO_MS);
      }
    }

    tick();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tentar_promover_com_retry);
  } else {
    tentar_promover_com_retry();
  }
})();

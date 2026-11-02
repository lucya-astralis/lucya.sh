import { escHtml } from './utils.js';

export function initShelves(shelves, tabsEl, panelsEl) {
  // ---------- SHELVES : games / tv shows / films -----------------
  const filled = shelves.filter((s) => s.items.length);
  if (!filled.length) return;

  const tabs = new Map();
  const panels = new Map();

  const show = (id) => {
    tabs.forEach((tab, key) => {
      const on = key === id;
      tab.setAttribute('aria-selected', String(on));
      tab.tabIndex = on ? 0 : -1;
    });
    panels.forEach((panel, key) => { panel.hidden = key !== id; });
  };

  shelves.forEach((shelf) => {
    const empty = !shelf.items.length;
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.setAttribute('role', 'tab');
    tab.disabled = empty;
    tab.innerHTML = escHtml(shelf.label) + ' <span>' + (empty ? 'soon' : shelf.items.length) + '</span>';
    tabsEl.appendChild(tab);
    if (empty) return;

    tabs.set(shelf.id, tab);
    tab.addEventListener('click', () => show(shelf.id));

    const panel = document.createElement('ul');
    panel.className = 'posters';
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-label', shelf.label);
    panel.tabIndex = -1;
    shelf.items.forEach((item, i) => {
      const li = document.createElement('li');
      li.className = 'poster';
      li.style.setProperty('--i', i);
      li.title = item.title;   // the row cuts the long ones short
      li.innerHTML =
        '<img src="' + item.cover + '" alt="" width="170" height="256" loading="lazy" decoding="async" />' +
        '<span class="poster__title">' + escHtml(item.title) + '</span>';
      panel.appendChild(li);
    });
    panels.set(shelf.id, panel);
    panelsEl.appendChild(panel);
  });

  // arrow keys walk the tabs, as a tablist promises
  tabsEl.addEventListener('keydown', (e) => {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    if (!step) return;
    const keys = [...tabs.keys()];
    const at = keys.findIndex((key) => tabs.get(key) === document.activeElement);
    const next = keys[(at + step + keys.length) % keys.length];
    show(next);
    tabs.get(next).focus();
  });

  show(filled[0].id);
}

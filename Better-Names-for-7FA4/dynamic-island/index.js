(function () {
  'use strict';

  const MENU_SELECTOR = '.ui.fixed.borderless.menu';
  const ROOT_ID = 'bn-dynamic-island-root';
  const BACKDROP_ID = 'bn-dynamic-island-backdrop';
  const CARD_ID = 'bn-dynamic-island-card';
  const CAPSULE_ID = 'bn-dynamic-island-capsule';
  const LEFT_ID = 'bn-dynamic-island-left';
  const RIGHT_ID = 'bn-dynamic-island-right';

  function qs(selector, root = document) {
    try {
      return root.querySelector(selector);
    } catch (err) {
      return null;
    }
  }

  function appendStyle() {
    if (qs('link[data-bn-dynamic-island]')) return;
    const styleLink = document.createElement('link');
    styleLink.rel = 'stylesheet';
    styleLink.dataset.bnDynamicIsland = 'true';
    const runtime = (typeof chrome !== 'undefined' && chrome && chrome.runtime)
      ? chrome.runtime
      : (typeof browser !== 'undefined' && browser && browser.runtime)
        ? browser.runtime
        : null;
    styleLink.href = runtime ? runtime.getURL('dynamic-island/style.css') : 'dynamic-island/style.css';
    (document.head || document.documentElement).appendChild(styleLink);
  }

  function createCapsule() {
    const button = document.createElement('button');
    button.type = 'button';
    button.id = CAPSULE_ID;
    button.innerHTML = '<span class="bn-di-indicator" aria-hidden="true"></span>' +
      '<span class="bn-di-label">灵动岛</span>';
    button.setAttribute('aria-haspopup', 'dialog');
    button.setAttribute('aria-controls', CARD_ID);
    button.setAttribute('aria-expanded', 'false');
    return button;
  }

  function createCard() {
    const card = document.createElement('div');
    card.id = CARD_ID;
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-modal', 'true');
    card.setAttribute('aria-labelledby', 'bn-dynamic-island-title');
    card.tabIndex = -1;

    const title = document.createElement('h3');
    title.id = 'bn-dynamic-island-title';
    title.textContent = '灵动岛';

    const description = document.createElement('p');
    description.textContent = '这里将展示灵动岛的更多内容与快捷入口。当前版本仅实现基础交互，功能即将上线。';

    const actions = document.createElement('div');
    actions.className = 'bn-di-actions';

    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'bn-di-close';
    closeButton.textContent = '收起';
    closeButton.addEventListener('click', () => {
      toggleCard(false);
    });

    actions.appendChild(closeButton);

    card.appendChild(title);
    card.appendChild(description);
    card.appendChild(actions);

    return { card, closeButton };
  }

  function createBackdrop() {
    const backdrop = document.createElement('div');
    backdrop.id = BACKDROP_ID;
    backdrop.setAttribute('role', 'presentation');
    backdrop.addEventListener('click', () => {
      toggleCard(false);
    });
    return backdrop;
  }

  let capsuleElement = null;
  let cardElement = null;
  let backdropElement = null;
  let observer = null;

  function toggleCard(visible) {
    if (!capsuleElement || !cardElement || !backdropElement) return;
    if (visible) {
      capsuleElement.style.display = 'none';
      cardElement.classList.add('bn-di-visible');
      backdropElement.classList.add('bn-di-visible');
      try {
        cardElement.focus({ preventScroll: true });
      } catch (err) {
        // ignore focus errors
      }
      capsuleElement.setAttribute('aria-expanded', 'true');
      document.body.classList.add('bn-di-card-open');
      document.addEventListener('keydown', handleKeydown, true);
    } else {
      capsuleElement.style.display = '';
      cardElement.classList.remove('bn-di-visible');
      backdropElement.classList.remove('bn-di-visible');
      capsuleElement.setAttribute('aria-expanded', 'false');
      document.body.classList.remove('bn-di-card-open');
      document.removeEventListener('keydown', handleKeydown, true);
      requestAnimationFrame(() => {
        try {
          capsuleElement.focus({ preventScroll: true });
        } catch (err) {
          // ignore focus errors
        }
      });
    }
  }

  function handleKeydown(event) {
    if (event.key === 'Escape') {
      event.stopPropagation();
      event.preventDefault();
      toggleCard(false);
    }
  }

  function handleCapsuleClick(event) {
    event.preventDefault();
    toggleCard(true);
  }

  function setupDynamicIsland() {
    if (qs(`#${ROOT_ID}`)) return true;
    const menu = qs(MENU_SELECTOR);
    if (!menu) return false;

    appendStyle();

    const container = qs('.ui.container', menu);
    if (!container) return false;

    const root = document.createElement('div');
    root.id = ROOT_ID;
    root.setAttribute('role', 'presentation');

    let leftZone = qs(`#${LEFT_ID}`, container);
    let rightZone = qs(`#${RIGHT_ID}`, container);

    const elements = [];

    function harvestChildren(source) {
      if (!source) return;
      let child = source.firstElementChild;
      while (child) {
        const next = child.nextElementSibling;
        elements.push(child);
        source.removeChild(child);
        child = next;
      }
    }

    harvestChildren(leftZone);
    harvestChildren(rightZone);

    if (leftZone && leftZone.parentNode === container) {
      container.removeChild(leftZone);
    }

    if (rightZone && rightZone.parentNode === container) {
      container.removeChild(rightZone);
    }

    if (!leftZone) {
      leftZone = document.createElement('div');
    }
    leftZone.id = LEFT_ID;
    leftZone.className = 'bn-di-zone bn-di-zone-left';

    if (!rightZone) {
      rightZone = document.createElement('div');
    }
    rightZone.id = RIGHT_ID;
    rightZone.className = 'bn-di-zone bn-di-zone-right';

    const existingBackdrop = qs(`#${BACKDROP_ID}`);
    if (existingBackdrop && existingBackdrop.parentNode) {
      existingBackdrop.parentNode.removeChild(existingBackdrop);
    }

    const existingCard = qs(`#${CARD_ID}`);
    if (existingCard && existingCard.parentNode) {
      existingCard.parentNode.removeChild(existingCard);
    }

    capsuleElement = createCapsule();
    capsuleElement.addEventListener('click', handleCapsuleClick);

    const { card, closeButton } = createCard();
    cardElement = card;

    backdropElement = createBackdrop();

    document.body.appendChild(backdropElement);
    document.body.appendChild(cardElement);

    root.appendChild(capsuleElement);

    const leftPaths = new Set(['/', '/problems/exercises', '/contests']);

    Array.from(container.children).forEach((child) => {
      if (!child || child === root || child === leftZone || child === rightZone) return;
      if (child.nodeType !== Node.ELEMENT_NODE) return;
      elements.push(child);
    });

    elements.forEach((element) => {
      if (!element.parentNode) return;
      element.parentNode.removeChild(element);
    });

    container.appendChild(leftZone);
    container.appendChild(root);
    container.appendChild(rightZone);

    const leftElements = [];
    const rightElements = [];

    elements.forEach((element) => {
      if (!element.classList) {
        rightElements.push(element);
        return;
      }

      if (element.classList.contains('header') && element.classList.contains('item')) {
        leftElements.push(element);
        return;
      }

      if (element.classList.contains('menu') && element.classList.contains('right')) {
        rightElements.push(element);
        return;
      }

      if (element.matches('a.item')) {
        const rawHref = element.getAttribute('href') || '';
        const normalizedHref = rawHref.replace(/^[^#?]*:\/\/[^/]+/i, '');
        let path = normalizedHref.split('?')[0] || '';
        if (path.length > 1 && path.endsWith('/')) {
          path = path.slice(0, -1);
        }
        if (leftPaths.has(path)) {
          leftElements.push(element);
        } else {
          rightElements.push(element);
        }
        return;
      }

      rightElements.push(element);
    });

    leftElements.forEach((element) => {
      leftZone.appendChild(element);
    });

    rightElements.forEach((element) => {
      rightZone.appendChild(element);
    });

    // Move card focus target to first interactive element when shown.
    cardElement.addEventListener('transitionend', (event) => {
      if (event.propertyName === 'opacity' && cardElement.classList.contains('bn-di-visible')) {
        try {
          closeButton.focus({ preventScroll: true });
        } catch (err) {
          // ignore focus errors
        }
      }
    });

    return true;
  }

  function ensureDynamicIsland() {
    if (setupDynamicIsland()) {
      if (observer) {
        observer.disconnect();
        observer = null;
      }
      return;
    }
    if (!observer) {
      observer = new MutationObserver(() => {
        if (setupDynamicIsland() && observer) {
          observer.disconnect();
          observer = null;
        }
      });
      observer.observe(document.documentElement, { childList: true, subtree: true });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensureDynamicIsland, { once: true });
  } else {
    ensureDynamicIsland();
  }

  window.addEventListener('load', ensureDynamicIsland, { once: true });
})();

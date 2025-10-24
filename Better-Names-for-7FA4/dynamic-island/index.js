(function () {
  'use strict';

  const MENU_SELECTOR = '.ui.fixed.borderless.menu';
  const ROOT_ID = 'bn-dynamic-island-root';
  const BACKDROP_ID = 'bn-dynamic-island-backdrop';
  const CARD_ID = 'bn-dynamic-island-card';
  const CAPSULE_ID = 'bn-dynamic-island-capsule';

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

  function restructureMenu(menu) {
    const container = qs('.ui.container', menu);
    if (!container) return null;

    const existingLayout = qs('#bn-di-menu-layout', container);
    if (existingLayout) {
      const center = qs('#bn-di-menu-center', existingLayout) || null;
      const leftWrapExisting = qs('#bn-di-menu-left', existingLayout);
      const rightWrapExisting = qs('#bn-di-menu-right', existingLayout);
      if (leftWrapExisting && rightWrapExisting) {
        const strayElements = Array.from(container.children).filter((child) => child && child !== existingLayout);
        strayElements.forEach((child) => {
          const classList = child.classList || { contains: () => false };
          if (classList.contains('right') && classList.contains('menu')) {
            rightWrapExisting.appendChild(child);
          } else {
            leftWrapExisting.appendChild(child);
          }
        });
        Array.from(container.childNodes).forEach((node) => {
          if (node.nodeType === Node.TEXT_NODE && !node.textContent.trim()) {
            container.removeChild(node);
          }
        });
      }
      return center;
    }

    const layout = document.createElement('div');
    layout.id = 'bn-di-menu-layout';
    layout.className = 'bn-di-menu-layout';

    const leftWrap = document.createElement('div');
    leftWrap.id = 'bn-di-menu-left';
    leftWrap.className = 'bn-di-menu-left';

    const centerWrap = document.createElement('div');
    centerWrap.id = 'bn-di-menu-center';
    centerWrap.className = 'bn-di-menu-center';

    const rightWrap = document.createElement('div');
    rightWrap.id = 'bn-di-menu-right';
    rightWrap.className = 'bn-di-menu-right';

    const childElements = Array.from(container.children);
    childElements.forEach((child) => {
      if (!child) return;
      const classList = child.classList || { contains: () => false };
      if (classList.contains('right') && classList.contains('menu')) {
        rightWrap.appendChild(child);
      } else {
        leftWrap.appendChild(child);
      }
    });

    layout.appendChild(leftWrap);
    layout.appendChild(centerWrap);
    layout.appendChild(rightWrap);

    container.appendChild(layout);

    Array.from(container.childNodes).forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE && !node.textContent.trim()) {
        container.removeChild(node);
      }
    });

    return centerWrap;
  }

  function setupDynamicIsland() {
    if (qs(`#${ROOT_ID}`)) return true;
    const menu = qs(MENU_SELECTOR);
    if (!menu) return false;

    appendStyle();

    const centerWrap = restructureMenu(menu);
    if (!centerWrap) return false;

    const root = document.createElement('div');
    root.id = ROOT_ID;
    root.setAttribute('role', 'presentation');

    capsuleElement = createCapsule();
    capsuleElement.addEventListener('click', handleCapsuleClick);

    const { card, closeButton } = createCard();
    cardElement = card;

    backdropElement = createBackdrop();

    document.body.appendChild(backdropElement);
    document.body.appendChild(cardElement);

    root.appendChild(capsuleElement);
    centerWrap.appendChild(root);

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

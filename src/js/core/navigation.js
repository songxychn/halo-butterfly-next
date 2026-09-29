import { isCurrentMenuLink } from './navigation-state.mjs';

/** Site navigation uses disclosure buttons; its links keep native navigation. */
export default class Navigation {
  constructor() {
    const instanceKey = Symbol.for('halo-butterfly-next.navigation');
    if (document[instanceKey]) return document[instanceKey];
    if (!document.querySelector('.nav')) return;
    document[instanceKey] = this;
    this.drawer = document.getElementById('mobile-navigation');
    this.toggle = document.querySelector('.nav .bars');
    this.open = false;
    this.disclosures = [];
    this.background = new Map();

    this.markCurrentLinks();

    document.querySelectorAll('.menu-toggle').forEach(button => {
      const panel = document.getElementById(button.getAttribute('aria-controls'));
      if (!panel) return;
      const item = button.parentElement;
      const position = () => {
        if (panel.hidden || !item.parentElement.matches('.nav .menu')) return;
        panel.style.transform = '';
        const bounds = panel.getBoundingClientRect();
        const shift = bounds.left < 8 ? 8 - bounds.left :
          bounds.right > window.innerWidth - 8 ? window.innerWidth - 8 - bounds.right : 0;
        if (shift) panel.style.transform = `translateX(${shift}px)`;
      };
      const setOpen = expanded => {
        button.setAttribute('aria-expanded', String(expanded));
        panel.hidden = !expanded;
        item.classList.toggle('active', expanded);
        if (expanded) position();
        if (!expanded) {
          this.disclosures.forEach(disclosure => {
            if (panel.contains(disclosure.button)) disclosure.close();
          });
        }
      };
      const isOpen = () => button.getAttribute('aria-expanded') === 'true';
      const close = () => setOpen(false);
      const reset = () => setOpen(button.dataset.defaultExpanded === 'true');
      this.disclosures.push({button, close, reset, position});
      reset();
      button.addEventListener('click', () => setOpen(!isOpen()));
      item.addEventListener('keydown', event => {
        if (event.key === 'Escape' && isOpen()) {
          event.preventDefault();
          event.stopPropagation();
          close();
          button.focus({preventScroll: true});
        }
      });
      item.addEventListener('focusout', event => {
        if (item.closest('.nav') && !item.contains(event.relatedTarget)) close();
      });
      // Pointer events preserve desktop hover without making keyboard Escape
      // immediately reopen a panel under the stationary pointer.
      if (item.closest('.nav')) {
        item.addEventListener('pointerenter', event => {
          if (event.pointerType === 'mouse') setOpen(true);
        });
        item.addEventListener('pointerleave', () => {
          if (!item.contains(document.activeElement)) close();
        });
      }
    });

    if (!this.drawer || !this.toggle) return;
    this.mask = document.querySelector('#Butterfly > .mask');
    if (!this.mask) {
      this.mask = document.createElement('div');
      this.mask.className = 'mask';
      document.getElementById('Butterfly').append(this.mask);
    }
    this.mask.setAttribute('aria-hidden', 'true');
    this.mask.hidden = true;
    this.toggle.addEventListener('click', () => this.open ? this.closeDrawer() : this.openDrawer());
    this.drawer.querySelector('.side-bar-close').addEventListener('click', () => this.closeDrawer());
    this.mask.addEventListener('click', () => this.closeDrawer());
    document.addEventListener('keydown', event => {
      if (!this.open) {
        if (event.key === 'Escape') this.disclosures.forEach(({close}) => close());
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        this.closeDrawer();
      } else if (event.key === 'Tab') {
        const targets = this.focusable();
        const first = targets[0] || this.drawer;
        const last = targets.at(-1) || this.drawer;
        if (!this.drawer.contains(document.activeElement) || document.activeElement === this.drawer ||
            (event.shiftKey && document.activeElement === first) ||
            (!event.shiftKey && document.activeElement === last)) {
          event.preventDefault();
          (event.shiftKey ? last : first).focus({preventScroll: true});
        }
      }
    });
    document.addEventListener('focusin', event => {
      if (event.target !== document.body) this.lastFocusedElement = event.target;
      if (this.open && !this.drawer.contains(event.target)) {
        (this.focusable()[0] || this.drawer).focus({preventScroll: true});
      }
    });
    this.mobile = window.matchMedia('(max-width: 768px)');
    const updateLayout = () => {
      const nav = document.querySelector('.nav');
      const menu = nav.querySelector('.menu');
      const wasDrawerLayout = this.drawerLayout;
      nav.classList.remove('menu-overflow');
      const available = nav.clientWidth - parseFloat(getComputedStyle(nav).paddingLeft) -
        parseFloat(getComputedStyle(nav).paddingRight) - Math.min(160, nav.clientWidth * .25) -
        nav.querySelector('.controls').getBoundingClientRect().width;
      const overflow = !this.mobile.matches && menu.getBoundingClientRect().width > available;
      nav.classList.toggle('menu-overflow', overflow);
      this.drawerLayout = this.mobile.matches || overflow;
      this.disclosures.forEach(({position}) => position());
      if (wasDrawerLayout === this.drawerLayout) return;
      if (this.drawerLayout) {
        const desktopMenu = document.querySelector('.nav .menu');
        // Chromium can blur a now display:none child before the media event.
        const focusWasInDesktopMenu = desktopMenu?.contains(document.activeElement) ||
          (document.activeElement === document.body && desktopMenu?.contains(this.lastFocusedElement));
        this.disclosures.forEach(({button, close}) => {
          if (button.closest('.nav')) close();
        });
        if (focusWasInDesktopMenu) this.toggle.focus({preventScroll: true});
      } else if (this.open) {
        this.closeDrawer(true);
      } else if (document.activeElement === this.toggle ||
          (document.activeElement === document.body && this.lastFocusedElement === this.toggle)) {
        document.querySelector('.nav-title a')?.focus({preventScroll: true});
      }
    };
    this.mobile.addEventListener('change', updateLayout);
    window.addEventListener('resize', updateLayout);
    window.addEventListener('load', updateLayout);
    // Theme CSS can finish after the controller runs. Observe layout boxes so
    // an early unstyled measurement cannot leave normal menus in drawer mode.
    this.layoutObserver = new ResizeObserver(updateLayout);
    this.layoutObserver.observe(document.querySelector('.nav'));
    this.layoutObserver.observe(document.querySelector('.nav .menu'));
    document.fonts?.ready.then(updateLayout);
    updateLayout();
  }

  markCurrentLinks() {
    document.querySelectorAll('.nav .menu a[href], #mobile-navigation .bar a[href]').forEach(link => {
      if (!isCurrentMenuLink(link.getAttribute('href'), window.location.href)) return;
      link.setAttribute('aria-current', 'page');
      for (let item = link.closest('li'); item; item = item.parentElement?.closest('li')) {
        item.classList.add('current');
      }
    });
  }

  focusable() {
    return Array.from(this.drawer.querySelectorAll('a[href], button, input, select, textarea, [tabindex]'))
      .filter(element => element.tabIndex >= 0 && !element.disabled &&
        !element.closest('[hidden], [inert]') && element.getClientRects().length > 0 &&
        getComputedStyle(element).visibility !== 'hidden');
  }

  openDrawer() {
    if (this.open || !this.drawerLayout) return;
    this.open = true;
    this.previousOverflow = ['overflow-x', 'overflow-y'].map(property => ({
      property, value: document.body.style.getPropertyValue(property),
      priority: document.body.style.getPropertyPriority(property),
    }));
    document.body.style.setProperty('overflow', 'hidden');
    this.disclosures.forEach(({button, reset}) => {
      if (this.drawer.contains(button)) reset();
    });
    this.drawer.hidden = false;
    this.drawer.inert = false;
    this.drawer.classList.add('active');
    this.toggle.setAttribute('aria-expanded', 'true');
    this.mask.hidden = false;
    this.mask.style.display = 'block';
    // Preserve pre-existing inert values, including nested layout wrappers.
    for (let branch = this.drawer; branch.parentElement; branch = branch.parentElement) {
      for (const sibling of branch.parentElement.children) {
        if (sibling === branch || sibling === this.mask) continue;
        this.background.set(sibling, sibling.inert);
        sibling.inert = true;
      }
      if (branch.parentElement === document.body) break;
    }
    (this.focusable()[0] || this.drawer).focus({preventScroll: true});
  }

  closeDrawer(desktop = false) {
    if (!this.open) return;
    this.open = false;
    this.disclosures.forEach(({button, close}) => {
      if (this.drawer.contains(button)) close();
    });
    this.drawer.classList.remove('active');
    this.drawer.inert = true;
    this.drawer.hidden = true;
    this.toggle.setAttribute('aria-expanded', 'false');
    this.mask.hidden = true;
    this.mask.style.display = 'none';
    this.background.forEach((value, element) => { element.inert = value; });
    this.background.clear();
    document.body.style.removeProperty('overflow');
    this.previousOverflow.forEach(({property, value, priority}) => {
      if (value) document.body.style.setProperty(property, value, priority);
    });
    const destination = desktop ? document.querySelector('.nav-title a') : this.toggle;
    destination?.focus({preventScroll: true});
  }
}

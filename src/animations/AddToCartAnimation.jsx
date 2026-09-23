// Shared utility to animate the actual product image flying to the cart button
// Usage: animateAddToCart(startElementOrRect, imageSrc)
// - If startElementOrRect is an element, the first <img> inside it is cloned to preserve aspect ratio.
// - Otherwise, a temporary <img> is created using imageSrc.

export function animateAddToCart(startElOrRect, imageSrc) {
  try {
    const cartEl = document.getElementById('global-cart-button');
    if (!cartEl) return;

    const startRect = (
      startElOrRect && typeof startElOrRect.getBoundingClientRect === 'function'
        ? startElOrRect.getBoundingClientRect()
        : startElOrRect
    );
    if (!startRect) return;

    // Try to clone the real image inside the start element for authenticity
    let clone;
    if (startElOrRect && typeof startElOrRect.querySelector === 'function') {
      const imgEl = startElOrRect.querySelector('img');
      if (imgEl) {
        clone = imgEl.cloneNode(true);
        clone.removeAttribute('id');
      }
    }
    if (!clone) {
      clone = document.createElement('img');
      clone.src = imageSrc || '';
    }
    clone.alt = 'flying-product';

    // Initial size tries to maintain aspect ratio similar to the source
    const baseW = Math.max(64, Math.min(140, Math.floor(startRect.width)));
    const baseH = Math.max(64, Math.min(140, Math.floor(startRect.height)));
    clone.style.position = 'fixed';
    clone.style.left = `${startRect.left + startRect.width / 2 - baseW / 2}px`;
    clone.style.top = `${startRect.top + startRect.height / 2 - baseH / 2}px`;
    clone.style.width = `${baseW}px`;
    clone.style.height = `${baseH}px`;
    clone.style.borderRadius = '8px';
    clone.style.objectFit = 'cover';
    clone.style.boxShadow = '0 10px 24px rgba(0,0,0,0.25)';
    clone.style.zIndex = '20000';
    clone.style.pointerEvents = 'none';
    clone.style.willChange = 'transform, opacity';
    document.body.appendChild(clone);

    // Compute a curved (quadratic Bezier) path from start to cart center
    const startX = startRect.left + startRect.width / 2;
    const startY = startRect.top + startRect.height / 2;
    const endRect = cartEl.getBoundingClientRect();
    const endX = endRect.left + endRect.width / 2;
    const endY = endRect.top + endRect.height / 2;
    // Control point above the straight line for a nice arc
    const ctrlX = (startX + endX) / 2;
    const ctrlY = Math.min(startY, endY) - Math.max(90, Math.abs(endX - startX) * 0.15);

    const duration = 900;
    const startTime = performance.now();

    const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
    const lerp = (a, b, t) => a + (b - a) * t;
    const quadBezier = (p0, p1, p2, t) => lerp(lerp(p0, p1, t), lerp(p1, p2, t), t);

    let rafId = 0;
    const step = (now) => {
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / duration);
      const te = easeOutCubic(t);

      const curX = quadBezier(startX, ctrlX, endX, te);
      const curY = quadBezier(startY, ctrlY, endY, te);
      const scale = lerp(1, 0.45, te);
      const rotate = lerp(0, 18, te); // slight rotation for realism

      clone.style.transform = `translate(${curX - (startRect.left + startRect.width / 2)}px, ${curY - (startRect.top + startRect.height / 2)}px) scale(${scale}) rotate(${rotate}deg)`;
      clone.style.opacity = String(lerp(1, 0.65, te));

      if (t < 1) {
        rafId = requestAnimationFrame(step);
      } else {
        // Bounce the cart
        cartEl.classList.add('cart-bounce');
        window.setTimeout(() => cartEl.classList.remove('cart-bounce'), 450);
        // Clean up
        if (clone && clone.parentNode) clone.parentNode.removeChild(clone);
        if (rafId) cancelAnimationFrame(rafId);
      }
    };

    rafId = requestAnimationFrame(step);
  } catch (_) {
    // no-op on animation errors
  }
}

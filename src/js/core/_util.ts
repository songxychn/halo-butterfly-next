/** Core shared browser helpers. */

export function useThrottle<This, Args extends unknown[]>(
  func: (this: This, ...args: Args) => unknown,
  wait: number,
  options: { leading?: boolean; trailing?: boolean } = {},
) {
  let timeOut: ReturnType<typeof setTimeout> | undefined;
  let context: This | undefined;
  let args: Args | undefined;
  let previous = 0;

  const later = function () {
    previous = options.leading === false ? 0 : Date.now();
    timeOut = undefined;
    func.apply(context as This, args!);
    context = undefined;
    args = undefined;
  };

  return function (this: This, ...callArgs: Args) {
    const now = Date.now();
    if (!previous && options.leading === false) previous = now;
    const remaining = wait - (now - previous);
    context = this;
    args = callArgs;
    if (remaining <= 0 || remaining > wait) {
      if (timeOut) {
        clearTimeout(timeOut);
        timeOut = undefined;
      }
      previous = now;
      func.apply(context as This, args!);
      if (!timeOut) {
        context = undefined;
        args = undefined;
      }
    } else if (!timeOut && options.leading !== false) {
      timeOut = setTimeout(later, remaining);
    }
  };
}

export function useToBool(value: unknown): boolean {
  return value === true || value === 'true';
}

export function useDelay(time: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, time));
}

export function useClearPage() {
  window.addEventListener('load', () => {
    for (const script of document.querySelectorAll('script')) {
      if (script.id.includes('Script') && !script.hasAttribute('data-theme-script')) script.remove();
    }
  });
}

export function getQueryParams(search = window.location.search): Record<string, string> | null {
  if (!search) return null;
  const params: Record<string, string> = {};
  for (const [key, value] of new URLSearchParams(search)) {
    params[key] = value;
  }
  return params;
}

/** Copy plain text via Clipboard API with textarea fallback for non-secure contexts. */
export async function copyText(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {}
  }
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
  document.body.appendChild(area);
  area.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  area.remove();
  return ok;
}

/** Halo console shortcut. Permission names match the console's Posts/PostEditor routes. */
export const POST_EDIT_PERMISSIONS_URL = '/apis/api.console.halo.run/v1alpha1/users/-/permissions';

export function canEditPosts(payload: unknown): boolean {
  if (!payload || typeof payload !== 'object') return false;
  const permissions = (payload as {uiPermissions?: unknown}).uiPermissions;
  if (!Array.isArray(permissions) || !permissions.every(value => typeof value === 'string')) return false;
  return permissions.includes('*') ||
    (permissions.includes('system:posts:view') && permissions.includes('system:posts:manage'));
}

const initialized = new WeakSet<HTMLTemplateElement>();

/** No template is emitted for anonymous users or when the setting is off. Fail closed. */
export async function initializePostEdit(root: ParentNode = document, request: typeof fetch = fetch): Promise<void> {
  const templates = [...root.querySelectorAll<HTMLTemplateElement>('template[data-post-edit]')]
    .filter(template => !initialized.has(template));
  if (!templates.length) return;
  templates.forEach(template => initialized.add(template));

  const controller = new AbortController();

  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await request(POST_EDIT_PERMISSIONS_URL, {
      credentials: 'same-origin', cache: 'no-store', redirect: 'error', signal: controller.signal,
      headers: {Accept: 'application/json'},
    });
    if (!response.ok || !canEditPosts(await response.json())) return;
    for (const template of templates) {
      const target = template.closest('.post-meta')?.querySelector('[data-post-edit-target]');
      if (target && template.isConnected) target.append(template.content.cloneNode(true));
    }
  } catch {
    // An expired session, unavailable API or timeout leaves the shortcut absent.
  } finally {
    clearTimeout(timeout);
    templates.forEach(template => template.remove());
  }
}

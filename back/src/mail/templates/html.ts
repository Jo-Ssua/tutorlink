const ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Escapa el contenido que viene del usuario antes de interpolarlo en el HTML. */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ENTITIES[character] ?? character);
}

/** Envoltura comun: una tarjeta centrada con estilos en linea (los clientes de correo ignoran <style>). */
export function layout(title: string, body: string): string {
  return [
    '<!doctype html>',
    '<html lang="es">',
    '<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />',
    `<title>${escapeHtml(title)}</title></head>`,
    '<body style="margin:0;padding:24px;background:#f4f5f7;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#1f2430;">',
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">',
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px;padding:32px;">',
    '<tr><td>',
    '<p style="margin:0 0 24px;font-size:18px;font-weight:700;letter-spacing:-0.01em;">TutorLink</p>',
    body,
    '<p style="margin:32px 0 0;font-size:12px;color:#6b7280;">Tutorias universitarias entre pares. Si no solicitaste este correo, puedes ignorarlo.</p>',
    '</td></tr></table>',
    '</td></tr></table>',
    '</body></html>',
  ].join('');
}

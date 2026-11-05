/**
 * Sincroniza el modo claro/oscuro con la preferencia del sistema.
 *
 * HeroUI solo cambia de modo con `data-theme` en el `<html>`: no mira
 * `prefers-color-scheme` por su cuenta. Sin esto, los tokens oscuros de
 * `theme.css` no se aplicarían nunca, por más que el sistema esté en oscuro.
 */
export function followSystemTheme(): void {
  const query = window.matchMedia('(prefers-color-scheme: dark)');

  const apply = (prefersDark: boolean) => {
    document.documentElement.dataset.theme = prefersDark ? 'dark' : 'light';
  };

  apply(query.matches);
  query.addEventListener('change', (event) => apply(event.matches));
}

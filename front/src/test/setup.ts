import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterEach } from 'vitest';

/*
 * El segundo por defecto de `findBy*` se queda corto: la primera prueba de cada
 * archivo paga la transformación de `@heroui/react`, que son varios segundos, y
 * cualquier espera por un cambio de ruta caía por tiempo según cómo estuviera
 * de cargada la máquina. No es lentitud de la aplicación, así que el margen va
 * aquí y no en cada `findBy`.
 */
configure({ asyncUtilTimeout: 10_000 });

afterEach(() => {
  cleanup();
});

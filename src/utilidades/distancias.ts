import type { Coordenadas } from '../tipos/lugar';

export function calcularDistanciaMetros(
  origen: Coordenadas,
  destino: Coordenadas
): number {
  const radianes = (grados: number) =>
    grados * Math.PI / 180;

  const latitud1 = radianes(origen.latitud);
  const latitud2 = radianes(destino.latitud);

  const diferenciaLatitud = radianes(
    destino.latitud - origen.latitud
  );

  const diferenciaLongitud = radianes(
    destino.longitud - origen.longitud
  );

  const calculo =
    Math.sin(diferenciaLatitud / 2) ** 2 +
    Math.cos(latitud1) *
      Math.cos(latitud2) *
      Math.sin(diferenciaLongitud / 2) ** 2;

  const limitado = Math.min(1, Math.max(0, calculo));

  return 6371000 * 2 * Math.atan2(
    Math.sqrt(limitado),
    Math.sqrt(1 - limitado)
  );
}

export function mostrarDistancia(metros: number): string {
  if (metros < 1000) {
    return `${Math.round(metros)} m`;
  }

  return `${(metros / 1000).toLocaleString('es-AR', {
    maximumFractionDigits: 1,
  })} km`;
}
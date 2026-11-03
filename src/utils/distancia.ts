import { Coordenadas } from "../tipos";

const RADIO_TIERRA_METROS = 6371000;

function aRadianes(grados: number): number {
  return (grados * Math.PI) / 180;
}


export function distanciaEnMetros(a: Coordenadas, b: Coordenadas): number {
  const dLat = aRadianes(b.latitud - a.latitud);
  const dLon = aRadianes(b.longitud - a.longitud);
  const lat1 = aRadianes(a.latitud);
  const lat2 = aRadianes(b.latitud);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

  return 2 * RADIO_TIERRA_METROS * Math.asin(Math.sqrt(h));
}

export function formatearDistancia(metros: number): string {
  if (metros < 1000) return `${Math.round(metros)} m`;
  return `${(metros / 1000).toFixed(1).replace(".", ",")} km`;
}
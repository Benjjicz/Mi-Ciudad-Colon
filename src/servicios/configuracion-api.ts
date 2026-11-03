// EXPO_PUBLIC_API_URL es pública: nunca poner contraseñas o tokens aquí.
export const API_BASE_URL = (
  process.env.EXPO_PUBLIC_API_URL ?? 'http://192.168.0.226:3000'
).trim().replace(/\/+$/, '');

import type { RespuestaLista } from './api';
// Las pantallas de agenda/lugares importan desde este índice.
// Se reutilizan los tipos del contrato: no se duplican las entidades.
export type { Coordenadas, Horario, Audioguia, Lugar } from './lugar';
export type { Categoria } from './categoria';
export type { Evento, EstadoEvento } from './evento';

export type MetaPaginado = RespuestaLista<unknown>['meta'];
export interface ErrorApi { codigo: string; mensaje: string; }
export interface RespuestaExito<T> { datos: T; meta?: MetaPaginado | null; }
export interface RespuestaError { error: ErrorApi; }
export type Respuesta<T> = RespuestaExito<T> | RespuestaError;

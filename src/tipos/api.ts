export interface RespuestaLista<T> {
  datos: T[];
  meta: {
    total: number;
    pagina: number;
    porPagina: number;
  };
}
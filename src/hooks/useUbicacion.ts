import { useState, useEffect } from "react";
import * as Location from "expo-location";
import { Coordenadas } from "../tipos";

export type EstadoPermiso = "pendiente" | "concedido" | "denegado";

export function useUbicacion() {
  const [coordenadas, setCoordenadas] = useState<Coordenadas | null>(null);
  const [permiso, setPermiso] = useState<EstadoPermiso>("pendiente");

  useEffect(() => {
    let activo = true;

    async function obtener() {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (!activo) return;

        if (status !== "granted") {
          setPermiso("denegado");
          return;
        }

        const posicion = await Location.getCurrentPositionAsync({});
        if (!activo) return;

        setCoordenadas({
          latitud: posicion.coords.latitude,
          longitud: posicion.coords.longitude,
        });
        setPermiso("concedido");
      } catch {
        
        if (activo) setPermiso("denegado");
      }
    }

    obtener();

    return () => {
      activo = false;
    };
  }, []);

  return { coordenadas, permiso };
}
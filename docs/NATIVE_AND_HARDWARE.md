# Capacidades que requieren app nativa, hardware o mapas

La web no simula nada de lo siguiente: si falta la capacidad, la UI lo dice y ofrece la alternativa manual.

| Capacidad | Web actual | Requiere |
|---|---|---|
| GPS al guardar estacionamiento | Sí (`navigator.geolocation`, solo al pulsar) | — |
| Ubicación en segundo plano / detección automática de estacionado | No | App nativa (iOS/Android) con permisos de background |
| Navegación modo A (básica: nivel, zona, fila, plaza, referencia, foto) | Sí | — |
| Navegación modo B (ruta por plano interior) | Sí, si el edificio tiene mapa publicado | Mapa del edificio levantado y cargado en el editor admin |
| Navegación modo C (pasos, brújula, barómetro, giroscopio) | No (el backend ya acepta estimaciones en `/sensors` y las limita por confianza) | App nativa que lea sensores y envíe estimaciones |
| Realidad aumentada con cámara | No | App nativa (ARKit/ARCore) + mapas con anclas calibradas |
| Balizas BLE / Wi-Fi RTT | No | Hardware instalado en el edificio + app nativa |
| Rastreo en vivo del vehículo | Sí, si un dispositivo envía datos | GPS tracker/OBD que haga `POST /tracking/ingest` con su token (o integración con el proveedor del tracker) |
| Notificaciones push | No | FCM/APNs + app nativa o service worker |

## Mapas interiores

Un mapa útil necesita, por nivel: nodos con coordenadas reales, pasillos, plazas con su etiqueta, conectores verticales (ascensor/escalera/rampa) explícitos, marcadores de accesibilidad y puntos de referencia confirmables. El backend rechaza rutas por conexiones inexistentes o cerradas; un mapa incompleto produce "sin ruta", no una ruta inventada.

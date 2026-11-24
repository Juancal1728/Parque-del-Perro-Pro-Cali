# Parque del Perro 24/7

Propuesta de urbanismo sostenible para la Carrera 34 y la rotonda del Parque del Perro (barrio San Fernando, Cali). Proyecto final grupal, Universidad Icesi.

**Sitio:** https://juancal1728.github.io/Parque-del-Perro-Pro-Cali/

La página reúne la maqueta 3D del bulevar (de Carulla a la rotonda) con la comparación hoy/propuesta de cada punto, y el dossier de la propuesta: diagnóstico, antecedentes, intervención, zonificación, sistemas, componente ambiental, disciplinas (biología, finanzas y ciencia política), ruta de implementación, impactos y fuentes.

## Archivos

```
index.html            la página, los estilos y los textos de cada punto (arreglo PUNTOS)
recorrido3d.js        la maqueta 3D, el vuelo del recorrido, las capas y el modo noche
realismo_assets.js    texturas y modelos de la maqueta, cargados por recorrido3d.js
osm_cali.js           trazado de calles y edificios de OpenStreetMap
img/NN-antes.jpg      fotos actuales (Google Street View, uso académico)
img/NN-despues.jpg    renders de la propuesta (generados con IA)
```

HTML, CSS y JavaScript sin compilar. three.js y las fuentes se cargan desde CDN, así que la página necesita internet al abrirse.

## Verlo en local

Las imágenes y los scripts se cargan por ruta relativa, así que conviene abrirlo con un servidor y no con doble clic:

```
python3 -m http.server 8000
```

y luego abrir http://localhost:8000.

## Publicación

GitHub Pages publica la rama `main` desde la raíz (Settings → Pages → Deploy from a branch → `main` / `/ (root)`). Cada cambio que se suba a `main` se publica solo en uno o dos minutos.

## Créditos

Equipo: Luna Villafañe Ardila y Camila Solarte. Trazado urbano © colaboradores de OpenStreetMap (ODbL).

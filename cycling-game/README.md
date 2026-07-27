# Ciclimo Tour

Juego web 2D de ciclismo arcade y estrategia en tiempo real, creado únicamente con HTML5, CSS3, JavaScript vanilla y Canvas 2D.

## Jugar

Puedes abrir `index.html` directamente en un navegador moderno. Para evitar restricciones locales de algunos navegadores, también puedes servir la carpeta:

```bash
cd cycling-game
python3 -m http.server 8000
```

Después abre `http://localhost:8000`.

### GitHub Pages

El repositorio incluye `.github/workflows/pages.yml`. Cada envío a la rama `main` publica automáticamente únicamente los archivos jugables de `cycling-game/`, sin pruebas ni capturas, en:

`https://financebotty.github.io/ciclismosofa/`

Las rutas del HTML, el manifiesto y el *service worker* son relativas, de modo que funcionan dentro de la subcarpeta `/ciclismosofa/`. La primera vez hay que abrir `Settings → Pages` en GitHub y elegir `GitHub Actions` como origen de publicación. Después basta con subir los cambios a `main` y revisar el proceso `Publicar Ciclimo Tour en GitHub Pages` en la pestaña `Actions`.

La raíz del repositorio contiene además una entrada de compatibilidad que redirige a `cycling-game/`. De este modo el juego también abre si Pages está configurado accidentalmente como `Deploy from a branch`, aunque el modo recomendado sigue siendo `GitHub Actions`.

GitHub Pages sirve el juego mediante HTTPS, por lo que la instalación y el modo sin conexión quedan habilitados tras la primera visita. Las tres partidas se guardan en el almacenamiento local del navegador: una partida de `localhost` o `file://` no se copia automáticamente a la versión publicada, y tampoco se sincroniza entre dispositivos.

La portada es una pantalla independiente del simulador y permite elegir claramente entre **Tour** y **Carrera rápida**, además de configurar dificultad y clima. Los perfiles **todoterreno**, **escalador**, **sprinter** y **rodador** se utilizan en Carrera rápida; en el Tour se elige uno de los diez equipos y se controla a su líder predefinido.

El modo **Tour** utiliza tres slots de partida. Al abrir un slot vacío se elige equipo y esa elección queda fijada durante las diez etapas. Cada club cuenta con escudo SVG propio, identidad táctica, líder nominal y diez ciclistas estables. El Tour genera y guarda inmediatamente su calendario aleatorio y su plantilla de 100 ciclistas. Después se actualiza automáticamente al terminar cada etapa. `Cargar` abre el dashboard del Tour en la siguiente jornada pendiente; si se abandona una carrera a medias, esa etapa comienza de nuevo. Cada slot se puede borrar por separado mediante una confirmación.

El modo **Carrera rápida** genera al instante una prueba independiente con 100 ciclistas. Puede ser contrarreloj individual, llana, de media montaña o de alta montaña, con nombre, distancia, recorrido, clima y escenarios nuevos. No modifica ni ocupa ninguno de los tres slots del Tour; al terminar permite generar otra carrera aleatoria.

La primera etapa jugada abre una guía visual de cuatro pasos antes de la cuenta atrás. El menú permite volver a activarla, reducir todo movimiento accesorio y habilitar vibración en dispositivos compatibles.

Antes de cada etapa aparece el dashboard del Tour. Allí se ven el perfil de la siguiente jornada —distancia, desnivel, puertos, metas volantes y escenarios—, el calendario completo y las cuatro clasificaciones acumuladas. Desde ese panel se puede elegir entre:

- **Jugar etapa**: abre la carrera jugable con todos los controles del simulador.
- **Simular etapa**: pide confirmación y resuelve la jornada según el perfil, los atributos, la forma diaria, una fuga de varios equipos y la dificultad, incluyendo puntos de montaña y sprint. Desde los resultados se puede deshacer antes de continuar.

Ambas opciones muestran la misma pantalla oficial de resultados, actualizan las clasificaciones, guardan la partida y devuelven al dashboard antes de avanzar. Las etapas ya terminadas quedan activas en el calendario: al pulsarlas se abre su podio, el puesto y tiempo del jugador, y el desenlace de la escapada.

El mismo dashboard incluye **Mi equipo**. Muestra montaña, sprint, resistencia y técnica, la especialidad derivada, forma y fatiga de cada corredor. Antes de la jornada se puede asignar a cada compañero una misión: gregario, terminar conservando, buscar etapa, buscar puntos o buscar montaña. El líder está bloqueado porque es el ciclista controlado. Las misiones afectan a la IA, la simulación y la fatiga posterior; las órdenes manuales dadas durante la carrera tienen prioridad.

Un Tour terminado permanece disponible en su slot mediante `Ver Tour`. Abre su calendario, resumen y clasificaciones finales sin sobrescribirlo. La creación de un Tour nuevo es una acción distinta y requiere confirmación.

## Cómo se juega

El ciclista avanza automáticamente. La estrategia se controla con botones visibles y pulsando directamente sobre los rivales:

- **Bajo / Medio / Alto**: cambian directamente la potencia. Bajo recupera energía con cualquier pendiente mientras quede nutrición; Medio pierde energía lentamente en llano o subida y solo recupera en descensos desde `−1,5 %`; Alto consume con claridad y gasta un 15–25 % más al rodar aislado, pero no consume energía cuesta abajo.
- **Atacar**: consume explosividad y da potencia durante unos segundos.
- **Sprint**: se habilita en el último kilómetro y antes de una meta volante.
- **Dar relevos**: forma una rotación con hasta cuatro ciclistas próximos. El juego alterna automáticamente quién tira y quién rueda a rebufo. Los compañeros colaboran sin atacar mientras participan; los rivales pueden romper el acuerdo con un ataque. Un relevo no neutraliza ese ataque: hay que igualar su velocidad con `ALTO`, responder con `ATAQUE` o usar el sprint de respuesta.
- **Equipo**: en una etapa en línea abre el panel `♟ EQUIPO` y ordena al club elegido protegerte, cazar la fuga, atacar con escaladores y atacante, o guardar fuerzas. Con `PROTEGER`, hasta tres gregarios regresan a tu posición, te adelantan y mantienen una línea corta delante: su rebufo reduce tu consumo de energía mientras ellos ruedan a mayor esfuerzo y acumulan más cansancio. El botón indica cuántos están tirando. No aparece en contrarreloj.
- **Buscar rueda**: pulsa directamente sobre el ciclista que quieras seguir. Tu corredor intentará colocarse detrás; vuelve a pulsarlo para liberar el objetivo. Al engancharse aparece brevemente una única señal compacta `RUEDA`.
- **Comer gel**: recupera nutrición tras un pequeño retraso. Hay tres.
- **Segura / Normal / Agresiva**: modifica el equilibrio entre velocidad, adherencia y riesgo.

La interfaz de carrera utiliza un lenguaje visual compacto, pero las cuatro barras de recursos mantienen visibles sus nombres completos —energía, explosividad, nutrición y adherencia— también en móvil. Los iconos de las acciones muestran sus cifras detalladas como ayuda contextual.

Durante la carrera la cabecera omite el nombre de etapa y el rótulo `LIVE`, ya presentes antes de la salida, para dedicar el espacio a posición, distancia, pendiente y mapa. En escritorio los mandos inferiores muestran únicamente icono y acción; sus datos dinámicos siguen disponibles como ayuda contextual sin ocupar una segunda línea.

El panel inferior prioriza la lectura visual: muestra únicamente las cuatro barras grandes de energía, explosividad, nutrición y adherencia. La posición y el grupo pasan a la cabecera de carrera, mientras que los antiguos indicadores pequeños de rebufo, riesgo, geles y velocidad desaparecen. Los diez controles se reparten en dos filas de cinco: ritmo, ataque y sprint arriba; relevo, gel y trazada abajo. En escritorio conservan también una explicación breve sin recortes.

Cada cambio táctico produce indicadores flotantes de recursos. Bajo y Medio recuperan explosividad, pero únicamente Bajo regenera energía fuera de los descensos. Alto avisa del aumento de velocidad, del consumo creciente y del coste adicional cuando el ciclista está aislado. Ataques, sprint, selección de rueda y geles muestran también sus beneficios o costes. Cuando el gel hace efecto aparecen sus valores reales: `+32 nutrición` y `+5 energía`.

Las capas informativas de carrera son temporales: ningún aviso, ficha contextual, advertencia, panel táctico ni indicador de punto puntuable permanece más de cinco segundos. Los avisos normales duran algo más de tres segundos y los urgentes algo más de cuatro. Después la carretera vuelve a quedar despejada; solo permanecen los controles y los indicadores compactos de acciones que siguen activas.

Cada partida es un Tour de 10 etapas. La primera y otra jornada entre la quinta y la novena son contrarrelojes individuales; cuatro etapas son de alta montaña y las cuatro restantes alternan llano y media montaña. Las etapas en línea miden entre 120 y 280 km y añaden puertos, descensos, curvas peligrosas y metas volantes. En alta montaña las ascensiones principales miden aproximadamente entre 10 y 22 km con medias del 6,2 al 10,5 %; en media montaña se mueven entre 7 y 15 km. Los puertos se clasifican por su desnivel real como Especial, 1.ª, 2.ª, 3.ª o 4.ª categoría. También divide el recorrido en zonas visuales aleatorias de bosque, ciudad, desierto, alta montaña, campiña verde y terreno seco. Cada zona utiliza su propia paleta y elementos —árboles, edificios, cactus, rocas o matorral— en las dos cámaras, y el mapa muestra una franja con la sucesión de escenarios.

Compiten los mismos 100 corredores durante todo el Tour, con edad, atributos e identidad estables, repartidos en 10 equipos de diez y 10 colores. La parrilla de la primera etapa se baraja; en la segunda contrarreloj se sale en orden inverso de la general, con el líder al final. En las cronos solo aparece el corredor controlado y quedan anulados rebufo, rueda, relevos y colisiones. Cada equipo asigna líder, sprinter, escaladores, atacante y gregarios, con planes visibles de protección, persecución, fuga o tren de sprint. Toda la imagen utiliza una dirección artística original inspirada en los arcades de 16 bits: el escenario completo se renderiza a baja resolución y se amplía sin suavizado; ciclistas, terreno, carretera, vegetación, lluvia, reflejos, mapas, botones y paneles comparten píxeles marcados, contornos gruesos y sombras duras.

El corredor del jugador tiene nivel de líder de equipo competitivo, también al cargar partidas creadas con versiones anteriores. La simulación instantánea está calibrada para que la dificultad cambie las opciones sin convertir el resultado en una victoria automática ni en una derrota inevitable.

La condición también pertenece al Tour. Cada etapa añade fatiga según longitud, desnivel, esfuerzo y energía final; una parte se recupera antes de la jornada siguiente. La forma diaria oscila de manera reproducible entre `−8` y `+8`. Ambos valores afectan por igual a las etapas jugadas y simuladas y se muestran, sin porcentajes, en el resumen de la siguiente jornada.

En la cámara lateral, los corredores utilizan sprites grandes y exagerados: casco, gafas, torso, brazos, piernas y bicicletas tienen volúmenes de arcade, contornos oscuros y brillos duros. La cabeza queda adelantada sobre los hombros y próxima al manillar, formando una postura de carrera reconocible. El desnivel emplea una exageración vertical solo visual para que las rampas sean legibles en móvil; la velocidad y la cadencia disminuyen físicamente durante la subida. Los ciclistas se separan visualmente en profundidad y los ataques y sprints producen estelas de velocidad de colores.

En móvil, el juego utiliza una interfaz táctil propia. En vertical mantiene visibles el HUD, la carretera y los controles en tres franjas sin desplazamiento; en horizontal coloca la carrera a la izquierda y el mando a la derecha. Los botones tienen áreas táctiles amplias, el perfil y los ciclistas se pueden pulsar, y la composición respeta las zonas seguras de teléfonos con notch.

La versión móvil dispone de cuatro pestañas que cambian la información sin detener la carrera: `Ruta` muestra la acción, `Grupos` separa los cortes con líder, tamaño, equipos y diferencias, `Pos.` presenta la clasificación en directo y `Etapa` reúne progreso, distancia, desnivel, puertos, sprints, escenario, clima, tiempo y número de grupos. La barra de pestañas permanece por encima de los paneles y cada categoría incluye además un botón `Ruta`, de modo que siempre existen dos formas de volver al simulador. Un selector `CEN/LAT`, siempre visible y pulsable incluso durante la cuenta atrás, cambia directamente la cámara.

El modo `Movimiento reducido` elimina sacudidas de cámara, limita lluvia y salpicaduras y desactiva las transiciones decorativas. Respeta por defecto la preferencia equivalente del sistema operativo. La vibración es opcional, empieza desactivada y solo se ofrece si el navegador implementa esa función.

El escenario utiliza vegetación en varias capas y concentraciones de público distintas según el lugar: multitudes en puertos y llegada, grupos en metas volantes y aficionados sueltos en ciudad. Los botones tienen acabado de recreativa con carcasa oscura, luces, profundidad, colores por acción y recorrido visual al pulsarlos. Los ciclistas se dibujan un 25 % más pequeños para dar más aire y profundidad a los grupos, manteniendo intacta su zona táctil.

El escenario se construye con varias capas de píxeles: cielo, sol, nubes móviles, cordilleras en paralaje, terreno, vegetación, flores, piedras, edificios y carretera. Todas las etapas y todos los biomas transcurren de día; la lluvia puede nublar el cielo, pero nunca activa una variante nocturna. Cada bioma posee texturas de suelo propias. El asfalto incluye parches, grietas y reflejos cuando llueve, mientras que los márgenes incorporan grava, hitos, barreras y carteles kilométricos.

El botón de cámara alterna entre:

- **Cenital**: lectura táctica del pelotón, los grupos, las curvas y las colisiones.
- **Lateral**: ciclistas de perfil y representación directa de las subidas y bajadas.

La preferencia queda guardada en `localStorage` y ambas vistas son compatibles con el mapa interactivo.

El mando inferior separa las decisiones en tres bloques iconográficos: `Ritmo` utiliza corazón, punto y rayo para Bajo, Medio y Alto; `Conducción` utiliza rombos distintos para Segura, Normal y Agresiva; y `Acciones` agrupa Ataque, Sprint, Relevo y Gel en una cuadrícula 2×2 que ocupa la mitad del área de controles. Los botones conservan nombre accesible, ayuda al pasar el cursor y muestran una confirmación grande al pulsarlos. Esta jerarquía se mantiene tanto en escritorio como en móvil.

Al jugar o simular una etapa, el resultado se abre como una pantalla completa independiente del canvas. `Siguiente etapa` permanece arriba, recibe el foco y vuelve al dashboard con el resultado guardado; la cabecera y los controles del simulador no pueden interceptar la pulsación.

Todos los corredores visibles son seleccionables con ratón o toque en ambas cámaras. Durante la carrera, pulsar un rival lo convierte directamente en objetivo de rueda y muestra una única señal `RUEDA`, compacta y de unos 1,6 segundos. No se muestra una segunda notificación de rebufo ni información de edad. Con la carrera pausada se puede inspeccionar temporalmente cualquier ciclista.

Las últimas rampas de cada puerto, las metas volantes y los tres kilómetros finales concentran público pixel-art en varias filas. Los aficionados cambian la posición de los brazos para animar, utilizan ropa de distintos colores y rodean arcos ampliados y la línea de meta.

La cámara lateral utiliza una calzada especialmente ancha y público ampliado, colocado detrás del arcén. Las bicicletas permanecen dentro del asfalto y se inclinan con el ángulo de la carretera. En las zonas concurridas aparecen banderas animadas, coches, autocaravanas y aficionados animando junto a sus bicicletas. El arco de llegada sobresale ampliamente por encima de las filas de público. La vegetación cercana se genera con menos densidad y queda anclada al terreno para desplazarse de forma estable, mientras el cielo, las montañas y los biomas del fondo continúan cambiando durante la etapa.

Al terminar cada etapa, la pantalla oficial muestra el resultado de la jornada y las cuatro clasificaciones acumuladas: general por tiempo, regularidad por puntos, montaña y jóvenes de 25 años o menos. La llegada concede `50–30–20–15–12–10–8–6–4–2` puntos a los diez primeros, además de los puntos obtenidos en metas volantes. Los líderes visten amarillo, verde, blanco con lunares rojos y blanco; si un corredor domina varias tablas, los maillots inferiores pasan al siguiente ciclista elegible para que los cuatro sean visibles. Un podio SVG de estética 16-bit presenta a los tres primeros de la etapa.

En las etapas en línea se aplican tiempos oficiales por grupos: corredores que cruzan juntos comparten el tiempo del primero de su bloque, evitando diferencias ficticias de centésimas en la general. Las contrarrelojes mantienen el tiempo individual de cada participante.

## Simulación

La velocidad objetivo combina una base con el esfuerzo, ataques, sprint, rebufo y estilo de conducción; descuenta pendiente, fatiga, nutrición baja y clima. La velocidad real interpola suavemente hacia ese objetivo.

Las caídas no se deciden con una tirada aislada. Primero se calcula un riesgo acumulado a partir de adherencia, curvatura, lluvia, velocidad, técnica, fatiga y conducción. Solo al superar de forma sostenida el umbral peligroso se produce una caída.

Los corredores utilizan evitación predictiva de colisiones. Calculan la velocidad de cierre y el tiempo hasta alcanzar al ciclista precedente, buscan el carril con más espacio y frenan cuando están encerrados. Un contacto real separa las bicicletas, reduce la velocidad y la energía y aumenta el riesgo de caída.

Los relevos reúnen al jugador con ciclistas de su mismo grupo que estén a menos de 220 metros y con energía suficiente. Cada turno dura unos cinco segundos: quien pasa al frente rueda en Alto y los demás se ordenan a su rueda. Esa rueda interna no abre la ficha `RUEDA` ni genera avisos en cada rotación; el estado permanece en el botón de Relevo. Elegir otra potencia, atacar, esprintar o seleccionar una rueda concreta termina la rotación. Un rival puede aprovechar su turno para atacar; un compañero participante tiene esa acción bloqueada. Mientras haya un ataque rival activo no se puede iniciar otro relevo para cancelarlo. El botón indica `NO FRENA ATAQUE`; el jugador debe alcanzar la velocidad del atacante.

La clasificación se divide dinámicamente por distancia, tendencia y tamaño del corte. Los bloques pequeños se fusionan con el pelotón más cercano salvo que tengan ventaja real, evitando falsos grupos por pequeños estiramientos. Se muestran como máximo cuatro grupos tácticamente relevantes. El panel y las etiquetas sobre la carretera muestran líder y nacionalidad, integrantes, equipos presentes, diferencia respecto al grupo anterior y tendencia. Cuando el jugador lidera, la cabecera muestra su ventaja sobre el primer grupo perseguidor.

El sonido se sintetiza con Web Audio en estética 16-bit: cambio de potencia, entrada y salida de rebufo, gel, ataques, sprint, curvas, puertos, metas, ambiente de carretera y público y música adaptativa. El menú incluye silencio y volumen; el navegador solo activa el audio después de una interacción del usuario.

Para mantener 100 corredores, una cuadrícula espacial comparte las consultas de proximidad entre rebufo, elección de carril y colisiones. Los sprites se almacenan en caché, el HUD se actualiza a una frecuencia menor que el Canvas y lluvia/salpicaduras aplican un presupuesto reducido en móvil.

El perfil de etapa funciona como un mapa interactivo de gran formato que ocupa todo el ancho de la cabecera y adapta su resolución al tamaño real de la pantalla. Los cuadrados numerados representan los grupos y utilizan el color del equipo de su líder; los triángulos marcan puertos puntuables y los cuadrados azules, metas volantes. Al pulsar un grupo, la cámara lo sigue durante ocho segundos; al pulsar otro punto del perfil, muestra ese kilómetro. La carrera continúa en tiempo real y el botón `Volver a ti` devuelve inmediatamente la cámara al jugador. El mapa admite ratón, controles táctiles y navegación por teclado.

La altimetría utiliza una relación física coherente: un tramo al `1 %` gana exactamente `10 m` por kilómetro. El perfil, la altitud actual, la pendiente y el desnivel positivo acumulado se generan desde los mismos tramos aleatorios.

Los cinco primeros corredores de cada puerto o meta volante reciben puntos. Ganar un punto intermedio concede solo tres segundos de moral: no regenera energía ni explosividad, por lo que disputar todos los sprints tiene un coste real. La IA identifica estos objetivos y adapta sus ataques y sprints; el resultado del jugador aparece en las estadísticas finales.

Una fuga empieza a provocar respuesta táctica desde unos seis segundos de corte, aunque todavía no aparezca como grupo independiente en el mapa. Entre dos y seis equipos organizan la persecución según el perfil, la dificultad y el tamaño de la ventaja. Cualquier corredor sin rebufo, relevos ni compañía útil en un radio longitudinal de 40 metros comienza a sufrir exposición; esta crece progresivamente hasta 140 metros y aumenta un 15–25 % el consumo de Alto. Hacer relevos elimina esa penalización. La contrarreloj conserva su balance propio y queda excluida.

Todas las etapas en línea lanzan una escapada coordinada durante los primeros kilómetros, pero su momento varía. Antes puede haber un amago que obligue al pelotón a decidir si reacciona. La IA selecciona entre cuatro y siete corredores de equipos distintos, priorizando atacantes y gregarios; un compañero del jugador puede entrar y, tras consolidarse el corte, otro corredor puede intentar enlazar desde el pelotón. Los fugados colaboran mediante relevos hasta consolidar la ventaja. Si el grupo es neutralizado demasiado pronto puede producirse un segundo movimiento. La ventaja no está garantizada hasta meta: los equipos sin representación organizan la persecución y los fugados acumulan fatiga. Las contrarrelojes quedan excluidas porque sus salidas son individuales.

Las tablas de puntuación son:

- Puerto Especial: `20–15–12–10–8`.
- Puerto de 1.ª: `15–10–8–6–4`.
- Puerto de 2.ª: `10–7–5–3–2`.
- Puerto de 3.ª: `6–4–3–2–1`.
- Puerto de 4.ª: `3–2–1–1–1`.
- Meta volante de sprint: `10–6–4–2–1`.

## Estructura

- `index.html`: interfaz, menús, HUD y controles.
- `styles.css`: realización deportiva, diseño adaptable y estados visuales.
- `game.js`: clases `Game`, `Race`, `Cyclist`, `PlayerCyclist`, `AICyclist`, `Road`, `WeatherSystem`, `ParticleSystem`, `HUD` y `AudioManager`.
- `tests/phase2-smoke.jxa`: prueba reproducible de Tour completo, tiempos por grupos, condición, perfiles, fugas y migración de guardados; se ejecuta en macOS con `osascript -l JavaScript tests/phase2-smoke.jxa`.
- `tests/phase2-balance.jxa`: muestra de 90 Tours simulados —30 por dificultad— para vigilar victorias, top 10, general y triunfos de escapada.
- `tests/quick-race-smoke.jxa`: valida las cuatro familias de carrera rápida, la etapa independiente y el pelotón de 100 ciclistas.
- `tests/simulation-flow-smoke.m`: reproduce en WebKit el flujo Simular etapa → resultado → Siguiente etapa y comprueba que ninguna capa intercepta el botón.
- `tests/phase3-smoke.jxa`: valida las cuatro órdenes de equipo, ataques, bloqueo de relevos durante un ataque rival, sprint de respuesta, tutorial, movimiento reducido y vibración.
- `tests/energy-rules-smoke.jxa`: comprueba recuperación de Bajo en subida, pérdida lenta de Medio en llano, recuperación de Medio en descenso, Alto gratuito cuesta abajo y penalización por aislamiento.
- `tests/team-management-smoke.jxa`: valida los diez equipos, sus líderes únicos, la selección de club, las plantillas de diez y las especialidades derivadas.
- `manifest.webmanifest`, `service-worker.js` y `assets/icon.svg`: instalación y caché offline del juego.
- `assets/`: icono instalable y espacio para futuros paquetes audiovisuales; la carrera actual se dibuja en Canvas y sintetiza el sonido en el navegador.

## Guardado local

`localStorage` conserva la mejor posición, el mejor tiempo, las carreras disputadas, las victorias, la dificultad, el perfil preferido, la cámara elegida, el silencio, el volumen, el tutorial y las opciones de accesibilidad. También mantiene tres partidas completas con calendario, etapa pendiente, plantilla, edades, tiempos, puntos, líderes, maillots, forma, fatiga e historial de resultados. Las preferencias y partidas se validan antes de utilizarlas; los slots creados antes de la Fase 2 se migran con valores seguros, y un valor corrupto o un almacenamiento no disponible no impide que el juego arranque.

Al servir la carpeta mediante `http://localhost` o HTTPS, el navegador registra un *service worker* y guarda la aplicación base para abrirla sin conexión después de la primera carga. La apertura directa de `index.html` sigue funcionando, pero los navegadores no permiten instalación ni caché offline desde `file://`.

## Posibles ampliaciones

- Añadir una banda sonora y muestras grabadas opcionales como alternativa al sintetizador 16-bit.
- Realizar sesiones presenciales de usabilidad y equilibrio con teléfonos físicos.

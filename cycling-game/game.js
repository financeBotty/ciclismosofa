"use strict";

const storageAdapter = globalThis.CiclimoStorage || {
  get(key, fallback = null) { try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; } },
  set(key, value) { try { localStorage.setItem(key, String(value)); return true; } catch { return false; } },
  remove(key) { try { localStorage.removeItem(key); return true; } catch { return false; } },
  parse(value, fallback = null) { try { return value == null ? fallback : JSON.parse(value); } catch { return fallback; } }
};
const safeStorageGet = storageAdapter.get;
const safeStorageSet = storageAdapter.set;
const safeStorageRemove = storageAdapter.remove;
const safeJsonParse = storageAdapter.parse;
const simulationRules = globalThis.CiclimoRules || {
  fatigue: { carry: 0.82, previousLoad: 0.2, baseLoad: 11, maximumStageLoad: 30, maximumFatigue: 96 },
  objectiveForStage(stage) {
    if (stage?.type === "itt") return { id: "itt-top-25", label: "TOP 25 EN LA CRONO", description: "Termina entre los 25 primeros." };
    if (stage?.profile === "mountain") return { id: "mountain-points", label: "SUMA EN MONTAÑA", description: "Consigue al menos un punto de montaña." };
    if (stage?.profile === "flat") return { id: "flat-top-10", label: "TOP 10 DE ETAPA", description: "Llega entre los diez primeros." };
    return { id: "mixed-top-15", label: "TOP 15 DE ETAPA", description: "Termina entre los quince primeros." };
  },
  objectiveCompleted(objective, race, position) {
    if (objective?.id === "itt-top-25") return position <= 25;
    if (objective?.id === "mountain-points") return race.player.mountainPoints > 0;
    if (objective?.id === "flat-top-10") return position <= 10;
    return position <= 15;
  }
};
const uiRules = globalThis.CiclimoUI || {
  riskLabel: () => ({ label: "BAJO", level: "low" }),
  riderState: () => "EN GRUPO"
};
const renderRules = globalThis.CiclimoRender || {
  lateralViewportScale: (width) => width <= 480 ? 0.66 : width <= 900 ? 0.76 : 1,
  raceStructureScale: (width) => width <= 520 ? 0.58 : width <= 900 ? 0.72 : 1
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const lerp = (a, b, t) => a + (b - a) * t;
const lerpColor = (from, to, amount) => {
  const source = from.match(/\w\w/g).map((value) => parseInt(value, 16));
  const target = to.match(/\w\w/g).map((value) => parseInt(value, 16));
  return `rgb(${source.map((value, index) => Math.round(lerp(value, target[index], amount))).join(",")})`;
};
const formatNumber = (value, digits = 1) =>
  value.toLocaleString("es-ES", { minimumFractionDigits: digits, maximumFractionDigits: digits });
const formatTime = (seconds) => {
  const safe = Math.max(0, Math.round(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
};
const formatGap = (seconds) => `${String(Math.floor(Math.max(0, seconds) / 60)).padStart(2, "0")}:${String(Math.floor(Math.max(0, seconds) % 60)).padStart(2, "0")}`;
const ordinal = (position) => `${position}.º`;
const TACTICAL_LABELS = {
  RECUPERAR: "RECUPERAR",
  PROTEGER: "PROTEGER",
  PERSEGUIR: "PERSEGUIR",
  ATACAR: "ATACAR",
  FUGA: "FUGA",
  "PREPARAR SPRINT": "PREPARAR SPRINT"
};
const SPRINT_POINTS = [10, 6, 4, 2, 1];
const TOUR_STAGE_COUNT = 10;
const YOUNG_RIDER_MAX_AGE = 25;
const SAVE_SLOT_COUNT = 3;
const SAVE_VERSION = 2;
const POPUP_MAX_MS = 4800;
const WHEEL_INDICATOR_MS = 1600;
const NOTICE_MS = 3200;
const URGENT_NOTICE_MS = 4200;
const RECOVERY_DESCENT_GRADIENT = -1.5;
const ISOLATION_HIGH_EFFORT_LOAD = 0.2;
const PROTECTION_PULL_LOAD = 0.85;
const SIDE_ROAD_SHOULDER_WIDTH = 56;
const SIDE_ROAD_ASPHALT_WIDTH = 43;
const SIDE_ROAD_LANE_DEPTH = 12;
const SIDE_FINISH_GATE_HEIGHT = 190;
const TOP_SPRINT_GATE_HEIGHT = 132;
const SIDE_SPRINT_GATE_HEIGHT = 190;
const STAGE_POINTS = [50, 30, 20, 15, 12, 10, 8, 6, 4, 2];
const PLAYER_PROFILES = {
  allrounder: {
    label: "TODOTERRENO",
    climbing: 82, sprint: 83, endurance: 85, technique: 82, aggression: 78, intelligence: 86
  },
  climber: {
    label: "ESCALADOR",
    climbing: 89, sprint: 74, endurance: 86, technique: 82, aggression: 82, intelligence: 85
  },
  sprinter: {
    label: "SPRINTER",
    climbing: 70, sprint: 91, endurance: 82, technique: 84, aggression: 85, intelligence: 84
  },
  rouleur: {
    label: "RODADOR",
    climbing: 78, sprint: 82, endurance: 90, technique: 89, aggression: 76, intelligence: 87
  }
};
const DEFAULT_PLAYER_PROFILE = "allrounder";
const TEAM_DEFINITIONS = [
  {
    id: "solaris", name: "Solaris", color: "#ffcc33", secondary: "#181300",
    identity: "Equilibrio", specialty: "balanced", cooperation: 0.72, attackBias: 0.58, crest: "sun",
    leader: { name: "Iker Laredo", nationality: "España", flag: "🇪🇸", age: 27, climbing: 86, sprint: 82, endurance: 88, technique: 85, aggression: 78, intelligence: 88 }
  },
  {
    id: "cobalto", name: "Cobalto", color: "#2f80ed", secondary: "#071a38",
    identity: "Control del pelotón", specialty: "tempo", cooperation: 0.88, attackBias: 0.42, crest: "wave",
    leader: { name: "Théo Vallet", nationality: "Francia", flag: "🇫🇷", age: 29, climbing: 83, sprint: 80, endurance: 91, technique: 88, aggression: 71, intelligence: 91 }
  },
  {
    id: "bermellon", name: "Bermellón", color: "#e63946", secondary: "#31070b",
    identity: "Ataque", specialty: "attack", cooperation: 0.48, attackBias: 0.9, crest: "bolt",
    leader: { name: "Elio Bellori", nationality: "Italia", flag: "🇮🇹", age: 26, climbing: 87, sprint: 79, endurance: 86, technique: 81, aggression: 93, intelligence: 83 }
  },
  {
    id: "esmeralda", name: "Esmeralda", color: "#2fbf71", secondary: "#062719",
    identity: "Alta montaña", specialty: "mountain", cooperation: 0.67, attackBias: 0.7, crest: "mountain",
    leader: { name: "Jairo Quintero", nationality: "Colombia", flag: "🇨🇴", age: 25, climbing: 93, sprint: 70, endurance: 89, technique: 84, aggression: 82, intelligence: 87 }
  },
  {
    id: "violeta", name: "Violeta", color: "#9b5de5", secondary: "#200a38",
    identity: "Oportunismo", specialty: "opportunist", cooperation: 0.43, attackBias: 0.78, crest: "diamond",
    leader: { name: "Žan Kranjc", nationality: "Eslovenia", flag: "🇸🇮", age: 24, climbing: 88, sprint: 83, endurance: 86, technique: 87, aggression: 86, intelligence: 86 }
  },
  {
    id: "naranja", name: "Naranja", color: "#ff7a00", secondary: "#351500",
    identity: "Llegadas masivas", specialty: "sprint", cooperation: 0.82, attackBias: 0.3, crest: "wing",
    leader: { name: "Mats De Bruyn", nationality: "Bélgica", flag: "🇧🇪", age: 28, climbing: 69, sprint: 94, endurance: 87, technique: 90, aggression: 87, intelligence: 88 }
  },
  {
    id: "turquesa", name: "Turquesa", color: "#00b8d9", secondary: "#002c35",
    identity: "Persecución", specialty: "chase", cooperation: 0.95, attackBias: 0.38, crest: "arrow",
    leader: { name: "Daan Van Loen", nationality: "Países Bajos", flag: "🇳🇱", age: 30, climbing: 79, sprint: 86, endurance: 92, technique: 91, aggression: 74, intelligence: 92 }
  },
  {
    id: "magenta", name: "Magenta", color: "#f15bb5", secondary: "#360b29",
    identity: "Fugas", specialty: "breakaway", cooperation: 0.52, attackBias: 0.94, crest: "flame",
    leader: { name: "Tiago Faria", nationality: "Portugal", flag: "🇵🇹", age: 27, climbing: 85, sprint: 81, endurance: 90, technique: 83, aggression: 94, intelligence: 82 }
  },
  {
    id: "acero", name: "Acero", color: "#8d99ae", secondary: "#17202c",
    identity: "Regularidad", specialty: "conservative", cooperation: 0.78, attackBias: 0.28, crest: "shield",
    leader: { name: "Nils Ebert", nationality: "Alemania", flag: "🇩🇪", age: 31, climbing: 84, sprint: 78, endurance: 93, technique: 89, aggression: 67, intelligence: 94 }
  },
  {
    id: "lima", name: "Lima", color: "#9acd32", secondary: "#1b2907",
    identity: "Todoterreno", specialty: "allround", cooperation: 0.64, attackBias: 0.62, crest: "crown",
    leader: { name: "Lachlan Marlow", nationality: "Australia", flag: "🇦🇺", age: 26, climbing: 86, sprint: 86, endurance: 88, technique: 88, aggression: 80, intelligence: 87 }
  }
];
const TEAM_BY_ID = new Map(TEAM_DEFINITIONS.map((team) => [team.id, team]));
const STAGE_ROLES = {
  leader: { label: "LÍDER", short: "Líder", description: "Objetivo principal del equipo" },
  support: { label: "GREGARIO", short: "Gregario", description: "Protege y trabaja para el líder" },
  finish: { label: "CONSERVAR", short: "Terminar etapa", description: "Ahorra fuerzas para mañana" },
  stage: { label: "ETAPA", short: "Buscar etapa", description: "Disputa la victoria del día" },
  points: { label: "PUNTOS", short: "Buscar puntos", description: "Prioriza metas y final" },
  mountain: { label: "MONTAÑA", short: "Buscar montaña", description: "Prioriza puertos puntuables" }
};
const fixedStageRoleFor = (rider) => ({
  leader: "leader",
  sprinter: "points",
  climber: "mountain",
  attacker: "stage",
  domestique: "support"
}[rider?.role] || "support");
const derivedSpecialty = (rider) => {
  const scores = [
    ["ESCALADOR", rider.climbing * 0.62 + rider.endurance * 0.25 + rider.technique * 0.13],
    ["SPRINTER", rider.sprint * 0.62 + rider.technique * 0.23 + rider.endurance * 0.15],
    ["GREGARIO", rider.endurance * 0.5 + rider.technique * 0.3 + (rider.climbing + rider.sprint) * 0.1]
  ];
  return scores.sort((a, b) => b[1] - a[1])[0][0];
};
const teamCrestMarkup = (team, label = team.name) => {
  const symbols = {
    sun: '<circle cx="32" cy="31" r="11"/><path d="M32 7v9M32 46v9M8 31h9M47 31h9M15 14l7 7M42 41l7 7M49 14l-7 7M22 41l-7 7"/>',
    wave: '<path d="M10 38c9-16 17 12 27-4s15 2 18-8M10 47c10-13 18 9 28-3s13 0 17-5"/>',
    bolt: '<path d="M36 8 16 36h14l-4 20 22-31H34Z"/>',
    mountain: '<path d="m8 49 17-29 8 12 7-10 16 27Z"/><path d="m20 29 5-9 6 9-5-2Z"/>',
    diamond: '<path d="m32 7 22 23-22 26L10 30Z"/><path d="m32 15 12 15-12 17-12-17Z"/>',
    wing: '<path d="M9 43c18-1 26-9 39-29-2 17-8 31-27 36l9-13Z"/>',
    arrow: '<path d="M8 34h31L29 22l8-8 21 21-21 21-8-8 10-11H8Z"/>',
    flame: '<path d="M34 7c3 13-8 15-4 25 2-7 8-8 10-14 11 12 12 27 1 35-11 8-29 1-29-14 0-12 10-18 22-32Z"/>',
    shield: '<path d="M12 10h40v25c0 11-9 18-20 23-11-5-20-12-20-23Z"/><path d="M21 22h22v9H21Zm0 14h22v8H21Z"/>',
    crown: '<path d="m9 20 12 9 11-17 11 17 12-9-5 29H14Z"/><path d="M17 42h30"/>'
  };
  return `<svg class="team-crest" viewBox="0 0 64 64" role="img" aria-label="Escudo de ${label}" style="--team-color:${team.color};--team-secondary:${team.secondary}"><path class="crest-field" d="M6 5h52v34c0 12-11 20-26 24C17 59 6 51 6 39Z"/><g class="crest-symbol">${symbols[team.crest] || symbols.shield}</g></svg>`;
};
const TEAM_ORDERS = {
  protect: { label: "PROTEGER", state: "PROTEGER", message: "Los gregarios de Solaris pasan delante: tú ahorras energía y ellos asumen el desgaste." },
  chase: { label: "CAZAR", state: "PERSEGUIR", message: "Los gregarios de Solaris toman el mando." },
  attack: { label: "ATACAR", state: "ATACAR", message: "Escaladores y atacante de Solaris preparan un movimiento." },
  conserve: { label: "GUARDAR", state: "RECUPERAR", message: "Solaris guarda fuerzas para más adelante." }
};
const TUTORIAL_STEPS = [
  {
    icon: "♥", title: "CONTROLA EL ESFUERZO",
    text: "Bajo recupera energía; Medio solo recupera bajando; Alto no gasta en descenso, pero consume más si ruedas aislado."
  },
  {
    icon: "◎", title: "ELIGE UNA RUEDA",
    text: "Pulsa directamente un ciclista para seguir su rueda. El rebufo ahorra energía y ayuda a moverte dentro del grupo."
  },
  {
    icon: "♟", title: "DIRIGE TU EQUIPO",
    text: "En etapas en línea abre EQUIPO para protegerte, perseguir una fuga, ordenar un ataque o guardar fuerzas."
  },
  {
    icon: "!", title: "ELIGE EL MOMENTO",
    text: "Los ataques gastan explosividad. Reserva el sprint para el último kilómetro o una meta volante y usa los geles antes de vaciarte."
  }
];
const TOUR_JERSEYS = {
  yellow: { label: "GENERAL", color: "#f4d52f", icon: "●" },
  green: { label: "PUNTOS", color: "#36bd69", icon: "◆" },
  polka: { label: "MONTAÑA", color: "#f7f4ea", icon: "●" },
  white: { label: "JÓVENES", color: "#f4f4f0", icon: "○" }
};
const MOUNTAIN_CATEGORIES = [
  { category: "Especial", minGain: 900, points: [20, 15, 12, 10, 8], color: "#a978ff", marker: "ESP" },
  { category: "1ª", minGain: 650, points: [15, 10, 8, 6, 4], color: "#ef5362", marker: "1ª" },
  { category: "2ª", minGain: 400, points: [10, 7, 5, 3, 2], color: "#ff8a45", marker: "2ª" },
  { category: "3ª", minGain: 220, points: [6, 4, 3, 2, 1], color: "#f3c84b", marker: "3ª" },
  { category: "4ª", minGain: 0, points: [3, 2, 1, 1, 1], color: "#f4f1e9", marker: "4ª" }
];
const mountainCategoryFor = (elevationGain) =>
  MOUNTAIN_CATEGORIES.find((item) => elevationGain >= item.minGain) || MOUNTAIN_CATEGORIES.at(-1);
const racePointColor = (point) => point.type === "sprint"
  ? "#62d8f2"
  : (MOUNTAIN_CATEGORIES.find((item) => item.category === point.category)?.color || "#ff7158");

class SeededRandom {
  constructor(seed = 4604) { this.seed = seed >>> 0; }
  next() {
    this.seed = (1664525 * this.seed + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }
}

const shuffleWith = (items, random) => {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random.next() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
};

const createTourCalendar = (seed) => {
  const random = new SeededRandom(seed);
  const secondTimeTrial = 4 + Math.floor(random.next() * 5);
  const available = Array.from({ length: 9 }, (_, index) => index + 1)
    .filter((index) => index !== secondTimeTrial && index !== TOUR_STAGE_COUNT - 1);
  const mountainStages = new Set(shuffleWith(available, random).slice(0, 4));
  const variableProfiles = ["flat", "mixed", "mixed", "flat", "mountain"];
  let variableIndex = 0;
  return Array.from({ length: TOUR_STAGE_COUNT }, (_, index) => {
    const number = index + 1;
    if (index === TOUR_STAGE_COUNT - 1) {
      return {
        number,
        type: "road",
        profile: "flat",
        lengthKm: 100,
        name: "Gran Final de la Ciudad",
        label: "FINAL DEL TOUR · LLANA",
        finale: true
      };
    }
    const timeTrial = index === 0 || index === secondTimeTrial;
    const hardMountain = mountainStages.has(index);
    const profile = timeTrial ? (random.next() < 0.25 ? "mixed" : "flat")
      : hardMountain ? "mountain" : variableProfiles[variableIndex++ % variableProfiles.length];
    const lengthKm = timeTrial
      ? 28 + Math.floor(random.next() * 28)
      : hardMountain ? 168 + Math.floor(random.next() * 73)
        : 120 + Math.floor(random.next() * 161);
    const type = timeTrial ? "itt" : hardMountain ? "mountain" : "road";
    const names = timeTrial
      ? ["Crono de Apertura", "La Hora de la Verdad"]
      : hardMountain
        ? ["Reina de las Cumbres", "Infierno de los Puertos", "Colosos de la Sierra", "Final en las Nubes"]
        : ["Ruta del Viento", "Clásica de los Bosques", "Camino del Desierto", "Circuito de las Ciudades"];
    return {
      number, type, profile, lengthKm,
      name: names[(number + Math.floor(random.next() * names.length)) % names.length],
      label: timeTrial ? "CONTRARRELOJ INDIVIDUAL" : hardMountain ? "ALTA MONTAÑA" : profile === "flat" ? "LLANA" : "MEDIA MONTAÑA"
    };
  });
};

const createQuickStage = (seed) => {
  const random = new SeededRandom(seed);
  const variants = [
    {
      type: "itt",
      profile: random.next() < 0.35 ? "mixed" : "flat",
      label: "CONTRARRELOJ INDIVIDUAL",
      names: ["Crono del Reloj", "La Hora de la Verdad", "Desafío Contrarreloj"],
      minLength: 24,
      maxLength: 58
    },
    {
      type: "road",
      profile: "flat",
      label: "LLANA",
      names: ["Ruta del Viento", "Clásica de los Sprinters", "Circuito de las Ciudades"],
      minLength: 120,
      maxLength: 280
    },
    {
      type: "road",
      profile: "mixed",
      label: "MEDIA MONTAÑA",
      names: ["Clásica de los Bosques", "Rompepiernas del Norte", "Ruta de las Colinas"],
      minLength: 120,
      maxLength: 280
    },
    {
      type: "mountain",
      profile: "mountain",
      label: "ALTA MONTAÑA",
      names: ["Reina de las Cumbres", "Infierno de los Puertos", "Final en las Nubes"],
      minLength: 145,
      maxLength: 260
    }
  ];
  const variant = variants[Math.floor(random.next() * variants.length)];
  const lengthKm = variant.minLength +
    Math.floor(random.next() * (variant.maxLength - variant.minLength + 1));
  return {
    number: 1,
    quickRace: true,
    type: variant.type,
    profile: variant.profile,
    lengthKm,
    label: variant.label,
    name: variant.names[Math.floor(random.next() * variant.names.length)]
  };
};

class SpatialIndex {
  constructor(distanceCell = 0.12, lateralCell = 0.34) {
    this.distanceCell = distanceCell;
    this.lateralCell = lateralCell;
    this.cells = new Map();
  }

  key(distanceIndex, lateralIndex) { return `${distanceIndex}:${lateralIndex}`; }

  rebuild(riders) {
    this.cells.clear();
    for (const rider of riders) {
      if (rider.finished) continue;
      const distanceIndex = Math.floor(rider.distance / this.distanceCell);
      const lateralIndex = Math.floor((rider.lateral + 1.2) / this.lateralCell);
      const key = this.key(distanceIndex, lateralIndex);
      if (!this.cells.has(key)) this.cells.set(key, []);
      this.cells.get(key).push(rider);
    }
  }

  query(rider, distanceRadius = 0.13, lateralRadius = 0.7) {
    const distanceIndex = Math.floor(rider.distance / this.distanceCell);
    const lateralIndex = Math.floor((rider.lateral + 1.2) / this.lateralCell);
    const distanceCells = Math.ceil(distanceRadius / this.distanceCell);
    const lateralCells = Math.ceil(lateralRadius / this.lateralCell);
    const result = [];
    for (let dx = -distanceCells; dx <= distanceCells; dx += 1) {
      for (let dy = -lateralCells; dy <= lateralCells; dy += 1) {
        const riders = this.cells.get(this.key(distanceIndex + dx, lateralIndex + dy));
        if (!riders) continue;
        for (const other of riders) {
          if (other !== rider && Math.abs(other.distance - rider.distance) <= distanceRadius &&
            Math.abs(other.lateral - rider.lateral) <= lateralRadius) result.push(other);
        }
      }
    }
    return result;
  }
}

class Road {
  constructor(random, lengthKm, options = {}) {
    this.random = random;
    this.lengthKm = lengthKm;
    // Ciclimo Tour transcurre siempre de día. El clima puede reducir la luz,
    // pero nunca cambia la etapa a tarde, noche o amanecer.
    this.timeOfDay = "day";
    const stageNames = ["Ruta de las Cumbres", "Clásica del Viento", "Desafío de los Puertos", "Gran Fondo de la Sierra", "Camino de las Águilas"];
    this.stageName = options.name || stageNames[Math.floor(random.next() * stageNames.length)];
    this.baseElevation = 250 + Math.floor(random.next() * 450);
    this.profile = [];
    this.mountains = [];
    this.intermediateSprints = [];
    this.racePoints = [];
    this.sceneryZones = [];
    this.dangerousCurves = [];
    this.elevationStep = 0.02;
    this.elevations = [this.baseElevation];
    this.ascents = [0];
    const profileRoll = random.next();
    this.stageProfile = options.profile || (profileRoll < 0.3 ? "flat" : profileRoll < 0.7 ? "mixed" : "mountain");
    this.isTourFinal = options.finale === true;
    this.generateStage();
    this.generateSceneryZones();
    this.buildElevationMap();
    this.generateIntermediateSprints();
    this.racePoints = [...this.mountains, ...this.intermediateSprints].sort((a, b) => a.km - b.km);
  }

  generateStage() {
    const climbNames = ["Alto del Cuervo", "Collado Rojo", "Puerto del Viento", "Cima del Brezo", "Alto de la Luna", "Paso del Águila", "Puerto de los Pinos", "Collado de Piedra"];
    let km = 0;
    const add = (length, gradient, label, kind = "rolling") => {
      const endKm = Math.min(this.lengthKm, km + Math.max(1, length));
      this.profile.push({ startKm: km, endKm, gradient, label, kind });
      km = endKm;
    };
    if (this.isTourFinal) {
      add(this.lengthKm, 0, "Circuito final urbano", "flat");
      return;
    }
    add(10 + this.random.next() * 8, this.random.next() * 0.8 - 0.2, "Salida neutralizada", "flat");
    let mountainIndex = 0;
    const maxClimbs = this.stageProfile === "flat"
      ? Math.max(1, Math.round(this.lengthKm / 190))
      : this.stageProfile === "mixed" ? Math.max(2, Math.round(this.lengthKm / 62))
        : Math.max(4, Math.round(this.lengthKm / 45));
    while (km < this.lengthKm - 14) {
      const rollingLength = this.stageProfile === "flat"
        ? 15 + this.random.next() * 18 : this.stageProfile === "mixed"
          ? 7 + this.random.next() * 11 : 3 + this.random.next() * 6;
      const rollingGradient = this.stageProfile === "flat"
        ? this.random.next() * 1.2 - 0.35 : this.random.next() * 2 - 0.7;
      add(rollingLength, rollingGradient, this.stageProfile === "flat" ? "Llanura expuesta" : "Terreno ondulado", "rolling");
      if (km >= this.lengthKm - 14) break;
      if (mountainIndex >= maxClimbs) continue;
      const climbLength = Math.min(
        this.stageProfile === "flat" ? 3.5 + this.random.next() * 3.5
          : this.stageProfile === "mixed" ? 7 + this.random.next() * 8 : 10 + this.random.next() * 12,
        this.lengthKm - km - 8
      );
      const gradient = this.stageProfile === "flat"
        ? 3.4 + this.random.next() * 2.6 : this.stageProfile === "mixed"
          ? 5.4 + this.random.next() * 4.3 : 7 + this.random.next() * 4.6;
      const startKm = km;
      const name = climbNames[mountainIndex % climbNames.length];
      if (this.stageProfile === "flat") {
        add(climbLength, gradient, name, "climb");
      } else {
        // Los puertos se dividen en sectores: la media sigue siendo coherente,
        // pero aparecen rampas duras y descansos como en una subida real.
        const sectorWeights = [0.22, 0.26, 0.24, 0.28];
        const rawVariation = [
          -1.2 + this.random.next() * 0.6,
          0.1 + this.random.next() * 0.9,
          1.8 + this.random.next() * 1.8,
          -0.45 + this.random.next() * 1.05
        ];
        const weightedVariation = rawVariation.reduce((total, variation, index) =>
          total + variation * sectorWeights[index], 0);
        let coveredLength = 0;
        sectorWeights.forEach((weight, index) => {
          const sectorLength = index === sectorWeights.length - 1
            ? climbLength - coveredLength
            : climbLength * weight;
          const maximumGradient = this.stageProfile === "mountain" ? 14.5 : 13.5;
          const sectorGradient = clamp(
            gradient + rawVariation[index] - weightedVariation,
            this.stageProfile === "mountain" ? 5.8 : 3.8,
            maximumGradient
          );
          add(sectorLength, sectorGradient, name, "climb");
          coveredLength += sectorLength;
        });
      }
      const actualLength = km - startKm;
      const climbSections = this.profile.filter((section) =>
        section.kind === "climb" && section.startKm >= startKm && section.endKm <= km);
      const elevationGain = climbSections.reduce((total, section) =>
        total + (section.endKm - section.startKm) * section.gradient * 10, 0);
      const averageGradient = elevationGain / Math.max(0.1, actualLength * 10);
      const categoryRule = mountainCategoryFor(elevationGain);
      this.mountains.push({
        type: "mountain",
        km,
        startKm,
        name,
        category: categoryRule.category,
        markerLabel: categoryRule.marker,
        lengthKm: actualLength,
        averageGradient,
        maxGradient: Math.max(...climbSections.map((section) => section.gradient)),
        elevationGain,
        pointsTable: [...categoryRule.points],
        maxPoints: categoryRule.points[0],
        results: [],
        announced: false
      });
      mountainIndex += 1;
      if (km < this.lengthKm - 10) {
        const descentGradient = this.stageProfile === "flat"
          ? 2.4 + this.random.next() * 2.2 : 3.2 + this.random.next() * 3.8;
        const descentLength = Math.min(
          climbLength * (0.75 + this.random.next() * 0.35),
          climbLength * averageGradient * 0.88 / descentGradient,
          this.lengthKm - km - 7
        );
        add(descentLength, -descentGradient, "Descenso", "descent");
        this.dangerousCurves.push(km - 0.7, km - 0.25);
      }
    }
    if (km < this.lengthKm) add(this.lengthKm - km, this.random.next() * 1.2 - 0.4, "Llegada", "flat");
  }

  generateIntermediateSprints() {
    const desired = 2 + Math.floor(this.random.next() * 3);
    const sprintNames = ["Meta volante del Río", "Sprint de Villaverde", "Meta volante de la Estación", "Sprint del Puente", "Meta volante de la Plaza", "Sprint de los Olivos"];
    const addSprint = (km) => {
      const sprintIndex = this.intermediateSprints.length;
      this.intermediateSprints.push({
        type: "sprint",
        km,
        name: sprintNames[sprintIndex % sprintNames.length],
        markerLabel: "SPR",
        pointsTable: [...SPRINT_POINTS],
        maxPoints: SPRINT_POINTS[0],
        results: [],
        announced: false
      });
    };
    const candidates = this.profile.filter((section) => ["flat", "rolling"].includes(section.kind) && section.endKm - section.startKm >= 5);
    for (let index = 0; index < desired && candidates.length; index += 1) {
      const candidateIndex = Math.floor(this.random.next() * candidates.length);
      const section = candidates.splice(candidateIndex, 1)[0];
      const km = section.startKm + (section.endKm - section.startKm) * (0.35 + this.random.next() * 0.3);
      if (km < 12 || km > this.lengthKm - 8 || this.intermediateSprints.some((point) => Math.abs(point.km - km) < 12)) {
        index -= 1;
        continue;
      }
      addSprint(km);
    }
    for (let slot = 1; this.intermediateSprints.length < desired && slot <= 8; slot += 1) {
      const km = this.lengthKm * slot / 9;
      const nearMountain = this.mountains.some((point) => Math.abs(point.km - km) < 6);
      const nearSprint = this.intermediateSprints.some((point) => Math.abs(point.km - km) < 10);
      if (!nearMountain && !nearSprint && km > 12 && km < this.lengthKm - 8) {
        addSprint(km);
      }
    }
    while (this.intermediateSprints.length < desired) {
      const index = this.intermediateSprints.length + 1;
      const km = this.lengthKm * index / (desired + 1);
      addSprint(km);
    }
  }

  generateSceneryZones() {
    const biomes = [
      { id: "forest", name: "Bosque", ground: "#4d7b55", detail: "#2d6040", accent: "#7fad63" },
      { id: "city", name: "Ciudad", ground: "#858d90", detail: "#586871", accent: "#d5c9aa" },
      { id: "desert", name: "Desierto", ground: "#c79b5c", detail: "#936b42", accent: "#ead38a" },
      { id: "mountain", name: "Alta montaña", ground: "#7d897e", detail: "#53635d", accent: "#bdc1a8" },
      { id: "green", name: "Campiña verde", ground: "#68a05c", detail: "#3c784b", accent: "#a6c46a" },
      { id: "dry", name: "Terreno seco", ground: "#a08351", detail: "#705e40", accent: "#c8aa68" }
    ];
    // El paisaje define la identidad visual de la etapa completa: una etapa
    // árida no se convierte a mitad de recorrido en bosque o campiña.
    const biome = this.isTourFinal
      ? biomes.find((candidate) => candidate.id === "city")
      : biomes[Math.floor(this.random.next() * biomes.length)];
    this.sceneryZones.push({
      startKm: 0,
      endKm: this.lengthKm,
      timeOfDay: "day",
      ...biome
    });
  }

  biomeAt(km) {
    return this.sceneryZones.find((zone) => km >= zone.startKm && km < zone.endKm) || this.sceneryZones.at(-1);
  }

  visualBiomeAt(km) {
    return this.biomeAt(km);
  }

  spectatorDensityAt(km) {
    if (this.isTourFinal) {
      const finishDistance = this.lengthKm - km;
      return finishDistance <= 3 ? 1 : 0.72;
    }
    const finishDistance = this.lengthKm - km;
    if (finishDistance >= 0 && finishDistance <= 3) {
      return finishDistance < 1.5 ? 1 : finishDistance < 2.3 ? 0.88 : 0.64;
    }
    for (const mountain of this.mountains) {
      const distanceToSummit = mountain.km - km;
      if (distanceToSummit >= 0 && distanceToSummit <= 3.5) {
        const categoryBoost = mountain.category === "Especial" ? 0.24 : mountain.category === "1ª" ? 0.14
          : mountain.category === "2ª" ? 0.07 : 0;
        if (distanceToSummit < 0.8) return 1;
        if (distanceToSummit < 2) return clamp(0.72 + categoryBoost, 0, 1);
        return clamp(0.38 + categoryBoost, 0, 1);
      }
    }
    const sprintDistance = this.intermediateSprints.reduce((nearest, point) =>
      Math.min(nearest, Math.abs(point.km - km)), Infinity);
    if (sprintDistance <= 0.8) return 1;
    if (sprintDistance <= 1.5) return 0.72;
    return this.biomeAt(km).id === "city" ? 0.18 : 0;
  }

  getGradient(km) {
    const section = this.profile.find((item) => km >= item.startKm && km < item.endKm) || this.profile.at(-1);
    return section.gradient;
  }

  buildElevationMap() {
    const count = Math.ceil(this.lengthKm / this.elevationStep);
    for (let index = 1; index <= count; index += 1) {
      const km = Math.min(this.lengthKm, (index - 0.5) * this.elevationStep);
      const gradient = this.getGradient(km);
      // Una pendiente del 1 % gana exactamente 10 metros por kilómetro.
      const elevationDelta = gradient * 10 * this.elevationStep;
      this.elevations[index] = this.elevations[index - 1] + elevationDelta;
      this.ascents[index] = this.ascents[index - 1] + Math.max(0, elevationDelta);
    }
    this.totalAscent = this.ascents.at(-1);
    this.finishElevation = this.elevations.at(-1);
  }

  sampleMap(values, km) {
    const position = clamp(km, 0, this.lengthKm) / this.elevationStep;
    const before = Math.floor(position);
    const after = Math.min(values.length - 1, before + 1);
    return lerp(values[before], values[after], position - before);
  }

  elevationAt(km) {
    return this.sampleMap(this.elevations, km);
  }

  ascentAt(km) {
    return this.sampleMap(this.ascents, km);
  }

  curvatureAt(km) {
    const broad = Math.sin(km * 0.47) * 0.42 + Math.sin(km * 0.16 + 1.4) * 0.24;
    const sharp = this.dangerousCurves.reduce((sum, curveKm, index) => {
      const distance = Math.abs(km - curveKm);
      return sum + (distance < 0.55 ? (1 - distance / 0.55) * (index % 2 ? -0.82 : 0.82) : 0);
    }, 0);
    return clamp(broad + sharp, -1, 1);
  }

  nextDanger(km) {
    return this.dangerousCurves.find((curveKm) => curveKm > km);
  }

  renderProfile(ctx, width, height, progress, groups = [], selectedGroupIndex = -1) {
    ctx.clearRect(0, 0, width, height);
    const markerScale = width >= 700 ? 1.35 : 1;
    const points = [];
    for (let x = 0; x <= width; x += 2) {
      const km = (x / width) * this.lengthKm;
      points.push({ x, elevation: this.elevationAt(km) });
    }
    const min = Math.min(...points.map((p) => p.elevation));
    const max = Math.max(...points.map((p) => p.elevation));
    const range = Math.max(1, max - min);
    ctx.beginPath();
    ctx.moveTo(0, height - 4);
    for (const point of points) {
      const y = height - 7 - ((point.elevation - min) / range) * (height - 17);
      ctx.lineTo(point.x, y);
    }
    ctx.lineTo(width, height - 4);
    ctx.closePath();
    ctx.fillStyle = "rgba(255,204,51,.28)";
    ctx.fill();
    for (const zone of this.sceneryZones) {
      ctx.fillStyle = zone.ground;
      ctx.fillRect(zone.startKm / this.lengthKm * width, height - 5, (zone.endKm - zone.startKm) / this.lengthKm * width + 1, 5);
    }
    ctx.strokeStyle = "#ffcc33";
    ctx.lineWidth = 2;
    ctx.stroke();
    for (const point of this.racePoints) {
      const x = point.km / this.lengthKm * width;
      const elevation = this.elevationAt(point.km);
      const y = height - 7 - ((elevation - min) / range) * (height - 17);
      ctx.fillStyle = racePointColor(point);
      if (point.type === "mountain") {
        ctx.beginPath();
        ctx.moveTo(x, y - 7 * markerScale);
        ctx.lineTo(x - 4 * markerScale, y);
        ctx.lineTo(x + 4 * markerScale, y);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.fillRect(Math.round(x - 3 * markerScale), Math.round(y - 6 * markerScale), 6 * markerScale, 6 * markerScale);
      }
    }
    const markerX = clamp(progress, 0, 1) * width;
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(markerX, 3);
    ctx.lineTo(markerX, height - 3);
    ctx.stroke();
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(markerX, 5, 3.5, 0, Math.PI * 2);
    ctx.fill();
    const groupMarkers = [];
    groups.forEach((group, index) => {
      const x = clamp(group.leader.distance / this.lengthKm, 0, 1) * width;
      const elevation = this.elevationAt(group.leader.distance);
      const profileY = height - 7 - ((elevation - min) / range) * (height - 17);
      const stack = index % 4;
      const selected = index === selectedGroupIndex;
      const markerSize = (selected ? 10 : 8) * markerScale;
      const y = clamp(profileY - 8 * markerScale - stack * 7 * markerScale, markerSize / 2, height - markerSize / 2);
      ctx.fillStyle = selected ? "#ffffff" : group.leader.color;
      ctx.fillRect(Math.round(x - markerSize / 2), Math.round(y - markerSize / 2), markerSize, markerSize);
      ctx.strokeStyle = "#101820";
      ctx.lineWidth = 1;
      ctx.strokeRect(Math.round(x - markerSize / 2), Math.round(y - markerSize / 2), markerSize, markerSize);
      ctx.fillStyle = selected ? "#101820" : "#ffffff";
      ctx.font = `bold ${Math.round(7 * markerScale)}px Menlo, Monaco, Consolas, monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(index + 1), x, y + 0.5);
      ctx.strokeStyle = group.leader.color;
      ctx.beginPath();
      ctx.moveTo(x, y + markerSize / 2);
      ctx.lineTo(x, profileY);
      ctx.stroke();
      groupMarkers.push({ x, y, groupIndex: index });
    });
    return groupMarkers;
  }
}

class WeatherSystem {
  constructor(mode = "dynamic", lengthKm = 180) {
    this.mode = mode;
    this.lengthKm = lengthKm;
    this.state = "dry";
    this.previousState = "dry";
    // Cuando aparece, la lluvia ocupa la mayor parte restante de la etapa y
    // no alterna en episodios cortos. La intensidad aumenta progresivamente.
    this.rainStartKm = mode === "rain" ? 0 : lengthKm * 0.18;
    this.heavyRainKm = mode === "rain" ? lengthKm * 0.2 : lengthKm * 0.55;
  }

  update(km) {
    this.previousState = this.state;
    if (this.mode === "dry") this.state = "dry";
    else if (km < this.rainStartKm) this.state = "dry";
    else if (km < this.heavyRainKm) this.state = "light";
    else this.state = "heavy";
    return this.state !== this.previousState;
  }

  get intensity() { return this.state === "heavy" ? 1 : this.state === "light" ? 0.48 : 0; }
  get label() { return this.state === "heavy" ? "LLUVIA INTENSA" : this.state === "light" ? "LLUVIA LIGERA" : "SECO"; }
  get icon() { return this.state === "heavy" ? "☂" : this.state === "light" ? "☁" : "☀"; }
}

class ParticleSystem {
  constructor(max = 220) {
    this.max = max;
    this.splashLimit = Math.max(30, Math.round(max * 0.45));
    this.rain = [];
    this.splashes = [];
  }

  setDeviceBudget(isCompact) {
    this.max = isCompact ? 88 : 180;
    this.splashLimit = isCompact ? 36 : 80;
    if (this.rain.length > this.max) this.rain.length = this.max;
    if (this.splashes.length > this.splashLimit) this.splashes.length = this.splashLimit;
  }

  update(dt, width, height, weatherIntensity, playerSpeed) {
    const desired = Math.floor(this.max * weatherIntensity);
    while (this.rain.length < desired) {
      this.rain.push({
        x: Math.random() * width,
        y: Math.random() * height,
        length: 7 + Math.random() * 17,
        speed: 430 + Math.random() * 380
      });
    }
    if (this.rain.length > desired) this.rain.length = desired;
    for (const drop of this.rain) {
      drop.x -= dt * (150 + playerSpeed * 2);
      drop.y += dt * drop.speed;
      if (drop.y > height || drop.x < -30) {
        drop.x = Math.random() * (width + 80);
        drop.y = -20;
      }
    }
    for (let index = this.splashes.length - 1; index >= 0; index -= 1) {
      const splash = this.splashes[index];
      splash.life -= dt;
      splash.x += splash.vx * dt;
      splash.y += splash.vy * dt;
      splash.vy += 60 * dt;
      if (splash.life <= 0) this.splashes.splice(index, 1);
    }
  }

  addSplash(x, y, amount = 3) {
    for (let i = 0; i < amount && this.splashes.length < this.splashLimit; i += 1) {
      this.splashes.push({
        x, y, vx: (Math.random() - 0.5) * 55, vy: -20 - Math.random() * 45,
        life: 0.25 + Math.random() * 0.28, maxLife: 0.53
      });
    }
  }

  render(ctx) {
    ctx.save();
    ctx.strokeStyle = "rgba(210,235,240,.42)";
    ctx.lineWidth = 1.15;
    ctx.beginPath();
    for (const drop of this.rain) {
      ctx.moveTo(drop.x, drop.y);
      ctx.lineTo(drop.x - drop.length * 0.42, drop.y + drop.length);
    }
    ctx.stroke();
    for (const splash of this.splashes) {
      ctx.globalAlpha = clamp(splash.life / splash.maxLife, 0, 1);
      ctx.fillStyle = "#d8edf0";
      ctx.fillRect(splash.x, splash.y, 1.5, 1.5);
    }
    ctx.restore();
  }
}

class AudioManager {
  constructor() {
    const storedEnabled = safeJsonParse(safeStorageGet("ultimoPuerto.sound", "true"), true);
    this.enabled = typeof storedEnabled === "boolean" ? storedEnabled : true;
    const storedVolume = Number(safeStorageGet("ultimoPuerto.volume", 0.55));
    this.volume = Number.isFinite(storedVolume) ? clamp(storedVolume, 0, 1) : 0.55;
    this.context = null;
    this.musicTimer = 0;
    this.roadTimer = 0;
    this.crowdTimer = 0;
    this.lastDrafting = false;
  }

  unlock() {
    if (!this.enabled) return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!this.context && AudioContextClass) this.context = new AudioContextClass();
    if (this.context?.state === "suspended") this.context.resume();
  }

  setVolume(value) {
    const nextVolume = Number(value);
    if (!Number.isFinite(nextVolume)) return;
    this.volume = clamp(nextVolume, 0, 1);
    safeStorageSet("ultimoPuerto.volume", this.volume);
  }

  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
    safeStorageSet("ultimoPuerto.sound", JSON.stringify(this.enabled));
    if (this.enabled) this.unlock();
  }

  toggle() {
    this.setEnabled(!this.enabled);
    return this.enabled;
  }

  tone(frequency = 440, duration = 0.06, type = "square", level = 0.04, delay = 0) {
    if (!this.enabled || !this.context) return;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    const start = this.context.currentTime + delay;
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(Math.max(0.0001, level * this.volume), start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain).connect(this.context.destination);
    oscillator.start(start);
    oscillator.stop(start + duration);
  }

  cue(frequency = 440, duration = 0.06) {
    this.tone(frequency, duration, "square", 0.04);
  }

  sequence(notes, type = "square", level = 0.04) {
    let delay = 0;
    for (const note of notes) {
      const [frequency, duration = 0.06] = Array.isArray(note) ? note : [note, 0.06];
      this.tone(frequency, duration, type, level, delay);
      delay += duration * 0.8;
    }
  }

  noise(duration = 0.1, level = 0.025) {
    if (!this.enabled || !this.context) return;
    const count = Math.max(1, Math.floor(this.context.sampleRate * duration));
    const buffer = this.context.createBuffer(1, count, this.context.sampleRate);
    const channel = buffer.getChannelData(0);
    for (let index = 0; index < count; index += 1) {
      channel[index] = (Math.random() * 2 - 1) * (1 - index / count);
    }
    const source = this.context.createBufferSource();
    const gain = this.context.createGain();
    source.buffer = buffer;
    gain.gain.value = level * this.volume;
    source.connect(gain).connect(this.context.destination);
    source.start();
  }

  play(name) {
    if (!this.enabled || !this.context) return;
    const sounds = {
      power: [[330, 0.045], [440, 0.055]],
      gel: [[520, 0.035], [690, 0.035], [880, 0.08]],
      attack: [[260, 0.04], [390, 0.04], [620, 0.1]],
      rivalAttack: [[220, 0.05], [330, 0.05], [470, 0.08]],
      sprint: [[440, 0.035], [660, 0.035], [880, 0.035], [1100, 0.11]],
      danger: [[180, 0.08], [180, 0.08]],
      mountain: [[392, 0.07], [523, 0.07], [659, 0.12]],
      checkpoint: [[620, 0.05], [820, 0.05], [1040, 0.1]],
      lastKm: [[523, 0.06], [659, 0.06], [784, 0.06], [1047, 0.15]],
      finish: [[523, 0.07], [659, 0.07], [784, 0.07], [1047, 0.22]]
    };
    if (sounds[name]) this.sequence(sounds[name], "square", name === "danger" ? 0.055 : 0.04);
    if (name === "gel" || name === "checkpoint" || name === "finish") this.noise(0.06, 0.018);
  }

  update(race, dt) {
    if (!this.enabled || !this.context || !race?.player || race.player.finished) return;
    const player = race.player;
    // El rebufo oscila de forma natural al corregir la distancia. Usarlo como
    // disparador de audio producía una sucesión de pitidos al cruzar el umbral.
    // El estado sigue disponible para la interfaz, pero ya no genera sonidos.
    if (!this.lastDrafting && player.draft >= 45) this.lastDrafting = true;
    else if (this.lastDrafting && player.draft <= 15) this.lastDrafting = false;
    this.musicTimer -= dt;
    this.roadTimer -= dt;
    this.crowdTimer -= dt;
    const remaining = race.road.lengthKm - player.distance;
    const gradient = race.road.getGradient(player.distance);
    const intense = remaining <= 1 || player.attacking > 0 || player.sprinting;
    if (this.musicTimer <= 0) {
      const scale = intense ? [523, 659, 784, 880] : gradient > 4 ? [392, 466, 523, 587] : [330, 392, 440, 494];
      const beat = Math.floor(race.elapsed * (intense ? 5 : 2.4)) % scale.length;
      this.tone(scale[beat], intense ? 0.075 : 0.055, "square", intense ? 0.018 : 0.009);
      this.musicTimer = intense ? 0.18 : gradient > 4 ? 0.3 : 0.46;
    }
    if (this.roadTimer <= 0) {
      this.noise(0.045, race.weather.intensity > 0.2 ? 0.012 : 0.006);
      this.roadTimer = 1.15;
    }
    const crowd = race.road.spectatorDensityAt(player.distance);
    if (crowd > 0.35 && this.crowdTimer <= 0) {
      this.noise(0.12, 0.012 + crowd * 0.012);
      this.tone(700 + Math.floor(race.elapsed * 7) % 4 * 90, 0.05, "square", 0.008 + crowd * 0.006);
      this.crowdTimer = 0.22 + (1 - crowd) * 0.34;
    }
  }
}

class Cyclist {
  constructor(data) {
    Object.assign(this, data);
    this.distance = data.distance ?? 0;
    this.lateral = data.lateral ?? 0;
    this.targetLateral = this.lateral;
    this.speed = data.speed ?? 34;
    this.targetSpeed = this.speed;
    this.energy = 100;
    this.explosive = 100;
    this.nutrition = 100;
    this.grip = 100;
    this.fatigue = 0;
    this.effort = 2;
    this.recoversEnergy = true;
    this.highEffortTime = 0;
    this.riskMode = "normal";
    this.pendingRiskMode = "normal";
    this.riskTransition = 0;
    this.draft = 0;
    this.attacking = 0;
    this.sprinting = false;
    this.sprintMultiplier = 1;
    this.sprintQuality = "";
    this.attackMultiplier = 1;
    this.attackCooldown = 0;
    this.moraleTimer = 0;
    this.crashTimer = 0;
    this.riskAccumulator = 0;
    this.avoidanceBrake = 0;
    this.avoiding = false;
    this.collisionCooldown = 0;
    this.previousDistance = this.distance;
    this.finishTime = null;
    this.maxSpeed = this.speed;
    this.group = "PELOTÓN";
    this.finished = false;
    this.role = data.role || "leader";
    this.roleLabel = data.roleLabel || "LÍDER";
    this.tacticalState = "RECUPERAR";
    this.tacticalStateSince = 0;
    this.targetWheel = null;
    this.sacrificing = false;
    this.protectionPuller = false;
    this.teamProtection = 0;
    this.teamworkBonus = 0;
    this.breakawayBonus = 0;
    this.conditionBonus = 0;
    this.relayBonus = 0;
    this.relayParticipant = false;
    this.relayPulling = false;
  }

  setRiskMode(mode) {
    if (!["safe", "normal", "aggressive"].includes(mode) || mode === this.riskMode) return;
    this.pendingRiskMode = mode;
    this.riskTransition = 0.7;
  }

  calculateGrip(weather, road) {
    const rainLoss = weather.intensity * 27;
    const speedLoss = Math.max(0, this.speed - 42) * 0.42;
    const curveLoss = Math.abs(road.curvatureAt(this.distance)) * 20;
    const fatigueLoss = this.fatigue * 0.08;
    const modeLoss = this.riskMode === "aggressive" ? 10 : this.riskMode === "safe" ? -8 : 0;
    this.grip = clamp(100 - rainLoss - speedLoss - curveLoss - fatigueLoss - modeLoss + this.technique * 0.08, 18, 100);
    return this.grip;
  }

  updateCommon(dt, context) {
    if (this.finished) return;
    const { road, weather, simulationScale } = context;
    this.previousDistance = this.distance;
    const gradient = road.getGradient(this.distance);
    const remaining = road.lengthKm - this.distance;
    if (this.riskTransition > 0) {
      this.riskTransition = Math.max(0, this.riskTransition - dt);
      if (this.riskTransition === 0) this.riskMode = this.pendingRiskMode;
    }
    const riskBonus = this.riskMode === "aggressive" ? 1.7 : this.riskMode === "safe" ? -1.5 : 0;
    const effortBonus = [-4.5, 0, 1, 4.2, 7.2][this.effort - 1];
    const attackBonus = this.attacking > 0 ? 6.2 * this.attackMultiplier : 0;
    const sprintBonus = this.sprinting && this.explosive > 0 ? (7.2 + this.sprint * 0.05) * this.sprintMultiplier : 0;
    const draftingBonus = this.draft * 0.035;
    const moraleBonus = this.moraleTimer > 0 ? 0.45 : 0;
    const isolationExposure = context.race?.isolationExposureFor(this) || 0;
    const teamworkBonus = this.teamworkBonus || 0;
    const roleTerrainBonus = this.role === "sprinter" && road.stageProfile === "flat" && remaining < 10
      ? 3.8
      : this.role === "climber" && gradient >= 3.5 ? 1.15
        : this.role === "sprinter" && gradient >= 3.5 ? -1.1
          : this.role === "attacker" && Math.abs(gradient) < 2 && remaining > 8 ? 0.28 : 0;
    // Las rampas largas deben cambiar de verdad la velocidad de carrera. A
    // partir del 4 % la penalización crece de forma adicional; montaña y
    // resistencia siguen diferenciando a los especialistas.
    const climbPenalty = gradient > 0
      ? gradient * (1.13 - this.climbing * 0.0044) +
        Math.max(0, gradient - 4) * (0.98 - this.climbing * 0.0028)
      : gradient * 0.44;
    const fatiguePenalty = this.fatigue * 0.075;
    const nutritionPenalty = this.nutrition < 25 ? (25 - this.nutrition) * 0.17 : 0;
    const weatherPenalty = weather.intensity * (1.2 + Math.abs(road.curvatureAt(this.distance)));
    const energyFactor = 0.62 + this.energy * 0.0038;
    this.targetSpeed = clamp(
      (37 + (this.balanceBonus || 0) + effortBonus + attackBonus + sprintBonus + draftingBonus + riskBonus + moraleBonus + teamworkBonus + (this.breakawayBonus || 0) + (this.conditionBonus || 0) + (this.relayBonus || 0) + roleTerrainBonus - climbPenalty - fatiguePenalty - nutritionPenalty - weatherPenalty - isolationExposure * 0.9 - this.avoidanceBrake) * energyFactor,
      10, 76
    );
    if (this.crashTimer > 0) {
      this.crashTimer -= dt;
      this.targetSpeed = this.crashTimer > 1.3 ? 5 : 20;
    }
    this.speed = lerp(this.speed, this.targetSpeed, 1 - Math.exp(-dt * 1.7));
    this.maxSpeed = Math.max(this.maxSpeed, this.speed);
    this.distance += (this.speed * simulationScale / 3600) * dt;
    const wasAttacking = this.attacking > 0;
    this.attacking = Math.max(0, this.attacking - dt);
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    this.moraleTimer = Math.max(0, this.moraleTimer - dt);
    if (wasAttacking && this.attacking === 0 && !this.sprinting) this.effort = 4;

    this.highEffortTime = this.effort >= 4 ? this.highEffortTime + dt : Math.max(0, this.highEffortTime - dt * 1.6);
    const effortLoad = [0.08, 0.22, 0.42, 0.76, 1.05][this.effort - 1];
    const climbLoad = Math.max(0, gradient) * 0.035;
    const draftSaving = this.draft * 0.0042;
    const teamProtectionSaving = clamp(this.teamProtection || 0, 0, 1) * 0.2;
    const sacrificeLoad = this.sacrificing ? 0.17 : 0;
    // Un gregario que abre paso y mantiene al líder a rueda soporta un coste
    // aerodinámico propio, muy superior al de limitarse a rodar en Alto.
    const protectionPullLoad = this.protectionPuller ? PROTECTION_PULL_LOAD : 0;
    const aggressionLoad = this.riskMode === "aggressive" ? 0.08 : 0;
    const rainLoad = weather.intensity * 0.06;
    const nutritionLoad = this.nutrition < 28 ? 0.22 : 0;
    const enduranceFactor = clamp(1.18 - (this.endurance || 70) * 0.0045, 0.78, 0.9);
    const progressiveHighLoad = this.effort >= 4 ? clamp((this.highEffortTime - 10) * 0.018, 0, 0.38) : 0;
    const descending = gradient <= RECOVERY_DESCENT_GRADIENT;
    const exposureLoad = this.effort >= 4 && !descending
      ? isolationExposure * ISOLATION_HIGH_EFFORT_LOAD
      : 0;
    const energyRate = Math.max(0.02, (effortLoad + climbLoad + aggressionLoad + rainLoad + nutritionLoad +
      progressiveHighLoad + exposureLoad + sacrificeLoad + protectionPullLoad -
      draftSaving - teamProtectionSaving) * enduranceFactor);
    const canRecover = this.recoversEnergy && this.attacking <= 0 && !this.sprinting && this.crashTimer <= 0;
    const nutritionFactor = clamp((this.nutrition - 18) / 55, 0, 1);
    const recoveryRate = canRecover && this.effort === 1
      ? 0.17 * nutritionFactor
      : canRecover && this.effort === 2 && descending ? 0.078 * nutritionFactor : 0;
    // En descenso, rodar en Alto no añade coste energético. Ataque y sprint
    // siguen pagando su coste específico en explosividad.
    const freeHighEffortDescent = this.effort >= 4 && descending && !this.protectionPuller;
    const energyChange = freeHighEffortDescent ? 0 : recoveryRate - energyRate * 0.21;
    this.energy = clamp(this.energy + energyChange * dt, 0, 100);
    this.fatigue = clamp(this.fatigue + energyRate * dt * 0.12 - (this.effort === 1 ? dt * 0.065 : this.effort === 2 ? dt * 0.028 : 0), 0, 100);
    this.nutrition = clamp(this.nutrition - dt * (0.075 + this.effort * 0.008), 0, 100);

    if (this.effort <= 2 && this.attacking <= 0 && !this.sprinting && this.nutrition > 15) {
      this.explosive = clamp(this.explosive + dt * (this.effort === 1 ? 0.5 : 0.31) * nutritionFactor, 0, 100);
    }
    if (this.attacking > 0) this.explosive = clamp(this.explosive - dt * 1.8, 0, 100);
    if (this.sprinting) this.explosive = clamp(this.explosive - dt * 7.3, 0, 100);
    if (this.explosive <= 0.5) {
      this.sprinting = false;
      if (this.effort === 5) this.effort = 4;
    }

    this.lateral = lerp(this.lateral, this.targetLateral, 1 - Math.exp(-dt * 1.9));
    this.avoidanceBrake = Math.max(0, this.avoidanceBrake - dt * 3.8);
    this.collisionCooldown = Math.max(0, this.collisionCooldown - dt);
    this.calculateGrip(weather, road);
  }
}

class PlayerCyclist extends Cyclist {
  constructor(data) {
    super(data);
    this.effort = 2;
    this.recoversEnergy = true;
    this.gels = 3;
    this.gelTimer = 0;
    this.seekingWheel = false;
    this.wheelTarget = null;
    this.relayWheelTarget = null;
    this.attacks = 0;
    this.draftTime = 0;
    this.crashes = 0;
    this.gelsUsed = 0;
    this.mountainPoints = 0;
    this.sprintPoints = 0;
    this.relayTime = 0;
    this.relayTurns = 0;
    this.rivalRelayAttacks = 0;
    this.wasDrafting = false;
    this.lastRiskWarning = 0;
    this.lastWheelPowerWarning = -20;
    this.sprintAllowed = false;
    this.responseSprintTimer = 0;
  }

  attack(multiplier = 1, quality = "BUENO") {
    if (this.attacking > 0 || this.attackCooldown > 0 || this.explosive < 20 || this.crashTimer > 0) return false;
    this.attacking = 3.6;
    this.attackCooldown = 12;
    this.attackMultiplier = multiplier;
    this.attackQuality = quality;
    this.explosive -= 14;
    this.effort = 5;
    this.seekingWheel = false;
    this.wheelTarget = null;
    this.attacks += 1;
    return true;
  }

  sprintNow(multiplier = 1, quality = "BUENO", duration = Infinity) {
    if (!this.sprintAllowed || this.explosive < 5 || this.crashTimer > 0) return false;
    this.sprinting = true;
    this.sprintMultiplier = multiplier;
    this.sprintQuality = quality;
    this.responseSprintTimer = Number.isFinite(duration) ? Math.max(0, duration) : 0;
    this.effort = 5;
    this.seekingWheel = false;
    this.wheelTarget = null;
    return true;
  }

  eatGel() {
    if (this.gels <= 0 || this.gelTimer > 0) return false;
    this.gels -= 1;
    this.gelsUsed += 1;
    this.gelTimer = 2.2;
    return true;
  }

  update(dt, context) {
    if (this.sprinting && this.responseSprintTimer > 0) {
      this.responseSprintTimer = Math.max(0, this.responseSprintTimer - dt);
      if (this.responseSprintTimer === 0) {
        this.sprinting = false;
        this.sprintMultiplier = 1;
        if (this.effort === 5) this.effort = 4;
        context.game.notify("Respuesta terminada. Mantén ALTO si aún no has igualado su velocidad.");
      }
    }
    if (this.gelTimer > 0) {
      this.gelTimer -= dt;
      if (this.gelTimer <= 0) {
        this.nutrition = clamp(this.nutrition + 32, 0, 100);
        this.energy = clamp(this.energy + 5, 0, 100);
        context.game.showResourceFeedback([
          { icon: "▰", text: "+32 NUTRICIÓN", type: "positive" },
          { icon: "♥", text: "+5 ENERGÍA", type: "positive" }
        ]);
        context.game.notify("El gel empieza a hacer efecto.");
      }
    }
    if (this.draft > 8) this.draftTime += dt;
    this.updateCommon(dt, context);
  }
}

class AICyclist extends Cyclist {
  constructor(data, random) {
    super(data);
    this.type = data.type;
    this.decisionTimer = 0.4 + random.next() * 1.2;
    this.personalityPhase = random.next() * Math.PI * 2;
    this.lastAttackKm = -100;
    this.feeds = 2;
    this.random = random;
    this.memory = {
      lastAttack: -100,
      energyAtDecision: 100,
      teammate: null,
      rival: null,
      pointObjective: null
    };
  }

  setTacticalState(state, race) {
    if (state === this.tacticalState) return;
    this.tacticalState = state;
    this.tacticalStateSince = race.elapsed;
  }

  selectTacticalWheel(race, team) {
    const active = race.ranking.filter((rider) => !rider.finished);
    const position = active.indexOf(this);
    const nearestAhead = position > 0 ? active[position - 1] : null;
    let target = nearestAhead;
    if (this.tacticalState === "PROTEGER" && this.role === "domestique") {
      const protectedRider = team.plan?.protectedRider;
      if (protectedRider && protectedRider.distance > this.distance + 0.008) {
        target = protectedRider;
      } else if (protectedRider && this.distance - protectedRider.distance < 0.28) {
        target = null;
        this.targetLateral = clamp(protectedRider.lateral + Math.sin(this.personalityPhase) * 0.18, -0.9, 0.9);
      }
    } else if (this.tacticalState === "PREPARAR SPRINT") {
      const teammatesAhead = team.riders
        .filter((rider) => rider !== this && !rider.finished && rider.distance > this.distance)
        .sort((a, b) => a.distance - b.distance);
      target = teammatesAhead[0] || nearestAhead;
    } else if (this.tacticalState === "PERSEGUIR") {
      target = nearestAhead;
    }
    if (target && target !== this && target.distance - this.distance < 1.1) {
      this.targetWheel = target;
      this.memory.teammate = target.team === this.team ? target : this.memory.teammate;
      this.memory.rival = target.team !== this.team ? target : this.memory.rival;
      this.targetLateral = clamp(target.lateral + Math.sin(this.personalityPhase) * 0.025, -0.9, 0.9);
    } else {
      this.targetWheel = null;
    }
  }

  launchAttack(context, multiplier = 1) {
    if (context.race.isRelayTeammate(this)) return false;
    if (this.attackCooldown > 0 || this.explosive < 28 || this.energy < 42) return false;
    const attacksFromRelay = context.race.isRelayRival(this);
    this.attacking = 3.2;
    this.attackCooldown = 12;
    this.attackMultiplier = multiplier;
    this.explosive -= 13;
    this.effort = 5;
    this.lastAttackKm = this.distance;
    this.memory.lastAttack = context.race.elapsed;
    context.race.lastRivalAttackTime = context.race.elapsed;
    if (attacksFromRelay) {
      context.race.player.rivalRelayAttacks += 1;
      context.race.removeRelayParticipant(this, true);
    }
    const team = context.race.teamByName.get(this.team);
    if (team) {
      team.initiatives += 1;
      team.lastAttackTime = context.race.elapsed;
      team.nextAttackKm = Math.min(context.road.lengthKm - 8, this.distance + 34 + this.random.next() * 24);
    }
    if (!context.race.simulationOnly && (this.role === "leader" || context.race.positionOf(this) < 8)) {
      context.game.audio.play("rivalAttack");
      const attackMessage = attacksFromRelay
        ? `¡${this.flag || ""} ${this.name} rompe el relevo y ataca!`
        : `¡${this.team} mueve carrera con ${this.name}!`;
      context.game.notify(
        `${attackMessage} Iguala su velocidad con ALTO o usa SPRINT; RELEVO no lo detiene.`,
        "urgent"
      );
    }
    return true;
  }

  decide(context) {
    const { road, race } = context;
    if (race.timeTrial) {
      const remaining = road.lengthKm - this.distance;
      this.targetWheel = null;
      this.teamworkBonus = 0;
      this.draft = 0;
      this.targetLateral = 0;
      this.sacrificing = false;
      this.effort = remaining < 0.45 && this.explosive > 8 ? 5
        : this.energy < 24 ? 2
          : remaining < road.lengthKm * 0.18 || this.energy > 67 ? 4 : 3;
      this.sprinting = remaining < 0.42 && this.explosive > 8;
      this.sprintMultiplier = 1.05 + this.sprint * 0.0015;
      this.setRiskMode(remaining < 2 ? "aggressive" : "normal");
      return;
    }
    const team = race.teamByName.get(this.team);
    const plan = team?.plan || { state: "RECUPERAR", protectedRider: null };
    const gradient = road.getGradient(this.distance);
    const remaining = road.lengthKm - this.distance;
    const position = race.positionOf(this);
    const leaderGap = race.leader.distance - this.distance;
    const nextPoint = road.racePoints.find((point) => point.km > this.distance);
    this.memory.energyAtDecision = this.energy;
    this.memory.pointObjective = nextPoint || null;
    let desiredState = plan.state;
    const managedTeammate = this.team === race.player.team;
    if (managedTeammate && plan.state === "RECUPERAR") {
      if (this.stageRole === "finish") desiredState = "RECUPERAR";
      if (this.stageRole === "support") desiredState = "PROTEGER";
      if (this.stageRole === "stage" && remaining < Math.max(18, road.lengthKm * 0.2)) {
        desiredState = this.energy > 45 ? "ATACAR" : "PROTEGER";
      }
      if (this.stageRole === "points" &&
        ((nextPoint?.type === "sprint" && nextPoint.km - this.distance < 5) || remaining < 7)) {
        desiredState = "PREPARAR SPRINT";
      }
      if (this.stageRole === "mountain" && nextPoint?.type === "mountain" &&
        nextPoint.km - this.distance < 6) {
        desiredState = this.energy > 42 ? "ATACAR" : "PROTEGER";
      }
    }
    if (plan.state === "PERSEGUIR" && this === team?.objectiveRider) desiredState = "PROTEGER";
    if (plan.state === "ATACAR" && !["attacker", "climber"].includes(this.role)) desiredState = "PROTEGER";
    if (plan.state === "PREPARAR SPRINT" && this.role === "leader" && this !== team?.sprinter) desiredState = "PROTEGER";
    if (race.player.attacking > 0 && race.player.distance - this.distance > -0.08 &&
      race.player.distance - this.distance < 0.4 && ["leader", "domestique"].includes(this.role)) {
      desiredState = "PERSEGUIR";
      this.memory.rival = race.player;
    }
    this.setTacticalState(desiredState, race);
    this.selectTacticalWheel(race, team || { riders: [], plan: {} });
    const nearbyHelpers = team?.riders.filter((rider) =>
      rider !== this && rider.role === "domestique" && !rider.finished &&
      Math.abs(rider.distance - this.distance) < 0.32).length || 0;
    this.teamworkBonus = this === team?.objectiveRider && this.tacticalState === "PREPARAR SPRINT" && this.role === "sprinter"
      ? 0.85 * race.difficultyConfig.coordination + Math.min(1.15, nearbyHelpers * 0.22)
      : this === team?.objectiveRider && this.tacticalState === "PROTEGER"
        ? Math.min(1.15, nearbyHelpers * 0.22 * race.difficultyConfig.coordination)
      : this.tacticalState === "PERSEGUIR" && this.role === "domestique"
        ? 0.6 * race.difficultyConfig.coordination + (road.stageProfile === "flat" ? 0.2 : 0) + race.chaseUrgency * 0.85
        : this.tacticalState === "PREPARAR SPRINT" && this.role === "domestique" ? 0.28 : 0;

    const sprintDistance = 0.34 + this.intelligence * 0.0022;
    const intermediateSprint = nextPoint?.type === "sprint" && nextPoint.km - this.distance <= sprintDistance;
    const sprintCandidate = this.role === "sprinter" || this.stageRole === "points" || this === team?.objectiveRider ||
      (this.role === "leader" && this.sprint > 80);
    if (sprintCandidate && (remaining <= sprintDistance || intermediateSprint) && this.explosive > 10) {
      this.sprinting = true;
      this.sprintMultiplier = this.role === "sprinter"
        ? (this.intelligence > 82 ? 1.2 : 1.12)
        : this.intelligence > 82 ? 1.08 : this.intelligence > 72 ? 1 : 0.9;
      this.effort = 5;
      this.setRiskMode("aggressive");
      return;
    }
    if (this.sprinting && remaining > sprintDistance) this.sprinting = false;

    this.breakawayBonus = 0;
    const breakawayInstruction = race.breakawayInstructionFor(this);
    if (breakawayInstruction) {
      this.setTacticalState("FUGA", race);
      this.targetWheel = breakawayInstruction.wheel;
      if (breakawayInstruction.wheel) {
        this.targetLateral = clamp(
          breakawayInstruction.wheel.lateral + Math.sin(this.personalityPhase) * 0.04,
          -0.9, 0.9
        );
      }
      this.breakawayBonus = breakawayInstruction.bonus;
      this.teamworkBonus = breakawayInstruction.establishing ? 0.35 : 0.65;
      this.effort = breakawayInstruction.establishing ? 5 : breakawayInstruction.pulling ? 4 : 3;
      this.sacrificing = breakawayInstruction.pulling;
      this.setRiskMode(breakawayInstruction.establishing ? "aggressive" : "normal");
      if (breakawayInstruction.establishing && this.attackCooldown <= 0 &&
        leaderGap < 0.72 && this.energy > 42 && this.explosive > 28) {
        this.launchAttack(context, breakawayInstruction.attackMultiplier);
      }
      return;
    }

    const mistake = this.random.next() < race.difficultyConfig.errorRate;
    if (mistake && remaining > 4) {
      const backsOffTooMuch = this.random.next() < race.difficultyConfig.mistakeLowChance;
      this.effort = this.energy < 55 || backsOffTooMuch ? 1 : 2;
      this.targetWheel = backsOffTooMuch ? null : this.targetWheel;
      this.setRiskMode("normal");
      return;
    }

    const mountainAttackDistance = nextPoint?.category === "Especial" ? 4
      : nextPoint?.category === "1ª" ? 3.2 : nextPoint?.category === "2ª" ? 2.7 : 2.2;
    const mountainOpportunity = nextPoint?.type === "mountain" && nextPoint.km - this.distance < mountainAttackDistance;
    const isClimberMoment = gradient > 5 && ["climber", "leader", "attacker"].includes(this.role);
    const relayAttack = race.isRelayRival(this) && race.relay.leader === this &&
      race.elapsed - race.relay.lastRivalAttackAt > 11 && remaining > 3 &&
      this.random.next() < 0.08 + this.aggression * 0.0012;
    const tacticalAttack = this.attackCooldown <= 0 && this.distance - this.lastAttackKm > 18 && this.energy > 47 && this.explosive > 28 &&
      ((this.tacticalState === "ATACAR" && ["attacker", "climber"].includes(this.role)) ||
        (isClimberMoment && mountainOpportunity && this === team?.objectiveRider) || relayAttack);
    if (tacticalAttack && leaderGap < 0.32) {
      if (relayAttack) race.relay.lastRivalAttackAt = race.elapsed;
      if (this.launchAttack(context, relayAttack ? 1.12 : ["climber", "leader"].includes(this.role) ? 1.08 : 1)) return;
    }

    this.sacrificing = false;
    if (this.energy < 28 || this.nutrition < 18) {
      this.effort = 1;
      this.setTacticalState("RECUPERAR", race);
    } else if (this.tacticalState === "PERSEGUIR") {
      const hardPull = race.chaseUrgency > 0.68 && this.energy > 48;
      this.effort = this.role === "domestique" || this.role === "attacker" ? (hardPull ? 5 : 4) : hardPull ? 4 : 3;
      this.sacrificing = this.role === "domestique";
    } else if (this.tacticalState === "PROTEGER") {
      this.effort = this.role === "domestique" ? (gradient > 4 ? 4 : 3) : 2;
      this.sacrificing = this.role === "domestique" && gradient > 4;
    } else if (this.tacticalState === "PREPARAR SPRINT") {
      this.effort = this.role === "sprinter" ? 2 : this.role === "domestique" ? 4 : 3;
      this.sacrificing = this.role === "domestique";
    } else if (this.tacticalState === "ATACAR") {
      this.effort = ["attacker", "climber"].includes(this.role) ? 4 : 3;
    } else {
      this.effort = this.energy < 50 ? 1 : 2;
    }

    this.setRiskMode(Math.abs(road.curvatureAt(this.distance)) > 0.72 && this.technique < 75 ? "safe" :
      (remaining < 3 || this.aggression > 82) ? "aggressive" : "normal");
    if (this.nutrition < 38 && this.feeds > 0) {
      this.feeds -= 1;
      this.nutrition = clamp(this.nutrition + 28, 0, 100);
      this.energy = clamp(this.energy + 3, 0, 100);
    }
    if (!this.avoiding && !this.targetWheel) {
      this.targetLateral = clamp(
        Math.sin(this.distance * 1.7 + this.personalityPhase) * 0.62 + (position % 3 - 1) * 0.2,
        -0.88, 0.88
      );
    }
  }

  update(dt, context) {
    this.decisionTimer -= dt;
    if (this.decisionTimer <= 0) {
      this.decide(context);
      this.decisionTimer = (1.1 + this.random.next() * 1.5) * context.race.difficultyConfig.reactionMultiplier;
    }
    context.race.applyRelayInstruction(this);
    context.race.applyTeamProtectionInstruction(this);
    this.updateCommon(dt, context);
  }
}

class Race {
  constructor(game, difficulty, weatherMode, options = {}) {
    this.game = game;
    const stageSeed = options.seed ?? (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
    this.seed = stageSeed;
    this.stageDefinition = options.stageDefinition || {
      number: 1, type: "road", profile: null, lengthKm: null,
      name: null, label: "ETAPA"
    };
    this.timeTrial = this.stageDefinition.type === "itt";
    this.roster = options.roster || null;
    this.timeTrialOrder = options.timeTrialOrder || null;
    this.jerseyAssignments = options.jerseyAssignments || {};
    this.playerProfile = PLAYER_PROFILES[options.playerProfile] ? options.playerProfile : "allrounder";
    this.tourConditions = options.tourConditions instanceof Map ? options.tourConditions : new Map();
    this.hasExplicitPlayerTeam = TEAM_BY_ID.has(options.playerTeamId);
    this.playerTeamId = this.hasExplicitPlayerTeam ? options.playerTeamId : "solaris";
    this.stageAssignments = options.stageAssignments && typeof options.stageAssignments === "object"
      ? options.stageAssignments : {};
    this.simulationOnly = Boolean(options.simulationOnly);
    this.random = new SeededRandom(stageSeed);
    const stageLength = this.stageDefinition.lengthKm || 120 + Math.floor(this.random.next() * 161);
    this.road = new Road(this.random, stageLength, this.stageDefinition);
    if (this.timeTrial) {
      this.road.mountains = [];
      this.road.intermediateSprints = [];
      this.road.racePoints = [];
    }
    this.weather = new WeatherSystem(weatherMode, stageLength);
    this.simulationScale = clamp(stageLength / 3.2, 38, 78);
    this.elapsed = 0;
    this.finishElapsed = 0;
    this.lastDangerKm = null;
    this.lastKmAnnounced = false;
    this.lowEnergyAnnounced = false;
    this.lowNutritionAnnounced = false;
    this.lowExplosiveAnnounced = false;
    this.lastDraftNotice = -20;
    this.lastRivalAttackTime = -20;
    this.finishOrder = [];
    this.collisionPairs = new Map();
    this.groups = [];
    this.previousGroupCount = 1;
    this.lastGroupEvent = -20;
    this.lastGroupTrendSample = -10;
    this.previousGroupGaps = [];
    this.groupTrends = [];
    this.currentBiomeId = this.road.biomeAt(0).id;
    this.pointStandings = { mountain: new Map(), sprint: new Map() };
    this.difficulty = this.stageDefinition.finale ? "easy" : difficulty;
    this.difficultyConfig = this.difficulty === "easy"
      ? { reactionMultiplier: 2.2, errorRate: 0.48, mistakeLowChance: 0.09, coordination: 0.52, warningLead: 1.65 }
      : this.difficulty === "hard"
        ? { reactionMultiplier: 1.05, errorRate: 0.15, mistakeLowChance: 0.01, coordination: 0.92, warningLead: 0.85 }
        : { reactionMultiplier: 1.35, errorRate: 0.28, mistakeLowChance: 0.025, coordination: 0.76, warningLead: 1.15 };
    this.difficultyBonus = 0;
    this.chaseUrgency = 0;
    this.teamTacticTimer = 0;
    this.lastTeamAnnouncement = -20;
    this.playerTeamOrder = "protect";
    this.playerTeamOrderChanges = 0;
    this.activePlayerProtectors = 0;
    this.breakawayDirector = {
      active: false,
      established: false,
      hasHadBreakaway: false,
      attempts: 0,
      reformations: 0,
      riders: [],
      historyRiders: [],
      nextAttemptAt: this.timeTrial ? Infinity : 5 + this.random.next() * 8,
      falseMoveAt: this.timeTrial ? Infinity : 2.5 + this.random.next() * 5,
      falseMoveDone: false,
      establishedAt: 0,
      bridgeAt: Infinity,
      bridgeAttempted: false,
      allowPlayerTeammate: this.random.next() < 0.38,
      commitmentUntil: 0,
      lostSince: null
    };
    this.relay = {
      active: false,
      participants: [],
      leader: null,
      turnIndex: 0,
      turnTimer: 0,
      elapsed: 0,
      paceSpeed: 0,
      paceEffort: 0,
      lastRivalAttackAt: -20,
      blockedByAttack: null
    };
    this.teamByName = new Map();
    this.spatialIndex = new SpatialIndex();
    this.proximityCache = new Map();
    this.riderIndices = new Map();
    this.createPeloton();
    this.initializeRaceVehicles();
  }

  initializeRaceVehicles() {
    const colors = this.teams.slice(0, 3).map((team) => team.color);
    this.raceVehicles = [
      { id: "tv-0", type: "tv", distance: -0.06, lateral: -0.52, speed: 40, cruiseSpeed: 40, color: "#ffcc33", active: true },
      { id: "tv-1", type: "tv", distance: -0.22, lateral: 0.5, speed: 35, cruiseSpeed: 35, color: "#62d8f2", active: true },
      { id: "tv-2", type: "tv", distance: -0.38, lateral: -0.08, speed: 31, cruiseSpeed: 31, color: "#f4f1e9", active: true },
      { id: "team-0", type: "team", distance: -0.18, lateral: 0.5, speed: 29, cruiseSpeed: 29, color: colors[0] || "#2f80ed", active: true },
      { id: "team-1", type: "team", distance: -0.38, lateral: -0.48, speed: 31, cruiseSpeed: 31, color: colors[1] || "#ef476f", active: true },
      { id: "team-2", type: "team", distance: -0.58, lateral: 0.12, speed: 28, cruiseSpeed: 28, color: colors[2] || "#36bd69", active: true },
      { id: "broom", type: "broom", distance: -0.56, lateral: 0.55, speed: 28, color: "#f0a62b", active: true }
    ];
  }

  updateRaceVehicles(dt) {
    const activeRiders = this.cyclists
      .filter((rider) => !rider.finished)
      .sort((a, b) => b.distance - a.distance);
    const leader = this.timeTrial ? this.player : activeRiders[0] || this.player;
    const tail = this.timeTrial ? this.player : activeRiders.at(-1) || this.player;
    const teamCars = this.raceVehicles.filter((vehicle) => vehicle.type === "team");
    const trafficVehicles = this.raceVehicles.filter((vehicle) => vehicle.type === "tv" && vehicle.active);
    const broom = this.raceVehicles.find((vehicle) => vehicle.type === "broom");

    // Las motos avanzan delante de carrera con velocidad propia.
    const orderedTraffic = [...trafficVehicles].sort((a, b) => b.distance - a.distance);
    let motorcycleCeiling = leader.distance - 0.06;
    for (let index = 0; index < orderedTraffic.length; index += 1) {
      const vehicle = orderedTraffic[index];
      const aheadVehicle = orderedTraffic[index - 1];
      let targetSpeed = vehicle.cruiseSpeed;
      const safeVehicleGap = vehicle.type === "tv" && aheadVehicle?.type === "tv" ? 0.14 : 0.22;
      if (aheadVehicle && aheadVehicle.distance - vehicle.distance < safeVehicleGap) {
        targetSpeed = Math.min(targetSpeed, Math.max(8, aheadVehicle.speed - 2));
      }
      const riderWidth = vehicle.type === "tv" ? 0.32 : 0.46;
      const riderAhead = activeRiders
        .filter((rider) => rider.distance >= vehicle.distance &&
          rider.distance - vehicle.distance < 0.18 &&
          Math.abs(rider.lateral - vehicle.lateral) < riderWidth)
        .sort((a, b) => a.distance - b.distance)[0];
      if (riderAhead) targetSpeed = Math.min(targetSpeed, Math.max(6, riderAhead.speed - 4));
      vehicle.speed = lerp(vehicle.speed, targetSpeed, 1 - Math.exp(-dt * 2.4));
      vehicle.distance += vehicle.speed * this.simulationScale / 3600 * dt;
      vehicle.lateral = clamp(vehicle.lateral, -0.62, 0.62);
      if (vehicle.type === "tv") {
        // Ninguna moto puede abrir carrera ni amontonarse con otra en cabeza.
        vehicle.distance = Math.min(vehicle.distance, motorcycleCeiling);
        motorcycleCeiling = vehicle.distance - 0.14;
      }
      if (vehicle.distance > this.road.lengthKm + 0.25) vehicle.active = false;
    }

    // Los coches de equipo forman un convoy estable detrás de los grupos.
    // No nacen en puntos arbitrarios de la etapa ni atraviesan al pelotón.
    const vehicleGroups = this.groups?.length ? this.groups : [{ riders: activeRiders }];
    teamCars.forEach((vehicle, index) => {
      const group = vehicleGroups[Math.min(index, vehicleGroups.length - 1)];
      const groupTail = group?.riders?.length
        ? Math.min(...group.riders.filter((rider) => !rider.finished).map((rider) => rider.distance))
        : tail.distance;
      const targetDistance = (Number.isFinite(groupTail) ? groupTail : tail.distance) - 0.16 - index * 0.08;
      const targetSpeed = group?.riders?.length
        ? group.riders.reduce((sum, rider) => sum + rider.speed, 0) / group.riders.length
        : tail.speed;
      vehicle.distance = lerp(vehicle.distance, targetDistance, 1 - Math.exp(-dt * 2.2));
      vehicle.speed = lerp(vehicle.speed, Math.max(8, targetSpeed), 1 - Math.exp(-dt * 2.4));
      vehicle.lateral = clamp(vehicle.lateral, -0.62, 0.62);
      vehicle.active = activeRiders.length > 0 && vehicle.distance < this.road.lengthKm;
    });

    if (broom) {
      let targetDistance = tail.distance - 0.42;
      for (const vehicle of teamCars) {
        if (Math.abs(vehicle.distance - targetDistance) < 0.2) {
          targetDistance = Math.min(targetDistance, vehicle.distance - 0.2);
        }
      }
      broom.distance = targetDistance;
      broom.speed = Math.max(8, tail.speed - 2);
      broom.lateral = clamp(0.55, -0.62, 0.62);
      broom.active = tail.distance > 0.46;
    }
  }

  createPeloton() {
    this.teams = TEAM_DEFINITIONS.map((team) => ({ ...team, leader: { ...team.leader } }));
    const playerTeamIndex = Math.max(0, this.teams.findIndex((team) => team.id === this.playerTeamId));
    const playerTeam = this.teams[playerTeamIndex];
    const profile = PLAYER_PROFILES[this.playerProfile];
    const playerLeader = this.stageDefinition.quickRace || !this.hasExplicitPlayerTeam
      ? { ...playerTeam.leader, ...profile, name: "TÚ", nationality: "España", flag: "🇪🇸", age: 23 }
      : playerTeam.leader;
    this.player = new PlayerCyclist({
      ...playerLeader, team: playerTeam.name, color: playerTeam.color, teamIndex: playerTeamIndex,
      lateral: 0.08, distance: 0,
      role: "leader", roleLabel: "LÍDER", stageRole: "leader"
    });
    this.player.balanceBonus = 0.65;
    const nations = [
      { name: "España", flag: "🇪🇸", first: ["Iker", "Bruno", "Unai", "Saúl", "Álex", "Mikel"], last: ["Laredo", "Montiel", "Arnáiz", "Cervera", "Nadal", "Baeza"] },
      { name: "Francia", flag: "🇫🇷", first: ["Rémi", "Théo", "Luc", "Bastien", "Noé", "Émile"], last: ["Vallet", "Rocheau", "Delorme", "Carrel", "Vautrin", "Masson"] },
      { name: "Italia", flag: "🇮🇹", first: ["Elio", "Nino", "Taddeo", "Milo", "Enzo", "Loris"], last: ["Bellori", "Sartini", "Morello", "Vannetti", "Corvini", "Lunardi"] },
      { name: "Bélgica", flag: "🇧🇪", first: ["Jef", "Mats", "Lowie", "Wout", "Seppe", "Arne"], last: ["De Bruyn", "Verhaeghe", "Maertens", "Claes", "Vercaut", "De Smet"] },
      { name: "Países Bajos", flag: "🇳🇱", first: ["Daan", "Timo", "Bram", "Mees", "Sven", "Koen"], last: ["Van Loen", "Dekkers", "Ter Haar", "Van Beek", "Koster", "Willems"] },
      { name: "Portugal", flag: "🇵🇹", first: ["Tiago", "Duarte", "Afonso", "Nuno", "Diogo", "Vasco"], last: ["Faria", "Neves", "Tavares", "Louro", "Seixas", "Moura"] },
      { name: "Dinamarca", flag: "🇩🇰", first: ["Mads", "Asger", "Lasse", "Emil", "Jeppe", "Søren"], last: ["Lund", "Kjær", "Vester", "Holm", "Nørby", "Falk"] },
      { name: "Eslovenia", flag: "🇸🇮", first: ["Žan", "Rok", "Miha", "Jure", "Tine", "Luka"], last: ["Kranjc", "Zupan", "Kovač", "Rozman", "Vidmar", "Kralj"] },
      { name: "Colombia", flag: "🇨🇴", first: ["Jairo", "Nairo", "Efraín", "Camilo", "Óscar", "Simón"], last: ["Quintero", "Arbeláez", "Téllez", "Montaño", "Buitrago", "Salcedo"] },
      { name: "Reino Unido", flag: "🇬🇧", first: ["Owen", "Callum", "Elliot", "Finlay", "Rhys", "Alfie"], last: ["Mercer", "Hales", "Redford", "Cairns", "Whitby", "Foster"] },
      { name: "Alemania", flag: "🇩🇪", first: ["Nils", "Jannik", "Florian", "Hannes", "Lenn", "Moritz"], last: ["Ebert", "Vogler", "Kappel", "Wendt", "Brehm", "Auster"] },
      { name: "Australia", flag: "🇦🇺", first: ["Lachlan", "Mitch", "Darcy", "Flynn", "Heath", "Bailey"], last: ["Marlow", "Keating", "Baxter", "Corbett", "Hadley", "Sutton"] }
    ];
    const roleSlots = ["leader", "sprinter", "climber", "climber", "attacker",
      "domestique", "domestique", "domestique", "domestique", "domestique"];
    const roleLabels = {
      leader: "LÍDER", sprinter: "SPRINTER", climber: "ESCALADOR",
      attacker: "ATACANTE", domestique: "GREGARIO"
    };
    this.cyclists = [this.player];
    let riderIndex = 0;
    for (let teamIndex = 0; teamIndex < this.teams.length; teamIndex += 1) {
      const team = this.teams[teamIndex];
      for (let slot = 0; slot < 10; slot += 1) {
        if (teamIndex === playerTeamIndex && slot === 0) continue;
        const role = roleSlots[slot];
        const nation = nations[riderIndex % nations.length];
        const nationalIndex = Math.floor(riderIndex / nations.length);
        const firstName = nation.first[nationalIndex % nation.first.length];
        const firstSurname = nation.last[(nationalIndex + riderIndex) % nation.last.length];
        const secondSurname = nationalIndex >= nation.first.length
          ? `-${nation.last[(nationalIndex + riderIndex + 2) % nation.last.length]}` : "";
        const teamLeader = slot === 0 ? team.leader : null;
        const name = teamLeader?.name || `${firstName} ${firstSurname}${secondSurname}`;
        const base = role === "leader"
          ? { climbing: 82, sprint: 80, endurance: 86, aggression: 76, intelligence: 88 }
          : role === "sprinter"
            ? { climbing: 67, sprint: 89, endurance: 79, aggression: 82, intelligence: 84 }
            : role === "climber"
              ? { climbing: 87, sprint: 71, endurance: 83, aggression: 80, intelligence: 82 }
              : role === "attacker"
                ? { climbing: 78, sprint: 77, endurance: 81, aggression: 90, intelligence: 78 }
                : { climbing: 73, sprint: 74, endurance: 84, aggression: 69, intelligence: 80 };
        const specialtyClimb = team.specialty === "mountain" ? 3 : 0;
        const specialtySprint = team.specialty === "sprint" ? 3 : 0;
        const type = roleLabels[role][0] + roleLabels[role].slice(1).toLowerCase();
        this.cyclists.push(new AICyclist({
          name, nationality: teamLeader?.nationality || nation.name, flag: teamLeader?.flag || nation.flag,
          type, team: team.name, color: team.color,
          teamIndex, role, roleLabel: roleLabels[role],
          climbing: teamLeader?.climbing ?? base.climbing + specialtyClimb + this.random.next() * 4 - 2,
          sprint: teamLeader?.sprint ?? base.sprint + specialtySprint + this.random.next() * 4 - 2,
          endurance: teamLeader?.endurance ?? base.endurance + this.random.next() * 4 - 2,
          technique: teamLeader?.technique ?? 70 + this.random.next() * 19,
          aggression: teamLeader?.aggression ?? base.aggression + (team.attackBias - 0.5) * 10 + this.random.next() * 5 - 2.5,
          intelligence: teamLeader?.intelligence ?? base.intelligence + this.random.next() * 5 - 2.5,
          age: teamLeader?.age ?? 20 + Math.floor(this.random.next() * 17),
          lateral: ((riderIndex % 9) - 4) * 0.21,
          distance: -0.035 * Math.floor(riderIndex / 9),
          speed: 32 + this.random.next() * 2
        }, this.random));
        riderIndex += 1;
      }
    }
    const identityFields = [
      "name", "nationality", "flag", "type", "team", "color", "teamIndex", "role", "roleLabel",
      "climbing", "sprint", "endurance", "technique", "aggression", "intelligence", "age", "tourId", "stageRole"
    ];
    this.cyclists.forEach((rider, index) => {
      rider.tourId = index;
      if (this.roster?.[index]) {
        identityFields.forEach((field) => {
          if (this.roster[index][field] !== undefined) rider[field] = this.roster[index][field];
        });
      }
      const jersey = this.jerseyAssignments[rider.tourId];
      rider.jerseyType = jersey || "";
      rider.jerseyColor = jersey ? TOUR_JERSEYS[jersey].color : null;
      const condition = this.tourConditions.get(rider.tourId) || { fatigue: 0, form: 0 };
      rider.tourFatigue = clamp(Number(condition.fatigue) || 0, 0, 100);
      rider.dailyForm = clamp(Number(condition.form) || 0, -8, 8);
      rider.energy = clamp(100 - rider.tourFatigue * 0.24, 68, 100);
      rider.explosive = clamp(100 - rider.tourFatigue * 0.12, 76, 100);
      rider.conditionBonus = rider.dailyForm * 0.16 - rider.tourFatigue * 0.012;
      rider.specialtyLabel = derivedSpecialty(rider);
      if (rider === this.player) rider.stageRole = "leader";
      else rider.stageRole = this.stageAssignments[rider.tourId] || rider.stageRole ||
        (rider.team === this.player.team ? "support" : rider.role);
    });
    if (this.timeTrial) this.assignTimeTrialGrid();
    else this.assignStartingGrid();
    this.teams.forEach((team, teamIndex) => {
      team.riders = this.cyclists.filter((rider) => rider.team === team.name);
      team.leader = team.riders.find((rider) => rider.role === "leader") || team.riders[0];
      team.sprinter = team.riders.find((rider) => rider.role === "sprinter") || team.leader;
      team.climbers = team.riders.filter((rider) => rider.role === "climber");
      team.attackers = team.riders.filter((rider) => rider.role === "attacker");
      if (this.road.stageProfile === "flat") {
        const seeksBreak = ["breakaway", "attack", "opportunist"].includes(team.specialty);
        team.objectiveRider = seeksBreak ? team.attackers[0] || team.sprinter : team.sprinter;
        team.objectiveLabel = seeksBreak ? "BUSCAR LA FUGA" : "GANAR AL SPRINT";
      } else if (this.road.stageProfile === "mountain") {
        const seeksBreak = ["breakaway", "attack"].includes(team.specialty);
        team.objectiveRider = seeksBreak
          ? team.attackers[0] || team.climbers[0]
          : [team.leader, ...team.climbers].sort((a, b) => b.climbing - a.climbing)[0];
        team.objectiveLabel = seeksBreak ? "PUNTOS Y FUGA"
          : team.specialty === "mountain" ? "DOMINAR LA MONTAÑA" : "GANAR EN MONTAÑA";
      } else {
        team.objectiveRider = ["breakaway", "attack", "opportunist"].includes(team.specialty)
          ? team.attackers[0] || team.leader : team.leader;
        team.objectiveLabel = team.objectiveRider.role === "attacker" ? "BUSCAR LA FUGA" : "DISPUTAR LA ETAPA";
      }
      // El equipo elegido trabaja para su líder predefinido y respeta los
      // objetivos configurados para esta etapa.
      if (team.riders.includes(this.player)) {
        const preferredRole = this.road.stageProfile === "mountain" ? "mountain"
          : this.road.stageProfile === "flat" ? "points" : "stage";
        const specialist = team.riders.find((rider) => rider.stageRole === preferredRole);
        team.objectiveRider = specialist || this.player;
        team.objectiveLabel = specialist
          ? STAGE_ROLES[specialist.stageRole].label
          : "PROTEGER AL LÍDER";
      }
      team.plan = {
        state: "RECUPERAR",
        protectedRider: team.riders.includes(this.player) ? this.player : team.objectiveRider,
        rival: null
      };
      team.nextAttackKm = 16 + teamIndex * 3.1 + this.random.next() * 11;
      team.initiatives = 0;
      team.lastAttackTime = -100;
      team.lastAnnouncedState = "";
      team.statesSeen = new Set(["RECUPERAR"]);
      this.teamByName.set(team.name, team);
    });
    this.cyclists.forEach((rider, index) => this.riderIndices.set(rider, index));
    this.updateRanking();
    this.updateTeamTactics(true);
  }

  findBreakaway(activeRanking = this.ranking.filter((rider) => !rider.finished), minimumGapSeconds = 6) {
    if (this.timeTrial || this.elapsed <= 4 || activeRanking.length <= 30) return null;
    const maxBreakSize = Math.min(20, activeRanking.length - 30);
    for (let index = 1; index <= maxBreakSize; index += 1) {
      const tail = activeRanking[index - 1];
      const next = activeRanking[index];
      const referenceSpeed = Math.max(22, (tail.speed + next.speed) / 2);
      const gapSeconds = Math.max(0, tail.distance - next.distance) / referenceSpeed * 3600;
      if (gapSeconds < minimumGapSeconds) continue;
      return {
        riders: activeRanking.slice(0, index),
        leader: activeRanking[0],
        tail,
        gapSeconds
      };
    }
    return null;
  }

  selectBreakawayRiders() {
    const director = this.breakawayDirector;
    const active = this.ranking.filter((rider) =>
      !rider.finished && rider instanceof AICyclist &&
      (rider.team !== this.player.team || director.allowPlayerTeammate) &&
      rider.energy > 54 && rider.crashTimer <= 0
    );
    const desiredSize = 4 + Math.floor(this.random.next() * 4);
    const bestByTeam = new Map();
    active.slice(0, 60).forEach((rider, position) => {
      const team = this.teamByName.get(rider.team);
      const roleScore = rider.role === "attacker" ? 28
        : rider.role === "domestique" ? 17
          : rider.role === "climber" && this.road.stageProfile !== "flat" ? 15
            : rider.role === "sprinter" ? 4 : -12;
      const specialtyScore = ["breakaway", "attack", "opportunist"].includes(team?.specialty) ? 12 : 0;
      const score = roleScore + specialtyScore + rider.aggression * 0.12 -
        position * 0.28 + this.random.next() * 8;
      if (!bestByTeam.has(rider.team) || score > bestByTeam.get(rider.team).score) {
        bestByTeam.set(rider.team, { rider, score });
      }
    });
    return [...bestByTeam.values()]
      .sort((a, b) => b.score - a.score)
      .slice(0, desiredSize)
      .map((entry) => entry.rider);
  }

  launchBreakawayAttempt(context) {
    const riders = this.selectBreakawayRiders();
    if (riders.length < 3) {
      this.breakawayDirector.nextAttemptAt = this.elapsed + 5;
      return;
    }
    const director = this.breakawayDirector;
    director.active = true;
    director.established = false;
    director.attempts += 1;
    director.riders = riders;
    riders.forEach((rider) => {
      if (!director.historyRiders.includes(rider)) director.historyRiders.push(rider);
    });
    director.commitmentUntil = this.elapsed + 28 + director.attempts * 4;
    director.nextAttemptAt = Infinity;
    director.lostSince = null;
    director.bridgeAttempted = false;
    director.bridgeAt = Infinity;
    const attackMultiplier = Math.min(1.28, 1.04 + director.attempts * 0.055);
    riders.forEach((rider) => {
      rider.breakawayBonus = 1.65 + director.attempts * 0.42;
      rider.targetWheel = null;
      rider.effort = 5;
      rider.attackCooldown = 0;
      rider.launchAttack(context, attackMultiplier);
    });
    if (!this.simulationOnly) {
      const teams = [...new Set(riders.map((rider) => rider.team))];
      this.game.audio.play("rivalAttack");
      this.game.notify(
        `¡Movimiento de fuga! ${riders.length} ciclistas de ${teams.slice(0, 3).join(", ")}${teams.length > 3 ? "…" : ""}.`,
        "urgent"
      );
    }
  }

  breakawayInstructionFor(rider) {
    const director = this.breakawayDirector;
    const remaining = this.road.lengthKm - rider.distance;
    if (!director.active || remaining <= 8 || !director.riders.includes(rider) ||
      rider.finished || rider.crashTimer > 0) return null;
    const active = director.riders
      .filter((candidate) => !candidate.finished && candidate.crashTimer <= 0)
      .sort((a, b) => b.distance - a.distance);
    const riderIndex = active.indexOf(rider);
    const wheel = riderIndex > 0 && active[riderIndex - 1].distance - rider.distance < 0.38
      ? active[riderIndex - 1] : null;
    const turnIndex = active.length ? Math.floor(this.elapsed / 4.8) % active.length : -1;
    const stageProgress = clamp(rider.distance / this.road.lengthKm, 0, 1);
    const cooperationBonus = clamp(1.3 - stageProgress * 0.85, 0.45, 1.15);
    return {
      establishing: !director.established,
      pulling: riderIndex === turnIndex,
      wheel,
      bonus: director.established ? cooperationBonus : 1.65 + director.attempts * 0.42,
      attackMultiplier: Math.min(1.28, 1.04 + director.attempts * 0.055)
    };
  }

  updateBreakawayDirector(context) {
    if (this.timeTrial) return;
    const director = this.breakawayDirector;
    const activeRanking = this.ranking.filter((rider) => !rider.finished);
    const detected = this.findBreakaway(activeRanking, 6);
    const raceProgress = Math.max(0, this.leader?.distance || 0) / this.road.lengthKm;
    const remaining = this.road.lengthKm - Math.max(0, this.leader?.distance || 0);

    if (!director.falseMoveDone && this.elapsed >= director.falseMoveAt && remaining > 28) {
      director.falseMoveDone = true;
      const falseMover = activeRanking.slice(3, 32)
        .filter((rider) => rider instanceof AICyclist && rider.energy > 62 && rider.crashTimer <= 0)
        .sort((a, b) =>
          (b.aggression + this.random.next() * 12) - (a.aggression + this.random.next() * 12)
        )[0];
      if (falseMover) {
        falseMover.attackCooldown = 0;
        falseMover.launchAttack(context, 0.94);
        if (!this.simulationOnly) {
          this.game.notify(`Amago de ${falseMover.flag || ""} ${falseMover.name}. El pelotón duda.`);
        }
      }
    }

    if (director.active) {
      const includesCommittedRider = detected?.riders.some((rider) => director.riders.includes(rider));
      if (detected && includesCommittedRider) {
        director.lostSince = null;
        if (!director.established && detected.gapSeconds >= 8) {
          director.established = true;
          director.hasHadBreakaway = true;
          director.establishedAt = this.elapsed;
          director.bridgeAt = this.elapsed + 6 + this.random.next() * 8;
          if (!this.simulationOnly) {
            this.game.notify(
              `Fuga consolidada: ${detected.riders.length} ciclistas · ${Math.round(detected.gapSeconds)} s.`,
              "urgent"
            );
          }
        }
        if (director.established && !director.bridgeAttempted && this.elapsed >= director.bridgeAt &&
          remaining > 24 && detected.gapSeconds < 42) {
          director.bridgeAttempted = true;
          const representedTeams = new Set(director.riders.map((rider) => rider.team));
          const bridgeRider = activeRanking.slice(detected.riders.length, 42)
            .filter((rider) => rider instanceof AICyclist && !director.riders.includes(rider) &&
              !representedTeams.has(rider.team) && rider.energy > 58 && rider.crashTimer <= 0)
            .sort((a, b) => {
              const aScore = a.aggression * 0.55 + a.endurance * 0.3 + this.random.next() * 10;
              const bScore = b.aggression * 0.55 + b.endurance * 0.3 + this.random.next() * 10;
              return bScore - aScore;
            })[0];
          if (bridgeRider) {
            director.riders.push(bridgeRider);
            if (!director.historyRiders.includes(bridgeRider)) director.historyRiders.push(bridgeRider);
            bridgeRider.breakawayBonus = 1.15;
            bridgeRider.targetWheel = null;
            bridgeRider.effort = 5;
            bridgeRider.attackCooldown = 0;
            bridgeRider.launchAttack(context, 1.08);
            if (!this.simulationOnly) {
              this.game.notify(`${bridgeRider.flag || ""} ${bridgeRider.name} intenta enlazar con la fuga.`);
            }
          }
        }
      } else if (director.established) {
        if (director.lostSince === null) director.lostSince = this.elapsed;
        if (this.elapsed - director.lostSince > 5) {
          director.active = false;
          director.riders.forEach((rider) => { rider.breakawayBonus = 0; });
          director.riders = [];
          director.reformations += 1;
          director.bridgeAttempted = false;
          director.nextAttemptAt = raceProgress < 0.65 && remaining > 24 && director.reformations <= 2
            ? this.elapsed + 6 + this.random.next() * 7 : Infinity;
          if (!this.simulationOnly) this.game.notify("El pelotón neutraliza la fuga.");
        }
      } else if (this.elapsed >= director.commitmentUntil) {
        director.active = false;
        director.riders.forEach((rider) => { rider.breakawayBonus = 0; });
        director.riders = [];
        director.bridgeAttempted = false;
        director.nextAttemptAt = remaining > 20 ? this.elapsed + 4 + this.random.next() * 6 : Infinity;
      }
    }

    if (!director.active && this.elapsed >= director.nextAttemptAt && remaining > 18) {
      this.launchBreakawayAttempt(context);
    }
  }

  assignStartingGrid() {
    const grid = shuffleWith(this.cyclists, this.random);
    const lanes = 10;
    grid.forEach((rider, index) => {
      const lane = index % lanes;
      rider.startPosition = index + 1;
      rider.distance = -index * 0.0034;
      rider.previousDistance = rider.distance;
      rider.lateral = (lane - (lanes - 1) / 2) * 0.19;
      rider.targetLateral = rider.lateral;
    });
    this.startPosition = this.player.startPosition;
  }

  assignTimeTrialGrid() {
    const byId = new Map(this.cyclists.map((rider) => [rider.tourId, rider]));
    const ordered = this.timeTrialOrder?.map((id) => byId.get(id)).filter(Boolean);
    const startOrder = ordered?.length === this.cyclists.length
      ? ordered : shuffleWith(this.cyclists, this.random);
    startOrder.forEach((rider, index) => {
      rider.startPosition = index + 1;
      rider.timeTrialStartSlot = index + 1;
      rider.distance = 0;
      rider.previousDistance = 0;
      rider.lateral = 0;
      rider.targetLateral = 0;
      rider.group = "CRONO";
    });
    this.startPosition = this.player.startPosition;
    this.timeTrialStartOrder = startOrder;
  }

  relayCandidates() {
    if (this.timeTrial || !this.player || this.player.finished) return [];
    const playerGroup = this.groups.find((group) => group.riders.includes(this.player));
    const pool = (playerGroup?.riders || this.cyclists)
      .filter((rider) => rider !== this.player && !rider.finished && rider.crashTimer <= 0 &&
        rider.attacking <= 0 && rider.sprinting !== true && rider.energy > 24 &&
        Math.abs(rider.speed - this.player.speed) <= 2.5 &&
        Math.abs(rider.effort - this.player.effort) <= 1 &&
        Math.abs(rider.distance - this.player.distance) <= 0.22)
      .sort((a, b) => Math.abs(a.distance - this.player.distance) - Math.abs(b.distance - this.player.distance));
    const selected = [];
    const add = (rider) => {
      if (rider && !selected.includes(rider) && selected.length < 4) selected.push(rider);
    };
    if (pool.includes(this.player.wheelTarget)) add(this.player.wheelTarget);
    add(pool.find((rider) => rider.team === this.player.team));
    add(pool.find((rider) => rider.team !== this.player.team));
    pool.forEach(add);
    return selected;
  }

  isRelayParticipant(rider) {
    return Boolean(this.relay.active && this.relay.participants.includes(rider));
  }

  isRelayTeammate(rider) {
    return rider !== this.player && this.isRelayParticipant(rider) && rider.team === this.player.team;
  }

  isRelayRival(rider) {
    return this.isRelayParticipant(rider) && rider.team !== this.player.team;
  }

  activeRivalAttackForPlayer(maxGapKm = 0.72) {
    if (this.timeTrial || !this.player) return null;
    return this.cyclists
      .filter((rider) => rider !== this.player && rider.team !== this.player.team &&
        !rider.finished && rider.attacking > 0 &&
        rider.distance - this.player.distance >= -0.04 &&
        rider.distance - this.player.distance <= maxGapKm)
      .sort((a, b) => (a.distance - this.player.distance) - (b.distance - this.player.distance))[0] || null;
  }

  startRelay() {
    this.relay.blockedByAttack = null;
    if (this.relay.active || this.player.finished || this.player.crashTimer > 0 ||
      this.player.attacking > 0 || this.player.sprinting) return false;
    const activeAttack = this.activeRivalAttackForPlayer();
    if (activeAttack) {
      this.relay.blockedByAttack = activeAttack;
      return false;
    }
    const partners = this.relayCandidates();
    if (!partners.length) return false;
    this.relay.active = true;
    this.relay.participants = [this.player, ...partners];
    this.relay.leader = this.player;
    this.relay.turnIndex = 0;
    this.relay.turnTimer = 4.8;
    this.relay.elapsed = 0;
    this.relay.paceSpeed = this.player.speed;
    this.relay.paceEffort = this.player.effort;
    this.player.relayTurns += 1;
    this.relay.participants.forEach((rider) => {
      rider.relayParticipant = true;
      rider.relayPulling = rider === this.player;
    });
    return true;
  }

  stopRelay(reason = "", announce = true) {
    if (!this.relay.active) return false;
    const oldParticipants = [...this.relay.participants];
    oldParticipants.forEach((rider) => {
      rider.relayParticipant = false;
      rider.relayPulling = false;
      rider.relayBonus = 0;
      if (rider instanceof AICyclist && oldParticipants.includes(rider.targetWheel)) rider.targetWheel = null;
    });
    if (this.player.relayWheelTarget && this.player.wheelTarget === this.player.relayWheelTarget) {
      this.player.wheelTarget = null;
      this.player.seekingWheel = false;
    }
    this.player.relayWheelTarget = null;
    this.relay.active = false;
    this.relay.participants = [];
    this.relay.leader = null;
    this.relay.turnIndex = 0;
    this.relay.turnTimer = 0;
    this.relay.elapsed = 0;
    this.relay.paceSpeed = 0;
    this.relay.paceEffort = 0;
    this.relay.blockedByAttack = null;
    if (announce && !this.simulationOnly) this.game.notify(reason || "Relevos terminados. Vuelves a rodar por libre.");
    return true;
  }

  removeRelayParticipant(rider, attacked = false) {
    if (!this.isRelayParticipant(rider) || rider === this.player) return;
    const wasLeader = this.relay.leader === rider;
    this.relay.participants = this.relay.participants.filter((participant) => participant !== rider);
    rider.relayParticipant = false;
    rider.relayPulling = false;
    rider.relayBonus = 0;
    rider.targetWheel = null;
    if (this.relay.participants.length < 2) {
      this.stopRelay(attacked ? `${rider.name} atacó y rompió los relevos.` : "Ya no quedan ciclistas para relevar.", true);
      return;
    }
    if (wasLeader) {
      this.relay.turnIndex %= this.relay.participants.length;
      this.relay.leader = this.relay.participants[this.relay.turnIndex];
      this.relay.turnTimer = Math.min(this.relay.turnTimer, 2.4);
    } else {
      this.relay.turnIndex = this.relay.participants.indexOf(this.relay.leader);
    }
    if (attacked && !this.simulationOnly) {
      this.game.notify(`¡${rider.flag || ""} ${rider.name} rompe los relevos y ataca!`, "urgent");
    }
  }

  updateRelay(dt) {
    if (!this.relay.active) return;
    if (this.player.finished || this.player.crashTimer > 0 || this.player.attacking > 0 || this.player.sprinting) {
      this.stopRelay("La acción ha roto los relevos.", !this.simulationOnly);
      return;
    }
    for (const rider of [...this.relay.participants]) {
      if (rider === this.player) continue;
      const speedMismatch = Math.abs(rider.speed - this.player.speed) > 4;
      const paceMismatch = Math.abs(rider.effort - this.relay.paceEffort) > 1;
      if (rider.finished || rider.crashTimer > 0 || speedMismatch || paceMismatch ||
        Math.abs(rider.distance - this.player.distance) > 0.42) {
        this.removeRelayParticipant(rider);
      }
    }
    if (!this.relay.active) return;
    this.relay.elapsed += dt;
    this.player.relayTime += dt;
    this.relay.turnTimer -= dt;
    if (this.relay.turnTimer > 0) return;
    this.relay.turnIndex = (this.relay.turnIndex + 1) % this.relay.participants.length;
    this.relay.leader = this.relay.participants[this.relay.turnIndex];
    this.relay.turnTimer = 4.8;
    if (this.relay.leader === this.player) {
      this.player.relayTurns += 1;
    }
  }

  applyRelayInstruction(rider) {
    if (!this.isRelayParticipant(rider)) {
      rider.relayParticipant = false;
      rider.relayPulling = false;
      rider.relayBonus = 0;
      return;
    }
    const participants = this.relay.participants;
    const leaderIndex = participants.indexOf(this.relay.leader);
    const ordered = participants.slice(leaderIndex).concat(participants.slice(0, leaderIndex));
    const position = ordered.indexOf(rider);
    rider.relayParticipant = true;
    rider.relayPulling = position === 0;
    rider.relayBonus = position === 0 ? 0.85 : 0.24;
    if (position === 0) {
      // El relevo no toma el control táctico de un rival: conserva su ritmo.
      // Si lo cambia de forma apreciable, updateRelay lo saca de la rotación.
      if (rider === this.player || rider.team === this.player.team) {
        rider.effort = Math.max(this.relay.paceEffort, rider.effort);
      }
      rider.targetWheel = null;
      if (rider === this.player) {
        rider.seekingWheel = false;
        rider.wheelTarget = null;
        rider.relayWheelTarget = null;
      }
      return;
    }
    const wheel = ordered[position - 1];
    if (rider === this.player || rider.team === this.player.team) {
      rider.effort = Math.max(1, this.relay.paceEffort - 1);
    }
    rider.targetWheel = wheel;
    rider.targetLateral = clamp(wheel.lateral + Math.sin(position * 1.7) * 0.045, -0.9, 0.9);
    if (rider === this.player) {
      rider.seekingWheel = true;
      rider.wheelTarget = wheel;
      rider.relayWheelTarget = wheel;
    }
  }

  applyTeamProtectionInstruction(rider) {
    const wasProtectionPuller = rider.protectionPuller;
    rider.protectionPuller = false;
    if (this.timeTrial || !(rider instanceof AICyclist) || rider.relayParticipant || rider.finished) {
      if (wasProtectionPuller) rider.teamworkBonus = 0;
      return;
    }
    const team = this.teamByName.get(rider.team);
    const plan = team?.plan;
    const protectedRider = plan?.protectedRider;
    const slot = plan?.state === "PROTEGER" ? plan.pullers?.indexOf(rider) ?? -1 : -1;
    if (slot < 0 || !protectedRider || protectedRider.finished || rider.energy <= 18) {
      if (wasProtectionPuller) rider.teamworkBonus = 0;
      return;
    }

    // Tres gregarios forman una pequeña línea delante del líder. El primero
    // aporta el rebufo principal; los demás relevan cerca y no desaparecen
    // carretera arriba.
    const desiredGaps = [0.03, 0.058, 0.086];
    const lateralOffsets = [0, -0.17, 0.17];
    const desiredGap = desiredGaps[Math.min(slot, desiredGaps.length - 1)];
    const gap = rider.distance - protectedRider.distance;
    const passing = gap < desiredGap - 0.012;
    const passingSide = slot % 2 ? -1 : 1;
    rider.protectionPuller = true;
    rider.targetWheel = null;
    rider.targetLateral = clamp(
      protectedRider.lateral + (passing ? passingSide * 0.3 : lateralOffsets[slot] || 0),
      -0.86,
      0.86
    );
    if (gap < desiredGap - 0.055) {
      rider.effort = 5;
      rider.teamworkBonus = 3.2;
      rider.sacrificing = true;
    } else if (passing) {
      rider.effort = Math.max(4, Math.min(5, protectedRider.effort + 1));
      rider.teamworkBonus = 1.6;
      rider.sacrificing = true;
    } else if (gap > desiredGap + 0.04) {
      rider.effort = 1;
      rider.teamworkBonus = 0;
      rider.sacrificing = false;
    } else if (gap > desiredGap + 0.016) {
      rider.effort = 2;
      rider.teamworkBonus = 0;
      rider.sacrificing = false;
    } else {
      rider.effort = Math.max(3, Math.min(5, protectedRider.effort + 1));
      rider.teamworkBonus = clamp((desiredGap - gap) * 18 + 0.18, 0, 0.55);
      rider.sacrificing = true;
    }
  }

  updatePlayerTeamProtection() {
    const player = this.player;
    player.teamProtection = 0;
    this.activePlayerProtectors = 0;
    const team = this.teamByName.get(player.team);
    if (team?.plan?.state !== "PROTEGER") return;
    const protectors = (team.plan.pullers || []).filter((rider) => {
      const gap = rider.distance - player.distance;
      return rider.protectionPuller && !rider.finished && gap > 0.006 && gap < 0.12 &&
        Math.abs(rider.lateral - player.lateral) < 0.42;
    });
    player.teamProtection = clamp(protectors.reduce((total, rider) => {
      const gap = rider.distance - player.distance;
      const distanceQuality = 1 - gap / 0.12;
      const lateralQuality = 1 - Math.abs(rider.lateral - player.lateral) / 0.42;
      return total + distanceQuality * lateralQuality * 0.72;
    }, 0), 0, 1);
    this.activePlayerProtectors = protectors.length;
  }

  updateTeamTactics(force = false) {
    if (!force && this.teamTacticTimer > 0) return;
    this.teamTacticTimer = 2.2;
    const activeRanking = this.ranking.filter((rider) => !rider.finished);
    const breakaway = this.findBreakaway(activeRanking, 6);
    const breakawayGapSeconds = breakaway?.gapSeconds || 0;
    this.chaseUrgency = breakaway
      ? clamp((breakawayGapSeconds - 3) / 28, 0.15, 1)
      : Math.max(0, this.chaseUrgency - 0.2);
    const averageKm = this.cyclists.reduce((sum, rider) => sum + rider.distance, 0) / this.cyclists.length;
    const remaining = this.road.lengthKm - Math.max(0, averageKm);
    const gradient = this.road.getGradient(Math.max(0, averageKm));
    const breakTeams = new Set(breakaway?.riders.map((rider) => rider.team) || []);
    const chaseCandidates = this.teams
      .filter((team) => !breakTeams.has(team.name) && team.objectiveRider && !team.objectiveRider.finished)
      .map((team, index) => ({
        team,
        score: team.cooperation * this.difficultyConfig.coordination +
          (team.specialty === "chase" ? 0.35 : 0) + ((Math.floor(this.elapsed / 20) + index) % 3) * 0.035
      }))
      .sort((a, b) => b.score - a.score);
    const difficultyChasers = this.difficulty === "hard" ? 1 : this.difficulty === "easy" ? -1 : 0;
    const gapChasers = breakawayGapSeconds > 24 ? 1 : 0;
    const chaseTeamCount = clamp((this.road.stageProfile === "flat" ? 4 : 3) + difficultyChasers + gapChasers, 2, 6);
    const chasingTeams = new Set(chaseCandidates.slice(0, chaseTeamCount).map((item) => item.team.name));

    for (const team of this.teams) {
      const active = team.riders.filter((rider) => !rider.finished);
      if (!active.length) continue;
      const previousState = team.plan.state;
      const hasBreakRider = breakaway && breakaway.riders.some((rider) => rider.team === team.name);
      const objectivePosition = this.positionOf(team.objectiveRider);
      const availablePullers = active
        .filter((rider) => rider.role === "domestique" && rider.energy > 28)
        .sort((a, b) => b.energy - a.energy);
      const attackTeam = ["attack", "breakaway", "opportunist"].includes(team.specialty) ||
        (this.road.stageProfile !== "flat" && ["mountain", "allround", "balanced"].includes(team.specialty));
      let state = "RECUPERAR";
      const isPlayerTeam = team.riders.includes(this.player);
      const manualOrder = isPlayerTeam ? TEAM_ORDERS[this.playerTeamOrder] : null;
      if (manualOrder && remaining > 1.2) {
        state = manualOrder.state;
        if (state === "PERSEGUIR" && !availablePullers.length) state = "PROTEGER";
        if (state === "ATACAR" && !team.attackers.concat(team.climbers)
          .some((rider) => !rider.finished && rider.energy > 40)) state = "PROTEGER";
      } else if (breakaway && !hasBreakRider && chasingTeams.has(team.name) && availablePullers.length && remaining > 1.2) {
        state = "PERSEGUIR";
      } else if (isPlayerTeam && remaining > 1.2) {
        state = "PROTEGER";
      } else if (remaining <= 8 && this.road.stageProfile !== "mountain" &&
        team.objectiveRider === team.sprinter && team.sprinter.energy > 24) {
        state = "PREPARAR SPRINT";
      } else if (hasBreakRider) {
        state = team.objectiveRider && breakaway.riders.includes(team.objectiveRider) ? "PROTEGER" : "RECUPERAR";
      } else if (attackTeam && averageKm >= team.nextAttackKm && remaining > 8 &&
        team.attackers.concat(team.climbers).some((rider) => rider.energy > 45 && rider.attackCooldown <= 0)) {
        state = "ATACAR";
      } else if (gradient >= 3.5 || objectivePosition <= 24 || team.specialty === "conservative") {
        state = "PROTEGER";
      }
      team.plan = {
        state,
        protectedRider: isPlayerTeam ? this.player : team.objectiveRider,
        pullers: availablePullers.slice(0, state === "PREPARAR SPRINT" ? 4 : 3),
        rival: breakaway?.leader || this.ranking.find((rider) => rider.team !== team.name && rider.role === "leader") || null,
        breakaway,
        objective: team.objectiveLabel
      };
      if (isPlayerTeam) {
        const nearbyHelpers = team.riders.filter((rider) =>
          rider !== this.player && rider.role === "domestique" && !rider.finished &&
          Math.abs(rider.distance - this.player.distance) < 0.32).length;
        this.player.teamworkBonus = state === "PROTEGER"
          ? Math.min(0.9, nearbyHelpers * 0.18 * this.difficultyConfig.coordination) : 0;
      }
      team.statesSeen.add(state);
      if (!force && state !== previousState && ["PERSEGUIR", "ATACAR", "PREPARAR SPRINT"].includes(state) &&
        !this.simulationOnly && this.elapsed - this.lastTeamAnnouncement > 5) {
        this.lastTeamAnnouncement = this.elapsed;
        const message = state === "PERSEGUIR"
          ? `${team.name} organiza la persecución.`
          : state === "ATACAR" ? `${team.name} prepara un movimiento.`
            : `${team.name} forma el tren de sprint.`;
        this.game.notify(message, state === "ATACAR" ? "urgent" : "");
      }
      team.lastAnnouncedState = state;
    }
  }

  get leader() { return this.ranking[0]; }

  positionOf(cyclist) {
    return this.ranking.indexOf(cyclist) + 1;
  }

  isolationExposureFor(cyclist) {
    if (!cyclist || cyclist.finished || this.timeTrial || cyclist.draft >= 12 || this.isRelayParticipant(cyclist)) return 0;
    const nearby = this.proximityCache.get(cyclist) || [];
    const nearestDistance = nearby.reduce((nearest, rider) =>
      rider.finished ? nearest : Math.min(nearest, Math.abs(rider.distance - cyclist.distance)), Infinity);
    // Hasta 40 m se considera que hay compañía útil. Entre 40 y 140 m la
    // exposición crece gradualmente para evitar saltos bruscos de consumo.
    return Number.isFinite(nearestDistance)
      ? clamp((nearestDistance - 0.04) / 0.1, 0, 1)
      : 1;
  }

  leaderExposureFor(cyclist) {
    return this.isolationExposureFor(cyclist);
  }

  sprintWindowFor(rider) {
    const finishDistance = this.road.lengthKm - rider.distance;
    const sprintPoint = this.road.intermediateSprints.find((point) => point.km >= rider.distance && point.km - rider.distance <= 1);
    const distance = sprintPoint ? sprintPoint.km - rider.distance : finishDistance;
    if (distance >= 0.12 && distance <= 0.24) return { quality: "PERFECTO", multiplier: 1.16, distance };
    if (distance > 0.24 && distance <= 0.45) return { quality: "BUENO", multiplier: 1, distance };
    if (distance < 0.12) return { quality: "TARDE", multiplier: 0.9, distance };
    return { quality: "TEMPRANO", multiplier: 0.8, distance };
  }

  attackWindowFor(rider) {
    const gradient = this.road.getGradient(rider.distance);
    const mountain = this.road.mountains.find((point) => point.km > rider.distance);
    const distance = mountain ? mountain.km - rider.distance : Infinity;
    if (this.elapsed - this.lastRivalAttackTime <= 4) return { quality: "RESPUESTA", multiplier: 1.1 };
    if (gradient >= 4 && distance >= 0.35 && distance <= 0.9) return { quality: "PERFECTO", multiplier: 1.18 };
    if (gradient >= 3 || distance <= 1.5) return { quality: "BUENO", multiplier: 1.05 };
    return { quality: "NORMAL", multiplier: 1 };
  }

  updateRanking() {
    this.ranking = [...this.cyclists].sort((a, b) => {
      if (a.finished && b.finished) return a.finishTime - b.finishTime;
      if (a.finished) return -1;
      if (b.finished) return 1;
      return b.distance - a.distance;
    });
    this.buildGroups();
    const playerGroupIndex = this.groups.findIndex((group) => group.riders.includes(this.player));
    if (playerGroupIndex === 0) {
      this.player.group = this.positionOf(this.player) === 1 ? "CABEZA" : "GRUPO CABEZA";
    } else if (playerGroupIndex > 0) {
      this.player.group = this.groups[playerGroupIndex].label;
    }
  }

  buildGroups() {
    const activeRanking = this.ranking.filter((rider) => !rider.finished);
    if (this.timeTrial) {
      this.groups = activeRanking.length ? [{
        riders: [this.player], leader: this.player, tail: this.player, index: 0,
        label: "CRONO", gapKm: 0, gapPreviousKm: 0, gapPreviousSeconds: 0,
        tendency: "EN SOLITARIO", teams: [this.player.team]
      }] : [];
      this.player.group = "CRONO";
      return;
    }
    const groups = [];
    // Conserva únicamente los tres cortes más importantes. Así una escapada de
    // 30 s sigue apareciendo, pero una fila estirada no crea veinte grupos.
    const candidateCuts = [];
    for (let index = 1; index < activeRanking.length; index += 1) {
      const previous = activeRanking[index - 1];
      const rider = activeRanking[index];
      const referenceSpeed = Math.max(22, (previous.speed + rider.speed) / 2);
      const gapSeconds = (previous.distance - rider.distance) / referenceSpeed * 3600;
      if (gapSeconds > 20) candidateCuts.push({ index, gapSeconds });
    }
    const selectedCuts = new Set(candidateCuts
      .sort((a, b) => b.gapSeconds - a.gapSeconds)
      .slice(0, 3)
      .map((cut) => cut.index));
    activeRanking.forEach((rider, index) => {
      if (index === 0 || selectedCuts.has(index)) groups.push({ riders: [], leader: rider, tail: rider });
      const group = groups.at(-1);
      group.riders.push(rider);
      group.tail = rider;
    });

    const raceLeader = activeRanking[0];
    const mainGroupIndex = groups.reduce((bestIndex, group, index) =>
      bestIndex < 0 || group.riders.length > groups[bestIndex].riders.length ? index : bestIndex, -1);
    const sampleTrend = this.elapsed - this.lastGroupTrendSample >= 2;
    groups.forEach((group, index) => {
      const previousGroup = groups[index - 1];
      const referenceSpeed = previousGroup
        ? Math.max(22, (previousGroup.tail.speed + group.leader.speed) / 2) : Math.max(22, group.leader.speed);
      const gapPreviousKm = previousGroup ? Math.max(0, previousGroup.tail.distance - group.leader.distance) : 0;
      const gapPreviousSeconds = gapPreviousKm / referenceSpeed * 3600;
      const previousGap = this.previousGroupGaps[index];
      if (sampleTrend && index > 0 && Number.isFinite(previousGap)) {
        const delta = gapPreviousSeconds - previousGap;
        this.groupTrends[index] = delta > 1.5 ? "CEDIENDO" : delta < -1.5 ? "GANANDO" : "ESTABLE";
      }
      const teamCounts = new Map();
      group.riders.forEach((rider) => teamCounts.set(rider.team, (teamCounts.get(rider.team) || 0) + 1));
      group.index = index;
      group.label = groups.length === 1 ? "PELOTÓN"
        : index === 0 && mainGroupIndex > 0 ? "FUGA"
          : index === mainGroupIndex ? "PELOTÓN"
            : index < mainGroupIndex ? "PERSEGUIDORES" : "REZAGADOS";
      group.gapKm = raceLeader ? Math.max(0, raceLeader.distance - group.leader.distance) : 0;
      group.gapPreviousKm = gapPreviousKm;
      group.gapPreviousSeconds = gapPreviousSeconds;
      group.tendency = index === 0 ? "CABEZA" : this.groupTrends[index] || "ESTABLE";
      group.teams = [...teamCounts.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name);
    });
    if (sampleTrend) {
      this.previousGroupGaps = groups.map((group) => group.gapPreviousSeconds);
      this.lastGroupTrendSample = this.elapsed;
    }
    this.groups = groups;
    if (groups.length !== this.previousGroupCount && this.elapsed - this.lastGroupEvent > 8 && groups.length > 1) {
      this.lastGroupEvent = this.elapsed;
      this.game.notify(`La carrera se divide en ${groups.length} grupos.`);
    }
    this.previousGroupCount = groups.length;
  }

  refreshProximity() {
    this.spatialIndex.rebuild(this.cyclists);
    this.proximityCache.clear();
    for (const rider of this.cyclists) {
      if (!rider.finished) this.proximityCache.set(rider, this.spatialIndex.query(rider, 0.14, 0.75));
    }
  }

  applyDraftingAndSeparation() {
    if (this.timeTrial) {
      this.cyclists.forEach((rider) => {
        rider.draft = 0;
        rider.avoiding = false;
        rider.targetLateral = 0;
      });
      this.applyVehicleAvoidance();
      this.player.teamProtection = 0;
      this.activePlayerProtectors = 0;
      return;
    }
    for (const rider of this.cyclists) {
      if (rider.finished) continue;
      rider.avoiding = false;
      let best = null;
      let bestDistance = Infinity;
      for (const other of this.proximityCache.get(rider) || []) {
        const ahead = other.distance - rider.distance;
        const lateral = Math.abs(other.lateral - rider.lateral);
        if (ahead > 0.008 && ahead < 0.095 && lateral < 0.34 && ahead < bestDistance) {
          best = other;
          bestDistance = ahead;
        }
      }
      const targetDraft = best ? clamp((1 - bestDistance / 0.095) * (1 - Math.abs(best.lateral - rider.lateral) / 0.34) * 100, 0, 100) : 0;
      rider.draft = lerp(rider.draft, targetDraft, 0.08);
      if (rider === this.player && rider.seekingWheel && rider.wheelTarget) {
        const target = rider.wheelTarget;
        const targetGap = target.distance - rider.distance;
        if (target.finished || targetGap < -0.025 || targetGap > 0.9) {
          this.game.cancelWheelTarget(false);
          this.game.notify("Has perdido la rueda seleccionada.");
        } else {
          rider.targetLateral = clamp(target.lateral + Math.sin(this.elapsed * 0.5) * 0.018, -0.9, 0.9);
          if (targetGap > 0.12 && rider.effort < 4 && this.elapsed - rider.lastWheelPowerWarning > 5) {
            rider.lastWheelPowerWarning = this.elapsed;
            this.game.notify("La rueda se aleja: elige ALTO para alcanzarla.");
          } else if (targetGap < 0.009) {
            rider.avoidanceBrake = Math.max(rider.avoidanceBrake, 2.2);
          }
        }
      } else if (rider instanceof AICyclist && rider.targetWheel) {
        const target = rider.targetWheel;
        const targetGap = target.distance - rider.distance;
        if (target.finished || targetGap < -0.035 || targetGap > 1.1) {
          rider.targetWheel = null;
        } else {
          rider.targetLateral = clamp(target.lateral + Math.sin(rider.personalityPhase) * 0.025, -0.9, 0.9);
          if (targetGap < 0.009) rider.avoidanceBrake = Math.max(rider.avoidanceBrake, 1.8);
        }
      }
    }
    this.applyCollisionAvoidance();
    this.applyVehicleAvoidance();
    this.updatePlayerTeamProtection();
  }

  applySimulationDrafting() {
    if (this.timeTrial) {
      this.cyclists.forEach((rider) => {
        rider.draft = 0;
        rider.avoiding = false;
      });
      this.player.teamProtection = 0;
      this.activePlayerProtectors = 0;
      return;
    }
    const active = this.ranking.filter((rider) => !rider.finished);
    for (let index = 0; index < active.length; index += 1) {
      const rider = active[index];
      rider.avoiding = false;
      const ahead = active[index - 1];
      if (!ahead) {
        rider.draft = lerp(rider.draft, 0, 0.08);
        continue;
      }
      const gap = ahead.distance - rider.distance;
      const lateral = Math.abs(ahead.lateral - rider.lateral);
      const targetDraft = gap > 0.008 && gap < 0.095 && lateral < 0.34
        ? clamp((1 - gap / 0.095) * (1 - lateral / 0.34) * 100, 0, 100)
        : 0;
      rider.draft = lerp(rider.draft, targetDraft, 0.08);
    }
    this.updatePlayerTeamProtection();
  }

  laneCost(rider, candidate) {
    let cost = Math.abs(candidate - rider.lateral) * 0.7;
    if (Math.abs(candidate) > 0.84) cost += 4 + (Math.abs(candidate) - 0.84) * 20;
    for (const other of this.proximityCache.get(rider) || []) {
      const longitudinal = Math.abs(other.distance - rider.distance);
      const lateral = Math.abs(other.lateral - candidate);
      if (longitudinal < 0.055 && lateral < 0.3) {
        cost += (1 - longitudinal / 0.055) * (1 - lateral / 0.3) * 8;
      }
    }
    for (const vehicle of this.raceVehicles || []) {
      if (!vehicle.active) continue;
      const longitudinal = Math.abs(vehicle.distance - rider.distance);
      const lateral = Math.abs(vehicle.lateral - candidate);
      const vehicleWidth = vehicle.type === "tv" ? 0.3 : 0.46;
      if (longitudinal < 0.14 && lateral < vehicleWidth) {
        cost += 30 + (1 - longitudinal / 0.14) * 35;
      }
    }
    return cost;
  }

  applyVehicleAvoidance() {
    const riders = this.timeTrial ? [this.player] : this.cyclists;
    for (const rider of riders) {
      if (rider.finished || rider.crashTimer > 0) continue;
      let threat = null;
      let nearest = Infinity;
      for (const vehicle of this.raceVehicles || []) {
        if (!vehicle.active) continue;
        const ahead = vehicle.distance - rider.distance;
        const lateralGap = Math.abs(vehicle.lateral - rider.lateral);
        const vehicleWidth = vehicle.type === "tv" ? 0.3 : 0.46;
        if (ahead <= 0 || ahead > 0.15 || lateralGap >= vehicleWidth || ahead >= nearest) continue;
        threat = vehicle;
        nearest = ahead;
      }
      if (!threat) continue;
      const preferredDirection = threat.lateral >= 0 ? -1 : 1;
      const primaryLane = clamp(threat.lateral + preferredDirection * 0.78, -0.9, 0.9);
      const alternateLane = clamp(threat.lateral - preferredDirection * 0.78, -0.9, 0.9);
      const primaryCost = this.laneCost(rider, primaryLane);
      const alternateCost = this.laneCost(rider, alternateLane);
      const bestLane = primaryCost <= alternateCost ? primaryLane : alternateLane;
      const bestCost = Math.min(primaryCost, alternateCost);
      rider.avoiding = true;
      if (bestCost < 28) {
        rider.targetLateral = bestLane;
        rider.avoidanceBrake = Math.max(rider.avoidanceBrake, nearest < 0.055 ? 3.8 : 1.4);
      } else {
        // Si ambos laterales están ocupados, iguala la velocidad hasta que se
        // abra un hueco. Nunca atraviesa el vehículo por la misma trayectoria.
        rider.avoidanceBrake = Math.max(rider.avoidanceBrake, 8.5);
        rider.targetSpeed = Math.min(rider.targetSpeed, Math.max(8, threat.speed - 1));
      }
    }
  }

  applyCollisionAvoidance() {
    for (const rider of this.cyclists) {
      if (rider.finished || rider.crashTimer > 0) continue;
      const lookAhead = 0.022 + rider.intelligence * 0.00038;
      let threat = null;
      let highestUrgency = 0;
      for (const other of this.proximityCache.get(rider) || []) {
        const ahead = other.distance - rider.distance;
        const lateralGap = Math.abs(other.lateral - rider.lateral);
        if (ahead <= 0 || ahead > lookAhead || lateralGap > 0.25) continue;
        const closingKmPerSecond = Math.max(0, rider.speed - other.speed) * this.simulationScale / 3600;
        const timeToContact = closingKmPerSecond > 0.0001 ? ahead / closingKmPerSecond : Infinity;
        const urgency = ahead < 0.0065 ? 3 : timeToContact < 1.4 ? 2 - timeToContact * 0.5 : 0;
        if (urgency > highestUrgency) {
          threat = other;
          highestUrgency = urgency;
        }
      }
      if (!threat) continue;

      const step = 0.29;
      const left = clamp(rider.lateral - step, -0.9, 0.9);
      const right = clamp(rider.lateral + step, -0.9, 0.9);
      const leftCost = this.laneCost(rider, left);
      const rightCost = this.laneCost(rider, right);
      const bestLane = leftCost <= rightCost ? left : right;
      const bestCost = Math.min(leftCost, rightCost);
      rider.avoiding = true;
      if (bestCost < 5.2) {
        rider.targetLateral = bestLane;
        rider.avoidanceBrake = Math.max(rider.avoidanceBrake, highestUrgency > 2.5 ? 2.8 : 1.2);
      } else {
        // Si ambos lados están ocupados, iguala la velocidad en vez de forzar un hueco.
        rider.avoidanceBrake = Math.max(rider.avoidanceBrake, 4.5 + highestUrgency * 1.4);
        rider.targetLateral = lerp(rider.targetLateral, rider.lateral, 0.65);
      }
    }
  }

  resolveCollisions() {
    // La salida necesita unos segundos para que los 100 corredores abran huecos.
    // Sin esta gracia, los solapes de la parrilla cuentan como choques reales.
    if (this.elapsed < 4) return;
    if (this.collisionPairs.size > 1800) {
      for (const [key, until] of this.collisionPairs) if (until <= this.elapsed) this.collisionPairs.delete(key);
    }
    for (let first = 0; first < this.cyclists.length; first += 1) {
      const a = this.cyclists[first];
      for (const b of this.proximityCache.get(a) || []) {
        const second = this.riderIndices.get(b);
        if (second <= first) continue;
        const pairKey = `${first}:${second}`;
        if ((this.collisionPairs.get(pairKey) || 0) > this.elapsed) continue;
        if (a.finished || b.finished || a.crashTimer > 1.6 || b.crashTimer > 1.6) continue;
        const previousGap = a.previousDistance - b.previousDistance;
        const currentGap = a.distance - b.distance;
        const crossed = previousGap === 0 || previousGap * currentGap <= 0;
        const touchingLength = Math.abs(currentGap) < 0.0055;
        const touchingWidth = Math.abs(a.lateral - b.lateral) < 0.14;
        if ((!crossed && !touchingLength) || !touchingWidth) continue;
        this.collisionPairs.set(pairKey, this.elapsed + 1.25);

        const front = a.previousDistance >= b.previousDistance ? a : b;
        const back = front === a ? b : a;
        back.distance = Math.min(back.distance, front.distance - 0.004);
        const direction = a.lateral === b.lateral ? (first % 2 ? -1 : 1) : Math.sign(a.lateral - b.lateral);
        a.lateral = clamp(a.lateral + direction * 0.055, -0.92, 0.92);
        b.lateral = clamp(b.lateral - direction * 0.055, -0.92, 0.92);
        a.targetLateral = clamp(a.lateral + direction * 0.18, -0.9, 0.9);
        b.targetLateral = clamp(b.lateral - direction * 0.18, -0.9, 0.9);
        for (const rider of [a, b]) {
          rider.speed *= 0.84;
          rider.energy = clamp(rider.energy - 0.8, 0, 100);
          rider.riskAccumulator += 0.9 + this.weather.intensity * 0.45;
          rider.avoidanceBrake = Math.max(rider.avoidanceBrake, 5.5);
        }
        if ((a === this.player || b === this.player) && this.player.collisionCooldown <= 0) {
          this.player.collisionCooldown = 2.5;
          this.game.cameraShake = Math.max(this.game.cameraShake, 0.28);
          this.game.notify("¡Contacto! Has perdido velocidad.", "urgent");
        }
      }
    }
  }

  resolveVehicleClearances() {
    const riders = this.timeTrial ? [this.player] : this.cyclists;
    for (const vehicle of this.raceVehicles || []) {
      if (!vehicle.active) continue;
      const vehicleWidth = vehicle.type === "tv" ? 0.27 : 0.42;
      const longitudinalClearance = vehicle.type === "tv" ? 0.032 : 0.052;
      for (const rider of riders) {
        if (rider.finished || rider.crashTimer > 1.6) continue;
        const longitudinal = vehicle.distance - rider.distance;
        const lateralGap = Math.abs(vehicle.lateral - rider.lateral);
        if (Math.abs(longitudinal) >= longitudinalClearance || lateralGap >= vehicleWidth) continue;
        const direction = vehicle.lateral >= 0 ? -1 : 1;
        if (longitudinal >= 0) {
          rider.distance = Math.min(rider.distance, vehicle.distance - longitudinalClearance);
          rider.speed = Math.min(rider.speed, Math.max(8, vehicle.speed - 1));
          rider.avoidanceBrake = Math.max(rider.avoidanceBrake, 9);
          rider.targetLateral = clamp(vehicle.lateral + direction * 0.78, -0.9, 0.9);
        } else if (vehicle.type === "team" || vehicle.type === "tv") {
          // Coches y motos ceden ante un ciclista que ya los ha superado.
          vehicle.distance = Math.min(vehicle.distance, rider.distance - longitudinalClearance);
          vehicle.speed = Math.min(vehicle.speed, Math.max(6, rider.speed - 4));
        }
      }
    }
  }

  processRacePoints() {
    for (const point of this.road.racePoints) {
      if (point.completed) continue;
      const crossers = this.cyclists
        .filter((rider) => !point.results.includes(rider) && rider.previousDistance < point.km && rider.distance >= point.km)
        .sort((a, b) => b.distance - a.distance);
      for (const rider of crossers) {
        if (point.results.length >= 5) break;
        const place = point.results.length;
        const pointsTable = point.pointsTable || (point.type === "sprint"
          ? SPRINT_POINTS
          : [point.maxPoints, Math.ceil(point.maxPoints * 0.6), Math.ceil(point.maxPoints * 0.4), 2, 1]);
        const baseAwarded = pointsTable[place];
        const awarded = baseAwarded;
        point.results.push(rider);
        const standings = this.pointStandings[point.type];
        standings.set(rider, (standings.get(rider) || 0) + awarded);
        if (place === 0) rider.moraleTimer = Math.max(rider.moraleTimer, 3);
        if (rider === this.player) {
          if (point.type === "mountain") rider.mountainPoints += awarded;
          else rider.sprintPoints += awarded;
          if (place === 0) {
            this.game.showResourceFeedback([
              { icon: "★", text: "MORAL +3 s", type: "power" }
            ]);
          }
          this.game.audio.play(point.type === "mountain" ? "mountain" : "checkpoint");
          this.game.notify(`${place + 1}.º en ${point.name}: +${awarded} puntos.`, "urgent");
        }
      }
      if (point.results.length >= 5) point.completed = true;
    }
  }

  finalizeRacePoints() {
    for (const point of this.road.racePoints) {
      if (point.results.length >= 5) continue;
      const remainingPlaces = this.ranking
        .filter((rider) => !point.results.includes(rider))
        .slice(0, 5 - point.results.length);
      for (const rider of remainingPlaces) {
        const place = point.results.length;
        const pointsTable = point.pointsTable || (point.type === "sprint"
          ? SPRINT_POINTS
          : [point.maxPoints, Math.ceil(point.maxPoints * 0.6), Math.ceil(point.maxPoints * 0.4), 2, 1]);
        const awarded = pointsTable[place];
        point.results.push(rider);
        const standings = this.pointStandings[point.type];
        standings.set(rider, (standings.get(rider) || 0) + awarded);
        if (rider === this.player) {
          if (point.type === "mountain") rider.mountainPoints += awarded;
          else rider.sprintPoints += awarded;
        }
      }
      point.completed = true;
    }
  }

  evaluateCrash(rider, dt) {
    if (this.elapsed < 4 || rider.crashTimer > 0 || rider.finished) return;
    const gradient = this.road.getGradient(rider.distance);
    const curve = Math.abs(this.road.curvatureAt(rider.distance));
    const isSprinter = rider.role === "sprinter" || derivedSpecialty(rider) === "SPRINTER";
    const aggressiveDescent = gradient <= RECOVERY_DESCENT_GRADIENT &&
      rider.riskMode === "aggressive" && !isSprinter;
    // En una bajada recta la fórmula general apenas generaba peligro. Los no
    // sprinters acumulan ahora un riesgo adicional que crece con la pendiente.
    const descentDanger = aggressiveDescent
      ? 40 + Math.min(32, Math.abs(gradient) * 3.5)
      : 0;
    // La postura agresiva sobre firme mojado multiplica el riesgo: la lluvia
    // ya reduce la adherencia, pero esta combinación debe poder causar una
    // caída incluso en un tramo sin una curva especialmente cerrada.
    const wetAggressiveDanger = rider.riskMode === "aggressive"
      ? this.weather.intensity * 32
      : 0;
    const danger = (100 - rider.grip) * 0.62 + curve * 38 + this.weather.intensity * 18 +
      (rider.riskMode === "aggressive" ? 18 : rider.riskMode === "safe" ? -12 : 0) +
      descentDanger + wetAggressiveDanger;
    if (danger > 72) rider.riskAccumulator += (danger - 72) * dt * 0.022;
    else rider.riskAccumulator = Math.max(0, rider.riskAccumulator - dt * 0.32);
    const difficultySafety = rider === this.player && this.difficulty === "easy" ? 0.45 : 0;
    const threshold = 6.55 + (rider.technique - 70) * 0.025 + difficultySafety;
    if (rider.riskAccumulator > threshold) {
      rider.riskAccumulator = 0;
      rider.crashTimer = 3.2;
      rider.energy = clamp(rider.energy - 11, 0, 100);
      rider.targetLateral = clamp(rider.lateral + (rider.lateral > 0 ? -0.35 : 0.35), -0.9, 0.9);
      if (rider === this.player) {
        rider.crashes += 1;
        this.game.cameraShake = 1;
        this.game.notify(
          aggressiveDescent
            ? "Te has caído arriesgando en el descenso. ¡Vuelve a carrera!"
            : "Has sufrido una caída. ¡Vuelve a carrera!",
          "urgent"
        );
      }
    }
  }

  update(dt) {
    this.elapsed += dt;
    this.updateRelay(dt);
    this.teamTacticTimer = Math.max(0, this.teamTacticTimer - dt);
    this.updateTeamTactics();
    const context = {
      game: this.game, race: this, road: this.road, weather: this.weather,
      simulationScale: this.simulationScale
    };
    this.updateBreakawayDirector(context);
    if (this.weather.update(this.player.distance)) {
      this.game.notify(this.weather.state === "heavy" ? "La lluvia aumenta. Cuidado en las curvas." : "Empieza a llover.");
    }
    const currentBiome = this.road.biomeAt(this.player.distance);
    if (currentBiome.id !== this.currentBiomeId) {
      this.currentBiomeId = currentBiome.id;
      this.game.notify(`Nuevo escenario: ${currentBiome.name}.`);
    }
    const sprintPointAhead = this.road.intermediateSprints.find((point) => point.km >= this.player.distance && point.km - this.player.distance <= 1);
    const attackResponse = this.activeRivalAttackForPlayer();
    this.player.sprintAllowed = this.road.lengthKm - this.player.distance <= 1 ||
      Boolean(sprintPointAhead) || Boolean(attackResponse);
    if (!this.simulationOnly) this.updateRaceVehicles(dt);
    this.refreshProximity();
    if (this.simulationOnly) this.applySimulationDrafting();
    else this.applyDraftingAndSeparation();
    for (const rider of this.cyclists) {
      this.applyRelayInstruction(rider);
      rider.update(dt, context);
      this.evaluateCrash(rider, dt);
    }
    if (!this.simulationOnly) this.resolveVehicleClearances();
    this.processRacePoints();
    if (!this.simulationOnly && !this.timeTrial) {
      this.refreshProximity();
      this.resolveCollisions();
    }
    for (const rider of this.cyclists) {
      if (!rider.finished && rider.distance >= this.road.lengthKm) {
        rider.distance = this.road.lengthKm;
        rider.finished = true;
        rider.finishTime = this.elapsed;
        this.finishOrder.push(rider);
        rider.victory = this.finishOrder.length === 1;
        if (rider === this.player) this.game.audio.play("finish");
      }
    }
    this.updateRanking();
    this.handleRaceEvents();
    if (this.player.finished) {
      this.finishElapsed += dt;
      if (this.finishElapsed > 1.4) this.game.finishRace();
    }
  }

  handleRaceEvents() {
    const player = this.player;
    for (const point of this.road.racePoints) {
      const distanceToPoint = point.km - player.distance;
      if (distanceToPoint > 0 && distanceToPoint <= 1.5 * this.difficultyConfig.warningLead && !point.playerAnnounced) {
        point.playerAnnounced = true;
        this.game.notify(point.type === "mountain"
          ? `${point.name} · Puerto ${point.category} · ${point.pointsTable.join("-")} pt · en ${formatNumber(distanceToPoint)} km.`
          : `${point.name} · Meta volante · ${point.pointsTable.join("-")} pt · en ${formatNumber(distanceToPoint)} km.`, "urgent");
      }
      if (!point.playerPassed && player.previousDistance < point.km && player.distance >= point.km) {
        point.playerPassed = true;
        if (point.type === "sprint") {
          player.sprinting = false;
          player.sprintMultiplier = 1;
          player.responseSprintTimer = 0;
          if (player.effort === 5) player.effort = 4;
        }
      }
    }
    player.wasDrafting = player.draft > 18;
    if (player.energy < 24 && !this.lowEnergyAnnounced) {
      this.lowEnergyAnnounced = true;
      this.game.notify("Te estás quedando sin energía.", "urgent");
    }
    if (player.nutrition < 22 && !this.lowNutritionAnnounced) {
      this.lowNutritionAnnounced = true;
      this.game.notify("Sin nutrición no podrás recuperar energía. Usa un gel.", "urgent");
    }
    if (player.explosive < 18 && !this.lowExplosiveAnnounced) {
      this.lowExplosiveAnnounced = true;
      this.game.notify("Explosividad crítica: evita otro ataque y recupera.", "urgent");
    }
    if (player.distance >= this.road.lengthKm - 1 && !this.lastKmAnnounced) {
      this.lastKmAnnounced = true;
      this.game.audio.play("lastKm");
    }
    const nextDanger = this.road.nextDanger(player.distance);
    const meters = nextDanger ? (nextDanger - player.distance) * 1000 : Infinity;
    const showDanger = meters > 0 && meters <= 250;
    this.game.hud.showDanger(showDanger, meters);
    if (showDanger && this.lastDangerKm !== nextDanger) {
      this.lastDangerKm = nextDanger;
      this.game.audio.play("danger");
    }
  }
}

class HUD {
  constructor(game) {
    this.game = game;
    this.elements = {};
    const ids = [
      "currentKm", "totalKm", "remainingKm", "gradientValue", "altitudeValue", "ascentValue", "startElevationLabel", "finishElevationLabel",
      "stageName", "stageEyebrow", "weatherValue", "weatherIcon",
      "positionValue", "groupValue", "energyValue", "powerValue", "nutritionValue", "gripValue",
      "energyBar", "powerBar", "nutritionBar", "gripBar",
      "effortNumber", "effortName", "sprintButton", "attackButton",
      "relayButton", "relayButtonDetail", "gelButton", "gelButtonDetail", "lastKmOverlay", "finishMeters", "dangerBanner", "dangerDistance",
      "directorTip", "vignette", "profileCanvas", "profileTooltip", "groupsPanel", "groupsCount", "groupsList",
      "racePointCard", "racePointType", "racePointName", "racePointDistance", "followCard", "followModeLabel", "followRiderName", "followRiderJersey", "followRiderInfo",
      "teamOrderButton", "teamOrderCurrent", "contextSpeed", "contextRiderState", "contextEnergyRate", "contextRisk",
      "mobileViewTabs", "mobileClassificationPanel", "mobileClassificationList", "mobileRacePosition", "mobileJumpToPlayer",
      "mobileGroupsPanel", "mobileGroupsCount", "mobileGroupsList",
      "mobileStagePanel", "mobileStageProgressText", "mobileStageName", "mobileStageProgressBar",
      "mobileStageDistance", "mobileStageAscent", "mobileStageMountains", "mobileStageSprints",
      "mobileStageBiome", "mobileStageWeather", "mobileStageElapsed", "mobileStageGroups"
    ];
    ids.forEach((id) => { this.elements[id] = document.getElementById(id); });
    this.profileCtx = this.elements.profileCanvas.getContext("2d");
    this.profileCtx.imageSmoothingEnabled = false;
    this.profileHitAreas = [];
    this.profileKeyboardIndex = 0;
    this.mobileView = "race";
    this.lastMobilePanelUpdate = 0;
    this.mobileRankingRows = new Map();
    this.followCardRider = null;
    this.followCardMode = "";
    this.lastFollowCardUpdate = 0;
    this.followCardUntil = 0;
    this.racePointPopupKey = "";
    this.racePointPopupUntil = 0;
    this.lastKmPopupShown = false;
    this.lastKmPopupUntil = 0;
    this.dangerPopupActive = false;
    this.dangerPopupUntil = 0;
    this.profileTooltipTimer = null;
    this.bindProfileMap();
    this.bindMobileViews();
  }

  bindMobileViews() {
    const activateTab = (event) => {
      const button = event.target.closest("[data-mobile-view]");
      if (!button) return;
      this.setMobileView(button.dataset.mobileView);
    };
    this.elements.mobileViewTabs.addEventListener("click", activateTab);
    const returnToRace = (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.setMobileView("race");
    };
    document.querySelectorAll("[data-return-to-race]").forEach((button) => {
      button.addEventListener("click", returnToRace);
    });
    this.elements.mobileGroupsList.addEventListener("click", (event) => {
      const row = event.target.closest("[data-group-index]");
      if (!row) return;
      this.game.inspectGroup(Number(row.dataset.groupIndex));
      this.setMobileView("race");
    });
    const selectRankingRider = (row) => {
      const rider = this.game.race?.ranking[Number(row?.dataset.rankingIndex)];
      if (!rider || rider === this.game.race.player || this.game.state !== "RACING") return;
      this.game.selectWheel(rider);
      this.setMobileView("race");
    };
    this.elements.mobileClassificationList.addEventListener("click", (event) => {
      selectRankingRider(event.target.closest("[data-ranking-index]"));
    });
    this.elements.mobileClassificationList.addEventListener("keydown", (event) => {
      if (!["Enter", " "].includes(event.key)) return;
      event.preventDefault();
      selectRankingRider(event.target.closest("[data-ranking-index]"));
    });
    this.elements.mobileJumpToPlayer.addEventListener("click", () => {
      this.elements.mobileClassificationList.querySelector(".player")
        ?.scrollIntoView({ block: "center", behavior: this.game.reducedMotion ? "auto" : "smooth" });
    });
  }

  setMobileView(view) {
    this.mobileView = ["race", "groups", "classification", "stage"].includes(view) ? view : "race";
    document.querySelector(".race-viewport")?.classList.toggle("mobile-submenu-open", this.mobileView !== "race");
    this.elements.mobileViewTabs.querySelectorAll("[data-mobile-view]").forEach((button) => {
      const active = button.dataset.mobileView === this.mobileView;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", String(active));
    });
    [
      [this.elements.mobileGroupsPanel, "groups"],
      [this.elements.mobileClassificationPanel, "classification"],
      [this.elements.mobileStagePanel, "stage"]
    ].forEach(([panel, panelView]) => {
      const hidden = this.mobileView !== panelView;
      panel.classList.toggle("is-hidden", hidden);
      panel.setAttribute("aria-hidden", String(hidden));
    });
    const teamButton = document.getElementById("teamOrderButton");
    if (teamButton && window.innerWidth <= 900) {
      teamButton.classList.toggle("is-hidden", this.mobileView !== "race" || Boolean(this.game.race?.timeTrial));
      if (this.mobileView !== "race") this.game.closeTeamOrders();
    }
    // Al volver a la carretera no hace falta reconstruir el contenido de los
    // paneles. Ocultarlos primero y terminar aquí hace el retorno inmediato
    // incluso en Safari móvil durante un frame de Canvas pesado.
    if (this.game.race && this.mobileView !== "race") this.updateMobilePanels(this.game.race, true);
  }

  bindProfileMap() {
    const canvas = this.elements.profileCanvas;
    canvas.addEventListener("pointermove", (event) => {
      // Safari y Chrome móviles sintetizan movimientos mientras el dedo está
      // apoyado. No son un hover real y alternaban la ficha al mínimo gesto.
      if (event.pointerType === "touch") return;
      const hit = this.profileHitAt(event);
      canvas.style.cursor = hit ? "pointer" : "crosshair";
      if (hit) this.showProfileTooltip(hit.groupIndex, true);
      else this.elements.profileTooltip.classList.add("is-hidden");
    });
    canvas.addEventListener("pointerleave", () => {
      this.elements.profileTooltip.classList.add("is-hidden");
      if (this.profileTooltipTimer !== null) window.clearTimeout(this.profileTooltipTimer);
      this.profileTooltipTimer = null;
    });
    canvas.addEventListener("click", (event) => {
      if (!this.game.race) return;
      const hit = this.profileHitAt(event);
      if (hit) this.game.inspectGroup(hit.groupIndex);
      else {
        const rect = canvas.getBoundingClientRect();
        const km = clamp((event.clientX - rect.left) / rect.width, 0, 1) * this.game.race.road.lengthKm;
        this.game.inspectKm(km);
      }
    });
    canvas.addEventListener("keydown", (event) => {
      if (!this.game.race?.groups.length) return;
      if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
        event.preventDefault();
        const direction = event.key === "ArrowRight" ? 1 : -1;
        this.profileKeyboardIndex = (this.profileKeyboardIndex + direction + this.game.race.groups.length) % this.game.race.groups.length;
        this.showProfileTooltip(this.profileKeyboardIndex);
      } else if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        this.game.inspectGroup(this.profileKeyboardIndex);
      }
    });
    this.elements.groupsList.addEventListener("click", (event) => {
      const row = event.target.closest("[data-group-index]");
      if (row) this.game.inspectGroup(Number(row.dataset.groupIndex));
    });
  }

  profileHitAt(event) {
    const canvas = this.elements.profileCanvas;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    let nearest = null;
    let distance = Infinity;
    for (const marker of this.profileHitAreas) {
      const markerDistance = Math.hypot(marker.x - x, marker.y - y);
      if (markerDistance < distance) {
        nearest = marker;
        distance = markerDistance;
      }
    }
    return distance <= 18 ? nearest : null;
  }

  showProfileTooltip(groupIndex, persistent = false) {
    const group = this.game.race?.groups[groupIndex];
    if (!group) return;
    const teams = group.teams.slice(0, 4).join(", ");
    this.elements.profileTooltip.textContent = `${group.label} · ${group.leader.flag || ""} ${group.leader.name} · km ${formatNumber(group.leader.distance)} · ${group.riders.length} ciclistas · ${teams} · ${groupIndex ? `+${formatGap(group.gapPreviousSeconds)} al grupo anterior · ${group.tendency}` : "cabeza"}`;
    this.elements.profileTooltip.classList.remove("is-hidden");
    if (this.profileTooltipTimer !== null) window.clearTimeout(this.profileTooltipTimer);
    this.profileTooltipTimer = null;
    if (persistent) return;
    this.profileTooltipTimer = window.setTimeout(() => {
      this.elements.profileTooltip.classList.add("is-hidden");
      this.profileTooltipTimer = null;
    }, POPUP_MAX_MS);
  }

  setMeter(element, value) {
    element.style.setProperty("--meter-value", `${clamp(value, 0, 100)}%`);
    element.style.background = value < 25 ? "#ff4a4f" : "";
  }

  showDanger(show, meters) {
    const now = performance.now();
    if (show && !this.dangerPopupActive) {
      this.dangerPopupActive = true;
      this.dangerPopupUntil = now + POPUP_MAX_MS;
    } else if (!show) {
      this.dangerPopupActive = false;
      this.dangerPopupUntil = 0;
    }
    const visible = show && now < this.dangerPopupUntil;
    this.elements.dangerBanner.classList.toggle("visible", visible);
    if (visible) this.elements.dangerDistance.textContent = `EN ${Math.ceil(meters / 10) * 10} m`;
  }

  update() {
    const { race } = this.game;
    if (!race) return;
    const player = race.player;
    const position = race.positionOf(player);
    const displayDistance = clamp(player.distance, 0, race.road.lengthKm);
    const remaining = clamp(race.road.lengthKm - player.distance, 0, race.road.lengthKm);
    const gradient = race.road.getGradient(displayDistance);
    this.elements.currentKm.textContent = formatNumber(displayDistance);
    this.elements.totalKm.textContent = Math.round(race.road.lengthKm);
    this.elements.remainingKm.textContent = `${formatNumber(remaining)} km`;
    this.elements.stageName.textContent = race.road.stageName;
    this.elements.stageEyebrow.textContent =
      race.stageDefinition.quickRace
        ? `CARRERA RÁPIDA · ${race.stageDefinition.label || "ETAPA"} · ${race.cyclists.length} CICLISTAS`
        : `ETAPA ${race.stageDefinition.number || 1}/${TOUR_STAGE_COUNT} · ${race.stageDefinition.label || "ETAPA"} · ${race.cyclists.length} CICLISTAS`;
    this.elements.gradientValue.textContent = `${gradient >= 0 ? "+" : ""}${formatNumber(gradient)} %`;
    this.elements.altitudeValue.textContent = `${Math.round(race.road.elevationAt(player.distance)).toLocaleString("es-ES")} m`;
    this.elements.ascentValue.textContent = `DESNIVEL +${Math.round(race.road.ascentAt(player.distance)).toLocaleString("es-ES")} / ${Math.round(race.road.totalAscent).toLocaleString("es-ES")} m`;
    this.elements.startElevationLabel.textContent = `SALIDA · ${Math.round(race.road.baseElevation).toLocaleString("es-ES")} m`;
    this.elements.finishElevationLabel.textContent = `META · ${Math.round(race.road.finishElevation).toLocaleString("es-ES")} m`;
    this.elements.weatherValue.textContent = race.weather.label;
    this.elements.weatherIcon.textContent = race.weather.icon;
    this.elements.positionValue.innerHTML = `${position}<sup>º</sup>`;
    this.elements.groupValue.textContent = player.group;
    const order = TEAM_ORDERS[race.playerTeamOrder];
    const activeProtectors = race.activePlayerProtectors || 0;
    this.elements.teamOrderCurrent.textContent = race.playerTeamOrder === "protect" && activeProtectors
      ? `${order.label} · ${activeProtectors}`
      : order.label;
    this.elements.teamOrderButton.title = race.playerTeamOrder === "protect"
      ? activeProtectors
        ? `${activeProtectors} gregario${activeProtectors === 1 ? "" : "s"} tirando delante de ti`
        : "Los gregarios están formando a tu alrededor"
      : `Orden de equipo: ${order.label}`;
    this.elements.energyValue.textContent = Math.round(player.energy);
    this.elements.powerValue.textContent = Math.round(player.explosive);
    this.elements.nutritionValue.textContent = Math.round(player.nutrition);
    this.elements.gripValue.textContent = Math.round(player.grip);
    this.setMeter(this.elements.energyBar, player.energy);
    this.setMeter(this.elements.powerBar, player.explosive);
    this.setMeter(this.elements.nutritionBar, player.nutrition);
    this.setMeter(this.elements.gripBar, player.grip);
    this.elements.nutritionValue.closest(".metric")?.classList.toggle("context-quiet", player.nutrition > 55 && player.gelTimer <= 0);
    this.elements.gripValue.closest(".metric")?.classList.toggle(
      "context-quiet",
      player.grip > 72 && race.weather.intensity < 0.25 && player.riskAccumulator < 1
    );
    const nutritionFactor = clamp((player.nutrition - 18) / 55, 0, 1);
    const descending = gradient <= RECOVERY_DESCENT_GRADIENT;
    const canRecover = nutritionFactor > 0.08 && player.attacking <= 0 && !player.sprinting;
    const enduranceFactor = clamp(1.18 - (player.endurance || 70) * 0.0045, 0.78, 0.9);
    const commonLoad = Math.max(0, gradient) * 0.035 +
      (player.riskMode === "aggressive" ? 0.08 : 0) + race.weather.intensity * 0.06 +
      (player.nutrition < 28 ? 0.22 : 0) - player.draft * 0.0042 -
      clamp(player.teamProtection || 0, 0, 1) * 0.2;
    const estimatedEnergy = (effort) => {
      const effortLoad = effort === 1 ? 0.08 : effort === 2 ? 0.22 : 0.76;
      const progressive = effort === 4 ? clamp((player.highEffortTime - 10) * 0.018, 0, 0.38) : 0;
      const isolationLoad = effort >= 4 && !descending
        ? race.isolationExposureFor(player) * ISOLATION_HIGH_EFFORT_LOAD
        : 0;
      const drain = Math.max(0.02, (effortLoad + commonLoad + progressive + isolationLoad) * enduranceFactor) * 0.21;
      const recovery = canRecover && effort === 1
        ? 0.17 * nutritionFactor
        : canRecover && effort === 2 && descending ? 0.078 * nutritionFactor : 0;
      return effort >= 4 && descending ? 0 : recovery - drain;
    };
    const signedRate = (value) => `${value >= 0 ? "+" : ""}${value.toFixed(2)}`;
    const currentEnergyRate = estimatedEnergy(player.effort);
    const risk = uiRules.riskLabel(player);
    this.elements.contextSpeed.textContent = `${Math.round(player.speed)} km/h`;
    this.elements.contextRiderState.textContent = uiRules.riderState(race, player);
    this.elements.contextEnergyRate.textContent = `E ${signedRate(currentEnergyRate)}/s`;
    this.elements.contextRisk.textContent = `RIESGO ${risk.label}`;
    this.elements.contextRisk.dataset.level = risk.level;
    const effortName = player.effort <= 1 ? "BAJO" : player.effort <= 2 ? "MEDIO" : "ALTO";
    const effortDescription = player.effort <= 1
      ? (canRecover ? "Recupera en cualquier terreno" : "Sin recuperación")
      : player.effort <= 2
        ? (canRecover && descending ? "Recupera en descenso"
          : player.teamProtection > 0.08 ? `Arropado por ${activeProtectors} gregarios` : "Consumo muy lento")
        : descending ? "Sin consumo energético en descenso"
          : player.teamProtection > 0.08 ? `Arropado por ${activeProtectors} gregarios`
            : race.isolationExposureFor(player) > 0.05 ? "Consume más por ir aislado"
            : player.highEffortTime > 10 ? "Consumo de energía creciente" : "Consume energía";
    const effortEffect = player.effort <= 1
      ? (canRecover ? "♥ ↑↑" : "♥ —")
      : player.effort <= 2
        ? (canRecover && descending ? "♥ ↑" : "♥ ↓")
        : descending ? "♥ —" : player.highEffortTime > 10 ? "♥ ↓↓" : "♥ ↓";
    this.elements.effortName.textContent = effortName;
    this.elements.effortNumber.textContent = effortEffect;
    this.elements.effortNumber.title = effortDescription;
    document.querySelectorAll("[data-effort]").forEach((button) => {
      const effort = Number(button.dataset.effort);
      const active = effort === 1 ? player.effort === 1 : effort === 2 ? player.effort === 2 : player.effort >= 3;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
      const detail = button.querySelector("small");
      if (effort === 1) detail.textContent = `E ${signedRate(estimatedEnergy(1))}/s · V −4 · X +${(0.5 * nutritionFactor).toFixed(1)}`;
      else if (effort === 2) detail.textContent = `E ${signedRate(estimatedEnergy(2))}/s · V PELOTÓN · X +${(0.31 * nutritionFactor).toFixed(1)}`;
      else detail.textContent = `E ${signedRate(estimatedEnergy(4))}/s · V +4 · ${player.highEffortTime > 10 ? "FATIGA ↑" : "X 0"}`;
      button.title = `${button.querySelector("b").textContent}: ${detail.textContent}`;
    });
    const attackWindow = race.attackWindowFor(player);
    const attackDetail = this.elements.attackButton.querySelector("small");
    this.elements.attackButton.disabled = player.explosive < 20 || player.attacking > 0 || player.attackCooldown > 0;
    this.elements.attackButton.classList.toggle("active", player.attacking > 0);
    this.elements.attackButton.classList.toggle("perfect", ["PERFECTO", "RESPUESTA"].includes(attackWindow.quality) && player.attackCooldown <= 0);
    attackDetail.textContent = player.attackCooldown > 0
      ? `${Math.ceil(player.attackCooldown)} s de espera`
      : `${attackWindow.quality} · −14 explosividad`;
    this.elements.attackButton.title = `Ataque: ${attackDetail.textContent}`;
    const activeAttack = race.activeRivalAttackForPlayer();
    const sprintWindow = activeAttack
      ? { quality: "RESPUESTA", multiplier: 1.08, distance: activeAttack.distance - player.distance }
      : race.sprintWindowFor(player);
    const sprintReady = player.sprintAllowed && player.explosive > 4 && !player.sprinting;
    this.elements.sprintButton.disabled = !sprintReady;
    this.elements.sprintButton.classList.toggle("ready", sprintReady);
    this.elements.sprintButton.classList.toggle("perfect", sprintReady && sprintWindow.quality === "PERFECTO");
    this.elements.sprintButton.querySelector("small").textContent = player.sprinting
      ? player.responseSprintTimer > 0 ? "Respondiendo al ataque" : "Sprint en curso"
      : sprintReady
        ? activeAttack
          ? "RESPUESTA · IGUALA VELOCIDAD"
          : `${sprintWindow.quality} · ${Math.max(0, Math.round(sprintWindow.distance * 1000))} m`
        : "Meta o sprint próximo";
    this.elements.sprintButton.title = `Sprint: ${this.elements.sprintButton.querySelector("small").textContent}`;
    document.querySelectorAll("[data-risk]").forEach((button) => {
      const selectedRisk = player.riskTransition > 0 ? player.pendingRiskMode : player.riskMode;
      button.classList.toggle("active", button.dataset.risk === selectedRisk);
    });
    this.elements.gelButton.disabled = player.gels <= 0 || player.gelTimer > 0;
    this.elements.gelButtonDetail.textContent = player.gelTimer > 0 ? "Abriendo gel…" : `${player.gels} disponibles`;
    this.elements.gelButton.title = `Gel: ${this.elements.gelButtonDetail.textContent}`;
    const relay = race.relay;
    const relayAvailable = relay.active ? relay.participants.length - 1 : race.relayCandidates().length;
    const relayLeaderIsRival = relay.active && relay.leader !== player && relay.leader.team !== player.team;
    this.elements.relayButton.disabled = !relay.active &&
      (relayAvailable <= 0 || player.crashTimer > 0 || player.attacking > 0 || player.sprinting);
    this.elements.relayButton.classList.toggle("active", relay.active);
    this.elements.relayButton.classList.toggle("rival-turn", relayLeaderIsRival);
    this.elements.relayButton.setAttribute("aria-pressed", String(relay.active));
    this.elements.relayButtonDetail.textContent = activeAttack
      ? "NO FRENA ATAQUE"
      : relay.active
        ? relay.leader === player
        ? `TU TURNO · ${relayAvailable}`
        : `${relay.leader.team === player.team ? "EQUIPO" : "RIVAL"} · ${relay.leader.name.split(" ").at(-1)}`
      : race.timeTrial ? "NO EN CRONO" : relayAvailable > 0 ? `${relayAvailable} cerca` : "Sin ciclistas cerca";
    this.elements.relayButton.title = `Relevos: ${this.elements.relayButtonDetail.textContent}`;
    const popupNow = performance.now();
    if (remaining <= 1 && !this.lastKmPopupShown) {
      this.lastKmPopupShown = true;
      this.lastKmPopupUntil = popupNow + POPUP_MAX_MS;
    } else if (remaining > 1) {
      this.lastKmPopupShown = false;
      this.lastKmPopupUntil = 0;
    }
    const showLastKmPopup = remaining <= 1 && popupNow < this.lastKmPopupUntil;
    this.elements.lastKmOverlay.classList.toggle("active", showLastKmPopup);
    this.elements.lastKmOverlay.setAttribute("aria-hidden", String(!showLastKmPopup));
    this.elements.finishMeters.textContent = `${Math.ceil(remaining * 1000)} m`;
    this.elements.vignette.classList.toggle("heavy", race.weather.state === "heavy");
    this.elements.directorTip.textContent = this.getDirectorTip(player, gradient, remaining);
    this.updateRacePoint(race, player);
    this.updateFollowedRider(race);
    this.resolvePopupPriority();
    this.updateGroups(race);
    this.updateMobilePanels(race);
    const selectedGroup = this.game.cameraInspection?.type === "group" ? this.game.cameraInspection.groupIndex : -1;
    this.profileHitAreas = race.road.renderProfile(
      this.profileCtx,
      this.elements.profileCanvas.logicalWidth || this.elements.profileCanvas.width,
      this.elements.profileCanvas.logicalHeight || this.elements.profileCanvas.height,
      player.distance / race.road.lengthKm,
      race.groups,
      selectedGroup
    );
  }

  formatGap(seconds) {
    return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
  }

  updateGroups(race) {
    this.elements.groupsCount.textContent = race.groups.length;
    this.elements.mobileGroupsCount.textContent = race.groups.length;
    this.elements.groupsPanel.classList.toggle("multiple", race.groups.length > 1);
    this.elements.groupsPanel.classList.toggle("context-quiet", race.groups.length <= 1);
    const visibleGroups = race.groups.slice(0, 7);
    this.syncGroupList(this.elements.groupsList, visibleGroups, race);
    this.syncGroupList(this.elements.mobileGroupsList, visibleGroups, race);
  }

  syncGroupList(container, groups, race) {
    const existingRows = [...container.querySelectorAll(".race-group")];
    groups.forEach((group, index) => {
      const gap = index === 0 ? "0:00" : `+${this.formatGap(group.gapPreviousSeconds)}`;
      const playerClass = group.riders.includes(race.player) ? " player-group" : "";
      const leader = group.leader;
      const selected = this.game.cameraInspection?.type === "group" && this.game.cameraInspection.groupIndex === index ? " selected" : "";
      const teams = group.teams.slice(0, 3).join(", ") + (group.teams.length > 3 ? ` +${group.teams.length - 3}` : "");
      let row = existingRows[index];
      if (!row) {
        row = document.createElement("button");
        row.type = "button";
        row.innerHTML = "<i></i><span><b></b><small></small></span><strong></strong>";
        container.appendChild(row);
      }
      row.className = `race-group${playerClass}${selected}`;
      row.dataset.groupIndex = String(index);
      row.querySelector("i").style.background = leader.color;
      const identity = row.querySelector("span");
      identity.querySelector("b").textContent =
        `${group.label} · ${leader.flag || ""} ${leader.name} · ${group.riders.length}`;
      identity.querySelector("small").textContent = `${teams} · ${group.tendency}`;
      row.querySelector("strong").textContent = gap;
    });
    existingRows.slice(groups.length).forEach((row) => row.remove());

    let more = container.querySelector(".groups-more");
    const hiddenGroupCount = Math.max(0, race.groups.length - groups.length);
    if (hiddenGroupCount > 0) {
      if (!more) {
        more = document.createElement("div");
        more.className = "groups-more";
        container.appendChild(more);
      }
      more.textContent = `+${hiddenGroupCount} grupos`;
    } else {
      more?.remove();
    }
  }

  updateMobilePanels(race, force = false) {
    if (window.innerWidth > 900 || this.mobileView === "race") return;
    if (!force && performance.now() - this.lastMobilePanelUpdate < 400) return;
    this.lastMobilePanelUpdate = performance.now();
    const playerPosition = race.positionOf(race.player);
    this.elements.mobileRacePosition.textContent = `TÚ · ${ordinal(playerPosition)}`;
    if (this.mobileView === "classification") {
      const list = document.createDocumentFragment();
      race.ranking.forEach((rider, index) => {
        const key = String(rider.tourId ?? race.cyclists.indexOf(rider));
        let item = this.mobileRankingRows.get(key);
        if (!item) {
          item = document.createElement("li");
          item.tabIndex = 0;
          item.setAttribute("role", "button");
          item.innerHTML = "<b></b><span><i></i><em></em></span><strong></strong>";
          this.mobileRankingRows.set(key, item);
        }
        item.dataset.rankingIndex = String(index);
        item.classList.toggle("player", rider === race.player);
        item.setAttribute("aria-label", rider === race.player
          ? `${ordinal(index + 1)} ${rider.name}, tu corredor`
          : `${ordinal(index + 1)} ${rider.name}, tocar para seguir su rueda`);
        item.querySelector("b").textContent = ordinal(index + 1);
        item.querySelector("i").style.background = rider.color;
        item.querySelector("em").textContent = `${rider.flag || ""} ${rider.name}`;
        const group = race.groups.find((entry) => entry.riders.includes(rider));
        const gapSeconds = group?.index
          ? group.gapKm / Math.max(10, race.ranking[0].speed) * 3600
          : 0;
        item.querySelector("strong").textContent = index === 0 ? "0:00" : `+${this.formatGap(gapSeconds)}`;
        list.appendChild(item);
      });
      this.elements.mobileClassificationList.replaceChildren(list);
    }

    if (this.mobileView !== "stage") return;
    const progress = clamp(race.player.distance / race.road.lengthKm, 0, 1);
    this.elements.mobileStageProgressText.textContent = `${Math.round(progress * 100)}%`;
    this.elements.mobileStageProgressBar.style.width = `${progress * 100}%`;
    this.elements.mobileStageName.textContent = race.road.stageName;
    this.elements.mobileStageDistance.textContent = `${Math.round(race.road.lengthKm)} km`;
    this.elements.mobileStageAscent.textContent = `+${Math.round(race.road.totalAscent).toLocaleString("es-ES")} m`;
    const mountainCounts = new Map();
    race.road.mountains.forEach((point) => mountainCounts.set(point.category, (mountainCounts.get(point.category) || 0) + 1));
    const mainMountainCounts = ["Especial", "1ª", "2ª"]
      .filter((category) => mountainCounts.has(category))
      .map((category) => `${category === "Especial" ? "E" : category}:${mountainCounts.get(category)}`)
      .join(" · ");
    this.elements.mobileStageMountains.textContent = mainMountainCounts || race.road.mountains.length;
    this.elements.mobileStageSprints.textContent = `${race.road.intermediateSprints.length} · 10 pt`;
    this.elements.mobileStageBiome.textContent = race.road.biomeAt(race.player.distance).name;
    this.elements.mobileStageWeather.textContent = `${race.weather.icon} ${race.weather.label}`;
    this.elements.mobileStageElapsed.textContent = formatTime(race.elapsed * race.simulationScale);
    this.elements.mobileStageGroups.textContent = race.groups.length;
  }

  resolvePopupPriority() {
    const dangerVisible = this.elements.dangerBanner.classList.contains("visible");
    const lastKmVisible = this.elements.lastKmOverlay.classList.contains("active");
    const followVisible = !this.elements.followCard.classList.contains("is-hidden");
    if (dangerVisible || lastKmVisible) {
      this.elements.racePointCard.classList.add("is-hidden");
      this.elements.followCard.classList.add("is-hidden");
      return;
    }
    if (followVisible) this.elements.racePointCard.classList.add("is-hidden");
  }

  updateRacePoint(race, player) {
    const point = race.road.racePoints.find((item) => item.km > player.distance && !item.completed);
    const now = performance.now();
    const target = point || {
      type: "finish",
      km: race.road.lengthKm,
      name: race.road.stageName,
      pointsTable: []
    };
    const distance = Math.max(0, target.km - player.distance);
    const revealDistance = target.type === "mountain" ? 10 : target.type === "sprint" ? 5 : 10;
    if (distance >= revealDistance) {
      this.elements.racePointCard.classList.add("is-hidden");
      return;
    }
    const popupKey = `${target.type}:${target.km.toFixed(3)}`;
    if (popupKey !== this.racePointPopupKey) {
      this.racePointPopupKey = popupKey;
      this.racePointPopupUntil = now + POPUP_MAX_MS;
    }
    const visible = now < this.racePointPopupUntil;
    this.elements.racePointCard.classList.toggle("is-hidden", !visible);
    if (!visible) return;
    if (!point) {
      this.elements.racePointType.textContent = "META";
      this.elements.racePointName.textContent = race.road.stageName;
      this.elements.racePointDistance.textContent = `${formatNumber(distance)} km`;
      return;
    }
    this.elements.racePointType.textContent = point.type === "mountain"
      ? `▲ ${point.category === "Especial" ? "ESP" : point.category}`
      : "◆ SPRINT";
    this.elements.racePointName.textContent = point.name;
    this.elements.racePointDistance.textContent = `${formatNumber(distance)} km · ${point.pointsTable.join("–")} pt`;
    this.elements.racePointCard.style.borderColor = racePointColor(point);
  }

  updateFollowedRider(race) {
    // Los relevos usan wheelTarget internamente para ordenar la fila. Esa
    // referencia no debe abrir/cerrar la ficha de la rueda elegida por el
    // jugador en cada cambio de turno.
    const relayWheel = race.player.relayWheelTarget &&
      race.player.wheelTarget === race.player.relayWheelTarget;
    const wheelTarget = relayWheel ? null : race.player.wheelTarget;
    const inspectedRider = this.game.cameraInspection?.type === "rider" ? this.game.cameraInspection.rider : null;
    const rider = wheelTarget || inspectedRider;
    const mode = wheelTarget ? "wheel" : inspectedRider ? "follow" : "";
    if (!rider) {
      if (this.followCardRider) this.elements.followCard.classList.add("is-hidden");
      this.elements.followCard.classList.remove("wheel-compact");
      this.elements.followRiderJersey.hidden = true;
      delete this.elements.followRiderJersey.dataset.jersey;
      this.followCardRider = null;
      this.followCardMode = "";
      this.followCardUntil = 0;
      return;
    }
    const targetChanged = rider !== this.followCardRider || mode !== this.followCardMode;
    const now = performance.now();
    const riderJersey = rider.jerseyType ? TOUR_JERSEYS[rider.jerseyType] : null;
    if (targetChanged) {
      this.followCardRider = rider;
      this.followCardMode = mode;
      this.followCardUntil = wheelTarget && !riderJersey
        ? now + WHEEL_INDICATOR_MS
        : now + POPUP_MAX_MS;
      this.elements.followModeLabel.textContent = wheelTarget ? "RUEDA" : "⌖ SIGUIENDO";
      this.elements.followRiderName.textContent = `${rider.flag || ""} ${rider.name}`;
      this.elements.followRiderInfo.textContent = "";
      this.elements.followRiderJersey.hidden = !riderJersey;
      if (riderJersey) {
        this.elements.followRiderJersey.dataset.jersey = rider.jerseyType;
        this.elements.followRiderJersey.textContent = `${riderJersey.icon} MAILLOT ${riderJersey.label}`;
      } else {
        delete this.elements.followRiderJersey.dataset.jersey;
        this.elements.followRiderJersey.textContent = "";
      }
      this.elements.followCard.style.borderLeftColor = rider.jerseyColor || rider.color;
      this.elements.followCard.setAttribute(
        "aria-label",
        wheelTarget ? `Cancelar rueda de ${rider.name}` : `Volver a tu ciclista desde ${rider.name}`
      );
    }
    const wheelCompact = Boolean(wheelTarget && !riderJersey);
    this.elements.followCard.classList.toggle("wheel-compact", wheelCompact);
    const visible = now < this.followCardUntil;
    this.elements.followCard.classList.toggle("is-hidden", !visible);
    if (!visible) return;
    if (!targetChanged && now - this.lastFollowCardUpdate < 750) {
      return;
    }
    this.lastFollowCardUpdate = now;
    const position = race.positionOf(rider);
    const groupIndex = race.groups.findIndex((group) => group.riders.includes(rider));
    const groupName = groupIndex >= 0 ? race.groups[groupIndex].label : rider.finished ? "FINALIZADO" : "DESCOLGADO";
    const team = race.teamByName.get(rider.team);
    this.elements.followRiderInfo.textContent =
      `${rider.roleLabel} · ${TACTICAL_LABELS[rider.tacticalState] || rider.tacticalState} · ${rider.team} · ${position}.º · ${groupName} · ${team?.objectiveLabel || "ETAPA"}`;
  }

  getDirectorTip(player, gradient, remaining) {
    if (this.game.race?.relay.active) {
      const leader = this.game.race.relay.leader;
      return leader === player
        ? "Tu turno de relevo: mantén Alto hasta que otro ciclista pase al frente."
        : leader.team === player.team
          ? "Tu compañero está tirando y no atacará mientras participe en los relevos."
          : "El rival está colaborando, pero puede romper el relevo con un ataque.";
    }
    if (remaining <= 1) return "Elige bien el momento: un sprint demasiado largo vaciará tu explosividad.";
    if (this.game.race?.weather.intensity > 0.25 && player.riskMode === "aggressive") {
      return "Asfalto mojado: la conducción agresiva aumenta mucho el riesgo de caída.";
    }
    if (gradient <= RECOVERY_DESCENT_GRADIENT && player.riskMode === "aggressive" &&
      derivedSpecialty(player) !== "SPRINTER") {
      return "Bajada agresiva: si no eres sprinter puedes caerte. Reduce a conducción normal o segura.";
    }
    if (this.game.race?.isolationExposureFor(player) > 0.55) {
      return player.effort >= 4 && gradient > RECOVERY_DESCENT_GRADIENT
        ? "Ritmo Alto en solitario: gastas más energía. Busca compañía o relevos."
        : "Vas aislado: usar Alto fuera de un descenso añadirá consumo energético.";
    }
    if (player.avoiding) return "Tráfico delante: el ciclista está buscando hueco o igualando la velocidad.";
    if (player.nutrition < 35 && player.gels > 0) return "La nutrición está baja. Toma un gel antes del puerto.";
    if (player.draft < 12 && player.energy < 70) return "Busca una rueda cercana para reducir el gasto energético.";
    if (gradient > 5) return "Puerto duro: vigila la energía y reserva explosividad para responder.";
    if (player.grip < 55) return "Poca adherencia. La conducción segura reduce mucho el riesgo de caída.";
    return "Mantente a rueda durante el llano y guarda fuerzas para el puerto.";
  }
}

class Game {
  constructor() {
    this.canvas = document.getElementById("gameCanvas");
    this.ctx = this.canvas.getContext("2d");
    this.state = "MENU";
    this.race = null;
    this.tour = null;
    this.gameMode = "tour";
    this.menuGameMode = "tour";
    this.activeSaveSlot = null;
    this.pendingSaveSlot = null;
    this.selectedTeamId = "solaris";
    this.directoryTeamId = "solaris";
    this.directoryRosterCache = null;
    this.simulationCheckpoint = null;
    this.lastTimestamp = 0;
    this.raceSpeed = 1;
    this.cameraFocusKm = 0;
    this.cameraInspection = null;
    const storedCamera = safeStorageGet("ultimoPuerto.camera", "top");
    this.cameraMode = ["top", "side"].includes(storedCamera) ? storedCamera : "top";
    this.riderHitAreas = [];
    this.cameraZoom = 1;
    this.cameraShake = 0;
    this.spriteCache = new Map();
    this.particles = new ParticleSystem(window.innerWidth <= 900 ? 88 : 180);
    this.audio = new AudioManager();
    this.hudAccumulator = 0;
    this.performanceStats = {
      fps: 0, updateMs: 0, renderMs: 0, frameMs: 0,
      frames: 0, sampleStarted: performance.now(), updateTotal: 0, renderTotal: 0, frameTotal: 0
    };
    window.ultimoPuertoPerformance = this.performanceStats;
    this.hud = new HUD(this);
    this.teamOrderPopupTimer = null;
    this.storage = this.loadStorage();
    this.reducedMotion = Boolean(this.storage.reducedMotion);
    this.hapticsEnabled = Boolean(this.storage.haptics);
    this.tutorialStep = 0;
    this.lastHapticAt = -1000;
    this.applyAccessibilityPreferences();
    this.bindControls();
    this.resize();
    this.updateRecords();
    this.renderSaveSlots();
    this.setMenuGameMode("tour");
    this.updateCameraButton();
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  loadStorage() {
    const stored = safeJsonParse(safeStorageGet("ultimoPuerto.stats"), null);
    const source = stored && typeof stored === "object" && !Array.isArray(stored) ? stored : {};
    const storedDifficulty = safeStorageGet("ultimoPuerto.difficulty");
    const storedWeather = safeStorageGet("ultimoPuerto.weather");
    const difficulty = ["easy", "normal", "hard"].includes(source.difficulty)
      ? source.difficulty : ["easy", "normal", "hard"].includes(storedDifficulty) ? storedDifficulty : "normal";
    const weather = ["dynamic", "dry", "rain"].includes(source.weather)
      ? source.weather : ["dynamic", "dry", "rain"].includes(storedWeather) ? storedWeather : "dynamic";
    const systemReducedMotion = Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
    return {
      bestPosition: Number.isFinite(source.bestPosition) && source.bestPosition > 0 ? source.bestPosition : null,
      bestTime: Number.isFinite(source.bestTime) && source.bestTime > 0 ? source.bestTime : null,
      races: Number.isFinite(source.races) && source.races >= 0 ? Math.floor(source.races) : 0,
      wins: Number.isFinite(source.wins) && source.wins >= 0 ? Math.floor(source.wins) : 0,
      difficulty,
      weather,
      reducedMotion: typeof source.reducedMotion === "boolean" ? source.reducedMotion : systemReducedMotion,
      haptics: typeof source.haptics === "boolean" ? source.haptics : false,
      tutorialSeen: source.tutorialSeen === true
    };
  }

  saveStorage() {
    this.storage.difficulty = document.getElementById("difficultySelect").value;
    this.storage.weather = document.getElementById("weatherSelect").value;
    this.storage.reducedMotion = Boolean(this.reducedMotion);
    this.storage.haptics = Boolean(this.hapticsEnabled);
    const statsSaved = safeStorageSet("ultimoPuerto.stats", JSON.stringify(this.storage));
    const difficultySaved = safeStorageSet("ultimoPuerto.difficulty", this.storage.difficulty);
    const weatherSaved = safeStorageSet("ultimoPuerto.weather", this.storage.weather);
    safeStorageRemove("ciclimoTour.playerProfile");
    return statsSaved && difficultySaved && weatherSaved;
  }

  updateRecords() {
    document.getElementById("bestPosition").textContent = this.storage.bestPosition ? ordinal(this.storage.bestPosition) : "—";
    document.getElementById("raceCount").textContent = this.storage.races;
    document.getElementById("winCount").textContent = this.storage.wins;
    document.getElementById("difficultySelect").value = this.storage.difficulty || "normal";
    document.getElementById("weatherSelect").value = this.storage.weather || "dynamic";
    this.syncAccessibilityButtons();
  }

  bindControls() {
    window.addEventListener("resize", () => this.resize());
    window.addEventListener("orientationchange", () => window.setTimeout(() => this.resize(), 120));
    if (window.visualViewport) window.visualViewport.addEventListener("resize", () => this.resize());
    document.getElementById("tourModeButton").addEventListener("click", () => this.setMenuGameMode("tour"));
    document.getElementById("quickModeButton").addEventListener("click", () => this.setMenuGameMode("quick"));
    document.getElementById("quickRaceButton").addEventListener("click", () => this.startQuickRace());
    document.getElementById("teamsDirectoryButton").addEventListener("click", () => this.openTeamsDirectory());
    document.querySelectorAll("[data-slot-action]").forEach((button) => {
      button.addEventListener("click", () => this.openSaveSlot(Number(button.dataset.slotAction)));
    });
    document.querySelectorAll("[data-slot-delete]").forEach((button) => {
      button.addEventListener("click", () => this.deleteSaveSlot(Number(button.dataset.slotDelete)));
    });
    ["difficultySelect", "weatherSelect"].forEach((id) => {
      document.getElementById(id).addEventListener("change", () => {
        this.storage.difficulty = document.getElementById("difficultySelect").value;
        this.storage.weather = document.getElementById("weatherSelect").value;
        this.saveStorage();
      });
    });
    document.getElementById("dashboardBackButton").addEventListener("click", () => this.showMenu());
    document.getElementById("dashboardTeamButton").addEventListener("click", () => {
      this.setDashboardSection("team");
      document.getElementById("teamManagementCard").scrollIntoView({ behavior: this.reducedMotion ? "auto" : "smooth", block: "start" });
    });
    document.querySelectorAll("[data-dashboard-section]").forEach((button) => {
      button.addEventListener("click", () => this.setDashboardSection(button.dataset.dashboardSection));
    });
    document.querySelectorAll("[data-result-view]").forEach((button) => {
      button.addEventListener("click", () => this.setResultView(button.dataset.resultView));
    });
    document.querySelectorAll("[data-jump-classification]").forEach((button) => {
      button.addEventListener("click", () => {
        document.getElementById(button.dataset.jumpClassification)?.querySelector(".player")
          ?.scrollIntoView({ block: "center", behavior: this.reducedMotion ? "auto" : "smooth" });
      });
    });
    document.getElementById("openAllTeamsButton").addEventListener("click", () => this.openTeamsDirectory(this.tour?.playerTeamId));
    document.getElementById("closeTeamsDirectoryButton").addEventListener("click", () => this.closeTeamsDirectory());
    document.getElementById("closeTeamSelectionButton").addEventListener("click", () => this.closeTeamSelection());
    document.getElementById("confirmTeamSelectionButton").addEventListener("click", () => this.confirmTeamSelection());
    document.getElementById("playStageButton").addEventListener("click", () => this.start());
    document.getElementById("simulateStageButton").addEventListener("click", () => this.simulateCurrentStage());
    document.getElementById("dashboardNewTourButton").addEventListener("click", () => this.startNewTourFromDashboard());
    document.getElementById("dashboardCalendar").addEventListener("click", (event) => {
      const stageItem = event.target.closest("[data-stage-result]");
      if (stageItem) this.renderStageHistory(Number(stageItem.dataset.stageResult));
    });
    document.getElementById("dashboardCalendar").addEventListener("keydown", (event) => {
      const stageItem = event.target.closest("[data-stage-result]");
      if (stageItem && ["Enter", " "].includes(event.key)) {
        event.preventDefault();
        this.renderStageHistory(Number(stageItem.dataset.stageResult));
      }
    });
    document.getElementById("closeStageHistoryButton").addEventListener("click", () => {
      document.getElementById("dashboardStageHistory").classList.add("is-hidden");
    });
    document.getElementById("teamOrderButton").addEventListener("click", () => this.toggleTeamOrders());
    document.getElementById("closeTeamOrderButton").addEventListener("click", () => this.closeTeamOrders());
    document.querySelectorAll("[data-team-order]").forEach((button) => {
      button.addEventListener("click", () => this.setTeamOrder(button.dataset.teamOrder));
    });
    document.getElementById("reducedMotionToggle").addEventListener("click", () => {
      this.reducedMotion = !this.reducedMotion;
      this.applyAccessibilityPreferences();
      this.saveStorage();
    });
    document.getElementById("hapticsToggle").addEventListener("click", () => {
      this.hapticsEnabled = !this.hapticsEnabled;
      this.syncAccessibilityButtons();
      this.saveStorage();
      if (this.hapticsEnabled) this.haptic(25);
    });
    document.getElementById("tutorialResetButton").addEventListener("click", () => {
      this.storage.tutorialSeen = false;
      this.saveStorage();
      const button = document.getElementById("tutorialResetButton");
      button.textContent = "✓ AL JUGAR";
      window.setTimeout(() => { button.textContent = "? TUTORIAL"; }, 1600);
    });
    document.getElementById("nextTutorialButton").addEventListener("click", () => this.nextTutorialStep());
    document.getElementById("skipTutorialButton").addEventListener("click", () => this.completeTutorial());
    document.getElementById("pauseButton").addEventListener("click", () => this.pause());
    document.getElementById("raceSpeedButton").addEventListener("click", () => {
      this.setRaceSpeed(this.raceSpeed === 1 ? 5 : 1);
    });
    document.getElementById("resumeButton").addEventListener("click", () => this.resume());
    document.getElementById("quitButton").addEventListener("click", () => this.showMenu());
    document.getElementById("replayButton").addEventListener("click", () => this.continueTour());
    document.getElementById("undoSimulationButton").addEventListener("click", () => this.undoSimulation());
    document.getElementById("newRaceButton").addEventListener("click", () => this.showMenu());
    document.getElementById("returnCameraButton").addEventListener("click", () => this.returnCameraToPlayer(true));
    document.getElementById("followCard").addEventListener("click", () => {
      if (this.race?.player.wheelTarget && !this.race.player.relayWheelTarget) this.cancelWheelTarget();
      else if (this.cameraInspection) this.returnCameraToPlayer();
    });
    document.querySelectorAll("[data-camera-mode]").forEach((button) => {
      button.addEventListener("click", () => this.setCameraMode(button.dataset.cameraMode));
    });
    const volumeRange = document.getElementById("volumeRange");
    const soundToggle = document.getElementById("soundToggle");
    volumeRange.value = String(Math.round(this.audio.volume * 100));
    const syncSoundButton = () => {
      soundToggle.setAttribute("aria-pressed", String(this.audio.enabled));
      soundToggle.textContent = this.audio.enabled ? "SONIDO · ON" : "SONIDO · OFF";
    };
    syncSoundButton();
    volumeRange.addEventListener("input", () => {
      this.audio.setVolume(Number(volumeRange.value) / 100);
      if (this.audio.enabled) {
        this.audio.unlock();
        this.audio.play("power");
      }
    });
    soundToggle.addEventListener("click", () => {
      this.audio.toggle();
      syncSoundButton();
      if (this.audio.enabled) this.audio.play("power");
    });
    this.canvas.addEventListener("pointermove", (event) => {
      this.canvas.style.cursor = this.riderAtPointer(event) ? "pointer" : "default";
    });
    this.canvas.addEventListener("pointerleave", () => { this.canvas.style.cursor = "default"; });
    this.canvas.addEventListener("contextmenu", (event) => event.preventDefault());
    this.canvas.addEventListener("click", (event) => {
      const rider = this.riderAtPointer(event);
      if (!rider) return;
      if (this.state === "RACING") this.selectWheel(rider);
      else if (this.state === "PAUSED") this.followRider(rider);
    });
    document.querySelectorAll("[data-effort]").forEach((button) => {
      button.addEventListener("click", () => this.setEffortPreset(Number(button.dataset.effort)));
    });
    document.getElementById("attackButton").addEventListener("click", () => {
      if (!this.canControl()) return;
      const attackWindow = this.race.attackWindowFor(this.race.player);
      if (this.race.player.attack(attackWindow.multiplier, attackWindow.quality)) {
        this.race.stopRelay("", false);
        this.cancelWheelTarget(false);
        this.showResourceFeedback([
          { icon: "!", text: `${attackWindow.quality} · + POTENCIA`, type: "power" },
          { icon: "✦", text: "−14 EXPLOSIVIDAD", type: "negative" }
        ]);
        this.haptic([30, 20, 45]);
        this.audio.play("attack");
        this.notify(`Ataque ${attackWindow.quality.toLowerCase()}. Ahora tienes 12 s de espera.`, "urgent");
      }
    });
    document.getElementById("sprintButton").addEventListener("click", () => {
      if (!this.canControl()) return;
      const attackThreat = this.race.activeRivalAttackForPlayer();
      const respondingToAttack = Boolean(attackThreat);
      const sprintWindow = respondingToAttack
        ? { quality: "RESPUESTA", multiplier: 1.08, distance: attackThreat.distance - this.race.player.distance }
        : this.race.sprintWindowFor(this.race.player);
      if (this.race.player.sprintNow(
        sprintWindow.multiplier,
        sprintWindow.quality,
        respondingToAttack ? 3.5 : Infinity
      )) {
        this.race.stopRelay("", false);
        this.cancelWheelTarget(false);
        this.showResourceFeedback([
          { icon: "»", text: `SPRINT ${sprintWindow.quality}`, type: "power" },
          { icon: "✦", text: "EXPLOSIVIDAD ↓", type: "negative" }
        ]);
        this.haptic(24);
        this.audio.play("sprint");
        this.notify(respondingToAttack
          ? `¡Respondes al ataque de ${attackThreat.name}! Iguala su velocidad antes de que termine el sprint.`
          : `Sprint ${sprintWindow.quality.toLowerCase()}: ${Math.max(0, Math.round(sprintWindow.distance * 1000))} m hasta la línea.`, "urgent");
      }
    });
    document.getElementById("gelButton").addEventListener("click", () => {
      if (this.canControl() && this.race.player.eatGel()) {
        this.showResourceFeedback([{ icon: "▰", text: "ABRIENDO GEL…", type: "power" }]);
        this.audio.play("gel");
        this.haptic(14);
        this.notify("Gel tomado. Efecto en unos segundos.");
      }
    });
    document.getElementById("relayButton").addEventListener("click", () => {
      if (!this.canControl()) return;
      if (this.race.relay.active) {
        this.race.stopRelay();
        this.audio.play("power");
        this.hud.update();
        return;
      }
      if (this.race.startRelay()) {
        const partners = this.race.relay.participants.slice(1);
        const teammates = partners.filter((rider) => rider.team === this.race.player.team).length;
        const rivals = partners.length - teammates;
        this.showResourceFeedback([
          { icon: "⇄", text: "RELEVOS ACTIVADOS", type: "positive" },
          { icon: "◎", text: `${teammates} EQUIPO · ${rivals} RIVALES`, type: "power" }
        ]);
        this.audio.play("power");
      } else if (this.race.relay.blockedByAttack) {
        const attacker = this.race.relay.blockedByAttack;
        this.notify(
          `¡${attacker.name} está atacando! RELEVO no lo frena: iguala su velocidad con ALTO o usa SPRINT.`,
          "urgent"
        );
      } else {
        this.notify("No hay ciclistas con fuerzas suficientes cerca para dar relevos.");
      }
      this.hud.update();
    });
    document.querySelectorAll("[data-risk]").forEach((button) => {
      button.addEventListener("click", () => {
        if (!this.canControl()) return;
        this.race.player.setRiskMode(button.dataset.risk);
        document.querySelectorAll("[data-risk]").forEach((item) => item.classList.toggle("active", item === button));
        const feedback = {
          safe: { icon: "◈", text: "CONDUCCIÓN SEGURA" },
          normal: { icon: "◆", text: "CONDUCCIÓN NORMAL" },
          aggressive: { icon: "✦", text: "CONDUCCIÓN AGRESIVA" }
        }[button.dataset.risk];
        this.showResourceFeedback([{ ...feedback, type: "power" }]);
        this.notify(`Trazada ${button.dataset.risk}: el cambio tarda un instante.`);
      });
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && this.state === "RACING") this.pause();
    });
  }

  canControl() { return this.state === "RACING" && this.race && !this.race.player.finished; }

  applyAccessibilityPreferences() {
    document.documentElement.classList.toggle("reduced-motion", this.reducedMotion);
    this.syncAccessibilityButtons();
  }

  syncAccessibilityButtons() {
    const motionButton = document.getElementById("reducedMotionToggle");
    const hapticsButton = document.getElementById("hapticsToggle");
    if (motionButton) {
      motionButton.setAttribute("aria-pressed", String(this.reducedMotion));
      motionButton.textContent = this.reducedMotion ? "MOVIMIENTO · REDUCIDO" : "MOVIMIENTO · ON";
    }
    if (hapticsButton) {
      const hapticsAvailable = typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
      if (!hapticsAvailable) this.hapticsEnabled = false;
      hapticsButton.disabled = !hapticsAvailable;
      hapticsButton.setAttribute("aria-pressed", String(this.hapticsEnabled));
      hapticsButton.textContent = !hapticsAvailable
        ? "VIBRACIÓN · NO DISP." : this.hapticsEnabled ? "VIBRACIÓN · ON" : "VIBRACIÓN · OFF";
    }
  }

  setDashboardSection(section) {
    const selected = ["stage", "calendar", "standings", "team"].includes(section) ? section : "stage";
    document.querySelectorAll?.("[data-dashboard-section]").forEach((button) => {
      const active = button.dataset.dashboardSection === selected;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    document.querySelectorAll?.("[data-dashboard-panel]").forEach((panel) => {
      const active = panel.dataset.dashboardPanel === selected;
      panel.classList.toggle("dashboard-section-active", active);
      panel.classList.toggle("dashboard-mobile-hidden", !active);
    });
  }

  setResultView(view) {
    const selected = ["stage", "tour", "stats"].includes(view) ? view : "stage";
    document.querySelectorAll?.("[data-result-view]").forEach((button) => {
      const active = button.dataset.resultView === selected;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    document.querySelectorAll?.("[data-result-panel]").forEach((panel) => {
      panel.classList.toggle("result-mobile-hidden", panel.dataset.resultPanel !== selected);
    });
  }

  haptic(pattern = 12) {
    if (!this.hapticsEnabled || typeof navigator === "undefined" || !navigator.vibrate) return;
    const now = performance.now();
    if (now - this.lastHapticAt < 180) return;
    this.lastHapticAt = now;
    navigator.vibrate(pattern);
  }

  toggleTeamOrders() {
    if (!this.canControl() || this.race.timeTrial) return;
    const panel = document.getElementById("teamOrderPanel");
    const willOpen = panel.classList.contains("is-hidden");
    panel.classList.toggle("is-hidden", !willOpen);
    document.getElementById("teamOrderButton").setAttribute("aria-expanded", String(willOpen));
    if (this.teamOrderPopupTimer) window.clearTimeout(this.teamOrderPopupTimer);
    this.teamOrderPopupTimer = willOpen
      ? window.setTimeout(() => this.closeTeamOrders(), POPUP_MAX_MS)
      : null;
  }

  closeTeamOrders() {
    if (this.teamOrderPopupTimer) {
      window.clearTimeout(this.teamOrderPopupTimer);
    }
    this.teamOrderPopupTimer = null;
    document.getElementById("teamOrderPanel").classList.add("is-hidden");
    document.getElementById("teamOrderButton").setAttribute("aria-expanded", "false");
  }

  setTeamOrder(order) {
    if (!this.canControl() || this.race.timeTrial || !TEAM_ORDERS[order]) return;
    const changed = this.race.playerTeamOrder !== order;
    this.race.playerTeamOrder = order;
    if (changed) this.race.playerTeamOrderChanges += 1;
    this.race.teamTacticTimer = 0;
    this.race.updateTeamTactics(true);
    document.querySelectorAll("[data-team-order]").forEach((button) => {
      button.classList.toggle("active", button.dataset.teamOrder === order);
    });
    document.getElementById("teamOrderCurrent").textContent = TEAM_ORDERS[order].label;
    this.closeTeamOrders();
    this.haptic(18);
    const teamName = this.race.player.team;
    this.notify(TEAM_ORDERS[order].message.replaceAll("Solaris", teamName));
  }

  openTutorial() {
    this.state = "TUTORIAL";
    this.tutorialStep = 0;
    this.renderTutorialStep();
    document.getElementById("tutorialOverlay").classList.remove("is-hidden");
  }

  renderTutorialStep() {
    const step = TUTORIAL_STEPS[this.tutorialStep];
    document.getElementById("tutorialProgress").textContent =
      `${this.tutorialStep + 1} / ${TUTORIAL_STEPS.length}`;
    document.getElementById("tutorialIcon").textContent = step.icon;
    document.getElementById("tutorialTitle").textContent = step.title;
    document.getElementById("tutorialText").textContent = step.text;
    document.getElementById("nextTutorialButton").textContent =
      this.tutorialStep === TUTORIAL_STEPS.length - 1 ? "EMPEZAR ▶" : "SIGUIENTE ▶";
  }

  nextTutorialStep() {
    if (this.tutorialStep >= TUTORIAL_STEPS.length - 1) {
      this.completeTutorial();
      return;
    }
    this.tutorialStep += 1;
    this.renderTutorialStep();
    this.haptic(8);
  }

  completeTutorial() {
    if (this.state !== "TUTORIAL") return;
    this.storage.tutorialSeen = true;
    this.saveStorage();
    document.getElementById("tutorialOverlay").classList.add("is-hidden");
    this.state = "COUNTDOWN";
    this.runCountdown();
  }

  setEffortPreset(effort) {
    if (!this.canControl()) return;
    const player = this.race.player;
    const nextEffort = [1, 2, 4].includes(effort) ? effort : 2;
    const attackThreat = this.race.activeRivalAttackForPlayer();
    if (this.race.relay.active) this.race.stopRelay("Relevos terminados: vuelves al control manual.");
    if (player.effort === nextEffort) return;
    player.effort = nextEffort;
    player.sprinting = false;
    player.sprintMultiplier = 1;
    player.responseSprintTimer = 0;
    player.attacking = 0;
    player.attackMultiplier = 1;
    const gradient = this.race.road.getGradient(player.distance);
    const descending = gradient <= RECOVERY_DESCENT_GRADIENT;
    const isolated = this.race.isolationExposureFor(player) > 0.05;
    if (player.effort === 1) {
      this.showResourceFeedback([
        { icon: "♥", text: "RITMO BAJO", type: "positive" },
        { icon: "✦", text: "+ EXPLOSIVIDAD", type: "positive" }
      ]);
    } else if (player.effort === 2) {
      this.showResourceFeedback([
        descending
          ? { icon: "♥", text: "RECUPERA EN DESCENSO", type: "positive" }
          : { icon: "♥", text: "ENERGÍA ↓ LENTO", type: "negative" },
        { icon: "◆", text: "RITMO MEDIO", type: "power" }
      ]);
    } else {
      this.showResourceFeedback([
        { icon: "⚡", text: "RITMO ALTO", type: "power" },
        attackThreat
          ? { icon: "⇧", text: "IGUALA EL ATAQUE", type: "power" }
          : descending
            ? { icon: "♥", text: "SIN GASTO EN DESCENSO", type: "positive" }
            : isolated
              ? { icon: "♥", text: "GASTO EXTRA · AISLADO", type: "negative" }
              : { icon: "♥", text: "CONSUME ENERGÍA", type: "negative" }
      ]);
      if (attackThreat) {
        this.notify(
          `Persigue a ${attackThreat.name}: debes alcanzar al menos su velocidad o responder con SPRINT.`,
          "urgent"
        );
      }
    }
    this.audio.play("power");
    this.haptic(8);
    this.hud.update();
  }

  saveSlotKey(slot) {
    return `ciclimoTour.save.${slot}`;
  }

  serializeTour() {
    if (!this.tour?.roster) return null;
    return {
      version: SAVE_VERSION,
      savedAt: new Date().toISOString(),
      tour: {
        seed: this.tour.seed,
        stageIndex: this.tour.stageIndex,
        stages: this.tour.stages,
        roster: this.tour.roster,
        totals: [...this.tour.totals.values()],
        conditions: [...(this.tour.conditions || new Map()).values()],
        stageResults: this.tour.stageResults || [],
        playerTeamId: this.tour.playerTeamId || "solaris",
        stageAssignments: this.tour.stageAssignments || {},
        jerseyAssignments: this.tour.jerseyAssignments || {},
        leaders: this.tour.leaders || {},
        completedStages: this.tour.completedStages || 0
      }
    };
  }

  readSaveSlot(slot) {
    if (!Number.isInteger(slot) || slot < 1 || slot > SAVE_SLOT_COUNT) return null;
    const save = safeJsonParse(safeStorageGet(this.saveSlotKey(slot)), null);
    if (![1, SAVE_VERSION].includes(save?.version) || !Number.isFinite(save.savedAt ? Date.parse(save.savedAt) : NaN) ||
      !Number.isInteger(save.tour?.seed) || save.tour?.stages?.length !== TOUR_STAGE_COUNT ||
      save.tour?.roster?.length !== 100 || save.tour?.totals?.length !== 100 ||
      !Number.isInteger(save.tour.completedStages) ||
      save.tour.completedStages < 0 || save.tour.completedStages > TOUR_STAGE_COUNT) return null;
    const validStages = save.tour.stages.every((stage, index) =>
      stage && stage.number === index + 1 && ["itt", "mountain", "road"].includes(stage.type) &&
      ["flat", "mixed", "mountain"].includes(stage.profile) &&
      Number.isFinite(stage.lengthKm) && stage.lengthKm > 0 && typeof stage.name === "string");
    const rosterIds = new Set();
    const validRoster = save.tour.roster.every((rider) => {
      if (!rider || !Number.isInteger(rider.tourId) || rider.tourId < 0 || rider.tourId >= 100 ||
        rosterIds.has(rider.tourId) || typeof rider.name !== "string" || typeof rider.team !== "string" ||
        !Number.isFinite(rider.age)) return false;
      rosterIds.add(rider.tourId);
      return true;
    });
    const totalIds = new Set();
    const validTotals = save.tour.totals.every((total) => {
      if (!total || !Number.isInteger(total.tourId) || totalIds.has(total.tourId) ||
        !["time", "points", "mountain", "stages"].every((field) =>
          Number.isFinite(total[field]) && total[field] >= 0)) return false;
      totalIds.add(total.tourId);
      return true;
    });
    const validConditions = save.tour.conditions === undefined ||
      (Array.isArray(save.tour.conditions) && save.tour.conditions.length === 100 &&
        save.tour.conditions.every((condition) => condition && Number.isInteger(condition.tourId) &&
          Number.isFinite(condition.fatigue) && Number.isFinite(condition.form)));
    const validStageResults = save.tour.stageResults === undefined ||
      (Array.isArray(save.tour.stageResults) && save.tour.stageResults.length <= TOUR_STAGE_COUNT &&
        save.tour.stageResults.every((result) => result && Number.isInteger(result.stageNumber) &&
          result.stageNumber >= 1 && result.stageNumber <= TOUR_STAGE_COUNT));
    const validProfile = save.tour.playerProfile === undefined || Boolean(PLAYER_PROFILES[save.tour.playerProfile]);
    const validTeam = save.tour.playerTeamId === undefined || TEAM_BY_ID.has(save.tour.playerTeamId);
    const validAssignments = save.tour.stageAssignments === undefined ||
      (save.tour.stageAssignments && typeof save.tour.stageAssignments === "object" &&
        Object.values(save.tour.stageAssignments).every((role) => STAGE_ROLES[role] && role !== "leader"));
    return validStages && validRoster && validTotals && validConditions && validStageResults && validProfile && validTeam && validAssignments &&
      rosterIds.size === 100 && totalIds.size === 100 ? save : null;
  }

  restoreTour(save, slot) {
    const source = save.tour;
    const playerProfile = DEFAULT_PLAYER_PROFILE;
    const roster = source.roster.map((rider) => {
      if (save.version !== 1 || rider.role !== "leader") return { ...rider };
      const team = TEAM_DEFINITIONS.find((candidate) => candidate.name === rider.team);
      return team ? { ...rider, ...team.leader, role: "leader", roleLabel: "LÍDER" } : { ...rider };
    });
    if (roster[0] && !PLAYER_PROFILES[source.playerProfile]) {
      const fallback = PLAYER_PROFILES.allrounder;
      roster[0] = {
        ...roster[0],
        climbing: Math.max(fallback.climbing, roster[0].climbing || 0),
        sprint: Math.max(fallback.sprint, roster[0].sprint || 0),
        endurance: Math.max(fallback.endurance, roster[0].endurance || 0),
        technique: Math.max(fallback.technique, roster[0].technique || 0),
        aggression: Math.max(fallback.aggression, roster[0].aggression || 0),
        intelligence: Math.max(fallback.intelligence, roster[0].intelligence || 0)
      };
    }
    const storedConditions = Array.isArray(source.conditions) ? source.conditions : [];
    const conditions = new Map(storedConditions.map((entry) => [entry.tourId, {
      tourId: entry.tourId,
      fatigue: clamp(Number(entry.fatigue) || 0, 0, 100),
      form: clamp(Number(entry.form) || 0, -8, 8)
    }]));
    roster.forEach((rider) => {
      if (!conditions.has(rider.tourId)) {
        conditions.set(rider.tourId, { tourId: rider.tourId, fatigue: 0, form: 0 });
      }
    });
    const playerTeamId = TEAM_BY_ID.has(source.playerTeamId) ? source.playerTeamId : "solaris";
    const restoredAssignments = {};
    const selectedTeam = TEAM_BY_ID.get(playerTeamId);
    roster.forEach((rider) => {
      if (rider.team !== selectedTeam.name || rider.role === "leader") return;
      restoredAssignments[rider.tourId] = fixedStageRoleFor(rider);
      rider.stageRole = restoredAssignments[rider.tourId];
    });
    this.activeSaveSlot = slot;
    this.gameMode = "tour";
    this.tour = {
      seed: source.seed >>> 0,
      stageIndex: clamp(source.completedStages, 0, TOUR_STAGE_COUNT - 1),
      stages: source.stages.map((stage, index) => index === TOUR_STAGE_COUNT - 1
        ? {
          number: TOUR_STAGE_COUNT,
          type: "road",
          profile: "flat",
          lengthKm: 100,
          name: "Gran Final de la Ciudad",
          label: "FINAL DEL TOUR · LLANA",
          finale: true
        }
        : stage),
      roster,
      totals: new Map(source.totals.map((entry) => [entry.tourId, { ...entry }])),
      conditions,
      stageResults: Array.isArray(source.stageResults) ? source.stageResults : [],
      playerProfile,
      playerTeamId,
      stageAssignments: restoredAssignments,
      jerseyAssignments: source.jerseyAssignments || {},
      leaders: source.leaders || {},
      completedStages: source.completedStages
    };
  }

  saveTour() {
    if (!this.activeSaveSlot) return false;
    const payload = this.serializeTour();
    if (!payload) return false;
    try {
      if (!safeStorageSet(this.saveSlotKey(this.activeSaveSlot), JSON.stringify(payload))) {
        throw new Error("storage unavailable");
      }
      this.renderSaveSlots();
      return true;
    } catch {
      this.notify("No se ha podido guardar la partida.", "urgent");
      return false;
    }
  }

  slotGeneralPosition(save) {
    const totals = [...save.tour.totals].sort((a, b) => a.time - b.time || b.points - a.points);
    const position = totals.findIndex((entry) => entry.tourId === 0);
    return position >= 0 ? position + 1 : null;
  }

  renderSaveSlots() {
    document.querySelectorAll("[data-save-slot]").forEach((element) => {
      const slot = Number(element.dataset.saveSlot);
      const save = this.readSaveSlot(slot);
      const status = element.querySelector("[data-slot-status]");
      const meta = element.querySelector("[data-slot-meta]");
      const action = element.querySelector("[data-slot-action]");
      const deleteButton = element.querySelector("[data-slot-delete]");
      element.classList.toggle("occupied", Boolean(save));
      element.classList.toggle("active", slot === this.activeSaveSlot);
      deleteButton.disabled = !save;
      if (!save) {
        status.textContent = "VACÍO";
        meta.textContent = "Nuevo calendario aleatorio";
        action.textContent = "NUEVO";
        return;
      }
      const completed = save.tour.completedStages;
      const general = this.slotGeneralPosition(save);
      const team = TEAM_BY_ID.get(save.tour.playerTeamId) || TEAM_DEFINITIONS[0];
      status.textContent = completed >= TOUR_STAGE_COUNT ? "TOUR COMPLETO" : `ETAPA ${completed + 1}/${TOUR_STAGE_COUNT}`;
      meta.textContent = completed
        ? `${completed} completadas · ${team.name} · General ${general ? ordinal(general) : "—"}`
        : `${team.name} · ${team.identity} · pelotón preparado`;
      action.textContent = completed >= TOUR_STAGE_COUNT ? "VER TOUR" : "CARGAR";
    });
  }

  currentStageSeed(stage = this.tour?.stages[this.tour?.stageIndex || 0]) {
    return stage ? (this.tour.seed + stage.number * 2654435761) >>> 0 : 0;
  }

  createCurrentRace(options = {}) {
    const stage = this.tour.stages[this.tour.stageIndex];
    const difficulty = stage.finale ? "easy" : document.getElementById("difficultySelect").value;
    const weather = document.getElementById("weatherSelect").value;
    const general = this.getTourRanking("time");
    const timeTrialOrder = stage.type === "itt" && general.length
      ? [...general].reverse().map((entry) => entry.tourId) : null;
    return new Race(this, difficulty, weather, {
      seed: this.currentStageSeed(stage),
      stageDefinition: stage,
      roster: this.tour.roster,
      timeTrialOrder,
      jerseyAssignments: this.tour.jerseyAssignments,
      playerProfile: this.tour.playerProfile,
      playerTeamId: this.tour.playerTeamId,
      stageAssignments: this.tour.stageAssignments,
      tourConditions: this.tour.conditions,
      simulationOnly: Boolean(options.simulationOnly)
    });
  }

  ensureTourRoster() {
    if (this.tour?.roster) return;
    const preparationRace = this.createCurrentRace({ simulationOnly: true });
    this.tour.roster = this.captureRoster(preparationRace);
    const selectedTeam = TEAM_BY_ID.get(this.tour.playerTeamId) || TEAM_DEFINITIONS[0];
    if (!this.tour.stageAssignments) this.tour.stageAssignments = {};
    this.tour.roster.forEach((rider) => {
      if (rider.team === selectedTeam.name && rider.role !== "leader") {
        this.tour.stageAssignments[rider.tourId] = fixedStageRoleFor(rider);
        rider.stageRole = this.tour.stageAssignments[rider.tourId];
      }
      this.tour.totals.set(rider.tourId, {
        tourId: rider.tourId, time: 0, points: 0, mountain: 0, stages: 0
      });
      const conditionRandom = new SeededRandom((this.tour.seed + rider.tourId * 7919) >>> 0);
      this.tour.conditions.set(rider.tourId, {
        tourId: rider.tourId,
        fatigue: 0,
        form: (conditionRandom.next() + conditionRandom.next() - 1) * 2.5
      });
    });
    this.saveTour();
  }

  stageRoadPreview(stage) {
    const road = new Road(new SeededRandom(this.currentStageSeed(stage)), stage.lengthKm, stage);
    if (stage.type === "itt") {
      road.mountains = [];
      road.intermediateSprints = [];
      road.racePoints = [];
    }
    return road;
  }

  renderDashboardList(elementId, entries, type) {
    const list = document.getElementById(elementId);
    list.replaceChildren();
    if (!this.tour.completedStages || !entries.length) {
      const empty = document.createElement("li");
      empty.className = "empty";
      empty.textContent = "SIN CLASIFICAR";
      list.appendChild(empty);
      return;
    }
    const visibleEntries = elementId === "dashboardGcList" ? entries : entries.slice(0, 5);
    visibleEntries.forEach((entry, index) => {
      const item = document.createElement("li");
      if (entry.tourId === 0) item.classList.add("player");
      const name = document.createElement("span");
      name.textContent = `${entry.rider.flag || ""} ${entry.rider.name}`;
      const value = document.createElement("strong");
      if (type === "time" || type === "young") {
        value.textContent = index === 0 ? formatTime(entry.time) : `+${formatTime(entry.time - entries[0].time)}`;
      } else {
        value.textContent = `${entry[type]} pt`;
      }
      item.append(name, value);
      list.appendChild(item);
    });
  }

  renderStageHistory(stageNumber) {
    const result = this.tour?.stageResults?.find((entry) => entry.stageNumber === stageNumber);
    const panel = document.getElementById("dashboardStageHistory");
    if (!result) {
      panel.classList.add("is-hidden");
      return;
    }
    document.getElementById("historyStageLabel").textContent =
      `ETAPA ${result.stageNumber} · ${result.resolutionMode === "simulated" ? "SIMULADA" : "JUGADA"}`;
    document.getElementById("historyStageName").textContent = result.stageName;
    const podium = document.getElementById("historyStagePodium");
    podium.replaceChildren();
    result.podium.forEach((rider, index) => {
      const row = document.createElement("div");
      const place = document.createElement("b");
      place.textContent = `${index + 1}.`;
      const name = document.createElement("span");
      name.textContent = `${rider.flag || ""} ${rider.name}`;
      const time = document.createElement("strong");
      time.textContent = index === 0 ? formatTime(rider.time) : `+${formatTime(rider.gap)}`;
      row.append(place, name, time);
      podium.appendChild(row);
    });
    document.getElementById("historyStagePlayer").textContent =
      `TÚ · ${ordinal(result.player.position)} · ${formatTime(result.player.time)}` +
      (result.player.gap > 0 ? ` · +${formatTime(result.player.gap)}` : "");
    document.getElementById("historyStageBreakaway").textContent = result.breakaway?.formed
      ? result.breakaway.won
        ? `Fuga ganadora · ${result.breakaway.riders} corredores`
        : `Fuga neutralizada · ${result.breakaway.riders} corredores`
      : result.stageType === "itt" ? "Contrarreloj individual" : "Sin datos de fuga";
    panel.classList.remove("is-hidden");
  }

  renderTourDashboard() {
    if (!this.tour?.roster) return;
    const tourCompleted = this.tour.completedStages >= TOUR_STAGE_COUNT;
    const stage = this.tour.stages[this.tour.stageIndex];
    const road = this.stageRoadPreview(stage);
    const general = this.getTourRanking("time");
    const points = this.getTourRanking("points");
    const mountain = this.getTourRanking("mountain").filter((entry) => entry.mountain > 0);
    const young = this.getTourRanking("time", true);
    const playerGeneral = general.findIndex((entry) => entry.tourId === 0) + 1;
    const objective = simulationRules.objectiveForStage(stage);
    const dashboard = document.getElementById("tourDashboard");
    dashboard.classList.toggle("completed", tourCompleted);
    document.getElementById("dashboardSlot").textContent = this.activeSaveSlot ? `SLOT ${this.activeSaveSlot}` : "PARTIDA";
    document.getElementById("dashboardProgress").textContent = tourCompleted
      ? "TOUR COMPLETO" : `ETAPA ${stage.number} / ${TOUR_STAGE_COUNT}`;
    document.getElementById("dashboardStageSectionLabel").textContent = tourCompleted ? "RESUMEN DEL TOUR" : "SIGUIENTE ETAPA";
    document.getElementById("playStageButton").classList.toggle("is-hidden", tourCompleted);
    document.getElementById("simulateStageButton").classList.toggle("is-hidden", tourCompleted);
    document.getElementById("dashboardNewTourButton").classList.toggle("is-hidden", !tourCompleted);
    if (tourCompleted) {
      const roads = this.tour.stages.map((tourStage) => this.stageRoadPreview(tourStage));
      const totalDistance = this.tour.stages.reduce((sum, tourStage) => sum + tourStage.lengthKm, 0);
      const totalAscent = roads.reduce((sum, tourRoad) => sum + tourRoad.totalAscent, 0);
      const totalMountains = roads.reduce((sum, tourRoad, index) =>
        sum + (this.tour.stages[index].type === "itt" ? 0 : tourRoad.mountains.length), 0);
      const totalSprints = roads.reduce((sum, tourRoad, index) =>
        sum + (this.tour.stages[index].type === "itt" ? 0 : tourRoad.intermediateSprints.length), 0);
      document.getElementById("dashboardStageType").textContent = "CLASIFICACIÓN FINAL";
      document.getElementById("dashboardStageName").textContent = "TOUR FINALIZADO";
      document.getElementById("dashboardStageDistance").textContent = `${Math.round(totalDistance).toLocaleString("es-ES")} km`;
      document.getElementById("dashboardStageAscent").textContent = `+${Math.round(totalAscent).toLocaleString("es-ES")} m`;
      document.getElementById("dashboardStageMountains").textContent = totalMountains;
      document.getElementById("dashboardStageSprints").textContent = totalSprints;
      document.getElementById("dashboardStageScenery").textContent =
        `Ganador · ${general[0]?.rider.flag || ""} ${general[0]?.rider.name || "—"} · Tu posición · ${ordinal(playerGeneral)}`;
    } else {
      document.getElementById("dashboardStageType").textContent = stage.label;
      document.getElementById("dashboardStageName").textContent = stage.name;
      document.getElementById("dashboardStageDistance").textContent = `${Math.round(stage.lengthKm)} km`;
      document.getElementById("dashboardStageAscent").textContent = `+${Math.round(road.totalAscent).toLocaleString("es-ES")} m`;
      document.getElementById("dashboardStageMountains").textContent = stage.type === "itt" ? "—" : road.mountains.length;
      document.getElementById("dashboardStageSprints").textContent = stage.type === "itt" ? "—" : road.intermediateSprints.length;
      const scenery = [...new Set(road.sceneryZones.map((zone) => zone.name))].slice(0, 5).join(" · ");
      const playerCondition = this.tour.conditions?.get(0) || { fatigue: 0, form: 0 };
      const playerRider = this.tour.roster.find((rider) => rider.tourId === 0);
      const team = TEAM_BY_ID.get(this.tour.playerTeamId) || TEAM_DEFINITIONS[0];
      const formLabel = playerCondition.form >= 0
        ? `forma +${playerCondition.form.toFixed(1)}` : `forma ${playerCondition.form.toFixed(1)}`;
      const restLabel = this.tour.stageIndex === Math.floor(TOUR_STAGE_COUNT / 2) &&
        this.tour.completedStages === Math.floor(TOUR_STAGE_COUNT / 2)
        ? "DESCANSO COMPLETO · FATIGA 0 · "
        : "";
      document.getElementById("dashboardStageScenery").textContent =
        `${restLabel}${team.name} · ${derivedSpecialty(playerRider)} · ${formLabel} · fatiga ${Math.round(playerCondition.fatigue)} · ` +
        `${stage.type === "itt" ? "Salida individual · sin rebufo ni colisiones" : "Etapa en línea · puertos y metas puntuables"} · ${scenery}`;
    }

    const calendar = document.getElementById("dashboardCalendar");
    calendar.replaceChildren();
    this.tour.stages.forEach((calendarStage, index) => {
      const item = document.createElement("li");
      if (index < this.tour.completedStages) item.classList.add("completed");
      if (!tourCompleted && index === this.tour.stageIndex) item.classList.add("current");
      if (this.tour.stageResults?.some((result) => result.stageNumber === calendarStage.number)) {
        item.dataset.stageResult = String(calendarStage.number);
        item.tabIndex = 0;
        item.setAttribute("role", "button");
        item.setAttribute("aria-label", `Ver resultado de la etapa ${calendarStage.number}`);
      }
      const number = document.createElement("b");
      number.textContent = index < this.tour.completedStages ? "✓" : String(calendarStage.number);
      const name = document.createElement("span");
      name.textContent = `${calendarStage.type === "itt" ? "◷" : calendarStage.type === "mountain" ? "▲" : "●"} ${calendarStage.name}`;
      const distance = document.createElement("small");
      distance.textContent = `${Math.round(calendarStage.lengthKm)} km`;
      item.append(number, name, distance);
      calendar.appendChild(item);
    });
    document.getElementById("dashboardStageHistory").classList.add("is-hidden");
    const objectiveCard = document.getElementById("dashboardObjective");
    objectiveCard.classList.toggle("is-hidden", tourCompleted);
    objectiveCard.querySelector("strong").textContent = objective.label;
    objectiveCard.querySelector("small").textContent = objective.description;

    document.getElementById("dashboardPlayerGc").textContent = this.tour.completedStages
      ? `TÚ · ${ordinal(playerGeneral)}` : "SIN CLASIFICAR";
    this.renderDashboardList("dashboardGcList", general, "time");
    this.renderDashboardList("dashboardPointsList", points, "points");
    this.renderDashboardList("dashboardMountainList", mountain, "mountain");
    this.renderDashboardList("dashboardYoungList", young, "young");
    this.renderManagedTeam();
  }

  renderManagedTeam() {
    if (!this.tour?.roster) return;
    const team = TEAM_BY_ID.get(this.tour.playerTeamId) || TEAM_DEFINITIONS[0];
    const riders = this.tour.roster.filter((rider) => rider.team === team.name)
      .sort((a, b) => (a.role === "leader" ? -1 : b.role === "leader" ? 1 : a.tourId - b.tourId));
    document.getElementById("managedTeamIdentity").textContent = team.identity.toUpperCase();
    document.getElementById("managedTeamCrest").innerHTML = teamCrestMarkup(team);
    document.getElementById("managedTeamName").textContent = team.name;
    const leader = riders.find((rider) => rider.role === "leader") || riders[0];
    document.getElementById("managedTeamLeader").textContent =
      `Líder · ${leader?.flag || ""} ${leader?.name || team.leader.name}`;
    const roster = document.getElementById("managedRoster");
    roster.replaceChildren();
    riders.forEach((rider, index) => {
      const condition = this.tour.conditions.get(rider.tourId) || { fatigue: 0, form: 0 };
      const row = document.createElement("article");
      row.className = `managed-rider${rider.tourId === 0 ? " player" : ""}`;
      const number = document.createElement("b");
      number.textContent = String(index + 1).padStart(2, "0");
      const identity = document.createElement("div");
      identity.className = "rider-name";
      identity.innerHTML = `<strong>${rider.flag || ""} ${rider.name}</strong><small>${derivedSpecialty(rider)}</small>`;
      row.append(number, identity);
      [
        ["MON", rider.climbing], ["SPR", rider.sprint],
        ["RES", rider.endurance], ["TÉC", rider.technique]
      ].forEach(([label, value]) => {
        const stat = document.createElement("div");
        stat.className = "rider-stat";
        stat.innerHTML = `<span>${label}</span><strong>${Math.round(value)}</strong>`;
        row.appendChild(stat);
      });
      const status = document.createElement("div");
      status.className = `rider-condition${condition.fatigue >= 45 ? " tired" : ""}`;
      const form = condition.form >= 0 ? `+${condition.form.toFixed(1)}` : condition.form.toFixed(1);
      status.innerHTML =
        `<span>CANSANCIO / FATIGA</span><strong>${Math.round(condition.fatigue)}%</strong><em>FORMA ${form}</em>`;
      row.appendChild(status);
      const role = document.createElement("div");
      role.className = "rider-role";
      role.innerHTML = `<span>ROL FIJO</span><strong>${rider.roleLabel || rider.type || "GREGARIO"}</strong>`;
      row.appendChild(role);
      roster.appendChild(row);
    });
  }

  directoryRoster() {
    if (this.tour?.roster) return this.tour.roster;
    if (!this.directoryRosterCache) {
      const stage = { number: 1, type: "road", profile: "mixed", lengthKm: 160, name: "Presentación", label: "MEDIA MONTAÑA" };
      const preview = new Race(this, "normal", "dry", {
        seed: 4604, stageDefinition: stage, playerTeamId: "solaris", simulationOnly: true
      });
      this.directoryRosterCache = this.captureRoster(preview);
    }
    return this.directoryRosterCache;
  }

  openTeamsDirectory(teamId = "solaris") {
    this.directoryTeamId = TEAM_BY_ID.has(teamId) ? teamId : "solaris";
    const tabs = document.getElementById("teamDirectoryTabs");
    tabs.replaceChildren();
    TEAM_DEFINITIONS.forEach((team) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = team.name.toUpperCase();
      button.classList.toggle("active", team.id === this.directoryTeamId);
      button.addEventListener("click", () => {
        this.directoryTeamId = team.id;
        this.openTeamsDirectory(team.id);
      });
      tabs.appendChild(button);
    });
    this.renderTeamDirectoryDetail();
    document.getElementById("teamsDirectoryOverlay").classList.remove("is-hidden");
  }

  renderTeamDirectoryDetail() {
    const team = TEAM_BY_ID.get(this.directoryTeamId) || TEAM_DEFINITIONS[0];
    const riders = this.directoryRoster().filter((rider) => rider.team === team.name)
      .sort((a, b) => (a.role === "leader" ? -1 : b.role === "leader" ? 1 : a.tourId - b.tourId));
    const detail = document.getElementById("teamDirectoryDetail");
    detail.replaceChildren();
    const header = document.createElement("header");
    header.className = "directory-team-header";
    header.innerHTML = `${teamCrestMarkup(team)}<div><h3>${team.name}</h3><p>${team.identity} · Líder predefinido: ${team.leader.flag} ${team.leader.name}</p></div>`;
    const roster = document.createElement("div");
    roster.className = "directory-roster";
    riders.forEach((rider) => {
      const row = document.createElement("div");
      row.className = `directory-rider${rider.role === "leader" ? " leader" : ""}`;
      row.innerHTML = `<span>${rider.flag || ""} ${rider.name}${rider.role === "leader" ? " ◆" : ""}</span>` +
        `<b title="Montaña">M ${Math.round(rider.climbing)}</b><b title="Sprint">S ${Math.round(rider.sprint)}</b>` +
        `<b title="Resistencia">R ${Math.round(rider.endurance)}</b><b title="Técnica">T ${Math.round(rider.technique)}</b>` +
        `<em>${derivedSpecialty(rider)}</em>`;
      roster.appendChild(row);
    });
    detail.append(header, roster);
  }

  closeTeamsDirectory() {
    document.getElementById("teamsDirectoryOverlay").classList.add("is-hidden");
  }

  openTeamSelection(slot) {
    this.pendingSaveSlot = slot;
    this.selectedTeamId = "solaris";
    const grid = document.getElementById("teamSelectionGrid");
    grid.replaceChildren();
    TEAM_DEFINITIONS.forEach((team) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `team-select-card${team.id === this.selectedTeamId ? " active" : ""}`;
      button.dataset.teamId = team.id;
      button.innerHTML = `${teamCrestMarkup(team)}<strong>${team.name}</strong><span>${team.identity.toUpperCase()}</span>` +
        `<small>Líder · ${team.leader.flag} ${team.leader.name}<br>M ${team.leader.climbing} · S ${team.leader.sprint} · R ${team.leader.endurance} · T ${team.leader.technique}</small>`;
      button.addEventListener("click", () => {
        this.selectedTeamId = team.id;
        grid.querySelectorAll(".team-select-card").forEach((card) =>
          card.classList.toggle("active", card.dataset.teamId === team.id));
        document.getElementById("selectedTeamName").textContent = team.name.toUpperCase();
      });
      grid.appendChild(button);
    });
    document.getElementById("selectedTeamName").textContent = TEAM_BY_ID.get(this.selectedTeamId).name.toUpperCase();
    document.getElementById("teamSelectionOverlay").classList.remove("is-hidden");
  }

  closeTeamSelection() {
    this.pendingSaveSlot = null;
    document.getElementById("teamSelectionOverlay").classList.add("is-hidden");
  }

  confirmTeamSelection() {
    const slot = this.pendingSaveSlot;
    if (!slot || !TEAM_BY_ID.has(this.selectedTeamId)) return;
    document.getElementById("teamSelectionOverlay").classList.add("is-hidden");
    this.pendingSaveSlot = null;
    this.startTour(slot, this.selectedTeamId);
  }

  showTourDashboard() {
    if (!this.tour) {
      this.showMenu();
      return;
    }
    this.gameMode = "tour";
    this.ensureTourRoster();
    this.state = "DASHBOARD";
    this.race = null;
    this.cameraInspection = null;
    document.getElementById("menuOverlay").classList.add("is-hidden");
    document.getElementById("finishOverlay").classList.add("is-hidden");
    document.getElementById("pauseOverlay").classList.add("is-hidden");
    document.getElementById("countdownOverlay").className = "countdown-overlay";
    document.getElementById("lastKmOverlay").classList.remove("active");
    document.getElementById("returnCameraButton").classList.add("is-hidden");
    document.getElementById("followCard").classList.add("is-hidden");
    document.getElementById("eventFeed").replaceChildren();
    document.getElementById("resourceFeedback").replaceChildren();
    this.hud.showDanger(false, 0);
    document.getElementById("tourDashboard").classList.remove("is-hidden");
    this.setDashboardSection("stage");
    this.renderTourDashboard();
  }

  openSaveSlot(slot) {
    const save = this.readSaveSlot(slot);
    if (!save) {
      this.openTeamSelection(slot);
      return;
    }
    this.restoreTour(save, slot);
    this.showTourDashboard();
  }

  deleteSaveSlot(slot) {
    const save = this.readSaveSlot(slot);
    if (!save || !window.confirm(`¿Borrar la partida del slot ${slot}? Esta acción no se puede deshacer.`)) return;
    safeStorageRemove(this.saveSlotKey(slot));
    if (this.activeSaveSlot === slot) {
      this.activeSaveSlot = null;
      this.tour = null;
    }
    this.renderSaveSlots();
  }

  createTour(slot = null, playerTeamId = "solaris") {
    const seed = (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
    return {
      seed,
      slot,
      stageIndex: 0,
      stages: createTourCalendar(seed),
      roster: null,
      totals: new Map(),
      conditions: new Map(),
      stageResults: [],
      playerTeamId: TEAM_BY_ID.has(playerTeamId) ? playerTeamId : "solaris",
      stageAssignments: {},
      playerProfile: DEFAULT_PLAYER_PROFILE,
      jerseyAssignments: {},
      completedStages: 0
    };
  }

  createQuickRaceSession() {
    const seed = (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
    return {
      seed,
      slot: null,
      stageIndex: 0,
      stages: [createQuickStage(seed)],
      roster: null,
      totals: new Map(),
      conditions: new Map(),
      stageResults: [],
      playerProfile: DEFAULT_PLAYER_PROFILE,
      jerseyAssignments: {},
      leaders: {},
      completedStages: 0,
      quickRace: true
    };
  }

  setMenuGameMode(mode) {
    this.menuGameMode = mode === "quick" ? "quick" : "tour";
    const quick = this.menuGameMode === "quick";
    const tourButton = document.getElementById("tourModeButton");
    const quickButton = document.getElementById("quickModeButton");
    tourButton.classList.toggle("active", !quick);
    quickButton.classList.toggle("active", quick);
    tourButton.setAttribute("aria-selected", String(!quick));
    quickButton.setAttribute("aria-selected", String(quick));
    document.getElementById("tourModePanel").classList.toggle("is-hidden", quick);
    document.getElementById("quickModePanel").classList.toggle("is-hidden", !quick);
  }

  startQuickRace() {
    this.simulationCheckpoint = null;
    this.gameMode = "quick";
    this.activeSaveSlot = null;
    this.tour = this.createQuickRaceSession();
    this.start();
  }

  startTour(slot = this.activeSaveSlot, playerTeamId = "solaris") {
    this.simulationCheckpoint = null;
    this.gameMode = "tour";
    this.activeSaveSlot = slot || null;
    this.tour = this.createTour(this.activeSaveSlot, playerTeamId);
    this.showTourDashboard();
  }

  startNewTourFromDashboard() {
    if (!this.tour || this.tour.completedStages < TOUR_STAGE_COUNT) return;
    const slotLabel = this.activeSaveSlot ? ` del slot ${this.activeSaveSlot}` : "";
    if (!window.confirm(`¿Crear un Tour nuevo${slotLabel}? El Tour terminado será reemplazado.`)) return;
    this.openTeamSelection(this.activeSaveSlot);
  }

  continueTour() {
    this.simulationCheckpoint = null;
    if (this.gameMode === "quick") {
      this.startQuickRace();
      return;
    }
    if (!this.tour) {
      this.startTour(this.activeSaveSlot);
      return;
    }
    if (this.tour.completedStages >= TOUR_STAGE_COUNT) {
      this.showTourDashboard();
      return;
    }
    this.tour.stageIndex = this.tour.completedStages;
    this.showTourDashboard();
  }

  captureRoster(race) {
    const fields = [
      "name", "nationality", "flag", "type", "team", "color", "teamIndex", "role", "roleLabel",
      "climbing", "sprint", "endurance", "technique", "aggression", "intelligence", "age", "tourId", "stageRole"
    ];
    return race.cyclists.map((rider) => Object.fromEntries(fields.map((field) => [field, rider[field]])));
  }

  start() {
    this.simulationCheckpoint = null;
    this.audio.unlock();
    if (!this.tour) {
      this.gameMode = "tour";
      this.tour = this.createTour();
    }
    this.ensureTourRoster();
    const difficulty = document.getElementById("difficultySelect").value;
    this.storage.difficulty = difficulty;
    this.saveStorage();
    this.race = this.createCurrentRace();
    this.setRaceSpeed(1);
    this.saveTour();
    this.state = "COUNTDOWN";
    this.cameraFocusKm = 0;
    this.cameraInspection = null;
    this.cameraZoom = 1;
    this.cameraShake = 0;
    document.getElementById("menuOverlay").classList.add("is-hidden");
    document.getElementById("tourDashboard").classList.add("is-hidden");
    document.getElementById("finishOverlay").classList.add("is-hidden");
    document.getElementById("pauseOverlay").classList.add("is-hidden");
    const returnButton = document.getElementById("returnCameraButton");
    returnButton.textContent = "⌖ TÚ";
    returnButton.setAttribute("aria-label", "Volver a tu ciclista");
    returnButton.classList.add("is-hidden");
    document.getElementById("followCard").classList.add("is-hidden");
    this.closeTeamOrders();
    const teamOrderButton = document.getElementById("teamOrderButton");
    teamOrderButton.disabled = this.race.timeTrial;
    teamOrderButton.classList.toggle("is-hidden", this.race.timeTrial);
    document.getElementById("teamOrderCurrent").textContent = TEAM_ORDERS.protect.label;
    document.getElementById("teamOrderTitle").textContent = `♟ EQUIPO ${this.race.player.team.toUpperCase()}`;
    document.querySelectorAll("[data-team-order]").forEach((button) => {
      button.classList.toggle("active", button.dataset.teamOrder === "protect");
    });
    this.hud.setMobileView("race");
    this.hud.racePointPopupKey = "";
    this.hud.racePointPopupUntil = 0;
    this.hud.lastKmPopupShown = false;
    this.hud.lastKmPopupUntil = 0;
    this.hud.showDanger(false, 0);
    this.hud.update();
    if (this.storage.tutorialSeen) this.runCountdown();
    else this.openTutorial();
  }

  runCountdown() {
    const overlay = document.getElementById("countdownOverlay");
    overlay.className = "countdown-overlay active";
    const frames = ["3", "2", "1", "¡SALIDA!"];
    let index = 0;
    overlay.textContent = frames[index];
    const interval = window.setInterval(() => {
      index += 1;
      if (index >= frames.length) {
        window.clearInterval(interval);
        overlay.className = "countdown-overlay";
        this.state = "RACING";
        this.lastTimestamp = performance.now();
        this.notify(this.race.timeTrial
          ? `CRONO · sales ${ordinal(this.race.startPosition)} de 100 · ${Math.round(this.race.road.lengthKm)} km · sin rebufo.`
          : `Sales ${ordinal(this.race.startPosition)} de 100 · ${Math.round(this.race.road.lengthKm)} km. Busca tu posición.`);
        return;
      }
      overlay.textContent = frames[index];
      overlay.classList.toggle("go", index === frames.length - 1);
      this.audio.cue(index === frames.length - 1 ? 720 : 420);
    }, 780);
  }

  pause() {
    if (this.state !== "RACING") return;
    this.state = "PAUSED";
    document.getElementById("pauseOverlay").classList.remove("is-hidden");
  }

  setRaceSpeed(speed) {
    this.raceSpeed = speed === 5 ? 5 : 1;
    const button = document.getElementById("raceSpeedButton");
    if (!button) return;
    const fast = this.raceSpeed === 5;
    const value = button.querySelector("span");
    if (value) value.textContent = fast ? "×5" : "×1";
    button.classList.toggle("fast", fast);
    button.setAttribute("aria-pressed", String(fast));
    button.setAttribute("aria-label", `Velocidad de carrera por ${fast ? "cinco" : "uno"}`);
    button.title = fast ? "Volver a velocidad normal" : "Aumentar la carrera a velocidad ×5";
  }

  resume() {
    if (this.state !== "PAUSED") return;
    this.state = "RACING";
    this.lastTimestamp = performance.now();
    document.getElementById("pauseOverlay").classList.add("is-hidden");
  }

  showMenu() {
    this.simulationCheckpoint = null;
    this.state = "MENU";
    this.race = null;
    this.cameraInspection = null;
    document.getElementById("menuOverlay").classList.remove("is-hidden");
    document.getElementById("tourDashboard").classList.add("is-hidden");
    document.getElementById("pauseOverlay").classList.add("is-hidden");
    document.getElementById("finishOverlay").classList.add("is-hidden");
    document.getElementById("countdownOverlay").className = "countdown-overlay";
    document.getElementById("lastKmOverlay").classList.remove("active");
    document.getElementById("returnCameraButton").classList.add("is-hidden");
    document.getElementById("followCard").classList.add("is-hidden");
    document.getElementById("tutorialOverlay").classList.add("is-hidden");
    document.getElementById("teamSelectionOverlay").classList.add("is-hidden");
    document.getElementById("teamsDirectoryOverlay").classList.add("is-hidden");
    this.closeTeamOrders();
    document.getElementById("eventFeed").replaceChildren();
    document.getElementById("resourceFeedback").replaceChildren();
    this.hud.showDanger(false, 0);
    this.updateRecords();
    this.renderSaveSlots();
    this.setMenuGameMode(this.menuGameMode);
  }

  getTourRanking(type, youngOnly = false) {
    if (!this.tour?.roster) return [];
    const rosterById = new Map(this.tour.roster.map((rider) => [rider.tourId, rider]));
    return [...this.tour.totals.values()]
      .map((total) => ({ ...total, rider: rosterById.get(total.tourId) }))
      .filter((entry) => !youngOnly || entry.rider.age <= YOUNG_RIDER_MAX_AGE)
      .sort((a, b) => {
        if (type === "time") return a.time - b.time || b.points - a.points || a.tourId - b.tourId;
        return b[type] - a[type] || a.time - b.time || a.tourId - b.tourId;
      });
  }

  officialStageTimes(stageRanking, rawFinishTime) {
    const official = new Map();
    if (this.race.timeTrial) {
      stageRanking.forEach((rider) => official.set(rider, rawFinishTime(rider)));
      return official;
    }
    // Los valores recibidos ya son segundos reales. En etapas en línea se
    // aplica la regla de los tres segundos para que un pelotón que cruza
    // junto no acumule diferencias artificiales en la general.
    const sameTimeWindow = 3;
    let groupTime = rawFinishTime(stageRanking[0]);
    let groupLeaderTime = groupTime;
    stageRanking.forEach((rider, index) => {
      const raw = rawFinishTime(rider);
      if (index > 0 && raw - groupLeaderTime > sameTimeWindow) {
        groupTime = raw;
        groupLeaderTime = raw;
      }
      official.set(rider, groupTime);
    });
    return official;
  }

  updateTourConditions(stageRanking) {
    const race = this.race;
    if (!(this.tour.conditions instanceof Map)) this.tour.conditions = new Map();
    const fullRestDay = this.tour.stageIndex === Math.floor(TOUR_STAGE_COUNT / 2) - 1;
    stageRanking.forEach((rider) => {
      const current = this.tour.conditions.get(rider.tourId) || {
        tourId: rider.tourId, fatigue: 0, form: 0
      };
      const assignmentLoad = rider.stageRole === "support" ? 4.5
        : ["stage", "points", "mountain"].includes(rider.stageRole) ? 3.5 : 1.5;
      const stageLoad = clamp(
        simulationRules.fatigue.baseLoad + rider.fatigue * simulationRules.fatigue.previousLoad +
        Math.max(0, 100 - rider.energy) * 0.35 +
        race.road.totalAscent / 300 + race.road.lengthKm / 70 + assignmentLoad,
        10,
        simulationRules.fatigue.maximumStageLoad
      );
      const fatigue = fullRestDay ? 0 : clamp(
        current.fatigue * simulationRules.fatigue.carry + stageLoad,
        0,
        simulationRules.fatigue.maximumFatigue
      );
      const formRandom = new SeededRandom(
        (this.tour.seed + (this.tour.stageIndex + 2) * 104729 + rider.tourId * 7919) >>> 0
      );
      const dailyVariation = (formRandom.next() + formRandom.next() - 1) * 5.5;
      const form = clamp(current.form * 0.42 + dailyVariation - fatigue * 0.012, -8, 8);
      this.tour.conditions.set(rider.tourId, { tourId: rider.tourId, fatigue, form });
    });
  }

  recordStageResult(stageRanking, officialTime) {
    const race = this.race;
    const winnerTime = officialTime(stageRanking[0]);
    const playerPosition = stageRanking.indexOf(race.player) + 1;
    const breakawayRiders = race.simulatedBreakaway?.riders ||
      race.breakawayDirector?.historyRiders || [];
    const breakawayWon = breakawayRiders.includes(stageRanking[0]);
    const result = {
      stageNumber: race.stageDefinition.number,
      stageName: race.road.stageName,
      stageType: race.stageDefinition.type,
      resolutionMode: race.resolutionMode === "simulated" ? "simulated" : "played",
      podium: stageRanking.slice(0, 3).map((rider) => ({
        tourId: rider.tourId,
        name: rider.name,
        flag: rider.flag || "",
        time: officialTime(rider),
        gap: officialTime(rider) - winnerTime
      })),
      player: {
        position: playerPosition,
        time: officialTime(race.player),
        gap: officialTime(race.player) - winnerTime
      },
      breakaway: {
        formed: !race.timeTrial && (race.simulatedBreakaway ? true : race.breakawayDirector?.hasHadBreakaway),
        won: breakawayWon,
        riders: breakawayRiders.length
      },
      objective: race.secondaryObjective ? {
        id: race.secondaryObjective.id,
        label: race.secondaryObjective.label,
        completed: Boolean(race.secondaryObjectiveCompleted)
      } : null,
      completedAt: new Date().toISOString()
    };
    if (!Array.isArray(this.tour.stageResults)) this.tour.stageResults = [];
    const previousIndex = this.tour.stageResults.findIndex((entry) => entry.stageNumber === result.stageNumber);
    if (previousIndex >= 0) this.tour.stageResults[previousIndex] = result;
    else this.tour.stageResults.push(result);
  }

  updateTourStandings(stageRanking, officialFinishTime) {
    const race = this.race;
    stageRanking.forEach((rider, index) => {
      const total = this.tour.totals.get(rider.tourId);
      total.time += officialFinishTime(rider);
      total.points += STAGE_POINTS[index] || 0;
      total.points += race.pointStandings.sprint.get(rider) || 0;
      total.mountain += race.pointStandings.mountain.get(rider) || 0;
      total.stages += 1;
    });
    this.updateTourConditions(stageRanking);
    this.tour.completedStages = Math.max(this.tour.completedStages, this.tour.stageIndex + 1);
    const classifications = {
      yellow: this.getTourRanking("time"),
      green: this.getTourRanking("points"),
      polka: this.getTourRanking("mountain").filter((entry) => entry.mountain > 0),
      white: this.getTourRanking("time", true)
    };
    this.tour.leaders = Object.fromEntries(
      Object.entries(classifications).map(([jersey, ranking]) => [jersey, ranking[0]?.tourId])
    );
    const assignments = {};
    const wornBy = new Set();
    ["yellow", "green", "polka", "white"].forEach((jersey) => {
      const wearer = classifications[jersey].find((entry) => !wornBy.has(entry.tourId));
      if (!wearer) return;
      assignments[wearer.tourId] = jersey;
      wornBy.add(wearer.tourId);
    });
    this.tour.jerseyAssignments = assignments;
    this.saveTour();
  }

  renderTourClassification(elementId, entries, type) {
    const ridersById = new Map(this.race.cyclists.map((rider) => [rider.tourId, rider]));
    const list = document.getElementById(elementId);
    list.innerHTML = "";
    if (!entries.length) {
      const empty = document.createElement("li");
      empty.className = "empty";
      empty.textContent = "AÚN SIN PUNTOS";
      list.appendChild(empty);
      return;
    }
    entries.forEach((entry, index) => {
      const rider = ridersById.get(entry.tourId) || entry.rider;
      const item = document.createElement("li");
      if (entry.tourId === this.race.player.tourId) item.classList.add("player");
      if (index === 0) item.classList.add("winner");
      const identity = document.createElement("span");
      identity.textContent = `${rider.flag || ""} ${rider.name}`;
      const value = document.createElement("strong");
      if (type === "time") {
        value.textContent = index === 0 ? formatTime(entry.time) : `+${formatTime(entry.time - entries[0].time)}`;
      } else if (type === "young") {
        value.textContent = index === 0 ? formatTime(entry.time) : `+${formatTime(entry.time - entries[0].time)}`;
      } else {
        value.textContent = `${entry[type]} pt`;
      }
      item.append(identity, value);
      list.appendChild(item);
    });
  }

  instantStageScore(rider, stage, random) {
    const profile = stage.profile;
    let ability;
    if (stage.type === "itt") {
      const terrainStat = profile === "mixed" ? rider.climbing : rider.sprint;
      ability = rider.endurance * 0.36 + rider.technique * 0.27 +
        rider.intelligence * 0.22 + terrainStat * 0.15;
    } else if (profile === "mountain") {
      ability = rider.climbing * 0.52 + rider.endurance * 0.29 +
        rider.intelligence * 0.13 + rider.technique * 0.06;
    } else if (profile === "flat") {
      ability = rider.sprint * 0.38 + rider.endurance * 0.31 +
        rider.intelligence * 0.18 + rider.technique * 0.13;
    } else {
      ability = rider.climbing * 0.3 + rider.endurance * 0.3 +
        rider.sprint * 0.18 + rider.intelligence * 0.14 + rider.technique * 0.08;
    }
    const difficulty = stage.finale ? "easy" : document.getElementById("difficultySelect").value;
    const playerModifier = rider.tourId === 0
      ? difficulty === "easy" ? 3.5 : difficulty === "hard" ? -2 : 0.75
      : 0;
    const raceDay = (random.next() + random.next() + random.next() - 1.5) * 9.5;
    const condition = rider.dailyForm * 0.7 - rider.tourFatigue * 0.025;
    const roleBonus = stage.type !== "itt" && profile === "mountain" && rider.role === "climber" ? 1.2
      : stage.type !== "itt" && profile === "flat" && rider.role === "sprinter" ? 1.2 : 0;
    const assignmentBonus = stage.type === "itt" ? 0
      : rider.stageRole === "stage" ? 1.5
        : rider.stageRole === "mountain" && profile === "mountain" ? 2.6
          : rider.stageRole === "points" && profile === "flat" ? 2.6
            : rider.stageRole === "finish" ? -3.2
              : rider.stageRole === "support" ? -1.4 : 0;
    return ability + playerModifier + raceDay + roleBonus + assignmentBonus + condition;
  }

  createInstantBreakaway(race, random) {
    if (race.timeTrial) return { riders: [], survived: false, bonuses: new Map() };
    const desiredSize = 4 + Math.floor(random.next() * 4);
    const candidatesByTeam = new Map();
    race.cyclists.filter((rider) => rider !== race.player).forEach((rider) => {
      const roleValue = rider.role === "attacker" ? 16
        : rider.role === "domestique" ? 10
          : rider.role === "climber" && race.stageDefinition.profile !== "flat" ? 8 : 0;
      const value = roleValue + rider.aggression * 0.12 + random.next() * 8;
      if (!candidatesByTeam.has(rider.team) || value > candidatesByTeam.get(rider.team).value) {
        candidatesByTeam.set(rider.team, { rider, value });
      }
    });
    const riders = [...candidatesByTeam.values()]
      .sort((a, b) => b.value - a.value)
      .slice(0, desiredSize)
      .map((entry) => entry.rider);
    const survivalChance = race.stageDefinition.profile === "mixed" ? 0.2
      : race.stageDefinition.profile === "flat" ? 0.16 : 0.12;
    const survived = random.next() < survivalChance;
    const bonuses = new Map();
    riders.forEach((rider, index) => {
      const bonus = survived
        ? 11 + random.next() * 3.5 - index * 0.3
        : -0.8 + random.next() * 2;
      bonuses.set(rider, bonus);
    });
    return { riders, survived, bonuses };
  }

  simulateCurrentStage() {
    if (!this.tour || this.tour.completedStages >= TOUR_STAGE_COUNT) return;
    if (!window.confirm("¿Simular esta etapa? El resultado se generará y se guardará inmediatamente.")) return;
    this.ensureTourRoster();
    this.simulationCheckpoint = {
      save: safeJsonParse(JSON.stringify(this.serializeTour()), null),
      slot: this.activeSaveSlot,
      storage: { ...this.storage }
    };
    const race = this.createCurrentRace({ simulationOnly: true });
    race.resolutionMode = "simulated";
    const stage = race.stageDefinition;
    const random = new SeededRandom((race.seed ^ 0x9e3779b9) >>> 0);
    const simulatedBreakaway = this.createInstantBreakaway(race, random);
    race.simulatedBreakaway = simulatedBreakaway;
    const scored = race.cyclists.map((rider) => ({
      rider,
      score: this.instantStageScore(rider, stage, random) + (simulatedBreakaway.bonuses.get(rider) || 0)
    }));
    const baseSpeed = stage.type === "itt" ? 42 : stage.profile === "mountain" ? 33
      : stage.profile === "flat" ? 44 : 38;
    scored.forEach(({ rider, score }) => {
      const effectiveSpeed = baseSpeed * clamp(0.9 + (score - 70) * 0.0042, 0.84, 1.12);
      rider.finishTime = stage.lengthKm / effectiveSpeed * 3600;
      rider.distance = race.road.lengthKm;
      rider.previousDistance = rider.distance;
      rider.finished = true;
      rider.speed = effectiveSpeed;
      rider.maxSpeed = effectiveSpeed + (stage.profile === "mountain" ? 12 : 7);
      rider.energy = clamp(72 + (rider.endurance - 78) * 0.8 - stage.lengthKm * 0.13 -
        race.road.totalAscent / 170, 8, 88);
      rider.explosive = clamp(62 + (rider.sprint - 77) * 0.7 - (stage.profile === "flat" ? 18 : 8), 8, 88);
      rider.nutrition = clamp(74 - stage.lengthKm * 0.12, 12, 78);
    });
    const stageRanking = scored.sort((a, b) => b.score - a.score).map((entry) => entry.rider);
    simulatedBreakaway.won = simulatedBreakaway.riders.includes(stageRanking[0]);
    stageRanking.forEach((rider, index) => {
      rider.finishTime += index * 0.18;
      rider.victory = index === 0;
    });
    race.ranking = stageRanking;
    race.finishOrder = [...stageRanking];
    race.elapsed = Math.max(...stageRanking.map((rider) => rider.finishTime));

    for (const point of race.road.racePoints) {
      const pointRandom = new SeededRandom((race.seed + Math.floor(point.km * 1000)) >>> 0);
      const pointScores = new Map(race.cyclists.map((rider) => {
        const breakawayPointBonus = simulatedBreakaway.riders.includes(rider)
          ? simulatedBreakaway.survived ? 4 : 1.2 : 0;
        const score = point.type === "mountain"
          ? rider.climbing * 0.72 + rider.endurance * 0.2 + pointRandom.next() * 8 + breakawayPointBonus +
            (rider.stageRole === "mountain" ? 7 : 0)
          : rider.sprint * 0.68 + rider.intelligence * 0.2 + pointRandom.next() * 8 + breakawayPointBonus +
            (rider.stageRole === "points" ? 7 : 0);
        return [rider, score];
      }));
      const pointRanking = [...race.cyclists]
        .sort((a, b) => pointScores.get(b) - pointScores.get(a))
        .slice(0, 5);
      point.results = pointRanking;
      point.completed = true;
      pointRanking.forEach((rider, index) => {
        const awarded = point.pointsTable[index];
        const standings = race.pointStandings[point.type];
        standings.set(rider, (standings.get(rider) || 0) + awarded);
        if (rider === race.player) {
          if (point.type === "mountain") rider.mountainPoints += awarded;
          else rider.sprintPoints += awarded;
        }
      });
    }

    this.race = race;
    this.state = "SIMULATING";
    document.getElementById("tourDashboard").classList.add("is-hidden");
    this.finishRace();
  }

  undoSimulation() {
    const checkpoint = this.simulationCheckpoint;
    if (!checkpoint?.save || this.race?.resolutionMode !== "simulated") return;
    this.simulationCheckpoint = null;
    this.restoreTour(checkpoint.save, checkpoint.slot);
    this.storage = { ...checkpoint.storage };
    this.updateRecords();
    this.saveStorage();
    this.saveTour();
    document.getElementById("undoSimulationButton").classList.add("is-hidden");
    this.showTourDashboard();
  }

  finishRace() {
    if (this.state === "FINISHED") return;
    this.state = "FINISHED";
    const race = this.race;
    const player = race.player;
    race.finalizeRacePoints();
    const rawFinishTime = race.resolutionMode === "simulated"
      ? (rider) => rider.finishTime
      : (rider) => (rider.finishTime || race.elapsed) * race.simulationScale +
        Math.max(0, race.road.lengthKm - rider.distance) / Math.max(10, rider.speed) * 3600;
    const stageRanking = [...race.cyclists].sort((a, b) => rawFinishTime(a) - rawFinishTime(b));
    const officialTimes = this.officialStageTimes(stageRanking, rawFinishTime);
    const officialFinishTime = (rider) => officialTimes.get(rider);
    race.officialTimes = officialTimes;
    const position = stageRanking.indexOf(player) + 1;
    const winnerTime = officialFinishTime(stageRanking[0]);
    const playerTime = officialFinishTime(player);
    const quickRace = this.gameMode === "quick" || Boolean(race.stageDefinition.quickRace);
    const stageCount = quickRace ? 1 : TOUR_STAGE_COUNT;
    this.storage.races += 1;
    if (position === 1) this.storage.wins += 1;
    if (!this.storage.bestPosition || position < this.storage.bestPosition) this.storage.bestPosition = position;
    if (!this.storage.bestTime || playerTime < this.storage.bestTime) this.storage.bestTime = playerTime;
    this.saveStorage();
    document.getElementById("finalPosition").textContent = ordinal(position);
    document.getElementById("resultMessage").textContent = position === 1 ? "¡VICTORIA!" : position <= 3 ? "¡PODIO!" : position <= 8 ? "TOP 10" : "ETAPA COMPLETADA";
    document.getElementById("finalTime").textContent = formatTime(playerTime);
    race.secondaryObjective = simulationRules.objectiveForStage(race.stageDefinition);
    race.secondaryObjectiveCompleted = simulationRules.objectiveCompleted(race.secondaryObjective, race, position);
    const objectiveResult = document.getElementById("resultObjective");
    objectiveResult.classList.toggle("completed", race.secondaryObjectiveCompleted);
    objectiveResult.textContent = `${race.secondaryObjectiveCompleted ? "✓ CUMPLIDO" : "○ PENDIENTE"} · ${race.secondaryObjective.label}`;
    this.recordStageResult(stageRanking, officialFinishTime);
    this.updateTourStandings(stageRanking, officialFinishTime);
    this.renderFinalClassification("classificationList", stageRanking, (rider, index) =>
      index === 0 ? formatTime(officialFinishTime(rider)) : `+${formatTime(officialFinishTime(rider) - winnerTime)}`);

    const pointsRanking = (type) => [...race.cyclists]
      .filter((rider) => (race.pointStandings[type].get(rider) || 0) > 0)
      .sort((a, b) => {
        const pointsDifference = (race.pointStandings[type].get(b) || 0) - (race.pointStandings[type].get(a) || 0);
        return pointsDifference || stageRanking.indexOf(a) - stageRanking.indexOf(b);
      });
    const mountainRanking = pointsRanking("mountain");
    const sprintRanking = pointsRanking("sprint");
    this.renderFinalClassification("mountainClassificationList", mountainRanking.slice(0, 5),
      (rider) => `${race.pointStandings.mountain.get(rider)} pt`);
    this.renderFinalClassification("sprintClassificationList", sprintRanking.slice(0, 5),
      (rider) => `${race.pointStandings.sprint.get(rider)} pt`);
    this.renderTourClassification("gcClassificationList", this.getTourRanking("time"), "time");
    this.renderTourClassification("tourPointsClassificationList", this.getTourRanking("points").slice(0, 5), "points");
    this.renderTourClassification("tourMountainClassificationList",
      this.getTourRanking("mountain").filter((entry) => entry.mountain > 0).slice(0, 5), "mountain");
    this.renderTourClassification("youngClassificationList", this.getTourRanking("time", true).slice(0, 5), "young");
    this.renderStagePodium(stageRanking.slice(0, 3), race.road.stageName);
    const generalPosition = this.getTourRanking("time").findIndex((entry) => entry.tourId === player.tourId) + 1;
    document.getElementById("resultEyebrow").textContent =
      `${quickRace ? "CARRERA RÁPIDA" : `ETAPA ${this.tour.stageIndex + 1}/${stageCount}`} · ${race.stageDefinition.label}` +
      (race.resolutionMode === "simulated" ? " · SIMULADA" : "") +
      (race.simulatedBreakaway
        ? race.simulatedBreakaway.won ? " · GANA LA FUGA" : " · FUGA NEUTRALIZADA"
        : "") +
      (this.activeSaveSlot ? ` · GUARDADO S${this.activeSaveSlot}` : "");
    const stats = [
      ["Etapa", `${this.tour.stageIndex + 1}/${stageCount}`], ["Salida", ordinal(race.startPosition)],
      ["Posición", ordinal(position)], ["General", ordinal(generalPosition)], ["Tiempo", formatTime(playerTime)],
      ["Energía", `${Math.round(player.energy)}%`], ["Explosividad", `${Math.round(player.explosive)}%`],
      ["Ataques", player.attacks], ["Tiempo a rueda", formatTime(player.draftTime)],
      ["Velocidad máx.", `${Math.round(player.maxSpeed)} km/h`], ["Caídas", player.crashes],
      ["Montaña", `${player.mountainPoints} pt`], ["Sprint", `${player.sprintPoints} pt`],
      ["Geles usados", player.gelsUsed], ["Tiempo en relevos", formatTime(player.relayTime)],
      ["Relevos dados", player.relayTurns], ["Ataques desde el relevo", player.rivalRelayAttacks],
      ["Orden final", race.timeTrial ? "CRONO" : TEAM_ORDERS[race.playerTeamOrder].label],
      ["Cambios de orden", race.playerTeamOrderChanges]
    ];
    document.getElementById("playerStats").innerHTML = stats.map(([label, value]) =>
      `<div class="stat"><span>${label}</span><strong>${value}</strong></div>`).join("");
    const tourFinished = !quickRace && this.tour.completedStages >= TOUR_STAGE_COUNT;
    if (tourFinished) {
      document.getElementById("resultMessage").textContent =
        generalPosition === 1 ? "¡GANAS EL TOUR!" : `TOUR · ${ordinal(generalPosition)}`;
    }
    const replayButton = document.getElementById("replayButton");
    replayButton.querySelector("span").textContent =
      quickRace ? "OTRA CARRERA" : tourFinished ? "VER TOUR" : "SIGUIENTE ETAPA";
    replayButton.querySelector("b").textContent = quickRace ? "↻" : tourFinished ? "▣" : "▶";
    document.getElementById("undoSimulationButton").classList.toggle(
      "is-hidden",
      race.resolutionMode !== "simulated" || !this.simulationCheckpoint
    );
    document.getElementById("newRaceButton").textContent = "SALIR AL MENÚ";
    const finishOverlay = document.getElementById("finishOverlay");
    this.setResultView("stage");
    finishOverlay.classList.remove("is-hidden");
    if (typeof globalThis.requestAnimationFrame === "function") {
      globalThis.requestAnimationFrame(() => replayButton.focus({ preventScroll: true }));
    }
  }

  renderFinalClassification(elementId, riders, valueForRider) {
    const list = document.getElementById(elementId);
    list.innerHTML = "";
    if (!riders.length) {
      const empty = document.createElement("li");
      empty.className = "empty";
      empty.textContent = "SIN PUNTOS";
      list.appendChild(empty);
      return;
    }
    riders.forEach((rider, index) => {
      const item = document.createElement("li");
      if (rider === this.race.player) item.classList.add("player");
      if (index === 0) item.classList.add("winner");
      const identity = document.createElement("span");
      identity.textContent = `${rider.flag || ""} ${rider.name}`;
      const value = document.createElement("strong");
      value.textContent = valueForRider(rider, index);
      item.append(identity, value);
      list.appendChild(item);
    });
  }

  renderStagePodium(riders, stageName) {
    document.getElementById("podiumStageName").textContent = stageName;
    const podium = document.getElementById("stagePodiumSvg");
    riders.forEach((rider, index) => {
      const place = podium.querySelector(`[data-podium-place="${index}"]`);
      if (!place) return;
      place.querySelector(".podium-jersey").setAttribute("fill", rider.color);
      place.querySelector(".podium-name").textContent = rider.name.toUpperCase();
      place.querySelector(".podium-flag").textContent = rider.flag || "";
    });
    const description = riders.map((rider, index) => `${index + 1}. ${rider.name}`).join(", ");
    document.getElementById("podiumSvgDesc").textContent = `Podio de etapa: ${description}`;
  }

  notify(message, type = "") {
    const feed = document.getElementById("eventFeed");
    // Un único aviso legible evita que salida, contactos y eventos se tapen.
    feed.replaceChildren();
    const element = document.createElement("div");
    element.className = `event-message ${type}`;
    element.textContent = message;
    feed.appendChild(element);
    if (type === "urgent") this.haptic([18, 20, 18]);
    window.setTimeout(() => element.remove(), type === "urgent" ? URGENT_NOTICE_MS : NOTICE_MS);
  }

  showResourceFeedback(items) {
    const container = document.getElementById("resourceFeedback");
    container.replaceChildren();
    items.forEach((item, index) => {
      const element = document.createElement("div");
      element.className = `resource-feedback-item ${item.type || ""}`;
      element.style.animationDelay = `${index * 90}ms`;
      element.style.opacity = "0";
      const icon = document.createElement("i");
      icon.textContent = item.icon;
      const text = document.createElement("span");
      text.textContent = item.text;
      element.append(icon, text);
      container.appendChild(element);
      window.setTimeout(() => element.remove(), 1700 + index * 90);
    });
  }

  inspectGroup(groupIndex) {
    const group = this.race?.groups[groupIndex];
    if (!group || !["RACING", "PAUSED"].includes(this.state)) return;
    const inspection = { type: "group", groupIndex, rider: group.leader, until: performance.now() + POPUP_MAX_MS };
    this.cameraInspection = inspection;
    if (this.state === "PAUSED") this.cameraFocusKm = group.leader.distance;
    document.getElementById("returnCameraButton").classList.remove("is-hidden");
    this.hud.showProfileTooltip(groupIndex);
    window.setTimeout(() => {
      if (this.cameraInspection === inspection) this.returnCameraToPlayer();
    }, POPUP_MAX_MS);
    if (this.state === "PAUSED") this.hud.update();
  }

  riderAtPointer(event) {
    const rect = this.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    for (let index = this.riderHitAreas.length - 1; index >= 0; index -= 1) {
      const hit = this.riderHitAreas[index];
      if (Math.abs(x - hit.x) <= hit.width / 2 && Math.abs(y - hit.y) <= hit.height / 2) return hit.rider;
    }
    return null;
  }

  followRider(rider) {
    if (!this.race || rider === this.race.player) {
      this.returnCameraToPlayer();
      return;
    }
    const inspection = { type: "rider", rider, until: performance.now() + POPUP_MAX_MS };
    this.cameraInspection = inspection;
    if (this.state === "PAUSED") this.cameraFocusKm = rider.distance;
    document.getElementById("returnCameraButton").classList.remove("is-hidden");
    window.setTimeout(() => {
      if (this.cameraInspection === inspection) this.returnCameraToPlayer();
    }, POPUP_MAX_MS);
    this.hud.update();
  }

  selectWheel(rider) {
    if (!this.canControl()) return;
    if (this.race.timeTrial) {
      this.notify("En la contrarreloj compites solo: no hay rueda ni rebufo.");
      return;
    }
    const player = this.race.player;
    if (rider === player || player.wheelTarget === rider) {
      this.cancelWheelTarget();
      return;
    }
    const gap = rider.distance - player.distance;
    if (gap < -0.01) {
      this.notify("Ese ciclista está detrás. Pulsa uno que vaya delante.");
      return;
    }
    if (this.race.relay.active) this.race.stopRelay("Relevos terminados: buscas una rueda concreta.");
    player.wheelTarget = rider;
    player.seekingWheel = true;
    this.cameraInspection = null;
    const cancelButton = document.getElementById("returnCameraButton");
    cancelButton.textContent = "⌖ TÚ";
    cancelButton.setAttribute("aria-label", "Volver a tu ciclista");
    cancelButton.classList.add("is-hidden");
    this.hud.update();
  }

  cancelWheelTarget(notify = true) {
    if (!this.race) return;
    const hadTarget = Boolean(this.race.player.wheelTarget);
    this.race.player.wheelTarget = null;
    this.race.player.seekingWheel = false;
    this.hud.followCardRider = null;
    this.hud.followCardMode = "";
    this.hud.lastFollowCardUpdate = 0;
    this.hud.followCardUntil = 0;
    const cancelButton = document.getElementById("returnCameraButton");
    cancelButton.textContent = "⌖ TÚ";
    cancelButton.setAttribute("aria-label", "Volver a tu ciclista");
    cancelButton.classList.add("is-hidden");
    document.getElementById("followCard").classList.add("is-hidden");
    if (notify && hadTarget) this.notify("Rueda liberada. Posicionamiento libre.");
  }

  inspectKm(km) {
    if (!this.race || !["RACING", "PAUSED"].includes(this.state)) return;
    const inspection = { type: "km", km: clamp(km, 0, this.race.road.lengthKm), until: performance.now() + POPUP_MAX_MS };
    this.cameraInspection = inspection;
    if (this.state === "PAUSED") this.cameraFocusKm = this.cameraInspection.km;
    document.getElementById("returnCameraButton").classList.remove("is-hidden");
    this.notify(`Vista de carrera en el km ${formatNumber(km)}.`);
    window.setTimeout(() => {
      if (this.cameraInspection === inspection) this.returnCameraToPlayer();
    }, POPUP_MAX_MS);
    if (this.state === "PAUSED") this.hud.update();
  }

  returnCameraToPlayer(cancelWheel = false) {
    if (cancelWheel && this.race?.player.wheelTarget) this.cancelWheelTarget();
    this.cameraInspection = null;
    if (this.state === "PAUSED" && this.race) this.cameraFocusKm = this.race.player.distance;
    const returnButton = document.getElementById("returnCameraButton");
    returnButton.textContent = "⌖ TÚ";
    returnButton.setAttribute("aria-label", "Volver a tu ciclista");
    returnButton.classList.add("is-hidden");
    if (!this.race?.player.wheelTarget) {
      document.getElementById("followCard").classList.add("is-hidden");
      this.hud.followCardRider = null;
      this.hud.followCardMode = "";
    }
    if (this.state === "PAUSED") this.hud.update();
  }

  toggleCamera() {
    this.setCameraMode(this.cameraMode === "top" ? "side" : "top");
  }

  setCameraMode(mode) {
    if (!["top", "side"].includes(mode)) return;
    const changed = this.cameraMode !== mode;
    this.cameraMode = mode;
    safeStorageSet("ultimoPuerto.camera", this.cameraMode);
    this.updateCameraButton();
    if (window.innerWidth <= 900 && this.hud?.mobileView !== "race") {
      this.hud.setMobileView("race");
    }
    if (changed) {
      this.notify(this.cameraMode === "side" ? "Cámara lateral activada." : "Cámara cenital activada.");
    }
  }

  updateCameraButton() {
    document.querySelectorAll("[data-camera-mode]").forEach((button) => {
      const active = button.dataset.cameraMode === this.cameraMode;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
      button.title = active
        ? `Vista ${this.cameraMode === "side" ? "lateral" : "cenital"} activa`
        : `Cambiar a vista ${button.dataset.cameraMode === "side" ? "lateral" : "cenital"}`;
    });
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    // Una resolución CSS 1:1 mantiene texto legible sin multiplicar por cuatro el
    // coste de dibujar 100 ciclistas en pantallas Retina.
    const ratio = 1;
    this.canvas.width = Math.max(1, Math.floor(rect.width * ratio));
    this.canvas.height = Math.max(1, Math.floor(rect.height * ratio));
    this.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    this.ctx.imageSmoothingEnabled = false;
    this.width = rect.width;
    this.height = rect.height;
    this.particles.setDeviceBudget(window.innerWidth <= 900 || window.innerHeight <= 560);
    const profileCanvas = this.hud?.elements.profileCanvas;
    if (profileCanvas) {
      const profileRect = profileCanvas.getBoundingClientRect();
      const profileRatio = 1;
      const profileWidth = Math.max(1, Math.floor(profileRect.width * profileRatio));
      const profileHeight = Math.max(1, Math.floor(profileRect.height * profileRatio));
      if (profileCanvas.width !== profileWidth) profileCanvas.width = profileWidth;
      if (profileCanvas.height !== profileHeight) profileCanvas.height = profileHeight;
      profileCanvas.logicalWidth = profileRect.width;
      profileCanvas.logicalHeight = profileRect.height;
      this.hud.profileCtx.setTransform(profileRatio, 0, 0, profileRatio, 0, 0);
      this.hud.profileCtx.imageSmoothingEnabled = false;
    }
  }

  update(dt) {
    if (this.state !== "RACING") return;
    this.race.update(dt);
    const player = this.race.player;
    this.audio.update(this.race, dt);
    if (this.cameraInspection && performance.now() >= this.cameraInspection.until) this.returnCameraToPlayer();
    let focusTarget = player.distance;
    if (this.cameraInspection?.type === "group") {
      const groupIndex = this.race.groups.findIndex((group) => group.riders.includes(this.cameraInspection.rider));
      const group = this.race.groups[groupIndex];
      if (group) {
        this.cameraInspection.groupIndex = groupIndex;
        focusTarget = group.leader.distance;
      }
      else this.returnCameraToPlayer();
    } else if (this.cameraInspection?.type === "km") {
      focusTarget = this.cameraInspection.km;
    } else if (this.cameraInspection?.type === "rider") {
      focusTarget = this.cameraInspection.rider.distance;
    }
    this.cameraFocusKm = lerp(this.cameraFocusKm, focusTarget, 1 - Math.exp(-dt * 3.2));
    // Un zoom fraccionario reescala el texto del canvas y destruye el píxel nítido.
    const targetZoom = 1;
    this.cameraZoom = lerp(this.cameraZoom, targetZoom, 1 - Math.exp(-dt * 2));
    this.cameraShake = this.reducedMotion ? 0 : Math.max(0, this.cameraShake - dt * 1.5);
    const rainDensity = this.cameraMode === "side" ? 1 : 0.3;
    const accessibleDensity = this.reducedMotion ? 0.18 : 1;
    this.particles.update(dt, this.width, this.height,
      this.race.weather.intensity * rainDensity * accessibleDensity, player.speed);
    if (!this.reducedMotion && this.race.weather.intensity > 0 && Math.random() < dt * 16) {
      this.particles.addSplash(this.width * 0.5, this.height * 0.78, this.race.weather.state === "heavy" ? 4 : 2);
    }
    this.hudAccumulator += dt;
    if (this.hudAccumulator >= 0.1 || player.finished) {
      this.hudAccumulator = 0;
      this.hud.update();
    }
  }

  get cameraKm() {
    return this.race ? this.cameraFocusKm : (performance.now() / 9000) % 60;
  }

  get pixelsPerKm() {
    return clamp(this.height * 1.18, 530, 840);
  }

  get roadHalfWidth() {
    return clamp(this.width * 0.135, 78, 178);
  }

  roadCurveSignal(km) {
    return Math.sin(km * 0.51) * 0.58 + Math.sin(km * 1.23 + 0.8) * 0.21 + Math.sin(km * 0.13 - 1.2) * 0.32;
  }

  roadPointAt(km, lateral = 0) {
    const cameraKm = this.cameraKm;
    const centerSignal = this.roadCurveSignal(cameraKm);
    const curveOffset = (this.roadCurveSignal(km) - centerSignal) * Math.min(this.width * 0.28, 350);
    const y = this.height * 0.72 - (km - cameraKm) * this.pixelsPerKm;
    return {
      x: this.width / 2 + curveOffset + lateral * this.roadHalfWidth * 0.73,
      y,
      roadHalf: this.roadHalfWidth
    };
  }

  roadAngleAt(km) {
    const before = this.roadPointAt(km - 0.012);
    const after = this.roadPointAt(km + 0.012);
    return Math.atan2(after.x - before.x, before.y - after.y);
  }

  renderBackdrop(ctx, weatherIntensity) {
    const road = this.race?.road;
    const elevation = road ? road.elevationAt(this.cameraKm) : 800;
    const highMountain = clamp((elevation - 600) / 900, 0, 1);
    const biome = road?.visualBiomeAt(this.cameraKm) || { id: "green", ground: "#57874f", detail: "#2f693e", accent: "#8dad59" };
    const ground = weatherIntensity > 0.6
      ? lerpColor(biome.ground, "#789397", 0.28)
      : lerpColor(biome.ground, "#929c8c", highMountain * 0.16);
    ctx.fillStyle = ground;
    ctx.fillRect(-30, -30, this.width + 60, this.height + 60);

    // Textura fija y tenue: evita el parpadeo de patrones a gran velocidad.
    const contourShift = 0;
    ctx.fillStyle = weatherIntensity > 0 ? "rgba(220,235,218,.035)" : "rgba(246,236,193,.055)";
    for (let y = -70 + contourShift; y < this.height + 70; y += 58) {
      for (let x = -16; x <= this.width + 16; x += 16) {
        const pixelY = Math.round((y + Math.sin(x * 0.018 + this.cameraKm) * 11) / 4) * 4;
        ctx.fillRect(x, pixelY, 13, 2);
      }
    }
    const tileShift = 0;
    ctx.fillStyle = weatherIntensity > 0.6 ? "rgba(24,45,49,.2)" : biome.detail;
    ctx.globalAlpha = weatherIntensity > 0.6 ? 0.12 : 0.16;
    for (let y = -48 + tileShift; y < this.height + 48; y += 48) {
      for (let x = (y / 48 % 2) * 24; x < this.width; x += 64) {
        ctx.fillRect(x, y, 8, 4);
        ctx.fillRect(x + 5, y - 4, 3, 4);
      }
    }
    ctx.globalAlpha = 1;
    this.renderGroundPixelDetails(ctx, biome, weatherIntensity);
  }

  renderGroundPixelDetails(ctx, biome, weatherIntensity) {
    const palettes = {
      forest: ["#153724", "#286044", "#4b7d4d"],
      green: ["#2e663d", "#6f9c50", "#d4d06a"],
      desert: ["#9f7437", "#d0a350", "#76532e"],
      mountain: ["#48534f", "#78817a", "#aeb0a1"],
      dry: ["#775a31", "#a77c3e", "#55442d"],
      city: ["#59636a", "#7b8588", "#39444b"]
    };
    const colors = palettes[biome.id] || palettes.green;
    const shiftY = 0;
    const shiftX = 0;
    ctx.globalAlpha = weatherIntensity > 0.6 ? 0.25 : 0.38;
    for (let y = -38 + shiftY; y < this.height + 38; y += 38) {
      for (let x = -46 + shiftX + (Math.floor(y / 38) % 2) * 19; x < this.width + 46; x += 46) {
        const hash = Math.abs(Math.sin(x * 13.17 + y * 7.31));
        ctx.fillStyle = colors[Math.floor(hash * 10) % colors.length];
        if (biome.id === "city") {
          ctx.fillRect(x - 10, y, 22, 2);
          ctx.fillRect(x, y - 10, 2, 22);
          if (hash > 0.72) {
            ctx.fillStyle = "#26323a";
            ctx.fillRect(x - 5, y - 5, 10, 10);
            ctx.fillStyle = "#7f898b";
            ctx.fillRect(x - 3, y - 3, 6, 2);
          }
        } else if (biome.id === "desert") {
          ctx.fillRect(x - 6, y, 12, 3);
          ctx.fillRect(x + 4, y - 5, 3, 7);
          if (hash > 0.6) ctx.fillRect(x - 9, y + 7, 5, 4);
        } else if (biome.id === "mountain") {
          ctx.fillRect(x - 7, y - 3, 13, 7);
          ctx.fillStyle = colors[(Math.floor(hash * 10) + 1) % colors.length];
          ctx.fillRect(x - 4, y - 6, 8, 4);
          ctx.fillRect(x + 7, y + 5, 4, 3);
        } else if (biome.id === "dry") {
          ctx.fillRect(x - 8, y, 16, 3);
          ctx.fillRect(x - 2, y - 8, 3, 10);
          ctx.fillRect(x - 7, y - 5, 5, 3);
          ctx.fillRect(x + 1, y - 4, 6, 3);
        } else {
          const forest = biome.id === "forest";
          ctx.fillRect(x - 2, y - (forest ? 10 : 7), 3, forest ? 12 : 9);
          ctx.fillRect(x - 7, y - 6, 6, 3);
          ctx.fillRect(x + 1, y - 8, 7, 3);
          if (!forest && hash > 0.67) {
            ctx.fillStyle = hash > 0.84 ? "#f4e285" : "#f28c8c";
            ctx.fillRect(x + 8, y - 8, 3, 3);
          }
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  roadPolygon(ctx, points, extraWidth = 0) {
    ctx.beginPath();
    points.forEach((point, index) => {
      const x = point.x - point.roadHalf - extraWidth;
      if (index === 0) ctx.moveTo(x, point.y);
      else ctx.lineTo(x, point.y);
    });
    for (let index = points.length - 1; index >= 0; index -= 1) {
      const point = points[index];
      ctx.lineTo(point.x + point.roadHalf + extraWidth, point.y);
    }
    ctx.closePath();
  }

  renderRoad(ctx) {
    const points = [];
    for (let y = -90; y <= this.height + 90; y += 12) {
      const km = this.cameraKm + (this.height * 0.72 - y) / this.pixelsPerKm;
      points.push(this.roadPointAt(km));
    }
    const wet = this.race?.weather.intensity || 0;

    this.roadPolygon(ctx, points, 13);
    ctx.fillStyle = "#d6cfb7";
    ctx.fill();
    this.roadPolygon(ctx, points, 4);
    ctx.fillStyle = wet > 0.65 ? "#424b50" : wet > 0 ? "#4b5356" : "#62676a";
    ctx.fill();

    this.roadPolygon(ctx, points, -18);
    ctx.fillStyle = `rgba(195,220,221,${wet * 0.09})`;
    ctx.fill();
    this.renderRoadTexture(ctx, wet);

    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(250,247,226,.88)";
    for (const side of [-1, 1]) {
      ctx.beginPath();
      points.forEach((point, index) => {
        const x = point.x + side * (point.roadHalf - 7);
        if (index === 0) ctx.moveTo(x, point.y);
        else ctx.lineTo(x, point.y);
      });
      ctx.stroke();
    }

    ctx.setLineDash([19, 21]);
    ctx.lineDashOffset = (this.cameraKm * this.pixelsPerKm) % 40;
    ctx.strokeStyle = "rgba(250,248,230,.56)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    points.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y));
    ctx.stroke();
    ctx.setLineDash([]);

    this.renderRoadside(ctx);
    this.renderRacePointGates(ctx);
    this.renderFinishLine(ctx);
  }

  renderRacePointGates(ctx) {
    if (!this.race) return;
    const structureScale = this.raceStructureScale();
    for (const racePoint of this.race.road.racePoints) {
      const point = this.roadPointAt(racePoint.km);
      if (point.y < -90 || point.y > this.height + 90) continue;
      const color = racePointColor(racePoint);
      const label = racePoint.markerLabel || (racePoint.type === "sprint" ? "SPR" : racePoint.category);
      const sprintGate = racePoint.type === "sprint";
      // El centro de cada poste queda justo fuera del asfalto: con sus cinco
      // píxeles de semiancho, la cara interior coincide con el borde real.
      const halfWidth = sprintGate ? Math.max(64, point.roadHalf + 9) : Math.max(42, point.roadHalf - 7);
      const gateHeight = Math.round((sprintGate ? TOP_SPRINT_GATE_HEIGHT : 57) * structureScale);
      const bannerHeight = Math.round((sprintGate ? 29 : 23) * Math.max(0.72, structureScale));
      ctx.save();
      ctx.translate(Math.round(point.x), Math.round(point.y));
      ctx.rotate(this.roadAngleAt(racePoint.km));
      // Línea puntuable sobre el asfalto.
      for (let x = -halfWidth; x < halfWidth; x += 12) {
        ctx.fillStyle = Math.floor((x + halfWidth) / 12) % 2 ? "#101820" : "#f4f1e9";
        ctx.fillRect(Math.round(x), -3, 12, 6);
      }
      // Arco pixel-art y cartel con categoría/puntos máximos.
      ctx.fillStyle = "#101820";
      ctx.fillRect(-halfWidth - 5, -gateHeight, 10, gateHeight + 1);
      ctx.fillRect(halfWidth - 5, -gateHeight, 10, gateHeight + 1);
      ctx.fillRect(-halfWidth - 8, -gateHeight - 4, halfWidth * 2 + 16, bannerHeight);
      ctx.fillStyle = color;
      ctx.fillRect(-halfWidth - 3, -gateHeight, halfWidth * 2 + 6, bannerHeight - 8);
      ctx.fillStyle = racePoint.type === "mountain" && racePoint.category === "4ª" ? "#101820" : "#fff7da";
      ctx.font = `bold ${Math.max(8, Math.round((sprintGate ? 11 : 9) * structureScale))}px Menlo, Monaco, Consolas, monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`${label} · ${racePoint.maxPoints} PT`, 0, -gateHeight + (bannerHeight - 8) / 2);
      ctx.restore();
    }
  }

  renderRoadTexture(ctx, wet) {
    for (let y = -30; y < this.height + 40; y += 27) {
      const km = this.cameraKm + (this.height * 0.72 - y) / this.pixelsPerKm;
      const point = this.roadPointAt(km);
      const hash = Math.sin(Math.floor(km * 1000) * 19.17);
      const x = point.x + hash * point.roadHalf * 0.68;
      ctx.fillStyle = wet > 0.3 ? "rgba(196,218,222,.18)" : "rgba(30,35,38,.2)";
      ctx.fillRect(Math.round(x - 6), Math.round(y), 12, 2);
      ctx.fillRect(Math.round(x + 3), Math.round(y - 4), 3, 4);
      ctx.fillStyle = "#b9b197";
      ctx.fillRect(Math.round(point.x - point.roadHalf - 10), Math.round(y + 4), 4, 3);
      ctx.fillRect(Math.round(point.x + point.roadHalf + 6), Math.round(y - 5), 5, 3);
    }
  }

  renderRoadside(ctx) {
    const visibleKm = this.height / this.pixelsPerKm;
    const spacing = 0.052;
    const first = Math.floor((this.cameraKm - visibleKm * 0.45) / spacing);
    const last = Math.ceil((this.cameraKm + visibleKm) / spacing);
    for (let marker = first; marker <= last; marker += 1) {
      const km = marker * spacing;
      if (km < 0 || (this.race && km > this.race.road.lengthKm)) continue;
      const side = marker % 2 ? -1 : 1;
      const wobble = Math.sin(marker * 12.9898) * 0.5 + 0.5;
      const point = this.roadPointAt(km);
      const x = point.x + side * (point.roadHalf + 27 + wobble * 35);
      const size = 9 + wobble * 8;
      const biome = this.race?.road.biomeAt(km) || { id: "green", detail: "#285b3c", accent: "#6f9a55" };
      this.drawSceneryObject(ctx, biome, x, point.y, size, marker);
      if (biome.id === "forest" || biome.id === "green") {
        const farSide = -side;
        const farX = point.x + farSide * (point.roadHalf + 50 + (1 - wobble) * 48);
        this.drawSceneryObject(ctx, biome, farX, point.y + 3, size * (biome.id === "forest" ? 0.9 : 0.68), marker + 101);
      }
    }
    this.renderRoadFurniture(ctx);
    this.renderSpectators(ctx);
  }

  renderRoadFurniture(ctx) {
    if (!this.race) return;
    const visibleKm = this.height / this.pixelsPerKm;
    const spacing = 0.16;
    const first = Math.floor((this.cameraKm - visibleKm * 0.45) / spacing);
    const last = Math.ceil((this.cameraKm + visibleKm) / spacing);
    for (let marker = first; marker <= last; marker += 1) {
      const km = marker * spacing;
      if (km < 0 || km > this.race.road.lengthKm) continue;
      const point = this.roadPointAt(km);
      const biome = this.race.road.biomeAt(km);
      for (const side of [-1, 1]) {
        const x = Math.round(point.x + side * (point.roadHalf + 11));
        const y = Math.round(point.y);
        ctx.fillStyle = "#f0eee3";
        ctx.fillRect(x - 3, y - 13, 6, 14);
        ctx.fillStyle = "#202a30";
        ctx.fillRect(x - 3, y - 9, 6, 4);
        ctx.fillStyle = "#9a342f";
        ctx.fillRect(x - 2, y - 8, 4, 2);
        if ((biome.id === "mountain" || biome.id === "city") && marker % 3 !== 0) {
          ctx.fillStyle = "#758086";
          ctx.fillRect(x + side * 2, y - 5, side * 25, 3);
          ctx.fillStyle = "#c5cccd";
          ctx.fillRect(x + side * 2, y - 6, side * 25, 2);
        }
      }
      if (marker % 9 === 0) {
        const side = marker % 2 ? -1 : 1;
        const x = Math.round(point.x + side * (point.roadHalf + 34));
        ctx.fillStyle = "#202a30";
        ctx.fillRect(x - 2, point.y - 38, 4, 38);
        ctx.fillStyle = "#f4f1e9";
        ctx.fillRect(x - 15, point.y - 43, 30, 15);
        ctx.fillStyle = biome.accent;
        ctx.fillRect(x - 12, point.y - 40, 24, 4);
        ctx.fillStyle = "#16212a";
        ctx.font = "bold 7px Menlo, Monaco, Consolas, monospace";
        ctx.textAlign = "center";
        ctx.fillText(`${Math.max(0, Math.round(this.race.road.lengthKm - km))} KM`, x, point.y - 31);
      }
    }
  }

  drawSceneryObject(ctx, biome, x, y, size, marker) {
    const block = Math.max(3, Math.round(size / 4));
    x = Math.round(x);
    y = Math.round(y);
    if (biome.id === "city") {
      const height = Math.round(size * (1.8 + marker % 3 * 0.35));
      ctx.fillStyle = "#2d3942";
      ctx.fillRect(x - size, y - height, size * 2, height);
      ctx.fillStyle = marker % 2 ? "#87939a" : "#a46d58";
      ctx.fillRect(x - size + 3, y - height + 3, size * 2 - 6, height - 3);
      // Reflejo frío de luz diurna: no simula ventanas encendidas.
      ctx.fillStyle = "#c4e0e5";
      for (let row = y - height + 7; row < y - 6; row += 8) {
        ctx.fillRect(x - size + 6, row, 4, 4);
        ctx.fillRect(x + 2, row, 4, 4);
      }
    } else if (biome.id === "desert") {
      ctx.fillStyle = "#6f733b";
      ctx.fillRect(x - 2, y - size, 5, size);
      ctx.fillRect(x - 7, y - size * 0.65, 6, 4);
      ctx.fillRect(x - 7, y - size * 0.65, 3, 9);
      ctx.fillRect(x + 2, y - size * 0.45, 7, 4);
      ctx.fillRect(x + 6, y - size * 0.7, 3, 8);
      ctx.fillStyle = biome.accent;
      ctx.fillRect(x - size, y + 2, size * 2, 3);
    } else if (biome.id === "mountain") {
      ctx.fillStyle = "#35443f";
      ctx.fillRect(x - size, y - size * 0.45, size * 2, size * 0.55);
      ctx.fillStyle = "#8e9687";
      ctx.fillRect(x - size * 0.65, y - size, size, size * 0.7);
      ctx.fillStyle = "#bec2af";
      ctx.fillRect(x - size * 0.45, y - size * 0.85, block * 2, block);
    } else if (biome.id === "dry") {
      ctx.fillStyle = "#57452c";
      ctx.fillRect(x - block, y - size * 0.4, block * 2, size * 0.45);
      ctx.fillStyle = biome.accent;
      ctx.fillRect(x - size, y - size * 0.3, size * 2, block * 2);
      ctx.fillRect(x - size * 0.55, y - size * 0.65, block * 2, size * 0.5);
    } else {
      const forest = biome.id === "forest";
      ctx.fillStyle = "rgba(13,35,25,.24)";
      ctx.fillRect(x - size * 0.7 + 5, y + size * 0.45, size * 1.7, block * 2);
      ctx.fillStyle = forest ? "#102b20" : "#183b2a";
      ctx.fillRect(x - block, y, block * 2, size * 1.1);
      ctx.fillStyle = forest ? "#1d4b31" : biome.detail;
      ctx.fillRect(x - size * 0.8, y - size * 0.65, size * 1.6, size * 1.15);
      ctx.fillRect(x - size, y - size * 0.25, size * 2, size * 0.55);
      ctx.fillStyle = forest ? "#286441" : lerpColor(biome.detail, "#ffffff", 0.14);
      ctx.fillRect(x - size * 0.7, y - size * 0.76, size * 0.85, block * 2);
      ctx.fillRect(x + size * 0.05, y - size * 0.42, size * 0.72, block * 2);
      ctx.fillStyle = biome.accent;
      ctx.fillRect(x - size * 0.55, y - size * 0.5, block * 2, block);
      if (!forest) ctx.fillRect(x + size * 0.15, y - size * 0.15, block, block);
    }
  }

  renderSpectators(ctx) {
    if (!this.race) return;
    const visibleKm = this.height / this.pixelsPerKm;
    const spacing = 0.018;
    const first = Math.floor((this.cameraKm - visibleKm * 0.5) / spacing);
    const last = Math.ceil((this.cameraKm + visibleKm) / spacing);
    const colors = ["#ffcc33", "#ef476f", "#62d8f2", "#f4f1e9", "#9b5de5", "#2fbf71"];
    for (let marker = first; marker <= last; marker += 1) {
      const km = marker * spacing;
      if (km < 0 || km > this.race.road.lengthKm) continue;
      const density = this.race.road.spectatorDensityAt(km);
      if (!density || Math.abs((marker * 7) % 10) / 10 > density) continue;
      const point = this.roadPointAt(km);
      const sides = density > 0.7 && marker % 3 === 0 ? [-1, 1] : [marker % 2 ? -1 : 1];
      for (const side of sides) {
        const crowdRows = density > 0.82 ? [1, 0] : [0];
        for (const row of crowdRows) {
          const x = Math.round(point.x + side * (point.roadHalf + 13 + Math.abs(marker % 3) * 6 + row * 10));
          const y = Math.round(point.y - row * 5);
          const wave = Math.floor(this.race.elapsed * 6 + marker + side + row) % 2;
          ctx.fillStyle = "#d59a70";
          ctx.fillRect(x - 2, y - 13, 5, 5);
          ctx.fillStyle = colors[Math.abs(marker + side + row) % colors.length];
          ctx.fillRect(x - 3, y - 8, 7, 8);
          ctx.fillStyle = "#17212a";
          ctx.fillRect(x - 3, y, 3, 6);
          ctx.fillRect(x + 2, y, 3, 6);
          ctx.fillStyle = "#d59a70";
          ctx.fillRect(x - 6, y - 8 - wave * 4, 4, 3);
          ctx.fillRect(x + 4, y - 12 + wave * 4, 4, 3);
          if (marker % 13 === 0 && row === 0) {
            ctx.fillStyle = "#f4f1e9";
            ctx.fillRect(x - 10, y - 22, 20, 6);
            ctx.fillStyle = colors[Math.abs(marker) % colors.length];
            ctx.fillRect(x - 7, y - 20, 14, 2);
          }
        }
      }
    }
  }

  renderFinishLine(ctx) {
    const finishKm = this.race?.road.lengthKm || 60;
    const point = this.roadPointAt(finishKm);
    if (point.y < -50 || point.y > this.height + 50) return;
    ctx.save();
    ctx.translate(point.x, point.y);
    ctx.rotate(this.roadAngleAt(finishKm));
    const cell = 10;
    for (let row = 0; row < 2; row += 1) {
      for (let column = -Math.ceil(this.roadHalfWidth / cell); column < Math.ceil(this.roadHalfWidth / cell); column += 1) {
        ctx.fillStyle = (column + row) % 2 ? "#f8f5eb" : "#101820";
        ctx.fillRect(column * cell, row * cell - cell, cell, cell);
      }
    }
    const halfWidth = this.roadHalfWidth + 24;
    const structureScale = this.raceStructureScale();
    const gateHeight = Math.round(108 * structureScale);
    const bannerHeight = Math.round(33 * Math.max(0.72, structureScale));
    ctx.fillStyle = "#101820";
    ctx.fillRect(-halfWidth - 7, -gateHeight, 12, gateHeight);
    ctx.fillRect(halfWidth - 5, -gateHeight, 12, gateHeight);
    ctx.fillRect(-halfWidth - 10, -gateHeight - 5, halfWidth * 2 + 20, bannerHeight);
    ctx.fillStyle = "#ffcc33";
    ctx.fillRect(-halfWidth - 5, -gateHeight, halfWidth * 2 + 10, Math.max(16, bannerHeight - 9));
    ctx.fillStyle = "#101820";
    ctx.font = `bold ${Math.max(9, Math.round(15 * structureScale))}px Menlo, Monaco, Consolas, monospace`;
    ctx.textAlign = "center";
    ctx.fillText("META", 0, -gateHeight + Math.max(13, bannerHeight * 0.68));
    ctx.restore();
  }

  renderDraftZone(ctx, x, y, angle) {
    if (!this.race || this.race.player.draft < 8) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    const gradient = ctx.createLinearGradient(0, 8, 0, 88);
    gradient.addColorStop(0, "rgba(98,216,242,.34)");
    gradient.addColorStop(1, "rgba(98,216,242,0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(-7, 7);
    ctx.lineTo(7, 7);
    ctx.lineTo(25, 88);
    ctx.lineTo(-25, 88);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  riderPose(rider) {
    if (rider.victory) return "victory";
    if (rider.crashTimer > 0) return "crash";
    if (rider.sprinting || rider.attacking > 0) return "standing";
    if (rider.energy < 22 || rider.fatigue > 70) return "fatigue";
    return "normal";
  }

  roleAccent(role) {
    return {
      leader: "#ffe45e",
      sprinter: "#62d8f2",
      climber: "#ff7158",
      attacker: "#ff9f1c",
      domestique: "#f4f1e9"
    }[role] || "#f4f1e9";
  }

  ambientRaceVehicles() {
    return (this.race?.raceVehicles || []).filter((vehicle) => vehicle.active);
  }

  buildRaceVehicleSprite(type, color) {
    const key = `race-vehicle-top-${type}-${color}`;
    if (this.spriteCache.has(key)) return this.spriteCache.get(key);
    const motorcycle = type === "tv";
    const sprite = document.createElement("canvas");
    sprite.width = motorcycle ? 40 : 52;
    sprite.height = motorcycle ? 78 : 94;
    const pixel = sprite.getContext("2d");
    pixel.imageSmoothingEnabled = false;
    const outline = "#070c12";
    if (motorcycle) {
      pixel.fillStyle = "rgba(7,12,18,.24)";
      pixel.fillRect(8, 7, 25, 67);
      pixel.fillStyle = outline;
      pixel.fillRect(15, 1, 10, 18);
      pixel.fillRect(15, 61, 10, 16);
      pixel.fillStyle = "#56636a";
      pixel.fillRect(18, 3, 4, 14);
      pixel.fillRect(18, 63, 4, 12);
      pixel.fillStyle = "#c99920";
      pixel.fillRect(11, 16, 18, 47);
      pixel.fillStyle = color;
      pixel.fillRect(14, 18, 12, 41);
      pixel.fillStyle = outline;
      pixel.fillRect(7, 22, 26, 7);
      pixel.fillRect(9, 45, 22, 8);
      pixel.fillStyle = "#ffcc33";
      pixel.fillRect(11, 25, 18, 17);
      pixel.fillStyle = "#17212a";
      pixel.fillRect(12, 27, 16, 13);
      pixel.fillStyle = "#d59a70";
      pixel.fillRect(14, 30, 12, 9);
      pixel.fillStyle = "#8b59a4";
      pixel.fillRect(10, 48, 20, 11);
      pixel.fillStyle = "#101820";
      pixel.fillRect(12, 50, 16, 8);
      pixel.fillStyle = "#62d8f2";
      pixel.fillRect(2, 49, 8, 12);
      pixel.fillStyle = outline;
      pixel.fillRect(0, 47, 12, 16);
      pixel.fillStyle = "#62d8f2";
      pixel.fillRect(3, 50, 6, 9);
      pixel.fillStyle = "#101820";
      pixel.fillRect(1, 39, 13, 6);
    } else {
      pixel.fillStyle = "rgba(7,12,18,.25)";
      pixel.fillRect(4, 4, 44, 87);
      pixel.fillStyle = outline;
      pixel.fillRect(5, 1, 42, 92);
      pixel.fillRect(0, 14, 7, 18);
      pixel.fillRect(45, 14, 7, 18);
      pixel.fillRect(0, 64, 7, 18);
      pixel.fillRect(45, 64, 7, 18);
      pixel.fillStyle = color;
      pixel.fillRect(8, 4, 36, 86);
      pixel.fillStyle = lerpColor(color, "#ffffff", 0.2);
      pixel.fillRect(11, 7, 30, 13);
      pixel.fillStyle = "#75d3e4";
      pixel.fillRect(10, 23, 32, 17);
      pixel.fillRect(10, 69, 32, 13);
      pixel.fillStyle = "#17212a";
      pixel.fillRect(10, 43, 32, 23);
      pixel.fillStyle = "#05090e";
      pixel.fillRect(8, 44, 36, 4);
      pixel.fillRect(8, 61, 36, 4);
      for (let bike = 0; bike < 4; bike += 1) {
        const y = 47 + bike * 5;
        pixel.fillStyle = bike % 2 ? "#f4f1e9" : "#ffcc33";
        pixel.fillRect(12, y, 27, 2);
        pixel.fillRect(15 + bike % 2 * 14, y - 2, 3, 6);
        pixel.fillStyle = "#070c12";
        pixel.fillRect(9, y - 1, 5, 4);
        pixel.fillRect(39, y - 1, 5, 4);
      }
      if (type === "broom") {
        for (let cell = 0; cell < 4; cell += 1) {
          pixel.fillStyle = cell % 2 ? "#101820" : "#f4f1e9";
          pixel.fillRect(12 + cell * 7, 84, 7, 5);
        }
      }
    }
    this.spriteCache.set(key, sprite);
    return sprite;
  }

  buildSideRaceVehicleSprite(type, color) {
    const key = `race-vehicle-side-${type}-${color}`;
    if (this.spriteCache.has(key)) return this.spriteCache.get(key);
    const motorcycle = type === "tv";
    const sprite = document.createElement("canvas");
    sprite.width = motorcycle ? 92 : 116;
    sprite.height = motorcycle ? 66 : 84;
    const pixel = sprite.getContext("2d");
    pixel.imageSmoothingEnabled = false;
    const outline = "#070c12";
    if (motorcycle) {
      pixel.fillStyle = "rgba(7,12,18,.25)";
      pixel.fillRect(4, 59, 82, 5);
      for (const wheelX of [21, 70]) {
        pixel.fillStyle = outline;
        pixel.beginPath();
        pixel.arc(wheelX, 50, 14, 0, Math.PI * 2);
        pixel.fill();
        pixel.fillStyle = "#718087";
        pixel.beginPath();
        pixel.arc(wheelX, 50, 9, 0, Math.PI * 2);
        pixel.fill();
        pixel.fillStyle = "#1d2b34";
        pixel.beginPath();
        pixel.arc(wheelX, 50, 6, 0, Math.PI * 2);
        pixel.fill();
      }
      pixel.strokeStyle = outline;
      pixel.lineWidth = 8;
      pixel.beginPath();
      pixel.moveTo(21, 50);
      pixel.lineTo(43, 33);
      pixel.lineTo(70, 50);
      pixel.lineTo(49, 48);
      pixel.closePath();
      pixel.stroke();
      pixel.strokeStyle = color;
      pixel.lineWidth = 4;
      pixel.stroke();
      pixel.fillStyle = outline;
      pixel.fillRect(38, 27, 30, 16);
      pixel.fillStyle = "#ffcc33";
      pixel.fillRect(41, 30, 23, 10);
      pixel.fillStyle = "#62d8f2";
      pixel.fillRect(8, 27, 20, 15);
      pixel.fillStyle = outline;
      pixel.fillRect(5, 24, 26, 21);
      pixel.fillStyle = "#62d8f2";
      pixel.fillRect(9, 28, 18, 12);
      for (const person of [{ x: 48, color: "#ffcc33" }, { x: 30, color: "#8b59a4" }]) {
        pixel.fillStyle = outline;
        pixel.fillRect(person.x - 7, 4, 17, 18);
        pixel.fillStyle = "#d59a70";
        pixel.fillRect(person.x - 4, 9, 12, 11);
        pixel.fillStyle = person.color;
        pixel.fillRect(person.x - 8, 3, 19, 7);
        pixel.fillRect(person.x - 8, 21, 18, 14);
      }
      pixel.fillStyle = outline;
      pixel.fillRect(18, 5, 20, 11);
      pixel.fillRect(12, 8, 10, 7);
      pixel.fillStyle = "#62d8f2";
      pixel.fillRect(14, 10, 6, 4);
    } else {
      pixel.fillStyle = "rgba(7,12,18,.26)";
      pixel.fillRect(4, 76, 108, 6);
      pixel.fillStyle = outline;
      pixel.fillRect(4, 45, 108, 30);
      pixel.fillRect(19, 29, 69, 21);
      pixel.fillStyle = color;
      pixel.fillRect(8, 48, 100, 23);
      pixel.fillRect(23, 33, 61, 18);
      pixel.fillStyle = lerpColor(color, "#ffffff", 0.16);
      pixel.fillRect(10, 49, 96, 5);
      pixel.fillStyle = "#75d3e4";
      pixel.fillRect(27, 35, 23, 13);
      pixel.fillRect(54, 35, 25, 13);
      pixel.fillStyle = outline;
      pixel.fillRect(51, 34, 4, 17);
      for (const wheelX of [25, 91]) {
        pixel.fillStyle = outline;
        pixel.beginPath();
        pixel.arc(wheelX, 70, 12, 0, Math.PI * 2);
        pixel.fill();
        pixel.fillStyle = "#78868c";
        pixel.beginPath();
        pixel.arc(wheelX, 70, 7, 0, Math.PI * 2);
        pixel.fill();
      }
      pixel.fillStyle = outline;
      pixel.fillRect(17, 25, 76, 5);
      for (let bike = 0; bike < 4; bike += 1) {
        const offset = 16 + bike * 23;
        pixel.strokeStyle = bike % 2 ? "#f4f1e9" : "#ffcc33";
        pixel.lineWidth = 3;
        for (const wheelX of [offset, offset + 14]) {
          pixel.beginPath();
          pixel.arc(wheelX, 15, 8, 0, Math.PI * 2);
          pixel.stroke();
        }
        pixel.beginPath();
        pixel.moveTo(offset, 15);
        pixel.lineTo(offset + 6, 6);
        pixel.lineTo(offset + 9, 15);
        pixel.lineTo(offset, 15);
        pixel.moveTo(offset + 9, 15);
        pixel.lineTo(offset + 14, 15);
        pixel.lineTo(offset + 10, 5);
        pixel.lineTo(offset + 6, 6);
        pixel.stroke();
      }
      if (type === "broom") {
        for (let cell = 0; cell < 6; cell += 1) {
          pixel.fillStyle = cell % 2 ? "#101820" : "#f4f1e9";
          pixel.fillRect(58 + cell * 7, 57, 7, 6);
        }
      }
    }
    this.spriteCache.set(key, sprite);
    return sprite;
  }

  renderRaceVehicles(ctx) {
    const vehicles = this.ambientRaceVehicles()
      .map((vehicle) => ({ ...vehicle, point: this.roadPointAt(vehicle.distance, vehicle.lateral) }))
      .filter((vehicle) => vehicle.point.y > -110 && vehicle.point.y < this.height + 110)
      .sort((a, b) => a.point.y - b.point.y);
    vehicles.forEach((vehicle) => this.drawRaceVehicle(ctx, vehicle, vehicle.point));
  }

  drawRaceVehicle(ctx, vehicle, point) {
    const originalScale = clamp(this.roadHalfWidth / 135, 0.8, 1.24);
    const sprite = this.buildRaceVehicleSprite(vehicle.type, vehicle.color);
    const mobile = this.raceStructureScale() < 1;
    const scale = originalScale * (vehicle.type === "tv"
      ? mobile ? 0.48 : 0.72
      : mobile ? 0.64 : 0.9);
    if (this.race.weather.intensity > 0.25) {
      ctx.fillStyle = "rgba(205,230,234,.35)";
      ctx.fillRect(point.x - 12 * scale, point.y + 35 * scale, 24 * scale, 4 * scale);
      ctx.fillRect(point.x - 7 * scale, point.y + 43 * scale, 14 * scale, 3 * scale);
    }
    ctx.save();
    ctx.translate(Math.round(point.x), Math.round(point.y));
    ctx.rotate(this.roadAngleAt(vehicle.distance));
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
      sprite,
      -sprite.width * scale / 2,
      -sprite.height * scale / 2,
      sprite.width * scale,
      sprite.height * scale
    );
    ctx.restore();
  }

  renderLateralRaceVehicles(ctx, focusX, pixelsPerKm) {
    const vehicles = this.ambientRaceVehicles()
      .map((vehicle) => ({
        ...vehicle,
        x: focusX + (vehicle.distance - this.cameraKm) * pixelsPerKm,
        y: this.sideSurfaceY(vehicle.distance) + this.sideLaneOffset(vehicle.lateral)
      }))
      .filter((vehicle) => vehicle.x > -140 && vehicle.x < this.width + 140);
    vehicles.forEach((vehicle) => this.drawLateralRaceVehicle(ctx, vehicle, pixelsPerKm));
  }

  drawLateralRaceVehicle(ctx, vehicle, pixelsPerKm) {
    const sprite = this.buildSideRaceVehicleSprite(vehicle.type, vehicle.color);
    // Ciclistas y vehículos deben responder al mismo ancho de viewport. Antes
    // solo se reducían los ciclistas en móvil y los coches parecían gigantes.
    const viewportScale = this.lateralRiderViewportScale();
    const scale = (vehicle.type === "tv" ? 0.62 : 0.78) * viewportScale;
    const bob = this.reducedMotion ? 0 : Math.floor(this.race.elapsed * 8 + vehicle.distance * 10) % 2;
    if (this.race.weather.intensity > 0.25) {
      ctx.fillStyle = "rgba(205,230,234,.34)";
      ctx.fillRect(vehicle.x - sprite.width * scale / 2 - 18, vehicle.y - 3, 24, 4);
      ctx.fillRect(vehicle.x - sprite.width * scale / 2 - 28, vehicle.y + 3, 17, 3);
    }
    ctx.save();
    ctx.translate(Math.round(vehicle.x), Math.round(vehicle.y + bob));
    ctx.rotate(this.sideRoadAngleAt(vehicle.distance, pixelsPerKm));
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
      sprite,
      -sprite.width * scale / 2,
      -sprite.height * scale + 4,
      sprite.width * scale,
      sprite.height * scale
    );
    ctx.restore();
  }

  lateralRiderViewportScale(viewportWidth = window.innerWidth) {
    return renderRules.lateralViewportScale(viewportWidth);
  }

  raceStructureScale(viewportWidth = this.width || globalThis.window?.innerWidth || 1280) {
    return renderRules.raceStructureScale(viewportWidth);
  }

  buildCyclistSprite(color, isPlayer, frame, role = "domestique", pose = "normal", jerseyType = "") {
    const key = `${color}-${isPlayer}-${frame}-${role}-${pose}-${jerseyType}`;
    if (this.spriteCache.has(key)) return this.spriteCache.get(key);
    const sprite = document.createElement("canvas");
    sprite.width = 42;
    sprite.height = 60;
    const pixel = sprite.getContext("2d");
    pixel.imageSmoothingEnabled = false;
    const outline = "#10151d";
    const tire = "#080b10";
    const metal = "#cad3d4";
    const skin = "#d79869";
    const shadow = lerpColor(color, "#10151d", 0.58);
    const highlight = lerpColor(color, "#ffffff", 0.38);
    const phase = frame / 8 * Math.PI * 2;
    const leftFoot = { x: Math.round(21 + Math.cos(phase) * 7), y: Math.round(42 + Math.sin(phase) * 4) };
    const rightFoot = { x: Math.round(21 - Math.cos(phase) * 7), y: Math.round(42 - Math.sin(phase) * 4) };
    const leftKnee = { x: Math.round((16 + leftFoot.x) / 2 - 3), y: Math.round(36 + Math.sin(phase - 0.55) * 2) };
    const rightKnee = { x: Math.round((25 + rightFoot.x) / 2 + 3), y: Math.round(36 - Math.sin(phase - 0.55) * 2) };

    // Sombra pixelada.
    pixel.fillStyle = "rgba(7,12,18,.28)";
    pixel.fillRect(12, 8, 17, 46);
    pixel.fillRect(9, 17, 23, 29);

    // Ruedas vistas desde arriba, con flancos y bujes.
    pixel.fillStyle = tire;
    pixel.fillRect(17, 2, 8, 15);
    pixel.fillRect(17, 43, 8, 15);
    pixel.fillStyle = "#39434a";
    pixel.fillRect(19, 3, 4, 13);
    pixel.fillRect(19, 44, 4, 13);
    pixel.fillStyle = metal;
    pixel.fillRect(20, 7, 2, 6);
    pixel.fillRect(20, 48, 2, 6);

    // Cuadro completo de la bicicleta.
    pixel.strokeStyle = outline;
    pixel.lineWidth = 5;
    pixel.beginPath();
    pixel.moveTo(21, 12);
    pixel.lineTo(13, 39);
    pixel.lineTo(22, 47);
    pixel.lineTo(29, 37);
    pixel.closePath();
    pixel.stroke();
    pixel.strokeStyle = isPlayer ? "#f7c813" : color;
    pixel.lineWidth = 3;
    pixel.beginPath();
    pixel.moveTo(21, 12);
    pixel.lineTo(13, 39);
    pixel.lineTo(22, 47);
    pixel.lineTo(29, 37);
    pixel.closePath();
    pixel.moveTo(13, 39);
    pixel.lineTo(29, 37);
    pixel.stroke();
    pixel.fillStyle = metal;
    pixel.fillRect(19, 37, 5, 5);

    // Pedaleo circular de ocho fases: muslo, rodilla, pantorrilla y pie.
    pixel.strokeStyle = outline;
    pixel.lineWidth = 7;
    pixel.beginPath();
    pixel.moveTo(16, 33);
    pixel.lineTo(leftKnee.x, leftKnee.y);
    pixel.moveTo(25, 33);
    pixel.lineTo(rightKnee.x, rightKnee.y);
    pixel.stroke();
    pixel.strokeStyle = "#29333b";
    pixel.lineWidth = 4;
    pixel.beginPath();
    pixel.moveTo(16, 33);
    pixel.lineTo(leftKnee.x, leftKnee.y);
    pixel.moveTo(25, 33);
    pixel.lineTo(rightKnee.x, rightKnee.y);
    pixel.stroke();
    pixel.strokeStyle = outline;
    pixel.lineWidth = 6;
    pixel.beginPath();
    pixel.moveTo(leftKnee.x, leftKnee.y);
    pixel.lineTo(leftFoot.x, leftFoot.y);
    pixel.moveTo(rightKnee.x, rightKnee.y);
    pixel.lineTo(rightFoot.x, rightFoot.y);
    pixel.stroke();
    pixel.strokeStyle = skin;
    pixel.lineWidth = 3;
    pixel.beginPath();
    pixel.moveTo(leftKnee.x, leftKnee.y);
    pixel.lineTo(leftFoot.x, leftFoot.y);
    pixel.moveTo(rightKnee.x, rightKnee.y);
    pixel.lineTo(rightFoot.x, rightFoot.y);
    pixel.stroke();
    pixel.fillStyle = outline;
    pixel.fillRect(leftFoot.x - 3, leftFoot.y - 1, 7, 3);
    pixel.fillRect(rightFoot.x - 3, rightFoot.y - 1, 7, 3);

    // Fuera del sillín el cuerpo se desplaza hacia atrás respecto a la bici.
    // En vista cenital este cambio, junto al balanceo, distingue el ataque.
    pixel.save();
    if (pose === "standing") pixel.translate(0, 5);
    else if (pose === "fatigue") pixel.translate(0, 3);

    // Torso grande y sombreado, inspirado en sprites arcade de 16 bits.
    pixel.fillStyle = outline;
    pixel.beginPath();
    pixel.moveTo(9, 20);
    pixel.lineTo(15, 15);
    pixel.lineTo(27, 15);
    pixel.lineTo(33, 20);
    pixel.lineTo(29, 36);
    pixel.lineTo(13, 36);
    pixel.closePath();
    pixel.fill();
    pixel.fillStyle = color;
    pixel.fillRect(12, 20, 18, 12);
    pixel.fillRect(15, 17, 12, 18);
    pixel.fillStyle = shadow;
    pixel.fillRect(12, 28, 18, 5);
    pixel.fillRect(26, 20, 4, 8);
    pixel.fillStyle = highlight;
    pixel.fillRect(14, 19, 4, 9);
    pixel.fillStyle = isPlayer ? "#fff3ad" : "#f4f1e9";
    pixel.fillRect(12, 24, 18, 3);
    pixel.fillStyle = outline;
    pixel.fillRect(19, 22, 5, 6);
    pixel.fillStyle = "#f4f1e9";
    pixel.fillRect(20, 23, 3, 4);

    // Brazos, guantes y manillar.
    pixel.strokeStyle = outline;
    pixel.lineWidth = 6;
    pixel.beginPath();
    pixel.moveTo(12, 21);
    pixel.lineTo(7, 14);
    pixel.lineTo(10, 10);
    pixel.moveTo(30, 21);
    pixel.lineTo(35, 14);
    pixel.lineTo(32, 10);
    pixel.stroke();
    pixel.strokeStyle = skin;
    pixel.lineWidth = 3;
    pixel.beginPath();
    pixel.moveTo(12, 21);
    pixel.lineTo(7, 14);
    pixel.moveTo(30, 21);
    pixel.lineTo(35, 14);
    pixel.stroke();
    pixel.fillStyle = outline;
    pixel.fillRect(7, 9, 6, 5);
    pixel.fillRect(29, 9, 6, 5);
    pixel.fillRect(7, 9, 28, 3);
    pixel.fillStyle = metal;
    pixel.fillRect(12, 10, 18, 1);

    // Cabeza, rostro, gafas y casco con brillo.
    pixel.fillStyle = outline;
    pixel.fillRect(14, 5, 15, 14);
    pixel.fillStyle = skin;
    pixel.fillRect(16, 8, 11, 10);
    pixel.fillStyle = "#77462f";
    pixel.fillRect(16, 15, 11, 3);
    pixel.fillStyle = isPlayer ? "#ffcc33" : shadow;
    pixel.fillRect(13, 4, 17, 7);
    pixel.fillRect(16, 2, 11, 3);
    pixel.fillStyle = highlight;
    pixel.fillRect(16, 4, 7, 2);
    pixel.fillStyle = "#6fd9f1";
    pixel.fillRect(15, 10, 13, 3);
    pixel.fillStyle = "#14212c";
    pixel.fillRect(17, 11, 3, 2);
    pixel.fillRect(24, 11, 3, 2);

    // Marca de rol: visible incluso cuando varios equipos comparten tonos próximos.
    const roleColor = this.roleAccent(role);
    pixel.fillStyle = roleColor;
    if (role === "leader") {
      pixel.fillRect(13, 20, 4, 12);
      pixel.fillRect(25, 20, 4, 12);
    } else if (role === "sprinter") {
      pixel.fillRect(12, 18, 18, 4);
      pixel.fillRect(17, 4, 10, 3);
    } else if (role === "climber") {
      for (const [markX, markY] of [[14, 20], [24, 20], [19, 26], [14, 30], [25, 30]]) {
        pixel.fillRect(markX, markY, 3, 3);
      }
    } else if (role === "attacker") {
      pixel.fillRect(13, 20, 4, 4);
      pixel.fillRect(17, 23, 4, 4);
      pixel.fillRect(21, 26, 4, 4);
      pixel.fillRect(25, 29, 4, 4);
    } else {
      pixel.fillRect(12, 28, 18, 3);
    }
    if (jerseyType === "polka") {
      pixel.fillStyle = "#e63946";
      for (const [markX, markY] of [[14, 19], [23, 18], [18, 24], [27, 26], [14, 30], [22, 31]]) {
        pixel.fillRect(markX, markY, 3, 3);
      }
    }
    if (pose === "fatigue") {
      pixel.fillStyle = "#8de7f7";
      pixel.fillRect(31, 12, 2, 4);
      pixel.fillRect(34, 16, 2, 3);
    }
    pixel.restore();

    this.spriteCache.set(key, sprite);
    return sprite;
  }

  drawCyclist(ctx, rider, x, y, scale, isPlayer, angle) {
    const cadence = 8 + rider.speed * 0.1;
    const frame = ((Math.floor((this.race?.elapsed || performance.now() / 1000) * cadence + rider.lateral * 4) % 8) + 8) % 8;
    const pose = this.riderPose(rider);
    const jerseyColor = rider.jerseyColor || rider.color;
    const sprite = this.buildCyclistSprite(jerseyColor, isPlayer, frame, rider.role, pose, rider.jerseyType);
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    const standingRock = pose === "standing" ? Math.sin(frame / 8 * Math.PI * 2) * 0.085 : 0;
    ctx.rotate(angle + standingRock + (rider.crashTimer > 2 ? (3.2 - rider.crashTimer) * 1.25 : 0));
    ctx.imageSmoothingEnabled = false;

    if (rider.relayParticipant) {
      ctx.strokeStyle = rider.relayPulling ? "#ffcc33" : "#62d8f2";
      ctx.lineWidth = 3;
      ctx.strokeRect(-25 * scale, -32 * scale, 50 * scale, 64 * scale);
      ctx.fillStyle = rider.relayPulling ? "#ffcc33" : "#62d8f2";
      ctx.fillRect(-8 * scale, -39 * scale, 16 * scale, 4 * scale);
    }
    if (rider.attacking > 0 || rider.sprinting) {
      const pulse = frame % 2 ? 3 : 0;
      ctx.fillStyle = rider.sprinting ? "#62d8f2" : "#ff7158";
      ctx.fillRect(-15 * scale, (31 + pulse) * scale, 7 * scale, 4 * scale);
      ctx.fillRect(8 * scale, (38 - pulse) * scale, 10 * scale, 4 * scale);
      ctx.fillStyle = "#ffcc33";
      ctx.fillRect(-6 * scale, (43 + pulse) * scale, 12 * scale, 5 * scale);
    }
    if (pose === "fatigue") {
      ctx.fillStyle = "#8de7f7";
      ctx.fillRect(18 * scale, -18 * scale, 3 * scale, 6 * scale);
      ctx.fillRect(23 * scale, -10 * scale, 2 * scale, 4 * scale);
    } else if (pose === "victory") {
      ctx.strokeStyle = "#101820";
      ctx.lineWidth = 6 * scale;
      ctx.beginPath();
      ctx.moveTo(-8 * scale, -7 * scale);
      ctx.lineTo(-20 * scale, -24 * scale);
      ctx.moveTo(8 * scale, -7 * scale);
      ctx.lineTo(20 * scale, -24 * scale);
      ctx.stroke();
      ctx.strokeStyle = "#d79869";
      ctx.lineWidth = 3 * scale;
      ctx.stroke();
    }
    if (isPlayer) {
      ctx.fillStyle = "rgba(255,204,51,.2)";
      ctx.fillRect(-27 * scale, -34 * scale, 54 * scale, 69 * scale);
      ctx.strokeStyle = "#fff7d1";
      ctx.lineWidth = 2;
      ctx.strokeRect(-24 * scale, -31 * scale, 48 * scale, 62 * scale);
    }
    ctx.drawImage(sprite, -21 * scale, -30 * scale, 42 * scale, 60 * scale);

    if (isPlayer) {
      const arrowColor = rider.color || "#ffcc33";
      ctx.fillStyle = arrowColor;
      ctx.strokeStyle = "#101820";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, 32 * scale);
      ctx.lineTo(-10 * scale, 47 * scale);
      ctx.lineTo(10 * scale, 47 * scale);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  renderCyclists(ctx) {
    if (!this.race) return;
    const player = this.race.player;
    const renderRiders = this.race.timeTrial ? [this.race.player] : this.race.cyclists;
    const visibleRiders = renderRiders.map((rider) => {
      const point = this.roadPointAt(rider.distance, rider.lateral);
      return { rider, point, angle: this.roadAngleAt(rider.distance), delta: rider.distance - player.distance };
    }).filter((item) => item.point.y > -70 && item.point.y < this.height + 70)
      .sort((a, b) => a.point.y - b.point.y);
    const visibleVehicles = this.ambientRaceVehicles().map((vehicle) => ({
      vehicle,
      point: this.roadPointAt(vehicle.distance, vehicle.lateral)
    })).filter((item) => item.point.y > -110 && item.point.y < this.height + 110);
    const visible = [...visibleRiders, ...visibleVehicles]
      .sort((a, b) => a.point.y - b.point.y);
    const nearestAhead = visibleRiders
      .filter((item) => item.rider !== player && item.delta > 0)
      .sort((a, b) => a.delta - b.delta)[0];
    if (nearestAhead && player.draft > 8) this.renderDraftZone(ctx, nearestAhead.point.x, nearestAhead.point.y, nearestAhead.angle);
    for (const item of visible) {
      if (item.vehicle) {
        this.drawRaceVehicle(ctx, item.vehicle, item.point);
        continue;
      }
      const originalScale = clamp(this.roadHalfWidth / 135, 0.8, 1.24);
      const scale = originalScale * 0.62;
      const hitScale = Math.max(scale, 0.86);
      this.drawCyclist(ctx, item.rider, item.point.x, item.point.y, scale, item.rider === player, item.angle);
      this.riderHitAreas.push({ rider: item.rider, x: item.point.x, y: item.point.y, width: 48 * hitScale, height: 68 * hitScale });
      const isWheelTarget = this.race.player.wheelTarget === item.rider;
      if ((this.cameraInspection?.type === "rider" && this.cameraInspection.rider === item.rider) || isWheelTarget) {
        ctx.strokeStyle = isWheelTarget ? "#ffcc33" : "#62d8f2";
        ctx.lineWidth = 3;
        ctx.strokeRect(item.point.x - 25 * scale, item.point.y - 34 * scale, 50 * scale, 68 * scale);
      }
      if (this.race.weather.intensity > 0.25 && Math.random() < 0.14) {
        this.particles.addSplash(item.point.x, item.point.y + 19 * scale, 1);
      }
    }
  }

  renderGroupMarkers(ctx) {
    if (!this.race || this.race.groups.length < 2) return;
    const occupiedLabels = [];
    for (const group of this.race.groups) {
      const point = this.roadPointAt(group.leader.distance, group.leader.lateral);
      if (point.y < 42 || point.y > this.height - 35) continue;
      const width = Math.min(270, this.width - 16);
      const x = Math.round(clamp(point.x - width / 2, 8, this.width - width - 8));
      const baseY = Math.round(clamp(point.y - 53, 6, this.height - 48));
      let y = baseY;
      for (let attempt = 0; attempt < 6; attempt += 1) {
        const overlaps = occupiedLabels.some((label) =>
          x < label.x + label.width && x + width > label.x && y < label.y + 44 && y + 44 > label.y);
        if (!overlaps) break;
        const direction = attempt % 2 ? -1 : 1;
        y = Math.round(clamp(baseY + direction * Math.ceil((attempt + 1) / 2) * 46, 6, this.height - 48));
      }
      occupiedLabels.push({ x, y, width });
      const gapText = group.index === 0 ? "0:00" : `+${formatGap(group.gapPreviousSeconds)}`;
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = "rgba(8,20,32,.94)";
      ctx.fillRect(x, y, width, 42);
      ctx.strokeStyle = "#05090e";
      ctx.lineWidth = 3;
      ctx.strokeRect(x + 1.5, y + 1.5, width - 3, 39);
      ctx.fillStyle = group.leader.color;
      ctx.fillRect(x + 3, y + 3, 6, 36);
      ctx.beginPath();
      ctx.rect(x + 10, y + 3, width - 14, 36);
      ctx.clip();
      ctx.fillStyle = "#f8f5eb";
      ctx.font = "bold 11px Menlo, Monaco, Consolas, monospace";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      const title = this.fitCanvasText(
        ctx,
        `${group.label} · ${group.leader.flag || ""} ${group.leader.name}`,
        width - 25
      );
      ctx.fillText(title, x + 13, y + 7);
      ctx.fillStyle = "#d3e0e7";
      ctx.font = "bold 10px Menlo, Monaco, Consolas, monospace";
      const detailsWidth = Math.max(45, width - 32 - ctx.measureText(gapText).width);
      ctx.fillText(this.fitCanvasText(ctx, `${group.riders.length} ciclistas · ${group.tendency}`, detailsWidth), x + 13, y + 25);
      ctx.fillStyle = "#ffcc33";
      ctx.textAlign = "right";
      ctx.fillText(gapText, x + width - 10, y + 25);
      ctx.restore();
      ctx.fillStyle = group.leader.color;
      ctx.fillRect(Math.round(point.x - 1), Math.round(y + 42), 3, Math.max(5, Math.round(point.y - y - 42)));
    }
  }

  fitCanvasText(ctx, value, maxWidth) {
    if (ctx.measureText(value).width <= maxWidth) return value;
    const characters = Array.from(value);
    while (characters.length && ctx.measureText(`${characters.join("")}…`).width > maxWidth) characters.pop();
    return characters.length ? `${characters.join("")}…` : "";
  }

  buildSideCyclistSprite(color, isPlayer, frame, role = "domestique", pose = "normal", jerseyType = "") {
    const key = `side-${color}-${isPlayer}-${frame}-${role}-${pose}-${jerseyType}`;
    if (this.spriteCache.has(key)) return this.spriteCache.get(key);
    const sprite = document.createElement("canvas");
    sprite.width = 72;
    sprite.height = 60;
    const pixel = sprite.getContext("2d");
    pixel.imageSmoothingEnabled = false;
    const outline = "#070c12";
    const skin = "#e0a173";
    const skinShadow = "#a85f45";
    const metal = "#dce6e7";
    const phase = frame / 8 * Math.PI * 2;
    const standing = pose === "standing";
    const pedal = { x: Math.round(36 + Math.cos(phase) * 8), y: Math.round(42 + Math.sin(phase) * 6) };
    const opposite = { x: Math.round(36 - Math.cos(phase) * 8), y: Math.round(42 - Math.sin(phase) * 6) };

    pixel.fillStyle = "rgba(8,15,20,.24)";
    pixel.fillRect(3, 55, 67, 4);
    for (const wheelX of [16, 56]) {
      pixel.fillStyle = outline;
      pixel.beginPath();
      pixel.arc(wheelX, 45, 14, 0, Math.PI * 2);
      pixel.fill();
      pixel.fillStyle = "#9aa8ad";
      pixel.beginPath();
      pixel.arc(wheelX, 45, 10, 0, Math.PI * 2);
      pixel.fill();
      pixel.fillStyle = "#24313a";
      pixel.beginPath();
      pixel.arc(wheelX, 45, 8, 0, Math.PI * 2);
      pixel.fill();
      pixel.fillStyle = metal;
      pixel.fillRect(wheelX - 1, 36, 3, 19);
      pixel.fillRect(wheelX - 9, 44, 19, 3);
      pixel.fillStyle = "#ffcc33";
      pixel.fillRect(wheelX - 2, 43, 4, 4);
    }

    // Cuadro sobredimensionado y contrastado, como en un arcade de 16 bits.
    pixel.strokeStyle = outline;
    pixel.lineWidth = 7;
    pixel.beginPath();
    pixel.moveTo(16, 45); pixel.lineTo(33, 29); pixel.lineTo(36, 45); pixel.lineTo(16, 45);
    pixel.moveTo(36, 45); pixel.lineTo(56, 45); pixel.lineTo(49, 24); pixel.lineTo(33, 29);
    pixel.stroke();
    pixel.strokeStyle = isPlayer ? "#ffcc33" : color;
    pixel.lineWidth = 4;
    pixel.stroke();
    pixel.fillStyle = metal;
    pixel.fillRect(33, 40, 6, 6);

    // Piernas más gruesas y con ocho posiciones de pedaleo.
    const hip = {
      x: standing ? 31 + Math.round(Math.sin(phase) * 3) : 34,
      y: standing ? 19 : 30
    };
    const leftKnee = { x: Math.round((hip.x + pedal.x) / 2 - 5), y: Math.round((hip.y + pedal.y) / 2) };
    const rightKnee = { x: Math.round((hip.x + opposite.x) / 2 + 5), y: Math.round((hip.y + opposite.y) / 2) };
    for (const [knee, foot] of [[leftKnee, pedal], [rightKnee, opposite]]) {
      pixel.strokeStyle = outline; pixel.lineWidth = 8; pixel.beginPath();
      pixel.moveTo(hip.x, hip.y); pixel.lineTo(knee.x, knee.y); pixel.lineTo(foot.x, foot.y); pixel.stroke();
      pixel.strokeStyle = skin; pixel.lineWidth = 4; pixel.beginPath();
      pixel.moveTo(knee.x, knee.y); pixel.lineTo(foot.x, foot.y); pixel.stroke();
    }
    pixel.fillStyle = outline;
    pixel.fillRect(pedal.x - 4, pedal.y, 9, 4);
    pixel.fillRect(opposite.x - 4, opposite.y, 9, 4);

    if (standing) {
      // Postura fuera del sillín deliberadamente exagerada para que siga
      // leyéndose cuando el sprite se reduce en móvil: pelvis alta, espalda
      // casi vertical y brazos largos cargando el peso sobre el manillar.
      pixel.fillStyle = outline;
      pixel.beginPath();
      pixel.moveTo(22, 7);
      pixel.lineTo(38, 6);
      pixel.lineTo(45, 18);
      pixel.lineTo(37, 25);
      pixel.lineTo(24, 24);
      pixel.lineTo(20, 12);
      pixel.closePath();
      pixel.fill();
      pixel.fillStyle = color;
      pixel.fillRect(23, 9, 15, 12);
      pixel.fillRect(27, 18, 13, 6);
      pixel.fillStyle = lerpColor(color, "#10151d", 0.55);
      pixel.fillRect(23, 18, 17, 5);
      pixel.fillStyle = "#f4f1e9";
      pixel.fillRect(27, 10, 4, 11);
      pixel.fillStyle = outline;
      pixel.fillRect(27, 22, 12, 6);

      // Brazos casi extendidos hasta un manillar que permanece unido a la bici.
      pixel.strokeStyle = outline;
      pixel.lineWidth = 8;
      pixel.beginPath();
      pixel.moveTo(37, 10);
      pixel.lineTo(47, 17);
      pixel.lineTo(59, 21);
      pixel.stroke();
      pixel.strokeStyle = skin;
      pixel.lineWidth = 4;
      pixel.beginPath();
      pixel.moveTo(38, 10);
      pixel.lineTo(47, 17);
      pixel.lineTo(58, 21);
      pixel.stroke();
      pixel.fillStyle = outline;
      pixel.fillRect(55, 19, 12, 4);
      pixel.fillRect(62, 19, 4, 8);

      // Cabeza retrasada respecto a la postura sentada y claramente erguida.
      pixel.fillStyle = outline;
      pixel.fillRect(25, 0, 21, 17);
      pixel.fillRect(43, 5, 6, 10);
      pixel.fillStyle = skin;
      pixel.fillRect(29, 4, 16, 11);
      pixel.fillStyle = skinShadow;
      pixel.fillRect(29, 12, 15, 4);
      pixel.fillRect(43, 8, 6, 5);
      pixel.fillStyle = isPlayer ? "#ffcc33" : lerpColor(color, "#10151d", 0.4);
      pixel.fillRect(23, 0, 24, 7);
      pixel.fillStyle = lerpColor(isPlayer ? "#ffcc33" : color, "#ffffff", 0.45);
      pixel.fillRect(27, 1, 9, 3);
      pixel.fillStyle = "#6fe4ff";
      pixel.fillRect(38, 6, 13, 4);
      pixel.fillStyle = "#10202b";
      pixel.fillRect(41, 7, 4, 3);

      const standingRoleColor = this.roleAccent(role);
      pixel.fillStyle = standingRoleColor;
      if (role === "leader") {
        pixel.fillRect(24, 9, 4, 13);
        pixel.fillRect(35, 8, 4, 14);
      } else if (role === "sprinter") {
        pixel.fillRect(23, 9, 16, 4);
      } else if (role === "climber") {
        for (const [markX, markY] of [[25, 10], [34, 10], [29, 15], [36, 19], [25, 20]]) {
          pixel.fillRect(markX, markY, 3, 3);
        }
      } else if (role === "attacker") {
        pixel.fillRect(24, 9, 4, 4);
        pixel.fillRect(28, 12, 4, 4);
        pixel.fillRect(32, 15, 4, 4);
      } else {
        pixel.fillRect(24, 20, 15, 3);
      }
      if (jerseyType === "polka") {
        pixel.fillStyle = "#e63946";
        for (const [markX, markY] of [[25, 9], [34, 9], [29, 14], [36, 18], [25, 20]]) {
          pixel.fillRect(markX, markY, 3, 3);
        }
      }
      this.spriteCache.set(key, sprite);
      return sprite;
    }

    // Torso ancho, inclinado y con sombras duras.
    pixel.save();
    if (standing) pixel.translate(-6, -3);
    else if (pose === "fatigue") pixel.translate(3, 4);
    pixel.fillStyle = outline;
    pixel.beginPath();
    pixel.moveTo(20, 11); pixel.lineTo(39, 9); pixel.lineTo(50, 24); pixel.lineTo(35, 34); pixel.lineTo(18, 25); pixel.closePath(); pixel.fill();
    pixel.fillStyle = color;
    pixel.fillRect(21, 13, 18, 12);
    pixel.fillRect(27, 21, 17, 8);
    pixel.fillStyle = lerpColor(color, "#10151d", 0.55);
    pixel.fillRect(21, 23, 21, 6);
    pixel.fillRect(38, 13, 5, 11);
    pixel.fillStyle = "#f4f1e9";
    pixel.fillRect(27, 14, 5, 10);
    pixel.fillRect(33, 16, 7, 3);
    pixel.fillStyle = isPlayer ? "#ffcc33" : "#f4f1e9";
    pixel.fillRect(29, 17, 4, 5);

    // Brazos musculosos sobre un manillar bien visible.
    pixel.strokeStyle = outline; pixel.lineWidth = 8; pixel.beginPath();
    pixel.moveTo(37, 15); pixel.lineTo(49, 24); pixel.lineTo(58, 21); pixel.stroke();
    pixel.strokeStyle = skin; pixel.lineWidth = 4; pixel.beginPath();
    pixel.moveTo(38, 15); pixel.lineTo(49, 24); pixel.stroke();
    pixel.fillStyle = skinShadow; pixel.fillRect(47, 22, 6, 5);
    pixel.fillStyle = outline;
    pixel.fillRect(54, 19, 13, 4);
    pixel.fillRect(62, 19, 4, 8);
    pixel.restore();

    // Cabeza adelantada sobre los hombros, cerca del manillar.
    pixel.save();
    if (standing) pixel.translate(-6, 0);
    else if (pose === "fatigue") pixel.translate(3, 4);
    pixel.fillStyle = outline;
    pixel.fillRect(34, 3, 21, 18);
    pixel.fillRect(52, 7, 6, 10);
    pixel.fillStyle = skin;
    pixel.fillRect(37, 7, 17, 12);
    pixel.fillStyle = skinShadow;
    pixel.fillRect(37, 16, 15, 4);
    pixel.fillRect(52, 11, 6, 5);
    pixel.fillStyle = isPlayer ? "#ffcc33" : lerpColor(color, "#10151d", 0.4);
    pixel.fillRect(32, 2, 24, 8);
    pixel.fillRect(36, 0, 15, 4);
    pixel.fillStyle = lerpColor(isPlayer ? "#ffcc33" : color, "#ffffff", 0.45);
    pixel.fillRect(36, 2, 9, 3);
    pixel.fillStyle = "#6fe4ff";
    pixel.fillRect(46, 8, 14, 4);
    pixel.fillStyle = "#10202b";
    pixel.fillRect(49, 9, 4, 3);
    pixel.fillStyle = "#f4f1e9";
    pixel.fillRect(32, 20, 16, 4);
    pixel.restore();

    const roleColor = this.roleAccent(role);
    pixel.save();
    if (standing) pixel.translate(-6, -3);
    pixel.fillStyle = roleColor;
    if (role === "leader") {
      pixel.fillRect(22, 13, 5, 14);
      pixel.fillRect(36, 12, 5, 15);
    } else if (role === "sprinter") {
      pixel.fillRect(21, 13, 22, 4);
      pixel.fillRect(37, 2, 14, 3);
    } else if (role === "climber") {
      for (const [markX, markY] of [[23, 14], [34, 14], [28, 20], [39, 22], [23, 25]]) {
        pixel.fillRect(markX, markY, 3, 3);
      }
    } else if (role === "attacker") {
      pixel.fillRect(22, 13, 4, 4);
      pixel.fillRect(26, 16, 4, 4);
      pixel.fillRect(30, 19, 4, 4);
      pixel.fillRect(34, 22, 5, 4);
    } else {
      pixel.fillRect(22, 24, 21, 3);
    }
    if (jerseyType === "polka") {
      pixel.fillStyle = "#e63946";
      for (const [markX, markY] of [[23, 14], [33, 13], [39, 18], [28, 21], [37, 25], [23, 25]]) {
        pixel.fillRect(markX, markY, 3, 3);
      }
    }
    if (pose === "fatigue") {
      pixel.fillStyle = "#8de7f7";
      pixel.fillRect(58, 12, 3, 5);
      pixel.fillRect(62, 18, 2, 4);
    }
    pixel.restore();

    this.spriteCache.set(key, sprite);
    return sprite;
  }

  sideSurfaceY(km) {
    if (!this.race) return this.height * 0.68;
    const centerElevation = this.race.road.elevationAt(this.cameraKm);
    const elevation = this.race.road.elevationAt(km);
    // Exageración vertical deliberada para que la inclinación sea legible en
    // una pantalla pequeña sin alterar la pendiente física de la carretera.
    const elevationDelta = elevation - centerElevation;
    const visualScale = elevationDelta < 0 ? 1.08 : 0.82;
    return this.height * 0.69 - elevationDelta * visualScale;
  }

  sideRoadAngleAt(km, pixelsPerKm) {
    const sampleKm = 0.006;
    const rise = this.sideSurfaceY(km + sampleKm) - this.sideSurfaceY(km - sampleKm);
    return clamp(Math.atan2(rise, sampleKm * 2 * pixelsPerKm), -0.34, 0.34);
  }

  sideLaneOffset(lateral) {
    return clamp(lateral, -0.9, 0.9) * SIDE_ROAD_LANE_DEPTH;
  }

  renderLateralSkyDetails(ctx, biome, weather) {
    if (weather < 0.65) {
      const sunX = Math.round(this.width * 0.79 / 4) * 4;
      const sunY = Math.round(this.height * 0.14 / 4) * 4;
      ctx.fillStyle = "rgba(255,232,132,.2)";
      ctx.fillRect(sunX - 24, sunY - 24, 48, 48);
      ctx.fillStyle = "#f7d76b";
      ctx.fillRect(sunX - 15, sunY - 15, 30, 30);
      ctx.fillStyle = "#ffe99a";
      ctx.fillRect(sunX - 11, sunY - 12, 14, 8);
      ctx.fillRect(sunX - 18, sunY - 3, 5, 8);
    }
    const cloudColor = weather > 0.45 ? "#b4c5ca" : "#e4efed";
    const cloudShadow = weather > 0.45 ? "#899fa6" : "#b9d0d1";
    const span = this.width + 240;
    for (let cloud = 0; cloud < 6; cloud += 1) {
      const rawX = cloud * 211 - this.cameraKm * (5 + cloud % 3) + this.race.elapsed * (1 + cloud % 2);
      const x = ((rawX % span) + span) % span - 100;
      const y = 30 + (cloud % 3) * 42;
      const width = 42 + (cloud % 2) * 20;
      ctx.globalAlpha = weather > 0.7 ? 0.72 : 0.58;
      ctx.fillStyle = cloudShadow;
      ctx.fillRect(Math.round(x), y + 10, width, 10);
      ctx.fillStyle = cloudColor;
      ctx.fillRect(Math.round(x + 7), y + 3, width - 12, 14);
      ctx.fillRect(Math.round(x + 18), y - 5, 20, 12);
    }
    ctx.globalAlpha = 1;
    if (biome.id !== "city") {
      const farColor = weather > 0.55 ? "#7f999a" : lerpColor(biome.detail, "#b8ced0", 0.52);
      const nearColor = weather > 0.55 ? "#687f7d" : lerpColor(biome.detail, "#7e9a8b", 0.3);
      for (const [layer, color] of [[0, farColor], [1, nearColor]]) {
        ctx.fillStyle = color;
        const baseY = this.height * (layer ? 0.46 : 0.38);
        const shift = this.cameraKm * (layer ? 12 : 5);
        for (let x = -24; x < this.width + 30; x += 12) {
          const wave = Math.sin((x + shift) * (layer ? 0.014 : 0.009) + layer * 2.3);
          const ridge = baseY - Math.round((wave + 1) * (layer ? 20 : 29) / 6) * 6;
          ctx.fillRect(x, ridge, 14, this.height - ridge);
        }
      }
    }
  }

  renderLateralTerrainDetails(ctx, focusX, pixelsPerKm) {
    // Los detalles quedan anclados a kilómetros concretos. Antes se generaban
    // desde cada posición de pantalla y cambiaban de forma durante el avance,
    // produciendo un efecto de matorral parpadeante en primer plano.
    const visibleRange = this.width / pixelsPerKm;
    const spacing = 0.095;
    const first = Math.floor((this.cameraKm - visibleRange) / spacing);
    const last = Math.ceil((this.cameraKm + visibleRange) / spacing);
    for (let marker = first; marker <= last; marker += 1) {
      const km = marker * spacing;
      if (km < 0 || km > this.race.road.lengthKm) continue;
      const x = Math.round(focusX + (km - this.cameraKm) * pixelsPerKm);
      if (x < -20 || x > this.width + 20) continue;
      const biome = this.race.road.biomeAt(km);
      const hash = Math.abs(Math.sin(marker * 4.37));
      const y = Math.round(this.sideSurfaceY(km) + 25 + hash * 12);
      if (biome.id === "forest" || biome.id === "green") {
        ctx.globalAlpha = 0.72;
        ctx.fillStyle = biome.id === "forest" ? "#244d31" : "#4f7c46";
        ctx.fillRect(x, y - 7, 3, 8);
        ctx.fillRect(x - 4, y - 4, 5, 3);
        ctx.fillRect(x + 2, y - 6, 5, 3);
        if (biome.id === "green" && hash > 0.82) {
          ctx.fillStyle = hash > 0.85 ? "#ffe77b" : "#f28c9d";
          ctx.fillRect(x + 7, y - 7, 3, 3);
        }
        ctx.globalAlpha = 1;
      } else if (biome.id === "city") {
        ctx.fillStyle = "#39454c";
        ctx.fillRect(x - 8, y, 18, 3);
        ctx.fillRect(x, y - 7, 3, 10);
      } else if (biome.id === "desert" || biome.id === "dry") {
        ctx.fillStyle = biome.id === "desert" ? "#7b5a30" : "#5a472d";
        ctx.fillRect(x - 7, y - 2, 14, 5);
        ctx.fillStyle = biome.accent;
        ctx.fillRect(x - 3, y - 5, 6, 3);
      } else {
        ctx.fillStyle = "#5f6862";
        ctx.fillRect(x - 8, y - 5, 16, 7);
        ctx.fillStyle = "#a7aa9d";
        ctx.fillRect(x - 5, y - 8, 8, 4);
      }
    }
  }

  renderLateralScene(ctx, weather) {
    const focusX = this.width * 0.38;
    const pixelsPerKm = clamp(this.width / 1.35, 520, 1050);
    const biome = this.race.road.visualBiomeAt(this.cameraKm);
    const skyColors = {
      forest: "#8fc4d5", city: "#acd2df", desert: "#edc679",
      mountain: "#b5d5df", green: "#8bcde2", dry: "#ddb878"
    };
    // Incluso con lluvia intensa el cielo conserva luminosidad diurna.
    ctx.fillStyle = weather > 0.6 ? "#abc4ca" : skyColors[biome.id];
    ctx.fillRect(-30, -30, this.width + 60, this.height + 60);
    this.renderLateralSkyDetails(ctx, biome, weather);
    if (biome.id === "city") {
      for (let x = -10; x < this.width + 20; x += 34) {
        const height = 55 + Math.abs(Math.floor(Math.sin(x + this.cameraKm) * 45));
        ctx.fillStyle = x % 3 ? "#71838c" : "#8b7f79";
        ctx.fillRect(x, this.height * 0.48 - height, 30, height + this.height * 0.3);
        // Reflejos azules de día, en vez de ventanas amarillas iluminadas.
        ctx.fillStyle = x % 3 ? "#b9dbe2" : "#d5e3df";
        for (let y = this.height * 0.5 - height; y < this.height * 0.45; y += 12) ctx.fillRect(x + 7, y, 5, 5);
      }
    } else {
      ctx.fillStyle = weather > 0.6 ? lerpColor(biome.detail, "#718b82", 0.42) : biome.detail;
      for (let x = -20; x < this.width + 30; x += 18) {
        const amplitude = biome.id === "mountain" ? 75 : biome.id === "desert" ? 28 : 38;
        const peak = this.height * 0.42 + Math.round(Math.sin(x * 0.018 + this.cameraKm) * amplitude / 6) * 6;
        ctx.fillRect(x, peak, 20, this.height - peak);
      }
    }

    const points = [];
    for (let x = -20; x <= this.width + 20; x += 6) {
      const km = this.cameraKm + (x - focusX) / pixelsPerKm;
      points.push({ x, y: this.sideSurfaceY(km), km });
    }
    ctx.fillStyle = weather > 0.5 ? lerpColor(biome.ground, "#789399", 0.3) : biome.ground;
    ctx.beginPath();
    ctx.moveTo(-20, this.height + 20);
    points.forEach((point) => ctx.lineTo(point.x, point.y));
    ctx.lineTo(this.width + 20, this.height + 20);
    ctx.closePath();
    ctx.fill();
    this.renderLateralTerrainDetails(ctx, focusX, pixelsPerKm);
    ctx.strokeStyle = "#d3c8ae";
    ctx.lineWidth = SIDE_ROAD_SHOULDER_WIDTH;
    ctx.beginPath();
    points.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y));
    ctx.stroke();
    ctx.strokeStyle = weather > 0 ? "#414a4d" : "#60666a";
    ctx.lineWidth = SIDE_ROAD_ASPHALT_WIDTH;
    ctx.stroke();
    ctx.strokeStyle = "rgba(250,248,230,.7)";
    ctx.lineWidth = 3;
    ctx.setLineDash([19, 18]);
    ctx.lineDashOffset = this.cameraKm * 80;
    ctx.stroke();
    ctx.setLineDash([]);

    this.renderLateralScenery(ctx, focusX, pixelsPerKm);
    for (const point of this.race.road.racePoints) {
      const geometry = this.lateralRaceGateGeometry(point, focusX, pixelsPerKm);
      const { x, leftX, rightX, leftBaseY, rightBaseY, topY, gateWidth, gateHeight, structureScale } = geometry;
      if (x < -20 || x > this.width + 20) continue;
      const sprintGate = point.type === "sprint";
      const bannerHeight = Math.max(18, Math.round((sprintGate ? 31 : 20) * Math.max(0.72, structureScale)));
      ctx.fillStyle = "#101820";
      ctx.fillRect(Math.round(leftX - 5), Math.round(topY), 9, Math.round(leftBaseY - topY));
      ctx.fillRect(Math.round(rightX - 4), Math.round(topY), 9, Math.round(rightBaseY - topY));
      ctx.fillRect(Math.round(x - gateWidth / 2 - 7), Math.round(topY - 3), gateWidth + 14, bannerHeight);
      ctx.fillStyle = racePointColor(point);
      ctx.fillRect(Math.round(x - gateWidth / 2 - 2), Math.round(topY + 2), gateWidth + 4, Math.max(12, bannerHeight - 9));
      ctx.fillStyle = "#101820";
      ctx.font = `bold ${Math.max(8, Math.round((sprintGate ? 12 : 9) * structureScale))}px Menlo, Monaco, Consolas, monospace`;
      ctx.textAlign = "center";
      ctx.fillText(`${point.markerLabel || (point.type === "mountain" ? point.category : "SPR")} ${point.maxPoints}P`, x, topY + bannerHeight * 0.62);
    }

    this.renderLateralSpectators(ctx, focusX, pixelsPerKm);
    this.renderLateralRoadsideProps(ctx, focusX, pixelsPerKm);
    this.renderLateralFinish(ctx, focusX, pixelsPerKm);

    const renderRiders = this.race.timeTrial ? [this.race.player] : this.race.cyclists;
    const visibleRiders = renderRiders.map((rider) => ({
      rider,
      x: focusX + (rider.distance - this.cameraKm) * pixelsPerKm,
      // La profundidad representa ahora todo el carril útil. El límite se
      // mantiene dentro del asfalto para que ni ciclistas ni vehículos pisen
      // visualmente el arcén al cambiar de trazada.
      y: this.sideSurfaceY(rider.distance) + this.sideLaneOffset(rider.lateral)
    })).filter((item) => item.x > -120 && item.x < this.width + 120);
    const visibleVehicles = this.ambientRaceVehicles().map((vehicle) => ({
      vehicle,
      x: focusX + (vehicle.distance - this.cameraKm) * pixelsPerKm,
      y: this.sideSurfaceY(vehicle.distance) + this.sideLaneOffset(vehicle.lateral)
    })).filter((item) => item.x > -140 && item.x < this.width + 140);
    const visible = [...visibleRiders, ...visibleVehicles]
      .sort((a, b) => {
        const lateralA = a.rider ? a.rider.lateral : a.vehicle.lateral;
        const lateralB = b.rider ? b.rider.lateral : b.vehicle.lateral;
        return lateralA - lateralB;
      });
    const riderViewportScale = this.lateralRiderViewportScale();
    for (const item of visible) {
      if (item.vehicle) {
        this.drawLateralRaceVehicle(ctx, {
          ...item.vehicle,
          x: item.x,
          y: item.y
        }, pixelsPerKm);
        continue;
      }
      const cadence = 3.4 + item.rider.speed * 0.18;
      const frame = ((Math.floor(this.race.elapsed * cadence + item.rider.lateral * 3) % 8) + 8) % 8;
      const pose = this.riderPose(item.rider);
      const jerseyColor = item.rider.jerseyColor || item.rider.color;
      const sprite = this.buildSideCyclistSprite(jerseyColor, item.rider === this.race.player, frame, item.rider.role, pose, item.rider.jerseyType);
      const roadAngle = this.sideRoadAngleAt(item.rider.distance, pixelsPerKm);
      const depthScale = 1 + (item.rider.lateral + 0.9) * 0.07;
      // En móvil el pelotón debe dejar carretera visible. La escala de toque
      // conserva algo más de margen que el sprite para no dificultar las fichas.
      const scale = 0.7 * depthScale * riderViewportScale;
      const minimumHitScale = riderViewportScale < 1 ? riderViewportScale + 0.06 : 1;
      const hitScale = Math.max(scale, minimumHitScale);
      const actionColor = item.rider.sprinting ? "#62d8f2" : item.rider.attacking > 0 ? "#ff7158" : null;
      if (actionColor) {
        const pulse = Math.floor(this.race.elapsed * 14 + item.rider.distance * 100) % 3;
        ctx.fillStyle = actionColor;
        ctx.fillRect(item.x - 64 * scale - pulse * 5, item.y - 36 * scale, 30 * scale, 4 * scale);
        ctx.fillRect(item.x - 51 * scale + pulse * 4, item.y - 20 * scale, 20 * scale, 3 * scale);
        ctx.fillRect(item.x - 59 * scale, item.y - 7 * scale, 25 * scale, 3 * scale);
      }
      if (pose === "fatigue") {
        const bob = frame % 2 ? 2 : 0;
        item.y += bob;
        ctx.fillStyle = "#8de7f7";
        ctx.fillRect(item.x + 28 * scale, item.y - 51 * scale, 3 * scale, 7 * scale);
        ctx.fillRect(item.x + 36 * scale, item.y - 42 * scale, 2 * scale, 5 * scale);
      } else if (pose === "victory") {
        ctx.strokeStyle = "#070c12";
        ctx.lineWidth = 8 * scale;
        ctx.beginPath();
        ctx.moveTo(item.x + 2 * scale, item.y - 39 * scale);
        ctx.lineTo(item.x - 8 * scale, item.y - 66 * scale);
        ctx.moveTo(item.x + 14 * scale, item.y - 39 * scale);
        ctx.lineTo(item.x + 29 * scale, item.y - 65 * scale);
        ctx.stroke();
        ctx.strokeStyle = "#e0a173";
        ctx.lineWidth = 4 * scale;
        ctx.stroke();
      }
      if (item.rider.relayParticipant) {
        ctx.strokeStyle = item.rider.relayPulling ? "#ffcc33" : "#62d8f2";
        ctx.lineWidth = 3;
        ctx.strokeRect(item.x - 39 * scale, item.y - 61 * scale, 78 * scale, 65 * scale);
        ctx.fillStyle = item.rider.relayPulling ? "#ffcc33" : "#62d8f2";
        ctx.fillRect(item.x - 11 * scale, item.y - 67 * scale, 22 * scale, 4 * scale);
      }
      ctx.imageSmoothingEnabled = false;
      ctx.save();
      const standingBob = pose === "standing" && frame % 2 ? -3 * scale : 0;
      const standingPitch = pose === "standing" ? Math.sin(frame / 8 * Math.PI * 2) * 0.035 : 0;
      ctx.translate(Math.round(item.x), Math.round(item.y + standingBob));
      ctx.rotate(roadAngle + standingPitch);
      ctx.drawImage(sprite, -36 * scale, -58 * scale, 72 * scale, 60 * scale);
      ctx.restore();
      this.riderHitAreas.push({ rider: item.rider, x: item.x, y: item.y - 29 * scale, width: 78 * hitScale, height: 66 * hitScale });
      const isWheelTarget = this.race.player.wheelTarget === item.rider;
      if ((this.cameraInspection?.type === "rider" && this.cameraInspection.rider === item.rider) || isWheelTarget) {
        ctx.strokeStyle = isWheelTarget ? "#ffcc33" : "#62d8f2";
        ctx.lineWidth = 4;
        ctx.strokeRect(item.x - 39 * scale, item.y - 61 * scale, 78 * scale, 64 * scale);
      }
      if (item.rider === this.race.player) {
        ctx.fillStyle = item.rider.color || "#ffcc33";
        ctx.strokeStyle = "#071018";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(item.x, item.y - 66 * scale);
        ctx.lineTo(item.x - 11, item.y - 84 * scale);
        ctx.lineTo(item.x + 11, item.y - 84 * scale);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    }
    this.renderLateralGroupMarkers(ctx, focusX, pixelsPerKm);
  }

  lateralRaceGateGeometry(point, focusX, pixelsPerKm) {
    const x = focusX + (point.km - this.cameraKm) * pixelsPerKm;
    const sprintGate = point.type === "sprint";
    const structureScale = this.raceStructureScale();
    const baseGateWidth = sprintGate ? 132 : 78;
    const gateWidth = Math.max(SIDE_ROAD_ASPHALT_WIDTH + 18, Math.round(baseGateWidth * structureScale));
    const gateHeight = Math.round((sprintGate ? SIDE_SPRINT_GATE_HEIGHT : 102) * structureScale);
    const leftX = x - gateWidth / 2;
    const rightX = x + gateWidth / 2;
    const leftKm = this.cameraKm + (leftX - focusX) / pixelsPerKm;
    const rightKm = this.cameraKm + (rightX - focusX) / pixelsPerKm;
    const roadEdgeOffset = SIDE_ROAD_ASPHALT_WIDTH / 2 + 5;
    // El poste cercano nace fuera del borde inferior y el lejano fuera del
    // superior. Cada base consulta su propia cota para respetar la pendiente.
    const leftBaseY = this.sideSurfaceY(leftKm) + roadEdgeOffset;
    const rightBaseY = this.sideSurfaceY(rightKm) - roadEdgeOffset;
    const topY = Math.min(leftBaseY, rightBaseY) - gateHeight;
    return { x, leftX, rightX, leftKm, rightKm, leftBaseY, rightBaseY, topY, gateWidth, gateHeight, structureScale };
  }

  renderLateralScenery(ctx, focusX, pixelsPerKm) {
    const visibleRange = this.width / pixelsPerKm;
    // Primer plano más respirado: conserva el cambio de bioma sin formar una
    // pared de vegetación que compita con ciclistas y carretera.
    const spacing = 0.088;
    const first = Math.floor((this.cameraKm - visibleRange) / spacing);
    const last = Math.ceil((this.cameraKm + visibleRange) / spacing);
    for (let marker = first; marker <= last; marker += 1) {
      const km = marker * spacing;
      if (km < 0 || km > this.race.road.lengthKm) continue;
      const biome = this.race.road.biomeAt(km);
      if (biome.id !== "forest" && biome.id !== "green" && Math.abs(marker) % 2) continue;
      const x = Math.round(focusX + (km - this.cameraKm) * pixelsPerKm);
      if (x < -45 || x > this.width + 45) continue;
      // La línea de la carretera representa su eje y se dibuja con un arcén
      // ancho. Anclamos la base de la vegetación al borde superior del arcén
      // para que, en la vista lateral, no aparezca plantada sobre el asfalto.
      const y = Math.round(this.sideSurfaceY(km) - SIDE_ROAD_SHOULDER_WIDTH / 2 - 3);
      const variation = (Math.sin(marker * 91.73) + 1) * 0.5;
      const size = Math.round(14 + variation * 12);

      if (biome.id === "forest" || biome.id === "green") {
        const forest = biome.id === "forest";
        const treeCount = forest && Math.abs(marker) % 3 === 0 ? 2 : 1;
        for (let tree = treeCount - 1; tree >= 0; tree -= 1) {
          const offsetX = (tree - 0.5) * (11 + variation * 8);
          const treeSize = size * (tree ? 0.72 : 1);
          ctx.fillStyle = "rgba(7,20,14,.28)";
          ctx.fillRect(x + offsetX - treeSize * 0.65, y + 3, treeSize * 1.4, 4);
          ctx.fillStyle = forest ? "#38291d" : "#59402a";
          ctx.fillRect(x + offsetX - 3, y - treeSize * 0.4, 6, treeSize * 0.52);
          ctx.fillStyle = forest ? "#102d20" : "#1d4a2e";
          ctx.fillRect(x + offsetX - treeSize * 0.65, y - treeSize * 1.35, treeSize * 1.3, treeSize);
          ctx.fillRect(x + offsetX - treeSize * 0.9, y - treeSize * 0.95, treeSize * 1.8, treeSize * 0.52);
          ctx.fillStyle = forest ? "#266442" : biome.accent;
          ctx.fillRect(x + offsetX - treeSize * 0.45, y - treeSize * 1.2, treeSize * 0.62, treeSize * 0.22);
          ctx.fillRect(x + offsetX + treeSize * 0.18, y - treeSize * 0.78, treeSize * 0.4, treeSize * 0.18);
        }
      } else if (biome.id === "desert") {
        ctx.fillStyle = "#64733b";
        ctx.fillRect(x - 3, y - size, 6, size);
        ctx.fillRect(x - 10, y - size * 0.65, 10, 5);
        ctx.fillRect(x - 10, y - size * 0.65, 4, 11);
        ctx.fillRect(x + 2, y - size * 0.45, 10, 5);
        ctx.fillRect(x + 8, y - size * 0.72, 4, 12);
      } else if (biome.id === "mountain") {
        ctx.fillStyle = "#424c49";
        ctx.fillRect(x - size, y - size * 0.42, size * 2, size * 0.5);
        ctx.fillStyle = "#92998e";
        ctx.fillRect(x - size * 0.65, y - size, size * 1.15, size * 0.7);
        ctx.fillStyle = "#c7cabb";
        ctx.fillRect(x - size * 0.45, y - size * 0.84, size * 0.45, 4);
      } else if (biome.id === "city") {
        ctx.fillStyle = "#26333d";
        ctx.fillRect(x - 2, y - 35, 4, 35);
        ctx.fillStyle = "#f2d26c";
        ctx.fillRect(x - 5, y - 38, 11, 6);
        ctx.fillStyle = "#e8edf0";
        ctx.fillRect(x - 12, y - 9, 24, 5);
        ctx.fillStyle = "#d64d55";
        ctx.fillRect(x - 8, y - 8, 5, 8);
        ctx.fillRect(x + 4, y - 8, 5, 8);
      } else {
        ctx.fillStyle = "#57452c";
        ctx.fillRect(x - 2, y - size * 0.45, 4, size * 0.5);
        ctx.fillStyle = biome.accent;
        ctx.fillRect(x - size * 0.65, y - size * 0.4, size * 1.3, size * 0.38);
        ctx.fillRect(x - size * 0.3, y - size * 0.72, size * 0.5, size * 0.45);
      }
    }
  }

  renderLateralRoadsideProps(ctx, focusX, pixelsPerKm) {
    const visibleRange = this.width / pixelsPerKm;
    const spacing = 0.17;
    const first = Math.floor((this.cameraKm - visibleRange) / spacing);
    const last = Math.ceil((this.cameraKm + visibleRange) / spacing);
    for (let marker = first; marker <= last; marker += 1) {
      const km = marker * spacing;
      if (km < 0 || km > this.race.road.lengthKm) continue;
      const density = this.race.road.spectatorDensityAt(km);
      if (density < 0.24 && Math.abs(marker) % 4 !== 0) continue;
      const x = Math.round(focusX + (km - this.cameraKm) * pixelsPerKm);
      if (x < -70 || x > this.width + 70) continue;
      const y = Math.round(this.sideSurfaceY(km) - SIDE_ROAD_ASPHALT_WIDTH / 2 - 5);
      const variant = Math.abs(marker) % 7;
      const bodyColors = ["#df5a52", "#58b7d4", "#f0c744", "#ece7d8", "#70a56b"];

      if (variant === 0) {
        // Autocaravana aparcada en los puertos y zonas de público.
        ctx.fillStyle = "#17212a";
        ctx.fillRect(x - 25, y - 25, 52, 25);
        ctx.fillStyle = "#eee9da";
        ctx.fillRect(x - 22, y - 22, 46, 19);
        ctx.fillStyle = "#61b9d1";
        ctx.fillRect(x - 17, y - 18, 13, 8);
        ctx.fillRect(x + 2, y - 18, 12, 8);
        ctx.fillStyle = "#df5a52";
        ctx.fillRect(x - 22, y - 7, 46, 5);
        ctx.fillStyle = "#17212a";
        ctx.fillRect(x - 17, y - 5, 10, 7);
        ctx.fillRect(x + 11, y - 5, 10, 7);
      } else if (variant <= 3) {
        // Coches de aficionados, orientados en el sentido de carrera.
        const color = bodyColors[variant];
        ctx.fillStyle = "#17212a";
        ctx.fillRect(x - 22, y - 13, 44, 13);
        ctx.fillStyle = color;
        ctx.fillRect(x - 19, y - 15, 34, 12);
        ctx.fillRect(x - 10, y - 22, 19, 8);
        ctx.fillStyle = "#bde1e8";
        ctx.fillRect(x - 7, y - 20, 7, 6);
        ctx.fillRect(x + 2, y - 20, 6, 6);
        ctx.fillStyle = "#101820";
        ctx.fillRect(x - 15, y - 5, 8, 7);
        ctx.fillRect(x + 10, y - 5, 8, 7);
      } else {
        // Bicicleta apoyada y un aficionado animando junto a ella.
        ctx.strokeStyle = "#101820";
        ctx.lineWidth = 3;
        for (const wheelX of [x - 13, x + 13]) {
          ctx.beginPath();
          ctx.arc(wheelX, y - 8, 8, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.strokeStyle = bodyColors[variant - 3];
        ctx.beginPath();
        ctx.moveTo(x - 13, y - 8);
        ctx.lineTo(x - 1, y - 19);
        ctx.lineTo(x + 4, y - 8);
        ctx.lineTo(x - 13, y - 8);
        ctx.moveTo(x + 4, y - 8);
        ctx.lineTo(x + 13, y - 8);
        ctx.lineTo(x + 7, y - 20);
        ctx.lineTo(x - 1, y - 19);
        ctx.stroke();
        const fanX = x + 27;
        const wave = Math.floor(this.race.elapsed * 5 + marker) % 2;
        ctx.fillStyle = "#d59a70";
        ctx.fillRect(fanX - 3, y - 43, 7, 7);
        ctx.fillStyle = bodyColors[variant - 3];
        ctx.fillRect(fanX - 6, y - 35, 12, 18);
        ctx.fillStyle = "#17212a";
        ctx.fillRect(fanX - 5, y - 17, 4, 17);
        ctx.fillRect(fanX + 2, y - 17, 4, 17);
        ctx.fillStyle = "#d59a70";
        ctx.fillRect(fanX - 12, y - 34 - wave * 7, 7, 4);
        ctx.fillRect(fanX + 5, y - 41 + wave * 7, 7, 4);
      }
    }
  }

  renderLateralSpectators(ctx, focusX, pixelsPerKm) {
    const visibleRange = this.width / pixelsPerKm;
    const spacing = 0.02;
    const first = Math.floor((this.cameraKm - visibleRange) / spacing);
    const last = Math.ceil((this.cameraKm + visibleRange) / spacing);
    const colors = ["#ffcc33", "#ef476f", "#62d8f2", "#f4f1e9", "#9b5de5", "#2fbf71"];
    for (let marker = first; marker <= last; marker += 1) {
      const km = marker * spacing;
      if (km < 0 || km > this.race.road.lengthKm) continue;
      const density = this.race.road.spectatorDensityAt(km);
      if (!density || Math.abs((marker * 3) % 10) / 10 > density) continue;
      const x = focusX + (km - this.cameraKm) * pixelsPerKm;
      if (x < -10 || x > this.width + 10) continue;
      // El público se sitúa en el arcén del fondo, no sobre el centro de la
      // calzada. Así los ciclistas no parecen atravesarlo al subir.
      const y = this.sideSurfaceY(km) - SIDE_ROAD_ASPHALT_WIDTH / 2 - 2;
      const wave = Math.floor(this.race.elapsed * 6 + marker) % 2;
      const rows = density > 0.82 ? [2, 1, 0] : density > 0.7 && marker % 2 === 0 ? [1, 0] : [0];
      for (const row of rows) {
        const rowX = x + row * 11;
        const rowY = y - row * 10;
        ctx.fillStyle = "#d59a70";
        ctx.fillRect(rowX - 3, rowY - 38, 7, 7);
        ctx.fillStyle = colors[Math.abs(marker + row) % colors.length];
        ctx.fillRect(rowX - 6, rowY - 30, 12, 16);
        ctx.fillStyle = "#17212a";
        ctx.fillRect(rowX - 6, rowY - 14, 4, 14);
        ctx.fillRect(rowX + 2, rowY - 14, 4, 14);
        ctx.fillStyle = "#d59a70";
        ctx.fillRect(rowX - 12, rowY - 29 - wave * 6, 7, 4);
        ctx.fillRect(rowX + 5, rowY - 36 + wave * 6, 7, 4);
        if (marker % 17 === 0 && row === 0) {
          ctx.fillStyle = colors[Math.abs(marker + 2) % colors.length];
          ctx.fillRect(rowX - 15, rowY - 53, 30, 10);
          ctx.fillStyle = "#f4f1e9";
          ctx.fillRect(rowX - 10, rowY - 50, 20, 4);
        }
        if (row === 0 && Math.abs(marker) % 13 === 0) {
          // Banderas grandes, animadas en dos posiciones pero ancladas al
          // terreno para que no vibren con el desplazamiento.
          const flagWave = Math.floor(this.race.elapsed * 4 + marker) % 2;
          const flagColors = ["#ffcc33", "#62d8f2", "#ef476f", "#f4f1e9"];
          ctx.fillStyle = "#e8edf0";
          ctx.fillRect(rowX + 10, rowY - 67, 3, 67);
          ctx.fillStyle = flagColors[Math.abs(marker) % flagColors.length];
          ctx.fillRect(rowX + 13, rowY - 65, 22 + flagWave * 5, 10);
          ctx.fillStyle = "#101820";
          ctx.fillRect(rowX + 13, rowY - 55, 15 + flagWave * 3, 3);
        }
      }
    }
  }

  renderLateralFinish(ctx, focusX, pixelsPerKm) {
    const finishKm = this.race.road.lengthKm;
    const x = focusX + (finishKm - this.cameraKm) * pixelsPerKm;
    if (x < -80 || x > this.width + 80) return;
    const y = this.sideSurfaceY(finishKm);
    const structureScale = this.raceStructureScale();
    const halfWidth = Math.max(SIDE_ROAD_ASPHALT_WIDTH / 2 + 9, Math.round(78 * structureScale));
    const gateHeight = Math.round(SIDE_FINISH_GATE_HEIGHT * structureScale);
    const headerHeight = Math.max(27, Math.round(46 * structureScale));
    ctx.fillStyle = "#101820";
    ctx.fillRect(x - halfWidth - 7, y - gateHeight, 14, gateHeight);
    ctx.fillRect(x + halfWidth - 7, y - gateHeight, 14, gateHeight);
    ctx.fillRect(x - halfWidth - 12, y - gateHeight - 6, halfWidth * 2 + 24, headerHeight);
    ctx.fillStyle = "#ffcc33";
    ctx.fillRect(x - halfWidth - 6, y - gateHeight, halfWidth * 2 + 12, Math.max(21, headerHeight - 11));
    ctx.fillStyle = "#101820";
    ctx.font = `bold ${Math.max(10, Math.round(18 * structureScale))}px Menlo, Monaco, Consolas, monospace`;
    ctx.textAlign = "center";
    ctx.fillText("META", x, y - gateHeight + Math.max(17, headerHeight * 0.62));
    for (let cell = -11; cell <= 11; cell += 1) {
      ctx.fillStyle = cell % 2 ? "#f8f5eb" : "#101820";
      ctx.fillRect(x + cell * 7, y - 5, 7, 5);
    }
  }

  renderLateralGroupMarkers(ctx, focusX, pixelsPerKm) {
    if (this.race.groups.length < 2) return;
    const occupiedLabels = [];
    for (const group of this.race.groups) {
      const x = focusX + (group.leader.distance - this.cameraKm) * pixelsPerKm;
      if (x < 10 || x > this.width - 10) continue;
      const width = Math.min(240, this.width - 16);
      const panelX = Math.round(clamp(x - width / 2, 8, this.width - width - 8));
      const baseY = Math.round(clamp(this.sideSurfaceY(group.leader.distance) - 100, 36, this.height - 80));
      let y = baseY;
      for (let attempt = 0; attempt < 6; attempt += 1) {
        const overlaps = occupiedLabels.some((label) =>
          panelX < label.x + label.width && panelX + width > label.x && y < label.y + 44 && y + 44 > label.y);
        if (!overlaps) break;
        const direction = attempt % 2 ? -1 : 1;
        y = Math.round(clamp(baseY + direction * Math.ceil((attempt + 1) / 2) * 46, 36, this.height - 80));
      }
      occupiedLabels.push({ x: panelX, y, width });
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = "rgba(8,20,32,.92)";
      ctx.fillRect(panelX, y, width, 42);
      ctx.strokeStyle = "#05090e";
      ctx.lineWidth = 3;
      ctx.strokeRect(panelX + 1.5, y + 1.5, width - 3, 39);
      ctx.fillStyle = group.leader.color;
      ctx.fillRect(panelX + 3, y + 3, 6, 36);
      ctx.beginPath();
      ctx.rect(panelX + 10, y + 3, width - 14, 36);
      ctx.clip();
      ctx.fillStyle = "#f8f5eb";
      ctx.font = "bold 10px Menlo, Monaco, Consolas, monospace";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      const title = this.fitCanvasText(
        ctx,
        `${group.label} · ${group.leader.flag || ""} ${group.leader.name}`,
        width - 25
      );
      ctx.fillText(title, panelX + 13, y + 8);
      ctx.fillStyle = "#ffcc33";
      ctx.fillText(`${group.riders.length} ciclistas`, panelX + 13, y + 25);
      ctx.restore();
      ctx.fillStyle = group.leader.color;
      ctx.fillRect(Math.round(x - 1), y + 42, 3, Math.max(4, Math.round(this.sideSurfaceY(group.leader.distance) - y - 42)));
    }
  }

  render() {
    const ctx = this.ctx;
    const weather = this.race ? this.race.weather.intensity : 0;
    this.riderHitAreas.length = 0;
    ctx.save();
    const shake = !this.reducedMotion && this.cameraMode === "side" && this.cameraShake > 0
      ? this.cameraShake * 2 : 0;
    ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    ctx.translate(this.width / 2, this.height / 2);
    ctx.scale(this.cameraZoom, this.cameraZoom);
    ctx.translate(-this.width / 2, -this.height / 2);
    if (this.cameraMode === "side" && this.race) {
      this.renderLateralScene(ctx, weather);
    } else {
      this.renderBackdrop(ctx, weather);
      this.renderRoad(ctx);
      this.renderCyclists(ctx);
      this.renderGroupMarkers(ctx);
    }
    this.particles.render(ctx);
    ctx.restore();
  }

  loop(timestamp) {
    const frameStarted = performance.now();
    const dt = this.lastTimestamp ? Math.min(0.05, (timestamp - this.lastTimestamp) / 1000) : 0;
    this.lastTimestamp = timestamp;
    const updateStarted = performance.now();
    const updateSteps = this.state === "RACING" && this.raceSpeed === 5 ? 5 : 1;
    for (let step = 0; step < updateSteps; step += 1) {
      this.update(dt);
      if (this.state !== "RACING") break;
    }
    const updateEnded = performance.now();
    this.render();
    const renderEnded = performance.now();
    const stats = this.performanceStats;
    stats.frames += 1;
    stats.updateTotal += updateEnded - updateStarted;
    stats.renderTotal += renderEnded - updateEnded;
    stats.frameTotal += renderEnded - frameStarted;
    const sampleDuration = renderEnded - stats.sampleStarted;
    if (sampleDuration >= 1000) {
      stats.fps = stats.frames * 1000 / sampleDuration;
      stats.updateMs = stats.updateTotal / stats.frames;
      stats.renderMs = stats.renderTotal / stats.frames;
      stats.frameMs = stats.frameTotal / stats.frames;
      stats.frames = 0;
      stats.updateTotal = 0;
      stats.renderTotal = 0;
      stats.frameTotal = 0;
      stats.sampleStarted = renderEnded;
    }
    requestAnimationFrame(this.loop);
  }
}

window.CiclimoTourRace = Race;
window.UltimoPuertoRace = Race;
window.createCiclimoTourCalendar = createTourCalendar;
window.createCiclimoQuickStage = createQuickStage;
window.ciclimoTourGame = new Game();
window.ultimoPuertoGame = window.ciclimoTourGame;
if ("serviceWorker" in navigator && ["http:", "https:"].includes(window.location.protocol)) {
  navigator.serviceWorker.register("./service-worker.js").catch(() => {
    // El juego sigue siendo completamente funcional si el navegador bloquea el modo offline.
  });
}

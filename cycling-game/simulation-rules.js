"use strict";

const fatigueRules = Object.freeze({
  carry: 0.82,
  previousLoad: 0.2,
  baseLoad: 11,
  maximumStageLoad: 30,
  maximumFatigue: 96
});

const objectiveForStage = (stage) => {
  if (stage?.type === "itt") {
    return { id: "itt-top-25", label: "TOP 25 EN LA CRONO", description: "Termina entre los 25 primeros." };
  }
  if (stage?.profile === "mountain") {
    return { id: "mountain-points", label: "SUMA EN MONTAÑA", description: "Consigue al menos un punto de montaña." };
  }
  if (stage?.profile === "flat") {
    return { id: "flat-top-10", label: "TOP 10 DE ETAPA", description: "Llega entre los diez primeros." };
  }
  return { id: "mixed-top-15", label: "TOP 15 DE ETAPA", description: "Termina entre los quince primeros." };
};

const objectiveCompleted = (objective, race, position) => {
  if (!objective || !race) return false;
  if (objective.id === "itt-top-25") return position <= 25;
  if (objective.id === "mountain-points") return race.player.mountainPoints > 0;
  if (objective.id === "flat-top-10") return position <= 10;
  return position <= 15;
};

globalThis.CiclimoRules = Object.freeze({
  fatigue: fatigueRules,
  objectiveForStage,
  objectiveCompleted
});

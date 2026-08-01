"use strict";

globalThis.CiclimoUI = Object.freeze({
  minimumTouchTarget: 44,
  riskLabel(rider) {
    const danger = (rider?.riskAccumulator || 0) + Math.max(0, 65 - (rider?.grip || 100)) * 0.08;
    if (danger >= 4) return { label: "ALTO", level: "high" };
    if (danger >= 1.7) return { label: "MEDIO", level: "medium" };
    return { label: "BAJO", level: "low" };
  },
  riderState(race, rider) {
    if (!race || !rider) return "EN GRUPO";
    if (rider.draft >= 12) return "A RUEDA";
    if (race.isolationExposureFor(rider) > 0.45) return "AISLADO";
    return "EN GRUPO";
  }
});

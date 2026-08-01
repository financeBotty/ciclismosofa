"use strict";

globalThis.CiclimoRender = Object.freeze({
  lateralViewportScale(viewportWidth) {
    if (viewportWidth <= 480) return 0.66;
    if (viewportWidth <= 900) return 0.76;
    return 1;
  },
  raceStructureScale(viewportWidth) {
    if (viewportWidth <= 520) return 0.58;
    if (viewportWidth <= 900) return 0.72;
    return 1;
  }
});

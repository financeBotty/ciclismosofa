"use strict";

globalThis.CiclimoRender = Object.freeze({
  lateralViewportScale(viewportWidth) {
    if (viewportWidth <= 480) return 0.73;
    if (viewportWidth <= 900) return 0.82;
    return 1;
  },
  topRiderScale(viewportWidth) {
    return viewportWidth <= 900 ? 1.12 : 1;
  },
  raceStructureScale(viewportWidth) {
    if (viewportWidth <= 520) return 0.58;
    if (viewportWidth <= 900) return 0.72;
    return 1;
  }
});

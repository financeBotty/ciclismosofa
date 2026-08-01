"use strict";

globalThis.CiclimoRender = Object.freeze({
  lateralViewportScale(viewportWidth) {
    if (viewportWidth <= 480) return 0.66;
    if (viewportWidth <= 900) return 0.76;
    return 1;
  }
});

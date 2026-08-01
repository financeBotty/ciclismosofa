"use strict";

const storageGet = (key, fallback = null) => {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : value;
  } catch {
    return fallback;
  }
};

const storageSet = (key, value) => {
  try {
    localStorage.setItem(key, String(value));
    return true;
  } catch {
    return false;
  }
};

const storageRemove = (key) => {
  try {
    localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
};

const parseJson = (value, fallback = null) => {
  try {
    return value === null || value === undefined ? fallback : JSON.parse(value);
  } catch {
    return fallback;
  }
};

globalThis.CiclimoStorage = Object.freeze({
  get: storageGet,
  set: storageSet,
  remove: storageRemove,
  parse: parseJson
});

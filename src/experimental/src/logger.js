let DEBUG = false;

export function setDEBUG(value) {
  DEBUG = !!value;
}

export function log(...data) {
  if (!DEBUG) return;
  console.log(...data);
}

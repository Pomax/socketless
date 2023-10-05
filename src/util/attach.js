// helper function to make defineProperty easier to use.
export function attach(object, fname, value) {
  Object.defineProperty(object, fname, {
    enumerable: false,
    configurable: false,
    writable: false,
    value: value,
  });
}

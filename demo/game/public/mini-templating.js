(function buildTagFunctions(global) {
  // Just enough tags to generate all the client content
  const tags = [
    `a`,
    `button`,
    `div`,
    `footer`,
    `h1`,
    `h2`,
    `li`,
    `ol`,
    `main`,
    `p`,
    `section`,
    `span`,
    `strong`,
    `ul`
  ];

  // Create functions for each tag. Will this pollute window?
  // Hell yes it will. Does that matter? Not even slightly.
  tags.forEach(tag => {
    global[tag] = function(options, ...content) {
      // The first argument may not be an options object, but just
      // child content for this particular element.
      if (
        typeof options !== `object` ||
        options instanceof Array ||
        options instanceof HTMLElement
      ) {
        content.unshift(options);
        options = {};
      }

      // Set up the element itself
      const e = document.createElement(tag);

      // Bind any attributes/properties based on the options object:
      Object.keys(options).forEach(opt => {
        value = options[opt];
        if (opt.startsWith(`data-`)) {
          opt = opt.replace(`data-`, ``);
          e.dataset[opt] = value;
        }
        if (opt === `dataset`) {
          Object.keys(value).forEach(k => (e.dataset[k] = value[k]));
        }
        if (opt.startsWith(`on-`) && value) {
          opt = opt.replace(`on-`, ``);
          e.addEventListener(opt, value);
        }
        e[opt] = value;
      });

      // Define how to inject individual childre...
      const process = c => {
        if (c === false || c === null || c === undefined) return;
        let t = typeof c;
        if (t === `string` || t === `number`)
          e.appendChild(document.createTextNode(c));
        else if (c instanceof Array) c.forEach(process);
        else {
          try {
            e.appendChild(c);
          } catch (e) {
            console.error(`Could not appendChild in ${tag}:`, c);
          }
        }
      };

      // And then process each supposed child.
      content.forEach(process);

      return e;
    };
  });

  // And this one exists mostly because sometimes you need
  // an array.map based on an empty, but sized, array.
  global.makearray = function(n = 0) {
    return new Array(n).fill(undefined);
  };

  // Always useful to have a class builder available, too.
  function classes(...args) {
    return args
      .map(toClassString)
      .join(" ")
      .trim();
  }

  function toClassString(thing) {
    if (typeof thing === "string") return thing;
    if (thing instanceof Array) return classes(thing);
    if (typeof thing === "object")
      return Object.keys(thing)
        .map(k => (!!thing[k] ? k : false))
        .filter(v => v)
        .join(" ")
        .trim();
  }

  global.classes = classes;
})(this);

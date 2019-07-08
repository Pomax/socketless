(function buildTagFunctions(global) {
  // Just enough tags to generate all the client content
  const tags = [
    `a`,
    `button`,
    `div`,
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
      if (typeof options !== `object` || options instanceof HTMLElement) {
        content.unshift(options);
        options = {};
      }

      // Set up the element itself
      const e = document.createElement(tag);

      // Bind any attributes/properties based on the options object:
      Object.keys(options).forEach(opt => {
        value = options[opt];
        if (opt.startsWith("data-")) {
          opt = opt.replace("data-", "");
          e.dataset[opt] = value;
        }
        if (opt.startsWith("on-")) {
          opt = opt.replace("on-", "");
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
  global.makearray = n => new Array(n).fill(undefined);
})(this);

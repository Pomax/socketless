(function buildTagFunctions(global) {
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

  tags.forEach(tag => {
    if (!tag) return;

    global[tag] = function(options, ...content) {
      if (typeof options !== `object` || options instanceof HTMLElement) {
        content.unshift(options);
        options = {};
      }

      const e = document.createElement(tag);

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

      const process = c => {
        if (c === false || c === null || c === undefined) return;
        let t = typeof c;
        if (t === `string` || t === `number`) {
          e.appendChild(document.createTextNode(c));
        } else if (c instanceof Array) {
          c.forEach(process);
        } else {
          try {
            e.appendChild(c);
          } catch (e) {
            console.error(`Could not appendChild in ${tag}:`, c);
          }
        }
      };

      content.forEach(process);

      return e;
    };
  });

  global.makearray = n => new Array(n).fill(undefined);
})(this);

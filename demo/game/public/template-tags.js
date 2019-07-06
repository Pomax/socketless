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
    `ul`
  ];

  tags.forEach(tag => {
    if (!tag) return;

    global[tag] = function(options, ...content) {
      if (typeof options === `string` || options instanceof HTMLElement) {
        content.unshift(options);
        options = {};
      }

      const e = document.createElement(tag);
      
      Object.keys(options).forEach(opt => {
        value = options[opt];

        if (opt.startsWith('data-')) {
          opt = opt.replace('data-','');
          e.dataset[opt] = value;
        }

        if (opt.startsWith('on-')) {
          opt = opt.replace('on-','');
          e.addEventListener(opt, value);
        }

        e[opt] = value;
      });

      content.forEach(c => {
        if (c === undefined) return;
        let t = typeof c;
        if (t === `string` || t === `number`) {
          e.appendChild(document.createTextNode(c));
        } else {
          e.appendChild(c);
        }
      });

      return e;
    };
  });
})(this);

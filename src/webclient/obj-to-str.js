/**
 * I can't believe I had to write this code in 2019...
 */
function objectToString(object, depth=0, indent=2) {
    const outerpadding = ' '.repeat(indent * depth);
    const innerpadding = ' '.repeat(indent + indent * depth);
    let keys = Object.keys(object);
    let serializations = keys.map(key => {
        const val = object[key];
        key = `${innerpadding}${key}`;
        if (val === undefined) return `${key}: undefined`;
        if (val === null) return `${key}: null`;
        if (typeof val === "boolean") return `${key}: ${val}`;
        if (typeof val === "number") return `${key}: ${val}`;
        if (typeof val === "string") return `${key}: "${val.replace(/"/g, '\\"')}"`;
        if (typeof val === "function") return `${key}: ${val.toString()}`;
        if (typeof val === "object") {
            if (val instanceof Array) {
                return `${key}: [${ val.map(val => {
                    if (typeof val === "object") return objectToString(val);
                    if (typeof val === "string") return `"${val.replace(/"/g, '\\"')}"`;
                    return val.toString();
                }) }]`;
            }
            return `${key}: ${objectToString(val, depth+1)}`;
        }
    });

    return [
        `${outerpadding}{`,
        serializations.join(`,\n`),
        `${outerpadding}}`
    ].join(`\n`);
}

module.exports = objectToString;

/*
a = {
    client: {
        test: function letsdothis() {
            console.log(this);
        },
        what: 4
    },
    server: {
        list: [`what"'what`, 'cake', 'yep'],
        no: "no"
    }
};

console.log(objectToString(a));
*/

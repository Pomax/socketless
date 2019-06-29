module.exports = function generate404(location, response) {
    // We're going to assume any bad URL is a 404. Even if it's an attempt at "h4x0r3s"
    console.error(`Can't serve ${location}, so it probably doesn't exist`);
    response.writeHead(404, { "Content-Type": `text/html` });
    response.end(`<doctype html><html><body>Yeah this isn't a page</html>`);
};

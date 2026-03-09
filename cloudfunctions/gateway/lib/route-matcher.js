function compilePath(pathPattern) {
  const keys = [];
  const escaped = pathPattern
    .split("/")
    .map((segment) => {
      if (segment.startsWith(":")) {
        keys.push(segment.slice(1));
        return "([^/]+)";
      }
      return segment;
    })
    .join("/");

  return {
    regex: new RegExp(`^${escaped}$`),
    keys,
  };
}

function createRouteMeta(method, path) {
  const { regex, keys } = compilePath(path);
  return {
    method: String(method).toUpperCase(),
    path,
    regex,
    keys,
  };
}

function pickRoute(routes, method, path) {
  const incomingMethod = String(method || "GET").toUpperCase();
  const incomingPath = path || "";
  for (const route of routes) {
    if (route.method !== incomingMethod) continue;
    const matched = incomingPath.match(route.regex);
    if (!matched) continue;
    const params = {};
    route.keys.forEach((key, idx) => {
      params[key] = matched[idx + 1];
    });
    return { route, params };
  }
  return null;
}

module.exports = {
  createRouteMeta,
  pickRoute,
};

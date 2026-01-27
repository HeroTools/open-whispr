const { app } = require("electron");
const os = require("os");
const path = require("path");

function getModelsDirForService(service) {
  const homeDir = app?.getPath?.("home") || os.homedir();
  return path.join(homeDir, ".cache", "openwhispr", `${service}-models`);
}

module.exports = { getModelsDirForService };

let Transres = require("./transres");
let TinyArticles = require("./tinyarticles");
let Contest = require("./contest");
let Undoer = require("./undoer");

function loadModules() {
  let moduleList = [
    Transres,
    TinyArticles,
    Contest,
    Undoer,
  ];

  let modules = {};

  for (let i = 0; i < moduleList.length; i++) {
    modules[moduleList[i].id] = moduleList[i];
  }

  return modules;
}

module.exports = {
  loadModules,
}
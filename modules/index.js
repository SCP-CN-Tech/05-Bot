let Transres = require("./transres");
let TinyArticles = require("./tinyarticles");

function loadModules() {
  let moduleList = [
    Transres,
    TinyArticles,
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
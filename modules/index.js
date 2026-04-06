let Transres = require("./transres");
let TinyArticles = require("./tinyarticles");
let Contest = require("./contest");
let Undoer = require("./undoer");
let AntiSpam = require("./antispam");
let TagUpdate = require("./tagupdate");
let ComponentUpdate = require("./componentupdate");

function loadModules() {
  let moduleList = [
    Transres,
    TinyArticles,
    Contest,
    Undoer,
    AntiSpam,
    TagUpdate,
    ComponentUpdate,
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
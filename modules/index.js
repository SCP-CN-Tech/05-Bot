let Transres = require("./transres");

function loadModules() {
  let moduleList = [
    Transres,
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
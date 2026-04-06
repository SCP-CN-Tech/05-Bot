let BaseModule = require("./base");
const fs = require("fs");
const winston = require('winston');

/**
 * Module that handles mass component variable updates.
 */
class ComponentUpdateModule extends BaseModule {
  static id = "ComponentUpdate";

  constructor(config, sites) {
    super(config);

    this.site = sites[config.site];
    this.component = this.config.component;
    this.var = this.config.variable;
  }

  async replaceComponent(list) {
    let component = new RegExp(`\\[\\[include (:${this.site.base}:)?${this.component}(?![^\\]]{0,}\\|\\s*${this.var.name}\s*)([^\\]]{0,})\\]\\]`, "g");
    for (let i = 0; i < list.length; i++) {
      let name = list[i].url.split('/').pop();
      let source = (await this.site.source(parseInt(list[i].pageId))).body;
      // if (component.test(source)) {
        try {
          winston.verbose(`[Component updater] Updating page ${name}`);
          await this.site.edit(name, {
            source: source.replace(component,
              (_match, p1, p2)=>`[[include ${p1 || ''}${this.component}\n|${this.var.name}=${this.var.default}${p2}]]`),
            title: list[i].title,
            comments: `Automatic update for ${this.component}`
          });
        } catch (e) {
          if (e.message!='Response code 500 (Internal Server Error)') winston.error(`[Component updater] Failed to update page ${name}: ${e.stack}`)
        }
      // }
      if (progressAlert(i)) {
        winston.info(`[Component updater] Updating component usage: ${i}/${list.length}`)
      }
      await (new Promise((resolve)=>{ setTimeout(()=>{ resolve() }, 3000)}));
    }
    winston.info(`[Component updater] Updating component usage: ${list.length}/${list.length}`)
    winston.info(`[Component updater] Component usage update completed.`)
    process.exit(0)
  }

  async start() {
    let res = await this.site.listBacklink(this.component);
    // console.log(res);
    fs.writeFileSync('./data/batch-change-backrooms.json', JSON.stringify(res,null,2), 'utf8');;
    // await this.replaceComponent(res);
  }

  async stop() {}
}

module.exports = ComponentUpdateModule;

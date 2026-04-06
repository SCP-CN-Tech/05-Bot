let BaseModule = require("./base");

/**
 * Module that handles orphaned fragment pages listing.
 */
class OrphanedFragmentsModule extends BaseModule {
  static id = "OrphanedFragments";

  constructor(config, sites) {
    super(config);

    this.site = sites[config.site];
  }

  async fragment() {
    let pageinfo = await this.site.listPages({
      category: 'fragment',
      tags: '-段落 -补充材料',
      order: "created_at desc desc",
      perPage: "500",
      separate: "false",
      module_body: `[[head]]
      [[table class="wiki-content-table"]]
      [[/head]]
      [[body]]
      [[row]]
      [[cell]]
      %%created_by%%
      [[/cell]]
      [[cell]]
      %%created_by_unix%%
      [[/cell]]
      [[cell]]
      %%created_by_id%%
      [[/cell]]
      [[cell]]
      %%name%%
      [[/cell]]
      [[cell]]
      %%fullname%%
      [[/cell]]
      [[cell]]
      %%title%%
      [[/cell]]
      [[cell]]
      %%created_at|%Y-%m-%d|hover%%
      [[/cell]]
      [[/row]]
      [[/body]]
      [[foot]]
      [[/table]]
      [[/foot]]`
    });
    return pageinfo;
  }

  async start() {
    let res = await this.fragment();
    console.log(res);
  }

  async stop() {}
}

module.exports = OrphanedFragmentsModule;

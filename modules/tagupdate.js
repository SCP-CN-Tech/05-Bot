let BaseModule = require("./base");
const fs = require("fs");
const cheerio = require('cheerio');
const winston = require('winston');
const { delayMs } = require("../util");

/**
 * Module that handles mass tag updates.
 */
class TagUpdateModule extends BaseModule {
  static id = "TagUpdate";

  constructor(config, sites) {
    super(config);

    this.site = sites[config.site];
  }
  
  async countPagesWithTags(tags) {
    let info = await this.site.countPages({
      category: "*",
      pagetype: "*",
      tags,
    });
    return info
  }

  async getPagesWithTags(tags) {
    let count = await this.countPagesWithTags(tags);
    let info = await this.site.listPages({
      category: "*",
      pagetype: "*",
      tags,
      order: "created_at desc desc",
      perPage: `${1000 > count ? 1000 : count+200}`,
      separate: "false",
      module_body: `[[head]]
      [[table class="results"]]
      [[/head]]
      [[body]]
      [[row]]
      [[cell]]
      %%fullname%%
      [[/cell]]
      [[cell]]
      %%_tags%% %%tags%%
      [[/cell]]
      [[/row]]
      [[/body]]
      [[foot]]
      [[/table]]
      [[/foot]]`
    });
    return info;
  }

  async getPagesWithTagsJson(tags) {
    let res = await this.getPagesWithTags(tags);
    let time = res.CURRENT_TIMESTAMP*1000;
    let info = [];
    let $ = cheerio.load(res.body);
    //console.log(res.body)
    let all = $('table.results').find('tr');
    for (let i = 0; i < all.length; i++) {
      winston.debug(`[Tag updater] Retrieving page record ${i+1} of ${all.length}`)
      let meta = $(all[i]).children('td');
      let rawname = $(meta[0]).text().trim();
      let pageinfo = {
        url: `${this.site.domain}/${rawname}`,
        page: rawname,
        tags: $(meta[1]).text().trim(),
      }
      info.push(pageinfo);
    }
    return {
      retrieved: time,
      data: info,
    };
  }

  async massUpdateTag(pageList, oldTag, newTag) {
    for (let i = 0; i < pageList.length; i++) {
      try {
        winston.verbose(`[Tag updater] Updating page tags for ${pageList[i].page} (${i+1} of ${pageList.length})`);
        await this.site.setTags(pageList[i].page, pageList[i].tags.split(" ").map(v=>v==oldTag?newTag:v));
        await delayMs(this.delayMs);
      } catch (e) {
        winston.error(`[Tag updater] Tags not updated for ${pageList[i].page}: ${e.message}`);
      }
    }
    
  }

  async start() {
    let res = await this.getPagesWithTagsJson(`+${this.config.from}`);
    fs.writeFileSync('./data/replace-tags.json', JSON.stringify(res, null, 2), 'utf8');

    await this.massUpdateTag(res.data, this.config.from, this.config.to);
  }

  async stop() {}
}

module.exports = TagUpdateModule;

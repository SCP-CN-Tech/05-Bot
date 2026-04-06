let BaseModule = require("./base");
const fs = require("fs");
const cheerio = require('cheerio');
const winston = require('winston');

/**
 * Module that handles uncommon tags listing.
 */
class UncommonTagsModule extends BaseModule {
  static id = "UncommonTags";

  constructor(config, sites) {
    super(config);

    this.site = sites[config.site];
    this.config.threshold;
    this.params = {
      maxFontSize: this.config.max ?? "1000%",
      minFontSize: this.config.min ?? "1%",
    }
  }

  async start() {
    this.site.tagCloud(params).then(async res=>{
      let tag = [];
      // console.log(res)
      let $ = cheerio.load(res.body)
      let tags = $(".pages-tag-cloud-box").find("a");
      let size = /font\-size\: (\d+)\%/;
      for (let i = 0; i < tags.length; i++) {
        let d = $(tags[i]).attr("style").match(size)[1];
        if (parseInt(d) <= this.config.threshold) {
          let name = $(tags[i]).text();
          let count = await this.site.countPages({ tag: name });
          tag.push({ name, count });
        }
        if (!(i%100)) {
          winston.info(`[Tags lister] Processing tags: ${i}/${tags.length}`)
        }
      }
      fs.writeFileSync('./data/uncommon-tags.json', JSON.stringify(tag,null,2), 'utf8');
      winston.info(`[Tags lister] Processing tags: ${tags.length}/${tags.length}`);
      winston.info(`[Tags lister] Uncommon tags listed.`);
      process.exit(0);
    });
  }

  async stop() {}
}

module.exports = UncommonTagsModule;

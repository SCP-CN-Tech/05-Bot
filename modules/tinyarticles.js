let BaseModule = require("./base");
const cheerio = require('cheerio');
const winston = require('winston');
const { parseTime } = require('../util');

/**
 * Module that handles tiny articles management.
 */
class TinyArticlesModule extends BaseModule {
  static id = "TinyArticles";
  interval = 10800000;   //  3h
  threshold = -5;

  constructor(config, sites) {
    super(config);

    this.categories = config.categories;
    this.site = sites[config.site];
    if (config.threshold) this.threshold = config.threshold;
    if (config.schedule) this.interval = parseTime(config.schedule);
  }
  
  async getInfo(params) {
    let info = [];
    let res = await this.site.listPages(Object.assign({
      category: "log-of-anomalous-items-cn",
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
      [[cell]]
      %%rating%%
      [[/cell]]
      [[/row]]
      [[/body]]
      [[foot]]
      [[/table]]
      [[/foot]]`
    }, params));
    let $ = cheerio.load(res.body);
    // console.log(res.body)

    let all = $('table').find('tr');
  
    // find pagination to see if we have missed things
    let pager = $('.pager');
    let isPaginated = !!pager.length;
    let pages = 1;
    if (isPaginated) {
      let pagerNum = pager.find("span.pager-no").text().trim();
      pages = pagerNum.match(/page \d+ of (\d+)/i)?.[1];
      winston.debug(`[TinyArticles] Found ${pages} pages of with ${all.length} per page.`)
    }

    for (let i = 0; i < all.length; i++) {
      winston.debug(`[TinyArticles] Retreiving record ${i+1} of ${all.length}`)
      let meta = $(all[i]).children('td')
      let rawname = $(meta[4]).text().trim()
      let user = {
        displayName: $(meta[0]).text().trim(),
        unixname: $(meta[0]).text().trim()==="(user deleted)" ? null : $(meta[1]).text().trim(),
        id: $(meta[2]).text().trim(),
      }
      // extract user id if user is deleted
      if ($(meta[0]).text().trim()==="(user deleted)") {
        let $ = await this.site.history(rawname, {});
        $ = cheerio.load($.body);
        user.id = $("tbody").children("tr").last().find(`span[class="printuser deleted"]`).attr("data-id")
      }
      // extract page data
      let page = {
        url: `${this.site.base}/${rawname}`,
        rawname: rawname,
        author: user,
        title: $(meta[5]).text().trim(),
        score: parseInt($(meta[7]).text().trim()),
        created: parseInt($(meta[6]).children('span').attr('class').split(' ')[1].substring(5)+'000')
      }
      info.push(page);
    };
    return info;
  }

  async remove() {
    for (let i = 0; i < this.categories.length; i++) {
      let info = await this.getInfo({
        category: this.categories[i],
      rating: `<=${this.threshold}`,
      });
      info.forEach(v=>{
        if (v.score <= this.threshold) {
          this.site.delete(v.rawname).then(()=>{
            winston.verbose(`[TinyArticles] Deleted "${v.rawname}"`);
          }).catch(e=>{
            winston.warn(`[TinyArticles] ${e.name} at deleting "${v.rawname}": ${e.message}`);
          })
        }
      });
    }
  }

  async debug() {
    return await this.getInfo({
      created_at: null,
      category: "log-of-anomalous-items-cn",
      // category: "short-stories",
      rating: `<=${this.threshold}`,
    })
  }

  async start() {
    this.schedule = {
      remove: setInterval(()=>{
        return this.remove().catch(e=>winston.error(e.stack));
      }, this.interval),
    }
    this.remove().catch(e=>winston.error(e.stack));

    // this.debug().then(res=>{
    //   // fs.writeFileSync('./data/tiny-articles.json', JSON.stringify(res, null, 2), 'utf8')
    //   //console.log(res)
    //   console.log(`Retrieved ${res.length} records.`)
    // }).catch(e=>winston.error(e.stack))
  }

  async stop() {
    clearInterval(this.schedule.remove);
  }
}

module.exports = TinyArticlesModule;

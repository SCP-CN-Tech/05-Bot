let BaseModule = require("./base");
const fs = require("fs");
const cheerio = require('cheerio');
const winston = require('winston');
const nodeHtmlToImage = require('node-html-to-image');
const { everyHalfHour } = require('../util');

/**
 * Module that handles contest results generation.
 */
class ContestModule extends BaseModule {
  static id = "Contest";

  constructor(config, sites) {
    super(config);

    this.site = sites[config.site];
  }

  async listContestScore(tags) {
    let pageinfo = await this.site.listPages({
      category: "_default adult wanderers",
      tags,
      order: "rating desc",
      perPage: "1000",
      separate: "false",
      module_body: `[[head]]
      [[table class="results"]]
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
      [[cell]]
      +[[#expr (%%rating_votes%%+%%rating%%)/2]]
      [[/cell]]
      [[cell]]
      -[[#expr (%%rating_votes%%-%%rating%%)/2]]
      [[/cell]]
      [[/row]]
      [[/body]]
      [[foot]]
      [[/table]]
      [[/foot]]`});
    return pageinfo;
  }

  async listContestScoreJson(tags) {
    let res = await this.listContestScore(tags);
    let time = res.CURRENT_TIMESTAMP*1000;
    let info = [];
    let $ = cheerio.load(res.body);
    //console.log(res.body)
    let all = $('table.results').find('tr');
    for (let i = 0; i < all.length; i++) {
      winston.debug(`[Contest] Retreiving contest score record ${i+1} of ${all.length}`)
      let meta = $(all[i]).children('td');
      let rawname = $(meta[3]).text().trim();
      let user = {
        displayName: $(meta[0]).text().trim(),
        unixname: $(meta[0]).text().trim()==="(user deleted)" ? null : $(meta[1]).text().trim(),
        id: $(meta[2]).text().trim(),
      }
      if (user.displayName==="(user deleted)") {
        let $ = await this.site.history(rawname, {});
        $ = cheerio.load($.body);
        user.id = $("tbody").children("tr").first().find(`span[class="printuser deleted"]`).attr("data-id")
      }
      let pageinfo = {
        url: `${this.site.domain}/${rawname}`,
        page: rawname,
        title: $(meta[4]).text().trim(),
        score: parseInt($(meta[6]).text().trim()),
        upvote: parseInt($(meta[7]).text().trim()),
        downvote: -parseInt($(meta[8]).text().trim()),
        author: user,
        created: parseInt($(meta[5]).children('span').attr('class').split(' ')[1].substring(5)+'000'),
        ranking: i+1,
      }
      info.push(pageinfo);
    }
    return {
      retrieved: time,
      data: info,
    };
  }

  async listContestScoreFormatted(tags) {
    let pageinfo = await this.site.listPages({
      category: "_default adult wanderers wanderers-adult",
      tags,
      order: "rating desc",
      perPage: "1000",
      separate: "false",
      module_body: `[[head]]
      [[div style="background-color:#f0f0f0;padding:4%;margin: 5%;"]]
      [[/head]]
      [[body]]
      **{{%%index%%}}**. **[[a href="${this.site.domain}/%%fullname%%"]]%%title%%[[/a]]** **{{[[[#ifexpr %%rating%%>0 | + | ]]%%rating%% (+[[#expr (%%rating_votes%%+%%rating%%)/2]]/-[[#expr (%%rating_votes%%-%%rating%%)/2]])]}}**
      @@  @@##003e3e|{{**%%created_at|%m.%d%%  by [[a href="https://www.wikidot.com/user:info/%%created_by_unix%%"]]%%created_by%%[[/a]]**}}##
      [[/body]]
      [[foot]]
      [[/div]]
      [[/foot]]`});
    return pageinfo;
  }

  async start() {
    let listThings = () => {
      this.listContestScoreFormatted(this.config.tags).then(res=>{
        let time = new Date(res.CURRENT_TIMESTAMP*1000);
        let dateParts = [
          time.getFullYear(),
          ("0"+(time.getMonth()+1)).slice(-2),
          ("0"+time.getDate()).slice(-2),
          ("0"+time.getHours()).slice(-2),
          ("0"+time.getMinutes()).slice(-2),
          ("0"+time.getSeconds()).slice(-2),
        ];
        let dateStr = `${dateParts[0]}${dateParts[1]}${dateParts[2]}-${dateParts[3]}${dateParts[4]}${dateParts[5]}`;
        let info = `<style>a{color:#b01;text-decoration:none;}a:hover{text-decoration:underline;}*{unicode-bidi:embed;}</style><span>&nbsp;</span>\n` +
          `${res.body}\n` +
          `<span>Retrieved on ${time.toLocaleString("en-HK", { timeZone: "Asia/Shanghai", timeStyle: "long", dateStyle: "long" })}</span>`;
        fs.writeFileSync(`./data/current-contest/contest-results-formatted_${dateStr}.html`, info, "utf-8");
        winston.info("[Contest] Listed contest scores as html");
        nodeHtmlToImage({
          output: `./data/current-contest/contest-results-formatted_${dateStr}.png`,
          html: info,
        }).then(()=>{
          winston.info("[Contest] Listed contest scores as png");
        });
      });
      this.listContestScoreJson(this.config.tags).then(async res=>{
        let time = new Date(res.retrieved);
        let dateParts = [
          time.getFullYear(),
          ("0"+(time.getMonth()+1)).slice(-2),
          ("0"+time.getDate()).slice(-2),
          ("0"+time.getHours()).slice(-2),
          ("0"+time.getMinutes()).slice(-2),
          ("0"+time.getSeconds()).slice(-2),
        ];
        // for (let i = 0; i < res.data.length; i++) {
        //   try {
        //     let urlHistory = await this.site.urlHistory(res.data[i].page);
        //     res.data[i].pageHistory = urlHistory;
        //     winston.debug(`Listed url history for page ${res.data[i].title}`);
        //     // await new Promise(res=>setTimeout(res, 3000));
        //     let raters = await this.site.getPageRaters(res.data[i].page);
        //     res.data[i].raters = raters;
        //     winston.debug(`Listed rater info for page ${res.data[i].title}`);
        //   } catch (e) {
        //     i--;
        //   }
        //   // await new Promise(res=>setTimeout(res, 3000));
        // }
        let dateStr = `${dateParts[0]}${dateParts[1]}${dateParts[2]}-${dateParts[3]}${dateParts[4]}${dateParts[5]}`;
        fs.writeFileSync(`./data/current-contest/contest-results_${dateStr}.json`, JSON.stringify(res, null, 2), "utf-8");
        winston.info("[Contest] Listed contest scores as json");
      });
    }

    listThings();
    this.schedule = everyHalfHour(listThings);
  }

  async stop() {
    clearTimeout(this.schedule.inner);
  }
}

module.exports = ContestModule;

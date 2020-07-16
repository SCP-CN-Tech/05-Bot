const got = require('got');
const cheerio = require('cheerio');
const fs = require('fs');
const config = JSON.parse(fs.readFileSync('./config.json', 'utf-8'))
class WD {
  constructor(base) {
    this.wiki(base);
    this.cookie = {
      auth: '',
      sess: '',
      expires: null
    };
  }
  wiki(base) {
    if (!base.startsWith("http")) { base = `http://${base}.wikidot.com` }
    this.base = base;
    this.ajax = `${base}/ajax-module-connector.php`;
    return this;
  }
  setCookies(v) { Object.assign(this.cookie, v) }

  async req(params) {
    const wikidotToken7 = Math.random().toString(36).substring(4);
    return await got.post(this.ajax, {
      headers: {Cookie: `${this.cookie.auth}wikidot_token7=${wikidotToken7}`},
      form: Object.assign({wikidot_token7: wikidotToken7, callbackIndex: 0}, params)
    }).json();
  };

  async module(moduleName, params) {
    return await this.req(Object.assign({moduleName: moduleName}, params))
  }

  async action(action, params) {
    return await this.req(Object.assign({action: action, moduleName: "Empty"}, params))
  }

  async login(username, password) {
    const wikidotToken7 = Math.random().toString(36).substring(4);
    let res = await got.post('https://www.wikidot.com/default--flow/login__LoginPopupScreen', {
      headers: {Cookie: `wikidot_token7=${wikidotToken7}`},
      form: {
				login: username,
				password: password,
				action: 'Login2Action',
				event: 'login',
        wikidot_token7: wikidotToken7,
        callbackIndex: 0
			}
			})
    if (res.body.includes("The login and password do not match.")) {throw new Error("The login and password do not match.")}
    let tmp = res.headers['set-cookie'][1].split("; ")
  	this.cookie.sess = tmp[0]
  	this.cookie.expire = tmp[1].split("=")[1]
    this.cookie.auth = `${this.cookie.sess}; wikidot_udsession=1; `
    return this;
  }

  async getPageId(page) {
    let pg = await got.get(`${this.base}/${page}`).text()
  	pg = cheerio.load(pg)
  	let page_id;
  	pg(pg("head").children("script")
				.filter((i,el)=>pg(el).html().includes("WIKIREQUEST"))).html()
		    .replace(/WIKIREQUEST\.info\.pageId *?= *?(\d+);/g, (_, id)=>{
			page_id = id
		})
    return page_id;
  }

  async source(page) {
    let page_id = await this.getPageId(wiki_page);
  	let info = await this.module("viewsource/ViewSourceModule", {
  		page_id: page_id
  	})
  	return info.body
  }

  async edit(wiki_page, params) {
    var lock = await this.module('edit/PageEditModule', {
            mode: 'page',
            wiki_page: wiki_page,
            force_lock: true})
    return await this.action('WikiPageAction', Object.assign({
      event: 'savePage',
      wiki_page: wiki_page,
      lock_id: lock.lock_id,
      lock_secret: lock.lock_secret,
      revision_id: lock.page_revision_id||null,
    }, params))
  }

  async delete(wiki_page, params) {
    let page_id = await this.getPageId(wiki_page);
    return await this.action('WikiPageAction', Object.assign({
      event: 'deletePage',
      page_id: page_id,
    }, params))
  }

  async rename(wiki_page, new_name, params) {
    let page_id = await this.getPageId(wiki_page);
    return await this.action('WikiPageAction', Object.assign({
      event: 'renamePage',
      page_id: page_id,
      new_name: new_name,
    }, params))
  }
}
let now = Date.now()
let reserves = [];
var tech = new WD('scp-tech-cn');
var cn = new WD('scp-wiki-cn');
!(async ()=>{
  await tech.login(config.WD_NAME, config.WD_PW)
  let res = await tech.module('list/ListPagesModule', {
    category: "reserve",
    created_at: "older than 30 day",
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
  [[#ifexpr %%form_raw{branch}%% == 15 | %%title%%[!-- ]] [[a href="http://[[#ifexpr %%form_raw{branch}%% == 00 | wanderers-library.wikidot.com ]][[#ifexpr %%form_raw{branch}%% == 01 | www.scp-wiki.net ]][[#ifexpr %%form_raw{branch}%% == 02 | scp-int.wikidot.com ]][[#ifexpr %%form_raw{branch}%% == 03 | scpfoundation.net ]][[#ifexpr %%form_raw{branch}%% == 04 | ko.scp-wiki.net ]][[#ifexpr %%form_raw{branch}%% == 05 | fondationscp.wikidot.com ]][[#ifexpr %%form_raw{branch}%% == 06 | scp-wiki.net.pl ]][[#ifexpr %%form_raw{branch}%% == 07 | scp-es.com ]][[#ifexpr %%form_raw{branch}%% == 08 | scp-th.wikidot.com ]][[#ifexpr %%form_raw{branch}%% == 09 | ja.scp-wiki.net ]][[#ifexpr %%form_raw{branch}%% == 10 | scp-wiki-de.wikidot.com ]][[#ifexpr %%form_raw{branch}%% == 11 | fondazionescp.wikidot.com ]][[#ifexpr %%form_raw{branch}%% == 12 | scp-ukrainian.wikidot.com ]][[#ifexpr %%form_raw{branch}%% == 13 | scp-pt-br.wikidot.com ]][[#ifexpr %%form_raw{branch}%% == 14 | scp-cs.wikidot.com ]]/%%name%%" target="_blank"]]%%title%%[[/a]][!-- --]
  [[/cell]]
  [[cell]]
  %%created_at|%Y-%m-%d|hover%%
  [[/cell]]
  [[/row]]
  [[/body]]
  [[foot]]
  [[/table]]
  [[/foot]]`
  })
  let $ = cheerio.load(res.body);
  //console.log(res.body)
  await $('table').find('tr').each(async function(i, elem) {
    try {
      let meta = $(this).children('td')
      let user = {
        displayName: $(meta[0]).text().trim(),
        unixname: $(meta[1]).text().trim(),
        id: $(meta[2]).text().trim(),
      }
      let a = $(meta[3]).find('a')
      let b = a.attr('href')
      let c = '';
      if (b.endsWith('-outdated')) { b = b.substring(0, b.length-9), c = '-outdated' }
      let page = {
        url: b,
        name: b.split('/').pop().trim(),
        title: a.text().trim(),
      }
      a = parseInt($(meta[4]).children('span').attr('class').split(' ')[1].substring(5)+'000')
      let time = {
        raw: a,
        date: new Date(a),
      }
      let trans = {
        exist: false,
        translator: null,
        url: null,
        name: null,
        title: null,
      }
      let pageinfo = await cn.module('list/ListPagesModule', {
        name: page.name,
        module_body: `[[table class="exist"]]
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
  %%link%%
  [[/cell]]
  [[cell]]
  %%title%%
  [[/cell]]
  [[/row]]
  [[/table]]`});
      meta = cheerio.load(pageinfo.body)('table.exist').find('td');
      if (!!meta.length) {
        trans = {
          exist: true,
          translator: {
            displayName: $(meta[0]).text().trim(),
            unixname: $(meta[1]).text().trim(),
            id: $(meta[2]).text().trim(),
          },
          url: $(meta[3]).text().trim(),
          title: $(meta[4]).text().trim(),
        }
      }
      let inf = {user:user, page:page, time:time, trans:trans};
      if (trans.exist||time.raw<=now-7776000000) {
        tech.delete(`reserve:${page.name}${c}`).then(stat=>{
          if (stat.status==='ok') {
            console.log(`Successfully deleted "reserve:${page.name}${c}"`)
          } else console.log(`${stat.status}: ${stat.message}`)
        })
      }
      else {
        reserves.push(inf);
        if (!c) {
          tech.rename(`reserve:${page.name}`, `reserve:${page.name}-outdated`).then(stat=>{
            if (stat.status==='ok') {
              console.log(`Successfully renamed "reserve:${page.name}${c}" to "reserve:${page.name}-outdated"`)
            } else console.log(`${stat.status}: ${stat.message}`)
          })
        }
      }
      fs.writeFileSync('./trans-reserve.json', JSON.stringify(reserves, null, 2), 'utf8')
    } catch (e) {
      console.log(e)
    }
  });
})().catch(console.log)

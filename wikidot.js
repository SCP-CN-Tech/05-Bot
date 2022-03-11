const got = require('got');
const cheerio = require('cheerio');
const winston = require('winston');
const {progressAlert} = require('./util');
class WD {
  constructor(base) {
    this.wiki(base);
    this.cookie = {
      auth: '',
      sess: '',
      expire: null,
      exp: null
    };
  }
  wiki(base) {
    this.domain = base;
    if (!base.startsWith("http")) { base = `http://${base}.wikidot.com` }
    this.base = base;
    this.ajax = `${base}/ajax-module-connector.php`;
    this.quic = `${base}/quickmodule.php`;
    winston.debug(`Rebased to ${base}.`)
    return this;
  }
  setCookies(v) { Object.assign(this.cookie, v) }

  async req(params) {
    const wikidotToken7 = Math.random().toString(36).substring(4);
    let ret = await got.post(this.ajax, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0',
        Referer: '05-B, B for Bot',
        Cookie: `wikidot_token7=${wikidotToken7}; ${this.cookie.auth}`,
      },
      form: Object.assign({wikidot_token7: wikidotToken7, callbackIndex: 0}, params)
    }).json();
    if (ret.status!=="ok") {
      let e = new Error(ret.message);
      e.name = ret.status;
      e.src = ret;
      throw e;
    } else return ret;
  };

  async quick(module, params) {
    return await got.get(this.quic, {
      searchParams: Object.assign({module: module}, params)
    }).json();
  }

  async module(moduleName, params) {
    return await this.req(Object.assign({moduleName: moduleName}, params))
  }

  async action(action, params) {
    return await this.req(Object.assign({action: action, moduleName: "Empty"}, params))
  }

  async login(username, password) {
    const wikidotToken7 = Math.random().toString(36).substring(4);
    let res = await got.post('https://www.wikidot.com/default--flow/login__LoginPopupScreen', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0',
        Referer: '05-B, B for Bot',
        Cookie: `wikidot_token7=${wikidotToken7};`,
      },
      form: {
				login: username,
				password: password,
				action: 'Login2Action',
				event: 'login',
        wikidot_token7: wikidotToken7,
        callbackIndex: 0
			}
		})
    if (res.body.includes("The login and password do not match.")) {throw new Error("Wikidot login and password do not match.")}
    let tmp = res.headers['set-cookie'][1].split("; ")
  	this.cookie.sess = tmp[0]
  	this.cookie.expire = tmp[1].split("=")[1]
    this.cookie.exp = new Date(this.cookie.expire.split(",").pop().split("-").join(" "))
    this.cookie.auth = `${this.cookie.sess}; wikidot_udsession=1; `
    return this;
  }

  async getPageId(page) {
    let pg = await got.get((page.startsWith('http') ? page : `${this.base}/${page}`) + '/norender/true', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0',
        Referer: '05-B, B for Bot',
        Cookie: `${this.cookie.auth}`,
      },
      followRedirect: false
    }).text();
  	pg = cheerio.load(pg);
  	let page_id = null;
  	pg(pg("head").children("script")
				.filter((_i,el)=>pg(el).html().includes("WIKIREQUEST"))).html()
		    .replace(/WIKIREQUEST\.info\.pageId\s*=\s*(\d+)\s*;/g, (_, id)=>{
			page_id = id
		});
    return page_id;
  }
  
  async resolvePageId(page_or_id) {
    let page_id;
    if (typeof page_or_id == "string") {
      page_id = await this.getPageId(page_or_id);
    } else if (typeof page_or_id == "number") {
      page_id = page_or_id;
    } else throw new Error(`page_or_id requires a String or Number. Received ${typeof page_or_id}`);
    return page_id;
  }

  async viewSource(page_or_id, params) {
    let page_id = await this.resolvePageId(page_or_id);
    let options = Object.assign({
  		page_id: page_id,
      raw: true,
  	}, params);
    if (!options.raw) delete options.raw;
    return await this.module("viewsource/ViewSourceModule", options);
  }

  async source(page_or_id, params) {
    let page_id = await this.resolvePageId(page_or_id);
    return await this.module("edit/TemplateSourceModule", Object.assign({
  		page_id: page_id,
  	}, params));
  }

  async history(page_or_id, params) {
    let page_id = await this.resolvePageId(page_or_id);
    return await this.module("history/PageRevisionListModule", Object.assign({
  		page_id: page_id,
      page: 1,
      perpage: 20,
      options: `{"all":true}`
  	}, params));
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
    }, params));
  }

  async tags(page_or_id, params) {
    let page_id = await this.resolvePageId(page_or_id);
    let tags;
    if (typeof params === "string") {
      tags = params.split(" ");
    } else if (params instanceof Array) {
      tags = params;
    } else if (params instanceof Object) {
      tags = await this.module("pagetags/PageTagsModule", { pageId: page_id });
      tags = cheerio.load(tags.body)(`input[id="page-tags-input"]`).attr("value").split(" ");
      params.add = params.add instanceof Array ? params.add : (typeof params.add === "string" ? params.add.split(" ") : null);
      params.remove = params.remove instanceof Array ? params.remove : (typeof params.remove === "string" ? params.remove.split(" ") : null);
      tags = params.add ? tags.concat(params.add.filter(v=>!tags.includes(v))) : tags;
      tags = params.remove ? tags.filter(v=>!params.remove.includes(v)) : tags;
    }
    return await this.action('WikiPageAction', {
      event: 'saveTags',
      pageId: page_id,
      tags: tags.join(" "),
    })
  }

  async delete(page_or_id, params) {
    let page_id = await this.resolvePageId(page_or_id);
    return await this.action('WikiPageAction', Object.assign({
      event: 'deletePage',
      page_id: page_id,
    }, params));
  }

  async rename(page_or_id, new_name, params) {
    let page_id = await this.resolvePageId(page_or_id);
    return await this.action('WikiPageAction', Object.assign({
      event: 'renamePage',
      page_id: page_id,
      new_name: new_name,
    }, params));
  }

  async listPages(params) {
    return await this.module('list/ListPagesModule', Object.assign({
      category: ".",
      order: "created_at desc desc",
      perPage: "20",
      separate: "true",
      module_body: ``
    }, params));
  }

  async countPages(params) {
    let count = await this.module('list/CountPagesModule', Object.assign({
      category: "*",
      module_body: `%%total%%`,
    }, params));
    return parseInt(cheerio.load(count.body)("p").text());
  }
  
  async listBacklinkRaw(page_or_id, params) {
    let page_id = await this.resolvePageId(page_or_id);
    return await this.module('backlinks/BacklinksModule', Object.assign({
      page_id: `${page_id}`,
    }, params));
  }
  
  async listBacklink(page_or_id) {
    let backlink = await this.listBacklinkRaw(page_or_id);
    let $ = cheerio.load(backlink.body);
    let backlinkList = $('h2:contains("[[include]]")').prev('ul');
    let backlinkedPages = [], internalInclude = [], externalInclude = [];
    if (backlinkList) {
      backlinkList = backlinkList.children('li');
      for (let i = 0; i < backlinkList.length; i++) {
        let a = $(backlinkList[i]).children('a');
        let rellink = a.attr('href').substring(1);
        try {
          let pageId = await this.getPageId(rellink);
          backlinkedPages.push({
            url: this.base + '/' + rellink,
            pageId,
            title: a.text().split(`(${rellink}`)[0].trim(),
          });
        } catch (e) {
          winston.error(`Error while processing page :${this.domain}:${rellink}: ${e.stack}`);
        } finally {
          if (progressAlert(i)) {
            winston.verbose(`[Backlinker] Processing backlinked page info: ${i}/${backlinkList.length}`);
          }
        }
      }
      winston.verbose(`[Backlinker] Processing backlinked page info: ${backlinkList.length}/${backlinkList.length}`);
      winston.verbose(`[Backlinker] Backlinked page list constructed.`);
    }
    
    
    let includeList = $('h2:contains("[[include]]") + ul');
    if (includeList) {
      includeList = includeList.children('li');
      for (let i = 0; i < includeList.length; i++) {
        let a = $(includeList[i]).children('a');
        let rellink = a.attr('href').substring(1);
        try {
          let pageId = await this.getPageId(rellink);
          internalInclude.push({
            url: this.base + '/' + rellink,
            pageId,
            title: a.text().split('(/')[0].trim(),
          });
        } catch (e) {
          winston.error(`Error while processing page :${this.domain}:${rellink}: ${e.stack}`);
        } finally {
          if (progressAlert(i)) {
            winston.verbose(`[Backlinker] Processing internal include info: ${i}/${includeList.length}`);
          }
        }
      }
      winston.verbose(`[Backlinker] Processing internal include info: ${includeList.length}/${includeList.length}`);
      winston.verbose(`[Backlinker] Internal include list constructed.`);
    }
    
    includeList = $('h2:contains("[[include]]") + ul + ul');
    if (includeList) {
      includeList = includeList.children('li');
      for (let i = 0; i < includeList.length; i++) {
        let a = $(includeList[i]).children('a');
        let link = a.attr('href');
        try {
          let pageId = await this.getPageId(link)
          externalInclude.push({
            url: link,
            pageId,
            title: a.text().split('(http')[0].trim(),
          });
        } catch (e) {
          winston.error(`Error while processing page ${link}: ${e.stack}`);
        } finally {
          if (progressAlert(i)) {
            winston.verbose(`[Backlinker] Processing external include info: ${i}/${includeList.length}`);
          }
        }
      }
      winston.verbose(`[Backlinker] Processing external include info: ${includeList.length}/${includeList.length}`)
      winston.verbose(`[Backlinker] External include list constructed.`)
    }
    
    return {backlinkedPages, internalInclude,externalInclude};
  }
}
module.exports = WD;

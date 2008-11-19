(function($) {
/* 
 * jQuery Douban
 *
 * Copyright (c) 2008 Wu Yuntao <http://blog.luliban.com/>
 * Licensed under the Apache 2.0 license.
 *
 */

// {{{ Douban authentication and API URLs
const AUTH_HOST = 'http://www.douban.com';
const REQUEST_TOKEN_URL = AUTH_HOST + '/service/auth/request_token';
const AUTHORIZATION_URL = AUTH_HOST + '/service/auth/authorize';
const ACCESS_TOKEN_URL = AUTH_HOST + '/service/auth/access_token';

const API_HOST = 'http://api.douban.com';
const PEOPLE_URL = API_HOST + '/people';
// API BUG: 不加'/'的话，使用不能。http://www.douban.com/group/topic/4655057/ 
const SEARCH_PEOPLE_URL = PEOPLE_URL + '/';
const GET_PEOPLE_URL = PEOPLE_URL  + '/{USERNAME}';
const GET_CURRENT_URL = PEOPLE_URL  + '/%40me';     // hack: %40 => @
const GET_FRIENDS_URL = GET_PEOPLE_URL + '/friends';
const GET_CONTACTS_URL = GET_PEOPLE_URL + '/contacts';

const NOTE_URL = API_HOST + '/note';
const GET_NOTE_URL = NOTE_URL + '/{NOTEID}';
const GET_USERS_NOTE_URL = GET_PEOPLE_URL + '/notes';
const ADD_NOTE_URL = API_HOST + '/notes';
const UPDATE_NOTE_URL = GET_NOTE_URL;
const DELETE_NOTE_URL = GET_NOTE_URL;
// }}}

/* {{{ Factory method of jQuery Douban
 * @returns     Douban service object
 * @param       options Dict
 * @usage
 * var service = $.douban({ apiKey: 'blahblah', apiSecret: 'blahblah' });
 * service.login(accessKey, accessSecret);
 * if (service.isAuthenticated()) {
 *     var id = service.miniblog.add("发送一条广播");
 * }
 */
$.douban = function(factory, options) {
    if (typeof factory != 'string') {
        options = factory;
        factory = 'service';
    }
    if (typeof $.douban[factory] != 'undefined') {
        return $.douban[factory].factory(options);
    } else {
        return false;
    }
};
// }}}

/* {{{ Factory method of Douban Service
 * @returns     Douban service object
 * @param       options Dict
 * @usage
 * var service = $.douban.service.factory({ apiKey: 'blah', apiSecret: 'blah' });
 * var id = service.miniblog.add("发送广播");
 * service.miniblog.delete(id);
 */
$.douban.service = {
    factory: function(options) {
        return new DoubanService(options);
    }
};
// }}}

/* {{{ Factory method of OAuth Client
 * @returns     OAuth client object
 * @param       options Dict
 * @usage
 * var client = $.douban.client.factory({ apiKey: 'blah', apiSecret: 'blah' });
 * var requestToken = client.getRequestToken();
 * var url = client.getAuthorizationUrl(requestToken);
 * var accessToken = client.getAccessToken(requestToken);
 * var login = client.login(accessToken);
 */
$.douban.client = {
    factory: function(options) {
        return new OAuthClient(options);
    }
};
// }}}

/* {{{ Factory method of Douban User
 */
$.douban.user = {
    factory: function(data) {
        return new User(data);
    }
};
// }}}

$.douban.note = {
    factory: function(data) {
        return new Note(data);
    },

    /* create POST or PUT xml
     * @param       title String
     * @param       content String
     * @param       isPublic Boolean
     * @param       isReplyEnabled Boolean
     */
    createXml: function(title, content, isPublic, isReplyEnabled) {
        isPublic = isPublic ? 'public' : 'private';
        isReplyEnabled = isReplyEnabled ? 'yes' : 'no';
        var xml = '<?xml version="1.0" encoding="UTF-8"?><entry xmlns="http://www.w3.org/2005/Atom" xmlns:db="http://www.douban.com/xmlns/"><title>{TITLE}</title><content>{CONTENT}</content><db:attribute name="privacy">{IS_PUBLIC}</db:attribute><db:attribute name="can_reply">{IS_REPLY_ENABLED}</db:attribute></entry>';
        return xml.replace(/\{TITLE\}/, title)
                  .replace(/\{CONTENT\}/, content)
                  .replace(/\{IS_PUBLIC\}/, isPublic)
                  .replace(/\{IS_REPLY_ENABLED\}/, isReplyEnabled);
    }
};

/* Factory method of HTTP request handlers
 * @usage
 * // Register new request handler
 * $.douban.http.register('air', AirHttpRequestHandler });
 * // Use Gears HTTP Request API as handler
 * $.douban.http.setActive('gears');
 * // Get some url
 * var json = $.douban.http({ url: url, params: params });
 * // Unregister request handler
 * $.douban.http.unregister('air');
 *
 */
$.douban.http = function(options) {
    return $.douban.http.activeHandler(options);
};

/* Create HTTP request handler by the given type
 * including 'jquery', 'greasemonkey' and 'gears'
 * In addition, you can register other handlers either
 * by passing arguments ``httpType`` and ``httpHandler`` to the factory
 * method
 */
$.douban.http.factory = function(options) {
    /* Default options */
    var defaults = {
        type: 'jquery',
        handler: null
    },
    options = $.extend(defaults, options || {});
    if (typeof $.douban.http.handlers[options.type] == 'undefined') {
        // Register and set active the new handler
        if ($.isFunction(options.handler)) {
            $.douban.http.register(options.type, options.handler);
        } else {
            throw new Error("Invalid HTTP request handler");
        }
    }
    return $.douban.http.handlers[options.type];
};

/* Default handler is jquery
 */
$.douban.http.activeHandler = jqueryHandler;

/* A dict of HTTP request name and its constructor,
 */
$.douban.http.handlers = {
    jquery: jqueryHandler,
    greasemonkey: greasemonkeyHandler,
    gears: gearsHandler
};

$.douban.http.setActive = function(name) {
    $.douban.http.activeHandler = $.douban.http.handlers[name];
}

/* Register new HTTP request handler to ``handlers``
 */
$.douban.http.register = function(name, handler) {
    if ($.isFunction(handler)) {
        $.douban.http.handlers[name] = constructor;
    }
};

/* Unregister an existed HTTP request handler
 */
$.douban.http.unregister = function(name) {
    $.douban.http.handlers[name] = undefined;
};

/* Built-in HTTP request handlers: 'jquery', 'greasemonkey' and 'gears'
 */
function jqueryHandler(options) {
    return $.ajax(options);
}
jqueryHandler.name = 'jquery';

function greasemonkeyHandler(options) {
    throw new Error("Not Implemented Yet");
}
greasemonkeyHandler.name = 'greasemonkey';

function gearsHandler(options) {
    throw new Error("Not Implemented Yet");
}
gearsHandler.name = 'gears';

/* {{{ Some utilities
 */
// Add methods to class
// Copied from Low Pro for jQuery
// http://www.danwebb.net/2008/2/3/how-to-use-low-pro-for-jquery
function addMethods(source) {
    var ancestor   = this.superclass && this.superclass.prototype;
    var properties = $.keys(source);

    if (!$.keys({ toString: true }).length) 
        properties.push("toString", "valueOf");

    for (var i = 0, length = properties.length; i < length; i++) {
        var property = properties[i], value = source[property];
        if (ancestor && $.isFunction(value) && $.argumentNames(value)[0] == "$super") {
        
            var method = value, value = $.extend($.wrap((function(m) {
                return function() { return ancestor[m].apply(this, arguments) };
            })(property), method), {
                valueOf:  function() { return method },
                toString: function() { return method.toString() }
            });
        }
        this.prototype[property] = value;
    }
    return this;
}

$.extend({
    /* Get keys of an object
     */
    keys: function(obj) {
        var keys = [];
        for (var key in obj) keys.push(key);
        return keys;
    },

    /* Returns argument names of a function
     */
    argumentNames: function(func) {
        var names = func.toString().match(/^[\s\(]*function[^(]*\((.*?)\)/)[1].split(/, ?/);
        return names.length == 1 && !names[0] ? [] : names;
    },

    bind: function(func, scope) {
      return function() {
        return func.apply(scope, $.makeArray(arguments));
      }
    },

    wrap: function(func, wrapper) {
      var __method = func;
      return function() {
        return wrapper.apply(this, [$.bind(__method, this)].concat($.makeArray(arguments)));
      }
    },

    /* Class creation and inheriance.
     * Copied from Low Pro for jQuery
     * http://www.danwebb.net/2008/2/3/how-to-use-low-pro-for-jquery
     */
    class: function() {
        var parent = null;
        var properties = $.makeArray(arguments);
        if ($.isFunction(properties[0])) parent = properties.shift();
        var klass = function() {
            this.init.apply(this, arguments);
        };
        klass.superclass = parent;
        klass.subclasses = [];
        klass.addMethods = addMethods;
        if (parent) {
            var subclass = function() { };
            subclass.prototype = parent.prototype;
            klass.prototype = new subclass;
            parent.subclasses.push(klass);
        }
        for (var i = 0, len = properties.length; i < len; i++)
            klass.addMethods(properties[i]);
        if (!klass.prototype.init)
            klass.prototype.init = function() {};
        klass.prototype.constructor = klass;
        return klass;
    },

    /* Parse datetime string to Date object
     */
    parseDate: function(str) {
        var re = /^(\d{4})\-(\d{2})\-(\d{2})T(\d{2}):(\d{2}):(\d{2})/;
        var date = str.match(re);
        for (var i = 1, len = date.length; i < len; i++) {
            date[i] = parseInt(date[i]);
            if (i == 2) date[i] -= 1;
        }
        return new Date(date[1], date[2], date[3], date[4], date[5], date[6]);
    },

    /* The opposiite of jQuery's native $.param() method.
     * Deserialises a parameter string to an object:
     */
    unparam: function(params) {
        var obj = new Object();
        $.each(params.split('&'), function() {
            var param = this.split('=');
            var key = decodeURIComponent(param[0]);
            var value = decodeURIComponent(param[1]);
            obj[key] = value;
        });
        return obj;
    }
});
// }}}

/* Douban services

/* Douban service
 * @returns     null
 * @param       options Dict
 * @option      apiKey String
 * @option      apiSecret String
 * @option      httpType String
 * @option      httpHandler String
 */
function DoubanService(options) {
    /* Default options */
    var defaults = {
        apiKey: '',
        apiSecret: '',
        httpType: 'jquery',
    };
    this.options = $.extend(defaults, options || {});;
    this.api = new Token(this.options.apiKey, this.options.apiSecret);
    this.http = $.douban.http.factory({ type: this.options.httpType });
    this.client = $.douban.client.factory({ apiKey: this.api.key,
                                            apiSecret: this.api.secret,
                                            type: this.options.httpType });
    this.user = new DoubanUserService(this);
    this.note = new DoubanNoteService(this);
}
$.extend(DoubanService.prototype, {
    /* Adapter methods of client
     */
    login: function(accessToken) {
        return this.client.login(accessToken);
    },

    get: function(url, params, callback) {
        var json = null;
        var params = this.setParams(params);
        var setHeaders = this.setHeaders(url, 'GET', params);
        this.http({ async: false,
                    url: url,
                    type: 'GET',
                    data: params,
                    dataType: 'json',
                    beforeSend: setHeaders,
                    success: onSuccess });
        return json;

        function onSuccess(data) {
            json = data;
            if ($.isFunction(callback)) callback(data);
        }
    },

    post: function(url, data, callback) {
        var json = null;
        var params = this.setParams();
        var setHeaders = this.setHeaders(url, 'POST', params);
        var url = url + '?' + $.param(params);
        this.http({ async: false,
                    url: url,
                    data: data,
                    dataType: 'json',
                    type: 'POST',
                    contentType: 'application/atom+xml',
                    processData: false,
                    beforeSend: setHeaders,
                    success: onSuccess });
        return json;

        function onSuccess(data) {
            json = data;
            if ($.isFunction(callback)) callback(data);
        }
    },

    put: function(url, data, callback) {
        var json = null;
        var params = this.setParams();
        var setHeaders = this.setHeaders(url, 'PUT', params);
        var url = url + '?' + $.param(params);
        this.http({ async: false,
                    url: url,
                    data: data,
                    dataType: 'json',
                    type: 'PUT',
                    contentType: 'application/atom+xml',
                    processData: false,
                    beforeSend: setHeaders,
                    success: onSuccess });
        return json;

        function onSuccess(data) {
            json = data;
            if ($.isFunction(callback)) callback(data);
        }
    },

    delete: function(url, callback) {
        var response = null;
        var params = this.setParams();
        var setHeaders = this.setHeaders(url, 'DELETE', params);
        this.http({ async: false,
                    url: url,
                    type: 'DELETE',
                    data: params,
                    beforeSend: setHeaders,
                    success: onSuccess });
        return response;

        function onSuccess(data) {
            response = data;
            if ($.isFunction(callback)) callback(data);
        }
    },

    setParams: function(params) {
        params = $.extend({ 'apikey': this.api.key, 'alt': 'json' }, params || {});
        return params;
    },

    /* Set headers for request
     * @returns     beforeSend callback function
     * @param       url String
     * @param       type String. 'GET', 'PUT', 'POST' or 'DELETE'
     * @param       params Dict
     */
    setHeaders: function(url, type, params) {
        var headers = this.client.getAuthHeaders(url, type, params);
        return function(xhr) {
            xhr.setRequestHeader('Authorization', headers);
            xhr.setRequestHeader('WWW-Authenticate', 'OAuth realm=""');
        }
    }
});

/* Douban User Service
 * @method      get             获取用户信息
 * @method      search          获取当前授权用户信息
 * @method      current         搜索用户
 * @method      friend          获取用户朋友
 * @method      contact         获取用户关注的人
 */
function DoubanUserService(service) {
    this.service = service;
}
$.extend(DoubanUserService.prototype, {
    get: function(name) {
        var url = GET_PEOPLE_URL.replace(/\{USERNAME\}/, name);
        var json = this.service.get(url);
        return json ? new User(json) : false;
    },

    search: function(query, offset, limit) {
        var url = SEARCH_PEOPLE_URL;
        var params = { 'q': query, 'start-index': offset || 0, 'max-results': limit || 50 };
        var json = this.service.get(url, params);
        return json ? new UserEntries(json) : false;
    },

    current: function() {
        var url = GET_CURRENT_URL;
        var json = this.service.get(url);
        return json ? new User(json) : false;
    },

    friends: function(user, offset, limit) {
        var url = GET_FRIENDS_URL.replace(/\{USERNAME\}/, user);
        var params = { 'start-index': offset || 0, 'max-results': limit || 50 };
        var json = this.service.get(url, params);
        return json ? new UserEntries(json) : false;
    },

    contacts: function(user, offset, limit) {
        var url = GET_CONTACTS_URL.replace(/\{USERNAME\}/, user);
        var params = { 'start-index': offset || 0, 'max-results': limit || 50 };
        var json = this.service.get(url, params);
        return json ? new UserEntries(json) : false;
    }
});

/* Douban note service
 */
function DoubanNoteService(service) {
    this.service = service;
}
$.extend(DoubanNoteService.prototype, {
    get: function(note) {
        if (typeof note == 'object') var url = note.id;
        else var url = GET_NOTE_URL.replace(/\{NOTEID\}/, note);
        var json = this.service.get(url);
        return json ? new Note(json) : false;
    },

    getForUser: function(user, offset, limit) {
        if (typeof user == 'object') var url = user.id + '/notes';
        else if (typeof user == 'string') var url = GET_USERS_NOTE_URL.replace(/\{USERNAME\}/, user);
        var params = { 'start-index': offset || 0, 'max-results': limit || 50 };
        var json = this.service.get(url, params);
        return json ? new NoteEntries(json) : false;
    },

    add: function(title, content, isPublic, isReplyEnabled) {
        var url = ADD_NOTE_URL;
        var data = $.douban.note.createXml(title, content, isPublic, isReplyEnabled);
        var json = this.service.post(url, data);
        return json ? new Note(json) : false;
    },

    update: function(note, title, content, isPublic, isReplyEnabled) {
        if (typeof note == 'object') var url = note.id;
        else if (note.match(/\d+/)) var url = UPDATE_NOTE_URL.replace(/\{NOTEID\}/, note);
        var data = $.douban.note.createXml(title, content, isPublic, isReplyEnabled);
        var json = this.service.put(url, data);
        return json ? new Note(json) : false;
    },

    delete: function(note) {
        if (typeof note == 'object') var url = note.id;
        else if (note.match(/\d+/)) var url = UPDATE_NOTE_URL.replace(/\{NOTEID\}/, note);
        var response = this.service.delete(url);
        return response == 'ok' ? true : false;
    }
});

// {{{ Douban object classes like ``User`` and ``Note``
/* Base class of douban object like user and note 
 * @param   feed JSON. Gdata JSON feed
 */
var DoubanObject = $.class({
    init: function(feed) {
        this._feed = feed;
        this.createFromJson();
    },

    /* Create object from given JSON feed. Please implement it in subclass.
     * @param   data JSON
     */
    createFromJson: function() {
        throw new Error("Not Implemented Yet");
    },

    /* Get read-only json feed
     */
    getFeed: function() {
        return this._feed;
    },

    /* JSON feed parsers
     */
    getAttr: function (attr) {
        if (typeof this._feed[attr] != 'undefined') return this._feed[attr]['$t'];
        var attrs = this._feed['db:attribute'];
        if (typeof attrs != 'undefined')
            for (var i in attrs)
                if (attrs[i]['@name'] == attr) return attrs[i]['$t'];
        return '';
    },

    getUrl: function(attr) {
        // default ``attr`` is 'alternate'
        attr = attr || 'alternate';
        var links = this._feed['link'];
        for (var i in links)
            if (links[i]['@rel'] == attr) return links[i]['@href'];
        return '';
    },

    getId: function() {
        return this.getUrl('self');
    },

    getTitle: function() {
        return this.getAttr('title');
    },

    getAuthor: function() {
        return typeof this._feed.author == 'undefined' ? undefined : new User(this._feed.author);
    },

    getSummary: function() {
        return this.getAttr('summary');
    },

    getContent: function() {
        return this.getAttr('content');
    },

    getIconUrl: function() {
        return this.getUrl('icon');
    },

    getTime: function(attr) {
        return $.parseDate(this.getAttr(attr));
    },

    getPublished: function() {
        return this.getTime('published');
    },

    getUpdated: function() {
        return this.getTime('updated');
    }
});

var DoubanObjectEntries = $.class(DoubanObject, {
    init: function(feed) {
        this._feed = feed;
        this._entries = feed.entry;
        this.createFromJson();
    },

    /* Create object from given JSON feed.
     * Get general attributes for entry feed, like ``total`` and ``limit``
     * @param   data JSON
     */
    createFromJson: function(doubanObject) {
        this.total = this.getTotal();
        this.offset = this.getOffset();
        this.limit = this.getLimit();
        this.entries = [];
        for (var i = 0, len = this._entries.length; i < len; i++) {
            this.entries.push(new doubanObject(this._entries[i]));
        }
    },

    getTotal: function() {
        return parseInt(this.getAttr("opensearch:totalResults") || "0");
    },

    getOffset: function() {
        return parseInt(this.getAttr("opensearch:startIndex") || "0");
    },

    getLimit: function() {
        return parseInt(this.getAttr("opensearch:itemsPerPage") || "0");
    }

});

/* Douban user class
 * @param           data            Well-formatted json feed
 * @attribute       id              用户ID，"http://api.douban.com/people/1000001"
 * @attribute       userName        用户名，"ahbei"
 * @attribute       screenName      昵称，"阿北"
 * @attribute       location        常居地，"北京"
 * @attribute       blog            网志主页，"http://ahbei.com/"
 * @attribute       intro           自我介绍，"豆瓣的临时总管..."
 * @attribute       url             豆瓣主页，"http://www.douban.com/people/ahbei/"
 * @attribute       iconUrl         头像，"http://otho.douban.com/icon/u1000001-14.jpg"
 * @method          createFromJson  由豆瓣返回的用户JSON，初始化用户数据
 */
var User = $.class(DoubanObject, {
    createFromJson: function() {
        this.id = this.getUserId();
        this.userName = this.getUserName()
        this.screenName = this.getScreenName();
        this.location = this.getLocation();
        this.intro = this.getContent();
        this.url = this.getUrl();
        this.iconUrl = this.getIconUrl();
        this.blog = this.getBlog();
    },

    /* JSON feed parsers */
    getUserId: function() {
        return this.getAttr('id') || this.getAttr('uri');
    },

    getUserName: function() {
        return this.getAttr('db:uid');
    },

    getScreenName: function() {
        return this.getTitle() || this.getAttr('name');
    },

    getLocation: function() {
        return this.getAttr('db:location');
    },

    getBlog: function() {
        return this.getUrl('homepage');
    }
});

/* Douban user entries
 * @param       data                Well-formatted json feed
 * @attribute   total
 * @attribute   offset
 * @attribute   limit
 * @attribute   entries
 * @method      createFromJson
 */
var UserEntries = $.class(DoubanObjectEntries, {
    createFromJson: function($super) {
        this.query = this.getTitle().replace(/^搜索\ /, '').replace(/\ 的结果$/, '');
        $super(User);
    }
});

/* Douban note
 * @param           data            Well-formatted json feed
 * @attribute       id              用户ID，"http://api.douban.com/people/1000001"
 * @attribute       userName        用户名，"ahbei"
 * @attribute       screenName      昵称，"阿北"
 * @attribute       location        常居地，"北京"
 * @attribute       blog            网志主页，"http://ahbei.com/"
 * @attribute       intro           自我介绍，"豆瓣的临时总管..."
 * @attribute       url             豆瓣主页，"http://www.douban.com/people/ahbei/"
 * @attribute       iconUrl         头像，"http://otho.douban.com/icon/u1000001-14.jpg"
 * @method          createFromJson  由豆瓣返回的用户JSON，初始化用户数据
 */
var Note = $.class(DoubanObject, {
    createFromJson: function() {
        this.id = this.getId();
        this.title = this.getTitle();
        this.author = this.getAuthor();
        this.summary = this.getSummary();
        this.content = this.getContent();
        this.published = this.getPublished();
        this.updated = this.getUpdated();
        this.url = this.getUrl();
        this.isPublic = this.getIsPublic();
        this.isReplyEnabled = this.getIsReplyEnabled();
    },

    getIsPublic: function() {
        return this.getAttr('privacy') == 'public' ? true: false;
    },

    getIsReplyEnabled: function() {
        return this.getAttr('can_reply') == 'yes' ? true: false;
    }
});

/* Douban note entries
 * @param       data                Well-formatted json feed
 * @attribute   total
 * @attribute   offset
 * @attribute   limit
 * @attribute   entries
 * @method      createFromJson
 */
var NoteEntries = $.class(DoubanObjectEntries, {
    createFromJson: function($super) {
        this.title = this.getTitle();
        this.author = this.getAuthor();
        $super(Note);
    }
});
// }}}

/* {{{ OAuth client
 */
function OAuthClient(options) {
    /* Default options */
    var defaults = {
        apiKey: '',
        apiSecret: '',
        httpType: 'jquery',
    };
    this.options = $.extend(defaults, options || {});;
    this.api = new Token(this.options.apiKey, this.options.apiSecret);
    this.http = $.douban.http.factory({ type: this.options.httpType });

    this.requestToken = new Token();
    this.accessToken = new Token();
    this.authorizationUrl = '';
    this.userId = '';
}
$.extend(OAuthClient.prototype, {
    /* Get request token
     * @returns         Token object
     */ 
    getRequestToken: function() {
        var token = null;
        this.oauthRequest(REQUEST_TOKEN_URL, null, function(data) {
            data = $.unparam(data);
            token = { key: data.oauth_token,
                      secret: data.oauth_token_secret };
        });
        this.requestToken = token;
        return this.requestToken
    },

    /* Get authorization URL
     * @returns     url string
     * @param       requestToken Token. If not specified, using
     *              ``this.requestToken`` instead
     * @param       callbackUrl String
     */
    getAuthorizationUrl: function(requestToken, callbackUrl) {
        // shift arguments if ``requestToken`` was ommited
        if (typeof requestToken == 'string') {
            callbackUrl = requestToken;
            requestToken = this.requestToken;
        }
        var params = $.param({ oauth_token: requestToken.key,
                               oauth_callback: callbackUrl });
        this.authorizationUrl = AUTHORIZATION_URL + '?' + params;
        return this.authorizationUrl
    },

    /* Get access token
     * @returns     token object
     * @param       requestToken Token. If not specified, using
     *              ``this.requestToken`` instead
     */
    getAccessToken: function(requestToken) {
        var token = null;
        var userId = null;
        requestToken = requestToken || this.requestToken;
        this.oauthRequest(ACCESS_TOKEN_URL,
                          { oauth_token: requestToken.key },
                          callback);
        this.userId = userId;
        this.accessToken = token;
        return this.accessToken;

        function callback(data) {
            data = $.unparam(data);
            token = { key: data.oauth_token,
                      secret: data.oauth_token_secret };
            userId = data.douban_user_id;
        }
    },

    /* Save access token
     * returns      if login Boolean
     */
    login: function(accessToken) {
        accessToken = accessToken || this.accessToken;
        // check length of access token
        if (accessToken.key.length == 32 && accessToken.secret.length == 16) {
            this.accessToken = accessToken;
            return true;
        }
    },

    /* Check if useris authenticated
     * returns      if authenticated Boolean
     */
    isAuthenticated: function() {
        return this.login();
    },

    /* Get OAuth headers
     */
    getAuthHeaders: function(url, method, parameters) {
        var params = this.getParameters(url, method, parameters);
        var header = 'OAuth realm=""';
        for (var key in params) {
            header += ', ' + key + '="' + params[key] + '"';
        }
        return header;
    },

    /* Get an OAuth message represented as an object like this:
     * { method: "GET", action: "http://server.com/path", parameters: ... }
     * Look into oauth.js for details
     */
    getMessage: function(url, method, parameters) {
        var token = this.isAuthenticated() ? this.accessToken : this.requestToken;
        var accessor = { consumerSecret: this.api.secret,
                         tokenSecret: token.secret };
        var parameters = $.extend({
            oauth_consumer_key: this.api.key,
            oauth_token: this.accessToken.key,
            oauth_signature_method: 'HMAC-SHA1',
            oauth_version: '1.0'
        }, parameters || {});
        var message = {
            action: url,
            method: method,
            parameters: parameters
        };
        OAuth.setTimestampAndNonce(message);
        OAuth.SignatureMethod.sign(message, accessor);
        return message;
    },

    /* Get Oauth paramters
     * @param url       URL string 
     * @param type      'GET' or 'POST'
     * @param data      Parameter object
     *
     * @return          Parameter object
     */
    getParameters: function(url, method, parameters) {
        var message = this.getMessage(url, method, parameters);
        return OAuth.getParameterMap(message.parameters);
    },

    /* OAuth Request
     * @returns         null
     * @param           url String 
     * @param           data Dict 
     * @param           callback Function
     */
    oauthRequest: function(url, data, callback) {
        var data = this.getParameters(url, 'GET', data);
        this.http({ async: false, url: url, data: data, success: callback });
    }
});

/* A simple token object */
function Token(key, secret) {
    this.key = key || '';
    this.secret = secret || '';
}
// }}}

})(jQuery);

var request = require('request');
var Promise = require('bluebird');
var Remote = require('./remote.js');
var _ = require('../util.js');
var factory = require('./factory.js');
var path = require('path');
var fs = require('fs');
var zlib = require('zlib');
var tar = require('tar');
var logger = require('../logger');
var DEFAULT_TOKEN = 'XsYDeyqyFD777qgovh15';

function requestAPI(uri, token, callback) {
    var request = require('request');

    request({
        uri: uri,
        json: true,
        headers: {
            'User-Agent': 'request',
            'PRIVATE-TOKEN': token || DEFAULT_TOKEN
        }
    }, function (error, response, body) {
        if (!response || response.statusCode !== 200) {
            var ret = response && response.body;
            callback(ret && ret.message || ret || 'net error');
        } else {
            callback(false, body);
        }
    });
}

var exports = module.exports = function NpmRepos(address, options) {

    if (!(this instanceof NpmRepos)) {
        return new NpmRepos(address, options);
    }

    if (!exports.accept(address, true)) {
        throw new Error('Error!');
    }

    options = _.mixin(_.mixin({}, exports.options), options);
    this.type = exports.type;
    this.author = RegExp.$1 || options.author;
    this.name = RegExp.$2;
    this.domain = factory.settings.registry ||  options.domain;
    this.address = this.author ?  this.author + '/' + this.name : this.name;
    var version = this._versionRaw = RegExp.$3;
    this._version = version === 'latest' ? '*' : version || '*';

    Remote.apply(this, arguments);

    this.getConfig = function () {

        if (this.config) {
            return Promise.resolve(this.config);
        }

        var self = this;

        return this
            // resolve the location.
            .resolve()

            .then(function (location) {

                if (self.config) {
                    return self.config;
                }
                var request = Promise.promisify(requestAPI);
                var projectId = encodeURIComponent(self.address);
                logger.debug('request config: ', self.domain + projectId);
                return request(self.domain + projectId, options.token)
                    .then(function (body) {
                        self.config = body;
                        if (!body || !body.name) {
                            throw new Error('`npm:' + self.address + '` is an invalid component, please check this out [https://github.com/fis-components/spec].');
                        }
                        return Object.keys(body.versions).concat(Object.keys(body['dist-tags']));
                    })
                    .then(function (versions) {
                        self.versions = versions = versions.sort(_.compareVersion);
                        return self.versions;
                    })
                    .then(self.resolveVersion.bind(self))
                    .then(function (version) {
                        // 获取版本对应的配置信息
                        var tags = self.config['dist-tags'];
                        if (Object.keys(tags).indexOf(version) !== -1) {
                            self.version = version = tags[version];
                        }
                        return self.config.versions[version];
                    })
                    .error(function (e) {
                        if (/Not\sFound/i.test(e.message)) {
                            throw new Error('`npm:' + self.address + '` not found.');
                        } else {
                            throw new Error(e + ' while loading npm:' + self.domain + self.address);
                        }
                    })
            });
    };

    this.install = function (progress) {
        var self = this;
        var Scaffold = require('fis-scaffold-kernel');
        var ScaffoldUtil = require('fis-scaffold-kernel/lib/util');
        // download from gitlab
        var scaffold = new Scaffold({
            type: 'npm',
            repos: self.domain,
            log: {
                level: 0
            }
        });

        return new Promise(function (resolve, reject) {
            var tarUrl = self.config.versions[self.version].dist.tarball;
            logger.debug('get tarball url', tarUrl);
            ScaffoldUtil.download(tarUrl, null, function (error, location) {

                if (error) {
                    return reject(error);
                }

                logger.debug('download success', location);

                self.convert(location);

                var target = path.join(factory.settings.componentsDir, self.name);
                var mapping = self.config.mapping || [];

                if (mapping.length) {
                    mapping.unshift({
                        reg: /^\/component.json$/i,
                        release: '$0'
                    });
                    mapping.push({
                        reg: '**',
                        release: false
                    });
                } else {
                    mapping.push({
                        reg: '*',
                        release: '$&'
                    });
                }
                scaffold.deliver(location, target, mapping);

                resolve(self);
            }, progress);
        });
    };
};

exports.type = 'npm';

exports.accept = function (address, asDefault) {
    var options = _.mixin(_.mixin({}, exports.options), factory.settings.npm);
    var author = options.author;
    var reg = /^npm\:([@0-9a-z\.\-_]+)\/([0-9a-z\.\-_]+)(?:@(.+?))?$/i;
    var regShort = /^([@0-9a-z\.\-_]+)\/([0-9a-z\.\-_]+)(?:@(.+?))?$/i;
    var regShorter = /^npm\:(?:([@0-9a-z\.\-_]+)\/)?([0-9a-z\.\-_]+)(?:@(.+?))?$/i;
    var regShortest = /^(?:npm\:)?(?:([@0-9a-z\.\-_]+)\/)?([0-9a-z\.\-_]+)(?:@(.+?))?$/i;

    return reg.test(address) ||
        asDefault && regShort.test(address) ||
        regShorter.test(address) ||
        asDefault && regShortest.test(address);
};

exports.options = {
    author: '',
    domain: 'http://nfe.baidu.com:8881/'
};

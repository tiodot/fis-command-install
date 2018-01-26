var _ = require('../util.js');

// 针对npm的组件包进行缓存
var componentInited = {};

var factory = module.exports = function factory(address, protocol, options) {
    var type = factory.detect(address, protocol);

    if (!type) {
        throw new Error('Unknow repository `' + address + '`');
    }

    var fn = factory.remotes[type];
    options = _.mixin(_.mixin({}, factory.settings[type]), options);
    // if (type === 'npm') {
    // var name = _.compName(address);
    if (componentInited[address]) {
        return null;
    }
    componentInited[address] = true;
    // }
    return new fn(address, options);
};

factory.detect = function(address, protocol) {
    var remotes = factory.remotes;
    var keys = Object.keys(remotes);

    protocol = protocol || settings.protocol;

    for (var i = 0, len = keys.length; i < len; i++) {
        var type = keys[i];
        var asDefault = type === protocol;

        if (remotes[type].accept(address, asDefault)) {
            return type;
        }
    }

    return null;

};

var settings = factory.settings = {
    protocol: 'npm',

    componentsDir: '/components'
};
factory.setSettings = function(settings) {
    _.mixin(factory.settings, settings);
};

factory.getSettings = function() {
    return _.mixin({}, settings);
};

factory.remotes = {
    github: require('./github.js'),
    gitlab: require('./gitlab.js'),
    lights: require('./lights.js'),
    npm: require('./npm.js')

    // todo
    // http: require('./http.js'),
    // svn: require('./svn.js')
};

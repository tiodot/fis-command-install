/**
 * collect compoents needed.
 */

var Promise = require('bluebird');
var exports = module.exports = function(dependencies, unique) {

    var compoents = dependencies.concat();

    // 下载单个文件，仅适用于编译单个组件使用.
    if (unique) {
        return Promise.map(dependencies, function(remote) {
            return remote.getComponent();
        }).then(function(all) {
            return compoents;
        });
    }

    return Promise

        .map(dependencies, function(remote) {
            return remote.getDependencies();
        })

        // flatten all.
        .then(function(all) {
            all.forEach(function(deps) {
                compoents.push.apply(compoents, deps);
            });

            return compoents;
        });
};

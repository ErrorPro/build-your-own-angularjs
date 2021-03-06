var _ = require('lodash');
var HashMap = require('./apis.js').HashMap;
var FN_ARGS = /^function\s*[^\(]*\(\s*([^\)]*)\)/m;
var FN_ARG = /^\s*(_?)(\S+?)\1\s*$/;
var STRIP_COMMENTS = /(\/\/.*$)|(\/\*.*?\*\/)/mg;
var INSTANTIATING = {};
var path = [];

function createInjector(modulesToLoad, strictDi) {
  var providerCache = {};
  var providerInjector = providerCache.$injector = createInternalInjector(providerCache, function() {
    throw 'Unknown provider: ' + path.join(' <- ');
  });
  var instanceCache = {};
  var instanceInjector = instanceCache.$injector = createInternalInjector(instanceCache, function(name) {
    var provider = providerInjector.get(name + 'Provider');
    return instanceInjector.invoke(provider.$get, provider);
  });
  var loadedModules = new HashMap();
  strictDi = (strictDi === true);

  function enforceReturnValue(factoryFn) {
    return function() {
      var value = instanceInjector.invoke(factoryFn);
      if (_.isUndefined(value)) {
        throw 'factory must return a value';
      }
      return value;
    };
  }

  providerCache.$provide = {
    constant: function(key, value) {
      if (key === 'hasOwnProperty') {
        throw 'hasOwnProperty is not valid constant name!';
      }
      instanceCache[key] = value;
      providerCache[key] = value;
    },
    provider: function(key, provider) {
      if (_.isFunction(provider)) {
        provider = providerInjector.instantiate(provider);
      }
      providerCache[key + 'Provider'] = provider;
    },
    factory: function(key, factoryFn, enforce) {
      this.provider(key, {
        $get: enforce === false ? factoryFn : enforceReturnValue(factoryFn)
      });
    },
    value: function(key, value) {
      this.factory(key, _.constant(value), false);
    },
    service: function(key, Constructor) {
      this.factory(key, function() {
        return instanceInjector.instantiate(Constructor);
      });
    },
    decorator: function(serviceName, decoratorFn) {
      var provider = providerInjector.get(serviceName + 'Provider');
      var original$get = provider.$get;
      provider.$get = function() {
        var instance = instanceInjector.invoke(original$get, provider);
        instanceInjector.invoke(decoratorFn, null, {$delegate: instance});
        return instance;
      };
    }
  };

  function annotate(fn) {
    if (_.isArray(fn)) {
      return fn.slice(0, fn.length - 1);
    } else if (fn.$inject) {
      return fn.$inject;
    } else if (!fn.length) {
      return [];
    } else {
      if (strictDi) {
        throw 'fn is not using explicit annotation and cannot be invoked in strict mode';
      }
      var source = fn.toString().replace(STRIP_COMMENTS, '');
      var argDeclaration = source.match(FN_ARGS);
      return argDeclaration[1].split(',').map(function(argName) {
        return argName.match(FN_ARG)[2];
      });
    }
  }

  function createInternalInjector(cache, factoryFn) {
    function getService(name) {
      if (cache.hasOwnProperty(name)) {
        if (cache[name] === INSTANTIATING) {
          throw new Error('Circular dependency found: '+ name + ' <- '+ path.join(' <- '));
        }
        return cache[name];
      } else {
        path.unshift(name);
        cache[name] = INSTANTIATING;
        try {
          return (cache[name] = factoryFn(name));
        } finally {
          path.shift();
          if (cache[name] === INSTANTIATING) {
            delete cache[name];
          }
        }
      }
    }

    function invoke(fn, self, locals) {
      var args = annotate(fn).map(function(token) {
        if (_.isString(token)) {
          return locals && locals.hasOwnProperty(token) ? locals[token] : getService(token);
        } else {
          throw 'Incorrect injection token! Expected a string, got '+token;
        }
      });
      if (_.isArray(fn)) {
        fn = _.last(fn);
      }
      return fn.apply(self, args);
    }

    function instantiate(Type, locals) {
      var instance = Object.create((_.isArray(Type) ? _.last(Type) : Type).prototype);
      invoke(Type, instance, locals);
      return instance;
    }

    return {
      has: function(key) {
        return cache.hasOwnProperty(key) || providerCache.hasOwnProperty(key + 'Provider');
      },
      get: getService,
      annotate: annotate,
      invoke: invoke,
      instantiate: instantiate
    };
  }

  function runInvokeQueue(queue) {
    _.forEach(queue, function(invokeArgs) {
      var service = providerInjector.get(invokeArgs[0]);
      var method = invokeArgs[1];
      var args = invokeArgs[2];
      service[method].apply(service, args);
    });
  }

  var runBlocks = [];
  _.forEach(modulesToLoad, function loadModule(module) {
    if (!loadedModules.get(module)) {
      loadedModules.put(module, 3);
      if(_.isString(module)) {
        loadedModules[module] = true;
        module = angular.module(module);
        _.forEach(module.requires, loadModule);
        runInvokeQueue(module._invokeQueue);
        runInvokeQueue(module._configBlocks);
        runBlocks = runBlocks.concat(module._runBlocks);
      } else if (_.isFunction(module) || _.isArray(module)) {
        runBlocks.push(providerInjector.invoke(module));
      }
    }
  });

  _.forEach(_.compact(runBlocks), function(runBlock) {
    instanceInjector.invoke(runBlock);
  });

  return instanceInjector;
}

module.exports = createInjector;

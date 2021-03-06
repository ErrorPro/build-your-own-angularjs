var _ = require('lodash');
var $ = require('jquery');

function $CompileProvider($provide) {
  var hasDirectives = {};
  var PREFIX_REGEXP = /(x[\:\-_]|data[\:\-_])/i;
  var BOOLEAN_ATTRS = {
    multiple: true,
    selected: true,
    checked: true,
    disabled: true,
    readOnly: true,
    required: true,
    open: true
  };
  var BOOLEAN_ELEMENTS = {
    INPUT: true,
    SELECT: true,
    OPTION: true,
    TEXTAREA: true,
    BUTTON: true,
    FORM: true,
    DETAILS: true
  };

  function parseIsolateBindings(scope) {
    var bindings = {};
    _.forEach(scope, function(definition, scopeName) {
      var match = definition.match(/\s*([@&]|=(\*?))\s*(\w*)\s*/);
      bindings[scopeName] = {
        mode: match[1][0],
        collection: match[2] === '*',
        attrName: match[3] || scopeName
      };
    });
    return bindings;
  }

  this.directive = function(name, directiveFactory) {
    if (_.isString(name)) {
      if (name === 'hasOwnProperty') {
        throw 'hasOwnProperty is not a valid directive name';
      }
      if (!hasDirectives.hasOwnProperty(name)) {
        hasDirectives[name] = [];
        $provide.factory(name + 'Directive', ['$injector', function($injector) {
          var factories = hasDirectives[name];
          return _.map(factories, function(factory) {
            var directive = $injector.invoke(factory);
            directive.restrict = directive.restrict || 'EA';
            if (directive.link && !directive.compile) {
              directive.compile = _.constant(directive.link);
            }
            if (_.isObject(directive.scope)) {
              directive.$$isolateBingings = parseIsolateBindings(directive.scope);
            }
            directive.name = directive.name || name;
            directive.require = directive.require || (directive.controller && name);
            return directive;
          });
        }]);
      }
      hasDirectives[name].push(directiveFactory);
    } else {
      _.forEach(name, function(directiveFactory, name) {
        this.directive(name, directiveFactory);
      }, this);
    }
  };

  this.$get = ['$injector', '$parse', '$controller', '$rootScope', '$http', function($injector, $parse, $controller, $rootScope, $http) {
    function Attributes(element) {
      this.$$element = element;
      this.$attr = {};
    }

    Attributes.prototype.$set = function(key, value, writeAttr, attrName) {
      this[key] = value;

      if (isBooleanAttribute(this.$$element[0], key)) {
        this.$$element.prop(key, value);
      }

      if (!attrName) {
        if (this.$attr[key]) {
          attrName = this.$attr[key];
        } else {
          attrName = this.$attr[key] = _.kebabCase(key);
        }
      } else {
        this.$attr[key] = attrName;
      }

      if (writeAttr !== false) {
        this.$$element.attr(attrName, value);
      }

      if (this.$$observers) {
        _.forEach(this.$$observers[key], function(observer) {
          try {
            observer(value);
          } catch (e) {
            console.log(e);
          }
        });
      }
    };

    Attributes.prototype.$observe = function(key, fn) {
      var self = this;
      this.$$observers = this.$$observers || Object.create(null);
      this.$$observers[key] = this.$$observers[key] || [];
      this.$$observers[key].push(fn);
      $rootScope.$evalAsync(function() {
        fn(self[key]);
      });

      return function() {
        var index = self.$$observers[key].indexOf(fn);
        if (index >= 0) {
          self.$$observers[key].splice(index, 1);
        }
      };
    };

    Attributes.prototype.$addClass = function(classValue) {
      this.$$element.addClass(classValue);
    };

    Attributes.prototype.$removeClass = function(classValue) {
      this.$$element.removeClass(classValue);
    };

    Attributes.prototype.$updateClass = function(newClassVal, oldClassVal) {
      var newClasses = newClassVal.split(/\s+/);
      var oldClasses = oldClassVal.split(/\s+/);
      var addedClasses = _.difference(newClasses, oldClasses);
      var removedClasses = _.difference(oldClasses, newClasses);

      if (addedClasses.length) {
        this.$addClass(addedClasses.join(' '));
      }

      if(removedClasses.length) {
        this.$removeClass(removedClasses.join(' '));
      }
    };

    function compile($compileNodes) {
     var compositeLinkFn = compileNodes($compileNodes);

     return function publicLinkFn(scope) {
       $compileNodes.data('$scope', scope);
       compositeLinkFn(scope, $compileNodes);
     };
    }

    function compileNodes($compileNodes) {
      var linkFns = [];
      _.forEach($compileNodes, function(node, i) {
        var attrs = new Attributes($(node));
        var directives = collectDirectives(node, attrs);
        var nodeLinkFn;
        if (directives.length) {
          nodeLinkFn = applyDirectivesToNode(directives, node, attrs);
        }
        var childLinkFn;
        if (node.childNodes && node.childNodes.length) {
          childLinkFn = compileNodes(node.childNodes);
        }
        if (nodeLinkFn && nodeLinkFn.scope) {
          attrs.$$element.addClass('ng-scope');
        }
        if (nodeLinkFn || childLinkFn) {
          linkFns.push({
            nodeLinkFn: nodeLinkFn,
            childLinkFn: childLinkFn,
            idx: i
          });
        }
      });

      function compositeLinkFn(scope, linkNodes) {
        var stableNodeList = [];
        _.forEach(linkFns, function(linkFn) {
          var nodeIdx = linkFn.idx;
          stableNodeList[nodeIdx] = linkNodes[nodeIdx];
        });
        _.forEach(linkFns, function(linkFn) {
          var node = stableNodeList[linkFn.idx];
          if (linkFn.nodeLinkFn) {
             if (linkFn.nodeLinkFn.scope) {
               scope = scope.$new();
               $(node).data('$scope', scope);
             }
            linkFn.nodeLinkFn(linkFn.childLinkFn, scope, node);
          } else {
            linkFn.childLinkFn(
              scope,
              node.childNodes
            );
          }
        });
      }

      return compositeLinkFn;
    }

    function applyDirectivesToNode(directives, compileNode, attrs, previousCompileContext) {
      previousCompileContext = previousCompileContext || {};
      var $compileNode = $(compileNode);
      var prelinkFns = previousCompileContext.prelinkFns || [];
      var postlinkFns = previousCompileContext.postlinkFns || [];
      var controllers = {};
      var newScopeDirective;
      var newIsolateScopeDirective = previousCompileContext.newIsolateScopeDirective;
      var templateDirective = previousCompileContext.templateDirective;
      var controllerDirectives = previousCompileContext.controllerDirectives;

      function addLinkFns(prelinkFn, postlinkFn, attrStart, attrEnd, isolateScope, require) {
        if (prelinkFn) {
          if (attrStart) {
            prelinkFn = groupElementsLinkFnWrapper(prelinkFn, attrStart, attrEnd);
          }
          prelinkFn.isolateScope = isolateScope;
          prelinkFn.require = require;
          prelinkFns.push(prelinkFn);
        }
        if (postlinkFn) {
          if (attrEnd) {
            postlinkFn = groupElementsLinkFnWrapper(postlinkFn, attrStart, attrEnd);
          }
          postlinkFn.isolateScope = isolateScope;
          postlinkFn.require = require;
          postlinkFns.push(postlinkFn);
        }
      }

      function getControllers(require, $element) {
        if (_.isArray(require)) {
          return _.map(require, getControllers);
        } else {
          var value;
          var match = require.match(/^(\^\^?)?(\?)?(\^\^?)?/);
          var optional = match[2];
          require = require.substring(match[0].length);
          if (match[1] || match[3]) {
            if (match[3] && !match[1]) {
              match[1] = match[3];
            }
            if (match[1] == '^^') {
              $element = $element.parent();
            }
            while($element.length) {
              value = $element.data('$' + require + 'Controller');
              if (value) {
                break;
              } else {
                $element = $element.parent();
              }
            }
          } else {
            if (controllers[require]) {
              value = controllers[require].instance;
            }
          }
          if (!value && !optional) {
            throw 'Controller ' + require + ' required by directive, cannot be found!';
          }
          return value || null;
        }
      }

      _.forEach(directives, function(directive, i) {
        if (directive.$$start) {
          $compileNode = groupScan(compileNode, directive.$$start, directive.$$end);
        }
        if (directive.scope) {
          if (_.isObject(directive.scope)) {
            if (newIsolateScopeDirective || newScopeDirective) {
              throw 'Multiple directives asking for new/inherited scope';
            }
            newIsolateScopeDirective = directive;
          } else {
            if (newIsolateScopeDirective) {
              throw 'Multiple directives asking for new/inherited scope';
            }
            newScopeDirective = newScopeDirective || directive;
          }
        }

        if (directive.controller) {
          controllerDirectives = controllerDirectives || {};
          controllerDirectives[directive.name] = directive;
        }
        if (directive.template) {
          if (templateDirective) {
            throw 'Multiple directive asking for template';
          }
          templateDirective = directive;
          $compileNode.html(_.isFunction(directive.template) ? directive.template($compileNode, attrs) : directive.template);
        }
        if (directive.templateUrl) {
          if (templateDirective) {
            throw 'Multiple directives asking for template';
          }
          templateDirective = directive;
          nodeLinkFn = compileTemplateUrl(
            _.drop(directives, i),
            $compileNode,
            attrs,
            {
              templateDirective: templateDirective,
              newIsolateScopeDirective: newIsolateScopeDirective,
              controllerDirectives: controllerDirectives,
              prelinkFns: prelinkFns,
              postlinkFns: postlinkFns
            });
          return false;
        } else if (directive.compile) {
          var linkFn = directive.compile($compileNode, attrs);
          var isolateScope = (directive === newIsolateScopeDirective);
          var attrStart = directive.$$start;
          var attrEnd = directive.$$end;
          var require = directive.require;
          if (_.isFunction(linkFn)) {
            addLinkFns(null, linkFn, attrStart, attrEnd, isolateScope, require);
          } else if (linkFn) {
            addLinkFns(linkFn.pre, linkFn.post, attrStart, attrEnd, isolateScope, require);
          }
        }
      });

      function nodeLinkFn(childLinkFn, scope, linkNode) {
        var $element = $(linkNode);

        var isolateScope;
        if (newIsolateScopeDirective) {
          isolateScope = scope.$new(true);
          $element.addClass('ng-isolate-scope');
          $element.data('$isolateScope', isolateScope);
        }

        if (controllerDirectives) {
          _.forEach(controllerDirectives, function(directive) {
            var locals = {
              $scope: directive === newIsolateScopeDirective ? isolateScope : scope,
              $element: $element,
              $attrs: attrs
            };
            var controllerName = directive.controller;
            if (controllerName === '@') {
              controllerName = attrs[directive.name];
            }
            var controller = $controller(controllerName, locals, true, directive.controllerAs);
            controllers[directive.name] = controller;
            $element.data('$' + directive.name + 'Controller', controller.instance);
          });
        }

        if (newIsolateScopeDirective) {
          var isolateContext = isolateScope;
          if (newIsolateScopeDirective.bindToController) {
            isolateContext = controllers[newIsolateScopeDirective.name].instance;
          }
          _.forEach(newIsolateScopeDirective.$$isolateBingings, function(definition, scopeName) {
            var attrName = definition.attrName;
            switch (definition.mode) {
              case '@':
                attrs.$observe(attrName, function(newAttrValue) {
                  isolateContext[scopeName] = newAttrValue;
                });
                if (attrs[attrName]) {
                  isolateContext[scopeName] = attrs[attrName];
                }
                break;
              case '=':
                var parentGet =   $parse(attrs[attrName]);
                var lastValue = isolateContext[scopeName] = parentGet(scope);
                var parentValueWatch = function() {
                  var parentValue = parentGet(scope);
                  if (isolateContext[scopeName] !== parentValue) {
                    if (parentValue !== lastValue) {
                      isolateContext[scopeName] = parentValue;
                    } else {
                      parentValue = isolateContext[scopeName];
                      parentGet.assign(scope, parentValue);
                    }
                  }
                  lastValue = parentValue;
                  return lastValue;
                };
                var unwatch;
                if (definition.collection) {
                  unwatch = scope.$watchCollection(attrs[attrName], parentValueWatch);
                } else {
                  unwatch = scope.$watch(parentValueWatch);
                }
                isolateScope.$on('$destroy', unwatch);
                break;
              case '&':
                var parentExpr = $parse(attrs[attrName]);
                isolateContext[scopeName] = function(locals) {
                  return parentExpr(scope, locals);
                };
                break;
            }
          });
        }

        _.forEach(controllers, function(controller) {
          controller();
        });

        _.forEach(prelinkFns, function(linkFn) {
          linkFn(linkFn.isolateScope ? isolateScope : scope, $element, attrs, linkFn.require && getControllers(linkFn.require, $element));
        });

        if (childLinkFn) {
          var scopeToChild = scope;
          if (newIsolateScopeDirective && newIsolateScopeDirective.template) {
            scopeToChild = isolateScope;
          }
          childLinkFn(scopeToChild, linkNode.childNodes);
        }
        _.forEach(postlinkFns, function(linkFn) {
          linkFn(linkFn.isolateScope ? isolateScope : scope, $element, attrs, linkFn.require && getControllers(linkFn.require, $element));
        });
      }

      nodeLinkFn.scope = newScopeDirective && newScopeDirective.scope;

      return nodeLinkFn;
    }

    function compileTemplateUrl(directives, $compileNode, attrs, previousCompileContext) {
      var origAsyncDirective = directives.shift();
      var derivedSyncDirective = _.extend(
        {},
        origAsyncDirective,
        {templateUrl: null}
      );
      var templateUrl = _.isFunction(origAsyncDirective.templateUrl) ? origAsyncDirective.templateUrl($compileNode, attrs) : origAsyncDirective.templateUrl;
      var afterTemplateNodeLinkFn, afterTemplateChildLinkFn;
      var linkQueue = [];
      $compileNode.empty();
      $http.get(templateUrl).success(function(template) {
        directives.unshift(derivedSyncDirective);
        $compileNode.html(template);
        afterTemplateNodeLinkFn = applyDirectivesToNode(directives, $compileNode, attrs, previousCompileContext);
        afterTemplateChildLinkFn = compileNodes($compileNode[0].childNodes);
        _.forEach(linkQueue, function(linkCall) {
          afterTemplateNodeLinkFn(
            afterTemplateChildLinkFn, linkCall.scope, linkCall.linkNode
          );
        });
        linkQueue = null;
      });

      return function delayedNodeLinkFn(_ignoreChildLink, scope, linkNode) {
        if (linkQueue) {
          linkQueue.push({scope: scope, linkNode: linkNode});
        } else {
          afterTemplateNodeLinkFn(afterTemplateChildLinkFn, scope, linkNode);
        }
      };
    }

    function groupScan(node, startAttr, endAttr) {
      var nodes = [];
      if (startAttr && node && node.hasAttribute(startAttr)) {
        var depth = 0;
        do {
          if (node.nodeType === Node.ELEMENT_NODE) {
            if (node.hasAttribute(startAttr)) {
              depth++;
            } else if (node.hasAttribute(endAttr)) {
              depth--;
            }
          }
          nodes.push(node);
          node = node.nextSibling;
        } while (depth > 0);
      } else {
        nodes.push(node);
      }
      return $(nodes);
    }

    function groupElementsLinkFnWrapper(linkFn, attrStart, attrEnd) {
      return function(scope, element, attrs, ctrl) {
        var group = groupScan(element[0], attrStart, attrEnd);
        return linkFn(scope, group, attrs, ctrl);
      };
    }

    function collectDirectives(node, attrs) {
      var directives = [];
      var match;
      if (node.nodeType === Node.ELEMENT_NODE) {
        var normalizeNodeName = directiveNormalize(nodeName(node));
        addDirective(directives, normalizeNodeName, 'E');
        _.forEach(node.attributes, function(attr) {
          var attrStartName, attrEndName;
          var name = attr.name;
          var normalizedAttr = directiveNormalize(name.toLowerCase());
          var isNgAttr = /^ngAttr[A-Z]/.test(normalizedAttr);
          if (isNgAttr) {
            name = _.kebabCase(normalizedAttr[6].toLowerCase() +
            normalizedAttr.substring(7));
            normalizedAttr = directiveNormalize(name.toLowerCase());
          }
          attrs.$attr[normalizedAttr] = name;
          var directiveNName = normalizedAttr.replace(/(Start|End)$/, '');

          if (directiveIsMultiElement(directiveNName)) {
            if (/Start/.test(normalizedAttr)) {
              attrStartName = name;
              attrEndName = name.substring(0, name.length - 5) + 'end';
              name = name.substring(0, name.length - 5);
            }
          }
          normalizedAttr = directiveNormalize(name.toLowerCase());
          addDirective(directives, normalizedAttr, 'A', attrStartName, attrEndName);
          if (isNgAttr || !attrs.hasOwnProperty(normalizedAttr)) {
            attrs[normalizedAttr] = attr.value.trim();
            if (isBooleanAttribute(node, normalizedAttr)) {
              attrs[normalizedAttr] = true;
            }
          }
        });
        var className = node.className;
        if (_.isString(className) && !_.isEmpty(className)) {
          while ((match = /([\d\w\-_]+)(?:\:([^;]+))?;?/.exec(className))) {
            var normalizedClassName = directiveNormalize(match[1]);
            if (addDirective(directives, normalizedClassName, 'C')) {
              attrs[normalizedClassName] = match[2] ? match[2].trim() : undefined;
            }
            className = className.substr(match.index + match[0].length);
          }
        }
      } else if (node.nodeType === Node.COMMENT_NODE) {
        match = /^\s*directive\:\s*([\d\w\-_]+)\s*(.*)$/.exec(node.nodeValue);
        if (match) {
          var normalizedName = directiveNormalize(match[1]);
          if (addDirective(directives, normalizedName, 'M')) {
            attrs[normalizedName] = match[2] ? match[2].trim() : undefined;
          }
        }
      }
      return directives;
    }

    function isBooleanAttribute(node, attrName) {
      return BOOLEAN_ATTRS[attrName] && BOOLEAN_ELEMENTS[node.nodeName];
    }

    function directiveIsMultiElement(name) {
      if (hasDirectives.hasOwnProperty(name)) {
        var directives = $injector.get(name + 'Directive');
        return _.any(directives, {multiElement: true});
      }
      return false;
    }

    function directiveNormalize(name) {
      return _.camelCase(name.replace(PREFIX_REGEXP, ''));
    }

    function nodeName(element) {
      return element.nodeName ? element.nodeName : element[0].nodeName;
    }

    function addDirective(directives, name, mode, attrStartName, attrEndName) {
      var match;
      if (hasDirectives.hasOwnProperty(name)) {
        var foundDirectives = $injector.get(name + 'Directive');
        var applicableDirectives = _.filter(foundDirectives, function(dir) {
          return dir.restrict.indexOf(mode) !== -1;
        });
        _.forEach(applicableDirectives, function(directive) {
          if (attrStartName) {
            directive = _.create(directive, {
              $$start: attrStartName,
              $$end: attrEndName
            });
          }
          directives.push(directive);
          match = directive;
        });
      }
      return match;
    }

    return compile;
  }];
}

$CompileProvider.$inject = ['$provide'];

module.exports = $CompileProvider;

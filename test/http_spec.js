var createInjector = require('../src/injector.js');
var publishExternalApi = require('../src/angular_public.js');
var _ = require('lodash');
var sinon = require('sinon');

describe('$http', function () {
  var $http;
  var $rootScope;
  var xhr;
  var $q;
  var requests = [];

  beforeEach(function() {
    publishExternalApi();
    var injector = createInjector(['ng']);
    $http = injector.get('$http');
    $rootScope = injector.get('$rootScope');
    $q = injector.get('$q');
  });

  beforeEach(function() {
    xhr = sinon.useFakeXMLHttpRequest();
    xhr.onCreate = function(req) {
      requests.push(req);
    };
  });

  afterEach(function() {
    xhr.restore();
    requests = [];
  });

  it('is a function', function() {
    expect($http instanceof Function).toBe(true);
  });

  it('returns a Promise', function() {
    var result = $http({});
    expect(result).toBeDefined();
    expect(result.then).toBeDefined();
  });

  it('makes an XMLHttpReques to given url', function() {
    $http({
      method: 'POST',
      url: 'http://teropa.info',
      data: 'hello'
    });
    $rootScope.$apply();
    expect(requests.length).toBe(1);
    expect(requests[0].method).toBe('POST');
    expect(requests[0].url).toBe('http://teropa.info');
    expect(requests[0].async).toBe(true);
    expect(requests[0].requestBody).toBe('hello');
  });

  it('resolves promise when XHR result received', function() {
    var requestConfig = {
      method: 'GET',
      url: 'http://teropa.info'
    };

    var response;
    $http(requestConfig).then(function(r) {
      response = r;
    });
    $rootScope.$apply();
    requests[0].respond(200, {}, 'Hello');

    expect(response).toBeDefined();
    expect(response.status).toBe(200);
    expect(response.statusText).toBe('OK');
    expect(response.data).toBe('Hello');
    expect(response.config.url).toEqual('http://teropa.info');
  });

  it('rejects promise when XHR result received with error status', function() {
    var requestConfig = {
      method: 'GET',
      url: 'http://teropa.info'
    };

    var response;
    $http(requestConfig).catch(function(r) {
      response = r;
    });
    $rootScope.$apply();
    requests[0].respond(401, {}, 'Fail');

    expect(response).toBeDefined();
    expect(response.status).toBe(401);
    expect(response.statusText).toBe('Unauthorized');
    expect(response.data).toBe('Fail');
    expect(response.config.url).toEqual('http://teropa.info');
  });

  it('rejects promise when XHR result errors/aborts', function() {
    var requestConfig = {
      method: 'GET',
      url: 'http://teropa.info'
    };

    var response;
    $http(requestConfig).catch(function(r) {
      response = r;
    });
    $rootScope.$apply();
    requests[0].onerror();

    expect(response).toBeDefined();
    expect(response.status).toBe(0);
    expect(response.data).toBe(null);
    expect(response.config.url).toEqual('http://teropa.info');
  });

  it('uses GET method by default', function() {
    $http({
      url: 'http://teropa.info'
    });
    $rootScope.$apply();
    expect(requests.length).toBe(1);
    expect(requests[0].method).toBe('GET');
  });

  it('sets headers on request', function() {
    $http({
      url: 'http://teropa.info',
      headers: {
        'Accept': 'text/plan',
        'Cache-Control': 'no-cache'
      }
    });
    $rootScope.$apply();
    expect(requests.length).toBe(1);
    expect(requests[0].requestHeaders.Accept).toBe('text/plan');
    expect(requests[0].requestHeaders['Cache-Control']).toBe('no-cache');
  });

  it('sets default headers on request', function() {
    $http({
      url: 'http://teropa.info'
    });
    $rootScope.$apply();
    expect(requests.length).toBe(1);
    expect(requests[0].requestHeaders.Accept).toBe('application/json, text/plan, */*');
  });

  it('sets method-specific default headers on request', function() {
    $http({
      method: 'POST',
      url: 'http://teropa.info',
      data: '42'
    });
    $rootScope.$apply();
    expect(requests.length).toBe(1);
    expect(requests[0].requestHeaders['Content-Type']).toBe(
      'application/json;charset=utf-8'
    );
  });

  it('exposes default headers for overriding', function() {
    $http.defaults.headers.post['Content-Type'] = 'text/plain;charset=utf-8';
    $http({
      method: 'POST',
      url: 'http://teropa.info',
      data: '42'
    });
    $rootScope.$apply();
    expect(requests.length).toBe(1);
    expect(requests[0].requestHeaders['Content-Type']).toBe('text/plain;charset=utf-8');
  });

  it('exposes default headers through provider', function() {
    var injector = createInjector(['ng', function($httpProvider) {
      $httpProvider.defaults.headers.post['Content-Type'] = 'text/plain;charset=utf-8';
    }]);
    $http = injector.get('$http');
    $rootScope = injector.get('$rootScope');
    $http({
      method: 'POST',
      url: 'http://teropa.info',
      data: '42'
    });
    $rootScope.$apply();
    expect(requests.length).toBe(1);
    expect(requests[0].requestHeaders['Content-Type']).toBe('text/plain;charset=utf-8');
  });

  it('merges default headers case-insensitively', function() {
    $http({
      method: 'POST',
      url: 'http://teropa.info',
      data: '42',
      headers: {
        'content-type': 'text/plain;charset=utf-8'
      }
    });
    $rootScope.$apply();
    expect(requests.length).toBe(1);
    expect(requests[0].requestHeaders['content-type']).toBe('text/plain;charset=utf-8');
    expect(requests[0].requestHeaders['Content-Type']).toBeUndefined();
  });

  it('does not send content-type header when no data', function() {
    $http({
      method: 'POST',
      url: 'http://teropa.info',
      headers: {
        'Content-Type': 'application/json;charset=utf-8'
      }
    });
    $rootScope.$apply();
    expect(requests.length).toBe(1);
    expect(requests[0].requestHeaders['Content-Type']).not.toBe('application/json;charset=utf-8');
  });

  it('supports functions as header values', function() {
    var contentTypeSpy = jasmine.createSpy().and.returnValue('text/plain;charset=utf-8');
    $http.defaults.headers.post['Content-Type'] = contentTypeSpy;

    var request = {
      method: 'POST',
      url: 'http://teropa.info',
      data: 42
    };
    $http(request);
    $rootScope.$apply();
    expect(contentTypeSpy).toHaveBeenCalledWith(request);
    expect(requests[0].requestHeaders['Content-Type']).toBe('text/plain;charset=utf-8');
  });

  it('ignores header function value when null/undefined', function() {
    var cacheControlSpy = jasmine.createSpy().and.returnValue(null);
    $http.defaults.headers.post['Cache-Control'] = cacheControlSpy;

    var request = {
      method: 'POST',
      url: 'http://teropa.info',
      data: 42
    };
    $http(request);
    $rootScope.$apply();
    expect(cacheControlSpy).toHaveBeenCalledWith(request);
    expect(requests[0].requestHeaders['Cache-Control']).toBeUndefined();
  });

  it('makes response headers available', function() {
    var response;
    $http({
      method: 'POST',
      url: 'http://teropa.info',
      data: 42
    }).then(function(r) {
      response = r;
    });
    $rootScope.$apply();
    requests[0].respond(200, {'Content-Type': 'text/plain'}, 'Hello');

    expect(response.headers).toBeDefined();
    expect(response.headers instanceof Function).toBe(true);
    expect(response.headers('Content-Type')).toBe('text/plain');
    expect(response.headers('content-type')).toBe('text/plain');
  });

  it('may returns all response headers', function() {
    var response;
    $http({
      method: 'POST',
      url: 'http://teropa.info',
      data: 42
    }).then(function(r) {
      response = r;
    });
    $rootScope.$apply();
    requests[0].respond(200, {'Content-Type': 'text/plain'}, 'Hello');

    expect(response.headers()).toEqual({'content-type': 'text/plain'});
  });

  it('allows setting withCredentials', function() {
    $http({
      method: 'POST',
      url: 'http://teropa.info',
      data: 42,
      withCredentials: true
    });
    $rootScope.$apply();
    expect(requests[0].withCredentials).toBe(true);
  });

  it('allows setting withCredentials from defaults', function() {
    $http.defaults.withCredentials = true;

    $http({
      method: 'POST',
      url: 'http://teropa.info',
      data: 42
    });
    $rootScope.$apply();
    expect(requests[0].withCredentials).toBe(true);
  });

  it('allows transforming requests with functions', function() {
    $http({
      method: 'POST',
      url: 'http://teropa.info',
      data: 42,
      transformRequest: function(data) {
        return '*' + data + '*';
      }
    });
    $rootScope.$apply();
    expect(requests[0].requestBody).toBe('*42*');
  });

  it('allows multiple request transform functions', function() {
    $http({
      method: 'POST',
      url: 'http://teropa.info',
      data: 42,
      transformRequest: [function(data) {
        return '*' + data + '*';
      }, function(data) {
        return '-' + data + '-';
      }]
    });
    $rootScope.$apply();
    expect(requests[0].requestBody).toBe('-*42*-');
  });

  it('allows settings transforms in defaults', function() {
    $http.defaults.transformRequest = [
      function(data) {
        return '*' + data + '*';
      }
    ];
    $http({
      method: 'POST',
      url: 'http://teropa.info',
      data: 42
    });
    $rootScope.$apply();
    expect(requests[0].requestBody).toBe('*42*');
  });

  it('passes request headers getter to transforms', function() {
    $http.defaults.transformRequest = [function(data, headers) {
      if (headers('Content-Type') === 'text/emphasized') {
        return '*' + data + '*';
      } else {
        return data;
      }
    }];
    $http({
      method: 'POST',
      url: 'http://teropa.info',
      data: 42,
      headers: {
        'content-type': 'text/emphasized'
      }
    });
    $rootScope.$apply();
    expect(requests[0].requestBody).toBe('*42*');
  });

  it('allows transforming responses with functions', function() {
    var response;
    $http({
      url: 'http://teropa.info',
      transformResponse: function(data) {
        return '*' + data + '*';
      }
    }).then(function(r) {
      response = r;
    });
    $rootScope.$apply();
    requests[0].respond(200, {'Content-Type': 'text/plain'}, 'Hello');

    expect(response.data).toEqual('*Hello*');
  });

  it('passes response headers to transform functions', function() {
    var response;
    $http({
      url: 'http://teropa.info',
      transformResponse: function(data, headers) {
        if (headers('content-type') === 'text/decorated') {
          return '*' + data + '*';
        } else {
          return data;
        }
      }
    }).then(function(r) {
      response = r;
    });
    $rootScope.$apply();
    requests[0].respond(200, {'Content-Type': 'text/decorated'}, 'Hello');

    expect(response.data).toEqual('*Hello*');
  });

  it('allows setting default response transforms', function() {
    $http.defaults.transformResponse = [function(data) {
      return '*' + data + '*';
    }];
    var response;
    $http({
      url: 'http://teropa.info'
    }).then(function(r) {
      response = r;
    });
    $rootScope.$apply();
    requests[0].respond(200, {'Content-Type': 'text/plain'}, 'Hello');

    expect(response.data).toEqual('*Hello*');
  });

  it('transforms error responses also', function() {
    var response;
    $http({
      url: 'http://teropa.info',
      transformResponse: function(data) {
        return '*' + data + '*';
      }
    }).catch(function(r) {
      response = r;
    });
    $rootScope.$apply();
    requests[0].respond(401, {'Content-Type': 'text/plain'}, 'Fail');

    expect(response.data).toEqual('*Fail*');
  });

  it('passes HTTP status to response transformer', function() {
    var response;
    $http({
      url: 'http://teropa.info',
      transformResponse: function(data, headers, status) {
        if (status === 401) {
          return 'Unauthorized';
        } else {
          return data;
        }
      }
    }).catch(function(r) {
      response = r;
    });
    $rootScope.$apply();
    requests[0].respond(401, {'Content-Type': 'text/plain'}, 'Fail');

    expect(response.data).toEqual('Unauthorized');
  });

  it('serializes object data to JSON for requests', function() {
    $http({
      method: 'POST',
      url: 'http://teropa.info',
      data: {aKey: 42}
    });
    $rootScope.$apply();
    expect(requests[0].requestBody).toBe('{"aKey":42}');
  });

  it('serializes array data to JSON for requests', function() {
    $http({
      method: 'POST',
      url: 'http://teropa.info',
      data: [1, 'two', 3]
    });
    $rootScope.$apply();
    expect(requests[0].requestBody).toBe('[1,"two",3]');
  });

  it('does not serialize blobs for requests', function() {
    var BlobBuilder = window.BlobBuilder || window.WebKitBlobBuilder || window.MozBlobLuilder || window.MSBlobBuilder;
    var bb = new BlobBuilder();
    bb.append('hello');
    var blob = bb.getBlob('text/plain');
    $http({
      method: 'POST',
      url: 'http://teropa.info',
      data: blob
    });
    $rootScope.$apply();
    expect(requests[0].requestBody).toBe(blob);
  });

  it('does not serialize from data for requests', function() {
    var formData = new FormData();
    formData.append('aField', 'aValue');
    $http({
      method: 'POST',
      url: 'http://teropa.info',
      data: formData
    });
    $rootScope.$apply();
    expect(requests[0].requestBody).toBe(formData);
  });

  it('parses JSON data for JSON responses', function() {
    var response;
    $http({
      url: 'http://teropa.info',
    }).then(function(r) {
      response = r;
    });
    $rootScope.$apply();
    requests[0].respond(200, {'Content-Type': 'application/json'}, '{"message":"Hello"}');

    expect(_.isObject(response.data)).toBe(true);
    expect(response.data.message).toBe('Hello');
  });

  it('parses a JSON object response without content type', function() {
    var response;
    $http({
      url: 'http://teropa.info'
    }).then(function(r) {
      response = r;
    });
    $rootScope.$apply();
    requests[0].respond(200, {}, '{"message":"hello"}');

    expect(_.isObject(response.data)).toBe(true);
    expect(response.data.message).toBe('hello');
  });

  it('parses a JSON array response without content type', function() {
    var response;
    $http({
      url: 'http://teropa.info'
    }).then(function(r) {
      response = r;
    });
    $rootScope.$apply();
    requests[0].respond(200, {}, '[1, 2, 3]');

    expect(_.isArray(response.data)).toBe(true);
    expect(response.data).toEqual([1, 2, 3]);
  });

  it('does not choke on response resembling JSON but not valid', function() {
    var response;
    $http({
      url: 'http://teropa.info'
    }).then(function(r) {
      response = r;
    });
    $rootScope.$apply();
    requests[0].respond(200, {}, '{1, 2, 3]');

    expect(response.data).toEqual('{1, 2, 3]');
  });

  it('does not try to parse interpolate expr as JSON', function() {
    var response;
    $http({
      url: 'http://teropa.info'
    }).then(function(r) {
      response = r;
    });
    $rootScope.$apply();
    requests[0].respond(200, {}, '{{expr}}');

    expect(response.data).toEqual('{{expr}}');
  });

  it('adds params to URL', function() {
    $http({
      url: 'http://teropa.info',
      params: {
        a: 42
      }
    });
    $rootScope.$apply();
    expect(requests[0].url).toBe('http://teropa.info?a=42');
  });

  it('adds additional params to URL', function() {
    $http({
      url: 'http://teropa.info?a=42',
      params: {
        b: 42
      }
    });
    $rootScope.$apply();
    expect(requests[0].url).toBe('http://teropa.info?a=42&b=42');
  });

  it('escapes url characters in params', function() {
    $http({
      url: 'http://teropa.info',
      params: {
        '==': '&&'
      }
    });
    $rootScope.$apply();
    expect(requests[0].url).toBe('http://teropa.info?%3D%3D=%26%26');
  });

  it('does not attach null or undefined params', function() {
    $http({
      url: 'http://teropa.info',
      params: {
        a: null,
        b: undefined
      }
    });
    $rootScope.$apply();
    expect(requests[0].url).toBe('http://teropa.info');
  });

  it('attaches multiple params from arrays', function() {
    $http({
      url: 'http://teropa.info',
      params: {
        a: [41, 42]
      }
    });
    $rootScope.$apply();
    expect(requests[0].url).toBe('http://teropa.info?a=41&a=42');
  });

  it('serialize objects to json', function() {
    $http({
      url: 'http://teropa.info',
      params: {
        a: {b: 42}
      }
    });
    $rootScope.$apply();
    expect(requests[0].url).toBe('http://teropa.info?a=%7B%22b%22%3A42%7D');
  });

  it('supports shorthand method for GET', function() {
    $http.get('http://teropa.info', {
      params: {q: 42}
    });
    $rootScope.$apply();
    expect(requests[0].url).toBe('http://teropa.info?q=42');
    expect(requests[0].method).toBe('GET');
  });

  it('supports shorthand method for HEAD', function() {
    $http.head('http://teropa.info', {
      params: {q: 42}
    });
    $rootScope.$apply();
    expect(requests[0].url).toBe('http://teropa.info?q=42');
    expect(requests[0].method).toBe('HEAD');
  });

  it('supports shorthand method for DELETE', function() {
    $http.delete('http://teropa.info', {
      params: {q: 42}
    });
    $rootScope.$apply();
    expect(requests[0].url).toBe('http://teropa.info?q=42');
    expect(requests[0].method).toBe('DELETE');
  });

  it('supports shorthand method for POST with data', function() {
    $http.post('http://teropa.info', 'data', {
      params: {q: 42}
    });
    $rootScope.$apply();
    expect(requests[0].url).toBe('http://teropa.info?q=42');
    expect(requests[0].method).toBe('POST');
    expect(requests[0].requestBody).toBe('data');
  });

  it('supports shorthand method for PUT with data', function() {
    $http.put('http://teropa.info', 'data', {
      params: {q: 42}
    });
    $rootScope.$apply();
    expect(requests[0].url).toBe('http://teropa.info?q=42');
    expect(requests[0].method).toBe('PUT');
    expect(requests[0].requestBody).toBe('data');
  });

  it('supports shorthand method for PATCH with data', function() {
    $http.patch('http://teropa.info', 'data', {
      params: {q: 42}
    });
    $rootScope.$apply();
    expect(requests[0].url).toBe('http://teropa.info?q=42');
    expect(requests[0].method).toBe('PATCH');
    expect(requests[0].requestBody).toBe('data');
  });

  it('allows attaching interceptor factories', function() {
    var interceptorFactorySpy = jasmine.createSpy();
    var injector = createInjector(['ng', function($httpProvider) {
      $httpProvider.interceptors.push(interceptorFactorySpy);
    }]);
    $http = injector.get('$http');

    expect(interceptorFactorySpy).toHaveBeenCalled();
  });

  it('uses DI to instantiate interceptors', function() {
    var interceptorFactorySpy = jasmine.createSpy();
    var injector = createInjector(['ng', function($httpProvider) {
      $httpProvider.interceptors.push(['$rootScope', interceptorFactorySpy]);
    }]);
    $http = injector.get('$http');
    var $rootScope = injector.get('$rootScope');
    expect(interceptorFactorySpy).toHaveBeenCalledWith($rootScope);
  });

  it('allows referencing existing interceptors factories', function() {
    var interceptorFactorySpy = jasmine.createSpy().and.returnValue({});
    var injector = createInjector(['ng', function($provide, $httpProvider) {
      $provide.factory('myInterseptor', interceptorFactorySpy);
      $httpProvider.interceptors.push('myInterseptor');
    }]);
    $http = injector.get('$http');

    expect(interceptorFactorySpy).toHaveBeenCalled();
  });

  it('allows intercepting requests', function() {
    var injector = createInjector(['ng', function($httpProvider) {
      $httpProvider.interceptors.push(function() {
        return {
          request: function(config) {
            config.params.intercepted = true;
            return config;
          }
        };
      });
    }]);
    $http = injector.get('$http');
    $rootScope = injector.get('$rootScope');

    $http.get('http://teropa.info', {params: {}});
    $rootScope.$apply();
    expect(requests[0].url).toBe('http://teropa.info?intercepted=true');
  });

  it('allows returning promises from request intercepts', function() {
    var injector = createInjector(['ng', function($httpProvider) {
      $httpProvider.interceptors.push(function($q) {
        return {
          request: function(config) {
            config.params.intercepted = true;
            return $q.when(config);
          }
        };
      });
    }]);
    $http = injector.get('$http');
    $rootScope = injector.get('$rootScope');

    $http.get('http://teropa.info', {params: {}});
    $rootScope.$apply();
    expect(requests[0].url).toBe('http://teropa.info?intercepted=true');
  });

  it('allows intercepting responses', function() {
    var injector = createInjector(['ng', function($httpProvider) {
      $httpProvider.interceptors.push(_.constant({
        response: function(response) {
          response.intercepted = true;
          return response;
        }
      }));
    }]);
    $http = injector.get('$http');
    $rootScope = injector.get('$rootScope');
    var response;

    $http.get('http://teropa.info').then(function(r) {
      response = r;
    });
    $rootScope.$apply();

    requests[0].respond(200, {}, 'Hello');
    expect(response.intercepted).toBe(true);
  });

  it('allows intercepting request errors', function() {
    var requestsErrorSpy = jasmine.createSpy();
    var injector = createInjector(['ng', function($httpProvider) {
      $httpProvider.interceptors.push(_.constant({
        request: function(config) {
          throw 'fail';
        }
      }));
      $httpProvider.interceptors.push(_.constant({
        requestsError: requestsErrorSpy
      }));
    }]);
    $http = injector.get('$http');
    $rootScope = injector.get('$rootScope');

    $http.get('http://teropa.info');
    $rootScope.$apply();

    expect(requests.length).toBe(0);
    expect(requestsErrorSpy).toHaveBeenCalledWith('fail');
  });

  it('allows intercepting response errors', function() {
    var responseErrorSpy = jasmine.createSpy();
    var injector = createInjector(['ng', function($httpProvider) {
      $httpProvider.interceptors.push(_.constant({
        responseError: responseErrorSpy
      }));
      $httpProvider.interceptors.push(_.constant({
        response: function(config) {
          throw 'fail';
        }
      }));
    }]);
    $http = injector.get('$http');
    $rootScope = injector.get('$rootScope');

    $http.get('http://teropa.info');
    $rootScope.$apply();

    requests[0].respond(200, {}, 'Hello');
    $rootScope.$apply();

    expect(responseErrorSpy).toHaveBeenCalledWith('fail');
  });

  it('allows attaching success handlers', function() {
    var data, status, headers, config;
    $http.get('http://teropa.info').success(function(d, s, h, c) {
      data = d;
      status = s;
      headers = h;
      config = c;
    });
    $rootScope.$apply();

    requests[0].respond(200, {'Cache-Control': 'no-cache'}, 'Hello');
    $rootScope.$apply();

    expect(data).toBe('Hello');
    expect(status).toBe(200);
    expect(headers('Cache-Control')).toBe('no-cache');
    expect(config.method).toBe('GET');
  });

  it('allows attaching error handlers', function() {
    var data, status, headers, config;
    $http.get('http://teropa.info').error(function(d, s, h, c) {
      data = d;
      status = s;
      headers = h;
      config = c;
    });
    $rootScope.$apply();

    requests[0].respond(401, {'Cache-Control': 'no-cache'}, 'Fail');
    $rootScope.$apply();

    expect(data).toBe('Fail');
    expect(status).toBe(401);
    expect(headers('Cache-Control')).toBe('no-cache');
    expect(config.method).toBe('GET');
  });

  it('allows aborting a request with a promise', function() {
    var timeout = $q.defer();
    $http.get('http://teropa.info', {
      timeout: timeout.promise
    });
    $rootScope.$apply();

    timeout.resolve();
    $rootScope.$apply();

    expect(requests[0].aborted).toBe(true);
  });

  it('allows aborting a request after a timeout', function() {
    $http.get('http://teropa.info', {
      timeout: 5000
    });
    $rootScope.$apply();

    setTimeout(function () {
      expect(requests[0].aborted).toBe(true);
    }, 5001);
  });

  describe('pending requests', function () {
    it('are in the collection while pending', function() {
      $http.get('http://teropa.info');
      $rootScope.$apply();

      expect($http.pendingRequests).toBeDefined();
      expect($http.pendingRequests.length).toBe(1);
      expect($http.pendingRequests[0].url).toBe('http://teropa.info');

      requests[0].respond(200, {}, 'OK');
      $rootScope.$apply();

      expect($http.pendingRequests.length).toBe(0);
    });

    it('are also creared on failure', function() {
      $http.get('http://teropa.info');
      $rootScope.$apply();

      requests[0].respond(404, {}, 'Not found');

      expect($http.pendingRequests.length).toBe(0);
    });
  });

  describe('useApplyAsync', function () {
    beforeEach(function() {
      var injector = createInjector(['ng', function($httpProvider) {
        $httpProvider.useApplyAsync(true);
      }]);
      $http = injector.get('$http');
      $rootScope = injector.get('$rootScope');
    });

    it('does not resolve promise immediately when enabled', function() {
      var resolvedSpy = jasmine.createSpy();
      $http.get('http://teropa.info').then(resolvedSpy);
      $rootScope.$apply();

      requests[0].respond(200, {}, 'OK');
      expect(resolvedSpy).not.toHaveBeenCalled();
    });

    it('resolves promise later when enabled', function() {
      var resolvedSpy = jasmine.createSpy();
      $http.get('http://teropa.info').then(resolvedSpy);
      $rootScope.$apply();

      requests[0].respond(200, {}, 'OK');
      setTimeout(function () {
        expect(resolvedSpy).toHaveBeenCalled();
      }, 100);
    });
  });
});
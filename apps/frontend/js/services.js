app.factory('authInterceptor', ['$q', '$location', '$rootScope', function ($q, $location, $rootScope) {
  return {
    request: function (config) {
      var token = localStorage.getItem('token');
      if (token) {
        config.headers['X-Auth-Token'] = token;
      }
      return config;
    },
    responseError: function (rejection) {
      if (rejection.status == 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        $rootScope.currentUser = null;
        $location.path('/login');
      }
      return $q.reject(rejection);
    }
  };
}]);

app.service('AuthService', ['$http', '$rootScope', function ($http, $rootScope) {
  var self = this;

  this.login = function (username, password) {
    return $http.post(API_URL + '/users/login', { username: username, password: password }).then(function (res) {
      self.saveSession(res.data);
      return res.data;
    });
  };

  this.register = function (data) {
    return $http.post(API_URL + '/users/register', data).then(function (res) {
      self.saveSession(res.data);
      return res.data;
    });
  };

  this.logout = function () {
    return $http.post(API_URL + '/users/logout').finally(function () {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      $rootScope.currentUser = null;
    });
  };

  this.saveSession = function (data) {
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    $rootScope.currentUser = data.user;
  };

  this.getUser = function () {
    var u = localStorage.getItem('user');
    return u ? JSON.parse(u) : null;
  };
}]);

app.factory('Todos', ['$http', function ($http) {
  return {
    list: function (params) {
      return $http.get(API_URL + '/todos', { params: params });
    },
    get: function (id) {
      return $http.get(API_URL + '/todos/' + id);
    },
    create: function (todo) {
      return $http.post(API_URL + '/todos', todo);
    },
    update: function (id, todo) {
      return $http.put(API_URL + '/todos/' + id, todo);
    },
    toggle: function (id) {
      return $http.post(API_URL + '/todos/' + id + '/toggle');
    },
    remove: function (id) {
      return $http.delete(API_URL + '/todos/' + id);
    },
    bulk: function (action, listId) {
      return $http.post(API_URL + '/todos/bulk', { action: action, list_id: listId });
    }
  };
}]);

app.factory('Lists', ['$http', function ($http) {
  return {
    all: function () { return $http.get(API_URL + '/lists'); },
    create: function (list) { return $http.post(API_URL + '/lists', list); },
    update: function (id, list) { return $http.put(API_URL + '/lists/' + id, list); },
    remove: function (id) { return $http.delete(API_URL + '/lists/' + id); }
  };
}]);

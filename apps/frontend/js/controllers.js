app.controller('MainCtrl', ['$scope', '$rootScope', '$location', 'AuthService', function ($scope, $rootScope, $location, AuthService) {
  $rootScope.currentUser = AuthService.getUser();

  $scope.isActive = function (path) {
    return $location.path().indexOf(path) === 0;
  };

  $scope.logout = function () {
    AuthService.logout().then(function () {
      $location.path('/login');
    });
  };
}]);

app.controller('LoginCtrl', ['$scope', '$location', 'AuthService', function ($scope, $location, AuthService) {
  $scope.form = {};
  $scope.error = null;

  $scope.login = function () {
    $scope.error = null;
    $scope.loading = true;
    AuthService.login($scope.form.username, $scope.form.password).then(function () {
      $location.path('/todos');
    }, function (err) {
      $scope.error = (err.data && err.data.error) || 'Login failed';
    }).finally(function () {
      $scope.loading = false;
    });
  };
}]);

app.controller('RegisterCtrl', ['$scope', '$location', 'AuthService', function ($scope, $location, AuthService) {
  $scope.form = {};

  $scope.register = function () {
    if ($scope.form.password != $scope.form.password2) {
      $scope.error = 'Passwords do not match';
      return;
    }
    if ($scope.form.password.length < 3) {
      $scope.error = 'Password too short';
      return;
    }
    AuthService.register({
      username: $scope.form.username,
      password: $scope.form.password,
      email: $scope.form.email
    }).then(function () {
      $location.path('/todos');
    }, function (err) {
      $scope.error = (err.data && err.data.error) || 'Registration failed';
    });
  };
}]);

app.controller('TodosCtrl', ['$scope', '$rootScope', '$location', 'Todos', 'Lists', function ($scope, $rootScope, $location, Todos, Lists) {
  $scope.lists = [];
  $scope.todos = [];
  $scope.selectedList = null;
  $scope.filter = { done: '', q: '', tag: '', sort: '' };
  $scope.page = 1;
  $scope.newTodo = { priority: 2 };
  $scope.newList = { color: '#337ab7' };

  function loadLists() {
    Lists.all().then(function (res) {
      $scope.lists = res.data;
      if (!$scope.selectedList && $scope.lists.length) {
        $scope.selectedList = $scope.lists[0];
        loadTodos();
      } else if ($scope.selectedList) {
        // refresh selected list object so counters update
        for (var i = 0; i < $scope.lists.length; i++) {
          if ($scope.lists[i].id == $scope.selectedList.id) {
            $scope.selectedList = $scope.lists[i];
          }
        }
      }
    }, function () {
      $rootScope.globalError = 'Could not load lists';
    });
  }

  function loadTodos() {
    var params = { page: $scope.page };
    if ($scope.selectedList) params.list = $scope.selectedList.id;
    if ($scope.filter.done !== '') params.done = $scope.filter.done;
    if ($scope.filter.q) params.q = $scope.filter.q;
    if ($scope.filter.tag) params.tag = $scope.filter.tag;
    if ($scope.filter.sort) params.sort = $scope.filter.sort;

    $scope.loading = true;
    Todos.list(params).then(function (res) {
      $scope.todos = res.data;
      $scope.loading = false;
    }, function () {
      $scope.loading = false;
      $rootScope.globalError = 'Could not load todos';
    });
  }

  $scope.selectList = function (list) {
    $scope.selectedList = list;
    $scope.page = 1;
    loadTodos();
  };

  $scope.applyFilter = function () {
    $scope.page = 1;
    loadTodos();
  };

  $scope.filterByTag = function (tag) {
    $scope.filter.tag = tag;
    $scope.applyFilter();
  };

  $scope.nextPage = function () {
    $scope.page++;
    loadTodos();
  };

  $scope.prevPage = function () {
    if ($scope.page > 1) {
      $scope.page--;
      loadTodos();
    }
  };

  $scope.addTodo = function () {
    if (!$scope.newTodo.title) return;
    var todo = angular.copy($scope.newTodo);
    todo.list_id = $scope.selectedList ? $scope.selectedList.id : null;
    if (todo.tagsText) {
      todo.tags = todo.tagsText.split(',').map(function (t) { return t.trim(); });
      delete todo.tagsText;
    }
    if (todo.due_date) {
      todo.due_date = moment(todo.due_date).format('YYYY-MM-DD');
    }
    Todos.create(todo).then(function (res) {
      $scope.todos.unshift(res.data);
      $scope.newTodo = { priority: 2 };
      loadLists();
    }, function (err) {
      alert('Error: ' + (err.data && err.data.error));
    });
  };

  $scope.toggle = function (todo) {
    Todos.toggle(todo.id).then(function () {
      loadLists();
    }, function () {
      todo.done = !todo.done;
    });
  };

  $scope.remove = function (todo) {
    if (!confirm('Delete "' + todo.title + '"?')) return;
    Todos.remove(todo.id).then(function () {
      $scope.todos.splice($scope.todos.indexOf(todo), 1);
      loadLists();
    });
  };

  $scope.edit = function (todo) {
    $location.path('/todos/' + todo.id);
  };

  $scope.completeAll = function () {
    Todos.bulk('complete_all', $scope.selectedList.id).then(function () {
      loadTodos();
      loadLists();
    });
  };

  $scope.clearDone = function () {
    if (!confirm('Delete all completed todos in this list?')) return;
    Todos.bulk('clear_done', $scope.selectedList.id).then(function () {
      loadTodos();
      loadLists();
    });
  };

  $scope.openNewList = function () {
    $scope.newList = { color: '#337ab7' };
    $('#newListModal').modal('show');
  };

  $scope.createList = function () {
    Lists.create($scope.newList).then(function (res) {
      $('#newListModal').modal('hide');
      $scope.lists.push(res.data);
      $scope.selectList(res.data);
    });
  };

  $scope.deleteList = function (list) {
    if (!confirm('Delete list "' + list.name + '" and all its todos?')) return;
    Lists.remove(list.id).then(function () {
      $scope.selectedList = null;
      loadLists();
    }, function (err) {
      alert(err.data.error);
    });
  };

  $scope.priorityClass = function (todo) {
    if (todo.priority == 3) return 'label-danger';
    if (todo.priority == 1) return 'label-default';
    return 'label-info';
  };

  loadLists();
}]);

app.controller('TodoEditCtrl', ['$scope', '$routeParams', '$location', 'Todos', 'Lists', function ($scope, $routeParams, $location, Todos, Lists) {
  $scope.todo = null;

  Lists.all().then(function (res) {
    $scope.lists = res.data;
  });

  Todos.get($routeParams.id).then(function (res) {
    $scope.todo = res.data;
    $scope.todo.tagsText = $scope.todo.tags.join(', ');
    if ($scope.todo.due_date) {
      $scope.todo.due_date = new Date($scope.todo.due_date);
    }
  }, function () {
    $location.path('/todos');
  });

  $scope.save = function () {
    var data = {
      title: $scope.todo.title,
      notes: $scope.todo.notes,
      priority: parseInt($scope.todo.priority),
      list_id: $scope.todo.list_id,
      done: $scope.todo.done,
      due_date: $scope.todo.due_date ? moment($scope.todo.due_date).format('YYYY-MM-DD') : null,
      tags: $scope.todo.tagsText ? $scope.todo.tagsText.split(',').map(function (t) { return t.trim(); }) : []
    };
    Todos.update($scope.todo.id, data).then(function () {
      $location.path('/todos');
    }, function (err) {
      $scope.error = 'Save failed';
    });
  };

  $scope.cancel = function () {
    $location.path('/todos');
  };
}]);

app.controller('StatsCtrl', ['$scope', '$http', function ($scope, $http) {
  $http.get(API_URL + '/stats').then(function (res) {
    $scope.stats = res.data;
    $scope.tagList = [];
    for (var tag in res.data.tags) {
      $scope.tagList.push({ name: tag, count: res.data.tags[tag] });
    }
    $scope.tagList.sort(function (a, b) { return b.count - a.count; });
  });
}]);

app.controller('SettingsCtrl', ['$scope', '$http', '$rootScope', function ($scope, $http, $rootScope) {
  $scope.form = {};

  $http.get(API_URL + '/users/me').then(function (res) {
    $scope.me = res.data;
    $scope.form.email = res.data.email;
  });

  $scope.save = function () {
    $scope.message = null;
    if ($scope.form.password && $scope.form.password != $scope.form.password2) {
      $scope.message = { type: 'danger', text: 'Passwords do not match' };
      return;
    }
    $http.put(API_URL + '/users/me', { email: $scope.form.email, password: $scope.form.password }).then(function () {
      $scope.message = { type: 'success', text: 'Saved!' };
      var u = JSON.parse(localStorage.getItem('user'));
      u.email = $scope.form.email;
      localStorage.setItem('user', JSON.stringify(u));
      $rootScope.currentUser = u;
      $scope.form.password = $scope.form.password2 = '';
    }, function () {
      $scope.message = { type: 'danger', text: 'Error saving settings' };
    });
  };
}]);

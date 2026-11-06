var app = angular.module('todoApp', ['ngRoute']);

app.config(['$routeProvider', '$httpProvider', function ($routeProvider, $httpProvider) {
  $routeProvider
    .when('/login', { templateUrl: 'views/login.html', controller: 'LoginCtrl' })
    .when('/register', { templateUrl: 'views/register.html', controller: 'RegisterCtrl' })
    .when('/todos', { templateUrl: 'views/todos.html', controller: 'TodosCtrl' })
    .when('/todos/:id', { templateUrl: 'views/todo-edit.html', controller: 'TodoEditCtrl' })
    .when('/stats', { templateUrl: 'views/stats.html', controller: 'StatsCtrl' })
    .when('/settings', { templateUrl: 'views/settings.html', controller: 'SettingsCtrl' })
    .otherwise({ redirectTo: '/todos' });

  $httpProvider.interceptors.push('authInterceptor');
}]);

app.run(['$rootScope', '$location', function ($rootScope, $location) {
  $rootScope.$on('$routeChangeStart', function (event, next) {
    var token = localStorage.getItem('token');
    var publicPages = ['views/login.html', 'views/register.html'];
    if (!token && next.templateUrl && publicPages.indexOf(next.templateUrl) == -1) {
      $location.path('/login');
    }
  });
}]);

'use strict';

angular.module('uchiwa', [
  'uchiwa.controllers',
  'uchiwa.constants',
  'uchiwa.directives',
  'uchiwa.factories',
  'uchiwa.filters',
  'uchiwa.providers',
  'uchiwa.services',
  // Angular dependencies
  'ngCookies',
  'ngRoute',
  'ngSanitize',
  // 3rd party dependencies
  'toastr',
  'ui.bootstrap'
]);

angular.module('uchiwa').config(['$routeProvider', '$tooltipProvider',
  function ($routeProvider, $tooltipProvider) {
    $routeProvider
      .when('/', {redirectTo: function () { return '/events'; }})
      .when('/events', {templateUrl: 'bower_components/uchiwa-web/partials/views/events.html', reloadOnSearch: false, controller: 'events'})
      .when('/client/:dcId/:clientId', {templateUrl: 'bower_components/uchiwa-web/partials/client/index.html', reloadOnSearch: false, controller: 'client'})
      .when('/clients', {templateUrl: 'bower_components/uchiwa-web/partials/views/clients.html', reloadOnSearch: false, controller: 'clients'})
      .when('/checks', {templateUrl: 'bower_components/uchiwa-web/partials/views/checks.html', reloadOnSearch: false, controller: 'checks'})
      .when('/info', {templateUrl: 'bower_components/uchiwa-web/partials/views/info.html', controller: 'info'})
      .when('/stashes', {templateUrl: 'bower_components/uchiwa-web/partials/views/stashes.html', reloadOnSearch: false, controller: 'stashes'})
      .when('/settings', {templateUrl: 'bower_components/uchiwa-web/partials/views/settings.html', controller: 'settings'})
      .otherwise('/');
    $tooltipProvider.options({'placement': 'bottom'});
  }]);

'use strict';

var serviceModule = angular.module('uchiwa.services', []);

/**
* Uchiwa
*/
serviceModule.service('backendService', ['$http', 'notification', '$rootScope',
  function($http, notification, $rootScope){
    var self = this;
    this.createStash = function (payload) {
      return $http.post('post_stash', payload);
    };
    this.deleteClient = function (client, dc) {
      return $http.get('delete_client?id=' + client + '&dc=' + dc );
    };
    this.deleteStash = function (payload) {
      return $http.post('delete_stash', payload);
    };
    this.getClient = function (client, dc) {
      return $http.get('get_client?id=' + client + '&dc=' + dc );
    };
    this.getConfig = function () {
      return $http.get('get_config');
    };
    this.getHealth = function () {
      return $http.get('health/sensu');
    };
    this.getSensu = function () {
      return $http.get('get_sensu');
    };
    this.resolveEvent = function (payload) {
      return $http.post('post_event', payload);
    };
    this.update = function () {
      if ($rootScope.skipRefresh) {
        $rootScope.skipRefresh = false;
        return;
      }
      self.getHealth()
      .success(function (data) {
        $rootScope.health = data;
      });
      self.getSensu()
      .success(function (data) {
        angular.forEach(data, function(value, key) { // initialize null elements
          if (!value || value === null) {
            data[key] = [];
          }
        });
        $rootScope.checks = data.Checks;
        $rootScope.dc = data.Dc;

        $rootScope.clients = _.map(data.Clients, function(client) {
          var existingClient = _.findWhere($rootScope.clients, {name: client.name, dc: client.dc});
          if (existingClient !== undefined) {
            client = angular.extend(existingClient, client);
          }
          return existingClient || client;
        });

        $rootScope.events = _.map(data.Events, function(event) {
          event._id = event.dc + '/' + event.client.name + '/' + event.check.name;
          var existingEvent = _.findWhere($rootScope.events, {_id: event._id});
          if (existingEvent !== undefined) {
            event = angular.extend(existingEvent, event);
          }
          return existingEvent || event;
        });

        $rootScope.stashes = data.Stashes;
        $rootScope.subscriptions = data.Subscriptions;
        $rootScope.$broadcast('sensu');
      })
      .error(function (error) {
        notification('error', 'Could not fetch Sensu data. Is Uchiwa running?');
        console.error('Error: '+ JSON.stringify(error));
      });
    };
  }
]);

/**
* Clients
*/
serviceModule.service('clientsService', ['$location', '$rootScope', 'notification', 'backendService', function ($location, $rootScope, notification, backendService) {
  this.getCheck = function (id, history) {
    return history.filter(function (item) {
      return item.check === id;
    })[0];
  };
  this.getEvent = function (client, check, events) {
    if (!client || !check || events.constructor.toString().indexOf('Array') === -1) { return null; }
    return events.filter(function (item) {
      return (item.client.name === client && item.check.name === check);
    })[0];
  };
  this.resolveEvent = function (dc, client, check) {
    if (!angular.isObject(client) || !angular.isObject(check)) {
      notification('error', 'Could not resolve this event. Try to refresh the page.');
      console.error('Received:\nclient='+ JSON.stringify(client) + '\ncheck=' + JSON.stringify(check));
      return false;
    }

    var checkName = check.name || check.check;
    var payload = {dc: dc, payload: {client: client.name, check: checkName}};

    backendService.resolveEvent(payload)
      .success(function () {
        notification('success', 'The event has been resolved.');
        if ($location.url() !== '/events') {
          $location.url(encodeURI('/client/' + dc + '/' + client.name));
        } else {
          var _id = dc + '/' + client.name + '/' + checkName;
          var event = _.findWhere($rootScope.events, {_id: _id});
          var eventPosition = $rootScope.events.indexOf(event);
          $rootScope.events.splice(eventPosition, 1);
        }
      })
      .error(function (error) {
        notification('error', 'The event was not resolved. ' + error);
      });
  };
  this.deleteClient = function (dc, client) {
    backendService.deleteClient(client, dc)
      .success(function () {
        notification('success', 'The client has been deleted.');
        $location.url('/clients');
        return true;
      })
      .error(function (error) {
        notification('error', 'Could not delete the client '+ client +'. Is Sensu API running on '+ dc +'?');
        console.error(error);
      });
  };
}]);


/**
* Navbar
*/
serviceModule.service('navbarServices', ['$rootScope', function ($rootScope) {
  // Badges count
  this.countStatuses = function (collection, getStatusCode) {
    var criticals = 0;
    var warnings = 0;
    var unknowns = 0;
    var total = collection.length;

    criticals += collection.filter(function (item) {
      return getStatusCode(item) === 2;
    }).length;
    warnings += collection.filter(function (item) {
      return getStatusCode(item) === 1;
    }).length;
    unknowns += collection.filter(function (item) {
      return getStatusCode(item) > 2;
    }).length;

    collection.warning = warnings;
    collection.critical = criticals;
    collection.total = criticals + warnings;
    collection.unknown = unknowns;
    collection.total = total;
    collection.style = collection.critical > 0 ? 'critical' : collection.warning > 0 ? 'warning' : collection.unknown > 0 ? 'unknown' : 'success';
  };
  this.health = function () {
    var alerts = [];
    angular.forEach($rootScope.health, function(value, key) {
      if (value.output !== 'ok') {
        alerts.push('Datacenter <strong>' + key + '</strong> returned: <em>' + value.output + '</em>');
      }
    });
    $rootScope.alerts = alerts;
  };
}]);

/**
* Routing
*/
serviceModule.service('routingService', ['$location', function ($location) {
  var filtersDefaultValues = {
    'limit': 50
  };
  this.go = function (path) {
    path = encodeURI(path);
    $location.url(path);
  };
  this.deleteEmptyParameter = function (routeParams, key) {
    if (routeParams[key] === '') {
      delete $location.$$search[key];
      $location.$$compose();
    }
  };
  this.initFilters = function (routeParams, filters, possibleFilters) {
    var self = this;
    angular.forEach(possibleFilters, function (key) {
      if (angular.isDefined(routeParams[key])) {
        self.updateValue(filters, routeParams[key], key);
        self.deleteEmptyParameter(routeParams, key);
      }
      else {
        self.updateValue(filters, '', key);
      }
    });
  };
  this.permalink = function (e, key, value) {
    $location.search(key, value);
  };
  this.updateFilters = function (routeParams, filters) {
    var self = this;
    angular.forEach(routeParams, function (value, key) {
      self.updateValue(filters, value, key);
      self.deleteEmptyParameter(routeParams, key);
    });
  };
  this.updateValue = function (filters, value, key) {
    if (value === '') {
      filters[key] = filtersDefaultValues[key] ? filtersDefaultValues[key] : value;
    }
    else {
      filters[key] = value;
    }
  };
}]);

/**
* Stashes
*/
serviceModule.service('stashesService', ['$rootScope', '$modal', 'notification', 'backendService', function ($rootScope, $modal, notification, backendService) {
  this.construct = function(item) {
    var check;
    var client;
    var path = [];

    if (angular.isObject(item) && angular.isDefined(item.client) && angular.isDefined(item.check)) { // event
      if (!angular.isObject(item.check)) {
        check = item.check;
      }
      else {
        check = {check: item.check};
      }
      if (angular.isObject(item.check)) {
        client = item.client;
      }
      else {
        client = {name: item.client};
      }
    }
    else if (angular.isObject(item) && angular.isDefined(item.name)) { // client
      client = item;
      check = null;
    }
    else { // unknown
      notification('error', 'Cannot handle this stash. Try to refresh the page.');
      console.error('Cannot handle this stash. Received:\nitem: '+ JSON.stringify(item));
      return false;
    }

    path.push(client.name);

    var checkName = '';
    if (check) {
      if (angular.isObject(check.check)) {
        checkName = check.check.name;
      } else {
        checkName = check;
      }
    }
    path.push(checkName);

    return path;
  };
  this.stash = function (e, i) {
    var items = _.isArray(i) ? i : new Array(i);
    var event = e || window.event;
    event.stopPropagation();

    if (items.length === 0) {
      notification('error', 'No items selected');
    } else {
      var modalInstance = $modal.open({ // jshint ignore:line
        templateUrl: $rootScope.partialsPath + '/stash-modal.html',
        controller: 'StashModalCtrl',
        resolve: {
          items: function () {
            return items;
          }
        }
      });
    }
  };
  this.submit = function (element, item) {
    var isAcknowledged = element.acknowledged;
    var path = this.construct(element);
    if (path[1] !== '') {
      path[1] = '/' + path[1];
    }
    if (angular.isUndefined(item.reason)) {
      item.reason = '';
    }
    path = 'silence/' + path[0] + path[1];
    var data = {dc: element.dc, payload: {}};

    $rootScope.skipRefresh = true;
    if (isAcknowledged) {
      data.payload = {path: path};
      backendService.deleteStash(data)
        .success(function () {
          notification('success', 'The stash has been deleted.');
          element.acknowledged = !element.acknowledged;
          return true;
        })
        .error(function (error) {
          notification('error', 'The stash was not created. ' + error);
          console.error(error);
          return false;
        });
    }
    else {
      data.payload = {path: path, content: {'reason': item.reason, 'source': 'uchiwa'}};
      if (item.expiration && item.expiration !== -1){
        data.payload.expire = item.expiration;
      }
      data.payload.content.timestamp = Math.floor(new Date()/1000);
      if (item.content && item.content.timestamp) {
        data.payload.content.timestamp = item.content.timestamp;
      }
      else {
        data.payload.content.timestamp = Math.floor(new Date()/1000);
      }
      backendService.createStash(data)
        .success(function () {
          notification('success', 'The stash has been created.');
          element.acknowledged = !element.acknowledged;
          return true;
        })
        .error(function (error) {
          notification('error', 'The stash was not created. ' + error);
          console.error(error);
          return false;
        });
    }
  };
  this.deleteStash = function (stash) {
    $rootScope.skipRefresh = true;
    var data = {dc: stash.dc, payload: {path: stash.path}};
    backendService.deleteStash(data)
      .success(function () {
        notification('success', 'The stash has been deleted.');
        for (var i=0; $rootScope.stashes; i++) {
          if ($rootScope.stashes[i].path === stash.path) {
            $rootScope.stashes.splice(i, 1);
            break;
          }
        }
        return true;
      })
      .error(function (error) {
        notification('error', 'The stash was not created. ' + error);
        console.error(error);
        return false;
      });
  };
}]);

/**
* Helpers service
*/
serviceModule.service('helperService', function() {
  // Stop event propagation if an A tag is clicked
  this.openLink = function($event) {
    if($event.srcElement.tagName === 'A'){
      $event.stopPropagation();
    }
  };
  this.selectedItems = function(items) {
    return _.filter(items, function(item) {
      return item.selected === true;
    });
  };
});

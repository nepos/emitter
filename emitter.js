import Logger from 'logger';
import angular from 'angular';
/**
 *  @ngdoc overview
 *  @name Emitter
 *  @module
 *
 *  @description
 *
 * see service description for more details
 *
 */
let Emitter = angular.module('app.emitter', []);

/**
 *  @ngdoc service
 *  @name Emitter.Emitter
 *  @service
 *
 *  @description
 *
 *  # Emitter
 * This is an mixin for your module to provide a smooth and elegant callback structure, e.g. in a well structured module
 *
	```js
 	//definition:
 	var Module = function() {
			var my = new Emitter();
			var that = {};

			my.construct = function() {
				return that;
			};

			//make the listener public to allow users of the module to listen to events
			that.on = my.on;

			//dummy function to trigger something
			that.something = function() {
				my.trigger('bing');
			};

			return my.construct.apply({}, arguments);
		};

		//usage:
		var something = new Module();

		something.on('bing', function() {
			console.log('local callback bong');
		});

		DEPRECATED!!!
		something.on.global('bing', function() {
			console.log('%cglobal', 'font-weight:bold', 'callback bong');
		});
		```
 *
 *	Listeners binded with `something.on()` are now automaticly binded to the current location and the callback will be removed on state change.
 *	`something.on.global()` will not be removed automaticly and has to be removed by hand!
 *
 *	To control the flow, you can access `global()` and `local()` listener functions on `that.on`.
 *
 *	## Remove your listeners, man!
 *	Its really important to remove your global listeners, or at least make sure, they are not binded again and again.
 *
 *	Both `on()` functions returns a function to remove the callback again.
 *	```
	var removeListener = something.on.global('blub', doIt);
	$rootScope.$on('$leave', removeListener);

	ctrl.$onDestry = function() {
		...
		removeListener();
		...
	}
 *	```
 *	The Emitter will error if more than 20 listeners binded.
 *
 */

/*var GlobalEmitter = {
	counter: 0,
	listeners: [],
	push: function(o) {
		this.listeners.push(o);
		this.counter++;
		console.log('+++ [+] adding listener', o, '->', this.counter);
	},
	remove: function(o) {
		this.counter--;
		console.log('+++ [-] removing listener', o, '->', this.counter);
	}
};*/

Emitter.factory('Emitter', function EmitterFactory($rootScope, $location) {
	return function() {
		const my = {};
		const that = {};
		const logger = Logger('Emitter', 'red');

		my.construct = function() {
			my.callbacks = {};
			// window.__calbacks = my.callbacks;
			return that;
		};

		my.getStateIdentifier = function() {
			const identifier = $location.url() || '/';
			logger('state identifier is', identifier);
			return identifier;
		};

		//bind to an event
		my.on = function(...args) {
			let index = -1;
			let state = '';
			let name = '';
			let callback = function() {};

			//two arguments: global listener, triggered in every situation
			if(args.length === 2) {
				state = 'global';
				name = args[0];
				callback = args[1];
			}

			//three arguments: state listener, triggered only if the user is on the current state
			if(args.length === 3) {
				state = args[0];
				name = args[1];
				callback = args[2];
			}

			logger('bind', state, name);

			//save callback for later trigger
			if(!my.callbacks[state]) {
				my.callbacks[state] = [];
			}
			if(!my.callbacks[state][name]) {
				my.callbacks[state][name] = [];
			}
			index = my.callbacks[state][name].push(callback) - 1;

			if(index > 20) {
				logger.error(`more than 20 listeners binded to ${state} ${name} is that correct?`);
			}
			// if(state === 'global' && index > 0) {
			// 	logger.error(`just one listener allowed for global events ${name} is that correct?`);
			// }

			logger.trace();

			// GlobalEmitter.push({ index: index, name: name, state: state });

			return my.returnOff(callback, name, state);
		};

		//
		my.returnOff = function(callback, name, state) {
			return function() {
				logger('remove', state, callback);
				my.callbacks[state][name] = my.callbacks[state][name].filter(cb => cb !== callback);
				callback = null;
				// GlobalEmitter.remove({ index: index, name: name, state: state });
				//my.callbacks[state][name].splice(index, 1);
			};
		};

		/**
   * @ngdoc method
   * @name Emitter.Emitter#trigger
   * @methodOf Emitter.Emitter
   * @description
   *
   * Trigger something on your object. Its trigger local and global events automaticly. Returns nothing.
   *
   * @param {string} eventname
   * Name of the event to trigger
   *
   * @param {*} args
   * Optional one or more arguments which will be passed onto the event listeners.
   *
   * @constructor
   */
		that.trigger = function(eventname, ...args) {
			const state = my.getStateIdentifier();
			logger('trigger', state, arguments);

			//trigger global event listeners
			if(my.callbacks.global && my.callbacks.global[eventname]) {
				my.callbacks.global[eventname].forEach(callback => {
					$rootScope.$evalAsync(() => {
						callback.apply(that, args);
					});
				});
			}

			//trigger state parameters
			if(my.callbacks[state] && my.callbacks[state][eventname]) {
				my.callbacks[state][eventname].forEach(callback => {
					$rootScope.$evalAsync(() => {
						callback.apply(that, args);
					});
				});
			}
		};

		//helper function for local bindings
		my.localOn = function(...args) {
			return my.on(my.getStateIdentifier(), ...args);
		};

		//helper function for global bindings
		my.globalOn = function(...args) {
			return my.on(...args);
		};

		//helper function for just listening one time
		my.once = function(name, ...args) {
			const cb = args.pop();
			const removeListener = my.globalOn(name,() => {
				removeListener();
				cb(name, ...args);
			});
			return removeListener;
		};

		/**
   * @ngdoc method
   * @name Emitter.Emitter#on
   * @methodOf Emitter.Emitter
   * @description
   *
   * local on listeners are binded to the $location.url and will not be called if url is changed.
   *
   * @param {string} eventname
   * Event name to listen on.
   *
   * @param {function} callback
   * Function to call when the event is triggered.
   *
   * @returns {function} callback to remove the listner
   */
		that.on = my.localOn;

		/**
   * @ngdoc method
   * @name Emitter.Emitter#global
   * @methodOf Emitter.Emitter
   * @description
   * # CALL WITH `on.global()`
   *
   * global listeners are not removed automaticly. available under `that.on.global()`
   *
   * @param {string} eventname
   * Event name to listen on.
   *
   * @param {function} callback
   * Function to call when the event is triggered.
   *
   * @returns {function} callback to remove the listner
   */
		that.on.global = my.globalOn;

		/**
   * @ngdoc method
   * @name Emitter.Emitter#local
   * @methodOf Emitter.Emitter
   * @description
   * # CALL WITH `on.local()`
   *
   * just for consistency as a counter part to `on.global()`. Its the same function like `on()`
   *
   * @param {string} eventname
   * Event name to listen on.
   *
   * @param {function} callback
   * Function to call when the event is triggered.
   *
   * @returns {function} callback to remove the listner
   */
		that.on.local = my.localOn;

		/**
   * @ngdoc method
   * @name app.ServiceOrFactory#once
   * @methodOf Emitter.Emitter
   * @description
   *
   * listen to an event and remove listener, after called. Its automaticly global binded.
   *
   * @param {string} eventname
   *  Event name to listen on.
   * @param {function} callback
   *  Function to call when event is triggered
   *
   * @returns {function} callback to remove the listner
   */
		that.once = my.once;

		return my.construct.apply({}, arguments);
	};
});

export default Emitter;

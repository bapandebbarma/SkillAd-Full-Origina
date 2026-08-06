/**
 * @supabase/realtime-js — no-op stub for React Native / Hermes Android builds
 *
 * The real @supabase/realtime-js >=2.8.0 contains a dynamic OTEL loader that
 * hermesc (the Hermes compiler) cannot compile. It exits with code 2, failing
 * exits with code 2, failing every Android APK build.
 *
 * This stub:
 *   - Contains ZERO dynamic imports — hermesc compiles it without errors
 *   - Exports the same class/constant names that @supabase/supabase-js expects
 *   - Allows supabase to initialise and perform auth/db/storage operations
 *   - Realtime channel subscriptions become no-ops (messages do not auto-push;
 *     the app's existing polling / AsyncStorage fallback takes over)
 *
 * Activated via the "overrides" key in package.json:
 *   "@supabase/realtime-js": "file:./stubs/realtime-stub"
 */

'use strict';

/* ── Constants ─────────────────────────────────────────────────────────────── */

var REALTIME_LISTEN_TYPES = {
  BROADCAST: 'broadcast',
  PRESENCE: 'presence',
  POSTGRES_CHANGES: 'postgres_changes',
};

var REALTIME_SUBSCRIBE_STATES = {
  SUBSCRIBED: 'SUBSCRIBED',
  TIMED_OUT: 'TIMED_OUT',
  CLOSED: 'CLOSED',
  CHANNEL_ERROR: 'CHANNEL_ERROR',
};

var REALTIME_CHANNEL_STATES = {
  closed: 'closed',
  errored: 'errored',
  joined: 'joined',
  joining: 'joining',
  leaving: 'leaving',
};

var REALTIME_PRESENCE_LISTEN_EVENTS = {
  SYNC: 'sync',
  JOIN: 'join',
  LEAVE: 'leave',
};

var REALTIME_POSTGRES_CHANGES_LISTEN_EVENT = {
  ALL: '*',
  INSERT: 'INSERT',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
};

/* ── RealtimePresence ───────────────────────────────────────────────────────── */

function RealtimePresence(channel, opts) {
  this.state = {};
  this.pendingDiffs = [];
  this.joinRef = null;
  this.caller = { onJoin: function() {}, onLeave: function() {}, onSync: function() {} };
}
RealtimePresence.prototype.syncState = function() {};
RealtimePresence.prototype.syncDiff = function() {};
RealtimePresence.prototype.onJoin = function(callback) { this.caller.onJoin = callback; };
RealtimePresence.prototype.onLeave = function(callback) { this.caller.onLeave = callback; };
RealtimePresence.prototype.onSync = function(callback) { this.caller.onSync = callback; };
RealtimePresence.prototype.list = function() { return []; };
RealtimePresence.prototype.inPendingSync = function() { return false; };

/* ── RealtimeChannel ────────────────────────────────────────────────────────── */

function RealtimeChannel(topic, params, socket) {
  this.topic = topic || '';
  this.params = params || { config: {} };
  this.socket = socket || null;
  this.state = REALTIME_CHANNEL_STATES.closed;
  this.bindings = {};
  this.presence = new RealtimePresence(this, {});
  this.broadcastEndpointURL = '';
  this.subTopic = topic || '';
  this.timeout = 10000;
  this.joinedOnce = false;
}

RealtimeChannel.prototype.subscribe = function(callback, timeout) {
  this.state = REALTIME_CHANNEL_STATES.joined;
  this.joinedOnce = true;
  if (typeof callback === 'function') {
    // Call async so callers can chain after subscribe() returns
    var state = REALTIME_SUBSCRIBE_STATES.SUBSCRIBED;
    setTimeout(function() { callback(state); }, 0);
  }
  return this;
};

RealtimeChannel.prototype.unsubscribe = function() {
  this.state = REALTIME_CHANNEL_STATES.closed;
  return Promise.resolve('ok');
};

RealtimeChannel.prototype.on = function(type, filter, callback) {
  return this;
};

RealtimeChannel.prototype.send = function(payload, opts) {
  return Promise.resolve('ok');
};

RealtimeChannel.prototype.track = function(payload, opts) {
  return Promise.resolve('ok');
};

RealtimeChannel.prototype.untrack = function() {
  return Promise.resolve('ok');
};

RealtimeChannel.prototype.presenceState = function() {
  return {};
};

RealtimeChannel.prototype.push = function(event, payload, timeout) {
  var noop = { receive: function() { return this; } };
  return noop;
};

RealtimeChannel.prototype.leave = function(timeout) {
  var noop = { receive: function() { return this; } };
  return noop;
};

RealtimeChannel.prototype.onClose = function(callback) { return this; };
RealtimeChannel.prototype.onError = function(callback) { return this; };
RealtimeChannel.prototype.isClosed = function() { return this.state === REALTIME_CHANNEL_STATES.closed; };
RealtimeChannel.prototype.isErrored = function() { return this.state === REALTIME_CHANNEL_STATES.errored; };
RealtimeChannel.prototype.isJoined = function() { return this.state === REALTIME_CHANNEL_STATES.joined; };
RealtimeChannel.prototype.isJoining = function() { return this.state === REALTIME_CHANNEL_STATES.joining; };
RealtimeChannel.prototype.isLeaving = function() { return this.state === REALTIME_CHANNEL_STATES.leaving; };

/* ── RealtimeClient ─────────────────────────────────────────────────────────── */

function RealtimeClient(endPoint, options) {
  this.endPoint = endPoint || '';
  this.options = options || {};
  this.channels = [];
  this.conn = null;
  this.params = (options && options.params) || {};
  this.headers = (options && options.headers) || {};
  this.heartbeatIntervalMs = 30000;
  this.pendingHeartbeatRef = null;
  this.ref = 0;
  this.logger = (options && options.logger) || function() {};
  this.accessTokenValue = null;
  this.apiKey = null;
  this.sendBuffer = [];
  this.serializer = {
    serialize: function(msg) { return JSON.stringify(msg); },
    deserialize: function(data) { return JSON.parse(data); },
  };
  this.stateChangeCallbacks = { open: [], close: [], error: [], message: [] };
}

RealtimeClient.prototype.connect = function() {};

RealtimeClient.prototype.disconnect = function(code, reason) {
  return Promise.resolve({ error: null, data: {} });
};

RealtimeClient.prototype.channel = function(topic, chanParams) {
  var ch = new RealtimeChannel(topic, chanParams || { config: {} }, this);
  this.channels.push(ch);
  return ch;
};

RealtimeClient.prototype.getChannels = function() {
  return this.channels;
};

RealtimeClient.prototype.removeChannel = function(channel) {
  this.channels = this.channels.filter(function(c) { return c !== channel; });
  return channel.unsubscribe().then(function() { return 'ok'; });
};

RealtimeClient.prototype.removeAllChannels = function() {
  var self = this;
  return Promise.all(this.channels.map(function(ch) { return ch.unsubscribe(); }))
    .then(function(results) { self.channels = []; return results; });
};

RealtimeClient.prototype.log = function(kind, msg, data) {};
RealtimeClient.prototype.isConnected = function() { return false; };
RealtimeClient.prototype.setAuth = function(token) { this.accessTokenValue = token; return this; };
RealtimeClient.prototype.makeRef = function() { this.ref += 1; return String(this.ref); };
RealtimeClient.prototype.onOpen = function(callback) {};
RealtimeClient.prototype.onClose = function(callback) {};
RealtimeClient.prototype.onError = function(callback) {};
RealtimeClient.prototype.onMessage = function(callback) {};
RealtimeClient.prototype._remove = function(channel) {
  this.channels = this.channels.filter(function(c) { return c !== channel; });
};

/* ── Exports ────────────────────────────────────────────────────────────────── */

module.exports = {
  RealtimeClient: RealtimeClient,
  RealtimeChannel: RealtimeChannel,
  RealtimePresence: RealtimePresence,
  REALTIME_LISTEN_TYPES: REALTIME_LISTEN_TYPES,
  REALTIME_SUBSCRIBE_STATES: REALTIME_SUBSCRIBE_STATES,
  REALTIME_CHANNEL_STATES: REALTIME_CHANNEL_STATES,
  REALTIME_PRESENCE_LISTEN_EVENTS: REALTIME_PRESENCE_LISTEN_EVENTS,
  REALTIME_POSTGRES_CHANGES_LISTEN_EVENT: REALTIME_POSTGRES_CHANGES_LISTEN_EVENT,
};

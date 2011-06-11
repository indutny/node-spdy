/**
 * PushStream class
 */

var Buffer = require('buffer').Buffer,
    util = require('util'),
    stream = require('stream'),
    enums = require('../spdy').enums,
    createControlFrame = require('../spdy').createControlFrame,
    createDataFrame = require('../spdy').createDataFrame,
    createParser = require('../spdy').createParser,
    streamID = 0;

/**
 * Class constructor
 */
var PushStream = exports.PushStream = function(associated_cframe, c, url) {
  stream.Stream.call(this);
  this.streamID = streamID += 2; // TODO auto-increment per-stream per: http://www.chromium.org/spdy/spdy-protocol/spdy-protocol-draft2#TOC-Stream-creation

  this.associatedStreamId = associated_cframe.data.streamID;
  this.c = c;

  this._headers = {
    status: 200,
    version: "http/1.1",
    url: url
  };
};
util.inherits(PushStream, stream.Stream);

exports.createPushStream = function(cframe, c, url) {
  return new PushStream(cframe, c, url);
};

/**
 * Initiate SYN_STREAM
 */
PushStream.prototype.writeHead = function(code, reasonPhrase, headers) {
  // TODO: I *think* this should only be built inside this class
  throw new Error("PushStream#writeHead invoked externally");
};

/**
 * Flush buffered head
 */
PushStream.prototype._flushHead = function() {
  var headers = this._headers;

  var cframe = createControlFrame(this.c.zlib, {
    type: enums.SYN_STREAM,
    flags: enums.CONTROL_FLAG_UNIDIRECTIONAL,
    streamID: this.streamID,
    assocStreamID: this.associatedStreamId
  }, headers);

  return this.c.write(cframe);
};


/**
 * Write data
 */
PushStream.prototype.write = function(data, encoding) {
  return this._write(data, encoding, false);
};

/**
 * Write any data (Internal)
 */
PushStream.prototype._write = function(data, encoding, fin) {
  if (!this._written) {
    this._flushHead();
  }
  this._written = true;

  encoding = encoding || 'utf8';

  if (data === undefined) {
    data = new Buffer(0);
  }

  var dframe = createDataFrame(this.c.zlib, {
    streamID: this.streamID,
    flags: fin ? enums.DATA_FLAG_FIN : 0,
  }, Buffer.isBuffer(data) ? data : new Buffer(data, encoding));

  return this.c.write(dframe);
};

/**
 * End stream
 */
PushStream.prototype.end = function(data, encoding) {
  this.writable = false;
  return this._write(data, encoding, true);
};

/**
 * Mirroring node.js default API
 */
PushStream.prototype.setHeader = function(name, value) {
  throw new Error("Not implemented for push stream");
};

/**
 * Mirroring node.js default API
 */
PushStream.prototype.getHeader = function(name) {
  throw new Error("Not implemented for push stream");
};

/**
 * Cloning node.js default API
 */
PushStream.prototype.removeHeader = function(name) {
  throw new Error("Not implemented for push stream");
};

/**
 * Response class
 */

var Buffer = require('buffer').Buffer,
    util = require('util'),
    stream = require('stream'),
    fs = require('fs'),
    enums = require('../spdy').enums,
    createControlFrame = require('../spdy').createControlFrame,
    createDataFrame = require('../spdy').createDataFrame,
    createPushStream = require('../spdy').createPushStream,
    createParser = require('../spdy').createParser,
    createZLib = require('../spdy').createZLib;

/**
 * Class constructor
 */
var Response = exports.Response = function(cframe, c) {
  stream.Stream.call(this);
  this.cframe = cframe;
  this.streamID = cframe.data.streamID;
  this.c = c;

  this.statusCode = 200;
  this._headers = {
    'Connection': 'keep-alive'
  };
  this._written = false;
  this._reasonPhrase = 'OK';
  this._push = function() {};

  // For stream.pipe and others
  this.writable = true;
};
util.inherits(Response, stream.Stream);

exports.createResponse = function(cframe, c) {
  return new Response(cframe, c);
};

/**
 * Respond w/ SYN_REPLY
 */
Response.prototype.writeHead = function(code, reasonPhrase, headers) {
  if (headers === undefined) {
    headers = reasonPhrase;
    reasonPhrase = '';
  }

  headers = headers || {};
  for (var i in headers) {
    this._headers[i] = headers[i];
  }
  this._reasonPhrase || (this.reasonPhrase = reasonPhrase);
  this.statusCode = code;
};

/**
 * Flush buffered head
 */
Response.prototype._flushHead = function() {
  if (this._written) {
    throw Error('Headers was already written');
  }
  this._written = true;

  var headers = this._headers;

  headers.status = this.statusCode + ' ' + this._reasonPhrase;
  headers.version = 'HTTP/1.1';

  var cframe = createControlFrame(this.c.zlib, {
    type: enums.SYN_REPLY,
    streamID: this.streamID
  }, headers);

  return this.c.write(cframe);
};

/**
 * Write any data (Internal)
 */
Response.prototype._write = function(data, encoding, fin) {
  if (!this._written) {
    this._flushHead();
    this._push_stream();
  }
  encoding = encoding || 'utf8';

  if (data === undefined) {
    data = new Buffer(0);
  }

  var dframe = createDataFrame(this.getStreamCompressor(), {
    streamID: this.streamID,
    flags: fin ? enums.DATA_FLAG_FIN : enums.DATA_FLAG_COMPRESSED,
  }, Buffer.isBuffer(data) ? data : new Buffer(data, encoding));

  return this.c.write(dframe);
};


Response.prototype.getStreamCompressor = function(streamID) {
  if (this.stream_compressor)
    return this.stream_compressor;

  this.stream_compressor = createZLib({use_dictionary: false});

  return this.stream_compressor;
};

/**
 * Write data
 */
Response.prototype.write = function(data, encoding) {
  return this._write(data, encoding, false);
};

/**
 * End stream
 */
Response.prototype.end = function(data, encoding) {
  this.writable = false;
  return this._write(data, encoding, true);
};

/**
 * Cloning node.js default API
 */
Response.prototype.setHeader = function(name, value) {
  if (arguments.length < 2) {
    throw new Error("`name` and `value` are required for setHeader().");
  }

  if (this._written) {
    throw new Error("Can't set headers after they are sent.");
  }

  this._headers[name] = Array.isArray(value) ? value.join(';') : value;
};

/**
 * Cloning node.js default API
 */
Response.prototype.getHeader = function(name) {
  if (arguments.length < 1) {
    throw new Error("`name` is required for getHeader().");
  }

  if (this._written) {
    throw new Error("Can't use mutable header APIs after sent.");
  }

  return this._headers[name];
};

/**
 * Cloning node.js default API
 */
Response.prototype.removeHeader = function(name) {
  if (arguments.length < 1) {
    throw new Error("`name` is required for getHeader().");
  }

  if (this._written) {
    throw new Error("Can't remove headers after they are sent.");
  }

  delete this._headers[name];
};

/**
 * Server push
 */

Response.prototype.setPush = function(fn) {
  if (typeof(fn) === "function")
    this._push = fn;
};

Response.prototype._push_stream = function() {
  this._push(this);
};

Response.prototype.push_file = function(filename, url) {
  this.push(fs.readFileSync(filename), url);
};

Response.prototype.push = function(data, url) {
  var push_stream = createPushStream(this.cframe, this.c, url);

  push_stream.write(data);

  push_stream.end();
};

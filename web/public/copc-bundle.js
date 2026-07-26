"use strict";
(() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
    get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
  }) : x)(function(x) {
    if (typeof require !== "undefined") return require.apply(this, arguments);
    throw Error('Dynamic require of "' + x + '" is not supported');
  });
  var __commonJS = (cb, mod) => function __require2() {
    try {
      return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
    } catch (e) {
      throw mod = 0, e;
    }
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
    mod
  ));

  // node_modules/copc/lib/ept/ept.js
  var require_ept = __commonJS({
    "node_modules/copc/lib/ept/ept.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
    }
  });

  // node_modules/copc/lib/ept/hierarchy.js
  var require_hierarchy = __commonJS({
    "node_modules/copc/lib/ept/hierarchy.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.Hierarchy = void 0;
      exports.Hierarchy = { parse };
      function parse(e) {
        return Object.entries(e).reduce((h, [keystring, pointCount]) => {
          if (pointCount === -1)
            h.pages[keystring] = {};
          else if (pointCount)
            h.nodes[keystring] = { pointCount };
          return h;
        }, { nodes: {}, pages: {} });
      }
    }
  });

  // node_modules/copc/lib/ept/index.js
  var require_ept2 = __commonJS({
    "node_modules/copc/lib/ept/index.js"(exports) {
      "use strict";
      var __createBinding = exports && exports.__createBinding || (Object.create ? (function(o, m, k, k2) {
        if (k2 === void 0) k2 = k;
        var desc = Object.getOwnPropertyDescriptor(m, k);
        if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
          desc = { enumerable: true, get: function() {
            return m[k];
          } };
        }
        Object.defineProperty(o, k2, desc);
      }) : (function(o, m, k, k2) {
        if (k2 === void 0) k2 = k;
        o[k2] = m[k];
      }));
      var __exportStar = exports && exports.__exportStar || function(m, exports2) {
        for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports2, p)) __createBinding(exports2, m, p);
      };
      Object.defineProperty(exports, "__esModule", { value: true });
      __exportStar(require_ept(), exports);
      __exportStar(require_hierarchy(), exports);
    }
  });

  // node_modules/copc/lib/copc/constants.js
  var require_constants = __commonJS({
    "node_modules/copc/lib/copc/constants.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.hierarchyItemLength = exports.infoLength = void 0;
      exports.infoLength = 160;
      exports.hierarchyItemLength = 32;
    }
  });

  // node_modules/copc/lib/las/constants.js
  var require_constants2 = __commonJS({
    "node_modules/copc/lib/las/constants.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.evlrHeaderLength = exports.vlrHeaderLength = exports.minHeaderLength = void 0;
      exports.minHeaderLength = 375;
      exports.vlrHeaderLength = 54;
      exports.evlrHeaderLength = 60;
    }
  });

  // node_modules/copc/lib/utils/big-int.js
  var require_big_int = __commonJS({
    "node_modules/copc/lib/utils/big-int.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.getBigUint64 = exports.parseBigInt = void 0;
      function parseBigInt(v) {
        if (v > BigInt(Number.MAX_SAFE_INTEGER) || v < BigInt(-Number.MAX_SAFE_INTEGER)) {
          throw new Error(`Cannot convert bigint to number: ${v}`);
        }
        return Number(v);
      }
      exports.parseBigInt = parseBigInt;
      function getBigUint64(dv, byteOffset, littleEndian) {
        if (dv.getBigUint64)
          return dv.getBigUint64(byteOffset, littleEndian);
        const [h, l] = littleEndian ? [4, 0] : [0, 4];
        const wh = BigInt(dv.getUint32(byteOffset + h, littleEndian));
        const wl = BigInt(dv.getUint32(byteOffset + l, littleEndian));
        return (wh << BigInt(32)) + wl;
      }
      exports.getBigUint64 = getBigUint64;
    }
  });

  // node_modules/copc/lib/utils/binary.js
  var require_binary = __commonJS({
    "node_modules/copc/lib/utils/binary.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.toCString = exports.toDataView = exports.Binary = void 0;
      exports.Binary = { toDataView, toCString };
      function toDataView(buffer) {
        return new DataView(buffer.buffer, buffer.byteOffset, buffer.length);
      }
      exports.toDataView = toDataView;
      function toCString(buffer) {
        const dv = toDataView(buffer);
        let s = "";
        for (let i = 0; i < dv.byteLength; ++i) {
          const c = dv.getInt8(i);
          if (c === 0)
            return s;
          s += String.fromCharCode(c);
        }
        return s;
      }
      exports.toCString = toCString;
    }
  });

  // node_modules/copc/lib/utils/bounds.js
  var require_bounds = __commonJS({
    "node_modules/copc/lib/utils/bounds.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.Bounds = void 0;
      exports.Bounds = {
        min,
        max,
        mid,
        width,
        depth,
        height,
        cube,
        step,
        stepTo,
        intersection
      };
      function min(b) {
        return [b[0], b[1], b[2]];
      }
      function max(b) {
        return [b[3], b[4], b[5]];
      }
      function mid([minx, miny, minz, maxx, maxy, maxz]) {
        return [
          minx + (maxx - minx) / 2,
          miny + (maxy - miny) / 2,
          minz + (maxz - minz) / 2
        ];
      }
      function width(bounds) {
        return bounds[3] - bounds[0];
      }
      function depth(bounds) {
        return bounds[4] - bounds[1];
      }
      function height(bounds) {
        return bounds[5] - bounds[2];
      }
      function cube(bounds) {
        const point = mid(bounds);
        const radius = Math.max(width(bounds), depth(bounds), height(bounds)) / 2;
        return [
          point[0] - radius,
          point[1] - radius,
          point[2] - radius,
          point[0] + radius,
          point[1] + radius,
          point[2] + radius
        ];
      }
      function step(bounds, [a, b, c]) {
        const [minx, miny, minz, maxx, maxy, maxz] = bounds;
        const [midx, midy, midz] = mid(bounds);
        return [
          a ? midx : minx,
          b ? midy : miny,
          c ? midz : minz,
          a ? maxx : midx,
          b ? maxy : midy,
          c ? maxz : midz
        ];
      }
      function stepTo(bounds, [d, x, y, z]) {
        for (let i = d - 1; i >= 0; --i) {
          bounds = step(bounds, [x >> i & 1, y >> i & 1, z >> i & 1]);
        }
        return bounds;
      }
      function intersection(a, b) {
        return [
          Math.max(a[0], b[0]),
          Math.max(a[1], b[1]),
          Math.max(a[2], b[2]),
          Math.min(a[3], b[3]),
          Math.min(a[4], b[4]),
          Math.min(a[5], b[5])
        ];
      }
    }
  });

  // node_modules/copc/lib/utils/dimension.js
  var require_dimension = __commonJS({
    "node_modules/copc/lib/utils/dimension.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.Dimension = void 0;
      var Type = {
        int8: { type: "signed", size: 1 },
        int16: { type: "signed", size: 2 },
        int32: { type: "signed", size: 4 },
        int64: { type: "signed", size: 8 },
        uint8: { type: "unsigned", size: 1 },
        uint16: { type: "unsigned", size: 2 },
        uint32: { type: "unsigned", size: 4 },
        uint64: { type: "unsigned", size: 8 },
        float32: { type: "float", size: 4 },
        float64: { type: "float", size: 8 },
        // Aliases.
        float: { type: "float", size: 4 },
        double: { type: "float", size: 8 },
        // Minimum size of one byte, so this is a convenience for a byte.
        bool: { type: "unsigned", size: 1 },
        boolean: { type: "unsigned", size: 1 }
      };
      exports.Dimension = { Type, ctype };
      function ctype({ type, size }) {
        switch (type) {
          case "signed": {
            switch (size) {
              case 1:
                return "int8";
              case 2:
                return "int16";
              case 4:
                return "int32";
              case 8:
                return "int64";
            }
          }
          case "unsigned": {
            switch (size) {
              case 1:
                return "uint8";
              case 2:
                return "uint16";
              case 4:
                return "uint32";
              case 8:
                return "uint64";
            }
          }
          case "float": {
            switch (size) {
              case 4:
                return "float";
              case 8:
                return "double";
            }
          }
        }
        throw new Error(`Invalid dimension type/size: ${type}/${size}`);
      }
    }
  });

  // node_modules/cross-fetch/dist/browser-ponyfill.js
  var require_browser_ponyfill = __commonJS({
    "node_modules/cross-fetch/dist/browser-ponyfill.js"(exports, module) {
      var __global__ = typeof globalThis !== "undefined" && globalThis || typeof self !== "undefined" && self || typeof global !== "undefined" && global;
      var __globalThis__ = (function() {
        function F() {
          this.fetch = false;
          this.DOMException = __global__.DOMException;
        }
        F.prototype = __global__;
        return new F();
      })();
      (function(globalThis2) {
        var irrelevant = (function(exports2) {
          var g = typeof globalThis2 !== "undefined" && globalThis2 || typeof self !== "undefined" && self || // eslint-disable-next-line no-undef
          typeof global !== "undefined" && global || {};
          var support = {
            searchParams: "URLSearchParams" in g,
            iterable: "Symbol" in g && "iterator" in Symbol,
            blob: "FileReader" in g && "Blob" in g && (function() {
              try {
                new Blob();
                return true;
              } catch (e) {
                return false;
              }
            })(),
            formData: "FormData" in g,
            arrayBuffer: "ArrayBuffer" in g
          };
          function isDataView(obj) {
            return obj && DataView.prototype.isPrototypeOf(obj);
          }
          if (support.arrayBuffer) {
            var viewClasses = [
              "[object Int8Array]",
              "[object Uint8Array]",
              "[object Uint8ClampedArray]",
              "[object Int16Array]",
              "[object Uint16Array]",
              "[object Int32Array]",
              "[object Uint32Array]",
              "[object Float32Array]",
              "[object Float64Array]"
            ];
            var isArrayBufferView = ArrayBuffer.isView || function(obj) {
              return obj && viewClasses.indexOf(Object.prototype.toString.call(obj)) > -1;
            };
          }
          function normalizeName(name) {
            if (typeof name !== "string") {
              name = String(name);
            }
            if (/[^a-z0-9\-#$%&'*+.^_`|~!]/i.test(name) || name === "") {
              throw new TypeError('Invalid character in header field name: "' + name + '"');
            }
            return name.toLowerCase();
          }
          function normalizeValue(value) {
            if (typeof value !== "string") {
              value = String(value);
            }
            return value;
          }
          function iteratorFor(items) {
            var iterator = {
              next: function() {
                var value = items.shift();
                return { done: value === void 0, value };
              }
            };
            if (support.iterable) {
              iterator[Symbol.iterator] = function() {
                return iterator;
              };
            }
            return iterator;
          }
          function Headers(headers) {
            this.map = {};
            if (headers instanceof Headers) {
              headers.forEach(function(value, name) {
                this.append(name, value);
              }, this);
            } else if (Array.isArray(headers)) {
              headers.forEach(function(header) {
                if (header.length != 2) {
                  throw new TypeError("Headers constructor: expected name/value pair to be length 2, found" + header.length);
                }
                this.append(header[0], header[1]);
              }, this);
            } else if (headers) {
              Object.getOwnPropertyNames(headers).forEach(function(name) {
                this.append(name, headers[name]);
              }, this);
            }
          }
          Headers.prototype.append = function(name, value) {
            name = normalizeName(name);
            value = normalizeValue(value);
            var oldValue = this.map[name];
            this.map[name] = oldValue ? oldValue + ", " + value : value;
          };
          Headers.prototype["delete"] = function(name) {
            delete this.map[normalizeName(name)];
          };
          Headers.prototype.get = function(name) {
            name = normalizeName(name);
            return this.has(name) ? this.map[name] : null;
          };
          Headers.prototype.has = function(name) {
            return this.map.hasOwnProperty(normalizeName(name));
          };
          Headers.prototype.set = function(name, value) {
            this.map[normalizeName(name)] = normalizeValue(value);
          };
          Headers.prototype.forEach = function(callback, thisArg) {
            for (var name in this.map) {
              if (this.map.hasOwnProperty(name)) {
                callback.call(thisArg, this.map[name], name, this);
              }
            }
          };
          Headers.prototype.keys = function() {
            var items = [];
            this.forEach(function(value, name) {
              items.push(name);
            });
            return iteratorFor(items);
          };
          Headers.prototype.values = function() {
            var items = [];
            this.forEach(function(value) {
              items.push(value);
            });
            return iteratorFor(items);
          };
          Headers.prototype.entries = function() {
            var items = [];
            this.forEach(function(value, name) {
              items.push([name, value]);
            });
            return iteratorFor(items);
          };
          if (support.iterable) {
            Headers.prototype[Symbol.iterator] = Headers.prototype.entries;
          }
          function consumed(body) {
            if (body._noBody) return;
            if (body.bodyUsed) {
              return Promise.reject(new TypeError("Already read"));
            }
            body.bodyUsed = true;
          }
          function fileReaderReady(reader) {
            return new Promise(function(resolve, reject) {
              reader.onload = function() {
                resolve(reader.result);
              };
              reader.onerror = function() {
                reject(reader.error);
              };
            });
          }
          function readBlobAsArrayBuffer(blob) {
            var reader = new FileReader();
            var promise = fileReaderReady(reader);
            reader.readAsArrayBuffer(blob);
            return promise;
          }
          function readBlobAsText(blob) {
            var reader = new FileReader();
            var promise = fileReaderReady(reader);
            var match = /charset=([A-Za-z0-9_-]+)/.exec(blob.type);
            var encoding = match ? match[1] : "utf-8";
            reader.readAsText(blob, encoding);
            return promise;
          }
          function readArrayBufferAsText(buf) {
            var view = new Uint8Array(buf);
            var chars = new Array(view.length);
            for (var i = 0; i < view.length; i++) {
              chars[i] = String.fromCharCode(view[i]);
            }
            return chars.join("");
          }
          function bufferClone(buf) {
            if (buf.slice) {
              return buf.slice(0);
            } else {
              var view = new Uint8Array(buf.byteLength);
              view.set(new Uint8Array(buf));
              return view.buffer;
            }
          }
          function Body() {
            this.bodyUsed = false;
            this._initBody = function(body) {
              this.bodyUsed = this.bodyUsed;
              this._bodyInit = body;
              if (!body) {
                this._noBody = true;
                this._bodyText = "";
              } else if (typeof body === "string") {
                this._bodyText = body;
              } else if (support.blob && Blob.prototype.isPrototypeOf(body)) {
                this._bodyBlob = body;
              } else if (support.formData && FormData.prototype.isPrototypeOf(body)) {
                this._bodyFormData = body;
              } else if (support.searchParams && URLSearchParams.prototype.isPrototypeOf(body)) {
                this._bodyText = body.toString();
              } else if (support.arrayBuffer && support.blob && isDataView(body)) {
                this._bodyArrayBuffer = bufferClone(body.buffer);
                this._bodyInit = new Blob([this._bodyArrayBuffer]);
              } else if (support.arrayBuffer && (ArrayBuffer.prototype.isPrototypeOf(body) || isArrayBufferView(body))) {
                this._bodyArrayBuffer = bufferClone(body);
              } else {
                this._bodyText = body = Object.prototype.toString.call(body);
              }
              if (!this.headers.get("content-type")) {
                if (typeof body === "string") {
                  this.headers.set("content-type", "text/plain;charset=UTF-8");
                } else if (this._bodyBlob && this._bodyBlob.type) {
                  this.headers.set("content-type", this._bodyBlob.type);
                } else if (support.searchParams && URLSearchParams.prototype.isPrototypeOf(body)) {
                  this.headers.set("content-type", "application/x-www-form-urlencoded;charset=UTF-8");
                }
              }
            };
            if (support.blob) {
              this.blob = function() {
                var rejected = consumed(this);
                if (rejected) {
                  return rejected;
                }
                if (this._bodyBlob) {
                  return Promise.resolve(this._bodyBlob);
                } else if (this._bodyArrayBuffer) {
                  return Promise.resolve(new Blob([this._bodyArrayBuffer]));
                } else if (this._bodyFormData) {
                  throw new Error("could not read FormData body as blob");
                } else {
                  return Promise.resolve(new Blob([this._bodyText]));
                }
              };
            }
            this.arrayBuffer = function() {
              if (this._bodyArrayBuffer) {
                var isConsumed = consumed(this);
                if (isConsumed) {
                  return isConsumed;
                } else if (ArrayBuffer.isView(this._bodyArrayBuffer)) {
                  return Promise.resolve(
                    this._bodyArrayBuffer.buffer.slice(
                      this._bodyArrayBuffer.byteOffset,
                      this._bodyArrayBuffer.byteOffset + this._bodyArrayBuffer.byteLength
                    )
                  );
                } else {
                  return Promise.resolve(this._bodyArrayBuffer);
                }
              } else if (support.blob) {
                return this.blob().then(readBlobAsArrayBuffer);
              } else {
                throw new Error("could not read as ArrayBuffer");
              }
            };
            this.text = function() {
              var rejected = consumed(this);
              if (rejected) {
                return rejected;
              }
              if (this._bodyBlob) {
                return readBlobAsText(this._bodyBlob);
              } else if (this._bodyArrayBuffer) {
                return Promise.resolve(readArrayBufferAsText(this._bodyArrayBuffer));
              } else if (this._bodyFormData) {
                throw new Error("could not read FormData body as text");
              } else {
                return Promise.resolve(this._bodyText);
              }
            };
            if (support.formData) {
              this.formData = function() {
                return this.text().then(decode);
              };
            }
            this.json = function() {
              return this.text().then(JSON.parse);
            };
            return this;
          }
          var methods = ["CONNECT", "DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT", "TRACE"];
          function normalizeMethod(method) {
            var upcased = method.toUpperCase();
            return methods.indexOf(upcased) > -1 ? upcased : method;
          }
          function Request(input, options) {
            if (!(this instanceof Request)) {
              throw new TypeError('Please use the "new" operator, this DOM object constructor cannot be called as a function.');
            }
            options = options || {};
            var body = options.body;
            if (input instanceof Request) {
              if (input.bodyUsed) {
                throw new TypeError("Already read");
              }
              this.url = input.url;
              this.credentials = input.credentials;
              if (!options.headers) {
                this.headers = new Headers(input.headers);
              }
              this.method = input.method;
              this.mode = input.mode;
              this.signal = input.signal;
              if (!body && input._bodyInit != null) {
                body = input._bodyInit;
                input.bodyUsed = true;
              }
            } else {
              this.url = String(input);
            }
            this.credentials = options.credentials || this.credentials || "same-origin";
            if (options.headers || !this.headers) {
              this.headers = new Headers(options.headers);
            }
            this.method = normalizeMethod(options.method || this.method || "GET");
            this.mode = options.mode || this.mode || null;
            this.signal = options.signal || this.signal || (function() {
              if ("AbortController" in g) {
                var ctrl = new AbortController();
                return ctrl.signal;
              }
            })();
            this.referrer = null;
            if ((this.method === "GET" || this.method === "HEAD") && body) {
              throw new TypeError("Body not allowed for GET or HEAD requests");
            }
            this._initBody(body);
            if (this.method === "GET" || this.method === "HEAD") {
              if (options.cache === "no-store" || options.cache === "no-cache") {
                var reParamSearch = /([?&])_=[^&]*/;
                if (reParamSearch.test(this.url)) {
                  this.url = this.url.replace(reParamSearch, "$1_=" + (/* @__PURE__ */ new Date()).getTime());
                } else {
                  var reQueryString = /\?/;
                  this.url += (reQueryString.test(this.url) ? "&" : "?") + "_=" + (/* @__PURE__ */ new Date()).getTime();
                }
              }
            }
          }
          Request.prototype.clone = function() {
            return new Request(this, { body: this._bodyInit });
          };
          function decode(body) {
            var form = new FormData();
            body.trim().split("&").forEach(function(bytes) {
              if (bytes) {
                var split = bytes.split("=");
                var name = split.shift().replace(/\+/g, " ");
                var value = split.join("=").replace(/\+/g, " ");
                form.append(decodeURIComponent(name), decodeURIComponent(value));
              }
            });
            return form;
          }
          function parseHeaders(rawHeaders) {
            var headers = new Headers();
            var preProcessedHeaders = rawHeaders.replace(/\r?\n[\t ]+/g, " ");
            preProcessedHeaders.split("\r").map(function(header) {
              return header.indexOf("\n") === 0 ? header.substr(1, header.length) : header;
            }).forEach(function(line) {
              var parts = line.split(":");
              var key = parts.shift().trim();
              if (key) {
                var value = parts.join(":").trim();
                try {
                  headers.append(key, value);
                } catch (error) {
                  console.warn("Response " + error.message);
                }
              }
            });
            return headers;
          }
          Body.call(Request.prototype);
          function Response(bodyInit, options) {
            if (!(this instanceof Response)) {
              throw new TypeError('Please use the "new" operator, this DOM object constructor cannot be called as a function.');
            }
            if (!options) {
              options = {};
            }
            this.type = "default";
            this.status = options.status === void 0 ? 200 : options.status;
            if (this.status < 200 || this.status > 599) {
              throw new RangeError("Failed to construct 'Response': The status provided (0) is outside the range [200, 599].");
            }
            this.ok = this.status >= 200 && this.status < 300;
            this.statusText = options.statusText === void 0 ? "" : "" + options.statusText;
            this.headers = new Headers(options.headers);
            this.url = options.url || "";
            this._initBody(bodyInit);
          }
          Body.call(Response.prototype);
          Response.prototype.clone = function() {
            return new Response(this._bodyInit, {
              status: this.status,
              statusText: this.statusText,
              headers: new Headers(this.headers),
              url: this.url
            });
          };
          Response.error = function() {
            var response = new Response(null, { status: 200, statusText: "" });
            response.ok = false;
            response.status = 0;
            response.type = "error";
            return response;
          };
          var redirectStatuses = [301, 302, 303, 307, 308];
          Response.redirect = function(url, status) {
            if (redirectStatuses.indexOf(status) === -1) {
              throw new RangeError("Invalid status code");
            }
            return new Response(null, { status, headers: { location: url } });
          };
          exports2.DOMException = g.DOMException;
          try {
            new exports2.DOMException();
          } catch (err) {
            exports2.DOMException = function(message, name) {
              this.message = message;
              this.name = name;
              var error = Error(message);
              this.stack = error.stack;
            };
            exports2.DOMException.prototype = Object.create(Error.prototype);
            exports2.DOMException.prototype.constructor = exports2.DOMException;
          }
          function fetch2(input, init) {
            return new Promise(function(resolve, reject) {
              var request = new Request(input, init);
              if (request.signal && request.signal.aborted) {
                return reject(new exports2.DOMException("Aborted", "AbortError"));
              }
              var xhr = new XMLHttpRequest();
              function abortXhr() {
                xhr.abort();
              }
              xhr.onload = function() {
                var options = {
                  statusText: xhr.statusText,
                  headers: parseHeaders(xhr.getAllResponseHeaders() || "")
                };
                if (request.url.indexOf("file://") === 0 && (xhr.status < 200 || xhr.status > 599)) {
                  options.status = 200;
                } else {
                  options.status = xhr.status;
                }
                options.url = "responseURL" in xhr ? xhr.responseURL : options.headers.get("X-Request-URL");
                var body = "response" in xhr ? xhr.response : xhr.responseText;
                setTimeout(function() {
                  resolve(new Response(body, options));
                }, 0);
              };
              xhr.onerror = function() {
                setTimeout(function() {
                  reject(new TypeError("Network request failed"));
                }, 0);
              };
              xhr.ontimeout = function() {
                setTimeout(function() {
                  reject(new TypeError("Network request timed out"));
                }, 0);
              };
              xhr.onabort = function() {
                setTimeout(function() {
                  reject(new exports2.DOMException("Aborted", "AbortError"));
                }, 0);
              };
              function fixUrl(url) {
                try {
                  return url === "" && g.location.href ? g.location.href : url;
                } catch (e) {
                  return url;
                }
              }
              xhr.open(request.method, fixUrl(request.url), true);
              if (request.credentials === "include") {
                xhr.withCredentials = true;
              } else if (request.credentials === "omit") {
                xhr.withCredentials = false;
              }
              if ("responseType" in xhr) {
                if (support.blob) {
                  xhr.responseType = "blob";
                } else if (support.arrayBuffer) {
                  xhr.responseType = "arraybuffer";
                }
              }
              if (init && typeof init.headers === "object" && !(init.headers instanceof Headers || g.Headers && init.headers instanceof g.Headers)) {
                var names = [];
                Object.getOwnPropertyNames(init.headers).forEach(function(name) {
                  names.push(normalizeName(name));
                  xhr.setRequestHeader(name, normalizeValue(init.headers[name]));
                });
                request.headers.forEach(function(value, name) {
                  if (names.indexOf(name) === -1) {
                    xhr.setRequestHeader(name, value);
                  }
                });
              } else {
                request.headers.forEach(function(value, name) {
                  xhr.setRequestHeader(name, value);
                });
              }
              if (request.signal) {
                request.signal.addEventListener("abort", abortXhr);
                xhr.onreadystatechange = function() {
                  if (xhr.readyState === 4) {
                    request.signal.removeEventListener("abort", abortXhr);
                  }
                };
              }
              xhr.send(typeof request._bodyInit === "undefined" ? null : request._bodyInit);
            });
          }
          fetch2.polyfill = true;
          if (!g.fetch) {
            g.fetch = fetch2;
            g.Headers = Headers;
            g.Request = Request;
            g.Response = Response;
          }
          exports2.Headers = Headers;
          exports2.Request = Request;
          exports2.Response = Response;
          exports2.fetch = fetch2;
          Object.defineProperty(exports2, "__esModule", { value: true });
          return exports2;
        })({});
      })(__globalThis__);
      __globalThis__.fetch.ponyfill = true;
      delete __globalThis__.fetch.polyfill;
      var ctx = __global__.fetch ? __global__ : __globalThis__;
      exports = ctx.fetch;
      exports.default = ctx.fetch;
      exports.fetch = ctx.fetch;
      exports.Headers = ctx.Headers;
      exports.Request = ctx.Request;
      exports.Response = ctx.Response;
      module.exports = exports;
    }
  });

  // (disabled):fs
  var require_fs = __commonJS({
    "(disabled):fs"() {
    }
  });

  // node_modules/copc/lib/utils/getter.js
  var require_getter = __commonJS({
    "node_modules/copc/lib/utils/getter.js"(exports) {
      "use strict";
      var __createBinding = exports && exports.__createBinding || (Object.create ? (function(o, m, k, k2) {
        if (k2 === void 0) k2 = k;
        var desc = Object.getOwnPropertyDescriptor(m, k);
        if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
          desc = { enumerable: true, get: function() {
            return m[k];
          } };
        }
        Object.defineProperty(o, k2, desc);
      }) : (function(o, m, k, k2) {
        if (k2 === void 0) k2 = k;
        o[k2] = m[k];
      }));
      var __setModuleDefault = exports && exports.__setModuleDefault || (Object.create ? (function(o, v) {
        Object.defineProperty(o, "default", { enumerable: true, value: v });
      }) : function(o, v) {
        o["default"] = v;
      });
      var __importStar = exports && exports.__importStar || function(mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) {
          for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
        }
        __setModuleDefault(result, mod);
        return result;
      };
      var __importDefault = exports && exports.__importDefault || function(mod) {
        return mod && mod.__esModule ? mod : { "default": mod };
      };
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.Getter = void 0;
      var cross_fetch_1 = __importDefault(require_browser_ponyfill());
      exports.Getter = { create, http: getHttpGetter, file: getFsGetter };
      function create(arg) {
        if (typeof arg === "function")
          return arg;
        if (arg.startsWith("http://") || arg.startsWith("https://")) {
          return getHttpGetter(arg);
        }
        return getFsGetter(arg);
      }
      function getHttpGetter(filename) {
        return async function getter(begin, end) {
          if (begin < 0 || end < 0 || begin > end)
            throw new Error("Invalid range");
          const response = await (0, cross_fetch_1.default)(filename, {
            headers: { Range: `bytes=${begin}-${end - 1}` }
          });
          const ab = await response.arrayBuffer();
          return new Uint8Array(ab);
        };
      }
      function getFsGetter(filename) {
        return async function getter(begin, end) {
          const fs = await Promise.resolve().then(() => __importStar(require_fs()));
          async function read2(begin2 = 0, end2 = Infinity) {
            if (begin2 < 0 || end2 < 0 || begin2 > end2)
              throw new Error("Invalid range");
            await fs.promises.access(filename);
            const stream = fs.createReadStream(filename, {
              start: begin2,
              end: end2 - 1,
              autoClose: true
            });
            return drain(stream);
          }
          return read2(begin, end);
        };
      }
      async function drain(stream) {
        return await new Promise((resolve, reject) => {
          const chunks = [];
          stream.on("data", (chunk) => chunks.push(chunk));
          stream.on("error", reject);
          stream.on("end", () => resolve(Buffer.concat(chunks)));
        });
      }
    }
  });

  // node_modules/copc/lib/utils/key.js
  var require_key = __commonJS({
    "node_modules/copc/lib/utils/key.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.Key = void 0;
      exports.Key = { create, parse, toString, step, up, compare, depth };
      function create(key, x = 0, y = 0, z = 0) {
        if (typeof key !== "number")
          return parse(key);
        return [key, x, y, z];
      }
      function parse(s) {
        if (typeof s !== "string")
          return s;
        const [d, x, y, z, ...rest] = s.split("-").map((s2) => parseInt(s2, 10));
        const key = [d, x, y, z];
        if (rest.length !== 0 || key.some((v) => typeof v !== "number" || Number.isNaN(v))) {
          throw new Error(`Invalid key: ${s}`);
        }
        return key;
      }
      function toString(key) {
        if (typeof key === "string")
          return key;
        return key.join("-");
      }
      function step(key, [a, b, c]) {
        const [d, x, y, z] = exports.Key.create(key);
        return [d + 1, x * 2 + a, y * 2 + b, z * 2 + c];
      }
      function up(key, n = 1) {
        const [d, x, y, z] = exports.Key.create(key);
        return [d - n, x >> n, y >> n, z >> n];
      }
      function compare(a, b) {
        for (let i = 0; i < a.length; ++i) {
          if (a[i] < b[i])
            return -1;
          if (a[i] > b[i])
            return 1;
        }
        return 0;
      }
      function depth(key) {
        return key[0];
      }
    }
  });

  // node_modules/copc/lib/utils/scale.js
  var require_scale = __commonJS({
    "node_modules/copc/lib/utils/scale.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.Scale = void 0;
      exports.Scale = {
        apply: (v, scale = 1, offset = 0) => (v - offset) / scale,
        unapply: (v, scale = 1, offset = 0) => v * scale + offset
      };
    }
  });

  // node_modules/copc/lib/utils/step.js
  var require_step = __commonJS({
    "node_modules/copc/lib/utils/step.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.Step = void 0;
      exports.Step = { fromIndex, list };
      function fromIndex(i) {
        if (i < 0 || i >= 8)
          throw new Error(`Invalid step index: ${i}`);
        const x = i >> 0 & 1 ? 1 : 0;
        const y = i >> 1 & 1 ? 1 : 0;
        const z = i >> 2 & 1 ? 1 : 0;
        return [x, y, z];
      }
      function list() {
        return [
          [0, 0, 0],
          [0, 0, 1],
          [0, 1, 0],
          [0, 1, 1],
          [1, 0, 0],
          [1, 0, 1],
          [1, 1, 0],
          [1, 1, 1]
        ];
      }
    }
  });

  // node_modules/copc/lib/utils/index.js
  var require_utils = __commonJS({
    "node_modules/copc/lib/utils/index.js"(exports) {
      "use strict";
      var __createBinding = exports && exports.__createBinding || (Object.create ? (function(o, m, k, k2) {
        if (k2 === void 0) k2 = k;
        var desc = Object.getOwnPropertyDescriptor(m, k);
        if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
          desc = { enumerable: true, get: function() {
            return m[k];
          } };
        }
        Object.defineProperty(o, k2, desc);
      }) : (function(o, m, k, k2) {
        if (k2 === void 0) k2 = k;
        o[k2] = m[k];
      }));
      var __exportStar = exports && exports.__exportStar || function(m, exports2) {
        for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports2, p)) __createBinding(exports2, m, p);
      };
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.Step = exports.Scale = exports.Key = exports.Getter = exports.Dimension = exports.Bounds = exports.Binary = void 0;
      __exportStar(require_big_int(), exports);
      var binary_1 = require_binary();
      Object.defineProperty(exports, "Binary", { enumerable: true, get: function() {
        return binary_1.Binary;
      } });
      var bounds_1 = require_bounds();
      Object.defineProperty(exports, "Bounds", { enumerable: true, get: function() {
        return bounds_1.Bounds;
      } });
      var dimension_1 = require_dimension();
      Object.defineProperty(exports, "Dimension", { enumerable: true, get: function() {
        return dimension_1.Dimension;
      } });
      var getter_1 = require_getter();
      Object.defineProperty(exports, "Getter", { enumerable: true, get: function() {
        return getter_1.Getter;
      } });
      var key_1 = require_key();
      Object.defineProperty(exports, "Key", { enumerable: true, get: function() {
        return key_1.Key;
      } });
      var scale_1 = require_scale();
      Object.defineProperty(exports, "Scale", { enumerable: true, get: function() {
        return scale_1.Scale;
      } });
      var step_1 = require_step();
      Object.defineProperty(exports, "Step", { enumerable: true, get: function() {
        return step_1.Step;
      } });
    }
  });

  // node_modules/copc/lib/las/extra-bytes.js
  var require_extra_bytes = __commonJS({
    "node_modules/copc/lib/las/extra-bytes.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.ExtraBytes = void 0;
      var utils_1 = require_utils();
      exports.ExtraBytes = { getDimension, parse, parseOne };
      var entryLength = 192;
      function getDimension({ type, length: size }) {
        switch (type) {
          case "signed":
          case "unsigned":
            switch (size) {
              case 1:
              case 2:
              case 4:
              case 8:
                return { type, size };
            }
          case "float":
            switch (size) {
              case 4:
              case 8:
                return { type, size };
            }
        }
      }
      function parse(buffer) {
        if (buffer.byteLength % entryLength !== 0) {
          throw new Error(`Invalid extra bytes VLR length: ${buffer.byteLength}`);
        }
        const result = [];
        for (let offset = 0; offset < buffer.byteLength; offset += entryLength) {
          result.push(parseOne(buffer.slice(offset, offset + entryLength)));
        }
        return result;
      }
      function parseOne(buffer) {
        if (buffer.byteLength !== entryLength) {
          throw new Error(`Invalid extra bytes entry length: ${buffer.byteLength}`);
        }
        const dv = utils_1.Binary.toDataView(buffer);
        const name = utils_1.Binary.toCString(buffer.slice(4, 36));
        const description = utils_1.Binary.toCString(buffer.slice(60, 192));
        const rawtype = dv.getUint8(2);
        const rawoptions = dv.getUint8(3);
        if (rawtype >= 11) {
          throw new Error(`Invalid extra bytes "type" value: ${rawtype}`);
        }
        if (rawtype === 0) {
          const length2 = rawoptions;
          return { name, description, length: length2 };
        }
        const options = parseOptions(rawoptions);
        const dimtype = parseType(rawtype);
        if (!dimtype)
          throw new Error(`Failed to extract dimension type: ${rawtype}`);
        const { type, size: length } = dimtype;
        function extractAnyType(offset) {
          switch (type) {
            case "signed":
              return (0, utils_1.parseBigInt)(dv.getBigInt64(offset, true));
            case "unsigned":
              return (0, utils_1.parseBigInt)((0, utils_1.getBigUint64)(dv, offset, true));
            case "float":
              return dv.getFloat64(offset, true);
          }
        }
        const eb = { name, description, type, length };
        if (options.hasNodata)
          eb.nodata = extractAnyType(40);
        if (options.hasMin)
          eb.min = extractAnyType(64);
        if (options.hasMax)
          eb.max = extractAnyType(88);
        if (options.hasScale)
          eb.scale = dv.getFloat64(112);
        if (options.hasOffset)
          eb.offset = dv.getFloat64(136);
        return eb;
      }
      function parseType(typecode) {
        switch (typecode) {
          case 1:
            return utils_1.Dimension.Type.uint8;
          case 2:
            return utils_1.Dimension.Type.int8;
          case 3:
            return utils_1.Dimension.Type.uint16;
          case 4:
            return utils_1.Dimension.Type.int16;
          case 5:
            return utils_1.Dimension.Type.uint32;
          case 6:
            return utils_1.Dimension.Type.int32;
          case 7:
            return utils_1.Dimension.Type.uint64;
          case 8:
            return utils_1.Dimension.Type.int64;
          case 9:
            return utils_1.Dimension.Type.float32;
          case 10:
            return utils_1.Dimension.Type.float64;
        }
      }
      function parseOptions(v) {
        return {
          hasNodata: Boolean(v & 1),
          hasMin: Boolean(v >> 1 & 1),
          hasMax: Boolean(v >> 2 & 1),
          hasScale: Boolean(v >> 3 & 1),
          hasOffset: Boolean(v >> 4 & 1)
        };
      }
    }
  });

  // node_modules/copc/lib/las/dimensions.js
  var require_dimensions = __commonJS({
    "node_modules/copc/lib/las/dimensions.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.Dimensions = void 0;
      var utils_1 = require_utils();
      var extra_bytes_1 = require_extra_bytes();
      exports.Dimensions = { create };
      var { Type } = utils_1.Dimension;
      var typemap = {
        X: Type.float64,
        Y: Type.float64,
        Z: Type.float64,
        Intensity: Type.uint16,
        ReturnNumber: Type.uint8,
        NumberOfReturns: Type.uint8,
        ScanDirectionFlag: Type.boolean,
        EdgeOfFlightLine: Type.boolean,
        Classification: Type.uint8,
        Synthetic: Type.boolean,
        KeyPoint: Type.boolean,
        Withheld: Type.boolean,
        Overlap: Type.boolean,
        ScanAngle: Type.float32,
        UserData: Type.uint8,
        PointSourceId: Type.uint16,
        GpsTime: Type.float64,
        Red: Type.uint16,
        Green: Type.uint16,
        Blue: Type.uint16,
        ScannerChannel: Type.uint8,
        Infrared: Type.uint16
      };
      function create(extractor, eb = []) {
        return Object.keys(extractor).reduce((map, name) => {
          const type = typemap[name];
          if (type)
            return { ...map, [name]: type };
          const e = eb.find((v) => v.name === name);
          const dimension = e && extra_bytes_1.ExtraBytes.getDimension(e);
          if (dimension)
            return { ...map, [name]: dimension };
          throw new Error(`Failed to look up LAS type: ${name}`);
        }, {});
      }
    }
  });

  // node_modules/copc/lib/las/extractor.js
  var require_extractor = __commonJS({
    "node_modules/copc/lib/las/extractor.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.Extractor = void 0;
      var utils_1 = require_utils();
      exports.Extractor = { create };
      function getBasePointLength(pdrf) {
        switch (pdrf) {
          case 0:
            return 20;
          case 1:
            return 28;
          case 2:
            return 26;
          case 3:
            return 34;
          case 6:
            return 30;
          case 7:
            return 36;
          case 8:
            return 38;
          default:
            throw new Error(`Unsupported point data record format: ${pdrf}`);
        }
      }
      function createAbsoluteExtraBytesExtractor(header, offset, { type, length }) {
        const getPointOffset = getPointOffsetGetter(header);
        switch (type) {
          case "signed":
            switch (length) {
              case 1:
                return (dv, index) => dv.getInt8(getPointOffset(index) + offset);
              case 2:
                return (dv, index) => dv.getInt16(getPointOffset(index) + offset, true);
              case 4:
                return (dv, index) => dv.getInt32(getPointOffset(index) + offset, true);
              case 8:
                return (dv, index) => (0, utils_1.parseBigInt)(dv.getBigInt64(getPointOffset(index) + offset, true));
            }
          case "unsigned":
            switch (length) {
              case 1:
                return (dv, index) => dv.getUint8(getPointOffset(index) + offset);
              case 2:
                return (dv, index) => dv.getUint16(getPointOffset(index) + offset, true);
              case 4:
                return (dv, index) => dv.getUint32(getPointOffset(index) + offset, true);
              case 8:
                return (dv, index) => (0, utils_1.parseBigInt)((0, utils_1.getBigUint64)(dv, getPointOffset(index) + offset, true));
            }
          case "float":
            switch (length) {
              case 4:
                return (dv, index) => dv.getFloat32(getPointOffset(index) + offset, true);
              case 8:
                return (dv, index) => dv.getFloat64(getPointOffset(index) + offset, true);
            }
        }
      }
      function createExtras(header, eb) {
        const basePointLength = getBasePointLength(header.pointDataRecordFormat);
        let position = basePointLength;
        return eb.reduce((map, v) => {
          const offset = position;
          position += v.length;
          const absoluteExtractor = createAbsoluteExtraBytesExtractor(header, offset, v);
          if (!absoluteExtractor)
            return map;
          const extractor = (dv, index) => utils_1.Scale.unapply(absoluteExtractor(dv, index), v.scale, v.offset);
          return { ...map, [v.name]: extractor };
        }, {});
      }
      function create(header, eb = []) {
        const extras = createExtras(header, eb);
        const core = (() => {
          const { pointDataRecordFormat: pdrf } = header;
          switch (pdrf) {
            case 0:
              return create0(header);
            case 1:
              return create1(header);
            case 2:
              return create2(header);
            case 3:
              return create3(header);
            case 6:
              return create6(header);
            case 7:
              return create7(header);
            case 8:
              return create8(header);
            default:
              throw new Error(`Unsupported point data record format: ${pdrf}`);
          }
        })();
        return { ...core, ...extras };
      }
      function create0(header) {
        const { scale, offset } = header;
        const getPointOffset = getPointOffsetGetter(header);
        function getScanFlags(dv, index) {
          return dv.getUint8(getPointOffset(index) + 14);
        }
        function getFullClassification(dv, index) {
          return dv.getUint8(getPointOffset(index) + 15);
        }
        function getClassification(dv, index) {
          return getFullClassification(dv, index) & 31;
        }
        return {
          X: (dv, index) => utils_1.Scale.unapply(dv.getInt32(getPointOffset(index), true), scale[0], offset[0]),
          Y: (dv, index) => utils_1.Scale.unapply(dv.getInt32(getPointOffset(index) + 4, true), scale[1], offset[1]),
          Z: (dv, index) => utils_1.Scale.unapply(dv.getInt32(getPointOffset(index) + 8, true), scale[2], offset[2]),
          Intensity: (dv, index) => dv.getUint16(getPointOffset(index) + 12, true),
          ReturnNumber: (dv, index) => getScanFlags(dv, index) & 7,
          NumberOfReturns: (dv, index) => (getScanFlags(dv, index) & 56) >> 3,
          ScanDirectionFlag: (dv, index) => (getScanFlags(dv, index) & 64) >> 6,
          EdgeOfFlightLine: (dv, index) => (getScanFlags(dv, index) & 128) >> 7,
          Classification: (dv, index) => {
            const classification = getClassification(dv, index);
            return classification === 12 ? 0 : classification;
          },
          Synthetic: (dv, index) => (getFullClassification(dv, index) & 32) >> 5,
          KeyPoint: (dv, index) => (getFullClassification(dv, index) & 64) >> 6,
          Withheld: (dv, index) => (getFullClassification(dv, index) & 128) >> 7,
          Overlap: (dv, index) => getClassification(dv, index) === 12 ? 1 : 0,
          ScanAngle: (dv, index) => dv.getInt8(getPointOffset(index) + 16),
          UserData: (dv, index) => dv.getUint8(getPointOffset(index) + 17),
          PointSourceId: (dv, index) => dv.getUint16(getPointOffset(index) + 18, true)
        };
      }
      function create1(header) {
        const getPointOffset = getPointOffsetGetter(header);
        return {
          ...create0(header),
          GpsTime: (dv, index) => dv.getFloat64(getPointOffset(index) + 20, true)
        };
      }
      function create2(header) {
        const getPointOffset = getPointOffsetGetter(header);
        return {
          ...create0(header),
          Red: (dv, index) => dv.getUint16(getPointOffset(index) + 20, true),
          Green: (dv, index) => dv.getUint16(getPointOffset(index) + 22, true),
          Blue: (dv, index) => dv.getUint16(getPointOffset(index) + 24, true)
        };
      }
      function create3(header) {
        const getPointOffset = getPointOffsetGetter(header);
        return {
          ...create0(header),
          GpsTime: (dv, index) => dv.getFloat64(getPointOffset(index) + 20, true),
          Red: (dv, index) => dv.getUint16(getPointOffset(index) + 28, true),
          Green: (dv, index) => dv.getUint16(getPointOffset(index) + 30, true),
          Blue: (dv, index) => dv.getUint16(getPointOffset(index) + 32, true)
        };
      }
      function create6(header) {
        const { scale, offset } = header;
        const getPointOffset = getPointOffsetGetter(header);
        function getFlags(dv, index) {
          return dv.getUint8(getPointOffset(index) + 15);
        }
        return {
          X: (dv, index) => utils_1.Scale.unapply(dv.getInt32(getPointOffset(index), true), scale[0], offset[0]),
          Y: (dv, index) => utils_1.Scale.unapply(dv.getInt32(getPointOffset(index) + 4, true), scale[1], offset[1]),
          Z: (dv, index) => utils_1.Scale.unapply(dv.getInt32(getPointOffset(index) + 8, true), scale[2], offset[2]),
          Intensity: (dv, index) => dv.getUint16(getPointOffset(index) + 12, true),
          ReturnNumber: (dv, index) => dv.getUint16(getPointOffset(index) + 14, true) & 15,
          NumberOfReturns: (dv, index) => (dv.getUint16(getPointOffset(index) + 14, true) & 240) >> 4,
          Synthetic: (dv, index) => getFlags(dv, index) & 1,
          KeyPoint: (dv, index) => (getFlags(dv, index) & 2) >> 1,
          Withheld: (dv, index) => (getFlags(dv, index) & 4) >> 2,
          Overlap: (dv, index) => (getFlags(dv, index) & 8) >> 3,
          ScannerChannel: (dv, index) => (getFlags(dv, index) & 48) >> 4,
          ScanDirectionFlag: (dv, index) => (getFlags(dv, index) & 64) >> 6,
          EdgeOfFlightLine: (dv, index) => (getFlags(dv, index) & 128) >> 7,
          Classification: (dv, index) => dv.getUint8(getPointOffset(index) + 16),
          UserData: (dv, index) => dv.getUint8(getPointOffset(index) + 17),
          ScanAngle: (dv, index) => dv.getInt16(getPointOffset(index) + 18, true) * 6e-3,
          PointSourceId: (dv, index) => dv.getUint16(getPointOffset(index) + 20, true),
          GpsTime: (dv, index) => dv.getFloat64(getPointOffset(index) + 22, true)
        };
      }
      function create7(header) {
        const getPointOffset = getPointOffsetGetter(header);
        return {
          ...create6(header),
          Red: (dv, index) => dv.getUint16(getPointOffset(index) + 30, true),
          Green: (dv, index) => dv.getUint16(getPointOffset(index) + 32, true),
          Blue: (dv, index) => dv.getUint16(getPointOffset(index) + 34, true)
        };
      }
      function create8(header) {
        const getPointOffset = getPointOffsetGetter(header);
        return {
          ...create7(header),
          Infrared: (dv, index) => dv.getUint16(getPointOffset(index) + 36, true)
        };
      }
      function getPointOffsetGetter(header) {
        const { pointDataRecordLength } = header;
        return function getPointOffset(index) {
          return index * pointDataRecordLength;
        };
      }
    }
  });

  // node_modules/copc/lib/las/utils.js
  var require_utils2 = __commonJS({
    "node_modules/copc/lib/las/utils.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.formatGuid = exports.parsePoint = void 0;
      var utils_1 = require_utils();
      function parsePoint(buffer) {
        const dv = utils_1.Binary.toDataView(buffer);
        if (dv.byteLength !== 24) {
          throw new Error(`Invalid tuple buffer length: ${dv.byteLength}`);
        }
        return [
          dv.getFloat64(0, true),
          dv.getFloat64(8, true),
          dv.getFloat64(16, true)
        ];
      }
      exports.parsePoint = parsePoint;
      function formatGuid(buffer) {
        const dv = utils_1.Binary.toDataView(buffer);
        if (dv.byteLength !== 16) {
          throw new Error(`Invalid GUID buffer length: ${dv.byteLength}`);
        }
        let s = "";
        for (let i = 0; i < dv.byteLength; i += 4) {
          const c = dv.getUint32(i, true);
          s += c.toString(16).padStart(8, "0");
        }
        return [s.slice(0, 8), s.slice(8, 12), s.slice(12, 16), s.slice(16, 32)].join("-");
      }
      exports.formatGuid = formatGuid;
    }
  });

  // node_modules/copc/lib/las/header.js
  var require_header = __commonJS({
    "node_modules/copc/lib/las/header.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.Header = void 0;
      var utils_1 = require_utils();
      var constants_1 = require_constants2();
      var utils_2 = require_utils2();
      exports.Header = { parse };
      function parse(buffer) {
        if (buffer.byteLength < constants_1.minHeaderLength) {
          throw new Error(`Invalid header: must be at least ${constants_1.minHeaderLength} bytes`);
        }
        const dv = utils_1.Binary.toDataView(buffer);
        const fileSignature = utils_1.Binary.toCString(buffer.slice(0, 4));
        if (fileSignature !== "LASF") {
          throw new Error(`Invalid file signature: ${fileSignature}`);
        }
        const majorVersion = dv.getUint8(24);
        const minorVersion = dv.getUint8(25);
        if (majorVersion !== 1 || minorVersion !== 2 && minorVersion !== 4) {
          throw new Error(`Invalid version (only 1.2 and 1.4 supported): ${majorVersion}.${minorVersion}`);
        }
        const header = {
          fileSignature,
          fileSourceId: dv.getUint16(4, true),
          globalEncoding: dv.getUint16(6, true),
          projectId: (0, utils_2.formatGuid)(buffer.slice(8, 24)),
          majorVersion,
          minorVersion,
          systemIdentifier: utils_1.Binary.toCString(buffer.slice(26, 58)),
          generatingSoftware: utils_1.Binary.toCString(buffer.slice(58, 90)),
          fileCreationDayOfYear: dv.getUint16(90, true),
          fileCreationYear: dv.getUint16(92, true),
          headerLength: dv.getUint16(94, true),
          pointDataOffset: dv.getUint32(96, true),
          vlrCount: dv.getUint32(100, true),
          pointDataRecordFormat: dv.getUint8(104) & 15,
          pointDataRecordLength: dv.getUint16(105, true),
          pointCount: dv.getUint32(107, true),
          pointCountByReturn: parseLegacyNumberOfPointsByReturn(buffer.slice(111, 131)),
          scale: (0, utils_2.parsePoint)(buffer.slice(131, 155)),
          offset: (0, utils_2.parsePoint)(buffer.slice(155, 179)),
          min: [
            dv.getFloat64(187, true),
            dv.getFloat64(203, true),
            dv.getFloat64(219, true)
          ],
          max: [
            dv.getFloat64(179, true),
            dv.getFloat64(195, true),
            dv.getFloat64(211, true)
          ],
          waveformDataOffset: 0,
          evlrOffset: 0,
          evlrCount: 0
        };
        if (minorVersion == 2)
          return header;
        return {
          ...header,
          pointCount: (0, utils_1.parseBigInt)((0, utils_1.getBigUint64)(dv, 247, true)),
          pointCountByReturn: parseNumberOfPointsByReturn(buffer.slice(255, 375)),
          waveformDataOffset: (0, utils_1.parseBigInt)((0, utils_1.getBigUint64)(dv, 227, true)),
          evlrOffset: (0, utils_1.parseBigInt)((0, utils_1.getBigUint64)(dv, 235, true)),
          evlrCount: dv.getUint32(243, true)
        };
      }
      function parseNumberOfPointsByReturn(buffer) {
        const dv = utils_1.Binary.toDataView(buffer);
        const bigs = [];
        for (let offset = 0; offset < 15 * 8; offset += 8) {
          bigs.push((0, utils_1.getBigUint64)(dv, offset, true));
        }
        return bigs.map((v) => (0, utils_1.parseBigInt)(v));
      }
      function parseLegacyNumberOfPointsByReturn(buffer) {
        const dv = utils_1.Binary.toDataView(buffer);
        const v = [];
        for (let offset = 0; offset < 5 * 4; offset += 4) {
          v.push(dv.getUint32(offset, true));
        }
        return v;
      }
    }
  });

  // node_modules/laz-perf/lib/web/laz-perf.js
  var require_laz_perf = __commonJS({
    "node_modules/laz-perf/lib/web/laz-perf.js"(exports, module) {
      var createLazPerf2 = (() => {
        var _scriptDir = typeof document !== "undefined" && document.currentScript ? document.currentScript.src : void 0;
        return (function(createLazPerf3) {
          createLazPerf3 = createLazPerf3 || {};
          var Module = typeof createLazPerf3 != "undefined" ? createLazPerf3 : {};
          var readyPromiseResolve, readyPromiseReject;
          Module["ready"] = new Promise(function(resolve, reject) {
            readyPromiseResolve = resolve;
            readyPromiseReject = reject;
          });
          ["_main", "___getTypeName", "__embind_initialize_bindings", "_fflush", "onRuntimeInitialized"].forEach((prop) => {
            if (!Object.getOwnPropertyDescriptor(Module["ready"], prop)) {
              Object.defineProperty(Module["ready"], prop, { get: () => abort("You are getting " + prop + " on the Promise object, instead of the instance. Use .then() to get called back with the instance, see the MODULARIZE docs in src/settings.js"), set: () => abort("You are setting " + prop + " on the Promise object, instead of the instance. Use .then() to get called back with the instance, see the MODULARIZE docs in src/settings.js") });
            }
          });
          var moduleOverrides = Object.assign({}, Module);
          var arguments_ = [];
          var thisProgram = "./this.program";
          var quit_ = (status, toThrow) => {
            throw toThrow;
          };
          var ENVIRONMENT_IS_WEB = true;
          var ENVIRONMENT_IS_WORKER = false;
          var ENVIRONMENT_IS_NODE = false;
          var ENVIRONMENT_IS_SHELL = false;
          if (Module["ENVIRONMENT"]) {
            throw new Error("Module.ENVIRONMENT has been deprecated. To force the environment, use the ENVIRONMENT compile-time option (for example, -sENVIRONMENT=web or -sENVIRONMENT=node)");
          }
          var scriptDirectory = "";
          function locateFile(path) {
            if (Module["locateFile"]) {
              return Module["locateFile"](path, scriptDirectory);
            }
            return scriptDirectory + path;
          }
          var read_, readAsync, readBinary, setWindowTitle;
          function logExceptionOnExit(e) {
            if (e instanceof ExitStatus) return;
            let toLog = e;
            if (e && typeof e == "object" && e.stack) {
              toLog = [e, e.stack];
            }
            err("exiting due to exception: " + toLog);
          }
          if (ENVIRONMENT_IS_SHELL) {
            if (typeof process == "object" && typeof __require === "function" || typeof window == "object" || typeof importScripts == "function") throw new Error("not compiled for this environment (did you build to HTML and try to run it not on the web, or set ENVIRONMENT to something - like node - and run it someplace else - like on the web?)");
            if (typeof read != "undefined") {
              read_ = function shell_read(f) {
                return read(f);
              };
            }
            readBinary = function readBinary2(f) {
              let data;
              if (typeof readbuffer == "function") {
                return new Uint8Array(readbuffer(f));
              }
              data = read(f, "binary");
              assert(typeof data == "object");
              return data;
            };
            readAsync = function readAsync2(f, onload, onerror) {
              setTimeout(() => onload(readBinary(f)), 0);
            };
            if (typeof scriptArgs != "undefined") {
              arguments_ = scriptArgs;
            } else if (typeof arguments != "undefined") {
              arguments_ = arguments;
            }
            if (typeof quit == "function") {
              quit_ = (status, toThrow) => {
                logExceptionOnExit(toThrow);
                quit(status);
              };
            }
            if (typeof print != "undefined") {
              if (typeof console == "undefined") console = {};
              console.log = print;
              console.warn = console.error = typeof printErr != "undefined" ? printErr : print;
            }
          } else if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
            if (ENVIRONMENT_IS_WORKER) {
              scriptDirectory = self.location.href;
            } else if (typeof document != "undefined" && document.currentScript) {
              scriptDirectory = document.currentScript.src;
            }
            if (_scriptDir) {
              scriptDirectory = _scriptDir;
            }
            if (scriptDirectory.indexOf("blob:") !== 0) {
              scriptDirectory = scriptDirectory.substr(0, scriptDirectory.replace(/[?#].*/, "").lastIndexOf("/") + 1);
            } else {
              scriptDirectory = "";
            }
            if (!(typeof window == "object" || typeof importScripts == "function")) throw new Error("not compiled for this environment (did you build to HTML and try to run it not on the web, or set ENVIRONMENT to something - like node - and run it someplace else - like on the web?)");
            {
              read_ = (url) => {
                var xhr = new XMLHttpRequest();
                xhr.open("GET", url, false);
                xhr.send(null);
                return xhr.responseText;
              };
              if (ENVIRONMENT_IS_WORKER) {
                readBinary = (url) => {
                  var xhr = new XMLHttpRequest();
                  xhr.open("GET", url, false);
                  xhr.responseType = "arraybuffer";
                  xhr.send(null);
                  return new Uint8Array(xhr.response);
                };
              }
              readAsync = (url, onload, onerror) => {
                var xhr = new XMLHttpRequest();
                xhr.open("GET", url, true);
                xhr.responseType = "arraybuffer";
                xhr.onload = () => {
                  if (xhr.status == 200 || xhr.status == 0 && xhr.response) {
                    onload(xhr.response);
                    return;
                  }
                  onerror();
                };
                xhr.onerror = onerror;
                xhr.send(null);
              };
            }
            setWindowTitle = (title) => document.title = title;
          } else {
            throw new Error("environment detection error");
          }
          var out = Module["print"] || console.log.bind(console);
          var err = Module["printErr"] || console.warn.bind(console);
          Object.assign(Module, moduleOverrides);
          moduleOverrides = null;
          checkIncomingModuleAPI();
          if (Module["arguments"]) arguments_ = Module["arguments"];
          legacyModuleProp("arguments", "arguments_");
          if (Module["thisProgram"]) thisProgram = Module["thisProgram"];
          legacyModuleProp("thisProgram", "thisProgram");
          if (Module["quit"]) quit_ = Module["quit"];
          legacyModuleProp("quit", "quit_");
          assert(typeof Module["memoryInitializerPrefixURL"] == "undefined", "Module.memoryInitializerPrefixURL option was removed, use Module.locateFile instead");
          assert(typeof Module["pthreadMainPrefixURL"] == "undefined", "Module.pthreadMainPrefixURL option was removed, use Module.locateFile instead");
          assert(typeof Module["cdInitializerPrefixURL"] == "undefined", "Module.cdInitializerPrefixURL option was removed, use Module.locateFile instead");
          assert(typeof Module["filePackagePrefixURL"] == "undefined", "Module.filePackagePrefixURL option was removed, use Module.locateFile instead");
          assert(typeof Module["read"] == "undefined", "Module.read option was removed (modify read_ in JS)");
          assert(typeof Module["readAsync"] == "undefined", "Module.readAsync option was removed (modify readAsync in JS)");
          assert(typeof Module["readBinary"] == "undefined", "Module.readBinary option was removed (modify readBinary in JS)");
          assert(typeof Module["setWindowTitle"] == "undefined", "Module.setWindowTitle option was removed (modify setWindowTitle in JS)");
          assert(typeof Module["TOTAL_MEMORY"] == "undefined", "Module.TOTAL_MEMORY has been renamed Module.INITIAL_MEMORY");
          legacyModuleProp("read", "read_");
          legacyModuleProp("readAsync", "readAsync");
          legacyModuleProp("readBinary", "readBinary");
          legacyModuleProp("setWindowTitle", "setWindowTitle");
          assert(!ENVIRONMENT_IS_WORKER, "worker environment detected but not enabled at build time.  Add 'worker' to `-sENVIRONMENT` to enable.");
          assert(!ENVIRONMENT_IS_NODE, "node environment detected but not enabled at build time.  Add 'node' to `-sENVIRONMENT` to enable.");
          assert(!ENVIRONMENT_IS_SHELL, "shell environment detected but not enabled at build time.  Add 'shell' to `-sENVIRONMENT` to enable.");
          var POINTER_SIZE = 4;
          function legacyModuleProp(prop, newName) {
            if (!Object.getOwnPropertyDescriptor(Module, prop)) {
              Object.defineProperty(Module, prop, { configurable: true, get: function() {
                abort("Module." + prop + " has been replaced with plain " + newName + " (the initial value can be provided on Module, but after startup the value is only looked for on a local variable of that name)");
              } });
            }
          }
          function ignoredModuleProp(prop) {
            if (Object.getOwnPropertyDescriptor(Module, prop)) {
              abort("`Module." + prop + "` was supplied but `" + prop + "` not included in INCOMING_MODULE_JS_API");
            }
          }
          function isExportedByForceFilesystem(name) {
            return name === "FS_createPath" || name === "FS_createDataFile" || name === "FS_createPreloadedFile" || name === "FS_unlink" || name === "addRunDependency" || name === "FS_createLazyFile" || name === "FS_createDevice" || name === "removeRunDependency";
          }
          function missingLibrarySymbol(sym) {
            if (typeof globalThis !== "undefined" && !Object.getOwnPropertyDescriptor(globalThis, sym)) {
              Object.defineProperty(globalThis, sym, { configurable: true, get: function() {
                var msg = "`" + sym + "` is a library symbol and not included by default; add it to your library.js __deps or to DEFAULT_LIBRARY_FUNCS_TO_INCLUDE on the command line";
                if (isExportedByForceFilesystem(sym)) {
                  msg += ". Alternatively, forcing filesystem support (-sFORCE_FILESYSTEM) can export this for you";
                }
                warnOnce(msg);
                return void 0;
              } });
            }
          }
          function unexportedRuntimeSymbol(sym) {
            if (!Object.getOwnPropertyDescriptor(Module, sym)) {
              Object.defineProperty(Module, sym, { configurable: true, get: function() {
                var msg = "'" + sym + "' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)";
                if (isExportedByForceFilesystem(sym)) {
                  msg += ". Alternatively, forcing filesystem support (-sFORCE_FILESYSTEM) can export this for you";
                }
                abort(msg);
              } });
            }
          }
          var wasmBinary;
          if (Module["wasmBinary"]) wasmBinary = Module["wasmBinary"];
          legacyModuleProp("wasmBinary", "wasmBinary");
          var noExitRuntime = Module["noExitRuntime"] || true;
          legacyModuleProp("noExitRuntime", "noExitRuntime");
          if (typeof WebAssembly != "object") {
            abort("no native wasm support detected");
          }
          var wasmMemory;
          var ABORT = false;
          var EXITSTATUS;
          function assert(condition, text) {
            if (!condition) {
              abort("Assertion failed" + (text ? ": " + text : ""));
            }
          }
          var UTF8Decoder = typeof TextDecoder != "undefined" ? new TextDecoder("utf8") : void 0;
          function UTF8ArrayToString(heapOrArray, idx, maxBytesToRead) {
            var endIdx = idx + maxBytesToRead;
            var endPtr = idx;
            while (heapOrArray[endPtr] && !(endPtr >= endIdx)) ++endPtr;
            if (endPtr - idx > 16 && heapOrArray.buffer && UTF8Decoder) {
              return UTF8Decoder.decode(heapOrArray.subarray(idx, endPtr));
            }
            var str = "";
            while (idx < endPtr) {
              var u0 = heapOrArray[idx++];
              if (!(u0 & 128)) {
                str += String.fromCharCode(u0);
                continue;
              }
              var u1 = heapOrArray[idx++] & 63;
              if ((u0 & 224) == 192) {
                str += String.fromCharCode((u0 & 31) << 6 | u1);
                continue;
              }
              var u2 = heapOrArray[idx++] & 63;
              if ((u0 & 240) == 224) {
                u0 = (u0 & 15) << 12 | u1 << 6 | u2;
              } else {
                if ((u0 & 248) != 240) warnOnce("Invalid UTF-8 leading byte 0x" + u0.toString(16) + " encountered when deserializing a UTF-8 string in wasm memory to a JS string!");
                u0 = (u0 & 7) << 18 | u1 << 12 | u2 << 6 | heapOrArray[idx++] & 63;
              }
              if (u0 < 65536) {
                str += String.fromCharCode(u0);
              } else {
                var ch = u0 - 65536;
                str += String.fromCharCode(55296 | ch >> 10, 56320 | ch & 1023);
              }
            }
            return str;
          }
          function UTF8ToString(ptr, maxBytesToRead) {
            return ptr ? UTF8ArrayToString(HEAPU8, ptr, maxBytesToRead) : "";
          }
          function stringToUTF8Array(str, heap, outIdx, maxBytesToWrite) {
            if (!(maxBytesToWrite > 0)) return 0;
            var startIdx = outIdx;
            var endIdx = outIdx + maxBytesToWrite - 1;
            for (var i = 0; i < str.length; ++i) {
              var u = str.charCodeAt(i);
              if (u >= 55296 && u <= 57343) {
                var u1 = str.charCodeAt(++i);
                u = 65536 + ((u & 1023) << 10) | u1 & 1023;
              }
              if (u <= 127) {
                if (outIdx >= endIdx) break;
                heap[outIdx++] = u;
              } else if (u <= 2047) {
                if (outIdx + 1 >= endIdx) break;
                heap[outIdx++] = 192 | u >> 6;
                heap[outIdx++] = 128 | u & 63;
              } else if (u <= 65535) {
                if (outIdx + 2 >= endIdx) break;
                heap[outIdx++] = 224 | u >> 12;
                heap[outIdx++] = 128 | u >> 6 & 63;
                heap[outIdx++] = 128 | u & 63;
              } else {
                if (outIdx + 3 >= endIdx) break;
                if (u > 1114111) warnOnce("Invalid Unicode code point 0x" + u.toString(16) + " encountered when serializing a JS string to a UTF-8 string in wasm memory! (Valid unicode code points should be in range 0-0x10FFFF).");
                heap[outIdx++] = 240 | u >> 18;
                heap[outIdx++] = 128 | u >> 12 & 63;
                heap[outIdx++] = 128 | u >> 6 & 63;
                heap[outIdx++] = 128 | u & 63;
              }
            }
            heap[outIdx] = 0;
            return outIdx - startIdx;
          }
          function stringToUTF8(str, outPtr, maxBytesToWrite) {
            assert(typeof maxBytesToWrite == "number", "stringToUTF8(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!");
            return stringToUTF8Array(str, HEAPU8, outPtr, maxBytesToWrite);
          }
          function lengthBytesUTF8(str) {
            var len = 0;
            for (var i = 0; i < str.length; ++i) {
              var c = str.charCodeAt(i);
              if (c <= 127) {
                len++;
              } else if (c <= 2047) {
                len += 2;
              } else if (c >= 55296 && c <= 57343) {
                len += 4;
                ++i;
              } else {
                len += 3;
              }
            }
            return len;
          }
          var buffer, HEAP8, HEAPU8, HEAP16, HEAPU16, HEAP32, HEAPU32, HEAPF32, HEAPF64;
          function updateGlobalBufferAndViews(buf) {
            buffer = buf;
            Module["HEAP8"] = HEAP8 = new Int8Array(buf);
            Module["HEAP16"] = HEAP16 = new Int16Array(buf);
            Module["HEAP32"] = HEAP32 = new Int32Array(buf);
            Module["HEAPU8"] = HEAPU8 = new Uint8Array(buf);
            Module["HEAPU16"] = HEAPU16 = new Uint16Array(buf);
            Module["HEAPU32"] = HEAPU32 = new Uint32Array(buf);
            Module["HEAPF32"] = HEAPF32 = new Float32Array(buf);
            Module["HEAPF64"] = HEAPF64 = new Float64Array(buf);
          }
          var TOTAL_STACK = 65536;
          if (Module["TOTAL_STACK"]) assert(TOTAL_STACK === Module["TOTAL_STACK"], "the stack size can no longer be determined at runtime");
          var INITIAL_MEMORY = Module["INITIAL_MEMORY"] || 262144;
          legacyModuleProp("INITIAL_MEMORY", "INITIAL_MEMORY");
          assert(INITIAL_MEMORY >= TOTAL_STACK, "INITIAL_MEMORY should be larger than TOTAL_STACK, was " + INITIAL_MEMORY + "! (TOTAL_STACK=" + TOTAL_STACK + ")");
          assert(typeof Int32Array != "undefined" && typeof Float64Array !== "undefined" && Int32Array.prototype.subarray != void 0 && Int32Array.prototype.set != void 0, "JS engine does not provide full typed array support");
          assert(!Module["wasmMemory"], "Use of `wasmMemory` detected.  Use -sIMPORTED_MEMORY to define wasmMemory externally");
          assert(INITIAL_MEMORY == 262144, "Detected runtime INITIAL_MEMORY setting.  Use -sIMPORTED_MEMORY to define wasmMemory dynamically");
          var wasmTable;
          function writeStackCookie() {
            var max = _emscripten_stack_get_end();
            assert((max & 3) == 0);
            HEAPU32[max >> 2] = 34821223;
            HEAPU32[max + 4 >> 2] = 2310721022;
            HEAPU32[0] = 1668509029;
          }
          function checkStackCookie() {
            if (ABORT) return;
            var max = _emscripten_stack_get_end();
            var cookie1 = HEAPU32[max >> 2];
            var cookie2 = HEAPU32[max + 4 >> 2];
            if (cookie1 != 34821223 || cookie2 != 2310721022) {
              abort("Stack overflow! Stack cookie has been overwritten at 0x" + max.toString(16) + ", expected hex dwords 0x89BACDFE and 0x2135467, but received 0x" + cookie2.toString(16) + " 0x" + cookie1.toString(16));
            }
            if (HEAPU32[0] !== 1668509029) abort("Runtime error: The application has corrupted its heap memory area (address zero)!");
          }
          (function() {
            var h16 = new Int16Array(1);
            var h8 = new Int8Array(h16.buffer);
            h16[0] = 25459;
            if (h8[0] !== 115 || h8[1] !== 99) throw "Runtime error: expected the system to be little-endian! (Run with -sSUPPORT_BIG_ENDIAN to bypass)";
          })();
          var __ATPRERUN__ = [];
          var __ATINIT__ = [];
          var __ATPOSTRUN__ = [];
          var runtimeInitialized = false;
          function preRun() {
            if (Module["preRun"]) {
              if (typeof Module["preRun"] == "function") Module["preRun"] = [Module["preRun"]];
              while (Module["preRun"].length) {
                addOnPreRun(Module["preRun"].shift());
              }
            }
            callRuntimeCallbacks(__ATPRERUN__);
          }
          function initRuntime() {
            assert(!runtimeInitialized);
            runtimeInitialized = true;
            checkStackCookie();
            callRuntimeCallbacks(__ATINIT__);
          }
          function postRun() {
            checkStackCookie();
            if (Module["postRun"]) {
              if (typeof Module["postRun"] == "function") Module["postRun"] = [Module["postRun"]];
              while (Module["postRun"].length) {
                addOnPostRun(Module["postRun"].shift());
              }
            }
            callRuntimeCallbacks(__ATPOSTRUN__);
          }
          function addOnPreRun(cb) {
            __ATPRERUN__.unshift(cb);
          }
          function addOnInit(cb) {
            __ATINIT__.unshift(cb);
          }
          function addOnPostRun(cb) {
            __ATPOSTRUN__.unshift(cb);
          }
          assert(Math.imul, "This browser does not support Math.imul(), build with LEGACY_VM_SUPPORT or POLYFILL_OLD_MATH_FUNCTIONS to add in a polyfill");
          assert(Math.fround, "This browser does not support Math.fround(), build with LEGACY_VM_SUPPORT or POLYFILL_OLD_MATH_FUNCTIONS to add in a polyfill");
          assert(Math.clz32, "This browser does not support Math.clz32(), build with LEGACY_VM_SUPPORT or POLYFILL_OLD_MATH_FUNCTIONS to add in a polyfill");
          assert(Math.trunc, "This browser does not support Math.trunc(), build with LEGACY_VM_SUPPORT or POLYFILL_OLD_MATH_FUNCTIONS to add in a polyfill");
          var runDependencies = 0;
          var runDependencyWatcher = null;
          var dependenciesFulfilled = null;
          var runDependencyTracking = {};
          function addRunDependency(id) {
            runDependencies++;
            if (Module["monitorRunDependencies"]) {
              Module["monitorRunDependencies"](runDependencies);
            }
            if (id) {
              assert(!runDependencyTracking[id]);
              runDependencyTracking[id] = 1;
              if (runDependencyWatcher === null && typeof setInterval != "undefined") {
                runDependencyWatcher = setInterval(function() {
                  if (ABORT) {
                    clearInterval(runDependencyWatcher);
                    runDependencyWatcher = null;
                    return;
                  }
                  var shown = false;
                  for (var dep in runDependencyTracking) {
                    if (!shown) {
                      shown = true;
                      err("still waiting on run dependencies:");
                    }
                    err("dependency: " + dep);
                  }
                  if (shown) {
                    err("(end of list)");
                  }
                }, 1e4);
              }
            } else {
              err("warning: run dependency added without ID");
            }
          }
          function removeRunDependency(id) {
            runDependencies--;
            if (Module["monitorRunDependencies"]) {
              Module["monitorRunDependencies"](runDependencies);
            }
            if (id) {
              assert(runDependencyTracking[id]);
              delete runDependencyTracking[id];
            } else {
              err("warning: run dependency removed without ID");
            }
            if (runDependencies == 0) {
              if (runDependencyWatcher !== null) {
                clearInterval(runDependencyWatcher);
                runDependencyWatcher = null;
              }
              if (dependenciesFulfilled) {
                var callback = dependenciesFulfilled;
                dependenciesFulfilled = null;
                callback();
              }
            }
          }
          function abort(what) {
            {
              if (Module["onAbort"]) {
                Module["onAbort"](what);
              }
            }
            what = "Aborted(" + what + ")";
            err(what);
            ABORT = true;
            EXITSTATUS = 1;
            var e = new WebAssembly.RuntimeError(what);
            readyPromiseReject(e);
            throw e;
          }
          var FS = { error: function() {
            abort("Filesystem support (FS) was not included. The problem is that you are using files from JS, but files were not used from C/C++, so filesystem support was not auto-included. You can force-include filesystem support with -sFORCE_FILESYSTEM");
          }, init: function() {
            FS.error();
          }, createDataFile: function() {
            FS.error();
          }, createPreloadedFile: function() {
            FS.error();
          }, createLazyFile: function() {
            FS.error();
          }, open: function() {
            FS.error();
          }, mkdev: function() {
            FS.error();
          }, registerDevice: function() {
            FS.error();
          }, analyzePath: function() {
            FS.error();
          }, loadFilesFromDB: function() {
            FS.error();
          }, ErrnoError: function ErrnoError() {
            FS.error();
          } };
          Module["FS_createDataFile"] = FS.createDataFile;
          Module["FS_createPreloadedFile"] = FS.createPreloadedFile;
          var dataURIPrefix = "data:application/octet-stream;base64,";
          function isDataURI(filename) {
            return filename.startsWith(dataURIPrefix);
          }
          function isFileURI(filename) {
            return filename.startsWith("file://");
          }
          function createExportWrapper(name, fixedasm) {
            return function() {
              var displayName = name;
              var asm2 = fixedasm;
              if (!fixedasm) {
                asm2 = Module["asm"];
              }
              assert(runtimeInitialized, "native function `" + displayName + "` called before runtime initialization");
              if (!asm2[name]) {
                assert(asm2[name], "exported native function `" + displayName + "` not found");
              }
              return asm2[name].apply(null, arguments);
            };
          }
          var wasmBinaryFile;
          wasmBinaryFile = "laz-perf.wasm";
          if (!isDataURI(wasmBinaryFile)) {
            wasmBinaryFile = locateFile(wasmBinaryFile);
          }
          function getBinary(file) {
            try {
              if (file == wasmBinaryFile && wasmBinary) {
                return new Uint8Array(wasmBinary);
              }
              if (readBinary) {
                return readBinary(file);
              }
              throw "both async and sync fetching of the wasm failed";
            } catch (err2) {
              abort(err2);
            }
          }
          function getBinaryPromise() {
            if (!wasmBinary && (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER)) {
              if (typeof fetch == "function") {
                return fetch(wasmBinaryFile, { credentials: "same-origin" }).then(function(response) {
                  if (!response["ok"]) {
                    throw "failed to load wasm binary file at '" + wasmBinaryFile + "'";
                  }
                  return response["arrayBuffer"]();
                }).catch(function() {
                  return getBinary(wasmBinaryFile);
                });
              }
            }
            return Promise.resolve().then(function() {
              return getBinary(wasmBinaryFile);
            });
          }
          function createWasm() {
            var info = { "env": asmLibraryArg, "wasi_snapshot_preview1": asmLibraryArg };
            function receiveInstance(instance, module2) {
              var exports3 = instance.exports;
              Module["asm"] = exports3;
              wasmMemory = Module["asm"]["memory"];
              assert(wasmMemory, "memory not found in wasm exports");
              updateGlobalBufferAndViews(wasmMemory.buffer);
              wasmTable = Module["asm"]["__indirect_function_table"];
              assert(wasmTable, "table not found in wasm exports");
              addOnInit(Module["asm"]["__wasm_call_ctors"]);
              removeRunDependency("wasm-instantiate");
            }
            addRunDependency("wasm-instantiate");
            var trueModule = Module;
            function receiveInstantiationResult(result) {
              assert(Module === trueModule, "the Module object should not be replaced during async compilation - perhaps the order of HTML elements is wrong?");
              trueModule = null;
              receiveInstance(result["instance"]);
            }
            function instantiateArrayBuffer(receiver) {
              return getBinaryPromise().then(function(binary) {
                return WebAssembly.instantiate(binary, info);
              }).then(function(instance) {
                return instance;
              }).then(receiver, function(reason) {
                err("failed to asynchronously prepare wasm: " + reason);
                if (isFileURI(wasmBinaryFile)) {
                  err("warning: Loading from a file URI (" + wasmBinaryFile + ") is not supported in most browsers. See https://emscripten.org/docs/getting_started/FAQ.html#how-do-i-run-a-local-webserver-for-testing-why-does-my-program-stall-in-downloading-or-preparing");
                }
                abort(reason);
              });
            }
            function instantiateAsync() {
              if (!wasmBinary && typeof WebAssembly.instantiateStreaming == "function" && !isDataURI(wasmBinaryFile) && typeof fetch == "function") {
                return fetch(wasmBinaryFile, { credentials: "same-origin" }).then(function(response) {
                  var result = WebAssembly.instantiateStreaming(response, info);
                  return result.then(receiveInstantiationResult, function(reason) {
                    err("wasm streaming compile failed: " + reason);
                    err("falling back to ArrayBuffer instantiation");
                    return instantiateArrayBuffer(receiveInstantiationResult);
                  });
                });
              } else {
                return instantiateArrayBuffer(receiveInstantiationResult);
              }
            }
            if (Module["instantiateWasm"]) {
              try {
                var exports2 = Module["instantiateWasm"](info, receiveInstance);
                return exports2;
              } catch (e) {
                err("Module.instantiateWasm callback failed with error: " + e);
                return false;
              }
            }
            instantiateAsync().catch(readyPromiseReject);
            return {};
          }
          var tempDouble;
          var tempI64;
          function ExitStatus(status) {
            this.name = "ExitStatus";
            this.message = "Program terminated with exit(" + status + ")";
            this.status = status;
          }
          function callRuntimeCallbacks(callbacks) {
            while (callbacks.length > 0) {
              callbacks.shift()(Module);
            }
          }
          function demangle(func) {
            warnOnce("warning: build with -sDEMANGLE_SUPPORT to link in libcxxabi demangling");
            return func;
          }
          function demangleAll(text) {
            var regex = /\b_Z[\w\d_]+/g;
            return text.replace(regex, function(x) {
              var y = demangle(x);
              return x === y ? x : y + " [" + x + "]";
            });
          }
          function jsStackTrace() {
            var error = new Error();
            if (!error.stack) {
              try {
                throw new Error();
              } catch (e) {
                error = e;
              }
              if (!error.stack) {
                return "(no stack trace available)";
              }
            }
            return error.stack.toString();
          }
          function warnOnce(text) {
            if (!warnOnce.shown) warnOnce.shown = {};
            if (!warnOnce.shown[text]) {
              warnOnce.shown[text] = 1;
              err(text);
            }
          }
          function writeArrayToMemory(array, buffer2) {
            assert(array.length >= 0, "writeArrayToMemory array must have a length (should be an array or typed array)");
            HEAP8.set(array, buffer2);
          }
          function ___cxa_allocate_exception(size) {
            return _malloc(size + 24) + 24;
          }
          function ExceptionInfo(excPtr) {
            this.excPtr = excPtr;
            this.ptr = excPtr - 24;
            this.set_type = function(type) {
              HEAPU32[this.ptr + 4 >> 2] = type;
            };
            this.get_type = function() {
              return HEAPU32[this.ptr + 4 >> 2];
            };
            this.set_destructor = function(destructor) {
              HEAPU32[this.ptr + 8 >> 2] = destructor;
            };
            this.get_destructor = function() {
              return HEAPU32[this.ptr + 8 >> 2];
            };
            this.set_refcount = function(refcount) {
              HEAP32[this.ptr >> 2] = refcount;
            };
            this.set_caught = function(caught) {
              caught = caught ? 1 : 0;
              HEAP8[this.ptr + 12 >> 0] = caught;
            };
            this.get_caught = function() {
              return HEAP8[this.ptr + 12 >> 0] != 0;
            };
            this.set_rethrown = function(rethrown) {
              rethrown = rethrown ? 1 : 0;
              HEAP8[this.ptr + 13 >> 0] = rethrown;
            };
            this.get_rethrown = function() {
              return HEAP8[this.ptr + 13 >> 0] != 0;
            };
            this.init = function(type, destructor) {
              this.set_adjusted_ptr(0);
              this.set_type(type);
              this.set_destructor(destructor);
              this.set_refcount(0);
              this.set_caught(false);
              this.set_rethrown(false);
            };
            this.add_ref = function() {
              var value = HEAP32[this.ptr >> 2];
              HEAP32[this.ptr >> 2] = value + 1;
            };
            this.release_ref = function() {
              var prev = HEAP32[this.ptr >> 2];
              HEAP32[this.ptr >> 2] = prev - 1;
              assert(prev > 0);
              return prev === 1;
            };
            this.set_adjusted_ptr = function(adjustedPtr) {
              HEAPU32[this.ptr + 16 >> 2] = adjustedPtr;
            };
            this.get_adjusted_ptr = function() {
              return HEAPU32[this.ptr + 16 >> 2];
            };
            this.get_exception_ptr = function() {
              var isPointer = ___cxa_is_pointer_type(this.get_type());
              if (isPointer) {
                return HEAPU32[this.excPtr >> 2];
              }
              var adjusted = this.get_adjusted_ptr();
              if (adjusted !== 0) return adjusted;
              return this.excPtr;
            };
          }
          var exceptionLast = 0;
          var uncaughtExceptionCount = 0;
          function ___cxa_throw(ptr, type, destructor) {
            var info = new ExceptionInfo(ptr);
            info.init(type, destructor);
            exceptionLast = ptr;
            uncaughtExceptionCount++;
            throw ptr + " - Exception catching is disabled, this exception cannot be caught. Compile with -sNO_DISABLE_EXCEPTION_CATCHING or -sEXCEPTION_CATCHING_ALLOWED=[..] to catch.";
          }
          function __embind_register_bigint(primitiveType, name, size, minRange, maxRange) {
          }
          function getShiftFromSize(size) {
            switch (size) {
              case 1:
                return 0;
              case 2:
                return 1;
              case 4:
                return 2;
              case 8:
                return 3;
              default:
                throw new TypeError("Unknown type size: " + size);
            }
          }
          function embind_init_charCodes() {
            var codes = new Array(256);
            for (var i = 0; i < 256; ++i) {
              codes[i] = String.fromCharCode(i);
            }
            embind_charCodes = codes;
          }
          var embind_charCodes = void 0;
          function readLatin1String(ptr) {
            var ret = "";
            var c = ptr;
            while (HEAPU8[c]) {
              ret += embind_charCodes[HEAPU8[c++]];
            }
            return ret;
          }
          var awaitingDependencies = {};
          var registeredTypes = {};
          var typeDependencies = {};
          var char_0 = 48;
          var char_9 = 57;
          function makeLegalFunctionName(name) {
            if (void 0 === name) {
              return "_unknown";
            }
            name = name.replace(/[^a-zA-Z0-9_]/g, "$");
            var f = name.charCodeAt(0);
            if (f >= char_0 && f <= char_9) {
              return "_" + name;
            }
            return name;
          }
          function createNamedFunction(name, body) {
            name = makeLegalFunctionName(name);
            return function() {
              "use strict";
              return body.apply(this, arguments);
            };
          }
          function extendError(baseErrorType, errorName) {
            var errorClass = createNamedFunction(errorName, function(message) {
              this.name = errorName;
              this.message = message;
              var stack = new Error(message).stack;
              if (stack !== void 0) {
                this.stack = this.toString() + "\n" + stack.replace(/^Error(:[^\n]*)?\n/, "");
              }
            });
            errorClass.prototype = Object.create(baseErrorType.prototype);
            errorClass.prototype.constructor = errorClass;
            errorClass.prototype.toString = function() {
              if (this.message === void 0) {
                return this.name;
              } else {
                return this.name + ": " + this.message;
              }
            };
            return errorClass;
          }
          var BindingError = void 0;
          function throwBindingError(message) {
            throw new BindingError(message);
          }
          var InternalError = void 0;
          function throwInternalError(message) {
            throw new InternalError(message);
          }
          function whenDependentTypesAreResolved(myTypes, dependentTypes, getTypeConverters) {
            myTypes.forEach(function(type) {
              typeDependencies[type] = dependentTypes;
            });
            function onComplete(typeConverters2) {
              var myTypeConverters = getTypeConverters(typeConverters2);
              if (myTypeConverters.length !== myTypes.length) {
                throwInternalError("Mismatched type converter count");
              }
              for (var i = 0; i < myTypes.length; ++i) {
                registerType(myTypes[i], myTypeConverters[i]);
              }
            }
            var typeConverters = new Array(dependentTypes.length);
            var unregisteredTypes = [];
            var registered = 0;
            dependentTypes.forEach((dt, i) => {
              if (registeredTypes.hasOwnProperty(dt)) {
                typeConverters[i] = registeredTypes[dt];
              } else {
                unregisteredTypes.push(dt);
                if (!awaitingDependencies.hasOwnProperty(dt)) {
                  awaitingDependencies[dt] = [];
                }
                awaitingDependencies[dt].push(() => {
                  typeConverters[i] = registeredTypes[dt];
                  ++registered;
                  if (registered === unregisteredTypes.length) {
                    onComplete(typeConverters);
                  }
                });
              }
            });
            if (0 === unregisteredTypes.length) {
              onComplete(typeConverters);
            }
          }
          function registerType(rawType, registeredInstance, options = {}) {
            if (!("argPackAdvance" in registeredInstance)) {
              throw new TypeError("registerType registeredInstance requires argPackAdvance");
            }
            var name = registeredInstance.name;
            if (!rawType) {
              throwBindingError('type "' + name + '" must have a positive integer typeid pointer');
            }
            if (registeredTypes.hasOwnProperty(rawType)) {
              if (options.ignoreDuplicateRegistrations) {
                return;
              } else {
                throwBindingError("Cannot register type '" + name + "' twice");
              }
            }
            registeredTypes[rawType] = registeredInstance;
            delete typeDependencies[rawType];
            if (awaitingDependencies.hasOwnProperty(rawType)) {
              var callbacks = awaitingDependencies[rawType];
              delete awaitingDependencies[rawType];
              callbacks.forEach((cb) => cb());
            }
          }
          function __embind_register_bool(rawType, name, size, trueValue, falseValue) {
            var shift = getShiftFromSize(size);
            name = readLatin1String(name);
            registerType(rawType, { name, "fromWireType": function(wt) {
              return !!wt;
            }, "toWireType": function(destructors, o) {
              return o ? trueValue : falseValue;
            }, "argPackAdvance": 8, "readValueFromPointer": function(pointer) {
              var heap;
              if (size === 1) {
                heap = HEAP8;
              } else if (size === 2) {
                heap = HEAP16;
              } else if (size === 4) {
                heap = HEAP32;
              } else {
                throw new TypeError("Unknown boolean type size: " + name);
              }
              return this["fromWireType"](heap[pointer >> shift]);
            }, destructorFunction: null });
          }
          function ClassHandle_isAliasOf(other) {
            if (!(this instanceof ClassHandle)) {
              return false;
            }
            if (!(other instanceof ClassHandle)) {
              return false;
            }
            var leftClass = this.$$.ptrType.registeredClass;
            var left = this.$$.ptr;
            var rightClass = other.$$.ptrType.registeredClass;
            var right = other.$$.ptr;
            while (leftClass.baseClass) {
              left = leftClass.upcast(left);
              leftClass = leftClass.baseClass;
            }
            while (rightClass.baseClass) {
              right = rightClass.upcast(right);
              rightClass = rightClass.baseClass;
            }
            return leftClass === rightClass && left === right;
          }
          function shallowCopyInternalPointer(o) {
            return { count: o.count, deleteScheduled: o.deleteScheduled, preservePointerOnDelete: o.preservePointerOnDelete, ptr: o.ptr, ptrType: o.ptrType, smartPtr: o.smartPtr, smartPtrType: o.smartPtrType };
          }
          function throwInstanceAlreadyDeleted(obj) {
            function getInstanceTypeName(handle) {
              return handle.$$.ptrType.registeredClass.name;
            }
            throwBindingError(getInstanceTypeName(obj) + " instance already deleted");
          }
          var finalizationRegistry = false;
          function detachFinalizer(handle) {
          }
          function runDestructor($$) {
            if ($$.smartPtr) {
              $$.smartPtrType.rawDestructor($$.smartPtr);
            } else {
              $$.ptrType.registeredClass.rawDestructor($$.ptr);
            }
          }
          function releaseClassHandle($$) {
            $$.count.value -= 1;
            var toDelete = 0 === $$.count.value;
            if (toDelete) {
              runDestructor($$);
            }
          }
          function downcastPointer(ptr, ptrClass, desiredClass) {
            if (ptrClass === desiredClass) {
              return ptr;
            }
            if (void 0 === desiredClass.baseClass) {
              return null;
            }
            var rv = downcastPointer(ptr, ptrClass, desiredClass.baseClass);
            if (rv === null) {
              return null;
            }
            return desiredClass.downcast(rv);
          }
          var registeredPointers = {};
          function getInheritedInstanceCount() {
            return Object.keys(registeredInstances).length;
          }
          function getLiveInheritedInstances() {
            var rv = [];
            for (var k in registeredInstances) {
              if (registeredInstances.hasOwnProperty(k)) {
                rv.push(registeredInstances[k]);
              }
            }
            return rv;
          }
          var deletionQueue = [];
          function flushPendingDeletes() {
            while (deletionQueue.length) {
              var obj = deletionQueue.pop();
              obj.$$.deleteScheduled = false;
              obj["delete"]();
            }
          }
          var delayFunction = void 0;
          function setDelayFunction(fn) {
            delayFunction = fn;
            if (deletionQueue.length && delayFunction) {
              delayFunction(flushPendingDeletes);
            }
          }
          function init_embind() {
            Module["getInheritedInstanceCount"] = getInheritedInstanceCount;
            Module["getLiveInheritedInstances"] = getLiveInheritedInstances;
            Module["flushPendingDeletes"] = flushPendingDeletes;
            Module["setDelayFunction"] = setDelayFunction;
          }
          var registeredInstances = {};
          function getBasestPointer(class_, ptr) {
            if (ptr === void 0) {
              throwBindingError("ptr should not be undefined");
            }
            while (class_.baseClass) {
              ptr = class_.upcast(ptr);
              class_ = class_.baseClass;
            }
            return ptr;
          }
          function getInheritedInstance(class_, ptr) {
            ptr = getBasestPointer(class_, ptr);
            return registeredInstances[ptr];
          }
          function makeClassHandle(prototype, record) {
            if (!record.ptrType || !record.ptr) {
              throwInternalError("makeClassHandle requires ptr and ptrType");
            }
            var hasSmartPtrType = !!record.smartPtrType;
            var hasSmartPtr = !!record.smartPtr;
            if (hasSmartPtrType !== hasSmartPtr) {
              throwInternalError("Both smartPtrType and smartPtr must be specified");
            }
            record.count = { value: 1 };
            return attachFinalizer(Object.create(prototype, { $$: { value: record } }));
          }
          function RegisteredPointer_fromWireType(ptr) {
            var rawPointer = this.getPointee(ptr);
            if (!rawPointer) {
              this.destructor(ptr);
              return null;
            }
            var registeredInstance = getInheritedInstance(this.registeredClass, rawPointer);
            if (void 0 !== registeredInstance) {
              if (0 === registeredInstance.$$.count.value) {
                registeredInstance.$$.ptr = rawPointer;
                registeredInstance.$$.smartPtr = ptr;
                return registeredInstance["clone"]();
              } else {
                var rv = registeredInstance["clone"]();
                this.destructor(ptr);
                return rv;
              }
            }
            function makeDefaultHandle() {
              if (this.isSmartPointer) {
                return makeClassHandle(this.registeredClass.instancePrototype, { ptrType: this.pointeeType, ptr: rawPointer, smartPtrType: this, smartPtr: ptr });
              } else {
                return makeClassHandle(this.registeredClass.instancePrototype, { ptrType: this, ptr });
              }
            }
            var actualType = this.registeredClass.getActualType(rawPointer);
            var registeredPointerRecord = registeredPointers[actualType];
            if (!registeredPointerRecord) {
              return makeDefaultHandle.call(this);
            }
            var toType;
            if (this.isConst) {
              toType = registeredPointerRecord.constPointerType;
            } else {
              toType = registeredPointerRecord.pointerType;
            }
            var dp = downcastPointer(rawPointer, this.registeredClass, toType.registeredClass);
            if (dp === null) {
              return makeDefaultHandle.call(this);
            }
            if (this.isSmartPointer) {
              return makeClassHandle(toType.registeredClass.instancePrototype, { ptrType: toType, ptr: dp, smartPtrType: this, smartPtr: ptr });
            } else {
              return makeClassHandle(toType.registeredClass.instancePrototype, { ptrType: toType, ptr: dp });
            }
          }
          function attachFinalizer(handle) {
            if ("undefined" === typeof FinalizationRegistry) {
              attachFinalizer = (handle2) => handle2;
              return handle;
            }
            finalizationRegistry = new FinalizationRegistry((info) => {
              console.warn(info.leakWarning.stack.replace(/^Error: /, ""));
              releaseClassHandle(info.$$);
            });
            attachFinalizer = (handle2) => {
              var $$ = handle2.$$;
              var hasSmartPtr = !!$$.smartPtr;
              if (hasSmartPtr) {
                var info = { $$ };
                var cls = $$.ptrType.registeredClass;
                info.leakWarning = new Error("Embind found a leaked C++ instance " + cls.name + " <0x" + $$.ptr.toString(16) + ">.\nWe'll free it automatically in this case, but this functionality is not reliable across various environments.\nMake sure to invoke .delete() manually once you're done with the instance instead.\nOriginally allocated");
                if ("captureStackTrace" in Error) {
                  Error.captureStackTrace(info.leakWarning, RegisteredPointer_fromWireType);
                }
                finalizationRegistry.register(handle2, info, handle2);
              }
              return handle2;
            };
            detachFinalizer = (handle2) => finalizationRegistry.unregister(handle2);
            return attachFinalizer(handle);
          }
          function ClassHandle_clone() {
            if (!this.$$.ptr) {
              throwInstanceAlreadyDeleted(this);
            }
            if (this.$$.preservePointerOnDelete) {
              this.$$.count.value += 1;
              return this;
            } else {
              var clone = attachFinalizer(Object.create(Object.getPrototypeOf(this), { $$: { value: shallowCopyInternalPointer(this.$$) } }));
              clone.$$.count.value += 1;
              clone.$$.deleteScheduled = false;
              return clone;
            }
          }
          function ClassHandle_delete() {
            if (!this.$$.ptr) {
              throwInstanceAlreadyDeleted(this);
            }
            if (this.$$.deleteScheduled && !this.$$.preservePointerOnDelete) {
              throwBindingError("Object already scheduled for deletion");
            }
            detachFinalizer(this);
            releaseClassHandle(this.$$);
            if (!this.$$.preservePointerOnDelete) {
              this.$$.smartPtr = void 0;
              this.$$.ptr = void 0;
            }
          }
          function ClassHandle_isDeleted() {
            return !this.$$.ptr;
          }
          function ClassHandle_deleteLater() {
            if (!this.$$.ptr) {
              throwInstanceAlreadyDeleted(this);
            }
            if (this.$$.deleteScheduled && !this.$$.preservePointerOnDelete) {
              throwBindingError("Object already scheduled for deletion");
            }
            deletionQueue.push(this);
            if (deletionQueue.length === 1 && delayFunction) {
              delayFunction(flushPendingDeletes);
            }
            this.$$.deleteScheduled = true;
            return this;
          }
          function init_ClassHandle() {
            ClassHandle.prototype["isAliasOf"] = ClassHandle_isAliasOf;
            ClassHandle.prototype["clone"] = ClassHandle_clone;
            ClassHandle.prototype["delete"] = ClassHandle_delete;
            ClassHandle.prototype["isDeleted"] = ClassHandle_isDeleted;
            ClassHandle.prototype["deleteLater"] = ClassHandle_deleteLater;
          }
          function ClassHandle() {
          }
          function ensureOverloadTable(proto, methodName, humanName) {
            if (void 0 === proto[methodName].overloadTable) {
              var prevFunc = proto[methodName];
              proto[methodName] = function() {
                if (!proto[methodName].overloadTable.hasOwnProperty(arguments.length)) {
                  throwBindingError("Function '" + humanName + "' called with an invalid number of arguments (" + arguments.length + ") - expects one of (" + proto[methodName].overloadTable + ")!");
                }
                return proto[methodName].overloadTable[arguments.length].apply(this, arguments);
              };
              proto[methodName].overloadTable = [];
              proto[methodName].overloadTable[prevFunc.argCount] = prevFunc;
            }
          }
          function exposePublicSymbol(name, value, numArguments) {
            if (Module.hasOwnProperty(name)) {
              if (void 0 === numArguments || void 0 !== Module[name].overloadTable && void 0 !== Module[name].overloadTable[numArguments]) {
                throwBindingError("Cannot register public name '" + name + "' twice");
              }
              ensureOverloadTable(Module, name, name);
              if (Module.hasOwnProperty(numArguments)) {
                throwBindingError("Cannot register multiple overloads of a function with the same number of arguments (" + numArguments + ")!");
              }
              Module[name].overloadTable[numArguments] = value;
            } else {
              Module[name] = value;
              if (void 0 !== numArguments) {
                Module[name].numArguments = numArguments;
              }
            }
          }
          function RegisteredClass(name, constructor, instancePrototype, rawDestructor, baseClass, getActualType, upcast, downcast) {
            this.name = name;
            this.constructor = constructor;
            this.instancePrototype = instancePrototype;
            this.rawDestructor = rawDestructor;
            this.baseClass = baseClass;
            this.getActualType = getActualType;
            this.upcast = upcast;
            this.downcast = downcast;
            this.pureVirtualFunctions = [];
          }
          function upcastPointer(ptr, ptrClass, desiredClass) {
            while (ptrClass !== desiredClass) {
              if (!ptrClass.upcast) {
                throwBindingError("Expected null or instance of " + desiredClass.name + ", got an instance of " + ptrClass.name);
              }
              ptr = ptrClass.upcast(ptr);
              ptrClass = ptrClass.baseClass;
            }
            return ptr;
          }
          function constNoSmartPtrRawPointerToWireType(destructors, handle) {
            if (handle === null) {
              if (this.isReference) {
                throwBindingError("null is not a valid " + this.name);
              }
              return 0;
            }
            if (!handle.$$) {
              throwBindingError('Cannot pass "' + embindRepr(handle) + '" as a ' + this.name);
            }
            if (!handle.$$.ptr) {
              throwBindingError("Cannot pass deleted object as a pointer of type " + this.name);
            }
            var handleClass = handle.$$.ptrType.registeredClass;
            var ptr = upcastPointer(handle.$$.ptr, handleClass, this.registeredClass);
            return ptr;
          }
          function genericPointerToWireType(destructors, handle) {
            var ptr;
            if (handle === null) {
              if (this.isReference) {
                throwBindingError("null is not a valid " + this.name);
              }
              if (this.isSmartPointer) {
                ptr = this.rawConstructor();
                if (destructors !== null) {
                  destructors.push(this.rawDestructor, ptr);
                }
                return ptr;
              } else {
                return 0;
              }
            }
            if (!handle.$$) {
              throwBindingError('Cannot pass "' + embindRepr(handle) + '" as a ' + this.name);
            }
            if (!handle.$$.ptr) {
              throwBindingError("Cannot pass deleted object as a pointer of type " + this.name);
            }
            if (!this.isConst && handle.$$.ptrType.isConst) {
              throwBindingError("Cannot convert argument of type " + (handle.$$.smartPtrType ? handle.$$.smartPtrType.name : handle.$$.ptrType.name) + " to parameter type " + this.name);
            }
            var handleClass = handle.$$.ptrType.registeredClass;
            ptr = upcastPointer(handle.$$.ptr, handleClass, this.registeredClass);
            if (this.isSmartPointer) {
              if (void 0 === handle.$$.smartPtr) {
                throwBindingError("Passing raw pointer to smart pointer is illegal");
              }
              switch (this.sharingPolicy) {
                case 0:
                  if (handle.$$.smartPtrType === this) {
                    ptr = handle.$$.smartPtr;
                  } else {
                    throwBindingError("Cannot convert argument of type " + (handle.$$.smartPtrType ? handle.$$.smartPtrType.name : handle.$$.ptrType.name) + " to parameter type " + this.name);
                  }
                  break;
                case 1:
                  ptr = handle.$$.smartPtr;
                  break;
                case 2:
                  if (handle.$$.smartPtrType === this) {
                    ptr = handle.$$.smartPtr;
                  } else {
                    var clonedHandle = handle["clone"]();
                    ptr = this.rawShare(ptr, Emval.toHandle(function() {
                      clonedHandle["delete"]();
                    }));
                    if (destructors !== null) {
                      destructors.push(this.rawDestructor, ptr);
                    }
                  }
                  break;
                default:
                  throwBindingError("Unsupporting sharing policy");
              }
            }
            return ptr;
          }
          function nonConstNoSmartPtrRawPointerToWireType(destructors, handle) {
            if (handle === null) {
              if (this.isReference) {
                throwBindingError("null is not a valid " + this.name);
              }
              return 0;
            }
            if (!handle.$$) {
              throwBindingError('Cannot pass "' + embindRepr(handle) + '" as a ' + this.name);
            }
            if (!handle.$$.ptr) {
              throwBindingError("Cannot pass deleted object as a pointer of type " + this.name);
            }
            if (handle.$$.ptrType.isConst) {
              throwBindingError("Cannot convert argument of type " + handle.$$.ptrType.name + " to parameter type " + this.name);
            }
            var handleClass = handle.$$.ptrType.registeredClass;
            var ptr = upcastPointer(handle.$$.ptr, handleClass, this.registeredClass);
            return ptr;
          }
          function simpleReadValueFromPointer(pointer) {
            return this["fromWireType"](HEAP32[pointer >> 2]);
          }
          function RegisteredPointer_getPointee(ptr) {
            if (this.rawGetPointee) {
              ptr = this.rawGetPointee(ptr);
            }
            return ptr;
          }
          function RegisteredPointer_destructor(ptr) {
            if (this.rawDestructor) {
              this.rawDestructor(ptr);
            }
          }
          function RegisteredPointer_deleteObject(handle) {
            if (handle !== null) {
              handle["delete"]();
            }
          }
          function init_RegisteredPointer() {
            RegisteredPointer.prototype.getPointee = RegisteredPointer_getPointee;
            RegisteredPointer.prototype.destructor = RegisteredPointer_destructor;
            RegisteredPointer.prototype["argPackAdvance"] = 8;
            RegisteredPointer.prototype["readValueFromPointer"] = simpleReadValueFromPointer;
            RegisteredPointer.prototype["deleteObject"] = RegisteredPointer_deleteObject;
            RegisteredPointer.prototype["fromWireType"] = RegisteredPointer_fromWireType;
          }
          function RegisteredPointer(name, registeredClass, isReference, isConst, isSmartPointer, pointeeType, sharingPolicy, rawGetPointee, rawConstructor, rawShare, rawDestructor) {
            this.name = name;
            this.registeredClass = registeredClass;
            this.isReference = isReference;
            this.isConst = isConst;
            this.isSmartPointer = isSmartPointer;
            this.pointeeType = pointeeType;
            this.sharingPolicy = sharingPolicy;
            this.rawGetPointee = rawGetPointee;
            this.rawConstructor = rawConstructor;
            this.rawShare = rawShare;
            this.rawDestructor = rawDestructor;
            if (!isSmartPointer && registeredClass.baseClass === void 0) {
              if (isConst) {
                this["toWireType"] = constNoSmartPtrRawPointerToWireType;
                this.destructorFunction = null;
              } else {
                this["toWireType"] = nonConstNoSmartPtrRawPointerToWireType;
                this.destructorFunction = null;
              }
            } else {
              this["toWireType"] = genericPointerToWireType;
            }
          }
          function replacePublicSymbol(name, value, numArguments) {
            if (!Module.hasOwnProperty(name)) {
              throwInternalError("Replacing nonexistant public symbol");
            }
            if (void 0 !== Module[name].overloadTable && void 0 !== numArguments) {
              Module[name].overloadTable[numArguments] = value;
            } else {
              Module[name] = value;
              Module[name].argCount = numArguments;
            }
          }
          function dynCallLegacy(sig, ptr, args) {
            assert("dynCall_" + sig in Module, "bad function pointer type - no table for sig '" + sig + "'");
            if (args && args.length) {
              assert(args.length === sig.substring(1).replace(/j/g, "--").length);
            } else {
              assert(sig.length == 1);
            }
            var f = Module["dynCall_" + sig];
            return args && args.length ? f.apply(null, [ptr].concat(args)) : f.call(null, ptr);
          }
          var wasmTableMirror = [];
          function getWasmTableEntry(funcPtr) {
            var func = wasmTableMirror[funcPtr];
            if (!func) {
              if (funcPtr >= wasmTableMirror.length) wasmTableMirror.length = funcPtr + 1;
              wasmTableMirror[funcPtr] = func = wasmTable.get(funcPtr);
            }
            assert(wasmTable.get(funcPtr) == func, "JavaScript-side Wasm function table mirror is out of date!");
            return func;
          }
          function dynCall(sig, ptr, args) {
            if (sig.includes("j")) {
              return dynCallLegacy(sig, ptr, args);
            }
            assert(getWasmTableEntry(ptr), "missing table entry in dynCall: " + ptr);
            var rtn = getWasmTableEntry(ptr).apply(null, args);
            return rtn;
          }
          function getDynCaller(sig, ptr) {
            assert(sig.includes("j") || sig.includes("p"), "getDynCaller should only be called with i64 sigs");
            var argCache = [];
            return function() {
              argCache.length = 0;
              Object.assign(argCache, arguments);
              return dynCall(sig, ptr, argCache);
            };
          }
          function embind__requireFunction(signature, rawFunction) {
            signature = readLatin1String(signature);
            function makeDynCaller() {
              if (signature.includes("j")) {
                return getDynCaller(signature, rawFunction);
              }
              return getWasmTableEntry(rawFunction);
            }
            var fp = makeDynCaller();
            if (typeof fp != "function") {
              throwBindingError("unknown function pointer with signature " + signature + ": " + rawFunction);
            }
            return fp;
          }
          var UnboundTypeError = void 0;
          function getTypeName(type) {
            var ptr = ___getTypeName(type);
            var rv = readLatin1String(ptr);
            _free(ptr);
            return rv;
          }
          function throwUnboundTypeError(message, types) {
            var unboundTypes = [];
            var seen = {};
            function visit(type) {
              if (seen[type]) {
                return;
              }
              if (registeredTypes[type]) {
                return;
              }
              if (typeDependencies[type]) {
                typeDependencies[type].forEach(visit);
                return;
              }
              unboundTypes.push(type);
              seen[type] = true;
            }
            types.forEach(visit);
            throw new UnboundTypeError(message + ": " + unboundTypes.map(getTypeName).join([", "]));
          }
          function __embind_register_class(rawType, rawPointerType, rawConstPointerType, baseClassRawType, getActualTypeSignature, getActualType, upcastSignature, upcast, downcastSignature, downcast, name, destructorSignature, rawDestructor) {
            name = readLatin1String(name);
            getActualType = embind__requireFunction(getActualTypeSignature, getActualType);
            if (upcast) {
              upcast = embind__requireFunction(upcastSignature, upcast);
            }
            if (downcast) {
              downcast = embind__requireFunction(downcastSignature, downcast);
            }
            rawDestructor = embind__requireFunction(destructorSignature, rawDestructor);
            var legalFunctionName = makeLegalFunctionName(name);
            exposePublicSymbol(legalFunctionName, function() {
              throwUnboundTypeError("Cannot construct " + name + " due to unbound types", [baseClassRawType]);
            });
            whenDependentTypesAreResolved([rawType, rawPointerType, rawConstPointerType], baseClassRawType ? [baseClassRawType] : [], function(base) {
              base = base[0];
              var baseClass;
              var basePrototype;
              if (baseClassRawType) {
                baseClass = base.registeredClass;
                basePrototype = baseClass.instancePrototype;
              } else {
                basePrototype = ClassHandle.prototype;
              }
              var constructor = createNamedFunction(legalFunctionName, function() {
                if (Object.getPrototypeOf(this) !== instancePrototype) {
                  throw new BindingError("Use 'new' to construct " + name);
                }
                if (void 0 === registeredClass.constructor_body) {
                  throw new BindingError(name + " has no accessible constructor");
                }
                var body = registeredClass.constructor_body[arguments.length];
                if (void 0 === body) {
                  throw new BindingError("Tried to invoke ctor of " + name + " with invalid number of parameters (" + arguments.length + ") - expected (" + Object.keys(registeredClass.constructor_body).toString() + ") parameters instead!");
                }
                return body.apply(this, arguments);
              });
              var instancePrototype = Object.create(basePrototype, { constructor: { value: constructor } });
              constructor.prototype = instancePrototype;
              var registeredClass = new RegisteredClass(name, constructor, instancePrototype, rawDestructor, baseClass, getActualType, upcast, downcast);
              var referenceConverter = new RegisteredPointer(name, registeredClass, true, false, false);
              var pointerConverter = new RegisteredPointer(name + "*", registeredClass, false, false, false);
              var constPointerConverter = new RegisteredPointer(name + " const*", registeredClass, false, true, false);
              registeredPointers[rawType] = { pointerType: pointerConverter, constPointerType: constPointerConverter };
              replacePublicSymbol(legalFunctionName, constructor);
              return [referenceConverter, pointerConverter, constPointerConverter];
            });
          }
          function heap32VectorToArray(count, firstElement) {
            var array = [];
            for (var i = 0; i < count; i++) {
              array.push(HEAPU32[firstElement + i * 4 >> 2]);
            }
            return array;
          }
          function runDestructors(destructors) {
            while (destructors.length) {
              var ptr = destructors.pop();
              var del = destructors.pop();
              del(ptr);
            }
          }
          function craftInvokerFunction(humanName, argTypes, classType, cppInvokerFunc, cppTargetFunc) {
            var argCount = argTypes.length;
            if (argCount < 2) {
              throwBindingError("argTypes array size mismatch! Must at least get return value and 'this' types!");
            }
            var isClassMethodFunc = argTypes[1] !== null && classType !== null;
            var needsDestructorStack = false;
            for (var i = 1; i < argTypes.length; ++i) {
              if (argTypes[i] !== null && argTypes[i].destructorFunction === void 0) {
                needsDestructorStack = true;
                break;
              }
            }
            var returns = argTypes[0].name !== "void";
            var expectedArgCount = argCount - 2;
            var argsWired = new Array(expectedArgCount);
            var invokerFuncArgs = [];
            var destructors = [];
            return function() {
              if (arguments.length !== expectedArgCount) {
                throwBindingError("function " + humanName + " called with " + arguments.length + " arguments, expected " + expectedArgCount + " args!");
              }
              destructors.length = 0;
              var thisWired;
              invokerFuncArgs.length = isClassMethodFunc ? 2 : 1;
              invokerFuncArgs[0] = cppTargetFunc;
              if (isClassMethodFunc) {
                thisWired = argTypes[1]["toWireType"](destructors, this);
                invokerFuncArgs[1] = thisWired;
              }
              for (var i2 = 0; i2 < expectedArgCount; ++i2) {
                argsWired[i2] = argTypes[i2 + 2]["toWireType"](destructors, arguments[i2]);
                invokerFuncArgs.push(argsWired[i2]);
              }
              var rv = cppInvokerFunc.apply(null, invokerFuncArgs);
              function onDone(rv2) {
                if (needsDestructorStack) {
                  runDestructors(destructors);
                } else {
                  for (var i3 = isClassMethodFunc ? 1 : 2; i3 < argTypes.length; i3++) {
                    var param = i3 === 1 ? thisWired : argsWired[i3 - 2];
                    if (argTypes[i3].destructorFunction !== null) {
                      argTypes[i3].destructorFunction(param);
                    }
                  }
                }
                if (returns) {
                  return argTypes[0]["fromWireType"](rv2);
                }
              }
              return onDone(rv);
            };
          }
          function __embind_register_class_constructor(rawClassType, argCount, rawArgTypesAddr, invokerSignature, invoker, rawConstructor) {
            assert(argCount > 0);
            var rawArgTypes = heap32VectorToArray(argCount, rawArgTypesAddr);
            invoker = embind__requireFunction(invokerSignature, invoker);
            whenDependentTypesAreResolved([], [rawClassType], function(classType) {
              classType = classType[0];
              var humanName = "constructor " + classType.name;
              if (void 0 === classType.registeredClass.constructor_body) {
                classType.registeredClass.constructor_body = [];
              }
              if (void 0 !== classType.registeredClass.constructor_body[argCount - 1]) {
                throw new BindingError("Cannot register multiple constructors with identical number of parameters (" + (argCount - 1) + ") for class '" + classType.name + "'! Overload resolution is currently only performed using the parameter count, not actual type info!");
              }
              classType.registeredClass.constructor_body[argCount - 1] = () => {
                throwUnboundTypeError("Cannot construct " + classType.name + " due to unbound types", rawArgTypes);
              };
              whenDependentTypesAreResolved([], rawArgTypes, function(argTypes) {
                argTypes.splice(1, 0, null);
                classType.registeredClass.constructor_body[argCount - 1] = craftInvokerFunction(humanName, argTypes, null, invoker, rawConstructor);
                return [];
              });
              return [];
            });
          }
          function __embind_register_class_function(rawClassType, methodName, argCount, rawArgTypesAddr, invokerSignature, rawInvoker, context, isPureVirtual) {
            var rawArgTypes = heap32VectorToArray(argCount, rawArgTypesAddr);
            methodName = readLatin1String(methodName);
            rawInvoker = embind__requireFunction(invokerSignature, rawInvoker);
            whenDependentTypesAreResolved([], [rawClassType], function(classType) {
              classType = classType[0];
              var humanName = classType.name + "." + methodName;
              if (methodName.startsWith("@@")) {
                methodName = Symbol[methodName.substring(2)];
              }
              if (isPureVirtual) {
                classType.registeredClass.pureVirtualFunctions.push(methodName);
              }
              function unboundTypesHandler() {
                throwUnboundTypeError("Cannot call " + humanName + " due to unbound types", rawArgTypes);
              }
              var proto = classType.registeredClass.instancePrototype;
              var method = proto[methodName];
              if (void 0 === method || void 0 === method.overloadTable && method.className !== classType.name && method.argCount === argCount - 2) {
                unboundTypesHandler.argCount = argCount - 2;
                unboundTypesHandler.className = classType.name;
                proto[methodName] = unboundTypesHandler;
              } else {
                ensureOverloadTable(proto, methodName, humanName);
                proto[methodName].overloadTable[argCount - 2] = unboundTypesHandler;
              }
              whenDependentTypesAreResolved([], rawArgTypes, function(argTypes) {
                var memberFunction = craftInvokerFunction(humanName, argTypes, classType, rawInvoker, context);
                if (void 0 === proto[methodName].overloadTable) {
                  memberFunction.argCount = argCount - 2;
                  proto[methodName] = memberFunction;
                } else {
                  proto[methodName].overloadTable[argCount - 2] = memberFunction;
                }
                return [];
              });
              return [];
            });
          }
          var emval_free_list = [];
          var emval_handle_array = [{}, { value: void 0 }, { value: null }, { value: true }, { value: false }];
          function __emval_decref(handle) {
            if (handle > 4 && 0 === --emval_handle_array[handle].refcount) {
              emval_handle_array[handle] = void 0;
              emval_free_list.push(handle);
            }
          }
          function count_emval_handles() {
            var count = 0;
            for (var i = 5; i < emval_handle_array.length; ++i) {
              if (emval_handle_array[i] !== void 0) {
                ++count;
              }
            }
            return count;
          }
          function get_first_emval() {
            for (var i = 5; i < emval_handle_array.length; ++i) {
              if (emval_handle_array[i] !== void 0) {
                return emval_handle_array[i];
              }
            }
            return null;
          }
          function init_emval() {
            Module["count_emval_handles"] = count_emval_handles;
            Module["get_first_emval"] = get_first_emval;
          }
          var Emval = { toValue: (handle) => {
            if (!handle) {
              throwBindingError("Cannot use deleted val. handle = " + handle);
            }
            return emval_handle_array[handle].value;
          }, toHandle: (value) => {
            switch (value) {
              case void 0:
                return 1;
              case null:
                return 2;
              case true:
                return 3;
              case false:
                return 4;
              default: {
                var handle = emval_free_list.length ? emval_free_list.pop() : emval_handle_array.length;
                emval_handle_array[handle] = { refcount: 1, value };
                return handle;
              }
            }
          } };
          function __embind_register_emval(rawType, name) {
            name = readLatin1String(name);
            registerType(rawType, { name, "fromWireType": function(handle) {
              var rv = Emval.toValue(handle);
              __emval_decref(handle);
              return rv;
            }, "toWireType": function(destructors, value) {
              return Emval.toHandle(value);
            }, "argPackAdvance": 8, "readValueFromPointer": simpleReadValueFromPointer, destructorFunction: null });
          }
          function embindRepr(v) {
            if (v === null) {
              return "null";
            }
            var t = typeof v;
            if (t === "object" || t === "array" || t === "function") {
              return v.toString();
            } else {
              return "" + v;
            }
          }
          function floatReadValueFromPointer(name, shift) {
            switch (shift) {
              case 2:
                return function(pointer) {
                  return this["fromWireType"](HEAPF32[pointer >> 2]);
                };
              case 3:
                return function(pointer) {
                  return this["fromWireType"](HEAPF64[pointer >> 3]);
                };
              default:
                throw new TypeError("Unknown float type: " + name);
            }
          }
          function __embind_register_float(rawType, name, size) {
            var shift = getShiftFromSize(size);
            name = readLatin1String(name);
            registerType(rawType, { name, "fromWireType": function(value) {
              return value;
            }, "toWireType": function(destructors, value) {
              if (typeof value != "number" && typeof value != "boolean") {
                throw new TypeError('Cannot convert "' + embindRepr(value) + '" to ' + this.name);
              }
              return value;
            }, "argPackAdvance": 8, "readValueFromPointer": floatReadValueFromPointer(name, shift), destructorFunction: null });
          }
          function integerReadValueFromPointer(name, shift, signed) {
            switch (shift) {
              case 0:
                return signed ? function readS8FromPointer(pointer) {
                  return HEAP8[pointer];
                } : function readU8FromPointer(pointer) {
                  return HEAPU8[pointer];
                };
              case 1:
                return signed ? function readS16FromPointer(pointer) {
                  return HEAP16[pointer >> 1];
                } : function readU16FromPointer(pointer) {
                  return HEAPU16[pointer >> 1];
                };
              case 2:
                return signed ? function readS32FromPointer(pointer) {
                  return HEAP32[pointer >> 2];
                } : function readU32FromPointer(pointer) {
                  return HEAPU32[pointer >> 2];
                };
              default:
                throw new TypeError("Unknown integer type: " + name);
            }
          }
          function __embind_register_integer(primitiveType, name, size, minRange, maxRange) {
            name = readLatin1String(name);
            if (maxRange === -1) {
              maxRange = 4294967295;
            }
            var shift = getShiftFromSize(size);
            var fromWireType = (value) => value;
            if (minRange === 0) {
              var bitshift = 32 - 8 * size;
              fromWireType = (value) => value << bitshift >>> bitshift;
            }
            var isUnsignedType = name.includes("unsigned");
            var checkAssertions = (value, toTypeName) => {
              if (typeof value != "number" && typeof value != "boolean") {
                throw new TypeError('Cannot convert "' + embindRepr(value) + '" to ' + toTypeName);
              }
              if (value < minRange || value > maxRange) {
                throw new TypeError('Passing a number "' + embindRepr(value) + '" from JS side to C/C++ side to an argument of type "' + name + '", which is outside the valid range [' + minRange + ", " + maxRange + "]!");
              }
            };
            var toWireType;
            if (isUnsignedType) {
              toWireType = function(destructors, value) {
                checkAssertions(value, this.name);
                return value >>> 0;
              };
            } else {
              toWireType = function(destructors, value) {
                checkAssertions(value, this.name);
                return value;
              };
            }
            registerType(primitiveType, { name, "fromWireType": fromWireType, "toWireType": toWireType, "argPackAdvance": 8, "readValueFromPointer": integerReadValueFromPointer(name, shift, minRange !== 0), destructorFunction: null });
          }
          function __embind_register_memory_view(rawType, dataTypeIndex, name) {
            var typeMapping = [Int8Array, Uint8Array, Int16Array, Uint16Array, Int32Array, Uint32Array, Float32Array, Float64Array];
            var TA = typeMapping[dataTypeIndex];
            function decodeMemoryView(handle) {
              handle = handle >> 2;
              var heap = HEAPU32;
              var size = heap[handle];
              var data = heap[handle + 1];
              return new TA(buffer, data, size);
            }
            name = readLatin1String(name);
            registerType(rawType, { name, "fromWireType": decodeMemoryView, "argPackAdvance": 8, "readValueFromPointer": decodeMemoryView }, { ignoreDuplicateRegistrations: true });
          }
          function __embind_register_std_string(rawType, name) {
            name = readLatin1String(name);
            var stdStringIsUTF8 = name === "std::string";
            registerType(rawType, { name, "fromWireType": function(value) {
              var length = HEAPU32[value >> 2];
              var payload = value + 4;
              var str;
              if (stdStringIsUTF8) {
                var decodeStartPtr = payload;
                for (var i = 0; i <= length; ++i) {
                  var currentBytePtr = payload + i;
                  if (i == length || HEAPU8[currentBytePtr] == 0) {
                    var maxRead = currentBytePtr - decodeStartPtr;
                    var stringSegment = UTF8ToString(decodeStartPtr, maxRead);
                    if (str === void 0) {
                      str = stringSegment;
                    } else {
                      str += String.fromCharCode(0);
                      str += stringSegment;
                    }
                    decodeStartPtr = currentBytePtr + 1;
                  }
                }
              } else {
                var a = new Array(length);
                for (var i = 0; i < length; ++i) {
                  a[i] = String.fromCharCode(HEAPU8[payload + i]);
                }
                str = a.join("");
              }
              _free(value);
              return str;
            }, "toWireType": function(destructors, value) {
              if (value instanceof ArrayBuffer) {
                value = new Uint8Array(value);
              }
              var length;
              var valueIsOfTypeString = typeof value == "string";
              if (!(valueIsOfTypeString || value instanceof Uint8Array || value instanceof Uint8ClampedArray || value instanceof Int8Array)) {
                throwBindingError("Cannot pass non-string to std::string");
              }
              if (stdStringIsUTF8 && valueIsOfTypeString) {
                length = lengthBytesUTF8(value);
              } else {
                length = value.length;
              }
              var base = _malloc(4 + length + 1);
              var ptr = base + 4;
              HEAPU32[base >> 2] = length;
              if (stdStringIsUTF8 && valueIsOfTypeString) {
                stringToUTF8(value, ptr, length + 1);
              } else {
                if (valueIsOfTypeString) {
                  for (var i = 0; i < length; ++i) {
                    var charCode = value.charCodeAt(i);
                    if (charCode > 255) {
                      _free(ptr);
                      throwBindingError("String has UTF-16 code units that do not fit in 8 bits");
                    }
                    HEAPU8[ptr + i] = charCode;
                  }
                } else {
                  for (var i = 0; i < length; ++i) {
                    HEAPU8[ptr + i] = value[i];
                  }
                }
              }
              if (destructors !== null) {
                destructors.push(_free, base);
              }
              return base;
            }, "argPackAdvance": 8, "readValueFromPointer": simpleReadValueFromPointer, destructorFunction: function(ptr) {
              _free(ptr);
            } });
          }
          var UTF16Decoder = typeof TextDecoder != "undefined" ? new TextDecoder("utf-16le") : void 0;
          function UTF16ToString(ptr, maxBytesToRead) {
            assert(ptr % 2 == 0, "Pointer passed to UTF16ToString must be aligned to two bytes!");
            var endPtr = ptr;
            var idx = endPtr >> 1;
            var maxIdx = idx + maxBytesToRead / 2;
            while (!(idx >= maxIdx) && HEAPU16[idx]) ++idx;
            endPtr = idx << 1;
            if (endPtr - ptr > 32 && UTF16Decoder) {
              return UTF16Decoder.decode(HEAPU8.subarray(ptr, endPtr));
            } else {
              var str = "";
              for (var i = 0; !(i >= maxBytesToRead / 2); ++i) {
                var codeUnit = HEAP16[ptr + i * 2 >> 1];
                if (codeUnit == 0) break;
                str += String.fromCharCode(codeUnit);
              }
              return str;
            }
          }
          function stringToUTF16(str, outPtr, maxBytesToWrite) {
            assert(outPtr % 2 == 0, "Pointer passed to stringToUTF16 must be aligned to two bytes!");
            assert(typeof maxBytesToWrite == "number", "stringToUTF16(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!");
            if (maxBytesToWrite === void 0) {
              maxBytesToWrite = 2147483647;
            }
            if (maxBytesToWrite < 2) return 0;
            maxBytesToWrite -= 2;
            var startPtr = outPtr;
            var numCharsToWrite = maxBytesToWrite < str.length * 2 ? maxBytesToWrite / 2 : str.length;
            for (var i = 0; i < numCharsToWrite; ++i) {
              var codeUnit = str.charCodeAt(i);
              HEAP16[outPtr >> 1] = codeUnit;
              outPtr += 2;
            }
            HEAP16[outPtr >> 1] = 0;
            return outPtr - startPtr;
          }
          function lengthBytesUTF16(str) {
            return str.length * 2;
          }
          function UTF32ToString(ptr, maxBytesToRead) {
            assert(ptr % 4 == 0, "Pointer passed to UTF32ToString must be aligned to four bytes!");
            var i = 0;
            var str = "";
            while (!(i >= maxBytesToRead / 4)) {
              var utf32 = HEAP32[ptr + i * 4 >> 2];
              if (utf32 == 0) break;
              ++i;
              if (utf32 >= 65536) {
                var ch = utf32 - 65536;
                str += String.fromCharCode(55296 | ch >> 10, 56320 | ch & 1023);
              } else {
                str += String.fromCharCode(utf32);
              }
            }
            return str;
          }
          function stringToUTF32(str, outPtr, maxBytesToWrite) {
            assert(outPtr % 4 == 0, "Pointer passed to stringToUTF32 must be aligned to four bytes!");
            assert(typeof maxBytesToWrite == "number", "stringToUTF32(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!");
            if (maxBytesToWrite === void 0) {
              maxBytesToWrite = 2147483647;
            }
            if (maxBytesToWrite < 4) return 0;
            var startPtr = outPtr;
            var endPtr = startPtr + maxBytesToWrite - 4;
            for (var i = 0; i < str.length; ++i) {
              var codeUnit = str.charCodeAt(i);
              if (codeUnit >= 55296 && codeUnit <= 57343) {
                var trailSurrogate = str.charCodeAt(++i);
                codeUnit = 65536 + ((codeUnit & 1023) << 10) | trailSurrogate & 1023;
              }
              HEAP32[outPtr >> 2] = codeUnit;
              outPtr += 4;
              if (outPtr + 4 > endPtr) break;
            }
            HEAP32[outPtr >> 2] = 0;
            return outPtr - startPtr;
          }
          function lengthBytesUTF32(str) {
            var len = 0;
            for (var i = 0; i < str.length; ++i) {
              var codeUnit = str.charCodeAt(i);
              if (codeUnit >= 55296 && codeUnit <= 57343) ++i;
              len += 4;
            }
            return len;
          }
          function __embind_register_std_wstring(rawType, charSize, name) {
            name = readLatin1String(name);
            var decodeString, encodeString, getHeap, lengthBytesUTF, shift;
            if (charSize === 2) {
              decodeString = UTF16ToString;
              encodeString = stringToUTF16;
              lengthBytesUTF = lengthBytesUTF16;
              getHeap = () => HEAPU16;
              shift = 1;
            } else if (charSize === 4) {
              decodeString = UTF32ToString;
              encodeString = stringToUTF32;
              lengthBytesUTF = lengthBytesUTF32;
              getHeap = () => HEAPU32;
              shift = 2;
            }
            registerType(rawType, { name, "fromWireType": function(value) {
              var length = HEAPU32[value >> 2];
              var HEAP = getHeap();
              var str;
              var decodeStartPtr = value + 4;
              for (var i = 0; i <= length; ++i) {
                var currentBytePtr = value + 4 + i * charSize;
                if (i == length || HEAP[currentBytePtr >> shift] == 0) {
                  var maxReadBytes = currentBytePtr - decodeStartPtr;
                  var stringSegment = decodeString(decodeStartPtr, maxReadBytes);
                  if (str === void 0) {
                    str = stringSegment;
                  } else {
                    str += String.fromCharCode(0);
                    str += stringSegment;
                  }
                  decodeStartPtr = currentBytePtr + charSize;
                }
              }
              _free(value);
              return str;
            }, "toWireType": function(destructors, value) {
              if (!(typeof value == "string")) {
                throwBindingError("Cannot pass non-string to C++ string type " + name);
              }
              var length = lengthBytesUTF(value);
              var ptr = _malloc(4 + length + charSize);
              HEAPU32[ptr >> 2] = length >> shift;
              encodeString(value, ptr + 4, length + charSize);
              if (destructors !== null) {
                destructors.push(_free, ptr);
              }
              return ptr;
            }, "argPackAdvance": 8, "readValueFromPointer": simpleReadValueFromPointer, destructorFunction: function(ptr) {
              _free(ptr);
            } });
          }
          function __embind_register_void(rawType, name) {
            name = readLatin1String(name);
            registerType(rawType, { isVoid: true, name, "argPackAdvance": 0, "fromWireType": function() {
              return void 0;
            }, "toWireType": function(destructors, o) {
              return void 0;
            } });
          }
          function _abort() {
            abort("native code called abort()");
          }
          function _emscripten_memcpy_big(dest, src, num) {
            HEAPU8.copyWithin(dest, src, src + num);
          }
          function getHeapMax() {
            return 2147483648;
          }
          function emscripten_realloc_buffer(size) {
            try {
              wasmMemory.grow(size - buffer.byteLength + 65535 >>> 16);
              updateGlobalBufferAndViews(wasmMemory.buffer);
              return 1;
            } catch (e) {
              err("emscripten_realloc_buffer: Attempted to grow heap from " + buffer.byteLength + " bytes to " + size + " bytes, but got error: " + e);
            }
          }
          function _emscripten_resize_heap(requestedSize) {
            var oldSize = HEAPU8.length;
            requestedSize = requestedSize >>> 0;
            assert(requestedSize > oldSize);
            var maxHeapSize = getHeapMax();
            if (requestedSize > maxHeapSize) {
              err("Cannot enlarge memory, asked to go up to " + requestedSize + " bytes, but the limit is " + maxHeapSize + " bytes!");
              return false;
            }
            let alignUp = (x, multiple) => x + (multiple - x % multiple) % multiple;
            for (var cutDown = 1; cutDown <= 4; cutDown *= 2) {
              var overGrownHeapSize = oldSize * (1 + 0.2 / cutDown);
              overGrownHeapSize = Math.min(overGrownHeapSize, requestedSize + 100663296);
              var newSize = Math.min(maxHeapSize, alignUp(Math.max(requestedSize, overGrownHeapSize), 65536));
              var replacement = emscripten_realloc_buffer(newSize);
              if (replacement) {
                return true;
              }
            }
            err("Failed to grow the heap from " + oldSize + " bytes to " + newSize + " bytes, not enough memory!");
            return false;
          }
          var ENV = {};
          function getExecutableName() {
            return thisProgram || "./this.program";
          }
          function getEnvStrings() {
            if (!getEnvStrings.strings) {
              var lang = (typeof navigator == "object" && navigator.languages && navigator.languages[0] || "C").replace("-", "_") + ".UTF-8";
              var env = { "USER": "web_user", "LOGNAME": "web_user", "PATH": "/", "PWD": "/", "HOME": "/home/web_user", "LANG": lang, "_": getExecutableName() };
              for (var x in ENV) {
                if (ENV[x] === void 0) delete env[x];
                else env[x] = ENV[x];
              }
              var strings = [];
              for (var x in env) {
                strings.push(x + "=" + env[x]);
              }
              getEnvStrings.strings = strings;
            }
            return getEnvStrings.strings;
          }
          function writeAsciiToMemory(str, buffer2, dontAddNull) {
            for (var i = 0; i < str.length; ++i) {
              assert(str.charCodeAt(i) === (str.charCodeAt(i) & 255));
              HEAP8[buffer2++ >> 0] = str.charCodeAt(i);
            }
            if (!dontAddNull) HEAP8[buffer2 >> 0] = 0;
          }
          var SYSCALLS = { varargs: void 0, get: function() {
            assert(SYSCALLS.varargs != void 0);
            SYSCALLS.varargs += 4;
            var ret = HEAP32[SYSCALLS.varargs - 4 >> 2];
            return ret;
          }, getStr: function(ptr) {
            var ret = UTF8ToString(ptr);
            return ret;
          } };
          function _environ_get(__environ, environ_buf) {
            var bufSize = 0;
            getEnvStrings().forEach(function(string, i) {
              var ptr = environ_buf + bufSize;
              HEAPU32[__environ + i * 4 >> 2] = ptr;
              writeAsciiToMemory(string, ptr);
              bufSize += string.length + 1;
            });
            return 0;
          }
          function _environ_sizes_get(penviron_count, penviron_buf_size) {
            var strings = getEnvStrings();
            HEAPU32[penviron_count >> 2] = strings.length;
            var bufSize = 0;
            strings.forEach(function(string) {
              bufSize += string.length + 1;
            });
            HEAPU32[penviron_buf_size >> 2] = bufSize;
            return 0;
          }
          function _fd_close(fd) {
            abort("fd_close called without SYSCALLS_REQUIRE_FILESYSTEM");
          }
          function _fd_seek(fd, offset_low, offset_high, whence, newOffset) {
            return 70;
          }
          var printCharBuffers = [null, [], []];
          function printChar(stream, curr) {
            var buffer2 = printCharBuffers[stream];
            assert(buffer2);
            if (curr === 0 || curr === 10) {
              (stream === 1 ? out : err)(UTF8ArrayToString(buffer2, 0));
              buffer2.length = 0;
            } else {
              buffer2.push(curr);
            }
          }
          function flush_NO_FILESYSTEM() {
            _fflush(0);
            if (printCharBuffers[1].length) printChar(1, 10);
            if (printCharBuffers[2].length) printChar(2, 10);
          }
          function _fd_write(fd, iov, iovcnt, pnum) {
            var num = 0;
            for (var i = 0; i < iovcnt; i++) {
              var ptr = HEAPU32[iov >> 2];
              var len = HEAPU32[iov + 4 >> 2];
              iov += 8;
              for (var j = 0; j < len; j++) {
                printChar(fd, HEAPU8[ptr + j]);
              }
              num += len;
            }
            HEAPU32[pnum >> 2] = num;
            return 0;
          }
          function __isLeapYear(year) {
            return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
          }
          function __arraySum(array, index) {
            var sum = 0;
            for (var i = 0; i <= index; sum += array[i++]) {
            }
            return sum;
          }
          var __MONTH_DAYS_LEAP = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
          var __MONTH_DAYS_REGULAR = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
          function __addDays(date, days) {
            var newDate = new Date(date.getTime());
            while (days > 0) {
              var leap = __isLeapYear(newDate.getFullYear());
              var currentMonth = newDate.getMonth();
              var daysInCurrentMonth = (leap ? __MONTH_DAYS_LEAP : __MONTH_DAYS_REGULAR)[currentMonth];
              if (days > daysInCurrentMonth - newDate.getDate()) {
                days -= daysInCurrentMonth - newDate.getDate() + 1;
                newDate.setDate(1);
                if (currentMonth < 11) {
                  newDate.setMonth(currentMonth + 1);
                } else {
                  newDate.setMonth(0);
                  newDate.setFullYear(newDate.getFullYear() + 1);
                }
              } else {
                newDate.setDate(newDate.getDate() + days);
                return newDate;
              }
            }
            return newDate;
          }
          function intArrayFromString(stringy, dontAddNull, length) {
            var len = length > 0 ? length : lengthBytesUTF8(stringy) + 1;
            var u8array = new Array(len);
            var numBytesWritten = stringToUTF8Array(stringy, u8array, 0, u8array.length);
            if (dontAddNull) u8array.length = numBytesWritten;
            return u8array;
          }
          function _strftime(s, maxsize, format, tm) {
            var tm_zone = HEAP32[tm + 40 >> 2];
            var date = { tm_sec: HEAP32[tm >> 2], tm_min: HEAP32[tm + 4 >> 2], tm_hour: HEAP32[tm + 8 >> 2], tm_mday: HEAP32[tm + 12 >> 2], tm_mon: HEAP32[tm + 16 >> 2], tm_year: HEAP32[tm + 20 >> 2], tm_wday: HEAP32[tm + 24 >> 2], tm_yday: HEAP32[tm + 28 >> 2], tm_isdst: HEAP32[tm + 32 >> 2], tm_gmtoff: HEAP32[tm + 36 >> 2], tm_zone: tm_zone ? UTF8ToString(tm_zone) : "" };
            var pattern = UTF8ToString(format);
            var EXPANSION_RULES_1 = { "%c": "%a %b %d %H:%M:%S %Y", "%D": "%m/%d/%y", "%F": "%Y-%m-%d", "%h": "%b", "%r": "%I:%M:%S %p", "%R": "%H:%M", "%T": "%H:%M:%S", "%x": "%m/%d/%y", "%X": "%H:%M:%S", "%Ec": "%c", "%EC": "%C", "%Ex": "%m/%d/%y", "%EX": "%H:%M:%S", "%Ey": "%y", "%EY": "%Y", "%Od": "%d", "%Oe": "%e", "%OH": "%H", "%OI": "%I", "%Om": "%m", "%OM": "%M", "%OS": "%S", "%Ou": "%u", "%OU": "%U", "%OV": "%V", "%Ow": "%w", "%OW": "%W", "%Oy": "%y" };
            for (var rule in EXPANSION_RULES_1) {
              pattern = pattern.replace(new RegExp(rule, "g"), EXPANSION_RULES_1[rule]);
            }
            var WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
            var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
            function leadingSomething(value, digits, character) {
              var str = typeof value == "number" ? value.toString() : value || "";
              while (str.length < digits) {
                str = character[0] + str;
              }
              return str;
            }
            function leadingNulls(value, digits) {
              return leadingSomething(value, digits, "0");
            }
            function compareByDay(date1, date2) {
              function sgn(value) {
                return value < 0 ? -1 : value > 0 ? 1 : 0;
              }
              var compare;
              if ((compare = sgn(date1.getFullYear() - date2.getFullYear())) === 0) {
                if ((compare = sgn(date1.getMonth() - date2.getMonth())) === 0) {
                  compare = sgn(date1.getDate() - date2.getDate());
                }
              }
              return compare;
            }
            function getFirstWeekStartDate(janFourth) {
              switch (janFourth.getDay()) {
                case 0:
                  return new Date(janFourth.getFullYear() - 1, 11, 29);
                case 1:
                  return janFourth;
                case 2:
                  return new Date(janFourth.getFullYear(), 0, 3);
                case 3:
                  return new Date(janFourth.getFullYear(), 0, 2);
                case 4:
                  return new Date(janFourth.getFullYear(), 0, 1);
                case 5:
                  return new Date(janFourth.getFullYear() - 1, 11, 31);
                case 6:
                  return new Date(janFourth.getFullYear() - 1, 11, 30);
              }
            }
            function getWeekBasedYear(date2) {
              var thisDate = __addDays(new Date(date2.tm_year + 1900, 0, 1), date2.tm_yday);
              var janFourthThisYear = new Date(thisDate.getFullYear(), 0, 4);
              var janFourthNextYear = new Date(thisDate.getFullYear() + 1, 0, 4);
              var firstWeekStartThisYear = getFirstWeekStartDate(janFourthThisYear);
              var firstWeekStartNextYear = getFirstWeekStartDate(janFourthNextYear);
              if (compareByDay(firstWeekStartThisYear, thisDate) <= 0) {
                if (compareByDay(firstWeekStartNextYear, thisDate) <= 0) {
                  return thisDate.getFullYear() + 1;
                }
                return thisDate.getFullYear();
              }
              return thisDate.getFullYear() - 1;
            }
            var EXPANSION_RULES_2 = { "%a": function(date2) {
              return WEEKDAYS[date2.tm_wday].substring(0, 3);
            }, "%A": function(date2) {
              return WEEKDAYS[date2.tm_wday];
            }, "%b": function(date2) {
              return MONTHS[date2.tm_mon].substring(0, 3);
            }, "%B": function(date2) {
              return MONTHS[date2.tm_mon];
            }, "%C": function(date2) {
              var year = date2.tm_year + 1900;
              return leadingNulls(year / 100 | 0, 2);
            }, "%d": function(date2) {
              return leadingNulls(date2.tm_mday, 2);
            }, "%e": function(date2) {
              return leadingSomething(date2.tm_mday, 2, " ");
            }, "%g": function(date2) {
              return getWeekBasedYear(date2).toString().substring(2);
            }, "%G": function(date2) {
              return getWeekBasedYear(date2);
            }, "%H": function(date2) {
              return leadingNulls(date2.tm_hour, 2);
            }, "%I": function(date2) {
              var twelveHour = date2.tm_hour;
              if (twelveHour == 0) twelveHour = 12;
              else if (twelveHour > 12) twelveHour -= 12;
              return leadingNulls(twelveHour, 2);
            }, "%j": function(date2) {
              return leadingNulls(date2.tm_mday + __arraySum(__isLeapYear(date2.tm_year + 1900) ? __MONTH_DAYS_LEAP : __MONTH_DAYS_REGULAR, date2.tm_mon - 1), 3);
            }, "%m": function(date2) {
              return leadingNulls(date2.tm_mon + 1, 2);
            }, "%M": function(date2) {
              return leadingNulls(date2.tm_min, 2);
            }, "%n": function() {
              return "\n";
            }, "%p": function(date2) {
              if (date2.tm_hour >= 0 && date2.tm_hour < 12) {
                return "AM";
              }
              return "PM";
            }, "%S": function(date2) {
              return leadingNulls(date2.tm_sec, 2);
            }, "%t": function() {
              return "	";
            }, "%u": function(date2) {
              return date2.tm_wday || 7;
            }, "%U": function(date2) {
              var days = date2.tm_yday + 7 - date2.tm_wday;
              return leadingNulls(Math.floor(days / 7), 2);
            }, "%V": function(date2) {
              var val = Math.floor((date2.tm_yday + 7 - (date2.tm_wday + 6) % 7) / 7);
              if ((date2.tm_wday + 371 - date2.tm_yday - 2) % 7 <= 2) {
                val++;
              }
              if (!val) {
                val = 52;
                var dec31 = (date2.tm_wday + 7 - date2.tm_yday - 1) % 7;
                if (dec31 == 4 || dec31 == 5 && __isLeapYear(date2.tm_year % 400 - 1)) {
                  val++;
                }
              } else if (val == 53) {
                var jan1 = (date2.tm_wday + 371 - date2.tm_yday) % 7;
                if (jan1 != 4 && (jan1 != 3 || !__isLeapYear(date2.tm_year))) val = 1;
              }
              return leadingNulls(val, 2);
            }, "%w": function(date2) {
              return date2.tm_wday;
            }, "%W": function(date2) {
              var days = date2.tm_yday + 7 - (date2.tm_wday + 6) % 7;
              return leadingNulls(Math.floor(days / 7), 2);
            }, "%y": function(date2) {
              return (date2.tm_year + 1900).toString().substring(2);
            }, "%Y": function(date2) {
              return date2.tm_year + 1900;
            }, "%z": function(date2) {
              var off = date2.tm_gmtoff;
              var ahead = off >= 0;
              off = Math.abs(off) / 60;
              off = off / 60 * 100 + off % 60;
              return (ahead ? "+" : "-") + String("0000" + off).slice(-4);
            }, "%Z": function(date2) {
              return date2.tm_zone;
            }, "%%": function() {
              return "%";
            } };
            pattern = pattern.replace(/%%/g, "\0\0");
            for (var rule in EXPANSION_RULES_2) {
              if (pattern.includes(rule)) {
                pattern = pattern.replace(new RegExp(rule, "g"), EXPANSION_RULES_2[rule](date));
              }
            }
            pattern = pattern.replace(/\0\0/g, "%");
            var bytes = intArrayFromString(pattern, false);
            if (bytes.length > maxsize) {
              return 0;
            }
            writeArrayToMemory(bytes, s);
            return bytes.length - 1;
          }
          function _strftime_l(s, maxsize, format, tm) {
            return _strftime(s, maxsize, format, tm);
          }
          function uleb128Encode(n, target) {
            assert(n < 16384);
            if (n < 128) {
              target.push(n);
            } else {
              target.push(n % 128 | 128, n >> 7);
            }
          }
          function sigToWasmTypes(sig) {
            var typeNames = { "i": "i32", "j": "i64", "f": "f32", "d": "f64", "p": "i32" };
            var type = { parameters: [], results: sig[0] == "v" ? [] : [typeNames[sig[0]]] };
            for (var i = 1; i < sig.length; ++i) {
              assert(sig[i] in typeNames, "invalid signature char: " + sig[i]);
              type.parameters.push(typeNames[sig[i]]);
            }
            return type;
          }
          function convertJsFunctionToWasm(func, sig) {
            if (typeof WebAssembly.Function == "function") {
              return new WebAssembly.Function(sigToWasmTypes(sig), func);
            }
            var typeSectionBody = [1, 96];
            var sigRet = sig.slice(0, 1);
            var sigParam = sig.slice(1);
            var typeCodes = { "i": 127, "p": 127, "j": 126, "f": 125, "d": 124 };
            uleb128Encode(sigParam.length, typeSectionBody);
            for (var i = 0; i < sigParam.length; ++i) {
              assert(sigParam[i] in typeCodes, "invalid signature char: " + sigParam[i]);
              typeSectionBody.push(typeCodes[sigParam[i]]);
            }
            if (sigRet == "v") {
              typeSectionBody.push(0);
            } else {
              typeSectionBody.push(1, typeCodes[sigRet]);
            }
            var bytes = [0, 97, 115, 109, 1, 0, 0, 0, 1];
            uleb128Encode(typeSectionBody.length, bytes);
            bytes.push.apply(bytes, typeSectionBody);
            bytes.push(2, 7, 1, 1, 101, 1, 102, 0, 0, 7, 5, 1, 1, 102, 0, 0);
            var module2 = new WebAssembly.Module(new Uint8Array(bytes));
            var instance = new WebAssembly.Instance(module2, { "e": { "f": func } });
            var wrappedFunc = instance.exports["f"];
            return wrappedFunc;
          }
          function updateTableMap(offset, count) {
            if (functionsInTableMap) {
              for (var i = offset; i < offset + count; i++) {
                var item = getWasmTableEntry(i);
                if (item) {
                  functionsInTableMap.set(item, i);
                }
              }
            }
          }
          var functionsInTableMap = void 0;
          var freeTableIndexes = [];
          function getEmptyTableSlot() {
            if (freeTableIndexes.length) {
              return freeTableIndexes.pop();
            }
            try {
              wasmTable.grow(1);
            } catch (err2) {
              if (!(err2 instanceof RangeError)) {
                throw err2;
              }
              throw "Unable to grow wasm table. Set ALLOW_TABLE_GROWTH.";
            }
            return wasmTable.length - 1;
          }
          function setWasmTableEntry(idx, func) {
            wasmTable.set(idx, func);
            wasmTableMirror[idx] = wasmTable.get(idx);
          }
          var ALLOC_STACK = 1;
          function getCFunc(ident) {
            var func = Module["_" + ident];
            assert(func, "Cannot call unknown function " + ident + ", make sure it is exported");
            return func;
          }
          function ccall(ident, returnType, argTypes, args, opts) {
            var toC = { "string": (str) => {
              var ret2 = 0;
              if (str !== null && str !== void 0 && str !== 0) {
                var len = (str.length << 2) + 1;
                ret2 = stackAlloc(len);
                stringToUTF8(str, ret2, len);
              }
              return ret2;
            }, "array": (arr) => {
              var ret2 = stackAlloc(arr.length);
              writeArrayToMemory(arr, ret2);
              return ret2;
            } };
            function convertReturnValue(ret2) {
              if (returnType === "string") {
                return UTF8ToString(ret2);
              }
              if (returnType === "boolean") return Boolean(ret2);
              return ret2;
            }
            var func = getCFunc(ident);
            var cArgs = [];
            var stack = 0;
            assert(returnType !== "array", 'Return type should not be "array".');
            if (args) {
              for (var i = 0; i < args.length; i++) {
                var converter = toC[argTypes[i]];
                if (converter) {
                  if (stack === 0) stack = stackSave();
                  cArgs[i] = converter(args[i]);
                } else {
                  cArgs[i] = args[i];
                }
              }
            }
            var ret = func.apply(null, cArgs);
            function onDone(ret2) {
              if (stack !== 0) stackRestore(stack);
              return convertReturnValue(ret2);
            }
            ret = onDone(ret);
            return ret;
          }
          embind_init_charCodes();
          BindingError = Module["BindingError"] = extendError(Error, "BindingError");
          InternalError = Module["InternalError"] = extendError(Error, "InternalError");
          init_ClassHandle();
          init_embind();
          init_RegisteredPointer();
          UnboundTypeError = Module["UnboundTypeError"] = extendError(Error, "UnboundTypeError");
          init_emval();
          var ASSERTIONS = true;
          function checkIncomingModuleAPI() {
            ignoredModuleProp("fetchSettings");
          }
          var asmLibraryArg = { "__cxa_allocate_exception": ___cxa_allocate_exception, "__cxa_throw": ___cxa_throw, "_embind_register_bigint": __embind_register_bigint, "_embind_register_bool": __embind_register_bool, "_embind_register_class": __embind_register_class, "_embind_register_class_constructor": __embind_register_class_constructor, "_embind_register_class_function": __embind_register_class_function, "_embind_register_emval": __embind_register_emval, "_embind_register_float": __embind_register_float, "_embind_register_integer": __embind_register_integer, "_embind_register_memory_view": __embind_register_memory_view, "_embind_register_std_string": __embind_register_std_string, "_embind_register_std_wstring": __embind_register_std_wstring, "_embind_register_void": __embind_register_void, "abort": _abort, "emscripten_memcpy_big": _emscripten_memcpy_big, "emscripten_resize_heap": _emscripten_resize_heap, "environ_get": _environ_get, "environ_sizes_get": _environ_sizes_get, "fd_close": _fd_close, "fd_seek": _fd_seek, "fd_write": _fd_write, "strftime_l": _strftime_l };
          var asm = createWasm();
          var ___wasm_call_ctors = Module["___wasm_call_ctors"] = createExportWrapper("__wasm_call_ctors");
          var _malloc = Module["_malloc"] = createExportWrapper("malloc");
          var _free = Module["_free"] = createExportWrapper("free");
          var ___getTypeName = Module["___getTypeName"] = createExportWrapper("__getTypeName");
          var __embind_initialize_bindings = Module["__embind_initialize_bindings"] = createExportWrapper("_embind_initialize_bindings");
          var ___errno_location = Module["___errno_location"] = createExportWrapper("__errno_location");
          var _fflush = Module["_fflush"] = createExportWrapper("fflush");
          var _emscripten_stack_init = Module["_emscripten_stack_init"] = function() {
            return (_emscripten_stack_init = Module["_emscripten_stack_init"] = Module["asm"]["emscripten_stack_init"]).apply(null, arguments);
          };
          var _emscripten_stack_get_free = Module["_emscripten_stack_get_free"] = function() {
            return (_emscripten_stack_get_free = Module["_emscripten_stack_get_free"] = Module["asm"]["emscripten_stack_get_free"]).apply(null, arguments);
          };
          var _emscripten_stack_get_base = Module["_emscripten_stack_get_base"] = function() {
            return (_emscripten_stack_get_base = Module["_emscripten_stack_get_base"] = Module["asm"]["emscripten_stack_get_base"]).apply(null, arguments);
          };
          var _emscripten_stack_get_end = Module["_emscripten_stack_get_end"] = function() {
            return (_emscripten_stack_get_end = Module["_emscripten_stack_get_end"] = Module["asm"]["emscripten_stack_get_end"]).apply(null, arguments);
          };
          var stackSave = Module["stackSave"] = createExportWrapper("stackSave");
          var stackRestore = Module["stackRestore"] = createExportWrapper("stackRestore");
          var stackAlloc = Module["stackAlloc"] = createExportWrapper("stackAlloc");
          var ___cxa_is_pointer_type = Module["___cxa_is_pointer_type"] = createExportWrapper("__cxa_is_pointer_type");
          var dynCall_viijii = Module["dynCall_viijii"] = createExportWrapper("dynCall_viijii");
          var dynCall_ji = Module["dynCall_ji"] = createExportWrapper("dynCall_ji");
          var dynCall_jiji = Module["dynCall_jiji"] = createExportWrapper("dynCall_jiji");
          var dynCall_iiiiij = Module["dynCall_iiiiij"] = createExportWrapper("dynCall_iiiiij");
          var dynCall_iiiiijj = Module["dynCall_iiiiijj"] = createExportWrapper("dynCall_iiiiijj");
          var dynCall_iiiiiijj = Module["dynCall_iiiiiijj"] = createExportWrapper("dynCall_iiiiiijj");
          var unexportedRuntimeSymbols = ["run", "UTF8ArrayToString", "UTF8ToString", "stringToUTF8Array", "stringToUTF8", "lengthBytesUTF8", "addOnPreRun", "addOnInit", "addOnPreMain", "addOnExit", "addOnPostRun", "addRunDependency", "removeRunDependency", "FS_createFolder", "FS_createPath", "FS_createDataFile", "FS_createPreloadedFile", "FS_createLazyFile", "FS_createLink", "FS_createDevice", "FS_unlink", "getLEB", "getFunctionTables", "alignFunctionTables", "registerFunctions", "prettyPrint", "getCompilerSetting", "print", "printErr", "callMain", "abort", "keepRuntimeAlive", "wasmMemory", "stackAlloc", "stackSave", "stackRestore", "getTempRet0", "setTempRet0", "writeStackCookie", "checkStackCookie", "ptrToString", "zeroMemory", "stringToNewUTF8", "exitJS", "getHeapMax", "emscripten_realloc_buffer", "ENV", "ERRNO_CODES", "ERRNO_MESSAGES", "setErrNo", "inetPton4", "inetNtop4", "inetPton6", "inetNtop6", "readSockaddr", "writeSockaddr", "DNS", "getHostByName", "Protocols", "Sockets", "getRandomDevice", "warnOnce", "traverseStack", "UNWIND_CACHE", "convertPCtoSourceLocation", "readAsmConstArgsArray", "readAsmConstArgs", "mainThreadEM_ASM", "jstoi_q", "jstoi_s", "getExecutableName", "listenOnce", "autoResumeAudioContext", "dynCallLegacy", "getDynCaller", "dynCall", "handleException", "runtimeKeepalivePush", "runtimeKeepalivePop", "callUserCallback", "maybeExit", "safeSetTimeout", "asmjsMangle", "asyncLoad", "alignMemory", "mmapAlloc", "writeI53ToI64", "writeI53ToI64Clamped", "writeI53ToI64Signaling", "writeI53ToU64Clamped", "writeI53ToU64Signaling", "readI53FromI64", "readI53FromU64", "convertI32PairToI53", "convertI32PairToI53Checked", "convertU32PairToI53", "getCFunc", "ccall", "cwrap", "uleb128Encode", "sigToWasmTypes", "convertJsFunctionToWasm", "freeTableIndexes", "functionsInTableMap", "getEmptyTableSlot", "updateTableMap", "addFunction", "removeFunction", "reallyNegative", "unSign", "strLen", "reSign", "formatString", "setValue", "getValue", "PATH", "PATH_FS", "intArrayFromString", "intArrayToString", "AsciiToString", "stringToAscii", "UTF16Decoder", "UTF16ToString", "stringToUTF16", "lengthBytesUTF16", "UTF32ToString", "stringToUTF32", "lengthBytesUTF32", "allocateUTF8", "allocateUTF8OnStack", "writeStringToMemory", "writeArrayToMemory", "writeAsciiToMemory", "SYSCALLS", "getSocketFromFD", "getSocketAddress", "JSEvents", "registerKeyEventCallback", "specialHTMLTargets", "maybeCStringToJsString", "findEventTarget", "findCanvasEventTarget", "getBoundingClientRect", "fillMouseEventData", "registerMouseEventCallback", "registerWheelEventCallback", "registerUiEventCallback", "registerFocusEventCallback", "fillDeviceOrientationEventData", "registerDeviceOrientationEventCallback", "fillDeviceMotionEventData", "registerDeviceMotionEventCallback", "screenOrientation", "fillOrientationChangeEventData", "registerOrientationChangeEventCallback", "fillFullscreenChangeEventData", "registerFullscreenChangeEventCallback", "JSEvents_requestFullscreen", "JSEvents_resizeCanvasForFullscreen", "registerRestoreOldStyle", "hideEverythingExceptGivenElement", "restoreHiddenElements", "setLetterbox", "currentFullscreenStrategy", "restoreOldWindowedStyle", "softFullscreenResizeWebGLRenderTarget", "doRequestFullscreen", "fillPointerlockChangeEventData", "registerPointerlockChangeEventCallback", "registerPointerlockErrorEventCallback", "requestPointerLock", "fillVisibilityChangeEventData", "registerVisibilityChangeEventCallback", "registerTouchEventCallback", "fillGamepadEventData", "registerGamepadEventCallback", "registerBeforeUnloadEventCallback", "fillBatteryEventData", "battery", "registerBatteryEventCallback", "setCanvasElementSize", "getCanvasElementSize", "demangle", "demangleAll", "jsStackTrace", "stackTrace", "ExitStatus", "getEnvStrings", "checkWasiClock", "flush_NO_FILESYSTEM", "dlopenMissingError", "setImmediateWrapped", "clearImmediateWrapped", "polyfillSetImmediate", "uncaughtExceptionCount", "exceptionLast", "exceptionCaught", "ExceptionInfo", "exception_addRef", "exception_decRef", "Browser", "setMainLoop", "wget", "FS", "MEMFS", "TTY", "PIPEFS", "SOCKFS", "_setNetworkCallback", "tempFixedLengthArray", "miniTempWebGLFloatBuffers", "heapObjectForWebGLType", "heapAccessShiftForWebGLHeap", "GL", "emscriptenWebGLGet", "computeUnpackAlignedImageSize", "emscriptenWebGLGetTexPixelData", "emscriptenWebGLGetUniform", "webglGetUniformLocation", "webglPrepareUniformLocationsBeforeFirstUse", "webglGetLeftBracePos", "emscriptenWebGLGetVertexAttrib", "writeGLArray", "AL", "SDL_unicode", "SDL_ttfContext", "SDL_audio", "SDL", "SDL_gfx", "GLUT", "EGL", "GLFW_Window", "GLFW", "GLEW", "IDBStore", "runAndAbortIfError", "ALLOC_NORMAL", "ALLOC_STACK", "allocate", "InternalError", "BindingError", "UnboundTypeError", "PureVirtualError", "init_embind", "throwInternalError", "throwBindingError", "throwUnboundTypeError", "ensureOverloadTable", "exposePublicSymbol", "replacePublicSymbol", "extendError", "createNamedFunction", "embindRepr", "registeredInstances", "getBasestPointer", "registerInheritedInstance", "unregisterInheritedInstance", "getInheritedInstance", "getInheritedInstanceCount", "getLiveInheritedInstances", "registeredTypes", "awaitingDependencies", "typeDependencies", "registeredPointers", "registerType", "whenDependentTypesAreResolved", "embind_charCodes", "embind_init_charCodes", "readLatin1String", "getTypeName", "heap32VectorToArray", "requireRegisteredType", "getShiftFromSize", "integerReadValueFromPointer", "enumReadValueFromPointer", "floatReadValueFromPointer", "simpleReadValueFromPointer", "runDestructors", "new_", "craftInvokerFunction", "embind__requireFunction", "tupleRegistrations", "structRegistrations", "genericPointerToWireType", "constNoSmartPtrRawPointerToWireType", "nonConstNoSmartPtrRawPointerToWireType", "init_RegisteredPointer", "RegisteredPointer", "RegisteredPointer_getPointee", "RegisteredPointer_destructor", "RegisteredPointer_deleteObject", "RegisteredPointer_fromWireType", "runDestructor", "releaseClassHandle", "finalizationRegistry", "detachFinalizer_deps", "detachFinalizer", "attachFinalizer", "makeClassHandle", "init_ClassHandle", "ClassHandle", "ClassHandle_isAliasOf", "throwInstanceAlreadyDeleted", "ClassHandle_clone", "ClassHandle_delete", "deletionQueue", "ClassHandle_isDeleted", "ClassHandle_deleteLater", "flushPendingDeletes", "delayFunction", "setDelayFunction", "RegisteredClass", "shallowCopyInternalPointer", "downcastPointer", "upcastPointer", "validateThis", "char_0", "char_9", "makeLegalFunctionName", "emval_handle_array", "emval_free_list", "emval_symbols", "init_emval", "count_emval_handles", "get_first_emval", "getStringOrSymbol", "Emval", "emval_newers", "craftEmvalAllocator", "emval_get_global", "emval_lookupTypes", "emval_allocateDestructors", "emval_methodCallers", "emval_addMethodCaller", "emval_registeredMethods"];
          unexportedRuntimeSymbols.forEach(unexportedRuntimeSymbol);
          var missingLibrarySymbols = ["ptrToString", "zeroMemory", "stringToNewUTF8", "exitJS", "setErrNo", "inetPton4", "inetNtop4", "inetPton6", "inetNtop6", "readSockaddr", "writeSockaddr", "getHostByName", "getRandomDevice", "traverseStack", "convertPCtoSourceLocation", "readAsmConstArgs", "mainThreadEM_ASM", "jstoi_q", "jstoi_s", "listenOnce", "autoResumeAudioContext", "runtimeKeepalivePush", "runtimeKeepalivePop", "callUserCallback", "maybeExit", "safeSetTimeout", "asmjsMangle", "asyncLoad", "alignMemory", "mmapAlloc", "writeI53ToI64", "writeI53ToI64Clamped", "writeI53ToI64Signaling", "writeI53ToU64Clamped", "writeI53ToU64Signaling", "readI53FromI64", "readI53FromU64", "convertI32PairToI53", "convertU32PairToI53", "reallyNegative", "unSign", "strLen", "reSign", "formatString", "getSocketFromFD", "getSocketAddress", "registerKeyEventCallback", "maybeCStringToJsString", "findEventTarget", "findCanvasEventTarget", "getBoundingClientRect", "fillMouseEventData", "registerMouseEventCallback", "registerWheelEventCallback", "registerUiEventCallback", "registerFocusEventCallback", "fillDeviceOrientationEventData", "registerDeviceOrientationEventCallback", "fillDeviceMotionEventData", "registerDeviceMotionEventCallback", "screenOrientation", "fillOrientationChangeEventData", "registerOrientationChangeEventCallback", "fillFullscreenChangeEventData", "registerFullscreenChangeEventCallback", "JSEvents_requestFullscreen", "JSEvents_resizeCanvasForFullscreen", "registerRestoreOldStyle", "hideEverythingExceptGivenElement", "restoreHiddenElements", "setLetterbox", "softFullscreenResizeWebGLRenderTarget", "doRequestFullscreen", "fillPointerlockChangeEventData", "registerPointerlockChangeEventCallback", "registerPointerlockErrorEventCallback", "requestPointerLock", "fillVisibilityChangeEventData", "registerVisibilityChangeEventCallback", "registerTouchEventCallback", "fillGamepadEventData", "registerGamepadEventCallback", "registerBeforeUnloadEventCallback", "fillBatteryEventData", "battery", "registerBatteryEventCallback", "setCanvasElementSize", "getCanvasElementSize", "checkWasiClock", "setImmediateWrapped", "clearImmediateWrapped", "polyfillSetImmediate", "exception_addRef", "exception_decRef", "setMainLoop", "_setNetworkCallback", "heapObjectForWebGLType", "heapAccessShiftForWebGLHeap", "emscriptenWebGLGet", "computeUnpackAlignedImageSize", "emscriptenWebGLGetTexPixelData", "emscriptenWebGLGetUniform", "webglGetUniformLocation", "webglPrepareUniformLocationsBeforeFirstUse", "webglGetLeftBracePos", "emscriptenWebGLGetVertexAttrib", "writeGLArray", "SDL_unicode", "SDL_ttfContext", "SDL_audio", "GLFW_Window", "runAndAbortIfError", "registerInheritedInstance", "unregisterInheritedInstance", "requireRegisteredType", "enumReadValueFromPointer", "validateThis", "getStringOrSymbol", "craftEmvalAllocator", "emval_get_global", "emval_lookupTypes", "emval_allocateDestructors", "emval_addMethodCaller"];
          missingLibrarySymbols.forEach(missingLibrarySymbol);
          var calledRun;
          dependenciesFulfilled = function runCaller() {
            if (!calledRun) run();
            if (!calledRun) dependenciesFulfilled = runCaller;
          };
          function stackCheckInit() {
            _emscripten_stack_init();
            writeStackCookie();
          }
          function run(args) {
            args = args || arguments_;
            if (runDependencies > 0) {
              return;
            }
            stackCheckInit();
            preRun();
            if (runDependencies > 0) {
              return;
            }
            function doRun() {
              if (calledRun) return;
              calledRun = true;
              Module["calledRun"] = true;
              if (ABORT) return;
              initRuntime();
              readyPromiseResolve(Module);
              if (Module["onRuntimeInitialized"]) Module["onRuntimeInitialized"]();
              assert(!Module["_main"], 'compiled without a main, but one is present. if you added it from JS, use Module["onRuntimeInitialized"]');
              postRun();
            }
            if (Module["setStatus"]) {
              Module["setStatus"]("Running...");
              setTimeout(function() {
                setTimeout(function() {
                  Module["setStatus"]("");
                }, 1);
                doRun();
              }, 1);
            } else {
              doRun();
            }
            checkStackCookie();
          }
          if (Module["preInit"]) {
            if (typeof Module["preInit"] == "function") Module["preInit"] = [Module["preInit"]];
            while (Module["preInit"].length > 0) {
              Module["preInit"].pop()();
            }
          }
          run();
          return createLazPerf3.ready;
        });
      })();
      if (typeof exports === "object" && typeof module === "object")
        module.exports = createLazPerf2;
      else if (typeof define === "function" && define["amd"])
        define([], function() {
          return createLazPerf2;
        });
      else if (typeof exports === "object")
        exports["createLazPerf"] = createLazPerf2;
    }
  });

  // node_modules/laz-perf/lib/web/index.js
  var require_web = __commonJS({
    "node_modules/laz-perf/lib/web/index.js"(exports) {
      "use strict";
      var __importDefault = exports && exports.__importDefault || function(mod) {
        return mod && mod.__esModule ? mod : { "default": mod };
      };
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.LazPerf = exports.create = exports.createLazPerf = void 0;
      var laz_perf_js_1 = __importDefault(require_laz_perf());
      exports.createLazPerf = laz_perf_js_1.default;
      exports.create = laz_perf_js_1.default;
      exports.LazPerf = { create: laz_perf_js_1.default };
    }
  });

  // node_modules/copc/lib/las/point-data.js
  var require_point_data = __commonJS({
    "node_modules/copc/lib/las/point-data.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.decompressFile = exports.decompressChunk = exports.PointData = void 0;
      var laz_perf_1 = require_web();
      var header_1 = require_header();
      exports.PointData = { createLazPerf: laz_perf_1.createLazPerf, decompressChunk, decompressFile };
      var ourLazPerfPromise = void 0;
      async function getLazPerf(suppliedLazPerf) {
        if (suppliedLazPerf)
          return suppliedLazPerf;
        if (!ourLazPerfPromise)
          ourLazPerfPromise = (0, laz_perf_1.createLazPerf)();
        return ourLazPerfPromise;
      }
      async function decompressChunk(compressed, { pointCount, pointDataRecordFormat, pointDataRecordLength }, suppliedLazPerf) {
        const LazPerf = await getLazPerf(suppliedLazPerf);
        const outBuffer = new Uint8Array(pointCount * pointDataRecordLength);
        const blobPointer = LazPerf._malloc(compressed.byteLength);
        const dataPointer = LazPerf._malloc(pointDataRecordLength);
        const decoder = new LazPerf.ChunkDecoder();
        try {
          LazPerf.HEAPU8.set(new Uint8Array(compressed.buffer, compressed.byteOffset, compressed.byteLength), blobPointer);
          decoder.open(pointDataRecordFormat, pointDataRecordLength, blobPointer);
          for (let i = 0; i < pointCount; ++i) {
            decoder.getPoint(dataPointer);
            outBuffer.set(new Uint8Array(LazPerf.HEAPU8.buffer, dataPointer, pointDataRecordLength), i * pointDataRecordLength);
          }
        } finally {
          LazPerf._free(blobPointer);
          LazPerf._free(dataPointer);
          decoder.delete();
        }
        return outBuffer;
      }
      exports.decompressChunk = decompressChunk;
      async function decompressFile(file, suppliedLazPerf) {
        const LazPerf = await getLazPerf(suppliedLazPerf);
        const header = header_1.Header.parse(file);
        const { pointCount, pointDataRecordLength } = header;
        const outBuffer = new Uint8Array(pointCount * pointDataRecordLength);
        const blobPointer = LazPerf._malloc(file.byteLength);
        const dataPointer = LazPerf._malloc(pointDataRecordLength);
        const reader = new LazPerf.LASZip();
        try {
          LazPerf.HEAPU8.set(new Uint8Array(file.buffer, file.byteOffset, file.byteLength), blobPointer);
          reader.open(blobPointer, file.byteLength);
          for (let i = 0; i < pointCount; ++i) {
            reader.getPoint(dataPointer);
            outBuffer.set(new Uint8Array(LazPerf.HEAPU8.buffer, dataPointer, pointDataRecordLength), i * pointDataRecordLength);
          }
        } finally {
          reader.delete();
        }
        return outBuffer;
      }
      exports.decompressFile = decompressFile;
    }
  });

  // node_modules/copc/lib/las/view.js
  var require_view = __commonJS({
    "node_modules/copc/lib/las/view.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.View = void 0;
      var utils_1 = require_utils();
      var dimensions_1 = require_dimensions();
      var extractor_1 = require_extractor();
      exports.View = { create };
      function create(buffer, header, eb = [], include) {
        let extractors = extractor_1.Extractor.create(header, eb);
        if (include) {
          const set = /* @__PURE__ */ new Set([...include]);
          extractors = Object.entries(extractors).reduce((extractors2, [name, getter2]) => {
            if (set.has(name))
              extractors2[name] = getter2;
            return extractors2;
          }, {});
        }
        const dimensions = dimensions_1.Dimensions.create(extractors, eb);
        const dv = utils_1.Binary.toDataView(buffer);
        const pointLength = header.pointDataRecordLength;
        if (dv.byteLength % pointLength !== 0) {
          throw new Error(`Invalid buffer length (${dv.byteLength}) for point length ${pointLength}`);
        }
        const pointCount = dv.byteLength / header.pointDataRecordLength;
        function getter(name) {
          const extractor = extractors[name];
          if (!extractor)
            throw new Error(`No extractor for dimension: ${name}`);
          return function(index) {
            if (index >= pointCount) {
              throw new RangeError(`View index (${index}) out of range: ${pointCount}`);
            }
            return extractor(dv, index);
          };
        }
        return { pointCount, dimensions, getter };
      }
    }
  });

  // node_modules/copc/lib/las/vlr.js
  var require_vlr = __commonJS({
    "node_modules/copc/lib/las/vlr.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.Vlr = void 0;
      var utils_1 = require_utils();
      var constants_1 = require_constants2();
      exports.Vlr = { walk, parse, find, at, fetch: fetch2 };
      function find(vlrs, userId, recordId) {
        return vlrs.find((v) => v.userId === userId && v.recordId === recordId);
      }
      function at(vlrs, userId, recordId) {
        const vlr = find(vlrs, userId, recordId);
        if (!vlr)
          throw new Error(`VLR not found: ${userId}/${recordId}`);
        return vlr;
      }
      function fetch2(filename, { contentOffset, contentLength }) {
        if (contentLength === 0)
          return new Uint8Array();
        const get = utils_1.Getter.create(filename);
        return get(contentOffset, contentOffset + contentLength);
      }
      async function walk(filename, header) {
        const get = utils_1.Getter.create(filename);
        const vlrs = await doWalk({
          get,
          startOffset: header.headerLength,
          count: header.vlrCount,
          isExtended: false
        });
        const evlrs = await doWalk({
          get,
          startOffset: header.evlrOffset,
          count: header.evlrCount,
          isExtended: true
        });
        return [...vlrs, ...evlrs];
      }
      function parse(buffer, isExtended) {
        return (isExtended ? parseExtended : parseNormal)(buffer);
      }
      function parseNormal(buffer) {
        const dv = utils_1.Binary.toDataView(buffer);
        if (dv.byteLength !== constants_1.vlrHeaderLength) {
          throw new Error(`Invalid VLR header length (must be ${constants_1.vlrHeaderLength}): ${dv.byteLength}`);
        }
        return {
          userId: utils_1.Binary.toCString(buffer.slice(2, 18)),
          recordId: dv.getUint16(18, true),
          contentLength: dv.getUint16(20, true),
          description: utils_1.Binary.toCString(buffer.slice(22, 54)),
          isExtended: false
        };
      }
      function parseExtended(buffer) {
        const dv = utils_1.Binary.toDataView(buffer);
        if (dv.byteLength !== constants_1.evlrHeaderLength) {
          throw new Error(`Invalid EVLR header length (must be ${constants_1.evlrHeaderLength}): ${dv.byteLength}`);
        }
        return {
          userId: utils_1.Binary.toCString(buffer.slice(2, 18)),
          recordId: dv.getUint16(18, true),
          contentLength: (0, utils_1.parseBigInt)((0, utils_1.getBigUint64)(dv, 20, true)),
          description: utils_1.Binary.toCString(buffer.slice(28, 60)),
          isExtended: true
        };
      }
      async function doWalk({ get, startOffset, count, isExtended }) {
        const vlrs = [];
        let pos = startOffset;
        const length = isExtended ? constants_1.evlrHeaderLength : constants_1.vlrHeaderLength;
        for (let i = 0; i < count; ++i) {
          const buffer = length ? await get(pos, pos + length) : new Uint8Array();
          const { userId, recordId, contentLength, description } = parse(buffer, isExtended);
          vlrs.push({
            userId,
            recordId,
            contentOffset: pos + length,
            contentLength,
            description,
            isExtended
          });
          pos += length + contentLength;
        }
        return vlrs;
      }
    }
  });

  // node_modules/copc/lib/las/index.js
  var require_las = __commonJS({
    "node_modules/copc/lib/las/index.js"(exports) {
      "use strict";
      var __createBinding = exports && exports.__createBinding || (Object.create ? (function(o, m, k, k2) {
        if (k2 === void 0) k2 = k;
        var desc = Object.getOwnPropertyDescriptor(m, k);
        if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
          desc = { enumerable: true, get: function() {
            return m[k];
          } };
        }
        Object.defineProperty(o, k2, desc);
      }) : (function(o, m, k, k2) {
        if (k2 === void 0) k2 = k;
        o[k2] = m[k];
      }));
      var __setModuleDefault = exports && exports.__setModuleDefault || (Object.create ? (function(o, v) {
        Object.defineProperty(o, "default", { enumerable: true, value: v });
      }) : function(o, v) {
        o["default"] = v;
      });
      var __importStar = exports && exports.__importStar || function(mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) {
          for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
        }
        __setModuleDefault(result, mod);
        return result;
      };
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.Vlr = exports.View = exports.PointData = exports.Header = exports.Extractor = exports.ExtraBytes = exports.Dimensions = exports.Constants = void 0;
      exports.Constants = __importStar(require_constants2());
      var dimensions_1 = require_dimensions();
      Object.defineProperty(exports, "Dimensions", { enumerable: true, get: function() {
        return dimensions_1.Dimensions;
      } });
      var extra_bytes_1 = require_extra_bytes();
      Object.defineProperty(exports, "ExtraBytes", { enumerable: true, get: function() {
        return extra_bytes_1.ExtraBytes;
      } });
      var extractor_1 = require_extractor();
      Object.defineProperty(exports, "Extractor", { enumerable: true, get: function() {
        return extractor_1.Extractor;
      } });
      var header_1 = require_header();
      Object.defineProperty(exports, "Header", { enumerable: true, get: function() {
        return header_1.Header;
      } });
      var point_data_1 = require_point_data();
      Object.defineProperty(exports, "PointData", { enumerable: true, get: function() {
        return point_data_1.PointData;
      } });
      var view_1 = require_view();
      Object.defineProperty(exports, "View", { enumerable: true, get: function() {
        return view_1.View;
      } });
      var vlr_1 = require_vlr();
      Object.defineProperty(exports, "Vlr", { enumerable: true, get: function() {
        return vlr_1.Vlr;
      } });
    }
  });

  // node_modules/copc/lib/copc/hierarchy.js
  var require_hierarchy2 = __commonJS({
    "node_modules/copc/lib/copc/hierarchy.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.Hierarchy = void 0;
      var utils_1 = require_utils();
      var constants_1 = require_constants();
      exports.Hierarchy = { parse, load };
      function parse(buffer) {
        const dv = utils_1.Binary.toDataView(buffer);
        if (dv.byteLength % constants_1.hierarchyItemLength !== 0) {
          throw new Error(`Invalid hierarchy page length: ${dv.byteLength}`);
        }
        const nodes = {};
        const pages = {};
        for (let i = 0; i < dv.byteLength; i += constants_1.hierarchyItemLength) {
          const d = dv.getInt32(i + 0, true);
          const x = dv.getInt32(i + 4, true);
          const y = dv.getInt32(i + 8, true);
          const z = dv.getInt32(i + 12, true);
          const offset = (0, utils_1.parseBigInt)((0, utils_1.getBigUint64)(dv, i + 16, true));
          const length = dv.getInt32(i + 24, true);
          const pointCount = dv.getInt32(i + 28, true);
          const key = utils_1.Key.toString([d, x, y, z]);
          if (pointCount < -1) {
            throw new Error(`Invalid hierarchy point count at key: ${key}`);
          } else if (pointCount === -1) {
            pages[key] = {
              pageOffset: offset,
              pageLength: length
            };
          } else {
            nodes[key] = {
              pointCount,
              pointDataOffset: offset,
              pointDataLength: length
            };
          }
        }
        return { nodes, pages };
      }
      async function load(filename, page) {
        const get = utils_1.Getter.create(filename);
        return parse(await get(page.pageOffset, page.pageOffset + page.pageLength));
      }
    }
  });

  // node_modules/copc/lib/copc/info.js
  var require_info = __commonJS({
    "node_modules/copc/lib/copc/info.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.Info = void 0;
      var utils_1 = require_utils();
      var constants_1 = require_constants();
      exports.Info = { parse };
      function parse(buffer) {
        const dv = utils_1.Binary.toDataView(buffer);
        if (dv.byteLength !== constants_1.infoLength) {
          throw new Error(`Invalid COPC info VLR length (should be ${constants_1.infoLength}): ${dv.byteLength}`);
        }
        const center = [
          dv.getFloat64(0, true),
          dv.getFloat64(8, true),
          dv.getFloat64(16, true)
        ];
        const radius = dv.getFloat64(24, true);
        return {
          cube: [
            center[0] - radius,
            center[1] - radius,
            center[2] - radius,
            center[0] + radius,
            center[1] + radius,
            center[2] + radius
          ],
          spacing: dv.getFloat64(32, true),
          rootHierarchyPage: {
            pageOffset: (0, utils_1.parseBigInt)((0, utils_1.getBigUint64)(dv, 40, true)),
            pageLength: (0, utils_1.parseBigInt)((0, utils_1.getBigUint64)(dv, 48, true))
          },
          gpsTimeRange: [dv.getFloat64(56, true), dv.getFloat64(64, true)]
        };
      }
    }
  });

  // node_modules/copc/lib/copc/copc.js
  var require_copc = __commonJS({
    "node_modules/copc/lib/copc/copc.js"(exports) {
      "use strict";
      var __createBinding = exports && exports.__createBinding || (Object.create ? (function(o, m, k, k2) {
        if (k2 === void 0) k2 = k;
        var desc = Object.getOwnPropertyDescriptor(m, k);
        if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
          desc = { enumerable: true, get: function() {
            return m[k];
          } };
        }
        Object.defineProperty(o, k2, desc);
      }) : (function(o, m, k, k2) {
        if (k2 === void 0) k2 = k;
        o[k2] = m[k];
      }));
      var __setModuleDefault = exports && exports.__setModuleDefault || (Object.create ? (function(o, v) {
        Object.defineProperty(o, "default", { enumerable: true, value: v });
      }) : function(o, v) {
        o["default"] = v;
      });
      var __importStar = exports && exports.__importStar || function(mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) {
          for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
        }
        __setModuleDefault(result, mod);
        return result;
      };
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.Copc = void 0;
      var Las2 = __importStar(require_las());
      var utils_1 = require_utils();
      var hierarchy_1 = require_hierarchy2();
      var info_1 = require_info();
      exports.Copc = {
        create,
        loadHierarchyPage,
        loadCompressedPointDataBuffer,
        loadPointDataBuffer,
        loadPointDataView
      };
      async function create(filename) {
        const getRemote = utils_1.Getter.create(filename);
        const length = 65536;
        const promise = getRemote(0, length);
        async function get(begin, end) {
          if (end >= length)
            return getRemote(begin, end);
          const head = await promise;
          return head.slice(begin, end);
        }
        const header = Las2.Header.parse(await get(0, Las2.Constants.minHeaderLength));
        const vlrs = await Las2.Vlr.walk(get, header);
        const infoVlr = Las2.Vlr.find(vlrs, "copc", 1);
        if (!infoVlr)
          throw new Error("COPC info VLR is required");
        const info = info_1.Info.parse(await Las2.Vlr.fetch(get, infoVlr));
        let wkt;
        const wktVlr = Las2.Vlr.find(vlrs, "LASF_Projection", 2112);
        if (wktVlr && wktVlr.contentLength) {
          wkt = utils_1.Binary.toCString(await Las2.Vlr.fetch(get, wktVlr));
          if (wkt === "")
            wkt = void 0;
        }
        let eb = [];
        const ebVlr = Las2.Vlr.find(vlrs, "LASF_Spec", 4);
        if (ebVlr)
          eb = Las2.ExtraBytes.parse(await Las2.Vlr.fetch(get, ebVlr));
        return { header, vlrs, info, wkt, eb };
      }
      async function loadHierarchyPage(filename, page) {
        const get = utils_1.Getter.create(filename);
        return hierarchy_1.Hierarchy.load(get, page);
      }
      async function loadCompressedPointDataBuffer(filename, { pointDataOffset, pointDataLength }) {
        const get = utils_1.Getter.create(filename);
        return get(pointDataOffset, pointDataOffset + pointDataLength);
      }
      async function loadPointDataBuffer(filename, { pointDataRecordFormat, pointDataRecordLength }, node, lazPerf) {
        const compressed = await loadCompressedPointDataBuffer(filename, node);
        const { pointCount } = node;
        return Las2.PointData.decompressChunk(compressed, { pointCount, pointDataRecordFormat, pointDataRecordLength }, lazPerf);
      }
      async function loadPointDataView(filename, copc, node, { lazPerf, include } = {}) {
        const buffer = await loadPointDataBuffer(filename, copc.header, node, lazPerf);
        return Las2.View.create(buffer, copc.header, copc.eb, include);
      }
    }
  });

  // node_modules/copc/lib/copc/index.js
  var require_copc2 = __commonJS({
    "node_modules/copc/lib/copc/index.js"(exports) {
      "use strict";
      var __createBinding = exports && exports.__createBinding || (Object.create ? (function(o, m, k, k2) {
        if (k2 === void 0) k2 = k;
        var desc = Object.getOwnPropertyDescriptor(m, k);
        if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
          desc = { enumerable: true, get: function() {
            return m[k];
          } };
        }
        Object.defineProperty(o, k2, desc);
      }) : (function(o, m, k, k2) {
        if (k2 === void 0) k2 = k;
        o[k2] = m[k];
      }));
      var __setModuleDefault = exports && exports.__setModuleDefault || (Object.create ? (function(o, v) {
        Object.defineProperty(o, "default", { enumerable: true, value: v });
      }) : function(o, v) {
        o["default"] = v;
      });
      var __importStar = exports && exports.__importStar || function(mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) {
          for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
        }
        __setModuleDefault(result, mod);
        return result;
      };
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.Info = exports.Hierarchy = exports.Copc = exports.Constants = void 0;
      exports.Constants = __importStar(require_constants());
      var copc_1 = require_copc();
      Object.defineProperty(exports, "Copc", { enumerable: true, get: function() {
        return copc_1.Copc;
      } });
      var hierarchy_1 = require_hierarchy2();
      Object.defineProperty(exports, "Hierarchy", { enumerable: true, get: function() {
        return hierarchy_1.Hierarchy;
      } });
      var info_1 = require_info();
      Object.defineProperty(exports, "Info", { enumerable: true, get: function() {
        return info_1.Info;
      } });
    }
  });

  // node_modules/copc/lib/index.js
  var require_lib = __commonJS({
    "node_modules/copc/lib/index.js"(exports) {
      "use strict";
      var __createBinding = exports && exports.__createBinding || (Object.create ? (function(o, m, k, k2) {
        if (k2 === void 0) k2 = k;
        var desc = Object.getOwnPropertyDescriptor(m, k);
        if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
          desc = { enumerable: true, get: function() {
            return m[k];
          } };
        }
        Object.defineProperty(o, k2, desc);
      }) : (function(o, m, k, k2) {
        if (k2 === void 0) k2 = k;
        o[k2] = m[k];
      }));
      var __setModuleDefault = exports && exports.__setModuleDefault || (Object.create ? (function(o, v) {
        Object.defineProperty(o, "default", { enumerable: true, value: v });
      }) : function(o, v) {
        o["default"] = v;
      });
      var __importStar = exports && exports.__importStar || function(mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) {
          for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
        }
        __setModuleDefault(result, mod);
        return result;
      };
      var __exportStar = exports && exports.__exportStar || function(m, exports2) {
        for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports2, p)) __createBinding(exports2, m, p);
      };
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.Las = exports.Ept = void 0;
      exports.Ept = __importStar(require_ept2());
      __exportStar(require_copc2(), exports);
      exports.Las = __importStar(require_las());
      __exportStar(require_utils(), exports);
    }
  });

  // app.src.mjs
  var import_copc = __toESM(require_lib(), 1);
  var import_web = __toESM(require_web(), 1);
  window.CopcDemo = { Copc: import_copc.Copc, Getter: import_copc.Getter, Las: import_copc.Las, createLazPerf: import_web.createLazPerf };
})();

var dataview2 = require("dataview2");

var self = {};

function encoder() {
  self.onmessage = function(e) {
    if (e.data.type === "encode") {
      self.encode(e.data.callbackId, e.data.audioData, e.data.format);
    }
  };

  self.encode = function(callbackId, audioData, format) {
    function successCallback(buffer) {
      self.postMessage({
        type: "encoded",
        callbackId: callbackId,
        buffer: buffer,
      }, [ buffer ]);
    }

    function errorCallback(err) {
      self.postMessage({
        type: "error",
        callbackId: callbackId,
        message: err.message,
      });
    }

    self.encodeWav(audioData, format).then(successCallback, errorCallback);
  };

  self.encodeWav = function(audioData, format) {
    format.floatingPoint = !!format.floatingPoint;
    format.bitDepth = (format.bitDepth|0) || 16;

    return new Promise(function(resolve) {
      var numberOfChannels = audioData.numberOfChannels;
      var sampleRate = audioData.sampleRate;
      var bytes = format.bitDepth >> 3;
      var length = audioData.length * numberOfChannels * bytes;
      var writer = new BufferWriter(44 + length);

      writer.writeString("RIFF"); // RIFF header
      writer.writeUint32(writer.length - 8); // file length
      writer.writeString("WAVE"); // RIFF Type

      writer.writeString("fmt "); // format chunk identifier
      writer.writeUint32(16);     // format chunk length
      writer.writeUint16(format.floatingPoint ? 0x0003 : 0x0001); // format (PCM)
      writer.writeUint16(numberOfChannels); // number of channels
      writer.writeUint32(sampleRate);       // sample rate
      writer.writeUint32(sampleRate * numberOfChannels * bytes); // byte rate
      writer.writeUint16(numberOfChannels * bytes); // block size
      writer.writeUint16(format.bitDepth); // bits per sample

      writer.writeString("data"); // data chunk identifier
      writer.writeUint32(length); // data chunk length

      var channelData = audioData.buffers.map(function(buffer) {
        return new Float32Array(buffer);
      });

      writer.writePCM(channelData, format);

      resolve(writer.buffer);
    });
  };

  function BufferWriter(length) {
    if (typeof dataview2 !== "undefined") {
      this.buffer = new dataview2.Buffer2(length);
      this.view = new dataview2.DataView2(this.buffer);
    } else {
      this.buffer = new ArrayBuffer(length);
      this.view = new DataView(this.buffer);
    }
    this.length = length;
    this.pos = 0;
  }

  BufferWriter.prototype.writeUint8 = function(data) {
    this.view.setUint8(this.pos, data);
    this.pos += 1;
  };

  BufferWriter.prototype.writeUint16 = function(data) {
    this.view.setUint16(this.pos, data, true);
    this.pos += 2;
  };

  BufferWriter.prototype.writeUint32 = function(data) {
    this.view.setUint32(this.pos, data, true);
    this.pos += 4;
  };

  BufferWriter.prototype.writeString = function(data) {
    for (var i = 0; i < data.length; i++) {
      this.writeUint8(data.charCodeAt(i));
    }
  };

  BufferWriter.prototype.writePCM8 = function(x) {
    x = Math.max(-128, Math.min(x * 128, 127))|0;
    this.view.setInt8(this.pos, x);
    this.pos += 1;
  };

  BufferWriter.prototype.writePCM16 = function(x) {
    x = Math.max(-32768, Math.min(x * 32768, 32767))|0;
    this.view.setInt16(this.pos, x, true);
    this.pos += 2;
  };

  BufferWriter.prototype.writePCM24 = function(x) {
    x = Math.max(-8388608, Math.min(x * 8388608, 8388607))|0;
    this.view.setUint8(this.pos + 0, (x >>  0) & 0xff);
    this.view.setUint8(this.pos + 1, (x >>  8) & 0xff);
    this.view.setUint8(this.pos + 2, (x >> 16) & 0xff);
    this.pos += 3;
  };

  BufferWriter.prototype.writePCM32 = function(x) {
    x = Math.max(-2147483648, Math.min(x * 2147483648, 2147483647))|0;
    this.view.setInt32(this.pos, x, true);
    this.pos += 4;
  };

  BufferWriter.prototype.writePCM32F = function(x) {
    this.view.setFloat32(this.pos, x, true);
    this.pos += 4;
  };

  BufferWriter.prototype.writePCM64F = function(x) {
    this.view.setFloat64(this.pos, x, true);
    this.pos += 8;
  };

  BufferWriter.prototype.writePCM = function(channelData, format) {
    var length = channelData[0].length;
    var numberOfChannels = channelData.length;
    var method = "writePCM" + format.bitDepth;

    if (format.floatingPoint) {
      method += "F";
    }

    if (!this[method]) {
      throw new Error("not suppoerted bit depth " + format.bitDepth);
    }

    for (var i = 0; i < length; i++) {
      for (var ch = 0; ch < numberOfChannels; ch++) {
        this[method](channelData[ch][i]);
      }
    }
  };

  self.BufferWriter = BufferWriter;
}

encoder.self = encoder.util = self;

module.exports = encoder;

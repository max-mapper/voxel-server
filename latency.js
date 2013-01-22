function AverageLatency(duplexEventEmitter, cb) {
  this.emitter = duplexEventEmitter
  this.samples = []
  this.numSamples = 30
  this.latency = 0
  this.interval = 300
  if (cb) this.cb = cb
  var self = this;
  this.emitter.on('pong', function (data) {
    self.samples.push(Date.now() - data.time)
    if (self.samples.length >= self.numSamples) {
      self.samples.splice(0,1)
    }
    self.updateLatency()
    self.sample()
  })
  this.sample()
}

AverageLatency.prototype.sample = function () {
  var self = this;
  setTimeout(function () {
    self.emitter.emit('ping', {time: Date.now()})
  }, this.interval)
}

AverageLatency.prototype.updateLatency = function () {
  this.latency = eval(this.samples.join('+'))/this.samples.length
  if (this.cb) this.cb(this.latency)
}

module.exports = AverageLatency
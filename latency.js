function AverageLatency(duplexEventEmitter, cb) {
  this.emitter = duplexEventEmitter
  this.samples = []
  this.numSamples = 15
  this.latency = 0
  this.interval = 300
  if (cb) this.cb = cb
  var self = this;
  this.emitter.on('pong', function (data) {
    self.samples.push(Date.now() - data.time)
    self.updateLatency()
    self.sample()
  })
  this.sample()
}

AverageLatency.prototype.sample = function () {
  var self = this;
  if (this.numSamples > 0) {
    this.numSamples--
    setTimeout(function () {
      self.emitter.emit('ping', {time: Date.now()})
    }, this.interval)
  } else {
    if (this.cb) this.cb(this.latency)
  }
}

AverageLatency.prototype.updateLatency = function () {
  this.latency = eval(this.samples.join('+'))/this.samples.length
}

module.exports = AverageLatency
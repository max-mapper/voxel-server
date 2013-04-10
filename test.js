var server = require('./')()
var port = 8080
server.listen(port)
var websocketStream = require('websocket-stream')
var WebSocket = require('ws')
var ws = new WebSocket('ws://localhost:8080')
var wsStream = websocketStream(ws)
var duplexEmitter = require('duplex-emitter')
var client = duplexEmitter(wsStream)

client.on('id', function(id) {
  console.log('got id:', id)
})

client.on('settings', function(settings) {
  console.log('got settings:', settings)
})

ws.on('open', function() {
  client.emit('created')
})

client.on('chunk', function(chunk) {
  console.log('got initial chunk')
})

client.on('noMoreChunks', function() {
  console.log('all done')
  process.exit()
})

var http = require('http')
var ecstatic = require('ecstatic')
var WebSocketServer = require('ws').Server
var websocket = require('websocket-stream')
var duplexEmitter = require('duplex-emitter')
var path = require('path')
var uuid = require('hat')

var server = http.createServer(ecstatic(path.join(__dirname, 'www')))
var wss = new WebSocketServer({server: server})
var clients = {}

function broadcast(id, cmd, pos, val) {
  console.log(id, 'broadcasting', pos, val)
  Object.keys(clients).map(function(client) {
    if (client === id) return
    clients[client].emit(cmd, pos, val)
  })
}

wss.on('connection', function(ws) {
  var stream = websocket(ws)
  var emitter = duplexEmitter(stream)
  var id = uuid()
  clients[id] = emitter
  console.log(id, 'joined')
  stream.once('end', leave)
  stream.once('error', leave)
  function leave() {
    delete clients.id
    console.log(id, 'left')
  }
  emitter.on('set', function(pos, val) {
    broadcast(id, 'set', pos, val)
  })
  emitter.on('create', function(pos, val) {
    broadcast(id, 'create', pos, val)
  })

})

server.listen(8080)
console.log('Listening on :8080, open http://localhost:8080')

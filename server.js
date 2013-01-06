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

function broadcast(id, cmd, arg1, arg2) {
  console.log(id, 'broadcasting', cmd, arg1 ? arg1 : '', arg2 ? arg2 : '')
  Object.keys(clients).map(function(client) {
    if (client === id) return
    clients[client].emit(cmd, arg1, arg2)
  })
}

wss.on('connection', function(ws) {
  var stream = websocket(ws)
  var emitter = duplexEmitter(stream)
  var id = uuid()
  clients[id] = emitter
  console.log(id, 'joined')
  broadcast(id, 'join', id)
  stream.once('end', leave)
  stream.once('error', leave)
  function leave() {
    delete clients.id
    console.log(id, 'left')
    broadcast(id, 'leave', id)
  }
  emitter.on('set', function(pos, val) {
    broadcast(id, 'set', pos, val)
  })
  emitter.on('create', function(pos, val) {
    broadcast(id, 'create', pos, val)
  })
  emitter.on('position', function(pos) {
    broadcast(id, 'position', id, pos)
  })

})

var port = process.argv[2] || 8080
server.listen(port)
console.log('Listening on ', port, ' open http://localhost:', port)

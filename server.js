var http = require('http')
var ecstatic = require('ecstatic')
var WebSocketServer = require('ws').Server
var websocket = require('websocket-stream')
var emitStream = require('emit-stream')
var events = require('events')
var JSONStream = require('JSONStream')
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
  var outgoing = new events.EventEmitter()
  var id = uuid()
  clients[id] = outgoing
  console.log(id, 'joined')
  emitStream(outgoing).pipe(JSONStream.stringify()).pipe(stream)
  var incoming = emitStream(stream.pipe(JSONStream.parse([true])))
  stream.once('end', cleanup)
  stream.once('error', cleanup)
  function cleanup() {
    delete clients.id
    console.log(id, 'left')
  }
  incoming.on('set', function(pos, val) {
    broadcast(id, 'set', pos, val)
  })
  incoming.on('create', function(pos, val) {
    broadcast(id, 'create', pos, val)
  })

})

server.listen(8080)
console.log('Listening on :8080, open http://localhost:8080')

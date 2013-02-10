var http = require('http')
var ecstatic = require('ecstatic')
var WebSocketServer = require('ws').Server
var websocket = require('websocket-stream')
var duplexEmitter = require('duplex-emitter')
var MuxDemux = require('mux-demux')
var Scuttlebutt = require('scuttlebutt/model')
var playerPhysics = require('player-physics')
var path = require('path')
var uuid = require('hat')
var engine = require('voxel-engine')

var fakeLag = 100

// these settings will be used to create an in-memory
// world on the server and will be sent to all
// new clients when they connect
var settings = {
  startingPosition: {x: 0, y: 1000, z: 0},
  controlsDisabled: true
}

var game = engine(settings)
var server = http.createServer(ecstatic(path.join(__dirname, 'www')))
var wss = new WebSocketServer({server: server})
var voxelStore = new Scuttlebutt()
var clients = {}

// simple version of socket.io's sockets.emit
function broadcast(id, cmd, arg1, arg2, arg3) {
  Object.keys(clients).map(function(client) {
    if (client === id) return
    clients[client].emit(cmd, arg1, arg2, arg3)
  })
}

function sendUpdate() {
  var clientKeys = Object.keys(clients)
  if (clientKeys.length === 0) return
  var update = {positions:{}}
  clientKeys.map(function(key) {
    var emitter = clients[key]
    update.positions[key] = {
      jump: emitter.player.needsJump,
      position: emitter.player.position,
      rotation: {
        x: emitter.player.rotation.x,
        y: emitter.player.rotation.y
      }
    }
    emitter.player.needsJump = false
  })
  broadcast(false, 'update', update)
}

setInterval(sendUpdate, 1000/22) // 45ms

wss.on('connection', function(ws) {
  // turn 'raw' websocket into a stream
  var stream = websocket(ws)
  
  // muxdemux lets us transport multiple streams
  // over our websocket connection
  var mdm = MuxDemux()
  stream.pipe(mdm).pipe(stream)

  // first stream is a remote event emitter that
  // gets used for sending player state back and forth
  var emitterStream = mdm.createStream('emitter')
  var emitter = duplexEmitter(emitterStream)

  // second stream is scuttlebutt which replicates
  // individual edits to the voxel world
  var voxelStream = mdm.createStream('voxels')
  var storeStream = voxelStore.createStream()
  storeStream.pipe(voxelStream).pipe(storeStream)
  
  var id = uuid()
  clients[id] = emitter
  
  emitter.player = {
    rotation: new game.THREE.Vector3(),
    position: new game.THREE.Vector3()
  }

  console.log(id, 'joined')
  emitter.emit('id', id)
  broadcast(id, 'join', id)
  stream.once('end', leave)
  stream.once('error', leave)
  function leave() {
    delete clients[id]
    console.log(id, 'left')
    broadcast(id, 'leave', id)
  }
  
  // give the user the initial game settings
  emitter.emit('settings', settings)
  
  // fires when the user tells us they are
  // done generating the base world
  emitter.on('generated', function(seq) {
    emitter.on('jump', function() {
      setTimeout(function() {
        emitter.player.needsJump = true
      }, fakeLag)
    })
    // fires when client sends us new input state
    emitter.on('state', function(state) {
      setTimeout(function() {
        emitter.player.rotation.x = state.rotation.x
        emitter.player.rotation.y = state.rotation.y
        var pos = emitter.player.position
        var distance = pos.distanceTo(state.position)
        if (distance > 20) {
          var before = pos.clone()
          pos.lerpSelf(state.position, 0.1)
          return
        }
        pos.copy(state.position)
      }, fakeLag)
    })
  })
  
  emitter.on('set', function(ckey, pos, val) {
    var before = voxelAtChunkIndexAndVoxelVector(ckey, pos)
    var after = voxelAtChunkIndexAndVoxelVector(ckey, pos, val)
    var key = ckey + '|' + pos.x + '|' + pos.y + '|' + pos.z
    voxelStore.set(key, val)
  })
})

function voxelAtChunkIndexAndVoxelVector(ckey, v, val) {
  var chunk = game.voxels.chunks[ckey]
  if (!chunk) return false
  var size = game.voxels.chunkSize
  var vidx = v.x + v.y*size + v.z*size*size
  if (typeof val !== 'undefined') {
    chunk.voxels[vidx] = val
  }
  var v = chunk.voxels[vidx]
  return v
}

var port = process.argv[2] || 8080
server.listen(port)
console.log('Listening on ', port, ' open http://localhost:', port)

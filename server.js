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

// broadcast loop
// sends all positions to all players
// TODO only broadcast positions to nearby players
setInterval(function() {
  var clientKeys = Object.keys(clients)
  if (clientKeys.length === 0) return
  var update = {positions:{}}
  clientKeys.map(function(key) {
    var emitter = clients[key]
    update.positions[key] = {
      position: emitter.player.yawObject.position,
      velocity: emitter.player.velocity,
      rotation: {
        x: emitter.player.pitchObject.rotation.x,
        y: emitter.player.yawObject.rotation.y
      },
      seq: emitter.player.lastProcessedSeq
    }
  })
  broadcast(false, 'update', update)
}, 1000/22) // 45ms

// physics loop
// updates server side physics based on client input
setInterval(function() {
  var clientKeys = Object.keys(clients)
  if (clientKeys.length === 0) return
  clientKeys.map(function(key) {
    var emitter = clients[key]
    var delta = Date.now() - emitter.lastUpdate
    
    // this is attempting to simulate what Game.prototype.tick does from voxel-engine
    emitter.player.tick(delta, function(controls) {
      var bbox = game.playerAABB(emitter.player.yawObject.position)
      game.updatePlayerPhysics(bbox, emitter.player)
    })
    emitter.lastUpdate = Date.now()
  })
}, 1000/66) // 15ms

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
  emitter.lastUpdate = Date.now()
  
  // each player gets their own three.js scene.
  // this never gets rendered visually, but it does get
  // used to calculate physics in-memory.
  // TODO should probably use one scene for all players
  emitter.scene = new game.THREE.Scene()
  var playerOptions = {
    pitchObject: new game.THREE.Object3D(),
    yawObject: new game.THREE.Object3D(),
    velocityObject: new game.THREE.Vector3()
  }
  // playerPhysics is https://github.com/maxogden/player-physics
  emitter.player = playerPhysics(false, playerOptions)
  emitter.player.enabled = true
  emitter.player.yawObject.position.copy(settings.startingPosition)
  emitter.player.lastProcessedSeq = 0
  emitter.scene.add( emitter.player.yawObject )

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
        emitter.player.emit('command', 'jump')        
      }, fakeLag)
    })
    // fires when client sends us new input state
    emitter.on('state', function(state) {
      setTimeout(function() {
        Object.keys(state.movement).map(function(key) {
          emitter.player[key] = state.movement[key]
        })
        emitter.player.yawObject.rotation.y = state.rotation.y
        emitter.player.pitchObject.rotation.x = state.rotation.x
        
        // important - this updates all calculations in three.js
        emitter.scene.updateMatrixWorld()
        
        emitter.player.lastProcessedSeq = state.seq
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

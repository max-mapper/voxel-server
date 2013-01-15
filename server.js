var http = require('http')
var ecstatic = require('ecstatic')
var WebSocketServer = require('ws').Server
var websocket = require('websocket-stream')
var duplexEmitter = require('duplex-emitter')
var playerPhysics = require('player-physics')
var path = require('path')
var uuid = require('hat')
var engine = require('voxel-engine')
var voxel = require('voxel')
var simplex = require('voxel-simplex-terrain')

var chunkSize = 32
var chunkDistance = 1
var scaleFactor = 10
var seed = process.argv[2] || uuid()

function getMaterialIndex(seed, simplex, width, x, y, z) {
  return y > 0 ? 0 : (y == 0 ? 1 : 2);
}

var generator = simplex({seed: seed, scaleFactor: scaleFactor, chunkDistance: chunkDistance, getMaterialIndex: getMaterialIndex})
var settings = {
  generateVoxelChunk: generator,
  texturePath: './textures/',
  materials: ['grass', 'obsidian', 'dirt', 'whitewool', 'crate', 'brick'],
  cubeSize: 25,
  chunkSize: chunkSize,
  chunkDistance: chunkDistance,
  startingPosition: {x: 0, y: 100, z: 0},
  worldOrigin: {x: 0, y: 0, z: 0},
  scaleFactor: scaleFactor,
  controlOptions: {jump: 6}
}
var game = engine(settings)
var server = http.createServer(ecstatic(path.join(__dirname, 'www')))
var wss = new WebSocketServer({server: server})
var clients = {}

function broadcast(id, cmd, arg1, arg2) {
  Object.keys(clients).map(function(client) {
    if (client === id) return
    clients[client].emit(cmd, arg1, arg2)
  })
}

setInterval(function() {
  var clientKeys = Object.keys(clients)
  if (clientKeys.length === 0) return
  var update = {positions:{}}
  clientKeys.map(function(key) {
    var emitter = clients[key]
    update.positions[key] = {
      position: emitter.player.yawObject.position
    }
  })
  update.time = Date.now()
  broadcast(false, 'update', update)
}, 1000/22)

setInterval(function() {
  var clientKeys = Object.keys(clients)
  if (clientKeys.length === 0) return
  clientKeys.map(function(key) {
    var emitter = clients[key]
    var delta = Date.now() - emitter.lastUpdate
    emitter.scene.updateMatrixWorld()
    emitter.player.tick(delta, game.updatePlayerPhysics.bind(game))
    emitter.lastUpdate = Date.now()
  })
}, 1000/66)

wss.on('connection', function(ws) {
  var stream = websocket(ws)
  var emitter = duplexEmitter(stream)
  var id = uuid()
  clients[id] = emitter
  emitter.lastUpdate = Date.now()
  
  emitter.scene = new game.THREE.Scene()
  var playerOptions = {
    pitchObject: new game.THREE.Object3D(),
    yawObject: new game.THREE.Object3D(),
    velocityObject: new game.THREE.Vector3()
  }
  emitter.player = playerPhysics(false, playerOptions)
  emitter.player.enabled = true
  emitter.player.yawObject.position.copy(settings.startingPosition)
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
  emitter.on('generated', function(seq) {
    emitter.on('state', function(state) {
      Object.keys(state.movement).map(function(key) {
        emitter.player[key] = state.movement[key]
      })
      emitter.player.yawObject.rotation.y = state.rotation.y
      emitter.player.pitchObject.rotation.x = state.rotation.x
    })
  })
  emitter.on('ping', function(data) {
    emitter.emit('pong', data)
  })
  emitter.emit('settings', settings)
})

var port = process.argv[2] || 8080
server.listen(port)
console.log('Listening on ', port, ' open http://localhost:', port)

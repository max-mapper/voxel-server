var url = require('url')
var voxel = require('voxel')
var websocket = require('websocket-stream')
var engine = require('voxel-engine')
var MuxDemux = require('mux-demux')
var Model = require('scuttlebutt/model')
var duplexEmitter = require('duplex-emitter')
var simplex = require('voxel-simplex-terrain')
var AverageLatency = require('./latency')
var skin = require('minecraft-skin')

window.socket = websocket('ws://' + url.parse(window.location.href).host)
var emitter
var mdm = MuxDemux()
mdm.on('connection', function (stream) {
  if (stream.meta === "emitter") {
    window.emitter = emitter = duplexEmitter(stream)

    emitter.on('id', function(id) {
      console.log('id', id)
      playerID = id
    })

    emitter.on('settings', function(settings) {
      window.game = game = createGame(settings)
      emitter.emit('generated', Date.now())
    })
  }
  if (stream.meta === "voxels") {

    var voxels = new Model()
    voxels.on('update', function(data, value) {
      var val = data[1]
      var pos = data[0].split('|')
      var ckey = pos.splice(0,3).join('|')
      pos = {x: +pos[0], y: +pos[1], z: +pos[2]}
      var set = voxelAtChunkIndexAndVoxelVector(ckey, pos, val)
      game.showChunk(game.voxels.chunks[ckey])
    })

    stream.pipe(voxels.createStream()).pipe(stream)
  }
})
socket.pipe(mdm).pipe(socket)

var playerID, game, viking, players = {}
window.players = players

function voxelAtChunkIndexAndVoxelVector(ckey, v, val) {
  var chunk = game.voxels.chunks[ckey]
  if (!chunk) return
  var size = game.voxels.chunkSize
  var vidx = v.x + v.y*size + v.z*size*size
  if (typeof val !== 'undefined') {
    var before = chunk.voxels[vidx]
    chunk.voxels[vidx] = val
  }
  var v = chunk.voxels[vidx]
  return v
}

function createGame(options) {
  options.generateVoxelChunk = simplex({
    seed: options.seed,
    scaleFactor: options.scaleFactor,
    chunkDistance: options.chunkDistance,
    getMaterialIndex: function (seed, simplex, width, x, y, z) {
      return y > 0 ? 0 : (y == 0 ? 1 : 2);
    }
  })
  game = engine(options)
  game.controls.on('command', function(command) {
    if (command === 'jump') return emitter.emit('jump')
    emitter.emit('state', {
      movement: {
        moveForward: game.controls.moveForward,
        moveBackward: game.controls.moveBackward,
        moveLeft: game.controls.moveLeft,
        moveRight: game.controls.moveRight
      },
      rotation: {
        y: game.controls.yawObject.rotation.y,
        x: game.controls.pitchObject.rotation.x
      }
    })
  })

  var container = document.querySelector('#container')
  game.appendTo(container)
  container.addEventListener('click', function() {
    game.requestPointerLock(container)
  })
  
  window.viking = viking = skin(game.THREE, 'viking.png')

  game.on('mousedown', function (pos) {
    if (erase) {
      var voxVec = this.voxels.voxelVector(pos)
      var cid = this.voxels.chunkAtPosition(pos).join('|')
      emitter.emit('set', cid, voxVec, 0)
    } else {
      var newBlock = game.checkBlock(pos)
      if (!newBlock) return
      emitter.emit('set', newBlock.chunkIndex, newBlock.voxelVector, 1)
    }
  })
  
  new AverageLatency(emitter, function(latency) {
    game.emit('latency', latency)
  })
    
  // three seems to throw errors if you add stuff too soon
  setTimeout(function() {
    emitter.on('update', function(updates) {
      Object.keys(updates.positions).map(function(player) {
        var update = updates.positions[player]
        if (player === playerID) return updateMyPosition(update.position)
        updatePlayerPosition(player, update)
      })
    })
  }, 3000)

  emitter.on('leave', function(id) {
    // game.scene.remove(players[id].mesh)
    delete players[id]
  })
  
  return game
}

function updateMyPosition(position) {
  var to = new game.THREE.Vector3()
  to.copy(position)
  var from = game.controls.yawObject.position
  from.copy(from.lerpSelf(to, 0.1))  
}

function updatePlayerPosition(id, update) {
  var pos = update.position
  var player = players[id]
  if (!player) {
    var playerMesh = viking.createPlayerObject()
    players[id] = playerMesh
    playerMesh.children[0].position.y = 10
    game.scene.add(playerMesh)
  }
  var playerMesh = players[id].children[0]
  players[id].lastPositionTime = Date.now()
  playerMesh.position.copy(pos)
  playerMesh.position.y -= 23
  playerMesh.rotation.y = update.rotation.y + (Math.PI / 2)
}

var erase = true
window.addEventListener('keydown', function (ev) {
  if (ev.keyCode === 'X'.charCodeAt(0)) {
    erase = !erase
  }
})
function ctrlToggle (ev) { erase = !ev.ctrlKey }
window.addEventListener('keyup', ctrlToggle)
window.addEventListener('keydown', ctrlToggle)

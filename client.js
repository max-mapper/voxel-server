var url = require('url')
var voxel = require('voxel')
var websocket = require('websocket-stream')
var engine = require('voxel-engine')
var duplexEmitter = require('duplex-emitter')
var simplex = require('voxel-simplex-terrain')
var AverageLatency = require('./latency')
var skin = require('minecraft-skin')

window.socket = websocket('ws://' + url.parse(window.location.href).host)
window.emitter = duplexEmitter(socket)
var playerID, game, viking, players = {}
window.players = players

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
  game.controls.on('command', function() {
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
      game.setBlock(pos, 0)
      emitter.emit('set', JSON.parse(JSON.stringify(pos)), 0)
    } else {
      game.createBlock(pos, 1)
      emitter.emit('create', JSON.parse(JSON.stringify(pos)), 1)
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
        updatePlayerPosition(player, update.position)
      })
    })
  }, 3000)

  emitter.on('leave', function(id) {
    game.scene.remove(players[id].mesh)
    delete players[id]
  })

  emitter.on('set', function (pos, val) {
    console.log(pos, '=', val)
    game.setBlock(new game.THREE.Vector3(pos.x, pos.y, pos.z), val)
    game.addMarker(pos)
  })

  emitter.on('create', function (pos, val) {
    console.log(pos, '=', val)
    game.createBlock(new game.THREE.Vector3(pos.x, pos.y, pos.z), 1)
    game.addMarker(pos)
  })
  
  return game
}

emitter.on('id', function(id) {
  console.log('id', id)
  playerID = id
})

emitter.on('settings', function(settings) {
  window.game = game = createGame(settings)
  emitter.emit('generated', Date.now())
})


function updateMyPosition(position) {
  var to = new game.THREE.Vector3()
  to.copy(position)
  var from = game.controls.yawObject.position
  from.copy(from.lerpSelf(to, 0.1))  
}

function updatePlayerPosition(id, pos) {
  var player = players[id]
  if (!player) {
    var playerMesh = viking.createPlayerObject()
    players[id] = playerMesh
    playerMesh.position.y = 10
    game.scene.add(playerMesh)
  } 
  var p = players[id].position
  if (p.x === pos.x && p.y === pos.y && p.z === pos.z) return
  players[id].lastPositionTime = Date.now()
  players[id].position.copy(pos)

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

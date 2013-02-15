var url = require('url')
var websocket = require('websocket-stream')
var engine = require('voxel-engine')
var duplexEmitter = require('duplex-emitter')
var skin = require('minecraft-skin')
var walk = require('voxel-walk')
var toolbar = require('toolbar')
var rescue = require('voxel-rescue')
var randomName = require('./randomname')
var crunch = require('voxel-crunch')
var emitChat = require('./chat')
var blockSelector = toolbar({el: '#tools'})
var highlight = require('voxel-highlight')
var emitter, playerID
var players = {}, lastProcessedSeq = 0
var localInputs = [], connected = false, erase = true
var currentMaterial = 1
var lerpPercent = 0.1

window.addEventListener('keydown', function (ev) {
  if (ev.keyCode === 'X'.charCodeAt(0)) erase = !erase
})
function ctrlToggle (ev) { erase = !ev.ctrlKey }
window.addEventListener('keyup', ctrlToggle)
window.addEventListener('keydown', ctrlToggle)

var socket = websocket('ws://' + url.parse(window.location.href).host)
socket.on('end', function() { connected = false })
connectToGameServer(socket)

function connectToGameServer(socket) {

  emitter = duplexEmitter(socket)
  connected = true

  emitter.on('id', function(id) {
    playerID = id
  })
  
  emitter.on('settings', function(settings) {
    settings.generateChunks = false
    window.game = game = createGame(settings)
    emitter.emit('created')
    emitter.on('chunk', function(encoded, chunk) {
      var voxels = crunch.decode(encoded, chunk.length)
      chunk.voxels = voxels
      game.showChunk(chunk)
    })
  })

  // fires when server sends us voxel edits
  emitter.on('set', function(pos, val) {
    game.setBlock(pos, val)
  })
}

function createGame(options) {
  options.controlsDisabled = false
  window.game = engine(options)

  function sendState() {
    if (!connected) return
    if (!game.controls.enabled) return
    var state = {
      position: game.controls.yawObject.position,
      rotation: {
        y: game.controls.yawObject.rotation.y,
        x: game.controls.pitchObject.rotation.x
      }
    }
    emitter.emit('state', state)
  }
  
  setInterval(sendState, 100)
  
  var name = localStorage.getItem('name')
  if (!name) {
    name = randomName()
    localStorage.setItem('name', name)
  }

  game.controls.on('command', function() {
    sendState()
  })

  emitChat(name, emitter)

  var container = document.querySelector('#container')
  game.appendTo(container)
  game.setupPointerLock(container)
  rescue(game)
  game.viking = skin(game.THREE, 'viking.png')
  game.controls.pitchObject.rotation.x = -1.5;
  highlight(game)
  
  blockSelector.on('select', function(material) {
    currentMaterial = +material
  })
  
  game.on('mousedown', function (pos) {
    pos = {x: pos.x, y: pos.y, z: pos.z}
    var size = game.cubeSize
    if (erase) {
      emitter.emit('set', pos, 0)
    } else {
      var newBlock = game.checkBlock(pos)
      if (!newBlock) return
      emitter.emit('set', newBlock.position, currentMaterial)
    }
  })
  
  // game.on('tick', function(delta) {
  //   Object.keys(players).map(function(player) {
  //     var now = Date.now()
  //     walk.render(players[player], now / 1000)
  //   })
  // })
  
  // setTimeout is because three.js seems to throw errors if you add stuff too soon
  setTimeout(function() {
    emitter.on('update', function(updates) {      
      Object.keys(updates.positions).map(function(player) {
        var update = updates.positions[player]
        if (player === playerID) return onServerUpdate(update) // local player
        updatePlayerPosition(player, update) // other players
      })
    })
  }, 1000)

  emitter.on('leave', function(id) {
    if (!players[id]) return
    game.scene.remove(players[id].mesh)
    delete players[id]
  })
  
  
  
  return game
}

function onServerUpdate(update) {
  var pos = game.controls.yawObject.position
  var distance = pos.distanceTo(update.position)
  // todo use server sent location
}

function lerpMe(position) {
  var to = new game.THREE.Vector3()
  to.copy(position)
  var from = game.controls.yawObject.position
  from.copy(from.lerpSelf(to, lerpPercent))  
}

function updatePlayerPosition(id, update) {
  var pos = update.position
  var player = players[id]
  if (!player) {
    var playerSkin = game.viking
    var playerMesh = playerSkin.mesh
    players[id] = playerSkin
    playerMesh.children[0].position.y = 10
    game.scene.add(playerMesh)
  }
  var playerSkin = window.playerSkin = players[id]
  var playerMesh = playerSkin.mesh.children[0]
  playerMesh.position.copy(pos, lerpPercent)
  
  var to = new game.THREE.Vector3()
  to.copy(pos)
  var from = playerMesh.position
  from.copy(from.lerpSelf(to, lerpPercent))  
  
  playerMesh.position.y -= 23
  playerMesh.rotation.y = update.rotation.y + (Math.PI / 2)
  playerSkin.head.rotation.z = scale(update.rotation.x, -1.5, 1.5, -0.75, 0.75)
}

function scale( x, fromLow, fromHigh, toLow, toHigh ) {
  return ( x - fromLow ) * ( toHigh - toLow ) / ( fromHigh - fromLow ) + toLow
}

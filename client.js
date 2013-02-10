var url = require('url')
var websocket = require('websocket-stream')
var engine = require('voxel-engine')
var playerPhysics = require('player-physics')
var MuxDemux = require('mux-demux')
var Scuttlebutt = require('scuttlebutt/model')
var duplexEmitter = require('duplex-emitter')
var skin = require('minecraft-skin')
var toolbar = require('toolbar')
var blockSelector = toolbar({el: '#tools'})

var emitter, playerID, game
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
  // take our websocket and use muxdemux to create
  // two streams from it
  var mdm = MuxDemux()
  socket.pipe(mdm).pipe(socket)
  mdm.on('connection', function (stream) {
    if (stream.meta === "emitter") {
      emitter = emitter = duplexEmitter(stream)
      connected = true

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

      var voxels = new Scuttlebutt()

      // fires when server sends us voxel edits
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
}

function createGame(options) {
  options.controlsDisabled = false
  game = engine(options)

  game.fakeControls = {
    moveForward: false,
    moveBackward: false,
    moveLeft: false,
    moveRight: false
  }
  
  game.controls.on('command', function(command, setting) {
    if (!connected) return
    if (command === 'jump') return emitter.emit('jump')
    game.fakeControls[command] = setting
  })
  
  setInterval(function() {
    if (!connected) return
    if (!game.controls.enabled) return
    var state = {
      position: game.controls.yawObject.position,
      movement: game.fakeControls,
      rotation: {
        y: game.controls.yawObject.rotation.y,
        x: game.controls.pitchObject.rotation.x
      }
    }
    emitter.emit('state', state)
  }, 1000/22)

  var container = document.querySelector('#container')
  game.appendTo(container)
  game.setupPointerLock(container)
  
  game.viking = skin(game.THREE, 'viking.png')
  game.controls.pitchObject.rotation.x = -1.5;
  
  blockSelector.on('select', function(material) {
    var idx = game.materials.indexOf(material)
    if (idx > -1) currentMaterial = idx + 1
  })
  
  game.on('mousedown', function (pos) {
    if (erase) {
      var voxVec = this.voxels.voxelVector(pos)
      var cid = this.voxels.chunkAtPosition(pos).join('|')
      emitter.emit('set', cid, voxVec, 0)
    } else {
      var newBlock = game.checkBlock(pos)
      if (!newBlock) return
      emitter.emit('set', newBlock.chunkIndex, newBlock.voxelVector, currentMaterial)
    }
  })
  
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
    game.scene.remove(players[id].mesh)
    delete players[id]
  })
  
  return game
}

function onServerUpdate(update) {
  var pos = game.controls.yawObject.position
  var distance = pos.distanceTo(update.position)
}

function voxelAtChunkIndexAndVoxelVector(ckey, v, val) {
  var chunk = game.voxels.chunks[ckey]
  if (!chunk) return
  var size = game.voxels.chunkSize
  var vidx = v.x + v.y*size + v.z*size*size
  if (typeof val !== 'undefined') {
    chunk.voxels[vidx] = val
  }
  var v = chunk.voxels[vidx]
  return v
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
  var playerSkin = players[id]
  var playerMesh = playerSkin.mesh.children[0]
  playerMesh.position.copy(pos, lerpPercent)
  
  var to = new game.THREE.Vector3()
  to.copy(pos)
  var from = playerMesh.position
  from.copy(from.lerpSelf(to, lerpPercent))  
  
  playerMesh.position.y -= 23
  playerMesh.rotation.y = update.rotation.y + (Math.PI / 2)
}
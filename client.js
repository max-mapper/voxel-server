var url = require('url')
var websocket = require('websocket-stream')
var duplexEmitter = require('duplex-emitter')
var voxel = require('voxel')
var engine = require('voxel-engine')
var simplex = require('voxel-simplex-terrain')
var Multiplayer = require('./multiplayer')

window.socket = websocket('ws://' + url.parse(window.location.href).host)
window.emitter = duplexEmitter(socket)
emitter.inputs = []
var multiplayer, game

function createGame(options) {
  options.generateVoxelChunk = simplex({
    seed: options.seed,
    scaleFactor: options.scaleFactor,
    chunkDistance: options.chunkDistance,
    getMaterialIndex: function (seed, simplex, width, x, y, z) {
      return y > 0 ? 0 : (y == 0 ? 1 : 2);
    }
  })
  window.game = game = engine(options)
  
  // warning: monkeypatching ahead!
  game._updatePhysics = game.updatePhysics
  game.updatePhysics = function() {} // no-op, turns off built in physics rendering
  
  game.appendTo('#container')
  game.requestPointerLock('#container')
  game.on('mousedown', function (pos) {
    if (erase) {
      game.setBlock(pos, 0)
      emitter.emit('set', JSON.parse(JSON.stringify(pos)), 0)
    } else {
      game.createBlock(pos, 1)
      emitter.emit('create', JSON.parse(JSON.stringify(pos)), 1)
    }
  })
}

function createMultiplayer() {
  multiplayer = new Multiplayer(game, emitter)
  game.controls.on('command', function(prop, setting) {
    var input = {
      moveForward: game.controls.moveForward,
      moveBackward: game.controls.moveBackward,
      moveLeft: game.controls.moveLeft,
      moveRight: game.controls.moveRight,
      enabled: true
    }
    var state = multiplayer.getClientState(input)
    emitter.inputs.push(state)
    emitter.emit('state', state)
  })
  multiplayer.on('clientPrediction', function(pastPoint, targetPoint, timePoint, delta) {
    pastPoint = new game.THREE.Vector3().copy(pastPoint)
    targetPoint = new game.THREE.Vector3().copy(targetPoint)
    var target = pastPoint.lerpSelf(targetPoint, timePoint)
    var from = game.controls.yawObject.position
    from.copy(from.lerpSelf(target, delta))
    console.log('move', target)
  })
  multiplayer.on('updateClientPosition', function(pos) {
    var from = game.controls.yawObject.position
    from.copy(pos)
  })
  game.on('tick', function() {
    multiplayer.clientProcessUpdates()
  })
}

emitter.on('id', function(id) {
  emitter.playerID = id
  if (game) createMultiplayer()
})

emitter.on('settings', function(settings) {
  createGame(settings)
  emitter.emit('generated', Date.now())
  if (emitter.playerID) createMultiplayer()
})

emitter.on('update', function(updates) {
  if (!emitter.playerID) return
  if (!updates.positions[emitter.playerID]) return
  multiplayer.clientOnUpdate(updates)
  // var update = updates.positions[emitter.playerID]
  // if (!update) return
  // game.controls.velocity.copy(update.velocity)
  // var from = game.controls.yawObject.position
  // from.copy(from.lerpSelf(update.position, 0.1))
  // 
})

var erase = true
window.addEventListener('keydown', function (ev) {
  if (ev.keyCode === 'X'.charCodeAt(0)) {
    erase = !erase
  }
})
function ctrlToggle (ev) { erase = !ev.ctrlKey }
window.addEventListener('keyup', ctrlToggle)
window.addEventListener('keydown', ctrlToggle)

// var loader = new THREE.JSONLoader( true )
// loader.load( "/horse.js", function( geometry ) {
//   window.horseGeometry = geometry
// })
// 
// function animateHorses() {
//   Object.keys(horses).map(function(horseID) {
//     var horse = horses[horseID]
//     if ( horse.mesh ) {
//       horse.tick()
//    }
//   })
// }
// 
// function Horse() {
//   this.radius = 600
//  this.theta = 0
//  this.duration = 1000
//  this.keyframes = 15
//  this.interpolation = this.duration / this.keyframes
//  this.lastKeyframe = 0
//  this.currentKeyframe = 0
//  this.lastPositionTime = Date.now()
//  
//   var mesh = new THREE.Mesh( horseGeometry, new THREE.MeshLambertMaterial( { color: 0x606060, morphTargets: true } ) )
//  mesh.scale.set( 0.25, 0.25, 0.25 )
//  game.scene.add( mesh )
//  this.mesh = mesh
// }
// 
// Horse.prototype.tick = function() {
//   if (Date.now() - this.lastPositionTime > 150) return
//   var time = Date.now() % this.duration
//   var keyframe = Math.floor( time / this.interpolation )
//   if ( keyframe != this.currentKeyframe ) {
//     this.mesh.morphTargetInfluences[ this.lastKeyframe ] = 0
//     this.mesh.morphTargetInfluences[ this.currentKeyframe ] = 1
//     this.mesh.morphTargetInfluences[ keyframe ] = 0
//     this.lastKeyframe = this.currentKeyframe
//     this.currentKeyframe = keyframe
//   }
//   this.mesh.morphTargetInfluences[ keyframe ] = ( time % this.interpolation ) / this.interpolation
//   this.mesh.morphTargetInfluences[ this.lastKeyframe ] = 1 - this.mesh.morphTargetInfluences[ keyframe ]
// }
// 
// 
// setInterval(function() {
//   if (Object.keys(horses).length === 0) return
//   emitter.emit('position', JSON.parse(JSON.stringify(game.controls.yawObject.position.clone())))
// }, 10)
// 
// emitter.on('leave', function(id) {
//   game.scene.remove(horses[id])
//   delete horses[id]
// })
// 
// emitter.on('position', function(id, pos) {
//   var horse = horses[id]
//   if (!horse) horses[id] = new Horse()
//   var p = horses[id].mesh.position
//   if (p.x === pos.x && p.y === pos.y && p.z === pos.z) return
//   horses[id].lastPositionTime = Date.now()
//   horses[id].mesh.position.copy(pos)
// })
// 
// emitter.on('set', function (pos, val) {
//   console.log(pos, '=', val)
//   game.setBlock(new THREE.Vector3(pos.x, pos.y, pos.z), val)
//   game.addMarker(pos)
// })
// 
// emitter.on('create', function (pos, val) {
//   console.log(pos, '=', val)
//   game.createBlock(new THREE.Vector3(pos.x, pos.y, pos.z), 1)
//   game.addMarker(pos)
// })

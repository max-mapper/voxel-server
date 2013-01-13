var url = require('url')
var voxel = require('voxel')
var websocket = require('websocket-stream')
var engine = require('voxel-engine')
var duplexEmitter = require('duplex-emitter')
var simplex = require('voxel-simplex-terrain')

window.socket = websocket('ws://' + url.parse(window.location.href).host)
window.emitter = duplexEmitter(socket)
var playerID

function createGame(options) {
  options.generateVoxelChunk = simplex({
    seed: options.seed,
    scaleFactor: options.scaleFactor,
    chunkDistance: options.chunkDistance,
    getMaterialIndex: function (seed, simplex, width, x, y, z) {
      return y > 0 ? 0 : (y == 0 ? 1 : 2);
    }
  })
  var game = engine(options)
  
  // warning: monkeypatching ahead!
  game._updatePhysics = game.updatePhysics
  game.updatePhysics = function() {} // no-op, turns off built in physics rendering
  
  game.on('tick', function() {
    game.controls.enabled = false
  })
  game.controls.on('command', function() {
    emitter.emit('state', {
      moveForward: game.controls.moveForward,
      moveBackward: game.controls.moveBackward,
      moveLeft: game.controls.moveLeft,
      moveRight: game.controls.moveRight,
      enabled: true
    })
  })
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
  return game
}

emitter.on('id', function(id) {
  console.log('id', id)
  playerID = id
})

emitter.on('settings', function(settings) {
  window.game = createGame(settings)
  emitter.emit('generated', Date.now())
})

emitter.on('update', function(updates) {
  if (!playerID) return
  var update = updates.positions[playerID]
  if (!update) return
  game.controls.velocity.copy(update.velocity)
  var to = new game.THREE.Vector3()
  to.copy(update.position)
  var from = game.controls.yawObject.position
  var distance = from.distanceTo(to)
  if (distance > 20) {
    from.copy(update.position)
  } else if (distance > 0.01){
    from.x += to.x * 0.1
    from.y += to.y * 0.1
    from.z += to.z * 0.1
  }
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

var websocket = require('websocket-stream')
var createGame = require('voxel-engine')
var duplexEmitter = require('duplex-emitter')
var THREE = require('three')

window.socket = websocket('ws://localhost:8080')
window.emitter = duplexEmitter(socket)
window.game = createGame({
  renderCallback: animateHorses
})
game.appendTo('#container')

var loader = new THREE.JSONLoader( true )
loader.load( "/horse.js", function( geometry ) {
  window.horseGeometry = geometry
})

function animateHorses() {
  Object.keys(horses).map(function(horseID) {
    var mesh = horses[horseID]
    if ( mesh ) {
      var duration = 1000;
      var keyframes = 15, interpolation = duration / keyframes;
      var lastKeyframe = 0, currentKeyframe = 0;
      var time = Date.now() % duration;
      var keyframe = Math.floor( time / interpolation );
      if ( keyframe != currentKeyframe ) {
       mesh.morphTargetInfluences[ lastKeyframe ] = 0;
       mesh.morphTargetInfluences[ currentKeyframe ] = 1;
       mesh.morphTargetInfluences[ keyframe ] = 0;
       lastKeyframe = currentKeyframe;
       currentKeyframe = keyframe;
      }
      mesh.morphTargetInfluences[ keyframe ] = ( time % interpolation ) / interpolation;
      mesh.morphTargetInfluences[ lastKeyframe ] = 1 - mesh.morphTargetInfluences[ keyframe ];
		}
  })
}

function newHorse() {
  mesh = new THREE.Mesh( horseGeometry, new THREE.MeshLambertMaterial( { color: 0x606060, morphTargets: true } ) )
	mesh.scale.set( 0.25, 0.25, 0.25 )
	game.scene.add( mesh )
	return mesh
}

window.horses = {}

setInterval(function() {
  if (Object.keys(horses).length === 0) return
  emitter.emit('position', JSON.parse(JSON.stringify(game.controls.yawObject.position.clone())))
}, 10)

emitter.on('join', function(id) {
  console.log('new horse!', id)
  horses[id] = newHorse()
})

emitter.on('leave', function(id) {
  game.scene.remove(horses[id])
  delete horses[id]
})

emitter.on('position', function(id, pos) {
  var horse = horses[id]
  if (!horse) horses[id] = newHorse()
  var p = horses[id].position
  if (p.x === pos.x && p.y === pos.y && p.z === pos.z) return
  horses[id].position.copy(pos)
})

emitter.on('set', function (pos, val) {
  console.log(pos, '=', val)
  game.setBlock(new THREE.Vector3(pos.x, pos.y, pos.z), val)
  game.addMarker(pos)
})

emitter.on('create', function (pos, val) {
  console.log(pos, '=', val)
  game.createBlock(vector, 1)
  game.addMarker(pos)
})

game.on('mousedown', function (pos) {
  if (erase) {
    game.setBlock(pos, 0)
    emitter.emit('set', JSON.parse(JSON.stringify(pos)), 0)
  } else {
    game.createBlock(pos, 1)
    emitter.emit('create', JSON.parse(JSON.stringify(pos)), 1)
  }
})

var erase = true
window.addEventListener('keydown', function (ev) {
  if (ev.keyCode === 'X'.charCodeAt(0)) {
    erase = !erase
  }
})

document.body.addEventListener('click', function() {
  game.requestPointerLock()
})

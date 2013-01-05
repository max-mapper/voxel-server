var websocket = require('websocket-stream')
var createGame = require('voxel-engine')
var duplexEmitter = require('duplex-emitter')
var THREE = require('three')

window.socket = websocket('ws://localhost:8080')
window.emitter = duplexEmitter(socket)
window.game = createGame()
game.appendTo('#container')

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

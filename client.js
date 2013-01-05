var websocket = require('websocket-stream')
var createGame = require('voxel-engine')
var emitStream = require('emit-stream');
var JSONStream = require('JSONStream')
var events = require('events')
var THREE = require('three')

window.socket = websocket('ws://localhost:8080')
window.incoming = emitStream(socket.pipe(JSONStream.parse([true])))
window.outgoing = new events.EventEmitter()
emitStream(outgoing).pipe(JSONStream.stringify()).pipe(socket)
window.game = createGame()
game.appendTo('#container')

incoming.on('set', function (pos, val) {
  console.log(pos, '=', val)
  game.setBlock(new THREE.Vector3(pos.x, pos.y, pos.z), 1)
})

incoming.on('create', function (pos, val) {
  console.log(pos, '=', val)
  game.createBlock(new THREE.Vector3(pos.x, pos.y, pos.z), 1)
})

game.on('mousedown', function (pos) {
  if (erase) {
    game.setBlock(pos, 0)
    outgoing.emit('set', JSON.parse(JSON.stringify(pos)), 0)
  } else {
    game.createBlock(pos, 1)
    outgoing.emit('create', JSON.parse(JSON.stringify(pos)), 1)
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

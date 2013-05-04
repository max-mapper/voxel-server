var createClient = require('../.')
var highlight = require('voxel-highlight')
var extend = require('extend')
var voxelPlayer = require('voxel-player')
var createGame = require('voxel-engine')
var texturePath = require('painterly-textures')(__dirname)
var texturePath = "textures/"
var voxel = require('voxel')
var game

module.exports = function(opts, setup) {
  setup = setup || defaultSetup
  opts = extend({}, opts || {})
  
  var settings = {
	//Sphere is on this client, Valley is default on server
  	generate: voxel.generator['Sphere'],
  	chunkDistance: 2,
  	materials: [
  	['grass', 'dirt', 'grass_dirt'],
  	'obsidian',
  	'brick',
  	'grass'
  	],
  	texturePath: texturePath,
  	worldOrigin: [0, 0, 0],
  	controls: { discreteFire: true },
	avatarInitialPosition: [2, 20, 2],
	resetSettings: true
  }
  
  var game = {}
  settings.generatorToString = settings.generate.toString()
  game.settings = settings
  var client = createClient(opts.server || "ws://localhost:8080/", game)
  
  client.emitter.on('noMoreChunks', function(id) {
    console.log("Attaching to the container and creating player")
    var container = opts.container || document.body
    game = client.game
    game.appendTo(container)
    if (game.notCapable()) return game
    var createPlayer = voxelPlayer(game)

    // create the player from a minecraft skin file and tell the
    // game to use it as the main player
    var avatar = createPlayer('viking.png')
    window.avatar = avatar
    avatar.possess()
    avatar.position.set(2, 20, 4)

    setup(game, avatar, client)
  })

  return game
}

function defaultSetup(game, avatar, client) {
  // highlight blocks when you look at them, hold <Ctrl> for block placement
  var blockPosPlace, blockPosErase
  var hl = game.highlighter = highlight(game, { color: 0xff0000 })
  hl.on('highlight', function (voxelPos) { blockPosErase = voxelPos })
  hl.on('remove', function (voxelPos) { blockPosErase = null })
  hl.on('highlight-adjacent', function (voxelPos) { blockPosPlace = voxelPos })
  hl.on('remove-adjacent', function (voxelPos) { blockPosPlace = null })

  // toggle between first and third person modes
  window.addEventListener('keydown', function (ev) {
    if (ev.keyCode === 'R'.charCodeAt(0)) avatar.toggle()
  })

  // block interaction stuff, uses highlight data
  var currentMaterial = 1

  game.on('fire', function (target, state) {
    var position = blockPosPlace
    if (position) {
      game.createBlock(position, currentMaterial)
      client.emitter.emit('set', position, currentMaterial)
    } else {
      position = blockPosErase
      if (position) {
        game.setBlock(position, 0)
        console.log("Erasing point at " + JSON.stringify(position))
        client.emitter.emit('set', position, 0)
      }
    }
  })
}
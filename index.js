var http = require('http')
var WebSocketServer = require('ws').Server
var websocket = require('websocket-stream')
var duplexEmitter = require('duplex-emitter')
var path = require('path')
var uuid = require('hat')
var crunch = require('voxel-crunch')
var engine = require('voxel-engine')
var texturePath = require('painterly-textures')(__dirname)
var voxel = require('voxel')
var express = require('express')
var browserify_express = require('browserify-express')
var everyauth = require('everyauth')

module.exports = function() {

  // these settings will be used to create an in-memory
  // world on the server and will be sent to all
  // new clients when they connect
  var settings = {
    generate: voxel.generator['Valley'],
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
    avatarInitialPosition: [2, 20, 2]  ,
    username: "Dude",
    gravitar: "elsewhere"
  }

  var game = engine(settings)

  everyauth.debug = true
  var cookieParser = express.cookieParser('secret')
  var usersById = {}
  var nextUserId = 0
  var username
  var gravitar

  everyauth.everymodule
      .findUserById( function (id, callback) {
        callback(null, usersById[id])
      })

  everyauth
      .password
      .loginWith('email')
      .getLoginPath('/login')
      .postLoginPath('/login')
      .loginView('../www/views/login.jade')
      .loginLocals( function (req, res, done) {
        setTimeout( function () {
          done(null, {
            title: 'Async login'
          })
        }, 200)
      })
      .authenticate( function (login, password) {
        var errors = []
        if (!login) errors.push('Missing login')
        if (!password) errors.push('Missing password')
        if (errors.length) return errors
        var user = usersByLogin[login]
        if (!user) return ['Login failed']
        if (user.password !== password) return ['Login failed']
        return user
      })
      .getRegisterPath('/register')
      .postRegisterPath('/register')
      .registerView('../www/views/register.jade')
      .registerLocals( function (req, res, done) {
        setTimeout( function () {
          done(null, {
            title: 'Async Register'
          })
        }, 200)
      })
      .extractExtraRegistrationParams( function (req) {
        return {
          'username': req.body.username
          , 'gravitar': req.body.gravitar
        }
      })
      .validateRegistration( function (newUserAttrs, errors) {
        var login = newUserAttrs.login
        if (usersByLogin[login]) errors.push('Login already taken')
        return errors
      })
      .registerUser( function (newUserAttrs) {
        var login = newUserAttrs[this.loginKey()]
        return usersByLogin[login] = addUser(newUserAttrs)
      })
      .respondToRegistrationSucceed( function (res, user) {
        res.cookie('wsAuth', 'true')
        res.cookie('expressSessionID', res.req.sessionID)
        res.cookie('username', user.username)
        res.cookie('gravitar', user.gravitar)
        this.redirect(res, this.registerSuccessRedirect())
      })

      .loginSuccessRedirect('/')
      .registerSuccessRedirect('/')

  function addUser (source, sourceUser, cb) {
    var user
    if (arguments.length === 1) { // password-based
      user = sourceUser = source
      user.id = ++nextUserId
      return usersById[nextUserId] = user
    } else { // non-password-based
      user = usersById[++nextUserId] = {id: nextUserId}
      user[source] = sourceUser
    }
    return user
  }

  var usersByLogin = {
    'brian@example.com': addUser({ login: 'brian@example.com', password: 'password'})
  }

  var bundle = browserify_express({
    entry: __dirname + '/www/js/demo.js',
    watch: __dirname + '/www/js/',
    mount: '/js/bundle.js',
    verbose: true,
    minify: false,
    bundle_opts: { debug: true }, // enable inline sourcemap on js files
    watch_opts: { recursive: false} // disable recursive file watch
  })

  var app = express()
  var sessionStore  = new express.session.MemoryStore
  app.configure(function(){
    app.use(express.errorHandler({ dumpExceptions: true, showStack: true }))
    //app.set('port', process.env.PORT || 3000)
    app.set('views', __dirname + '/www/views')
    app.set('view engine', 'jade')
    //app.use(express.favicon())
    app.use(express.logger('dev'))
    app.use(express.bodyParser())
    app.use(cookieParser)
    app.use(express.session({ secret: 'secret', store: sessionStore, key: 'sid'}))
    app.use(everyauth.middleware(app))
    app.use(express.methodOverride())
    app.use(bundle)
    app.use(app.router)
    app.use(express.static(path.join(__dirname, 'www')))
  })

  // TODO: May not need to lock down the whole app.
  app.all('*',function(req,res,next){
    // Kudos: http://stackoverflow.com/questions/7067966/how-to-allow-cors-in-express-nodejs
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "X-Requested-With");
    console.log("express sessionID: " + req.sessionID + " path: " + req.path + " req.loggedIn: " + req.loggedIn)
    if(req.loggedIn){
      next()
    } else {
      //TODO: Figure out why ajax requests from the client are not sending request cookies and therefore are authenticated.
      // Is this a CORS issue? https://developer.mozilla.org/en-US/docs/HTML/CORS_Enabled_Image
      if (req.path.substring(0,9) == "/textures")  {
        next()
      } else if (req.path.substring(0,11) == "/player.png")  {
        next()
      }  else {
        return res.redirect("/login")
      }
    }
  })

  var server = http.createServer(app)
  server.listen(8080)

  // Function to authenticate if web socket access
  // should be granted
  function wsAuth(result) {
    var thisSessionId
    var parseCookie = express.cookieParser()
    parseCookie(result.req, null, function(err) {
      thisSessionId = result.req.cookies['expressSessionID']
      var sid = result.req.cookies['sid']
      var wsAuth = result.req.cookies['wsAuth']
      // TODO: check if wsAuth = true.
      username = result.req.cookies['username']
      gravitar = result.req.cookies['gravitar']
      settings.username =  username
      settings.gravitar =  gravitar
      console.log("expressSessionID: " + thisSessionId + " username" + username)
      console.log("sid: " + sid + " wsAuth: " + wsAuth)
      result.req.sessionID =  sid
      sessionStore.get(thisSessionId, function(err, session) {
        // session
        console.log("session: " + session)
        if (err || !session) {
          console.log("Session error")
        } else {
          result.req.session = session
        }
      })
    })

    if (result.origin == "http://localhost:8080")   {
        return true
      } else {
        return false
      }
  }

  var wss = new WebSocketServer({server: server, verifyClient: wsAuth})
  console.log("Web server has started.\nPlease log on http://127.0.0.1:8080/index.html")

  var clients = {}
  var chunkCache = {}
  var usingClientSettings


  // simple version of socket.io's sockets.emit
  function broadcast(id, cmd, arg1, arg2, arg3) {
    Object.keys(clients).map(function(client) {
      if (client === id) return
      clients[client].emit(cmd, arg1, arg2, arg3)
    })
  }

  function sendUpdate() {
    var clientKeys = Object.keys(clients)
    if (clientKeys.length === 0) return
    var update = {positions:{}, date: +new Date()}
    clientKeys.map(function(key) {
      var emitter = clients[key]
      update.positions[key] = {
        position: emitter.player.position,
        rotation: {
          x: emitter.player.rotation.x,
          y: emitter.player.rotation.y
        }
      }
    })
    broadcast(false, 'update', update)
  }

  setInterval(sendUpdate, 1000/22) // 45ms

  wss.on('connection', function(ws) {
    // turn 'raw' websocket into a stream
    var stream = websocket(ws)

    var emitter = duplexEmitter(stream)

    emitter.on('clientSettings', function(clientSettings) {
      // Enables a client to reset the settings to enable loading new clientSettings
      if (clientSettings != null) {
        if (clientSettings.resetSettings != null) {
          console.log("resetSettings:true")
          usingClientSettings = null
          if (game != null) game.destroy()
          game = null
          chunkCache = {}
        }
      }

      if (clientSettings != null && usingClientSettings == null) {
        usingClientSettings = true
        // Use the correct path for textures url
        clientSettings.texturePath = texturePath
        //deserialise the voxel.generator function.
        if (clientSettings.generatorToString != null) {
          clientSettings.generate = eval("(" + clientSettings.generatorToString + ")")
        }
        settings = clientSettings
        console.log("Using settings from client to create game.")
        game = engine(settings)
      } else {
        if (usingClientSettings != null) {
          console.log("Sending current settings to new client.")
        } else {
          console.log("Sending default settings to new client.")
        }
      }
    })

    var id = uuid()
    clients[id] = emitter

    emitter.player = {
      rotation: new game.THREE.Vector3(),
      position: new game.THREE.Vector3()
    }

    app.use(function(req, res, next){
      res.locals.user = req.user
      console.log(" req.user: " + req.user + " id: " + id)
      next()
    })

    console.log(id, 'joined')
    emitter.emit('id', id)
    broadcast(id, 'join', id)
    stream.once('end', leave)
    stream.once('error', leave)
    function leave() {
      delete clients[id]
      console.log(id, 'left')
      broadcast(id, 'leave', id)
    }

    emitter.on('message', function(message) {
      if (!message.text) return
      if (message.text.length > 140) message.text = message.text.substr(0, 140)
      if (message.text.length === 0) return
      console.log('chat', message)
      broadcast(null, 'message', message)
    })

    // give the user the initial game settings
	if (settings.generate != null) {
	  	settings.generatorToString = settings.generate.toString()
	}
    emitter.emit('settings', settings)

    // fires when the user tells us they are
    // ready for chunks to be sent
    emitter.on('created', function() {
      sendInitialChunks(emitter)
      // fires when client sends us new input state
      emitter.on('state', function(state) {
        emitter.player.rotation.x = state.rotation.x
        emitter.player.rotation.y = state.rotation.y
        var pos = emitter.player.position
        var distance = pos.distanceTo(state.position)
        if (distance > 20) {
          var before = pos.clone()
          pos.lerp(state.position, 0.1)
          return
        }
        pos.copy(state.position)
      })
    })

    emitter.on('set', function(pos, val) {
      game.setBlock(pos, val)
      var chunkPos = game.voxels.chunkAtPosition(pos)
      var chunkID = chunkPos.join('|')
      if (chunkCache[chunkID]) delete chunkCache[chunkID]
      broadcast(null, 'set', pos, val)
    })

  })

  function sendInitialChunks(emitter) {
    Object.keys(game.voxels.chunks).map(function(chunkID) {
      var chunk = game.voxels.chunks[chunkID]
      var encoded = chunkCache[chunkID]
      if (!encoded) {
        encoded = crunch.encode(chunk.voxels)
        chunkCache[chunkID] = encoded
      }
      emitter.emit('chunk', encoded, {
        position: chunk.position,
        dims: chunk.dims,
        length: chunk.voxels.length
      })
    })
    emitter.emit('noMoreChunks', true)
  }

  return app
}
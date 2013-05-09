# voxel-server

multiplayer server for [voxel-engine](http://github.com/maxogden/voxel-engine)

Use with [voxel-client](https://github.com/maxogden/voxel-client).

This webapp uses [everyauth](https://github.com/bnoguchi/everyauth/tree/express3) for user registration and authentication.
It stores username and gravitar data in a session cookie, which is passed on to the ws websocket server.

## Get it running on your machine

```
npm install
```

Run the start script:

```
npm start
```

This gets the server running on port 8080.

This version uses browserify_express to browserify the js bundle, which is useful while developing. You may wish to
generate a static version of this file (browserify demo.js >| bundle.js -d) and link to it in production.

The [basicAuth](https://github.com/chrisekelley/voxel-server/commit/79480a21951f428ca93d117f2344d65a2d69c64a) commit has
an example of how to use express with the basicAuth middleware.

The webapp is configured to let any username/password combination pass and does not persist the registrations yet.

You may view a voxel-client demo at http://127.0.0.1:8080. Click the register link at the bottom of the Login page to
register.

## Sharing game settings

If the client sends an object with a settings property, it will use those settings when creating its game instance
and will send those instances to other clients that connect.

If the client settings have the property "resetSettings", the server will switch to those.
It deletes any game instance and clears the chunkCache.

## explanation

background research:

- http://buildnewgames.com/real-time-multiplayer/
- https://developer.valvesoftware.com/wiki/Source_Multiplayer_Networking
- http://www.gabrielgambetta.com/?p=63 (all three parts)
- http://gafferongames.com/networking-for-game-programmers/what-every-programmer-needs-to-know-about-game-networking/
- http://gafferongames.com/game-physics/networked-physics/
- http://udn.epicgames.com/Three/NetworkingOverview.html

## license

BSD

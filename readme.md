# voxel-server

multiplayer server for [voxel-engine](http://github.com/maxogden/voxel-engine)

This is a fork of Max Ogden's voxel-server. Install this version, and then run [voxel-hello-client](https://github.com/chrisekelley/voxel-hello-client) to test.

voxel-hello-client is a version of voxel-hello-world that uses [my version of his voxel-client](https://github.com/chrisekelley/voxel-client) to communicate with voxel-server.

**not complete: work in progress**

# Get it running on your machine

```
npm install
```

If you run into the following error: Unexpected "\u0000" at position 0 error:
Use the duplex-emitter included in voxel-client.
TODO: create a fork of duplex-emitter to avoid including the node_modules.
Refer to
https://github.com/pgte/duplex-emitter/issues/4#issuecomment-15699928

Run the start script:

```
npm start
```

This gets the server running on port 8080.

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

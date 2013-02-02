# voxel-server

multiplayer server for [voxel-engine](http://github.com/maxogden/voxel-engine)

**not done: work in progress**

## get it to run:

```
cd voxel-server
npm install
make
npm start
```

## explanation

based on bits and pieces of:

- http://buildnewgames.com/real-time-multiplayer/
- https://developer.valvesoftware.com/wiki/Source_Multiplayer_Networking
- http://www.gabrielgambetta.com/?p=63 (all three parts)
- http://gafferongames.com/networking-for-game-programmers/what-every-programmer-needs-to-know-about-game-networking/
- http://gafferongames.com/game-physics/networked-physics/
- http://udn.epicgames.com/Three/NetworkingOverview.html

### what is implemented

the server + client both run [voxel-engine](http://github.com/maxogden/voxel-engine) and [player-physics](http://github.com/maxogden/player-physics). world edits are replicated between all clients + server through use of [scuttlebutt](http://github.com/dominictarr/scuttlebutt).

when a client connects the server sends it the game config (including what world to generate, if not the default sphere world). 

after the client has generated the world it tells the server it is ready and it starts receiving position updates.

keyboard + mouse inputs are sent to the server and positions are sent back. there is rudimentary client side prediction for the local player though it is choppy and needs work + tuning (see the storeServerUpdate function).

### known issues

the syncing of world edits seems to stop working after a while. not sure why, havent had time to look into it. also updates should ideally come in groups of edits and not individual voxel edits.

reconciliation of predicted location with the servers authoritative location is not implemented very well

## license

BSD
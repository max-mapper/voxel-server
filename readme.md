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

if you make any changes to client.js you have to run `make` and reload the browser. if you make changes to `server.js` you have to restart the server

## explanation

background research:

- http://buildnewgames.com/real-time-multiplayer/
- https://developer.valvesoftware.com/wiki/Source_Multiplayer_Networking
- http://www.gabrielgambetta.com/?p=63 (all three parts)
- http://gafferongames.com/networking-for-game-programmers/what-every-programmer-needs-to-know-about-game-networking/
- http://gafferongames.com/game-physics/networked-physics/
- http://udn.epicgames.com/Three/NetworkingOverview.html

### what is implemented

multiplayer where the server mostly trusts the client and just filters out egregious hacking attemps (like teleportation). this simplifies the net code quite a bit

if you want to check out the now defunct client side prediction version use https://github.com/maxogden/voxel-server/commit/61280b1a37d79a742fd7fbec4b8427ea820cb935

## license

BSD

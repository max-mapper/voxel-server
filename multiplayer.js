var AverageLatency = require('./latency')
var inherits = require('inherits')
var events = require('events')
module.exports = Multiplayer

function Multiplayer(game) {
  this.game = game
  this.clients = {}

  this.currentPhysicsTime = Date.now()
  
  this.startPhysicsLoop()

  if (process.browser) {
    this.clientCreateConfiguration()
    this.clientMeasureLatency()
  } else {
    this.serverTime = 0
    this.lastState = {}
    this.startServerUpdateLoop()
  }
}

inherits(Multiplayer, events.EventEmitter)

Multiplayer.prototype.clientMeasureLatency = function() {
  var self = this
  this.averageLatency = new AverageLatency(this.emitter, function(latency) {
    self.emit('latency', latency)
    self.netLatency = latency/2
    self.netPing = latency
    self.lastPingTime = Date.now()
  })
}

Multiplayer.prototype.startPhysicsLoop = function(rate) {
  var self = this
  this.physicsLoopID = setInterval(function() {
    var now = Date.now()
    var delta = now - self.currentPhysicsTime
    self.lastPhysicsTime = self.currentPhysicsTime
    self.currentPhysicsTime = now
    self.emit('physicsUpdate', delta)
  }, rate || 1000/66.666)
}

Multiplayer.prototype.startServerUpdateLoop = function(rate) {
  this.serverUpdateLoopID = setInterval(this.serverUpdate.bind(this), rate || 1000/22)
}

Multiplayer.prototype.serverUpdate = function(){
  var self = this
  this.serverTime = Date.now()
  
  var clientKeys = Object.keys(this.clients)
  if (clientKeys.length === 0) return
  var update = {positions:{}}
  clientKeys.map(function(key) {
    var emitter = self.clients[key]
    if (!emitter.player.enabled) return
    update.positions[key] = {
      position: emitter.player.yawObject.position,
      velocity: emitter.player.velocity
    }
  })
  update.time = Date.now()
  this.emit('serverUpdate', update)
};

Multiplayer.prototype.clientCreateConfiguration = function() {
  this.inputSeq = 0;         //When predicting client inputs, we store the last input as a sequence number
  this.clientSmooth = 25;      //amount of smoothing to apply to client update dest

  this.netLatency = 0.001;       //the latency between the client and the server (ping/2)
  this.netPing = 0.001;        //The round trip time from here to the server,and back
  this.lastPingTime = 0.001;    //The time we last sent a ping

  this.netOffset = 100;        //100 ms latency between server and client interpolation for other clients
  this.bufferSize = 2;         //The size of the server history to keep for rewinding/interpolating.
  this.targetTime = 0.01;      //the time where we want to be in the server timeline
  this.oldestTick = 0.01;      //the last time tick we have available in the buffer

  this.clientTime = 0.01;      //Our local 'clock' based on server time - client interpolation(net_offset).
  this.serverTime = 0.01;      //The time the server reported it was at, last we heard from it
  
  this.serverUpdates = [];
}

Multiplayer.prototype.clientOnUpdate = function(data) {

      //Store the server time (this is offset by the latency in the network, by the time we get it)
    this.serverTime = data.time
      //Update our local offset time from the last server update
    this.clientTime = this.serverTime - (this.netOffset/1000)


      //Cache the data from the server,
      //and then play the timeline
      //back to the player with a small delay (net_offset), allowing
      //interpolation between the points.
    this.serverUpdates.push(data);

      //we limit the buffer in seconds worth of updates
      //60fps*buffer seconds = number of samples
    if(this.serverUpdates.length >= ( 60*this.bufferSize )) {
      this.serverUpdates.splice(0,1);
    }

      //We can see when the last tick we know of happened.
      //If client_time gets behind this due to latency, a snap occurs
      //to the last tick. Unavoidable, and a reallly bad connection here.
      //If that happens it might be best to drop the game after a period of time.
    this.oldestTick = this.serverUpdates[0].time;

      //Handle the latest positions from the server
      //and make sure to correct our local predictions, making the server have final say.
    this.clientProcessNetPredictionCorrection();
    

}; //game_core.client_onserverupdate_recieved

Multiplayer.prototype.clientProcessNetPredictionCorrection = function() {

    //No updates...
  if(!this.server_updates.length) return;

    //The most recent server update
  var latest_server_data = this.server_updates[this.server_updates.length-1];

    //Our latest server position
  var my_server_pos = latest_server_data.positions[playerID]

      //here we handle our local input prediction ,
      //by correcting it with the server and reconciling its differences

    var my_last_input_on_server = latest_server_data.lastPositions[playerID]
    if(my_last_input_on_server) {
        //The last input sequence index in my local input list
      var lastinputseq_index = -1;
        //Find this input in the list, and store the index
      for(var i = 0; i < this.players.self.inputs.length; ++i) {
        if(this.players.self.inputs[i].seq == my_last_input_on_server) {
          lastinputseq_index = i;
          break;
        }
      }

        //Now we can crop the list of any updates we have already processed
      if(lastinputseq_index != -1) {
        //so we have now gotten an acknowledgement from the server that our inputs here have been accepted
        //and that we can predict from this known position instead

          //remove the rest of the inputs we have confirmed on the server
        var number_to_clear = Math.abs(lastinputseq_index - (-1));
        this.players.self.inputs.splice(0, number_to_clear);
          //The player is now located at the new server position, authoritive server
        this.players.self.cur_state.pos = this.pos(my_server_pos);
        this.players.self.last_input_seq = lastinputseq_index;
          //Now we reapply all the inputs that we have locally that
          //the server hasn't yet confirmed. This will 'keep' our position the same,
          //but also confirm the server position at the same time.
          //Work out the time we have since we updated the state
        var delta = (this.local_time - this.players.self.state_time) / this._pdt;
        this.emit('updateClientPhysics', delta)
      }
    }

}

Multiplayer.prototype.clientProcessUpdates = function() {

  if(!this.server_updates.length) return

  //First : Find the position in the updates, on the timeline
  //We call this current_time, then we find the past_pos and the target_pos using this,
  //searching throught the server_updates array for current_time in between 2 other times.
  // Then :  other player position = lerp ( past_pos, target_pos, current_time );

  //Find the position in the timeline of updates we stored.
  var current_time = this.client_time;
  var count = this.server_updates.length-1;
  var target = null;
  var previous = null;

    //We look from the 'oldest' updates, since the newest ones
    //are at the end (list.length-1 for example). This will be expensive
    //only when our time is not found on the timeline, since it will run all
    //samples. Usually this iterates very little before breaking out with a target.
  for(var i = 0; i < count; ++i) {

    var point = this.server_updates[i];
    var next_point = this.server_updates[i+1];

      //Compare our point in time with the server times we have
    if(current_time > point.time && current_time < next_point.time) {
      target = next_point;
      previous = point;
      break;
    }
  }

  //With no target we store the last known
  //server position and move to that instead
  if (!target) {
    target = this.server_updates[0];
    previous = this.server_updates[0];
  }

  //Now that we have a target and a previous destination,
  //We can interpolate between then based on 'how far in between' we are.
  //This is simple percentage maths, value/target = [0,1] range of numbers.
  //lerp requires the 0,1 value to lerp to? thats the one.

   if(target && previous) {

     this.target_time = target.time;
   
     var difference = this.target_time - current_time;
     var max_difference = +(target.time - previous.time).toFixed(3);
     var time_point = +(difference/max_difference).toFixed(3);
 
     //Because we use the same target and previous in extreme cases
     //It is possible to get incorrect values due to division by 0 difference
     //and such. This is a safe guard and should probably not be here. lol.
     if( isNaN(time_point) ) time_point = 0;
     if(time_point == -Infinity) time_point = 0;
     if(time_point == Infinity) time_point = 0;
   
     //The most recent server update
     var latest_server_data = this.server_updates[ this.server_updates.length-1 ];
   
     //Now, if not predicting client movement , we will maintain the local player position
     //using the same method, smoothing the players information from the past.
   
     //These are the exact server positions from this tick, but only for the ghost
     var my_server_pos = this.players.self.host ? latest_server_data.hp : latest_server_data.cp;
   
     //The other players positions in this timeline, behind us and in front of us
     var my_target_pos = this.players.self.host ? target.hp : target.cp;
     var my_past_pos = this.players.self.host ? previous.hp : previous.cp;
   
     var local_target = my_past_pos.lerp(my_target_pos, time_point)
   
     //Smoothly follow the destination position
     this.players.self.pos = this.players.self.pos.lerp( local_target, this._pdt*this.client_smooth);
   
  }
}
;
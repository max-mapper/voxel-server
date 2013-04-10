var server = require('./')()
var port = 8080
server.listen(port)
console.log('Listening on ', port, ' open http://localhost:', port)
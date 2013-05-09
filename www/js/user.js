module.exports = function() {
  var Users = function (opts, cb) {
    this.user = new User(opts, cb)
    this.addUser  = addUser(opts, )
  }
  var User = function (opts, cb) {
    this.login = opts.login;
    this.password = opts.password;
    this.username = opts.username;
    this.gravitar = opts.gravitar;
    this.addUser = addUser()
  };

  function addUser (source, sourceUser) {
    var user;
    if (arguments.length === 1) { // password-based
      user = sourceUser = source;
      user.id = ++nextUserId;
      return usersById[nextUserId] = user;
    } else { // non-password-based
      user = usersById[++nextUserId] = {id: nextUserId};
      user[source] = sourceUser;
    }
    username = user;
    return user;
  }
}
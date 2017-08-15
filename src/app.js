//node_modules config
const session = require('express-session');
const bodyParser = require('body-parser');
const Sequelize = require('sequelize');
const bcrypt = require('bcrypt')
const express = require('express');
const app = express();
const sequelize = new Sequelize('blog_application', process.env.POSTGRES_USER, null, {
  host: 'localhost',
  dialect: 'postgres'
})

//view engine config
app.set('views', __dirname + '/views');
app.set('view engine', 'pug');

//setting up static files, bodyparser and the session
app.use(express.static(__dirname + '/../public'));
app.use('/', bodyParser.urlencoded({ extended: true }));
app.use(session({
  secret: "any string",
  saveUninitialized: true,
  resave: false
}));

//--------------------------------------MODEL DEFINITION--------------------------------------
var UsersTable = sequelize.define('users', {
	firstname: Sequelize.STRING,
	lastname: Sequelize.STRING,
  email: {
    type: Sequelize.STRING,
    unique: true
  },
  password: {
    type: Sequelize.STRING,
  }
}, {
  timestamps: false
});

var PostsTable = sequelize.define('posts', {
  title: Sequelize.TEXT,
	body: Sequelize.TEXT
}, {
  timestamps: false
});

var CommentsTable = sequelize.define('comments', {
	comment: Sequelize.TEXT
},{
  timestamps: false
});

//associations
UsersTable.hasMany(PostsTable);
UsersTable.hasMany(CommentsTable);
PostsTable.hasMany(CommentsTable);
PostsTable.belongsTo(UsersTable);
CommentsTable.belongsTo(UsersTable);
CommentsTable.belongsTo(PostsTable);

//sync
sequelize.sync({force: false});

//--------------------------------------GET--------------------------------------
app.get('/', function(req, res) {
	res.render('index', {
    errormessage: req.query.message,
    user: req.session.user
  });
});

//register form
app.get('/register', function(req, res) {
	res.render('register');
});

//Timeline (list of everyone's posts)
app.get('/timeline', function(req, res) {

  var user = req.session.user;

  if (user === undefined) {
    res.redirect('/?message=' + encodeURIComponent("Please log in to view the timeline"));
  } else {
    UsersTable.findAll()
    .then((users) => {
      PostsTable.findAll({
          include: [{
              model: CommentsTable,
              as: "comments"
            }]
      })
    	.then((posts) => {
        // console.log("TEST:" + allFoundPosts[0].user.dataValues.firstname);
        // console.log("DOEI:" + posts[0].comments[0].comment);
    		res.render('timeline', {
          usersList: users,
    			postsList: posts,
          errormessage: req.query.message
    		})
    	})
    	.catch((error) => {
    		console.error(error);
    	});
    })
  }

});

//profile-page
app.get('/users/:firstname', function(req, res) {

  var user = req.session.user;

  if (user === undefined) {
    res.redirect('/?message=' + encodeURIComponent("Please log in to view your profile"));
  } else {
    UsersTable.findAll()
    .then((users) => {
      PostsTable.findAll({
          where: {
            userId: req.session.user.id
          },
          include: [{
              model: CommentsTable,
              as: "comments"
            }]
      })
    	.then((posts) => {
    		res.render('profile', {
          usersList: users,
    			postsList: posts,
          user: user,
          errormessage: req.query.message
    		})
    	})
    	.catch((error) => {
    		console.error(error);
    	});
    })
  }

});

//delete a post
app.get('/deletePost/:id', (req, res) => {
  var idPost = req.params.id;

  PostsTable.destroy({
    where: {
      id: idPost
    }
  })
  .then(() => {
    res.redirect('/timeline')
  })
  .catch((error) => {
    console.error(error);
  });

})

//log out and destroy the session
app.get('/logout', (req, res) => {
    req.session.destroy((error) => {
      if(error) {
        throw error;
      }
    });

    res.redirect('/?message=' + encodeURIComponent("Succesfully logged out"));
})

//--------------------------------------POST--------------------------------------
app.post('/signup', function(req, res) {

    bcrypt.hash(req.body.password, 10)
    .then((hash) => {
      UsersTable.create({
        firstname: req.body.firstname,
        lastname: req.body.lastname,
        email: req.body.email,
        password: hash
      })
    })
    .then((user) => {
			req.session.user = user;
      res.redirect('/users/' + user.firstname);
		})
		.catch((error) => {
			console.error(error);
		});

});

//login
app.post('/login', function(req, res){

  let pw = req.body.password;
  let email = req.body.email;

  UsersTable.findOne({
    where: {
      email: email
    }
  })
  .then(function(user){
    hash = user.password;

    bcrypt.compare(pw, hash).then((res) => {
      if(res === true) {
        res.redirect('/timeline')
      } else {
        res.redirect('/?message=' + encodeURIComponent('Invalid email or password!'))
      }
    })
  })
  .catch((error) => {
    console.error(error);
    res.redirect('/?message=' + encodeURIComponent('Invalid email or password!'));
  });

  // if(bcrypt.compare(pw, hash).then((res) => {return res;})) {
  //   res.redirect('/timeline');
  // } else {
  //   res.redirect('/?message=' + encodeURIComponent('Invalid email or password!'));
  // }

})

//new post
app.post('/timeline/new', function(req, res) {

  PostsTable.create({
    title: req.body.title,
    body: req.body.body,
    userId: req.session.user.id
  })
  .then(function(user){
    console.log("message posted");
    var user = req.session.user;
    res.redirect('/users/' + user.firstname);
  })
  .catch((error) => {
  	console.error(error);
  });

})

//add a comment
app.post('/addComment', function(req, res) {

  var user = req.session.user.firstname;
  var postid = req.body.postId;
  var comment = req.body.comment;

  UsersTable.findOne({
    where: {
      firstname: user
    }
  })
  .then(function(user){
    return user.createComment({
      comment: comment,
      userId: user.id,
      postId: postid
    })
  })
  .then(function(){
    res.redirect('/timeline')
  })

})

//start listening
var server = app.listen(4000, () => {
	console.log('Blog App listening on port: ' + server.address().port);
});

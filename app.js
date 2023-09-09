require("dotenv").config();
const express = require("express");
const ejs = require("ejs");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
var GoogleStrategy = require("passport-google-oauth20").Strategy;
var findOrCreate = require("mongoose-findorcreate");
const _ = require("lodash");
const { title } = require("process");

// setting app

const app = express();

app.use(express.static("public"));
app.set("view engine", "ejs");
app.use(
  bodyParser.urlencoded({
    extended: true,
  })
);

app.use(
  session({
    secret: "this is our little secret.",
    resave: false,
    saveUninitialized: false,
  })
);

app.use(passport.initialize());
app.use(passport.session());

// connection with mongoDB

mongoose.connect(process.env.MONGODB_URL, {
  useNewUrlParser: true,
});

// creating schemas

// user schema
const userSchema = new mongoose.Schema({
  username: String,
  password: String,
  googleId: String,
});

// blog schema
const blogSchema = new mongoose.Schema({
  username: String,
  title: String,
  type: String,
  date: String,
  content: String,
});

// adding plugins
userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

// model creation for each schema
const User = new mongoose.model("User", userSchema);
const Blog = new mongoose.model("Blog", blogSchema);

// passport strategy
passport.use(User.createStrategy());

passport.serializeUser(function (user, done) {
  done(null, user);
});

passport.deserializeUser(function (user, done) {
  done(null, user);
});

// passport using google auth
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "http://localhost:4000/auth/google/blogs",
    },
    function (accessToken, refreshToken, profile, cb) {
      // console.log(profile);
      User.findOrCreate(
        { googleId: profile.id, username: profile.displayName },
        function (err, user) {
          return cb(err, user);
        }
      );
    }
  )
);

// Starting content
const homeStartingContent =
  "Introducing Blogster, the ultimate platform that caters to the needs of everyone. Whether you're a tech enthusiast, a fashion aficionado, a foodie, or a travel junkie, Blogster has something to offer you. With an extensive range of categories, our platform covers a wide spectrum of interests, ensuring that you find compelling and relevant content. Engage with passionate bloggers, gain insights, and stay updated on the latest trends. From informative articles to captivating stories, Blogster is your go-to destination. Join our inclusive community, broaden your horizons, and unleash your creativity. With Blogster, knowledge, inspiration, and entertainment are just a click away.";

// authentication with google
app.get(
  "/auth/google/blogs",
  passport.authenticate("google", { failureRedirect: "/login" }),
  function (req, res) {
    // Successful authentication, redirect secrets page.
    res.redirect("/");
  }
);
app.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile"] })
);

// "/" route : redirect to login page
app.get("/", (req, res) => {
  if (req.isAuthenticated()) {
    res.redirect("/skip");
  } else {
    res.render("login");
  }
});

// skip link on login and register page : redirect to home page without authentication
app.get("/skip", (req, res) => {
  res.redirect("/home");
});

// home page
app.get("/home", (req, res) => {
  const findBlog = async () => {
    const found = await Blog.find({});
    // console.log(found);
    res.render("home", {
      homeStartingContent: homeStartingContent,
      posts: found,
    });
  };
  findBlog();
});

// compose page : only can be open after authentication
app.get("/compose", (req, res) => {
  if (req.isAuthenticated()) {
    // console.log(req.user);
    res.render("compose");
  } else {
    res.redirect("/login");
  }
});

// post route for compose
app.post("/compose", (req, res) => {
  if (req.isAuthenticated()) {
    // res.render("submit");
    const title = _.capitalize(req.body.title);
    // console.log(req.user);
    const type = req.body.type;
    const content = req.body.content;
    var objToday = new Date(),
      weekday = new Array(
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday"
      ),
      dayOfWeek = weekday[objToday.getDay()],
      domEnder = (function () {
        var a = objToday;
        if (/1/.test(parseInt((a + "").charAt(0)))) return "th";
        a = parseInt((a + "").charAt(1));
        return 1 == a ? "st" : 2 == a ? "nd" : 3 == a ? "rd" : "th";
      })(),
      dayOfMonth =
        today + (objToday.getDate() < 10)
          ? "0" + objToday.getDate() + domEnder
          : objToday.getDate() + domEnder,
      months = new Array(
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December"
      ),
      curMonth = months[objToday.getMonth()],
      curYear = objToday.getFullYear(),
      curHour =
        objToday.getHours() > 12
          ? objToday.getHours() - 12
          : objToday.getHours() < 10
          ? "0" + objToday.getHours()
          : objToday.getHours(),
      curMinute =
        objToday.getMinutes() < 10
          ? "0" + objToday.getMinutes()
          : objToday.getMinutes(),
      curSeconds =
        objToday.getSeconds() < 10
          ? "0" + objToday.getSeconds()
          : objToday.getSeconds(),
      curMeridiem = objToday.getHours() > 12 ? "PM" : "AM";
    var today =
      dayOfWeek + " " + dayOfMonth + " of " + curMonth + ", " + curYear;
    // console.log(today);
    const date = today;
    const blog = new Blog({
      username: req.user.username,
      type: type,
      title: title,
      date: date,
      content: content,
    });
    blog.save();
    res.redirect("/home");
  } else {
    res.redirect("/register");
  }
});

// specific page for each blog
app.get("/post/:title", (req, res) => {
  // console.log(req.params.title);
  let title = _.capitalize(req.params.title);
  const findBlog = async () => {
    const found = await Blog.findOne({ title: title });
    if (!found) {
      res.render("soon");
    } else {
      res.render("post", {
        title: found.title,
        date: found.date,
        content: found.content,
        type: found.type,
        username: found.username,
      });
    }
  };
  findBlog();
});

// for each title
app.get("/World", (req, res) => {
  // console.log(req.user);
  const find = async () => {
    const found = await Blog.find({ type: "World" });
    // console.log(found);
    if (found.length != 0)
      res.render("type", { title: "World", found: found, mine: false });
    else res.render("soon");
  };
  find();
});

app.get("/India", (req, res) => {
  const find = async () => {
    const found = await Blog.find({ type: "India" });
    // console.log(found);
    if (found.length != 0)
      res.render("type", { title: "India", found: found, mine: false });
    else res.render("soon");
  };
  find();
});
app.get("/Technology", (req, res) => {
  const find = async () => {
    const found = await Blog.find({ type: "Technology" });
    // console.log(found);
    if (found.length != 0)
      res.render("type", { title: "Technology", found: found, mine: false });
    else res.render("soon");
  };
  find();
});
app.get("/Design", (req, res) => {
  const find = async () => {
    const found = await Blog.find({ type: "Design" });
    // console.log(found);
    if (found.length != 0)
      res.render("type", { title: "Design", found: found, mine: false });
    else res.render("soon");
  };
  find();
});
app.get("/Culture", (req, res) => {
  const find = async () => {
    const found = await Blog.find({ type: "Culture" });
    // console.log(found);
    if (found.length != 0)
      res.render("type", { title: "Culture", found: found, mine: false });
    else res.render("soon");
  };
  find();
});
app.get("/Business", (req, res) => {
  const find = async () => {
    const found = await Blog.find({ type: "Business" });
    // console.log(found);
    if (found.length != 0)
      res.render("type", { title: "Business", found: found, mine: false });
    else res.render("soon");
  };
  find();
});
app.get("/Politics", (req, res) => {
  const find = async () => {
    const found = await Blog.find({ type: "Politics" });
    // console.log(found);
    if (found.length != 0)
      res.render("type", { title: "Politics", found: found, mine: false });
    else res.render("soon");
  };
  find();
});
app.get("/Opinion", (req, res) => {
  const find = async () => {
    const found = await Blog.find({ type: "Opinion" });
    // console.log(found);
    if (found.length != 0)
      res.render("type", { title: "Opinion", found: found, mine: false });
    else res.render("soon");
  };
  find();
});
app.get("/Science", (req, res) => {
  const find = async () => {
    const found = await Blog.find({ type: "Science" });
    // console.log(found);
    if (found.length != 0)
      res.render("type", { title: "Science", found: found, mine: false });
    else res.render("soon");
  };
  find();
});
app.get("/Health", (req, res) => {
  const find = async () => {
    const found = await Blog.find({ type: "Health" });
    // console.log(found);
    if (found.length != 0)
      res.render("type", { title: "Health", found: found, mine: false });
    else res.render("soon");
  };
  find();
});
app.get("/Style", (req, res) => {
  const find = async () => {
    const found = await Blog.find({ type: "Style" });
    // console.log(found);
    if (found.length != 0)
      res.render("type", { title: "Style", found: found, mine: false });
    else res.render("soon");
  };
  find();
});

app.get("/Travel", (req, res) => {
  const find = async () => {
    const found = await Blog.find({ type: "Travel" });
    // console.log(found);
    if (found.length != 0)
      res.render("type", { title: "Travel", found: found, mine: false });
    else res.render("soon");
  };
  find();
});

// find route with all blogs list
app.get("/Find", (req, res) => {
  const find = async () => {
    const found = await Blog.find({});
    // console.log(found);
    if (found.length != 0)
      res.render("find", {
        title: "Blogs found",
        found: found,
        mine: false,
        search: false,
      });
    else res.render("soon");
  };
  find();
});

// post find route : type == title -> specific page
//                   type == user  -> list of blogs for the user
app.post("/Find", (req, res) => {
  const type = req.body.type;
  // console.log(req.body);
  var search = req.body.search;
  if (type !== "username") search = _.capitalize(req.body.search);
  // console.log(type, search);
  if (type === "Title") {
    // console.log("Yash");
    const findBlog = async () => {
      const found = await Blog.findOne({ title: search });
      if (!found) {
        res.render("soon");
      } else {
        res.render("post", {
          username: found.username,
          title: found.title,
          date: found.date,
          content: found.content,
          type: found.type,
          error: "",
        });
      }
    };
    findBlog();
  }
  if (type === "username") {
    // console.log("No");
    // console.log(search);
    const findBlog = async () => {
      const found = await Blog.find({ username: search });
      if (!found) {
        // res.render("soon");
        res.render("find", {
          title: "No blogs found",
          found: [],
          mine: false,
          search: true,
          error: `No blog found for username : ${search}`,
        });
      } else {
        // res.render("post", {
        //   title: found.title,
        //   date: found.date,
        //   content: found.content,
        //   type: found.type,
        // });
        // console.log(found);
        res.render("find", {
          title: "Blogs found",
          found: found,
          mine: false,
          search: true,
          error: "",
        });
      }
    };
    findBlog();
    // res.redirect("/");
  }
});

app.get("/Mine", (req, res) => {
  if (req.isAuthenticated()) {
    const find = async () => {
      const found = await Blog.find({ username: req.user.username });
      // console.log(found);
      if (found.length != 0)
        res.render("type", {
          title: "Your Activity",
          found: found,
          mine: true,
        });
      else res.render("soon");
    };
    find();
  } else {
    res.redirect("/login");
  }
});

app.post("/delete", (req, res) => {
  // console.log(req.body);
  let toRender = req.body.title;
  if (req.body.title == "Your Activity") {
    toRender = "Mine";
  }
  const deleleItem = async () => {
    await Blog.findOneAndRemove({
      _id: req.body.deleteID,
    });
  };
  deleleItem();
  res.redirect("/" + toRender);
});

//login and register
app.get("/login", (req, res) => {
  res.render("login");
});

app.post("/login", (req, res) => {
  // console.log(req.body);
  const user = new User({
    email: req.body.username,
    password: req.body.password,
  });
  req.login(user, function (err) {
    if (err) {
      console.log(err);
    } else {
      passport.authenticate("local")(req, res, function () {
        res.redirect("/home");
      });
    }
  });
});

app.get("/register", (req, res) => {
  res.render("register");
});

app.post("/register", (req, res) => {
  // console.log(req.body);
  User.register(
    { username: req.body.username },
    req.body.password,
    (err, user) => {
      if (err) {
        console.log(err);
        res.redirect("/register");
      } else {
        passport.authenticate("local")(req, res, () => {
          res.redirect("/home");
        });
      }
    }
  );
});

app.get("/logout", (req, res) => {
  req.logout(function (err) {
    if (err) {
      console.log(err);
    }
    res.redirect("/");
  });
});

let port = 4000;
if (port == null || port == "") {
  port = 4000;
}
app.listen(port, function (req, res) {
  console.log("Server started on port 4000");
});

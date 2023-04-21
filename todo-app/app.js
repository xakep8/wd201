const express = require("express");
const app = express();
const { Todo,User } = require("./models");
const bodyParser = require("body-parser");
const path = require("path");
var csurf = require("tiny-csrf");
var cookieParser= require("cookie-parser");
var passport=require("passport");
var connectEnsureLogin=require("connect-ensure-login");
var session=require("express-session");
var LocalStrategy=require("passport-local");
var bcrypt=require("bcrypt");
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser("todo application"));
app.use(csurf("this_should_be_32_character_long",["POST","PUT","DELETE"]));

app.set("view engine", "ejs");

const formattedDate = (d) => {
  return d.toISOString().split("T")[0];
};

var dateToday = new Date();
const today = formattedDate(dateToday);
const yesterday = formattedDate(
  new Date(new Date().setDate(dateToday.getDate() - 1))
);
const tomorrow = formattedDate(
  new Date(new Date().setDate(dateToday.getDate() + 1))
);

const saltRounds=10;

app.use(express.static(path.join(__dirname, "public")));

app.use(session({
  secret:"the-key-to-future-login-lies-here-84482828282",
  cookie:{
    maxAge: 24*60*60*1000
  }
}));

app.use(passport.initialize());
app.use(passport.session());

passport.use(new LocalStrategy({
  usernameField:'email',
  passwordField:'password'
},(username,password,done)=>{
  User.findOne({where:{email:username,password:password}})
  .then((user)=>{
    return done(null,user);
  }).catch((error)=>{
    return (error);
  })
}));

passport.serializeUser((user,done)=>{
  console.log("Serializing user in session",user.id);
  done(null,user.id);
})

passport.deserializeUser((id,done)=>{
  User.findByPk(id).then(user=>{
    done(null,user);
  }).catch(error=>{
    done(error,null);
  })
});

app.get("/", async function (request, response) {
  response.render("index",{
    title:"Todo application",
    csrfToken:request.csrfToken(),
  });
});

app.get("/signup",(request,response)=>{
  response.render("signup",{title:"Signup",csrfToken:request.csrfToken()});
});

app.post("/users",async (request,response)=>{
  const hashedPwd= await bcrypt.hash(request.body.password,saltRounds);
  try{
    const user=await User.create({
      firstName: request.body.firstName,
      lastName:request.body.lastName,
      email:request.body.email,
      password: hashedPwd
    });
    request.login(user,(err)=>{
      if(err){
        console.log(err);
      }
      response.redirect("/todos");
    });
  }
  catch(error){
    console.log(error);
  }
});

app.get("/todos", connectEnsureLogin.ensureLoggedIn(), async function (request, response) {
  const overdue = await Todo.overdue();
  const dueToday=await Todo.dueToday();
  const dueLater=await Todo.dueLater();
  const completedItems=await Todo.completedItems();
  if (request.accepts("html")) {
    response.render("todos",{
        overdue,
        dueToday,
        dueLater,
        completedItems,
        csrfToken: request.csrfToken(),
    });
  } else {
    response.json({
      overdue,
      dueToday,
      dueLater,
      completedItems,
    });
  }
});

app.get("/todos/:id", async function (request, response) {
  try {
    const todo = await Todo.findByPk(request.params.id);
    return response.json(todo);
  } catch (error) {
    console.log(error);
    return response.status(422).json(error);
  }
});

app.post("/todos", async function (request, response) {
  console.log("Creating a todo", request.body);
  try {
    await Todo.addTodo({
      title: request.body.title,
      dueDate: request.body.dueDate,
    });
    return response.redirect("/");
  } catch (error) {
    console.log(error);
    return response.status(422).json(error);
  }
});

app.put("/todos/:id", async function (request, response) {
  const todo = await Todo.findByPk(request.params.id);
  const state=request.body.completed===true?false:true;
  try {
    const res=await todo.setCompletionStatus(state);
    return response.json(res);
  } catch (error) {
    console.log(error);
    return response.status(422).json(error);
  }
});

app.delete("/todos/:id", async function (request, response) {
  console.log("We have to delete a Todo with ID: ", request.params.id);
  console.log("Delete a todo by ID",request.params.id);
  try{
    await Todo.remove(request.params.id);
    return response.json({success:true});
  }
  catch(error){
    return response.status(422).json(error);
  }
});

module.exports = app;

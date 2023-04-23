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
const flash=require("connect-flash");
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
app.set("views", path.join(__dirname, "views"));
app.use(flash());

app.use(session({
  secret:"the-key-to-future-login-lies-here-84482828282",
  cookie:{
    maxAge: 24*60*60*1000
  }
}));

app.use(function (request,response,next){
  response.locals.messages=request.flash();
  next();
});

app.use(passport.initialize());
app.use(passport.session());

passport.use(new LocalStrategy({
  usernameField:'email',
  passwordField:'password'
},(username,password,done)=>{
  User.findOne({where:{email:username}})
  .then(async (user)=>{
    const result=await bcrypt.compare(password,user.password);
    if(result){
      return done(null,user);
    }
    else{
      return done(null,false,{message:"Invalid Password"});
    }
  }).catch((error)=>{
    return done(null,false,{message:"User does not exist"});
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
  User.deleteAll();
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
  if(request.body.firstName==""){
    request.flash("error","First name cannot be left blank");
    return response.redirect("/signup");
  }
  if(request.body.email==""){
    request.flash("error","Email cannot be left blank");
    return response.redirect("/signup");
  }
  if(request.body.password==""||request.body.password.length<6){
    request.flash("error","Please enter a valid password of minimum length of 6 characters");
    return response.redirect("/signup");
  }
  try{
    const user=await User.create({
      firstName: request.body.firstName,
      lastName:request.body.lastName,
      email:request.body.email,
      password: hashedPwd,
    });
    request.login(user,(err)=>{
      if(err){
        console.log(err);
      }
      response.redirect("/todos");
    });
  }
  catch(error){
    request.flash("error","Email already registered");
    response.redirect("/signup");
    console.log(error);
  }
});

app.get("/signout",connectEnsureLogin.ensureLoggedIn(),(request,response,next)=>{
  request.logout((err)=>{
    if(err){
      return next(err);
    }
    response.redirect("/");
  });
});

app.get("/login",(request,response)=>{
  response.render("login",{title:"Login", csrfToken:request.csrfToken()});
});

app.post("/session",passport.authenticate('local',{failureRedirect:'/login',failureFlash:true,}) ,(request,response)=>{
  response.redirect("/todos");
})

app.get("/todos", connectEnsureLogin.ensureLoggedIn(), async function (request, response) {
  console.log(request.user.id);
  const acc=await User.findByPk(request.user.id);
  const userName=acc.firstName+" "+acc.lastName;
  const overdue = await Todo.overdue(request.user.id);
  const dueToday=await Todo.dueToday(request.user.id);
  const dueLater=await Todo.dueLater(request.user.id);
  const completedItems=await Todo.completedItems(request.user.id);
  if (request.accepts("html")) {
    response.render("todos",{
        overdue,
        dueToday,
        dueLater,
        completedItems,
        userName,
        csrfToken: request.csrfToken(),
    });
  } else {
    response.json({
      overdue,
      dueToday,
      dueLater,
      completedItems,
      userName,
    });
  }
});

app.get("/todos/:id",connectEnsureLogin.ensureLoggedIn(), async function (request, response) {
  try {
    const todo = await Todo.findByPk(request.params.id);
    return response.json(todo);
  } catch (error) {
    console.log(error);
    return response.status(422).json(error);
  }
});

app.post("/todos",connectEnsureLogin.ensureLoggedIn(), async function (request, response) {
  console.log("Creating a todo", request.body);
  console.log(request.user);
  if(request.body.title==""){
    request.flash("error","To-Dos cannot be blank");
    return response.redirect("/todos");
  }
  else if(request.body.dueDate==""){
    request.flash("error","Date is required to make a To-Do");
    return response.redirect("/todos");
  }
  try {
    await Todo.addTodo({
      title: request.body.title,
      dueDate: request.body.dueDate,
      userId: request.user.id,
    });
    return response.redirect("/todos");
  } catch (error) {
    console.log(error);
    return response.status(422).json(error);
  }
});

app.put("/todos/:id",connectEnsureLogin.ensureLoggedIn(), async function (request, response) {
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

app.delete("/todos/:id",connectEnsureLogin.ensureLoggedIn(), async function (request, response) {
  console.log("We have to delete a Todo with ID: ", request.params.id);
  console.log("Delete a todo by ID",request.params.id);
  try{
    await Todo.remove(request.params.id,request.user.id);
    return response.json({success:true});
  }
  catch(error){
    return response.status(422).json(error);
  }
});

module.exports = app;

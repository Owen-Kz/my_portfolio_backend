const express = require("express")

const dotenv = require("dotenv").config();
const app =  express();
const cookie = require("cookie-parser");
const PORT = process.env.PORT || 16000;
const server = require("http").Server(app)
// const session = require("express-session");
const bcrypt = require("bcryptjs");
const bodyParser = require("body-parser");

 
// app.use(bodyParser.json());

app.use(bodyParser.urlencoded({ extended: true, limit: '100mb'}));
app.use(bodyParser.json({
    verify: function (req, res, buf) {
      req.rawBody = buf;
    }, limit: '100mb', extended:true
  }));
    
app.use(cookie());
  app.use(express.json({ limit: '100mb' })); // For JSON bodies
  app.use(express.urlencoded({ limit: '100mb', extended: true })); // For URL-encoded bodies






app.use("/", require(__dirname +"/routes/pages"));


server.listen(PORT); 
console.log("Server is running on", PORT) 
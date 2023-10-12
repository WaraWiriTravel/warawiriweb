const express = require("express");
const bodyParser = require("body-parser");

const app = express();
app.use(express.static("public"));

app.set("view engine", "ejs");

app.get("/", (req, res) => {
  res.render("home");
});

app.listen(2023, function () {
  console.log("Server berjalan di http://localhost:2023");
});

const express = require("express");
const bodyParser = require("body-parser");
const admin = require("firebase-admin");
const path = require("path");
const multer = require("multer");

const serviceAccount = require("./warawiriweb-alphetor-firebase-adminsdk-g58h2-354dad6595.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
const storage = admin.storage().bucket("warawiriweb-alphetor.appspot.com");

const app = express();
app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));

const storageMulter = multer.memoryStorage();
const upload = multer({ storage: storageMulter });

app.set("view engine", "ejs");

app.post("/createpost", upload.single("image"), (req, res) => {
  const title = req.body.title;
  const content = req.body.content;
  const imageBuffer = req.file.buffer;

  const postRef = db.collection("Blogs").doc();
  const documentID = postRef.id;
  const storageFolder = `Blogs/${documentID}/`;
  const fileName = req.file.originalname;

  const file = storage.file(storageFolder + fileName);

  file.save(imageBuffer, {
    metadata: {
      contentType: req.file.mimetype,
    },
    predefinedAcl: "publicRead",
  }, (err) => {
    if (err) {
      res.send("Error: " + err);
    } else {
      const imageUrl = `https://storage.googleapis.com/${storage.name}/${storageFolder}${fileName}`;

      const timestamp = admin.firestore.FieldValue.serverTimestamp();

      postRef.set({
        title: title,
        content: content,
        imageUrl: imageUrl,
        timestamp: timestamp,
      })
      .then(() => {
        res.redirect("/dbtest");
      })
      .catch(error => {
        res.send("Error: " + error);
      });
    }
  });
});

app.get("/", (req, res) => {
  res.render("home");
});

app.get("/about", (req, res) => {
  res.render("about");
});

app.get("/blog", (req, res) => {
  res.render("blog");
});

app.get("/blog-detail", (req, res) => {
  res.render("blog-detail");
});

app.get("/dbtest", (req, res) => {
  db.collection("Blogs")
    .orderBy("timestamp", "desc")
    .get()
    .then(snapshot => {
      const blogs = [];
      snapshot.forEach(doc => {
        blogs.push({
          documentID: doc.id,
          ...doc.data(),
        });
      });

      res.render("dbtest", { blogs: blogs });
    })
    .catch(error => {
      res.send("Error: " + error);
    });
});

app.listen(2023, function () {
  console.log("Server berjalan di http://localhost:2023");
});

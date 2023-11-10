const express = require("express");
const session = require("express-session");
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

// create session middleware
app.use(
  session({
    secret: "not_yet_environmentized",
    resave: false,
    saveUninitialized: false,
  })
);

// temporary user for auth checking => PINDAHIN KE DATABASE NANTI
const users = [
  {
    id: 1,
    username: "admin",
    password: "admin",
  },
];

const requireAuth = (req, res, next) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }
  next();
};

const storageMulter = multer.memoryStorage();
const upload = multer({ storage: storageMulter });

app.set("view engine", "ejs");

app.get("/", (req, res) => {
  res.render("home");
});

app.get("/about", (req, res) => {
  res.render("about");
});

app.get("/blog", (req, res) => {
  db.collection("Blogs")
    .orderBy("timestamp", "desc")
    .get()
    .then((snapshot) => {
      const blogs = [];
      snapshot.forEach((doc) => {
        blogs.push({
          documentID: doc.id,
          ...doc.data(),
        });
      });

      res.render("blog", { blogs: blogs });
    })
    .catch((error) => {
      res.send("Error: " + error);
    });
});

app.get("/blog-detail-:title", (req, res) => {
  const title = req.params.title;
  let blogData;

  db.collection("Blogs")
    .get()
    .then((snapshot) => {
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.title === title) {
          blogData = data;
        }
      });

      if (blogData) {
        res.render("blog-detail", { blog: blogData });
      } else {
        res.send("Blog not found");
      }
    })
    .catch((error) => {
      res.send("Error: " + error);
    });
});

app.get("/faq", (req, res) => {
  res.render("faq");
});

app.get("/contact", (req, res) => {
  res.render("contact");
});

app.get("/login", (req, res) => {
  res.render("login");
});

//test untuk database, tambah baris baru diatas ini
app.post("/createpost", upload.single("image"), (req, res) => {
  const title = req.body.title;
  const content = req.body.content;
  const imageBuffer = req.file.buffer;

  const postRef = db.collection("Blogs").doc();
  const documentID = postRef.id;
  const storageFolder = `Blogs/${documentID}/`;
  const fileName = req.file.originalname;

  const file = storage.file(storageFolder + fileName);

  file.save(
    imageBuffer,
    {
      metadata: {
        contentType: req.file.mimetype,
      },
      predefinedAcl: "publicRead",
    },
    (err) => {
      if (err) {
        res.send("Error: " + err);
      } else {
        const imageUrl = `https://storage.googleapis.com/${storage.name}/${storageFolder}${fileName}`;

        const timestamp = admin.firestore.FieldValue.serverTimestamp();

        postRef
          .set({
            title: title,
            content: content,
            imageUrl: imageUrl,
            timestamp: timestamp,
          })
          .then(() => {
            res.redirect("/dbtest");
          })
          .catch((error) => {
            res.send("Error: " + error);
          });
      }
    }
  );
});

app.post("/updatepost", upload.single("newImage"), async (req, res) => {
  const title = req.body.title;
  const content = req.body.content;
  const documentID = req.body.ID;

  try {
    const oldPost = await db.collection("Blogs").doc(documentID).get();
    if (oldPost.exists) {
      const oldData = oldPost.data();
      if (oldData.imageUrl) {
        const oldImageUrl = oldData.imageUrl;
        const fileName = oldImageUrl.split("/").pop();
        const storageFolder = `Blogs/${documentID}/`;

        const oldFile = storage.file(storageFolder + fileName);
        await oldFile.delete();
      }
    }

    let imageUrl;

    if (req.file && req.file.buffer) {
      const imageBuffer = req.file.buffer;
      const storageFolder = `Blogs/${documentID}/`;
      const fileName = req.file.originalname;

      const file = storage.file(storageFolder + fileName);

      await file.save(imageBuffer, {
        metadata: {
          contentType: req.file.mimetype,
        },
        predefinedAcl: "publicRead",
      });

      imageUrl = `https://storage.googleapis.com/${storage.name}/${storageFolder}${fileName}`;
    }

    const postRef = db.collection("Blogs").doc(documentID);
    const timestamp = admin.firestore.FieldValue.serverTimestamp();

    const updateData = {
      title: title,
      content: content,
      timestamp: timestamp,
    };

    if (imageUrl) {
      updateData.imageUrl = imageUrl;
    }

    await postRef.set(updateData, { merge: true });

    console.log("Post updated successfully");
    res.redirect("/dbtest");
  } catch (error) {
    console.log("Error updating post: " + error);
    res.send("Error updating post: " + error);
  }
});

app.post("/deletepost/:documentID", async (req, res) => {
  try {
    const documentID = req.params.documentID;

    const postDoc = await db.collection("Blogs").doc(documentID).get();
    if (!postDoc.exists) {
      res.status(404).send("Post not found");
      return;
    }

    const storageFolder = `Blogs/${documentID}/`;
    await storage.deleteFiles({ prefix: storageFolder });

    await db.collection("Blogs").doc(documentID).delete();

    res.sendStatus(200);
  } catch (error) {
    console.error("Error deleting post:", error);
    res.status(500).send("Error deleting post");
  }
});

app.get("/dbtest", (req, res) => {
  db.collection("Blogs")
    .orderBy("timestamp", "desc")
    .get()
    .then((snapshot) => {
      const blogs = [];
      snapshot.forEach((doc) => {
        blogs.push({
          documentID: doc.id,
          ...doc.data(),
        });
      });

      res.render("dbtest", { blogs: blogs });
    })
    .catch((error) => {
      res.send("Error: " + error);
    });
});

app.get("/dbtest2", (req, res) => {
  const query = req.query;
  res.render("dbtest2", { query });
});

app.post("/login", (req, res) => {
  const { username, password } = req.body;

  const user = users.find((u) => u.username === username && u.password === password);

  if (user) {
    // store user data in the session
    req.session.user = user;
    res.redirect("/home");
  } else {
    res.redirect("/login");
  }
});

app.get("/logout", (req, res) => {
  // destroy session and logout
  req.session.destroy((err) => {
    if (err) {
      console.log(err);
    }
    res.redirect("/");
  });
});

// app.get("/sidebar", (req, res) => {
//   res.render("admin/sidebar");
// });

app.get("/home", requireAuth, (req, res) => {
  res.render("admin/home");
});

app.get("/blog-admin", requireAuth, (req, res) => {
  res.render("admin/blog-admin");
});

app.get("/tambah-berita", requireAuth, (req, res) => {
  res.render("admin/tambah-berita");
});

app.get("/edit-berita", requireAuth, (req, res) => {
  res.render("admin/edit-berita");
});

app.get("/paket", requireAuth, (req, res) => {
  res.render("admin/paket");
});

app.get("/tambah-paket", requireAuth, (req, res) => {
  res.render("admin/tambah-paket");
});

app.get("/edit-paket", requireAuth, (req, res) => {
  res.render("admin/edit-paket");
});

app.get("/info-kontak", requireAuth, (req, res) => {
  res.render("admin/info-kontak");
});

app.get("/newsletter", requireAuth, (req, res) => {
  res.render("admin/newsletter");
});

app.get("/tambah-newsletter", requireAuth, (req, res) => {
  res.render("admin/tambah-newsletter");
});

app.listen(process.env.PORT || 2023, function () {
  console.log("Server berjalan di http://localhost:2023");
});

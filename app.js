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
  db.collection("Blogs")
    .orderBy("up_timestamp", "desc")
    .get()
    .then((snapshot) => {
      const blogs = [];
      const highlightBlogs = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.status === "on") {
          highlightBlogs.push({
            documentID: doc.id,
          ...data,
          });
        } else {
          blogs.push({
            documentID: doc.id,
            ...data,
          });
        }
      });

      const x = 3 - highlightBlogs.length;
      if (x !== 0) {
        highlightBlogs.push(...blogs.slice(0, x));
        blogs.splice(0, x);
      };

      res.render("home", { highlightBlogs: highlightBlogs });
    })
    .catch((error) => {
      res.send("Error: " + error);
    });
});

app.get("/about", (req, res) => {
  res.render("about");
});

app.get("/blog", (req, res) => {
  db.collection("Blogs")
    .orderBy("up_timestamp", "desc")
    .get()
    .then((snapshot) => {
      const blogs = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        blogs.push({
          documentID: doc.id,
          ...data,
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

app.get("/pricing", (req, res) => {
  db.collection("Paket")
    .orderBy("up_timestamp", "desc")
    .get()
    .then((snapshot) => {
      const paket = [];
      snapshot.forEach((doc) => {
        paket.push({
          documentID: doc.id,
          ...doc.data(),
        });
      });

      res.render("packet-pricing", { pakets: paket });
    })
    .catch((error) => {
      res.send("Error: " + error);
    });
});

app.get("/paket-detail-:nama", (req, res) => {
  const nama = req.params.nama;
  let paketData;

  db.collection("Paket")
    .get()
    .then((snapshot) => {
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.nama === nama) {
          paketData = data;
        }
      });

      if (paketData) {
        res.render("packet-pricing-details", { paket: paketData });
      } else {
        res.send("Item not found");
      }
    })
    .catch((error) => {
      res.send("Error: " + error);
    });
});

app.post("/createpost", upload.single("gambar"), (req, res) => {
  const title = req.body.judul;
  const content = req.body.Berita;
  const imageBuffer = req.file.buffer;
  const isHighlight = req.body.status === undefined ? 'off' : req.body.status;

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
            status: isHighlight,
            cr_timestamp: timestamp,
            up_timestamp: timestamp,
          })
          .then(() => {
            res.redirect("/blog-admin");
          })
          .catch((error) => {
            res.send("Error: " + error);
          });
      }
    }
  );
});

app.post("/createItem", upload.array("gambar"), async (req, res) => {
  const namaPaket = req.body.nama;
  const minHarga = req.body.minHarga;
  const maxHarga = req.body.maxHarga;
  const desc = req.body.desc;
  const gambarFiles = req.files;

  const gambarUrls = [];
  const itemRef = db.collection("Paket").doc();

  const documentID = itemRef.id;

  const storagePromises = [];

  gambarFiles.forEach((gambarFile) => {
    const imageBuffer = gambarFile.buffer;
    const fileName = gambarFile.originalname;
    const storageFolder = `Paket/${documentID}/`;
    const fileUrl = `https://storage.googleapis.com/${storage.name}/${storageFolder}${fileName}`;

    const storageFile = storage.file(storageFolder + fileName);

    const storagePromise = new Promise((resolve, reject) => {
      storageFile.save(
        imageBuffer,
        {
          metadata: {
            contentType: gambarFile.mimetype,
          },
          predefinedAcl: "publicRead",
        },
        (err) => {
          if (err) {
            reject(err);
          } else {
            gambarUrls.push(fileUrl);
            resolve();
          }
        }
      );
    });

    storagePromises.push(storagePromise);
  });

  try {
    await Promise.all(storagePromises);

    const timestamp = admin.firestore.FieldValue.serverTimestamp();

    await itemRef.set({
      nama: namaPaket,
      minHarga: minHarga,
      maxHarga: maxHarga,
      desc: desc,
      gambar: gambarUrls,
      cr_timestamp: timestamp,
      up_timestamp: timestamp,
    });

    res.redirect("paket");
  } catch (error) {
    res.send("Error: " + error);
  }
});

app.post("/updatepost", upload.single("newImage"), async (req, res) => {
  let imageUrl;
  const title = req.body.judul;
  const content = req.body.Berita;
  const documentID = req.body.ID;
  const isHighlight = req.body.status === undefined ? 'off' : req.body.status;

  try {
    if (req.body.newImage) {
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
    }

    const postRef = db.collection("Blogs").doc(documentID);
    const timestamp = admin.firestore.FieldValue.serverTimestamp();

    const updateData = {
      title: title,
      content: content,
      up_timestamp: timestamp,
      status: isHighlight,
    };

    if (imageUrl) {
      updateData.imageUrl = imageUrl;
    }

    await postRef.set(updateData, { merge: true });

    console.log("Post updated successfully");
    res.redirect("/blog-admin");
  } catch (error) {
    console.log("Error updating post: " + error);
    res.send("Error updating post: " + error);
  }
});

app.post("/updateItem", upload.array("gambar"), async (req, res) => {
  const documentID = req.body.ID;
  const namaPaket = req.body.nama;
  const minHarga = req.body.minHarga;
  const maxHarga = req.body.maxHarga;
  const desc = req.body.desc;
  const gambarFiles = req.files;

  try {
    let oldImageUrls = [];
    let newImageUrls = [];

    // Get existing images
    const oldPost = await db.collection("Paket").doc(documentID).get();
    if (oldPost.exists) {
      const oldData = oldPost.data();
      if (oldData.gambar) {
        oldImageUrls = oldData.gambar;
      }
    }

    // Delete old images
    for (const oldImageUrl of oldImageUrls) {
      const fileName = oldImageUrl.split("/").pop();
      const storageFolder = `Paket/${documentID}/`;
      const oldFile = storage.file(storageFolder + fileName);
      await oldFile.delete();
    }

    // Upload new images
    for (const file of gambarFiles) {
      const imageBuffer = file.buffer;
      const storageFolder = `Paket/${documentID}/`;
      const fileName = file.originalname;

      const fileRef = storage.file(storageFolder + fileName);

      await fileRef.save(imageBuffer, {
        metadata: {
          contentType: file.mimetype,
        },
        predefinedAcl: "publicRead",
      });

      const imageUrl = `https://storage.googleapis.com/${storage.name}/${storageFolder}${fileName}`;
      newImageUrls.push(imageUrl);
    }

    // Update Firestore document
    const postRef = db.collection("Paket").doc(documentID);
    const timestamp = admin.firestore.FieldValue.serverTimestamp();

    const updateData = {
      nama: namaPaket,
      minHarga: minHarga,
      maxHarga: maxHarga,
      desc: desc,
      up_timestamp: timestamp,
    };

    // Set the gambar field explicitly to the newImageUrls array
    if (newImageUrls.length > 0) {
      updateData.gambar = newImageUrls;
    } else {
      // If there are no new images, you might want to set gambar to an empty array
      updateData.gambar = [];
    }

    await postRef.set(updateData, { merge: true });

    console.log("Item updated successfully");
    res.redirect("/paket");
  } catch (error) {
    console.error("Error updating item:", error);
    res.status(500).send("Error updating item");
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

app.post("/deleteItem/:documentID", async (req, res) => {
  try {
    const documentID = req.params.documentID;

    const paketDoc = await db.collection("Paket").doc(documentID).get();
    if (!paketDoc.exists) {
      res.status(404).send("Item not found");
      return;
    }

    const storageFolder = `Paket/${documentID}/`;
    await storage.deleteFiles({ prefix: storageFolder });

    await db.collection("Paket").doc(documentID).delete();

    res.sendStatus(200);
  } catch (error) {
    console.error("Error deleting item:", error);
    res.status(500).send("Error deleting post");
  }
});

app.post("/updatestatus/:documentID", async (req, res) => {
  const documentID = req.params.documentID;
  const status = req.query.status;
  const timestamp = admin.firestore.FieldValue.serverTimestamp();

  const postRef = db.collection("Blogs").doc(documentID);

  return postRef
    .update({ 
      status: status,
      up_timestamp: timestamp, 
    })
    .then(async () => {
      const querySnapshot = await db
        .collection("Blogs")
        .where("status", "==", "on")
        .orderBy("up_timestamp", "asc")
        .get();

      if (querySnapshot.size > 3) {
        const oldestBlog = querySnapshot.docs[0];
        await oldestBlog.ref.update({ status: "off" });
      } 

      res.sendStatus(200);
    })
    .catch((error) => {
      console.error("Error updating status:", error);
      res.status(500).send("Error updating status");
    });
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
  db.collection("Blogs")
    .orderBy("up_timestamp", "desc")
    .get()
    .then((snapshot) => {
      const blogs = [];
      const highlightBlogs = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.status === "on") {
          highlightBlogs.push({
            documentID: doc.id,
          ...data,
          });
        } else {
          blogs.push({
            documentID: doc.id,
            ...data,
          });
        }
      });

      const x = 3 - highlightBlogs.length;
      if (x !== 0) {
        highlightBlogs.push(...blogs.slice(0, x));
        blogs.splice(0, x);
      };

      res.render("admin/home", { highlightBlogs: highlightBlogs });
    })
    .catch((error) => {
      res.send("Error: " + error);
    });
});

app.get("/blog-admin", requireAuth, (req, res) => {
  db.collection("Blogs")
    .get()
    .then((snapshot) => {
      const blogs = [];
      snapshot.forEach((doc) => {
        blogs.push({
          documentID: doc.id,
          ...doc.data(),
        });
      });

      res.render("admin/blog-admin", { blogs: blogs });
    })
    .catch((error) => {
      res.send("Error: " + error);
    });
});

app.get("/tambah-berita", requireAuth, (req, res) => {
  res.render("admin/tambah-berita");
});

app.get("/edit-berita", requireAuth, (req, res) => {
  const query = req.query;
  res.render("admin/edit-berita", { query });
});

app.get("/paket", requireAuth, (req, res) => {
  db.collection("Paket")
    .get()
    .then((snapshot) => {
      const paket = [];
      snapshot.forEach((doc) => {
        paket.push({
          documentID: doc.id,
          ...doc.data(),
        });
      });

      res.render("admin/paket", { pakets: paket });
    })
    .catch((error) => {
      res.send("Error: " + error);
    });
});

app.get("/tambah-paket", requireAuth, (req, res) => {
  res.render("admin/tambah-paket");
});

app.get("/edit-paket", requireAuth, (req, res) => {
  const query = req.query;
  res.render("admin/edit-paket", { query });
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